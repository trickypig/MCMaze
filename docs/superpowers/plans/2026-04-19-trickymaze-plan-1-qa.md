# TrickyMaze Plan 1 — Acceptance QA

Run each scenario in a fresh Minecraft world with TrickyMaze BP + RP active,
Beta APIs OFF, Content Log GUI ON.

## Scenario 1 — Solo first-join
- [ ] Create a new Creative world (we'll be forced to adventure by the script).
- [ ] Content Log shows `[TrickyMaze] First join detected — building prison.`
- [ ] Within 1–2s, player is teleported into a 5×5 stone-brick room.
- [ ] Gamemode is Adventure (attempt to break a block — should fail).
- [ ] Inventory contains exactly 8 bread.
- [ ] `/gamerule dommobspawning` reports `false`.

## Scenario 2 — Solo floor entry
- [ ] Walk onto the heavy weighted pressure plate.
- [ ] Chat shows `§6You descend into the maze. Floor 1.`
- [ ] Player is teleported to a stone-brick maze at ~Y=-56.
- [ ] Maze has walls; walking around reveals a 37×37 footprint.
- [ ] `/tp @s ~ ~ ~` shows coords near `(10000, -55, 10000)` ± some cells.

## Scenario 3 — Solo death triggers reset
- [ ] Run `/kill @s` inside the maze.
- [ ] Player enters Spectator mode briefly.
- [ ] Actionbar counts down `Respawning in 5` → `0`.
- [ ] Player is teleported back to the prison, Adventure restored, inventory = 8 bread.
- [ ] Chat shows `§7You wake up in the prison. The dungeon resets.`
- [ ] Walking back on the pressure plate generates a new Floor 1.

## Scenario 4 — Co-op partial death (2+ players)
- [ ] Have a second player join (same LAN/Realm world).
- [ ] Both step on pressure plate, enter Floor 1.
- [ ] Player A `/kill @s` — goes to Spectator. Player B remains Adventure on floor.
- [ ] No reset triggers; Player B can still walk around.
- [ ] Player B now `/kill @s` — countdown starts, both players returned to prison.

## Scenario 5 — World reload persists state
- [ ] Start a run to Floor 1.
- [ ] Save & quit world. Reopen.
- [ ] Content Log shows `phase=FLOOR_ACTIVE floor=1` on init.
- [ ] Player is still on the floor (or teleport to maze anchor manually to confirm structure survived).

## Scenario 6 — Shutdown command
- [ ] Run `/scriptevent trickymaze:shutdown`.
- [ ] Chat shows restoration message.
- [ ] `/gamerule dommobspawning` reports `true`.

## Known limitations (Plan 1)
- Mid-run joins are ignored (tolerated, logged).
- The end-of-floor iron door is decorative — you cannot descend to Floor 2 in Plan 1.
- No monsters, no loot chests, no themes beyond stone brick.
- No atmospheric sounds or descent broadcasts.
- All of the above are delivered in Plans 2–5.
