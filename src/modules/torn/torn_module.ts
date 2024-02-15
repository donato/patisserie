import { TornAPI, TornInterfaces } from 'ts-torn-api';
import {TornCache} from './torn_cache';
import {UpdateType, TornApiQueue} from './torn_api_queue';
import { extractDiscordId } from '../../utils/discord-utils';
import { IDiscord, IFaction } from 'ts-torn-api/dist/Interfaces';
import JSONdb from 'simple-json-db';

// https://github.com/AnIdiotsGuide/discordjs-bot-guide/blob/master/understanding/roles.md

export class TornModule {
  private tornCache: TornCache;

  constructor(readonly client: any, readonly tornDb: JSONdb, readonly discordDb: JSONdb) {
    const tornApiQueue = new TornApiQueue(tornDb);
    this.tornCache = new TornCache(tornDb, tornApiQueue);

    const tornApi = new TornAPI(this.getApiKey());
    tornApi.setComment("Scrattch-Brick");
    tornApiQueue.addTornApiKey(tornApi);
  }

  private getApiKey() {
    const apiKeys: { list: Array<string>, user_ids: Array<string> } = this.tornDb.get('torn_api_keys');
    return apiKeys.list[0];
  }

  async verify(msg: any) {
    const [command, arg1] = msg.content.split(' ');
    const discordId = extractDiscordId(arg1) || msg.author.id;
    msg.channel.send(`Verifying <@!${discordId}>`);
    const result:IDiscord = await this.tornCache.get(UpdateType.Discord, discordId);
    if (TornAPI.isError(result)) {
      msg.channel.send("Torn API Error: " + result.error);
      return;
    }
    console.log(result);
    // TODO update user roles & permissions
    const tornId = result.userID;;
    msg.channel.send(`Torn account found [${tornId}]`);
    const userdata = await this.tornCache.get(UpdateType.User, tornId);
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

    const factionsPending: { [key: string]: number } = this.discordDb.get('factions-pending') || {};
    const factionsLoaded = this.discordDb.get('factions-loaded') || {};
    switch (arg1) {
      case 'add':
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

  // apiKey(msg: any) {
  //   // TODO - allow deleting key
  //   const [command, arg1] = msg.content.split(' ');
  //   const apiKeys = this.tornDb.get('torn_api_keys') || {};
  //   apiKeys.list = apiKeys.list || [];
  //   apiKeys.list.push(arg1);
  //   apiKeys.user_ids = apiKeys.user_ids || [];
  //   apiKeys.user_ids.push(msg.author.id);
  //   this.tornDb.set('torn_api_keys', apiKeys);
  //   msg.channel.send(`API Key added`);
  // }

  private async updatePendingFactions(msg: any) {
    const factionsPending: { [key: string]: number } = this.discordDb.get('factions-pending') || {};
    const factionsLoaded = this.discordDb.get('factions-loaded') || {};
    // Update factions that were in the pending state (role created but no faction info)
    for (let factionId in factionsPending) {
      const roleId = factionsPending[factionId];
      const factionInfo = await this.tornCache.get(UpdateType.Faction, parseInt(factionId));
      if (factionInfo) {
        msg.guild.roles.cache.get(roleId).setName(factionInfo.raw.name);
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
      const result: IFaction = await this.tornCache.get(UpdateType.Faction, parseInt(factionId));
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
      const discordInfo = await this.tornCache.get(UpdateType.Discord, parseInt(member.id));
      if (discordInfo) {
        const discordId = discordInfo.raw?.discordID;
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