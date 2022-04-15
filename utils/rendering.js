const ejs = require('ejs');

class Format {
  static number(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  static percent(n) {
    return Math.floor(n*100) + "%";
  }
}

function renderZodiac(obj) {
  return new Promise((resolve, reject) => {
    ejs.renderFile('templates/hero-zodiac.ejs', Object.assign(obj, {Format}), {cache: true}, (err, t) => {
      if (err) {
        console.log(err);
        reject();
      }
      resolve(t)
    });
  });
}

function renderStats(obj) {
  return new Promise((resolve, reject) => {
    ejs.renderFile('templates/hero-stats.ejs', Object.assign(obj, {Format}), {cache: true}, (err, t) => {
      console.log(err);
      resolve(t)
    });
  });
}

module.exports = {
  renderStats,
  renderZodiac
};