
import { Client, Intents, Invite, Message } from 'discord.js';
import { TornModule } from './modules/torn/torn_module';
import { AiModule } from './modules/ai/ollama';
import { createClient, RedisClientType } from 'redis';
import { onMessage } from './message-handler';
import JSONdb from 'simple-json-db';
import { Db } from './utils/db';
import { createAppendOnlyLog, AppendOnlyLog } from './modules/torn/append_only_log';
import * as pg from 'pg';

require('dotenv').config(); //initialize dotenv

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

let tornAppendOnlyLog: AppendOnlyLog | null = null;
async function init() {
  // const tornDb = new JSONdb('/app/db/torn-data.json');
  const discordDb = new JSONdb('/app/db/discord-data.json');
  // const redisClient = await createRedisClient()
  // const pgClient = await createPgClient();
  // tornAppendOnlyLog = await createAppendOnlyLog();

  // setInterval(() => {
  //   tornAppendOnlyLog?.stats();
  // }, 60 * 1000)

  // const tornDb = new Db(redisClient);

  // https://discord.js.org/#/docs/discord.js/stable/class/GuildChannel?scrollTo=name
  // const tornModule = new TornModule(tornDb, discordDb, tornAppendOnlyLog);
  // tornModule.setDiscordClient(discordClient);

  discordClient.on('message', (msg: Message) => {
    if (msg.author.bot) {
      return;
    }

    // tornModule.onMessage(tornDb, msg);
    onMessage(new AiModule(), msg);
  });
}

const discordClient = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
});

discordClient.on('ready', () => {
  if (discordClient && discordClient.user && discordClient.user.tag) {
    console.log(`Logged in as ${discordClient.user.tag}!`);
  }
  init();
});

discordClient.login(process.env.CLIENT_TOKEN);

process.once('SIGUSR2', async () => {
  // Some kinda bug https://github.com/remy/nodemon/issues/1889
  console.log('SIGUSR2 signal received');
  // we expect nodemon to send another signal very soon after the first, so we listen for it again.
  // I've set this timeout to repeat the signal after 500 ms in case nodemon doesn't
  const secondSignalTimeout = setTimeout(() => {
    console.warn('second signal not received. exiting anyway');
    process.kill(process.pid, 'SIGUSR2')
  }, 1000);

  process.once('SIGUSR2', async () => {
    clearTimeout(secondSignalTimeout);
    try {
      if (tornAppendOnlyLog) {
        await tornAppendOnlyLog.shutdown();
        tornAppendOnlyLog = null;
      }
    } finally {
      process.kill(process.pid, 'SIGUSR2')
    }
  });
});