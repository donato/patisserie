const {chooseOne, toUpperCamelCase} = require('../utils/utils');
const {Format} = require('../utils/rendering');
const Distribution = require('../utils/distribution');

const PASTRY_RARITY = {
  'common': 0.5,
  'rare': 0.3,
  'epic': 0.15,
  'legendary': 0.05
}

const BASE_PASTRIES = [
  'cake',
  'pie',
  'muffin',
  'cupcake',
  'cookie',
  'scone',
  'biscuit',
  'biscotti',
];

const RARE_MODIFIER = [
  'nutella',
  'marble',
  'sesame',
  'chocolate-chip',
  'matcha',
  'mint',
  'carrot',
  'rainbow',
  'coffee',
  'espresso',
  'valentines',
  'birthday',
  'fruit',
  'strawberry',
  'blueberry',
  'hazelnut',
  'walnut',
  'pecan',
  'peanut',
  'Confetti Sprinkles',
  'Banana',
  'Coconut',
  'pistachio',
  'vanilla',
]

const EPIC_MODIFIER = [
  'Apple pie',
  'lemon poppyseed',
  'maple pumpkin',
  'Pina colada',
  'banana split',
  'Ferrero Rocher',
  'Chocolate Toffee',
  'Red Velvet',
];

const LEGENDARY_MODIFIER = [
  'chocolate chip cheesecake',
  'Dulce de Leche mocha',
  'Pink Champagne',
  'Rekos Sunset',
];

function bake(rarity) {
  switch(rarity) {
    case 'common':
      return chooseOne(BASE_PASTRIES);
    case 'rare':
      return chooseOne(RARE_MODIFIER) + ' ' + chooseOne(BASE_PASTRIES);
    case 'epic':
      return chooseOne(EPIC_MODIFIER) + ' ' + chooseOne(BASE_PASTRIES);
    case 'legendary':
      return chooseOne(LEGENDARY_MODIFIER) + ' ' + chooseOne(BASE_PASTRIES);
  }
}

function giftPastry(senderId, receiverId, bakeryDb) {
  const dist = new Distribution(PASTRY_RARITY);
  return new Promise(resolve => {
        const rarity = dist.chooseOne();
        const pastry = toUpperCamelCase(bake(rarity));

        const user = bakeryDb.get(receiverId) || {};
        user.received = user.received || 0;
        user.received++;
        bakeryDb.set(receiverId, user);

        const sender = bakeryDb.get(senderId) || {};
        sender.sent = sender.sent || {};
        sender.sent[rarity] = (sender.sent[rarity] || 0) + 1;
        bakeryDb.set(senderId, sender);

        const message = `Order's up! I've baked a **${pastry}** ___(${toUpperCamelCase(rarity)})___ for <@${receiverId}>!\n` +
        `That's their ${Format.count(user.received)} pastry!`;
        resolve(message);
  });
}

function bakeryStats(userId, bakeryDb) {
  const user = bakeryDb.get(userId);
  if (!user || !user.sent) {
    return Promise.resolve("No bake stats available.");
  }
  const stats = Object.keys(user.sent)
    .map(rarity => `${toUpperCamelCase(rarity)}: ${user.sent[rarity]}`);
  
  return Promise.resolve(stats.join('\n'));
}

module.exports = {
  bakeryStats,
  giftPastry
}