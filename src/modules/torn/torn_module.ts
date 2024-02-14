import { TornAPI, TornInterfaces } from 'ts-torn-api';
import { TornApiQueue } from './torn_api_queue';
import { extractDiscordId } from '../../utils/discord-utils';

// https://github.com/AnIdiotsGuide/discordjs-bot-guide/blob/master/understanding/roles.md

export class TornModule {
  tornApiQueue: TornApiQueue;

  constructor(readonly client: any, readonly tornDb: any, readonly discordDb: any) {
    this.tornApiQueue = new TornApiQueue(client, tornDb, discordDb);
  }

  private getUserData(playerId: string) {
    const key = `user:${playerId}`;
    return this.tornDb.get(key) || {};
  }

  verify(msg: any) {
    const [command, arg1] = msg.content.split(' ');
    const discordId = extractDiscordId(arg1) || msg.author.id;
    msg.channel.send(`Verifying <@!${discordId}>`);
    this.tornApiQueue.updateEmitter.once(`discord:${discordId}`, (result) => {
      if (TornAPI.isError(result)) {
        msg.channel.send("Torn API Error: " + result.error);
        return;
      }
      // TODO update user roles & permissions
      const tornId = result.userID;;
      msg.channel.send(`Torn account found [${tornId}]`);
      this.tornApiQueue.updateEmitter.once(`user:${tornId}`, (userdata) => {
        if (TornAPI.isError(userdata)) {
          msg.channel.send("Torn API Error: " + userdata.error);
          return;
        }
        msg.channel.send(`${userdata.name}[${tornId}] has been verified!`);
      });
      this.tornApiQueue.userUpdate(tornId);
    });
    this.tornApiQueue.discordUpdate(discordId);
  }

  lookup(msg: any) {
    const [command, arg1] = msg.content.split(' ');
    const json = this.getUserData(arg1);
    console.log(json);
    msg.channel.send(JSON.stringify(json));
  }

  faction(msg: any) {
    // TODO - require admin
    const [command, arg1, arg2] = msg.content.split(' ');
    const factionId = parseInt(arg2);

    // this.discordDb.delete('factions-pending');
    // this.discordDb.delete('factions-loaded');
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
        this.tornApiQueue.factionUpdate(factionId);
        return;

      case 'remove':
        // this.discordDb.delete('factions-pending');
        msg.channel.send('NOT IMPLEMENTED');
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

  apiKey(msg: any) {
    // TODO - allow deleting key
    const [command, arg1] = msg.content.split(' ');
    const apiKeys = this.tornDb.get('torn_api_keys') || {};
    apiKeys.list = apiKeys.list || [];
    apiKeys.list.push(arg1);
    apiKeys.user_ids = apiKeys.user_ids || [];
    apiKeys.user_ids.push(msg.author.id);
    this.tornDb.set('torn_api_keys', apiKeys);
    msg.channel.send(`API Key added`);
  }

  updatePendingFactions(msg: any) {
    const factionsPending: { [key: string]: number } = this.discordDb.get('factions-pending') || {};
    const factionsLoaded = this.discordDb.get('factions-loaded') || {};
    // Update factions that were in the pending state (role created but no faction info)
    for (let factionId in factionsPending) {
      const roleId = factionsPending[factionId];
      const factionInfo = this.tornDb.get(`faction:${factionId}`);
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

  updateLoadedFactions(msg: any) {
    const factionsLoaded = this.discordDb.get('factions-loaded') || {};
    for (let factionId in factionsLoaded) {
      this.tornApiQueue.factionUpdate(parseInt(factionId));
      const roleId = factionsLoaded[factionId];
      const role = msg.guild.roles.cache.get(roleId);

      const factionInfo = this.tornDb.get(`faction:${factionId}`);
      const members = factionInfo.raw?.members;
      for (let member of members) {
        const discordInfo = this.tornDb.get(`discord:${member.id}`);
        if (discordInfo) {
          const discordId = discordInfo.raw?.discordID;
          // TODO - this needs a queue
          const member = msg.guild.members.cache.get(discordId);
          if (!member) {
            console.log('member not found ${discordId}');
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
}