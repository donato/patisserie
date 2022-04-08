
const Discord = require('discord.js'); //import discord.js
const {loadJson} = require('./utils/file-utils');
const {onMessage} = require('./bot/message-handler');

require('dotenv').config(); //initialize dotenv

// invite link
// https://discord.com/api/oauth2/authorize?client_id=957473918887792700&permissions=75776&scope=bot%20applications.commands

// https://e7-optimizer-game-data.s3-accelerate.amazonaws.com/herodata.json
const herodataPromise = loadJson('./db/e7herodata.json');
const artiPromise = loadJson('./db/artis.json');

// https://discord.js.org/#/docs/discord.js/stable/class/GuildChannel?scrollTo=name
const client = new Discord.Client({
  intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES] });

client.on('message', msg => {
  herodataPromise.then(heroData => {
    artiPromise.then(artiData => {
      onMessage(artiData, heroData, msg);
    });
  });
});

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.login(process.env.CLIENT_TOKEN);