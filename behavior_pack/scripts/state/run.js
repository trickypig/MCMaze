export var RunPhase;
(function (RunPhase) {
    RunPhase["Idle"] = "IDLE";
    RunPhase["Prison"] = "PRISON";
    RunPhase["FloorActive"] = "FLOOR_ACTIVE";
    RunPhase["Descending"] = "DESCENDING";
    RunPhase["Resetting"] = "RESETTING";
})(RunPhase || (RunPhase = {}));
export class RunState {
    phase = RunPhase.Idle;
    floor = 0;
    alive = new Set();
    enterPrison() {
        this.phase = RunPhase.Prison;
        this.floor = 0;
    }
    startFloor(n) {
        if (this.phase !== RunPhase.Prison && this.phase !== RunPhase.FloorActive) {
            throw new Error(`Cannot startFloor from ${this.phase}`);
        }
        this.floor = n;
        this.phase = RunPhase.FloorActive;
    }
    beginDescent() {
        if (this.phase !== RunPhase.FloorActive) {
            throw new Error(`Cannot beginDescent from ${this.phase}`);
        }
        this.phase = RunPhase.Descending;
    }
    markAlive(playerId) {
        this.alive.add(playerId);
    }
    markDead(playerId) {
        this.alive.delete(playerId);
        if (this.phase === RunPhase.FloorActive &&
            this.alive.size === 0) {
            this.phase = RunPhase.Resetting;
        }
    }
    isAlive(playerId) {
        return this.alive.has(playerId);
    }
    aliveCount() {
        return this.alive.size;
    }
    reset() {
        this.alive.clear();
        this.phase = RunPhase.Prison;
        this.floor = 0;
    }
    serialize() {
        return { phase: this.phase, floor: this.floor };
    }
    static hydrate(blob) {
        const s = new RunState();
        s.phase = blob.phase;
        s.floor = blob.floor;
        return s;
    }
}
