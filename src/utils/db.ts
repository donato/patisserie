import { RedisClientType } from "redis";

export interface DbRecord {
  raw: unknown;
  last_update: number;
}

function isDbRecord(json: unknown): json is DbRecord {
  return !!json && (typeof json === 'object') &&
      json.hasOwnProperty('raw') && json.hasOwnProperty('last_update');
}
export class Db {

  constructor(readonly redis: RedisClientType) {}

  async get(key: string) {
    return (await this.getRecord(key))?.raw;
  }

  async getLastUpdate(key: string) {
    return (await this.getRecord(key))?.last_update || 0;
  }

  async getRecord(key: string) {
    const value = await this.redis.get(key)
    if (!value) {
      return null;
    }
    try {
      const json = JSON.parse(value);
      if (isDbRecord(json)) {
        return json;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  set(key:string,  value: DbRecord) {
    return this.redis.set(key, JSON.stringify(value));
  }
}