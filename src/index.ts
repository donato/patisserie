
import {Client, Intents} from 'discord.js'; //import discord.js
// import {loadJson} from './utils/file-utils';
const {onMessage} = require('./bot/message-handler');
import {TornApiUtils} from './utils/torn_api_utils';
const JSONdb = require('simple-json-db');
// import {createClient} from 'redis';

require('dotenv').config(); //initialize dotenv

// invite link
// https://discord.com/api/oauth2/authorize?client_id=957473918887792700&permissions=75776&scope=bot%20applications.commands



// (async function main () {
//   const redisClient = redis.createClient({
//     url: process.env.REDIS_HOST
//   });
//   redisClient.on('error', (err) => console.log('Redis Client Error', err));
//   await redisClient.connect();
// })();



let tornDb = new JSONdb('/usr/appdata/patisserie/torn-data.json');

// https://discord.js.org/#/docs/discord.js/stable/class/GuildChannel?scrollTo=name
const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
const tornApiUtils = new TornApiUtils(client, tornDb);
setInterval(() => tornApiUtils.pullFromQueue(), 5000);

client.on('message', (msg:any) => {
  onMessage(client, tornDb, tornApiUtils, msg);
});

client.on('ready', () => {
  if (client && client.user && client.user.tag) {
    console.log(`Logged in as ${client.user.tag}!`);
  }
});

client.login(process.env.CLIENT_TOKEN);