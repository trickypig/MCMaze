import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, mkdirSync, cpSync } from "node:fs";
import path from "node:path";
import os from "node:os";

function loadEnv(file) {
  if (!existsSync(file)) return;
  const raw = readFileSync(file, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}

loadEnv(".env");

const PROJECT_NAME = process.env.PROJECT_NAME ?? "trickymaze";
const PRODUCT = process.env.MINECRAFT_PRODUCT ?? "BedrockUWP";

const PRESETS = {
  BedrockUWP: path.join(
    os.homedir(),
    "AppData",
    "Local",
    "Packages",
    "Microsoft.MinecraftUWP_8wekyb3d8bbwe",
    "LocalState",
    "games",
    "com.mojang",
  ),
  PreviewUWP: path.join(
    os.homedir(),
    "AppData",
    "Local",
    "Packages",
    "Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe",
    "LocalState",
    "games",
    "com.mojang",
  ),
};

function resolveComMojang() {
  if (PRODUCT === "Custom") {
    const p = process.env.CUSTOM_DEPLOYMENT_PATH;
    if (!p) {
      console.error("MINECRAFT_PRODUCT=Custom requires CUSTOM_DEPLOYMENT_PATH in .env");
      process.exit(1);
    }
    return p;
  }
  const p = PRESETS[PRODUCT];
  if (!p) {
    console.error(`Unknown MINECRAFT_PRODUCT '${PRODUCT}'. Valid: BedrockUWP, PreviewUWP, Custom.`);
    process.exit(1);
  }
  return p;
}

function deployPack(srcDir, kind) {
  const comMojang = resolveComMojang();
  if (!existsSync(comMojang)) {
    console.error(`com.mojang not found at: ${comMojang}`);
    console.error("Launch Minecraft once or set MINECRAFT_PRODUCT correctly in .env.");
    process.exit(1);
  }
  const destParent = path.join(comMojang, `development_${kind}_packs`);
  mkdirSync(destParent, { recursive: true });
  const dest = path.join(destParent, PROJECT_NAME);
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  cpSync(srcDir, dest, { recursive: true });
  return dest;
}

function main() {
  console.log("Building…");
  execSync("npm run build", { stdio: "inherit" });

  console.log(`Deploying to Minecraft (${PRODUCT})…`);
  const bpDest = deployPack("behavior_pack", "behavior");
  const rpDest = deployPack("resource_pack", "resource");
  console.log(`  BP -> ${bpDest}`);
  console.log(`  RP -> ${rpDest}`);
  console.log("Done. Restart the world (or the game) to pick up changes.");
}

main();
