const {onMessage} = require('./message-handler');
const {loadJson} = require('./utils/file-utils');

const artiPromise = loadJson('./db/artis.json');
const herodataPromise = loadJson('./db/e7herodata.json');

function runTest(artiData, heroData) {
  function test(text) {
    console.log(`$ ${text}`);
    // todo "!bs great chief 60"
    onMessage(artiData, heroData, {
      author: { bot: false, id: 100 },
      content: text,
      guildId: 123,
      channel: {
        send: console.log
      },
    });
    console.log("");
  }
  // let text = process.argv.slice(2).join(' ') || '!bs Great Chief 50';
  // test(text);
  test("!help");
  test("!serverinfo");

  test("!cata ultra");
  test("!farm Lulu");
  test("!bs amomo 50");
  test("!arti Ancient");
  test("!s2 luluca");
  test("!skills luluca");

  test("!debuff 30 30");

  test("!nick rm amomo");
  test("!nick add amomo Angelic");
}


herodataPromise.then(heroData => {
  artiPromise.then(artiData => {
    runTest(artiData, heroData);
  });
});