const ejs = require('ejs');

class Format {
  static number(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  static percent(n) {
    return Math.floor(n*100) + "%";
  }
}

function renderStats(obj) {
  return new Promise((resolve, reject) => {
    ejs.renderFile('templates/hero-stats.ejs', Object.assign(obj, {Format}), {cache: true}, (err, t) => {
      resolve(t)
    });
  });
}

module.exports = {
  renderStats
};