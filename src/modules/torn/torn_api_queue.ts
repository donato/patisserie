import { Torn, TornAPI, TornInterfaces } from 'ts-torn-api';
import EventEmitter from 'node:events';
import { ConsumerInterface, LocalConsumerImpl, LocalStreamImpl, StreamInterface } from './queue';
import JSONdb from 'simple-json-db';
import { Db, DbRecord } from '../../utils/db';

export enum UpdateType {
  User = 'user',
  Faction = 'faction',
  Discord = 'discord',
  Chain = 'chain',
  TerritoryWar = 'territory_war',
  CompanyEmployee = 'company_employee',
  Api = 'api',
}

interface UpdateRequest {
  type: UpdateType;
  id: number;
}

const ONE_MINUTE_IN_MS = 60 * 1000;
const ONE_HOUR_IN_MS = 60 * ONE_MINUTE_IN_MS;
const ONE_DAY_IN_MS = 24 * ONE_HOUR_IN_MS;
const UPDATE_TIME_REQUIRED_MS = {
  [UpdateType.User]: ONE_DAY_IN_MS,
  [UpdateType.CompanyEmployee]: ONE_HOUR_IN_MS,
  [UpdateType.Faction]: ONE_DAY_IN_MS,
  [UpdateType.Discord]: 7 * ONE_DAY_IN_MS,
  [UpdateType.Chain]: ONE_MINUTE_IN_MS,
  [UpdateType.TerritoryWar]: ONE_MINUTE_IN_MS * 5,
  [UpdateType.Api]: Number.MAX_SAFE_INTEGER,
};

export class TornApiQueue {
  stream: StreamInterface;
  consumerGroup: ConsumerInterface;

  constructor(readonly tornDb: Db, public readonly updateEmitter = new EventEmitter(), readonly queue: Array<string> = [], readonly emitter: EventEmitter = new EventEmitter()) {
    this.stream = new LocalStreamImpl();
    this.consumerGroup = new LocalConsumerImpl(this.stream);
  }

  async addTornApiKey(tornApi: TornAPI, interval = 5000) {
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
      case UpdateType.CompanyEmployee:
        response = await tornApi.company.employees(id.toString());
        break;
      case UpdateType.Api:
        response = await tornApi.key.info();
      case UpdateType.Chain:
      case UpdateType.TerritoryWar:
      default:
        console.log('not implemented');
    }
    if (!response || TornAPI.isError(response)) {
      // TODO if error is invalid key, mark it for removal
      this.updateEmitter.emit(key, response)
      console.log(response);
      return;
    }
    this.storeResult(key, response);
    this.updateEmitter.emit(key, response);
  }

  private async isCached(type: UpdateType, id: number) {
    const key = `${type}:${id}`;
    const t = await this.tornDb.getLastUpdate(key);
    return this.isUpToDate(type, t);
  }

  isUpToDate(type: UpdateType, lastUpdate: number) {
    const msElapsed = Date.now() - lastUpdate;
    // console.log(`Last update ${lastUpdate}, now ${Date.now()}, difference ${msElapsed}`);
    return msElapsed < UPDATE_TIME_REQUIRED_MS[type];
  }

  private storeResult(key: string, result: any) {
    this.tornDb.set(key, {
      raw: result,
      last_update: Date.now()
    });
    return result;
  }

  private async pullFromQueue(tornApi: TornAPI) {
    // In case it was updated after the item added to the queue
    // TODO - add a pending "LOCK" to avoid multiple consumers on the same key
    let event : UpdateRequest | null;
    do {
      event = this.consumerGroup.read('torn') as UpdateRequest | null;
    } while (event != null && await this.isCached(event.type, event.id));
    if (event) {
      console.log(`Handling queue event ${event.type}:${event.id}`);
      this.makeApiRequest(tornApi, event);
    }
  }
}
