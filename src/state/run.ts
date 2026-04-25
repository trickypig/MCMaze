export enum RunPhase {
  Idle = "IDLE",
  Prison = "PRISON",
  FloorActive = "FLOOR_ACTIVE",
  Descending = "DESCENDING",
  GameOver = "GAME_OVER",
  Resetting = "RESETTING",
}

export type RunStateBlob = {
  phase: RunPhase;
  floor: number;
  currentFloor: number;
  trackedTickingAreas: string[];
};

export class RunState {
  phase: RunPhase = RunPhase.Idle;
  floor: number = 0;
  currentFloor: number = 0;
  trackedTickingAreas: string[] = [];

  private alive = new Set<string>();
  private dead = new Set<string>();

  enterPrison(): void {
    this.phase = RunPhase.Prison;
    this.floor = 0;
    this.currentFloor = 0;
  }

  startFloor(n: number): void {
    if (
      this.phase !== RunPhase.Prison &&
      this.phase !== RunPhase.FloorActive &&
      this.phase !== RunPhase.Descending
    ) {
      throw new Error(`Cannot startFloor from ${this.phase}`);
    }
    this.floor = n;
    this.currentFloor = n;
    this.phase = RunPhase.FloorActive;
  }

  beginDescent(): void {
    if (this.phase !== RunPhase.FloorActive) {
      throw new Error(`Cannot beginDescent from ${this.phase}`);
    }
    this.phase = RunPhase.Descending;
  }

  finishDescent(): void {
    this.phase = RunPhase.FloorActive;
  }

  triggerGameOver(): void {
    this.phase = RunPhase.GameOver;
  }

  markAlive(playerId: string): void {
    this.alive.add(playerId);
    this.dead.delete(playerId);
  }

  markDead(playerId: string): void {
    this.alive.delete(playerId);
    this.dead.add(playerId);
  }

  clearDead(): void {
    for (const id of this.dead) {
      this.alive.add(id);
    }
    this.dead.clear();
  }

  isAlive(playerId: string): boolean {
    return this.alive.has(playerId);
  }

  isDead(playerId: string): boolean {
    return this.dead.has(playerId);
  }

  aliveCount(): number {
    return this.alive.size;
  }

  deadCount(): number {
    return this.dead.size;
  }

  aliveIds(): string[] {
    return [...this.alive];
  }

  deadIds(): string[] {
    return [...this.dead];
  }

  trackTickingArea(name: string): void {
    if (!this.trackedTickingAreas.includes(name)) {
      this.trackedTickingAreas.push(name);
    }
  }

  clearTickingAreas(): void {
    this.trackedTickingAreas = [];
  }

  reset(): void {
    this.alive.clear();
    this.dead.clear();
    this.phase = RunPhase.Prison;
    this.floor = 0;
    this.currentFloor = 0;
    this.trackedTickingAreas = [];
  }

  resetToIdle(): void {
    this.alive.clear();
    this.dead.clear();
    this.phase = RunPhase.Idle;
    this.floor = 0;
    this.currentFloor = 0;
    this.trackedTickingAreas = [];
  }

  serialize(): RunStateBlob {
    return {
      phase: this.phase,
      floor: this.floor,
      currentFloor: this.currentFloor,
      trackedTickingAreas: [...this.trackedTickingAreas],
    };
  }

  static hydrate(blob: RunStateBlob): RunState {
    const s = new RunState();
    s.phase = blob.phase;
    s.floor = blob.floor;
    s.currentFloor = blob.currentFloor ?? 0;
    s.trackedTickingAreas = Array.isArray(blob.trackedTickingAreas)
      ? [...blob.trackedTickingAreas]
      : [];
    return s;
  }
}
