import { Torn, TornAPI, TornInterfaces } from 'ts-torn-api';
import EventEmitter from 'node:events';
import { ConsumerInterface, LocalConsumerImpl, LocalStreamImpl, StreamInterface } from './queue';
import JSONdb from 'simple-json-db';

export enum UpdateType {
  User = 'user',
  Faction = 'faction',
  Discord = 'discord',
  Chain = 'chain',
  TerritoryWar = 'territory_war',
}

interface UpdateRequest {
  type: UpdateType;
  id: number;
}


const ONE_MINUTE_IN_MS = 1000 * 60;
const ONE_HOUR_IN_MS = 1000 * 60 * 60;
const UPDATE_TIME_REQUIRED_MS = {
  [UpdateType.User]: ONE_HOUR_IN_MS * 6,
  [UpdateType.Faction]: ONE_HOUR_IN_MS * 24,
  [UpdateType.Discord]: ONE_HOUR_IN_MS * 24 * 30,
  [UpdateType.Chain]: ONE_MINUTE_IN_MS * 1,
  [UpdateType.TerritoryWar]: ONE_MINUTE_IN_MS * 5,
};

export class TornApiQueue {
  stream: StreamInterface;
  consumer: ConsumerInterface;

  constructor(readonly tornDb: JSONdb, public readonly updateEmitter = new EventEmitter(), readonly queue: Array<string> = [], readonly emitter: EventEmitter = new EventEmitter()) {
    this.stream = new LocalStreamImpl();
    this.consumer = new LocalConsumerImpl(this.stream);
  }

  addTornApiKey(tornApi: TornAPI, interval = 5000) {
    setInterval(() => this.pullFromQueue(tornApi), interval);
  }

  update(type: UpdateType, id: number) {
    this.stream.add('torn', { type, id });
  }

  private async makeApiRequest(tornApi: TornAPI, { type, id }: UpdateRequest) {
    const key = `${type}:${id}`;
    let response;
    switch (type) {
      case UpdateType.User:
        response = await tornApi.user.user(id.toString());
        break;
      case UpdateType.Discord:
        response = await tornApi.user.discord(id.toString());
        break;
      case UpdateType.Faction:
        response = await tornApi.faction.faction(id.toString());
        break;
      case UpdateType.Chain:
      case UpdateType.TerritoryWar:
      default:
        console.log('not implement');
    }
    if (!response || TornAPI.isError(response)) {
      this.updateEmitter.emit(key, response)
      console.log(response);
      return;
    }
    this.storeResult(key, response);
    this.updateEmitter.emit(key, response);
  }

  private isUpToDate(type: UpdateType, id: number) {
    const key = `${type}:${id}`;
    const json = this.tornDb.get(key);
    return this.isCached(type, json);
  }

  isCached(type: UpdateType, json: any) {
    if (!json) { return false; }
    const lastUpdateKey = `last_update`;
    const lastUpdate = json[lastUpdateKey]
    const msElapsed = Date.now() - lastUpdate;
    // console.log(`Last update ${lastUpdate}, now ${Date.now()}, difference ${msElapsed}`);
    return msElapsed < UPDATE_TIME_REQUIRED_MS[type];
  }

  private storeResult(key: string, result: any) {
    const json = {
      'raw': result,
      'last_update': Date.now()
    };
    this.tornDb.set(key, json);
    return result;
  }

  private pullFromQueue(tornApi: TornAPI) {
    const event = this.consumer.read('torn') as UpdateRequest | null;
    if (!event) { return; }

    const { type, id } = event;
    // In case it was updated after the item added to the queue
    // TODO - add a pending "LOCK" to avoid multiple consumers on the same key
    if (this.isUpToDate(type, id)) {
      console.log(`Skipping update for ${type}:${id}`);
      this.pullFromQueue(tornApi);
      return;
    }
    console.log(`Handling queue event ${type}:${id}`);
    this.makeApiRequest(tornApi, {type, id});
  }
}
