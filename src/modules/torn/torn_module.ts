import { TornAPI, TornInterfaces } from 'ts-torn-api';
import {TornCache} from './torn_cache';
import {UpdateType, TornApiQueue} from './torn_api_queue';
import { extractDiscordId } from '../../utils/discord-utils';
import { Db } from '../../utils/db';
import { IAPIKeyInfo, IDiscord, IFaction, IUser } from 'ts-torn-api/dist/Interfaces';
import JSONdb from 'simple-json-db';

// https://github.com/AnIdiotsGuide/discordjs-bot-guide/blob/master/understanding/roles.md

export class TornModule {
  private tornCache: TornCache;

  constructor(readonly tornDb: Db, readonly discordDb: JSONdb) {
    const tornApiQueue = new TornApiQueue(tornDb);
    this.tornCache = new TornCache(tornDb, tornApiQueue);

    this.initializeApiKeys(tornApiQueue);
  }

  private initializeApiKeys(tornApiQueue: TornApiQueue) {
    const apiKeys: string[] = this.discordDb.get('torn_api_keys');
    for (let key of apiKeys) {
      console.log(`Creating Torn API consumer for ${key}`);
      const tornApi = new TornAPI(key);
      tornApi.setComment("Scrattch-Brick");
      tornApiQueue.addTornApiKey(tornApi);
    }
  }

  async verify(msg: any) {
    const [command, arg1] = msg.content.split(' ');
    const discordId = extractDiscordId(arg1) || msg.author.id;
    msg.channel.send(`Verifying <@!${discordId}>`);
    const result =
      await this.tornCache.get(UpdateType.Discord, discordId) as IDiscord;
    if (TornAPI.isError(result)) {
      msg.channel.send("Torn API Error: " + result.error);
      return;
    }
    console.log(result);
    // TODO update user roles & permissions
    const tornId = result.userID;;
    msg.channel.send(`Torn account found [${tornId}]`);
    const userdata = await this.tornCache.get(UpdateType.User, tornId) as IUser;
    if (TornAPI.isError(userdata)) {
      msg.channel.send("Torn API Error: " + userdata.error);
      return;
    }
    msg.channel.send(`${userdata.name}[${tornId}] has been verified!`);
  }

  async lookup(msg: any) {
    const [command, playerId] = msg.content.split(' ');
    const json = await this.tornCache.get(UpdateType.User, playerId);
    console.log(json);
    msg.channel.send(JSON.stringify(json));
  }

  async faction(msg: any) {
    // TODO - require admin
    const [command, arg1, arg2] = msg.content.split(' ');
    const factionId = parseInt(arg2);

    switch (arg1) {
      case 'add':
        const factionsPending: { [key: string]: number } = this.discordDb.get('factions-pending') || {};
        const factionsLoaded = this.discordDb.get('factions-loaded') || {};
        if (!(factionId in factionsPending) && !(factionId in factionsLoaded)) {
          msg.guild.roles.create({
            name: `faction:${factionId}`,
            // color: Colors.Blue,
            // reason: 'we needed a role for Super Cool People',
          }).then((info: any) => {
            const roleId = info.id;
            factionsPending[factionId.toString()] = roleId;
            this.discordDb.set('factions-pending', factionsPending);
            msg.channel.send(`Role created <@&${roleId}>`);
          }).catch(console.error);
        } else {
          const roleId = factionsLoaded[factionId] || factionsPending[factionId];
          msg.channel.send(`Role already exists <@&${roleId}>`);
        }
        this.tornCache.refresh(UpdateType.Faction, factionId);
        return;

      case 'remove':
        // this.discordDb.delete('factions-pending');
        msg.channel.send('NOT IMPLEMENTED');
        return;
      case 'clear':
        // this.discordDb.delete('factions-pending');
        // this.discordDb.delete('factions-loaded');
        return;

      case 'refresh':
        this.updatePendingFactions(msg);
        this.updateLoadedFactions(msg);
        return;

      default:
        msg.channel.send('Please use !faction add or !faction remove');
        return;
    }
  }

  async apiKey(msg: any) {
    // TODO - allow deleting key
    const [command, id] = msg.content.split(' ');
    const apiKeys: string[] = this.discordDb.get('torn_api_keys') || [];
    console.log(apiKeys);
    if (apiKeys.includes(id)) {
      msg.channel.send(`Already stored`);
      return;
    }
    const testTornApi = new TornAPI(id);
    testTornApi.setComment("Scrattch-Brick");
    const apiInfo = await testTornApi.key.info() as IAPIKeyInfo;

    if (!apiInfo || TornAPI.isError(apiInfo)) {
      msg.channel.send(`key invalid`);
    }

    apiKeys.push(id);
    this.discordDb.set('torn_api_keys', apiKeys);
    msg.channel.send(`${apiInfo.access_type} key added`);
    // TODO - it will be there on reload, but not used immediately...
  }

  private async updatePendingFactions(msg: any) {
    const factionsPending: { [key: string]: number } = this.discordDb.get('factions-pending') || {};
    const factionsLoaded = this.discordDb.get('factions-loaded') || {};
    // Update factions that were in the pending state (role created but no faction info)
    for (let factionId in factionsPending) {
      const roleId = factionsPending[factionId];
      const factionInfo = await this.tornCache.get(UpdateType.Faction, parseInt(factionId)) as IFaction;
      if (factionInfo) {
        msg.guild.roles.cache.get(roleId).setName(factionInfo.name);
        msg.channel.send(`Role updated <@&${roleId}>`);
        factionsLoaded[factionId] = factionsPending[factionId];
        delete factionsPending[factionId];
      }
    }
    this.discordDb.set('factions-pending', factionsPending);
    this.discordDb.set('factions-loaded', factionsLoaded);
  }

  private async updateLoadedFactions(msg: any) {
    const factionsLoaded = this.discordDb.get('factions-loaded') || {};
    for (let factionId in factionsLoaded) {
      const roleId = factionsLoaded[factionId];
      const result = await this.tornCache.get(UpdateType.Faction, parseInt(factionId)) as IFaction;
      this.updateFactionMembers(result);
      this.setDiscordRolesForUsers(result, roleId, msg);
    }
  }

  updateFactionMembers(response: IFaction) {
    response.members.forEach(member => {
      this.tornCache.refresh(UpdateType.User, parseInt(member.id));
      this.tornCache.refresh(UpdateType.Discord, parseInt(member.id));
    });
  }

  async setDiscordRolesForUsers(result: IFaction, roleId: any, msg: any) {
    const role = msg.guild.roles.cache.get(roleId);

    for (let member of result.members) {
      const discordInfo =
          await this.tornCache.get(UpdateType.Discord, parseInt(member.id)) as IDiscord;
      if (discordInfo) {
        const discordId = discordInfo.discordID;
        // todo - guild.members.cache is unreliable, use fetch
        const member = msg.guild.members.cache.get(discordId);
        if (!member) {
          console.log(`member not found ${discordId}`);
        } else {
          if (member.roles.cache.get(role.id)) {
            console.log('already has role');
          } else {
            console.log('adding role for member');
            member.roles.add(role).catch(console.error);
          }
        }
      }
    }
  }
}