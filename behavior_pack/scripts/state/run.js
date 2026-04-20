export var RunPhase;
(function (RunPhase) {
    RunPhase["Idle"] = "IDLE";
    RunPhase["Prison"] = "PRISON";
    RunPhase["FloorActive"] = "FLOOR_ACTIVE";
    RunPhase["Descending"] = "DESCENDING";
    RunPhase["GameOver"] = "GAME_OVER";
    RunPhase["Resetting"] = "RESETTING";
})(RunPhase || (RunPhase = {}));
export class RunState {
    phase = RunPhase.Idle;
    floor = 0;
    currentFloor = 0;
    trackedTickingAreas = [];
    alive = new Set();
    dead = new Set();
    enterPrison() {
        this.phase = RunPhase.Prison;
        this.floor = 0;
        this.currentFloor = 0;
    }
    startFloor(n) {
        if (this.phase !== RunPhase.Prison && this.phase !== RunPhase.FloorActive) {
            throw new Error(`Cannot startFloor from ${this.phase}`);
        }
        this.floor = n;
        this.currentFloor = n;
        this.phase = RunPhase.FloorActive;
    }
    beginDescent() {
        if (this.phase !== RunPhase.FloorActive) {
            throw new Error(`Cannot beginDescent from ${this.phase}`);
        }
        this.phase = RunPhase.Descending;
    }
    finishDescent() {
        this.phase = RunPhase.FloorActive;
    }
    triggerGameOver() {
        this.phase = RunPhase.GameOver;
    }
    markAlive(playerId) {
        this.alive.add(playerId);
        this.dead.delete(playerId);
    }
    markDead(playerId) {
        this.alive.delete(playerId);
        this.dead.add(playerId);
    }
    clearDead() {
        for (const id of this.dead) {
            this.alive.add(id);
        }
        this.dead.clear();
    }
    isAlive(playerId) {
        return this.alive.has(playerId);
    }
    isDead(playerId) {
        return this.dead.has(playerId);
    }
    aliveCount() {
        return this.alive.size;
    }
    deadCount() {
        return this.dead.size;
    }
    aliveIds() {
        return [...this.alive];
    }
    deadIds() {
        return [...this.dead];
    }
    trackTickingArea(name) {
        if (!this.trackedTickingAreas.includes(name)) {
            this.trackedTickingAreas.push(name);
        }
    }
    clearTickingAreas() {
        this.trackedTickingAreas = [];
    }
    reset() {
        this.alive.clear();
        this.dead.clear();
        this.phase = RunPhase.Prison;
        this.floor = 0;
        this.currentFloor = 0;
        this.trackedTickingAreas = [];
    }
    resetToIdle() {
        this.alive.clear();
        this.dead.clear();
        this.phase = RunPhase.Idle;
        this.floor = 0;
        this.currentFloor = 0;
        this.trackedTickingAreas = [];
    }
    serialize() {
        return {
            phase: this.phase,
            floor: this.floor,
            currentFloor: this.currentFloor,
            trackedTickingAreas: [...this.trackedTickingAreas],
        };
    }
    static hydrate(blob) {
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
