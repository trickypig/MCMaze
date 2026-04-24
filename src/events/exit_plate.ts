import { world, system, Player } from "@minecraft/server";
import { RunPhase, type RunState } from "../state/run";
import { activeFloor } from "./pressure_plate";
import { playerHasKey, consumeKey } from "./key_inventory";
import { beginDescent, isDescentInFlight } from "./descent";

const NO_KEY_MSG_COOLDOWN_TICKS = 20; // 1 second
const noKeyMsgByPlayer = new Map<string, number>();

export function registerExitPlatePoll(state: RunState): void {
  system.runInterval(() => {
    if (state.phase !== RunPhase.FloorActive) return;
    if (isDescentInFlight()) return;
    if (!activeFloor) return;
    const plate = activeFloor.fixtures.exitPlatePos;

    for (const p of world.getAllPlayers()) {
      if (!state.isAlive(p.id)) continue;
      const loc = p.location;
      if (
        Math.floor(loc.x) !== plate.x ||
        Math.floor(loc.y) !== plate.y ||
        Math.floor(loc.z) !== plate.z
      ) {
        continue;
      }
      if (playerHasKey(p)) {
        handleKeyedStep(state, p);
        return; // only one trigger per tick
      } else {
        maybeSendNoKeyMessage(p);
      }
    }
  }, 20);
}

function handleKeyedStep(state: RunState, player: Player): void {
  consumeKey(player);
  openExitDoor();
  beginDescent(state);
}

function openExitDoor(): void {
  if (!activeFloor) return;
  const doorPos = activeFloor.fixtures.exitDoorPos;
  const dim = world.getDimension("overworld");
  // Place a redstone block directly below the door to open it.
  dim.runCommand(
    `setblock ${doorPos.x} ${doorPos.y - 1} ${doorPos.z} minecraft:redstone_block`,
  );
}

function maybeSendNoKeyMessage(player: Player): void {
  const now = system.currentTick;
  const last = noKeyMsgByPlayer.get(player.id) ?? 0;
  if (now - last < NO_KEY_MSG_COOLDOWN_TICKS) return;
  player.sendMessage("§cYou need the floor key.");
  noKeyMsgByPlayer.set(player.id, now);
}
