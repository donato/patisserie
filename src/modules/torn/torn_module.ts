import { TornAPI, TornInterfaces } from 'ts-torn-api';
import {Client, TextChannel} from 'discord.js';
import { TornCache } from './torn_cache';
import { AppendOnlyLog } from './append_only_log';
import { UpdateType, TornApiQueue } from './torn_api_queue';
import { extractDiscordId } from '../../utils/discord-utils';
import { Db } from '../../utils/db';
import { IAPIKeyInfo, ICompanyEmployee, IDiscord, IFaction, IUser } from 'ts-torn-api/dist/Interfaces';
import JSONdb from 'simple-json-db';
import {DateTime, Duration} from 'luxon';

// https://github.com/AnIdiotsGuide/discordjs-bot-guide/blob/master/understanding/roles.md
function companyPoints(employees: ICompanyEmployee[]) {
  const names: string[] = [];
  const points: string[] = [];
  const alerts: string[] = [];
  employees.forEach(
    (o: any) => {
    // (o: ICompanyEmployee) => {
      const name = o.name;
      const {merits, addiction, inactivity} = o.effectiveness;
      names.push(name);
      points.push((merits || 0) + (addiction || 0) + (inactivity || 0));
      if (addiction < -5) {
        alerts.push(`${name}: Addiction is ${addiction}`);
      }
      if (inactivity < -4) {
        alerts.push(`${name}: Inactivity is ${inactivity}`);
      }
    });
  
  if (alerts.length === 0) {
    alerts.push("All employees meeting expectations.")
  }
  return `${names.join(',')}\n${points.join(',')}\n ${alerts.join('\n')}`;
}

export class TornModule {
  private tornCache: TornCache;

  constructor(readonly tornDb: Db, readonly discordDb: JSONdb, appendOnlyLog: AppendOnlyLog) {
    const tornApiQueue = new TornApiQueue(tornDb, appendOnlyLog);
    this.tornCache = new TornCache(tornDb, tornApiQueue);

    this.initializeApiKeys(tornApiQueue);
  }


  setDiscordClient(client:Client) {
    this.beginMonitoringCompany(client);
  }

  private beginMonitoringCompany(client:Client) {
    let dt = DateTime.fromObject({hour: 18, minute: 15}, {zone: 'utc'})
    if (dt < DateTime.now()) {
      // the time is yesterday
      dt = dt.plus({days: 1});
    }
    // add a little variation
    dt = dt.plus({seconds: Math.floor(Math.random()*60)});
    const timeUntil = dt.diff(DateTime.now())
    console.log(`Will check again in ${timeUntil.as('hours')} hours`);
    const reefChannelId = '958522179941703721';
    const channel = client.channels.cache.get(reefChannelId) as TextChannel;
    setTimeout(async () => {
      const info = await this.tornCache.get(UpdateType.CompanyEmployee, /* id= */ 105377) as ICompanyEmployee[];
      const txt = companyPoints(info);
      channel?.send(txt);

      setInterval(async () => {
        const info = await this.tornCache.get(UpdateType.CompanyEmployee, /* id= */ 105377) as ICompanyEmployee[];
        const txt = companyPoints(info);
        channel?.send(txt);
      }, Duration.fromObject({day: 1}).as('milliseconds'));
    }, timeUntil.as('milliseconds'));
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
    msg.member.setNickname(`${userdata.name} [${tornId}]`).catch((e:any) => {
      console.log(e)
      msg.channel.send(`Failed to update username`);
    });
    msg.channel.send(`${userdata.name} [${tornId}] has been verified!`);
  }

  async lookup(msg: any) {
    const [command, playerId] = msg.content.split(' ');
    const json = await this.tornCache.get(UpdateType.User, playerId);
    msg.channel.send(JSON.stringify(json));
  }

  async company(msg: any) {
    // TODO - require admin
    const [command, arg1, arg2] = msg.content.split(' ');
    let companyId = parseInt(arg2);
    if (!companyId) {
      const playerId = 2816536;
      const playerInfo = await this.tornCache.get(UpdateType.User, playerId) as IUser;
      companyId = playerInfo.job?.company_id;
      if (!companyId) {
        msg.channel.send(`Unable to find company by id`);
        return;
      }
    }
    const info = await this.tornCache.get(UpdateType.CompanyEmployee, companyId) as ICompanyEmployee[];
    const txt = companyPoints(info);
    msg.channel.send(txt);
    // points(x)
  }

  async faction(msg: any) {
    // TODO - require admin
    const [command, arg1, arg2] = msg.content.split(' ');
    const factionId = parseInt(arg2);

    switch (arg1) {
      case 'add':
        // TODO(): should protect from double-calls, since it's async
        this.createRoleForFactionId(factionId, msg);
        this.tornCache.refresh(UpdateType.Faction, factionId);
        this.updateFaction(factionId, msg);
        return;
      // a
      case 'remove':
        msg.channel.send('NOT IMPLEMENTED');
        return;
      case 'clear':
        return;

      case 'refresh':
        this.updateFaction(factionId, msg);
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

  private async createRoleForFactionId(factionId:number, msg: any) {
    const lockfileKey = `lock-${msg.guildId}-${factionId}`;
    if (this.discordDb.has(lockfileKey)) {
      console.log('Avoiding re-adding role.');
      return;
    }
    this.discordDb.set(lockfileKey, 'true');
    try {
      const factionInfo = await this.tornCache.get(UpdateType.Faction, factionId) as IFaction;
      const name = factionInfo.name;
      const roleExists = msg.guild.roles.cache.find((r : any) => r.name === name);
      if (roleExists) {
        console.log('role already exists');
        msg.channel.send(`Role already exists <@&${roleExists.id}>`);
      } else {
        const info = await msg.guild.roles.create({
          name: factionInfo.name,
          // color: Colors.Blue,
          // reason: 'we needed a role for Super Cool People',
        });
        const roleId = info.id;
        msg.channel.send(`Role created <@&${roleId}>`);
      }
    } finally {
      this.discordDb.delete(lockfileKey);
    }
  }

  private async updateFaction(factionId: number, msg: any) {
    const factionInfo = await this.tornCache.get(UpdateType.Faction, factionId) as IFaction;
    const name = factionInfo.name;
    const roleExists = msg.guild.roles.cache.find((r : any) => r.name === name);
    const roleId = roleExists.id;
    const result = await this.tornCache.get(UpdateType.Faction, factionId) as IFaction;
    this.updateFactionMembers(result);
    this.setDiscordRolesForUsers(result, roleId, msg);
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
        const discordMember = msg.guild.members.cache.get(discordId);
        if (!discordMember) {
          console.log(`${member.name} not found in this discord server [${discordId}]`);
        } else {
          if (discordMember.roles.cache.get(role.id)) {
            console.log(`${member.name} already has faction role`);
          } else {
            console.log(`adding role for ${member.name}`);
            discordMember.roles.add(role).catch(console.error);
          }
        }
      }
    }
  }
}