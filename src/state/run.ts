export enum RunPhase {
  Idle = "IDLE",
  Prison = "PRISON",
  FloorActive = "FLOOR_ACTIVE",
  Descending = "DESCENDING",
  Resetting = "RESETTING",
}

export type RunStateBlob = {
  phase: RunPhase;
  floor: number;
};

export class RunState {
  phase: RunPhase = RunPhase.Idle;
  floor: number = 0;
  private alive = new Set<string>();

  enterPrison(): void {
    this.phase = RunPhase.Prison;
    this.floor = 0;
  }

  startFloor(n: number): void {
    if (this.phase !== RunPhase.Prison && this.phase !== RunPhase.FloorActive) {
      throw new Error(`Cannot startFloor from ${this.phase}`);
    }
    this.floor = n;
    this.phase = RunPhase.FloorActive;
  }

  beginDescent(): void {
    if (this.phase !== RunPhase.FloorActive) {
      throw new Error(`Cannot beginDescent from ${this.phase}`);
    }
    this.phase = RunPhase.Descending;
  }

  markAlive(playerId: string): void {
    this.alive.add(playerId);
  }

  markDead(playerId: string): void {
    this.alive.delete(playerId);
    if (
      this.phase === RunPhase.FloorActive &&
      this.alive.size === 0
    ) {
      this.phase = RunPhase.Resetting;
    }
  }

  isAlive(playerId: string): boolean {
    return this.alive.has(playerId);
  }

  aliveCount(): number {
    return this.alive.size;
  }

  reset(): void {
    this.alive.clear();
    this.phase = RunPhase.Prison;
    this.floor = 0;
  }

  serialize(): RunStateBlob {
    return { phase: this.phase, floor: this.floor };
  }

  static hydrate(blob: RunStateBlob): RunState {
    const s = new RunState();
    s.phase = blob.phase;
    s.floor = blob.floor;
    return s;
  }
}
