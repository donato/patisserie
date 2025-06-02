import { bakeryStats, giftPastry } from './modules/bakery/bakery';
import { extractDiscordId, getChannel } from './utils/discord-utils';
import JSONdb from 'simple-json-db';
import { INFO_PREFIX } from './modules/ai/common';
import { AiModule } from './modules/ai/ai-module';
import { AgentType } from './modules/ai/agents';
import { ChatMessage } from './modules/ai/provider';
import { sendMessageIterator, streamForChat } from './modules/ai/stream-utils';
import { Message, Collection, TextChannel } from 'discord.js';
import { runSim } from './modules/study-group/run-sim';
import { DiscordLogger } from './utils/discord-logger';

let bakeryDb = new JSONdb('/app/db/bakery-data.json');

// https://discord.js.org/docs/packages/discord.js/14.14.1/GuildMessageManager:Class#fetch

const ADMIN_SERVERS = ['906362118914330694'];
// const PATTIES_ID = '<@!957473918887792700>';
const PATTIES_ID = '957473918887792700';
const CHANNEL_ITALIA_ADVANCED = '1345830090780704799';
const CHANNEL_ITALIA_BEGINNER = '1345897179084099645';
const CHANNEL_CODING_AGENT = '1335694908887011458'; // interactive channel
const CHANNEL_SLEEP = '1378427783897808996';
const CHANNEL_AGENT = '1368952263627903109';
const VANGUARD_ASSASSIN_SERVER_ID = '1253005595779272816';

function formatDiscordMessage(msg:Message) {
  return `[${msg.createdAt.toLocaleString()}] ${msg.content}`
}
async function getConversation(msg: Message): Promise<ChatMessage[]> {
  const now = Date.now();
  const MAX_TIME_ELAPSED = 48 * 60 * 1000; // 2 days
  const msgArray: Collection<string, Message> = await msg.channel.messages.fetch({ limit: 100 });
  return msgArray.reverse().reduce<ChatMessage[]>((memo, m) => {
    if (now - m.createdTimestamp > MAX_TIME_ELAPSED) {
      return memo;
    }
    if (m.content.indexOf(INFO_PREFIX) >= 0 || m.content == '<think>' || m.content == '</think>') {
      return memo;
    }

    if (m.author.id === PATTIES_ID) {
      memo.push({
        role: 'assistant',
        content: formatDiscordMessage(m)
      });
    } else if (m.author.id === msg.author.id) {
      if (m.content == 'reset') {
        return [];
      }
      memo.push({
        role: 'user',
        content: formatDiscordMessage(m)
      });
    }
    return memo;
  }, []);
}

export async function onMessage(aiModule: AiModule, msg: Message, discordLogger: DiscordLogger) {
  if (msg.author.bot) {
    return;
  }

  const text = msg.content;
  const isAdmin = ADMIN_SERVERS.indexOf(msg.guildId || '') !== -1;
  const [command, arg1, arg2] = text.split(" ");

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

  if (command === "!ai") {
    const prompt = text.slice(3);
    const replyIterator = await aiModule.generate(prompt, AgentType.REACT);
    await sendMessageIterator(msg, replyIterator);
    return;
  }

  if (command === "!aic") {
    const prompt = text.slice(3);
    const replyIterator = await aiModule.generate(prompt, AgentType.CODING);
    await sendMessageIterator(msg, replyIterator);
    return;
  }
  
  if (command == "!sim") {
    runSim(aiModule, {log: (line: string) => {
        discordLogger.log({message: line, channel: msg.channel as TextChannel});
      }
    });
    return;
  }

  if ([CHANNEL_ITALIA_ADVANCED, CHANNEL_ITALIA_BEGINNER, CHANNEL_SLEEP].includes(msg.channel.id)) {
    await msg.channel.sendTyping();
    const conversation = await getConversation(msg);
    if (conversation.length) {
      if (msg.channel.id == CHANNEL_SLEEP) {
        const stream = streamForChat(aiModule.chat(conversation, AgentType.BEDTIME));
        const unused = await sendMessageIterator(msg, stream);

      } else {
        const stream = streamForChat(aiModule.chatItalian(conversation));
        const unused = await sendMessageIterator(msg, stream);
      }
    }
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