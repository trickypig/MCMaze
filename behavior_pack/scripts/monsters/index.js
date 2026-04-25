import { startMonsterScheduler } from "./scheduler";
import { registerPatroller } from "./patroller";
import { registerSleeper } from "./sleeper";
import { registerSentryArcher } from "./sentry_archer";
export function initMonsters() {
    registerPatroller();
    registerSleeper();
    registerSentryArcher();
    startMonsterScheduler();
}
