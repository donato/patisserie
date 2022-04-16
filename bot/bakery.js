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

function giftPastry(sender, receiver, bakeryDb) {
  const dist = new Distribution(PASTRY_RARITY);
  return new Promise(resolve => {
        const user = bakeryDb.get(receiver) || {};
        user.received = user.received || 0;
        user.received++;
        bakeryDb.set(receiver, user);

        const rarity = dist.chooseOne();
        const pastry = toUpperCamelCase(bake(rarity));
        const message = `Order's up! I've baked a **${pastry}** ___(${toUpperCamelCase(rarity)})___ for <@${receiver}>!\n` +
        `That's their ${Format.count(user.received)} pastry!`;
        resolve(message);
  });
}

module.exports = {
  giftPastry
}