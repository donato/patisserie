// import {limitedEvaluate} from '../bot/bot-math';
// import {renderHelp} from '../utils/rendering';
import {bakeryStats, giftPastry} from '../modules/bakery/bakery';
import {extractDiscordId, getChannel} from '../utils/discord-utils';
import JSONdb from 'simple-json-db';
import { TornModule } from '../modules/torn/torn_module';
import { Db } from '../utils/db';


let bakeryDb = new JSONdb('/app/db/bakery-data.json');

const ADMIN_SERVERS = ['906362118914330694'];
const PATTIES_ID = '<@!957473918887792700>';
const VANGUARD_ASSASSIN_SERVER_ID = '1253005595779272816';

export async function onMessage(redis: Db, tornModule: TornModule, msg: any) {
  const text = msg.content;
  const isAdmin = ADMIN_SERVERS.indexOf(msg.guildId) !== -1;
  const [command, arg1, arg2] = text.split(" ");

  if (msg.author.bot) {
    return;
  }

  if (command === "!db") {
    const value = await redis.get(arg1);
    if (!value ) {
      msg.channel.send(`Not found`);
      return;
    }
    console.log(value);
    msg.channel.send(`${JSON.stringify(value)}`);
    return;
  }
  
  if (command === '!welcome') {
    // msg.guild.channels.fetch()
    //   .then(channels => {
    //     msg.channel.send(`Welcome to our disc!\n Please check ${getChannel(channels, 'guild-guidelines')} too :)`);
    //   });
    return;
  }
  if (command == '!echo') {
    msg.channel.send(`\`\`\`${JSON.stringify(msg)}\`\`\``);
    return;
  }

  // if (command === '!help') {
  //   renderHelp().then(text => {
  //     msg.channel.send(`${text}`);
  //   });
  //   return;
  // }

  if (command == '!crash') {
    throw 'intentional crash';
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

  if (command== '!travel') {
    tornModule.checkFlights(msg);
    return;
  }

  if (command== '!frc') {
    tornModule.checkRevives(msg);
    return;
  }

  if (command == '!ce') {
    tornModule.company(msg);
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
  // .

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
  
  // try {
  //   const v = limitedEvaluate(text);
  //   if (v != null || v === 0) {
  //       msg.channel.send(`${v}`);
  //   }
  // } catch (e) {
  //   // not all text should be calculated!
  // }
}