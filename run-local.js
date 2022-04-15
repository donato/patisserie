const {onMessage} = require('./bot/message-handler');
const {loadJson} = require('./utils/file-utils');

const artiPromise = loadJson('./db/artis.json');
const herodataPromise = loadJson('./db/e7herodata.json');

function runTest(artiData, heroData) {
  function test(text) {
    console.log(`$ ${text}`);
    // todo "!bs great chief 60"
    onMessage(artiData, heroData, {
      author: { bot: false },
      content: text,
      guildId: 123,
      channel: {
        send: console.log
      },
    });
    console.log("");
  }
  let text = process.argv.slice(2).join(' ') || '!bs Great Chief 50';
  test(text);
}


herodataPromise.then(heroData => {
  artiPromise.then(artiData => {
    runTest(artiData, heroData);
  });
});