import { describe, it, expect, beforeEach } from "vitest";
import { RunState, RunPhase } from "../src/state/run";

describe("RunState", () => {
  let state: RunState;

  beforeEach(() => {
    state = new RunState();
  });

  it("starts in IDLE with floor 0 and empty alive set", () => {
    expect(state.phase).toBe(RunPhase.Idle);
    expect(state.floor).toBe(0);
    expect(state.aliveCount()).toBe(0);
  });

  it("transitions IDLE -> PRISON on enterPrison()", () => {
    state.enterPrison();
    expect(state.phase).toBe(RunPhase.Prison);
    expect(state.floor).toBe(0);
  });

  it("transitions PRISON -> FLOOR_ACTIVE on startFloor(1)", () => {
    state.enterPrison();
    state.startFloor(1);
    expect(state.phase).toBe(RunPhase.FloorActive);
    expect(state.floor).toBe(1);
  });

  it("tracks alive set add/remove", () => {
    state.enterPrison();
    state.markAlive("player-a");
    state.markAlive("player-b");
    expect(state.aliveCount()).toBe(2);
    state.markDead("player-a");
    expect(state.aliveCount()).toBe(1);
    expect(state.isAlive("player-a")).toBe(false);
    expect(state.isAlive("player-b")).toBe(true);
  });

  it("markDead moves the id from alive to dead set", () => {
    const state = new RunState();
    state.enterPrison();
    state.markAlive("player-a");
    state.startFloor(1);
    state.markDead("player-a");
    expect(state.isDead("player-a")).toBe(true);
    expect(state.aliveCount()).toBe(0);
    // Phase does NOT auto-change — the event handler drives GameOver.
    expect(state.phase).toBe(RunPhase.FloorActive);
  });

  it("reset() clears floor and alive set back to prison defaults", () => {
    state.enterPrison();
    state.markAlive("player-a");
    state.startFloor(3);
    state.markDead("player-a");
    state.reset();
    expect(state.phase).toBe(RunPhase.Prison);
    expect(state.floor).toBe(0);
    expect(state.aliveCount()).toBe(0);
  });

  it("serialize/hydrate roundtrip preserves phase and floor", () => {
    state.enterPrison();
    state.startFloor(2);
    const blob = state.serialize();
    const restored = RunState.hydrate(blob);
    expect(restored.phase).toBe(RunPhase.FloorActive);
    expect(restored.floor).toBe(2);
  });
});

describe("RunState — Plan 2 extensions", () => {
  it("tracks a dead set separately from alive", () => {
    const state = new RunState();
    state.enterPrison();
    state.startFloor(1);
    state.markAlive("a");
    state.markAlive("b");
    state.markDead("a");
    expect(state.aliveCount()).toBe(1);
    expect(state.deadCount()).toBe(1);
    expect(state.isDead("a")).toBe(true);
  });

  it("GameOver is reachable via triggerGameOver() when all alive dead", () => {
    const state = new RunState();
    state.enterPrison();
    state.markAlive("a");
    state.startFloor(1);
    state.markDead("a");
    state.triggerGameOver();
    expect(state.phase).toBe(RunPhase.GameOver);
  });

  it("clearDead() moves every dead id back into alive", () => {
    const state = new RunState();
    state.enterPrison();
    state.markAlive("a");
    state.markAlive("b");
    state.startFloor(1);
    state.markDead("a");
    state.clearDead();
    expect(state.aliveCount()).toBe(2);
    expect(state.deadCount()).toBe(0);
    expect(state.isDead("a")).toBe(false);
  });

  it("currentFloor + trackedTickingAreas default to empty", () => {
    const state = new RunState();
    expect(state.currentFloor).toBe(0);
    expect(state.trackedTickingAreas).toEqual([]);
  });

  it("trackTickingArea() deduplicates names", () => {
    const state = new RunState();
    state.trackTickingArea("tm_prison");
    state.trackTickingArea("tm_prison");
    state.trackTickingArea("tm_floor_1");
    expect(state.trackedTickingAreas).toEqual(["tm_prison", "tm_floor_1"]);
  });
});
