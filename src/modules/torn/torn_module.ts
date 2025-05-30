import { TornAPI, TornInterfaces } from 'ts-torn-api';
import {Client, TextChannel} from 'discord.js';
import { TornCache } from './torn_cache';
import { AppendOnlyLog } from './append_only_log';
import { UpdateType, TornApiQueue } from './torn_api_queue';
import { extractDiscordId } from '../../utils/discord-utils';
import { Db } from '../../utils/db';
// import {Format} from '../../utils/rendering';
const {Format} = require('../../utils/rendering');
import { IAPIKeyInfo, ICompanyEmployee, IDiscord, IFaction, IMember, IPersonalStats, IUser } from 'ts-torn-api/dist/Interfaces';
import JSONdb from 'simple-json-db';
import axios from 'axios';
import {DateTime, Duration} from 'luxon';

const FACTION_ID = 47863;

interface TornStatsFactionInfo {
  members: {
    [key: string]: {name:string, total: number, verified: number}
  },
}
async function readTornStatsInfo():Promise<TornStatsFactionInfo> {
  const url = 'https://www.tornstats.com/api/v2/TS_SiMwVEkP6FRlSTnq/faction/roster';
  return axios.get(url).then(r => {return r.data});
}

interface YataFactionInfo{
  members: {
    [member_id: string] : {
      "id": number,  // member torn ID
      "name": String,  // member name
      "status": String,  // online status (online/idle/offline)
      "last_action": number,  // last action timestamp
      "dif": number,  // days in faction
      "crimes_rank": number,  // crimes rank in the faction
      "bonus_score": number,  // bonus score (combined report)
      "nnb_share": number,  // nnb sharing status (-1 not sharing, 0 not on yata, 1 sharing)
      "nnb": number,  // natural nerve bar
      "energy_share": number,  // energy level sharing status (-1 not sharing, 0 not on yata, 1 sharing)
      "energy": number,  // energy level
      "refill": boolean,  // refill available
      "drug_cd": number,  // drug cooldown
      "revive": boolean,  // ability to revive
      "carnage": number,  // 0 to 3 single hit respect honors
      "stats_share": number,  // stats sharing status (-1 not sharing, 0 not on yata, 1 sharing)
      "stats_dexterity": number,  // 0 if unknown
      "stats_defense": number,  // 0 if unknown
      "stats_speed": number,  // 0 if unknown
      "stats_strength": number,  // 0 if unknown
      "stats_total": number,  // 0 if unknown
    },
  },
}

async function readYataFactionInfo(): Promise<YataFactionInfo> {
  const url = 'https://yata.yt/api/v1/faction/members/?key=ptVSLreadhYW3L1h';
  return axios.get(url).then(r => {return r.data});
}

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
  // return `${names.join(',')}\n${points.join(',')}\n ${alerts.join('\n')}`;
  return `${alerts.join('\n')}`;
}

async function generateFactionSummary(tornCache: TornCache, faction:IFaction) {
  const memberIds = faction.members.map(m => m.id);
  const memberInfo = await Promise.all(
    memberIds.map(id => tornCache.get(UpdateType.UserPersonalStats, parseInt(id))));
  const rows:string[] = [];
  memberIds.forEach((id: string, idx: number) => {
    const name = faction.members[idx].name;
    const m = memberInfo[idx] as IPersonalStats;
    if (!m) {
      console.log(`Unexpected value for index ${idx} ${memberInfo}`);
      rows.push(`Invalid data for ${name}`);
      return;
    }
    rows.push(`${name}[${id}]: Total Respect: ${Format.number(m.respectforfaction)}`);
  });

  return rows.join('\n');
}

function normalizeName(name:string) {
  const map:{[n: string]: string} = {
    Japanese: 'Japan',
    Chinese: 'China',
    Emirati: 'UAE',
    'South African': 'South Africa',
  }
  return map[name] || name;
}

function getLocation(description:string) {
  if (description.indexOf('Traveling to') === 0) {
    return description.split('Traveling to ')[1];
  } else if (description.indexOf('In hospital') === 0) {
    return 'Torn';
  } else if (description.indexOf('Returning to') === 0) {
    return 'Torn';
  } if (description.indexOf('In a ') === 0) {
    return normalizeName(description.split('In a ')[1].split(' hospital')[0]);
  } if (description.indexOf('In an ') === 0) {
    return normalizeName(description.split('In an ')[1].split(' hospital')[0]);
  } if (description.indexOf('In ') === 0) {
    return description.split('In ')[1];
  } else {
    return 'Unknown';
  }
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
    this.beginMonitoringFaction(client);
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
    const reefChannelId = '1257857205575880714';
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

  private async beginMonitoringFaction(client: Client) {
    let dt = DateTime.fromObject({hour: 0, minute: 9}, {zone: 'utc'})
    if (dt < DateTime.now()) {
      // the time is yesterday
      dt = dt.plus({days: 1});
    }
    // add a little variation
    dt = dt.plus({seconds: Math.floor(Math.random()*60)});
    const timeUntil = dt.diff(DateTime.now())
    console.log(`Will check again in ${timeUntil.as('hours')} hours`);
    const reefChannelId = '1257858444300517517';
    const channel = client.channels.cache.get(reefChannelId) as TextChannel;
    setTimeout(async () => {
      const info = await this.tornCache.get(UpdateType.Faction, /* id= */ FACTION_ID) as IFaction;
      const txt = await generateFactionSummary(this.tornCache, info);
      channel?.send(txt);

      setInterval(async () => {
        const info = await this.tornCache.get(UpdateType.CompanyEmployee, /* id= */ FACTION_ID) as IFaction;
        const txt = await generateFactionSummary(this.tornCache, info);
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

  async checkFlights(msg:any) {
    const targetFactionId = 46144;
    const factionInfo = await this.tornCache.get(UpdateType.Faction, targetFactionId) as IFaction;
    console.log(factionInfo);
    const rows = [];
    const countries: {[n: string]: number} = {};
    for (const member of factionInfo.members) {
      const loc = getLocation(member.status.description);
      countries[loc] = countries[loc] || 0;
      countries[loc]++;
    }
    for (let c in countries) {
      rows.push(`${c} : ${countries[c]}`);
    }
    msg.channel.send(rows.join('\n'));
  }

  // hi
  async checkRevives(msg:any) {
    const tsInfo = await readTornStatsInfo();
    const yataInfo = await readYataFactionInfo();
    console.log(yataInfo);
    const factionInfo = await this.tornCache.get(UpdateType.Faction, FACTION_ID) as IFaction;
    let counter =0;
    let counterNotRevivable =0;
    for (const member of factionInfo.members) {
      const txt = [];
      const userInfo = await this.tornCache.get(UpdateType.User, parseInt(member.id)) as IUser;
      if (userInfo.revivable == 0) {
        counter += 1;
      } else {
        counterNotRevivable+= 1
        // txt.push(`${userInfo.name} is revivable ${userInfo.revivable}`);
      }

      const tsMemberInfo = tsInfo.members[member.id];
      if (!tsMemberInfo) {
        txt.push(`${userInfo.name} has not connected to faction tornstats.`);
      } else if (tsMemberInfo.verified == 0) {
        txt.push(`${userInfo.name} is not tornstats verified.`);
      }
      const yataMemberInfo = yataInfo.members[member.id];
      if (!yataMemberInfo || yataMemberInfo.nnb_share == 0) {
        txt.push(`${userInfo.name} is not in YATA.`);
      } else if (yataMemberInfo.nnb_share == -1) {
        txt.push(`${userInfo.name} is not sharing NNB in YATA.`);
      }
      if (txt.length) {
        msg.channel.send(txt.join('\n'));
      }
    }
    msg.channel.send(`Found ${counter} members with revives disabled.`);
    msg.channel.send(`Found ${counterNotRevivable} members who are revivable by Scrattch.`);
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

  async onMessage(msg: any) {
    const text = msg.content;
    const [command, arg1, arg2] = text.split(" ");

    if (command === "!db") {
      const value = await this.tornDb.get(arg1);
      if (!value) {
        msg.channel.send(`Not found`);
        return;
      }
      console.log(value);
      msg.channel.send(`${JSON.stringify(value)}`);
      return;
    }
    if (command == '!api-add') {
      this.apiKey(msg);
      return;
    }

    if (command == '!verify') {
      this.verify(msg);
      return;
    }

    if (command == '!lookup') {
      this.lookup(msg);
      return;
    }

    if (command == '!faction') {
      this.faction(msg);
      return;
    }

    if (command == '!travel') {
      this.checkFlights(msg);
      return;
    }

    if (command == '!frc') {
      this.checkRevives(msg);
      return;
    }

    if (command == '!ce') {
      this.company(msg);
      return;
    }
  }
}