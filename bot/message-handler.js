const {nameSearch, effectivenessCalc} = require('../utils/utils');
const {limitedEvaluate} = require('../bot/bot-math');
const {renderZodiac, renderStats} = require('../utils/rendering');
const {getChannel} = require('../utils/discord-utils');
const JSONdb = require('simple-json-db');
let skillDb = new JSONdb('./db/skill-data.json');
// const artifactDb = new JSONdb('./db/artifact-data.json');
let zodiacDb = new JSONdb('./db/zodiac-data.json');

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
  const text = msg.content;
  const ALL_HERO_NAMES = Object.keys(heroData);
  const ALL_ARTI_NAMES = artiData.map(a => a.name);

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
      `!bs <heroname> <level (50 or 60)>\n` +
      `!link <heroname>`);
  }
  if (text.indexOf('!reload') !== -1) {
    // zodiacDb.reload(); // only on node-json-db
    // skillDb.reload();
    skillDb = new JSONdb('./db/skill-data.json');
    zodiacDb = new JSONdb('./db/zodiac-data.json');
    msg.channel.send(`Database reloaded`);
    return;
  }
  if (text.indexOf('!speed') !== -1) {
    msg.channel.send(`<https://epic7x.com/speed-cheat-sheet/>`);
    return;
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
    name = nameSearch(ALL_HERO_NAMES, name);
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
    const foundName = nameSearch(ALL_HERO_NAMES, name);
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
  if (text.indexOf('!arti') === 0) {
    const splits = text.split(' ');
    if (splits[1].toLowerCase() == "set") {
      return;
    }
    const namePrefix = splits.slice(1).join(' ');
    const foundArti = nameSearch(ALL_ARTI_NAMES, namePrefix);
    const artiObj = artiData.find(a => {
      return a.name == foundArti;
    });
    msg.channel.send(`<${artiObj.link}>`);
    return;
  }
  if (text.indexOf('!farm') !== -1) {
    const splits = text.split(' ');
    const name = splits.slice(1);
    const foundName = nameSearch(ALL_HERO_NAMES, name.join(' '));
    const zodiac = getZodiac(heroData, foundName);
    const zodiacMetadata = zodiacDb.get(zodiac);
    renderZodiac(zodiacMetadata).then(text => {
      msg.channel.send(text);
    });
    return;
  }
  if (text.indexOf('!set') !== -1) {
    const splits = text.split(' ');
    const skillIndex = splits.findIndex(text => {
      return ['s1', 's2', 's3'].indexOf(text.toLowerCase()) != -1;
    });
    const name = splits.slice(1, skillIndex);
    const foundName = nameSearch(ALL_HERO_NAMES, name.join(' '));
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
    const foundName = nameSearch(ALL_HERO_NAMES, name);
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