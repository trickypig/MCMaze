import { startMonsterScheduler } from "./scheduler";
import { registerPatroller } from "./patroller";
import { registerSleeper } from "./sleeper";

export function initMonsters(): void {
  registerPatroller();
  registerSleeper();
  startMonsterScheduler();
}
