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

  it("transitions FLOOR_ACTIVE -> RESETTING when last alive dies", () => {
    state.enterPrison();
    state.markAlive("player-a");
    state.startFloor(1);
    state.markDead("player-a");
    expect(state.phase).toBe(RunPhase.Resetting);
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
