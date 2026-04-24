import { startMonsterScheduler } from "./scheduler";
import { registerPatroller } from "./patroller";

export function initMonsters(): void {
  registerPatroller();
  startMonsterScheduler();
}
