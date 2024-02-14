import JSONdb from "simple-json-db";
import { TornApiQueue, UpdateType } from "./torn_api_queue";

const ONE_MINUTE_IN_MS = 60 * 1000;

export class TornCache {
  constructor(readonly tornDb: JSONdb, readonly tornApiQueue: TornApiQueue) {

  }

  get(type: UpdateType, id: number) {
    const key = `${type}:${id}`;
    const json = this.tornDb.get(key);
    // Check if it's cached first
    if (this.tornApiQueue.isCached(type, json)) {
      return Promise.resolve(json.raw);
    }

    // If not, do an update and wait for result
    const p = new Promise(resolve => {
      this.tornApiQueue.updateEmitter.once(key, (result) => {
        resolve(result);
      });
      this.tornApiQueue.update(type, id);
    });
    const timeout = new Promise(resolve => setTimeout(() => resolve(null), ONE_MINUTE_IN_MS));
    return Promise.race([p, timeout]);
  }

  refresh(type: UpdateType, id: number) {
    const key = `${type}:${id}`;
    this.tornApiQueue.update(type, id);
  }
}