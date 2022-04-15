const {onMessage} = require('./bot/message-handler');
const {loadJson} = require('./utils/file-utils');

const artiPromise = loadJson('./db/artis.json');
const herodataPromise = loadJson('./db/e7herodata.json');

function runTest(artiData, heroData) {
  function test(text) {
    // todo "!bs great chief 60"
    onMessage(artiData, heroData, {
      author: { bot: false },
      content: text,
      channel: {
        send: console.log
      },
    });
  }
  // let text = process.argv.slice(2).join(' ') || '!bs Great Chief 50';
  // test(text);
  test("!bs Great Chief 50");
  // test("!bs amomo 50");
  // test("!nick add amomo Angelic");
  // test("!nick rm amomo");
  // test("!skill luluca s2");
  // test("!debuff 30 30");
  // test("!arti Ancient");
  // test("!farm Lulu");
  // test("!set luluca s1 blah blah");
}


herodataPromise.then(heroData => {
  artiPromise.then(artiData => {
    runTest(artiData, heroData);
  });
});