const ejs = require('ejs');

class Format {
  static number(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  static percent(n) {
    return Math.floor(n*100) + "%";
  }
}

function renderZodiac(name, obj) {
  return new Promise((resolve, reject) => {
    ejs.renderFile('templates/hero-zodiac.ejs', Object.assign(obj, {name: name}, {Format}), {cache: true}, (err, t) => {
      if (err) {
        console.log(err);
        reject();
      }
      resolve(t)
    });
  });
}

function renderHelp() {
  return new Promise((resolve, reject) => {
    ejs.renderFile('templates/help.ejs', Object.assign({}, {Format}), {cache: true}, (err, t) => {
      if (err) {
        console.log(err);
      }
      resolve(t)
    });
  });
}
function renderStats(obj) {
  return new Promise((resolve, reject) => {
    ejs.renderFile('templates/hero-stats.ejs', Object.assign(obj, {Format}), {cache: true}, (err, t) => {
      if (err) {
        console.log(err);
      }
      resolve(t)
    });
  });
}

module.exports = {
  Format,
  renderStats,
  renderHelp,
  renderZodiac
};