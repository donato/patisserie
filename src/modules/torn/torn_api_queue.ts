import { TornAPI, TornInterfaces } from 'ts-torn-api';
import EventEmitter from 'node:events';


const MessageTypes = {
  "user": {
  },
  "discord": {

  },
  "faction": {
  },
}

interface UpdateRequest {
  id: number;
  channelId: number;
}

export class TornApiQueue {
  tornApi: TornAPI;

  constructor(readonly client: any, readonly tornDb: any, readonly discordDb: any, readonly queue: Array<string> = [], readonly emitter: EventEmitter = new EventEmitter()) {
    this.tornApi = new TornAPI(this.getApiKey());
    this.tornApi.setComment("Scrattch-Brick");

    // consider passing a one-time use tornApi instance
    this.emitter
      .on('verify-user', (o) => this.onUserVerify(o))
      .on('user-discord-update', (o) => this.onUserDiscordUpdate(o))
      .on('faction-update', (o) => this.onFactionUpdate(o))
      .on('user-update', (o) => this.onUserUpdate(o));

    setInterval(() => this.pullFromQueue(), 5000);
  }


  private getApiKey() {
    const apiKeys: { list: Array<string>, user_ids: Array<string> } = this.tornDb.get('torn_api_keys');
    return apiKeys.list[0];
  }

  verify(id: number, channelId: number) {
    this.addToQueue(`verify-user:${id}:${channelId}`);
  }
  userUpdate(id: number, channelId: number) {
    this.addToQueue(`user-update:${id}:${channelId}`);
  }
  discordUpdate(id: number, channelId: number) {
    this.addToQueue(`user-discord-update:${id}:${channelId}`);
  }
  factionUpdate(factionId: number, channelId: number) {
    this.addToQueue(`faction-update:${factionId}:${channelId}`);
  }

  private onUserUpdate({ id, channelId }: UpdateRequest) {
    this.tornApi.user.user(id.toString())
      .then(response => {
        if (TornAPI.isError(response)) {
          return;
        }
        this.storeResult(response.player_id, response, 'user', 'iuser');
      });
  }

  private onUserVerify({ id, channelId }: UpdateRequest) {
    const channel = this.client.channels.cache.get(channelId);

    this.tornApi.user.user(id.toString())
      .then(response => {
        if (TornAPI.isError(response)) {
          channel.send("Torn API Error: " + response.error);
          return;
        }

        this.storeResult(response.player_id, response, 'user', 'iuser');
        // TODO update user roles & permissions
        channel.send(`${response.name}[${response.player_id}] has been verified!`);
        this.discordUpdate(response.player_id, channelId);
      });
  }

  private onFactionUpdate({ id, channelId }: UpdateRequest) {
    const channel = this.client.channels.cache.get(channelId);
    this.tornApi.faction.faction(id.toString()).then(response => {
      if (TornAPI.isError(response)) {
        channel.send("Torn API Error: " + response.error);
        return;
      }

      this.storeResult(response.ID, response, 'faction', 'ifaction');
      response.members.forEach(member => {
        this.userUpdate(parseInt(member.id), channelId);
        this.discordUpdate(parseInt(member.id), channelId);
      });
    });
  }

  private onUserDiscordUpdate({ id, channelId }: UpdateRequest) {
    const channel = this.client.channels.cache.get(channelId);
    this.tornApi.user.discord(id.toString()).then(response => {
    	if (TornAPI.isError(response)) {
    		console.log(response);
    		return;
    	} 
    this.storeResult(response.userID, response, 'discord', 'idiscord');
    });
  }

  private isUpToDate(id: number, keyPrefix: string, propertyName: string) {
    const key = `${keyPrefix}:${id}`;
    const lastUpdateKey = `${propertyName}_last_update`;
    const json = this.tornDb.get(key);
    if (!json) { return false; }
    const lastUpdate = json[lastUpdateKey]
    const msElapsed = Date.now() - lastUpdate;
    // console.log(`Last update ${lastUpdate}, now ${Date.now()}, difference ${msElapsed}`);
    const oneHourInMs = 1000 * 60 * 60;
    return msElapsed < 24 * oneHourInMs;
  }

  private storeResult(id: number, result: any, keyPrefix: string, propertyName: string) {
    const key = `${keyPrefix}:${id}`;
    const json = this.tornDb.get(key) || {};

    Object.assign(json, {
      [`${propertyName}`]: result,
      [`${propertyName}_last_update`]: Date.now()
    });
    this.tornDb.set(key, json);
    return result;
  }

  // todo: use redis for queue
  private addToQueue(event: string) {
    console.log(`Adding to queue ${event}`);
    this.queue.push(event);
  }

  pullFromQueue() {
    if (this.queue.length < 1) {
      return;
    }
    // TODO - move to temp until finished to prevent loss
    const event = this.queue.pop();
    if (!event) { return; }
    console.log(`Pulled from queue ${event}`);

    const [eventType, id, channelId] = event?.split(':');
    if (eventType == 'user-update' && this.isUpToDate(parseInt(id.toString()), 'user', 'iuser')) {
      console.log(`Skipping update for ${id}`);
      this.pullFromQueue();
      return;
    }
    this.emitter.emit(eventType, { id, channelId });
  }
}
