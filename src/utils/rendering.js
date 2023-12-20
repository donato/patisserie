const ejs = require('ejs');

class Format {
  static count(n) {
    switch(n) {
      case 1:
        return 'first';
      case 2:
        return 'second';
      case 3:
        return 'third';
      default:
        return Format.number(n);
    }
  }
  static number(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  static percent(n) {
    return Math.floor(n*100) + "%";
  }
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

module.exports = {
  Format,
  renderHelp
};