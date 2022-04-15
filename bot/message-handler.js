const {nameSearch, effectivenessCalc} = require('../utils/utils');
const {limitedEvaluate} = require('../bot/bot-math');
const {renderZodiac, renderStats} = require('../utils/rendering');
const {getChannel} = require('../utils/discord-utils');
const JSONdb = require('simple-json-db');
let skillDb = new JSONdb('./db/skill-data.json');
// const artifactDb = new JSONdb('./db/artifact-data.json');
let nicknameDb = new JSONdb('./db/nickname-data.json');
let zodiacDb = new JSONdb('./db/zodiac-data.json');
let catalystDb = new JSONdb('./db/catalyst-data.json');

const ADMIN_SERVERS = ['906362118914330694'];

function updateSkillData(hero, skill, description) {
  const data = skillDb.get(hero) || {};
  data[skill] = description;
  skillDb.set(hero, data);
}

function baseStats(heroData, name, level) {
  const key = level == '50'
      ? 'lv50FiveStarFullyAwakened' : 'lv60SixStarFullyAwakened';
  const prefix = level == '50'
      ? 'Level 50 (Awakened)' : 'Level 60 (Awakened)';
  const obj = heroData[name].calculatedStatus[key];
  return {prefix, obj};
}

function getZodiac(heroData, name) {
  return heroData[name].zodiac;
}

function onMessage(artiData, heroData, msg) {
  const isAdmin = ADMIN_SERVERS.indexOf(msg.guildId) !== -1;
  function heroSearch(name) {
    return nameSearch(ALL_HERO_NAMES, name, nicknameDb);
  }
  function cataSearch(name) {
    return nameSearch(ALL_CATALYST_NAMES, name, nicknameDb);
  }
  function artiSearch(name) {
    return nameSearch(ALL_ARTI_NAMES, name, nicknameDb);
  }
  const text = msg.content;
  const ALL_HERO_NAMES = Object.keys(heroData);
  const ALL_ARTI_NAMES = artiData.map(a => a.name);
  const ALL_CATALYST_NAMES = Object.keys(catalystDb.JSON());

  if (msg.author.bot) {
    return;
  }
  if (msg.content === '!welcome') {
    msg.guild.channels.fetch()
      .then(channels => {
        // msg.reply('Welcome');
        msg.channel.send(`Welcome to our disc!\n Please check ${getChannel(channels, 'guild-guidelines')} too :)`);
      });
    return;
  }
  if (text.indexOf('!help') !== -1) {
    msg.channel.send(
      `!help\n` +
      `!welcome\n` +
      `!speed\n` +
      `!skill <hero> <skill (s1 or s2 or s3)\n` +
      `!set <hero> <skill (s1/s2/s3)> <Full text description>\n` +
      `!debuff <effectiveness> <effect resist>\n` +
      `!nick <add|rm> <nickname> <real name>\n` +
      `!bs <heroname> <level (50 or 60)>\n` +
      `!link <heroname>`);
  }
  if (text.indexOf('!reload') !== -1) {
    if (!isAdmin) {
      msg.channel.send(`Command requires \`Admin\`.`);
      return;
    }
    // zodiacDb.reload(); // only on node-json-db
    // skillDb.reload();
    skillDb = new JSONdb('./db/skill-data.json');
    catalystDb = new JSONdb('./db/catalyst-data.json');
    zodiacDb = new JSONdb('./db/zodiac-data.json');
    nicknameDb = new JSONdb('./db/nickname-data.json');
    msg.channel.send(`Database reloaded`);
    return;
  }
  if (text.indexOf('!speed') !== -1) {
    msg.channel.send(`<https://epic7x.com/speed-cheat-sheet/>`);
    return;
  }
  if (text.indexOf('!cata') !== -1) {
    let [command, nick] = text.split('!cata ');
    const foundCata = cataSearch(nick);
    if (!foundCata) {
      msg.channel.send(`Catalyst not found.`);
      return;
    }

    msg.channel.send(`Farm **${foundCata}** in: \`${catalystDb.get(foundCata).farm}\``);
    return;
  }
  if (text.indexOf('!nick') !== -1) {
    if (!isAdmin) {
      msg.channel.send(`Command requires \`Admin\`.`);
      return;
    }
    // !nick [add|rm] <nickname> <real name>
    const columns = text.split(" ");
    const action = columns[1];
    const nick = columns[2];
    if (action == 'add' || action == "a") {
      const real = columns.slice(3).join(" ");
      const foundName= heroSearch(real);
      if (!foundName) {
        msg.channel.send(`Hero not found`);
        return;
      }
      msg.channel.send(`Nickname added for **${foundName}**`);
      nicknameDb.set(nick, foundName);
      return;
    } else if (action == "rm") {
      msg.channel.send(`Nickname removed **${nick}**`);
      nicknameDb.delete(nick);
      return;
    } else {
      msg.channel.send(`Please use "!nick [add|rm] <nickname> <real name>`);
      return;
    }
  }
  if (text.indexOf('!debuff ') !== -1) {
    let [command, eff, res] = text.split(' ');
    const result = effectivenessCalc(parseInt(eff), parseInt(res));
    const rng = Math.floor(Math.random()*100);
    const message = (rng <= result) ? "Debuffed!" : "Resisted!";
    msg.channel.send(
      `Chance: ${result.toString()}%\n` +
      `${message} (Rng=${rng}%)`);
    return;
  }
  if (text.indexOf('!link ') !== -1) {
    let [command, name] = text.split('!link ');
    name = heroSearch(name);
    name = name.toLowerCase().replaceAll(' ', '-');
    const url = `https://epic7x.com/character/${name}`;
    msg.channel.send(`${url}`);
    return;
  }
  if (text.indexOf('!bs') !== -1) {
    const items = text.split(' ');
    const name = items.slice(1, -1).join(' ');
    const level = items[items.length -1];
    // const [command, rest] = text.split('!bs ');
    const foundName = heroSearch(name);
    if (!foundName) {
      msg.channel.send("Hero not found");
      return;
    }
    const {prefix, obj} = baseStats(heroData, foundName, level);
    renderStats(obj).then(statsText => {
      msg.channel.send(`${foundName}\n\n**${prefix}**\n${statsText}`);
    });
    return;
  }
  if (text.indexOf('!serverinfo') != -1) {
    msg.channel.send(`Server id is <${msg.guildId}>`);
    const mode = isAdmin? "Admin" : "Read-only";
    msg.channel.send(`Server mode is: \`${mode}\``);
    return;
  }
  if (text.indexOf('!arti') === 0) {
    const splits = text.split(' ');
    if (splits[1].toLowerCase() == "set") {
      return;
    }
    const namePrefix = splits.slice(1).join(' ');
    const foundArti = artiSearch(namePrefix);
    const artiObj = artiData.find(a => {
      return a.name == foundArti;
    });
    msg.channel.send(`<${artiObj.link}>`);
    return;
  }
  if (text.indexOf('!farm') !== -1) {
    const splits = text.split(' ');
    const name = splits.slice(1);
    const foundName = heroSearch(name.join(' '));
    const zodiac = getZodiac(heroData, foundName);
    const zodiacMetadata = zodiacDb.get(zodiac);
    zodiacMetadata.awkCatalystLocation = catalystDb.get(zodiacMetadata.awkCatalyst);
    zodiacMetadata.epicAwkCatalystLocation = catalystDb.get(zodiacMetadata.epicAwkCatalyst);
    zodiacMetadata.skillCatalystLocation = catalystDb.get(zodiacMetadata.skillCatalyst);
    renderZodiac(zodiacMetadata).then(text => {
      msg.channel.send(text);
    });
    return;
  }
  if (text.indexOf('!set') !== -1) {
    if (!isAdmin) {
      msg.channel.send(`Command requires \`Admin\`.`);
      return;
    }
    const splits = text.split(' ');
    const skillIndex = splits.findIndex(text => {
      return ['s1', 's2', 's3'].indexOf(text.toLowerCase()) != -1;
    });
    const name = splits.slice(1, skillIndex);
    const foundName = heroSearch(name.join(' '));
    const description = splits.slice(skillIndex +1);
    const skill = splits[skillIndex];
    if (foundName) {
      updateSkillData(foundName, skill.toLowerCase(), description.join(' '));
      msg.channel.send("Recorded");
    } else {
      msg.channel.send("Hero not found");
    }
    return;
  }
  if (text.indexOf('!skill') !== -1) {
    const splits = text.split(' ');
    const name = splits.slice(1, splits.length-1).join(' ');
    const skill = splits[splits.length-1].toLowerCase();
    const foundName = heroSearch(name);
    if (!foundName) {
      console.log(`Couldn't find hero with that name`);
      return;
    }
    // if (!) {
    //   console.log('Please indicate which skill (s1, s2 or s3)');
    //   return;
    // }
    const skillObj = skillDb.get(foundName) || {};
    if (!skillObj[skill]) {
      console.log('Skill info not found');
      return;
    }
    msg.channel.send(`${skillObj[skill]}`);
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