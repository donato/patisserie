import { TornAPI, TornInterfaces } from 'ts-torn-api';
import EventEmitter from 'node:events';
import { ConsumerInterface, LocalConsumerImpl, LocalStreamImpl, StreamInterface } from './queue';


interface UpdateRequest {
  type: string;
  id: number;
}

export class TornApiQueue {
  tornApi: TornAPI;
  stream: StreamInterface;
  consumer: ConsumerInterface;

  constructor(readonly client: any, readonly tornDb: any, readonly discordDb: any, public readonly updateEmitter = new EventEmitter(), readonly queue: Array<string> = [], readonly emitter: EventEmitter = new EventEmitter()) {
    this.tornApi = new TornAPI(this.getApiKey());
    this.tornApi.setComment("Scrattch-Brick");

    this.stream = new LocalStreamImpl();
    this.consumer = new LocalConsumerImpl(this.stream);

    // consider passing a one-time use tornApi instance
    this.emitter
      .on('discord', (o) => this.onUserDiscordUpdate(o))
      .on('faction', (o) => this.onFactionUpdate(o))
      .on('user', (o) => this.onUserUpdate(o));

    setInterval(() => this.pullFromQueue(), 5000);
  }

  userUpdate(id: number) {
    this.stream.add('torn', {type: 'user', id});
  }
  discordUpdate(id: number) {
    this.stream.add('torn', {type: 'discord', id});
  }
  factionUpdate(id: number) {
    this.stream.add('torn', {type: 'faction', id});
  }


  private getApiKey() {
    const apiKeys: { list: Array<string>, user_ids: Array<string> } = this.tornDb.get('torn_api_keys');
    return apiKeys.list[0];
  }

  private onUserUpdate({id}: UpdateRequest) {
    this.tornApi.user.user(id.toString())
      .then(response => {
        if (TornAPI.isError(response)) {
          return;
        }
        this.storeResult('user', response.player_id, response);
      });
  }

  private onFactionUpdate({id}: UpdateRequest) {
    this.tornApi.faction.faction(id.toString()).then(response => {
      if (TornAPI.isError(response)) {
        // channel.send("Torn API Error: " + response.error);
        return;
      }

      this.storeResult('faction', response.ID, response);
      response.members.forEach(member => {
        this.userUpdate(parseInt(member.id));
        this.discordUpdate(parseInt(member.id));
      });
    });
  }

  private onUserDiscordUpdate({id}: UpdateRequest) {
    this.tornApi.user.discord(id.toString()).then(response => {
    	if (TornAPI.isError(response)) {
    		console.log(response);
        // todo error handling
        // this.updateEmitter.emit(`discord:${key}`, 'error...');
    		return;
    	} 
      this.storeResult('discord', parseInt(response.discordID), response);
      this.storeResult('discord', response.userID, response);
    });
  }

  private isUpToDate(type: string, id: number) {
    const key = `${type}:${id}`;
    const lastUpdateKey = `last_update`;
    const json = this.tornDb.get(key);
    if (!json) { return false; }
    const lastUpdate = json[lastUpdateKey]
    const msElapsed = Date.now() - lastUpdate;
    // console.log(`Last update ${lastUpdate}, now ${Date.now()}, difference ${msElapsed}`);
    const oneHourInMs = 1000 * 60 * 60;
    return msElapsed < 24 * oneHourInMs;
  }

  private storeResult(type: string, id: number, result: any) {
    const key = `${type}:${id}`;
    const json = {
      "raw": result,
      "last_update": Date.now()
    };
    this.tornDb.set(key, json);
    this.updateEmitter.emit(key);
    return result;
  }

  private pullFromQueue() {
    const event = this.consumer.read('torn') as UpdateRequest | null;
    if (!event) { return; }

    const {type, id} = event;
    if (this.isUpToDate(type, parseInt(id.toString()))) {
      console.log(`Skipping update for ${type}:${id}`);
      this.pullFromQueue();
      return;
    }
    console.log(`Handling queue event ${type}:${id}`);
    this.emitter.emit(type, { id});
  }
}
