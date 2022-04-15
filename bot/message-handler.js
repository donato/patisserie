const {nameSearch, effectivenessCalc} = require('../utils/utils');
const {limitedEvaluate} = require('../bot/bot-math');
const {renderZodiac, renderHelp, renderStats} = require('../utils/rendering');
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
  const text = msg.content;
  const isAdmin = ADMIN_SERVERS.indexOf(msg.guildId) !== -1;
  const command = text.split(" ")[0];
  function heroSearch(name) {
    return nameSearch(ALL_HERO_NAMES, name, nicknameDb);
  }
  function cataSearch(name) {
    return nameSearch(ALL_CATALYST_NAMES, name, nicknameDb);
  }
  function artiSearch(name) {
    return nameSearch(ALL_ARTI_NAMES, name, nicknameDb);
  }
  const ALL_HERO_NAMES = Object.keys(heroData);
  const ALL_ARTI_NAMES = artiData.map(a => a.name);
  const ALL_CATALYST_NAMES = Object.keys(catalystDb.JSON());

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
    msg.channel.send(`${JSON.stringify(msg)}`);
    return;
  }
  if (command === '!help') {
    renderHelp().then(text => {
      msg.channel.send(`${text}`);
    });
    return;
  }
  if (command === '!reload') {
    if (!isAdmin) {
      msg.channel.send(`Command requires \`Admin\`.`);
      return;
    }
    skillDb = new JSONdb('./db/skill-data.json');
    catalystDb = new JSONdb('./db/catalyst-data.json');
    zodiacDb = new JSONdb('./db/zodiac-data.json');
    nicknameDb = new JSONdb('./db/nickname-data.json');
    msg.channel.send(`Database reloaded`);
    return;
  }
  if (command == '!serverinfo') {
    msg.channel.send(`Server id is <${msg.guildId}>`);
    const mode = isAdmin? "Admin" : "Read-only";
    msg.channel.send(`Server mode is: \`${mode}\``);
    return;
  }
  if (command == '!speed') {
    msg.channel.send(`<https://epic7x.com/speed-cheat-sheet/>`);
    return;
  }

  //
  // !debuff
  //
  if (command == '!debuff ') {
    let [command, eff, res] = text.split(' ');
    const result = effectivenessCalc(parseInt(eff), parseInt(res));
    const rng = Math.floor(Math.random()*100);
    const message = (rng <= result) ? "Debuffed!" : "Resisted!";
    msg.channel.send(
      `Chance: ${result.toString()}%\n` +
      `${message} (Rng=${rng}%)`);
    return;
  }

  //
  // !link
  //
  if (command == '!link') {
    let [command, name] = text.split('!link ');
    name = heroSearch(name);
    name = name.toLowerCase().replaceAll(' ', '-');
    const url = `https://epic7x.com/character/${name}`;
    msg.channel.send(`${url}`);
    return;
  }

  //
  // !bs
  //
  if (command == '!bs') {
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

  //
  // !farm
  //
  if (command == '!farm') {
    const splits = text.split(' ');
    const name = splits.slice(1);
    const foundName = heroSearch(name.join(' '));
    const zodiac = getZodiac(heroData, foundName);
    const zodiacMetadata = zodiacDb.get(zodiac);
    zodiacMetadata.awkCatalystLocation = catalystDb.get(zodiacMetadata.awkCatalyst);
    zodiacMetadata.epicAwkCatalystLocation = catalystDb.get(zodiacMetadata.epicAwkCatalyst);
    zodiacMetadata.skillCatalystLocation = catalystDb.get(zodiacMetadata.skillCatalyst);
    renderZodiac(foundName, zodiacMetadata).then(text => {
      msg.channel.send(text);
    });
    return;
  }

  //
  // !cata
  //
  if (command == '!cata') {
    let [command, nick] = text.split('!cata ');
    const foundCata = cataSearch(nick);
    if (!foundCata) {
      msg.channel.send(`Catalyst not found.`);
      return;
    }

    msg.channel.send(`Farm **${foundCata}** in: \`${catalystDb.get(foundCata).farm}\``);
    return;
  }

  //
  // !skills
  //
  if (["!s1", "!s2", "!s3", "!skills"].indexOf(command) !== -1) {
    const splits = text.split(' ');
    const setIndex = splits.indexOf('set');
    if (setIndex !== -1) {
      if (!isAdmin) {
        msg.channel.send(`Command requires \`Admin\`.`);
        return;
      }
      const name = splits.slice(1, setIndex).join(' ');
      const foundName = heroSearch(name);
      if (!foundName) {
        msg.channel.send(`Couldn't find hero with that name`);
        return;
      }
      const description = splits.slice(setIndex + 1).join(' ');
      const skill = command.slice(1);
      updateSkillData(foundName, skill, description);
      msg.channel.send(`**${skill}** updated for **${foundName}**.`);
      return;
    }
    const name = splits.slice(1).join(' ');
    const foundName = heroSearch(name);
    if (!foundName) {
      msg.channel.send(`Couldn't find hero with that name`);
      return;
    }
    const skillObj = skillDb.get(foundName) || {};
    const skills = (command == "!skills") ?
      ["s1", "s2", "s3"] : [command.slice(1)];
    const response = [];
    let askForHelp = false;
    for (const s of skills) {
      if (!skillObj[s]) {
        askForHelp = true;
        response.push(`**Skill ${s}:** not available.`);
      } else {
        response.push(`**Skill ${s}:** ${skillObj[s]}`);
      }
    }
    if (askForHelp) {
      response.push(`Help fill our db using \`!s1 <hero> set <description>\``)
    }
    msg.channel.send(response.join('\n'));
    return;
  }

  //
  // !arti
  //
  if (command == '!arti') {
    const splits = text.split(' ');
    if (splits[1].toLowerCase() == "set") {
      return;
    }
    const namePrefix = splits.slice(1).join(' ');
    const foundArti = artiSearch(namePrefix);
    const artiObj = artiData.find(a => {
      return a.name == foundArti;
    });
    msg.channel.send(`${foundArti}\n<${artiObj.link}>`);
    return;
  }

  //
  // !nick
  //
  if (command == '!nick') {
    if (!isAdmin) {
      msg.channel.send(`Command requires \`Admin\`.`);
      return;
    }
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