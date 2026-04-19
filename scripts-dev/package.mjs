import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import archiver from "archiver";
import path from "node:path";

const DIST = "dist";
if (!existsSync(DIST)) mkdirSync(DIST);

function zipPack(srcDir, outName) {
  return new Promise((resolve, reject) => {
    const out = createWriteStream(path.join(DIST, outName));
    const zip = archiver("zip", { zlib: { level: 9 } });
    out.on("close", () => resolve(out.bytesWritten));
    zip.on("error", reject);
    zip.pipe(out);
    zip.directory(srcDir, false);
    zip.finalize();
  });
}

async function main() {
  execSync("npm run build", { stdio: "inherit" });
  const bpBytes = await zipPack("behavior_pack", "TrickyMazeBP.mcpack");
  const rpBytes = await zipPack("resource_pack", "TrickyMazeRP.mcpack");
  console.log(`Built TrickyMazeBP.mcpack (${bpBytes} B)`);
  console.log(`Built TrickyMazeRP.mcpack (${rpBytes} B)`);

  const mcaddon = createWriteStream(path.join(DIST, "TrickyMaze.mcaddon"));
  const zip = archiver("zip", { zlib: { level: 9 } });
  const done = new Promise((res, rej) => {
    mcaddon.on("close", res);
    zip.on("error", rej);
  });
  zip.pipe(mcaddon);
  zip.file(path.join(DIST, "TrickyMazeBP.mcpack"), { name: "TrickyMazeBP.mcpack" });
  zip.file(path.join(DIST, "TrickyMazeRP.mcpack"), { name: "TrickyMazeRP.mcpack" });
  zip.finalize();
  await done;
  console.log("Built TrickyMaze.mcaddon");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
