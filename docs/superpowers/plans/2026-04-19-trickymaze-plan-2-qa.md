# Plan 2 QA Checklist

All scenarios performed in a fresh Creator world with `trickymaze` BP + RP enabled. Content Log GUI must be open.

## Scenario 1 — First floor with Old Prison theme

- [ ] Join world → prison builds automatically
- [ ] Step on prison plate → floor 1 builds below
- [ ] Walls are `stone_bricks`, floor is `cobblestone`, ceiling is `stone_bricks`
- [ ] A chest is visible somewhere in the maze
- [ ] An iron door + pressure plate are visible at the exit cell

## Scenario 2 — No-key plate attempt

- [ ] Stand on the exit pressure plate without having opened the chest
- [ ] Chat shows `§cYou need the floor key.`
- [ ] Standing still on the plate only triggers the message once per second (not once per tick)
- [ ] The iron door does NOT open

## Scenario 3 — With-key plate trigger

- [ ] Open the chest → retrieve a renamed tripwire hook named `Floor Key`
- [ ] Stand on the exit plate
- [ ] The key stack count decrements by 1 (or disappears if it was the only one)
- [ ] The iron door opens (redstone block appears below)
- [ ] Descent cinematic fires: title "Descending…", subtitle "Floor 2", cave sound, wither rumble, thunder weather

## Scenario 4 — Descent lands on floor 2

- [ ] After cinematic ends (4 seconds), players arrive on floor 2
- [ ] Floor 2 is 30 blocks below floor 1 (check y-coordinate)
- [ ] Theme is still Old Prison (floors 1-2)
- [ ] A new chest + key + exit plate are visible on floor 2

## Scenario 5 — Theme switch at floor 3

- [ ] Complete floor 2 → descent to floor 3
- [ ] Walls are `deepslate_bricks`, floor is `blackstone`, ceiling is `deepslate_tiles`
- [ ] Chest + key + exit plate still work the same way

## Scenario 6 — Floor 4 victory

- [ ] Complete floor 4's exit plate with key
- [ ] Descent cinematic fires
- [ ] After cinematic ends, "Run Complete!" title + level-up sound + challenge-complete sound
- [ ] Phase returns to Idle — next player respawn rebuilds the prison
- [ ] No floor 5 is generated

## Scenario 7 — Solo death → spectator

- [ ] On floor 2, intentionally die (e.g., jump into void or use `/kill`)
- [ ] Death screen clears → you are in spectator mode hovering above the maze
- [ ] You can fly through walls and observe the maze
- [ ] The Content Log shows `[TrickyMaze] Player died: <name>`

## Scenario 8 — Co-op partial death + recovery

- [ ] Two-player session (or simulate via second account/device)
- [ ] Player A dies on floor 3 → goes to spectator
- [ ] Player B finds the key and activates the exit plate
- [ ] During descent, Player A is teleported to floor 4 start in survival
- [ ] Player A's gamemode is restored to Adventure + can play floor 4

## Scenario 9 — Total death → GameOver + Restart

- [ ] Solo or co-op, all players die
- [ ] Title shows "Run Failed" + "Floor N • All heroes fell"
- [ ] Chat shows "Use /scriptevent trickymaze:restart to begin a new run."
- [ ] Run `/scriptevent trickymaze:restart`
- [ ] Chat shows "Run reset. Respawn or relog to begin a new run."
- [ ] Respawn or relog → prison rebuilds

## Scenario 10 — World reload mid-floor

- [ ] Start a run, reach floor 3, pick up the key
- [ ] Leave the world and re-enter
- [ ] Content Log shows `[TrickyMaze v1.1] Initialized. phase=FLOOR_ACTIVE floor=3 currentFloor=3 tickingAreas=[tm_prison,tm_floor_3]`
- [ ] Maze is still intact
- [ ] Key is still in your inventory
- [ ] Exit plate still works
- [ ] If reload happened mid-descent, Content Log shows "Reload mid-descent — phase reset to FloorActive" and player must re-step the exit plate to descend
