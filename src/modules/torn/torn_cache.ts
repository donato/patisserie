import JSONdb from "simple-json-db";
import { TornApiQueue, UpdateType } from "./torn_api_queue";
import { Db } from '../../utils/db';

const ONE_MINUTE_IN_MS = 60 * 1000;

export class TornCache {
  constructor(readonly tornDb: Db, readonly tornApiQueue: TornApiQueue) {
  }

  async get(type: UpdateType, id: number): Promise<unknown> {
    const key = `${type}:${id}`;
    const record = await this.tornDb.getRecord(key);
    // Check if it's cached first
    if (record && this.tornApiQueue.isUpToDate(type, record.last_update)) {
      return Promise.resolve(record.raw);
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