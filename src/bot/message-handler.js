const {limitedEvaluate} = require('../bot/bot-math');
const {Format, renderZodiac, renderHelp, renderStats} = require('../utils/rendering');
const {bakeryStats, giftPastry} = require('../modules/bakery/bakery');
const {extractDiscordId, getChannel} = require('../utils/discord-utils');
const JSONdb = require('simple-json-db');
const PubSub = require('pubsub-js');


let bakeryDb = new JSONdb('/usr/appdata/patisserie/bakery-data.json');

const ADMIN_SERVERS = ['906362118914330694'];
const PATTIES_ID = '<@!957473918887792700>';


function onMessage(client, tornModule, msg) {
  const text = msg.content;
  const isAdmin = ADMIN_SERVERS.indexOf(msg.guildId) !== -1;
  const [command, arg1, arg2] = text.split(" ");

  if (msg.author.bot) {
    return;
  }
  
  if (command === '!welcome') {
    msg.guild.channels.fetch()
      .then(channels => {
        msg.channel.send(`Welcome to our disc!\n Please check ${getChannel(channels, 'guild-guidelines')} too :)`);
      });
    return;
  }
  if (command == '!echo') {
    msg.channel.send(`\`\`\`${JSON.stringify(msg)}\`\`\``);
    return;
  }

  if (command === '!help') {
    renderHelp().then(text => {
      msg.channel.send(`${text}`);
    });
    return;
  }

  if (command == '!api-add') {
    tornModule.apiKey(msg);
    return;
  }

  if (command == '!verify') {
    tornModule.verify(msg);
    return;
  }

  if (command == '!lookup') {
    tornModule.lookup(msg);
    return;
  }

  if (command == '!faction') {
    tornModule.faction(msg);
    return;
  }

  if (command == '!serverinfo') {
    msg.channel.send(`Server id is <${msg.guildId}>`);
    const mode = isAdmin? "Admin" : "Read-only";
    msg.channel.send(`Server mode is: \`${mode}\``);
    return;
  }

  // Epic 7
  if (command == '!speed') {
    msg.channel.send(`<https://epic7x.com/speed-cheat-sheet/>`);
    return;
  }

  // Bakery
  if (command === '!bake' || command === '!gift') {
    const splits = text.split(' ');
    const names = splits.slice(1);
    for (const n of names) {
      const id = extractDiscordId(n);
      if (id) {
        giftPastry(msg.author.id, id, bakeryDb)
          .then(text => msg.channel.send(text));
      }
    }
    return;
  }

  if (command === '!bakestats') {
    const splits = text.split(' ');
    const name = splits[1] || "";
    const id = extractDiscordId(name) || msg.author.id;
    bakeryStats(id, bakeryDb)
      .then(text => msg.channel.send(text));
    return;
  }

  if (!isAdmin) {
    return;
  }
  
  try {
    const v = limitedEvaluate(text);
    if (v != null || v === 0) {
        msg.channel.send(`${v}`);
    }
  } catch (e) {
    // not all text should be calculated!
  }
}
module.exports = {
  onMessage
};