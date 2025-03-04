import { bakeryStats, giftPastry } from './modules/bakery/bakery';
import { extractDiscordId, getChannel } from './utils/discord-utils';
import JSONdb from 'simple-json-db';
import { TornModule } from './modules/torn/torn_module';
import { AiModule, INFO_PREFIX } from './modules/ai/ollama';
import { Models } from './modules/ai/prompts';
import { Translation } from './modules/ai/language';
import { Db } from './utils/db';
import { Message as OllamaMessage } from 'ollama'
import { sendMessageIterator, transformAsyncIterator } from './modules/ai/stream-utils';


let bakeryDb = new JSONdb('/app/db/bakery-data.json');

// https://discord.js.org/docs/packages/discord.js/14.14.1/GuildMessageManager:Class#fetch

const ADMIN_SERVERS = ['906362118914330694'];
// const PATTIES_ID = '<@!957473918887792700>';
const PATTIES_ID = '957473918887792700';
const CHANNEL_ITALIA_ADVANCED = '1345830090780704799';
const CHANNEL_ITALIA_BEGINNER = '1345897179084099645';
const DEEPSEEK_INTERACTIVE = '1345507783910621305';
const VANGUARD_ASSASSIN_SERVER_ID = '1253005595779272816';

async function getConversation(msg: any): Promise<OllamaMessage[]> {
  const now = Date.now();
  const MAX_TIME_ELAPSED = 20 * 60 * 1000;
  const msgArray: Array<any> = await msg.channel.messages.fetch({ limit: 100 });
  return msgArray.reverse().reduce<OllamaMessage[]>((memo, m) => {
    if (now - m.createdTimestamp > MAX_TIME_ELAPSED) {
      return memo;
    }
    if (m.content.indexOf(INFO_PREFIX) >= 0 || m.content == '<think>' || m.content == '</think>') {
      return memo;
    }

    if (m.author.id === PATTIES_ID) {
      memo.push({
        role: 'assistant',
        content: m.content
      });
    } else if (m.author.id === msg.author.id) {
      if (m.content == 'reset') {
        return [];
      }
      memo.push({
        role: 'user',
        content: m.content
      });
    }
    return memo;
  }, []);
}

export async function onMessage(redis: Db, ollama: AiModule, tornModule: TornModule, msg: any) {
  if (msg.author.bot) {
    return;
  }

  const text = msg.content;
  const isAdmin = ADMIN_SERVERS.indexOf(msg.guildId) !== -1;
  const [command, arg1, arg2] = text.split(" ");

  if (command === "!db") {
    const value = await redis.get(arg1);
    if (!value) {
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

  if (command === "!ai") {
    const prompt = text.slice(3);
    const replyIterator = await ollama.generate(prompt, Models.DEEP_SEEK);
    sendMessageIterator(msg, replyIterator);
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

  if (command == '!travel') {
    tornModule.checkFlights(msg);
    return;
  }

  if (command == '!frc') {
    tornModule.checkRevives(msg);
    return;
  }

  if (command == '!ce') {
    tornModule.company(msg);
    return;
  }

  if (command == '!serverinfo') {
    msg.channel.send(`Server id is <${msg.guildId}>`);
    const mode = isAdmin ? "Admin" : "Read-only";
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

  if ([CHANNEL_ITALIA_ADVANCED, CHANNEL_ITALIA_BEGINNER].includes(msg.channel.id)) {
    await msg.channel.sendTyping();
    const conversation = await getConversation(msg);
    const CHANNEL_MAP: { [key: string]: Models } = {
      [CHANNEL_ITALIA_ADVANCED]: Models.ITALIA,
      [CHANNEL_ITALIA_BEGINNER]: Models.ITALIA_BEGINNER
    };
    const model = CHANNEL_MAP[msg.channel.id];
    // Do chat
    let replyIterator;
    replyIterator = ollama.chat(conversation, model);
    const fullMessage = await sendMessageIterator(msg, replyIterator);
    // do helpful translation
    // if (msg.channel.id == CHANNEL_ITALIA_BEGINNER && fullMessage.length > 10) {
    //   console.log('translate of: ' + fullMessage);
    //   replyIterator = ollama.generate(fullMessage, Models.ITALIA_PHRASES)
    //   const t = new Translation();
    //   const filteredReplies = transformAsyncIterator(replyIterator, t.handleTranslation);
    //   sendMessageIterator(msg, filteredReplies);
    // }
  }
  if (msg.channel.id == DEEPSEEK_INTERACTIVE) {
    await msg.channel.sendTyping();
    const conversation = await getConversation(msg);
    const replyIterator = ollama.chat(conversation, Models.DEEP_SEEK);
    sendMessageIterator(msg, replyIterator);
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