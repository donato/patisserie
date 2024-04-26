
import {Client, Intents, Invite, Message} from 'discord.js';
import {TornModule} from './modules/torn/torn_module';
import {createClient, RedisClientType} from 'redis';
import {onMessage} from './bot/message-handler';
import JSONdb from 'simple-json-db';
import {Db} from './utils/db';

import * as pg from 'pg';

function createPgClient() {
  const client = new pg.Client({
    user: 'donato',
    password: 'potato',
    host: 'postgres',

  });
  return client.connect()
  // try {
  //   const res = await client.query('SELECT $1::text as message', ['Hello world!'])
  //   console.log(res.rows[0].message) // Hello world!
  // } catch (err) {
  //   console.error(err);
  // } finally {
  //   await client.end()
  // }

}

require('dotenv').config(); //initialize dotenv

// invite link
// https://discord.com/api/oauth2/authorize?client_id=957473918887792700&permissions=75776&scope=bot%20applications.commands

function createRedisClient() {
  
  try {

  const redisClient = createClient({
    url: process.env.REDIS_HOST
  }) as RedisClientType;
  redisClient.on('error', (err) => console.log('Redis Client Error', err));
  return redisClient.connect()
  } catch (e) {
    console.error("Unable to connect to redis");
    return null as unknown as RedisClientType;
  }
}

async function init() {
  // const tornDb = new JSONdb('/app/db/torn-data.json');
  const discordDb = new JSONdb('/app/db/discord-data.json');
  const redisClient = await createRedisClient()
  const pgClient = await createPgClient();

  const tornDb = new Db(redisClient);
 
  // https://discord.js.org/#/docs/discord.js/stable/class/GuildChannel?scrollTo=name
  const tornModule = new TornModule(tornDb, discordDb);
  tornModule.setDiscordClient(discordClient);

  discordClient.on('message', (msg: Message) => {
    onMessage(tornDb, tornModule, msg);
  });
}

const discordClient = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

discordClient.on('ready', () => {
  if (discordClient && discordClient.user && discordClient.user.tag) {
    console.log(`Logged in as ${discordClient.user.tag}!`);
  }
  init();
});

discordClient.login(process.env.CLIENT_TOKEN);