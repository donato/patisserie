
const fs = require('fs');

function loadJson(filename) {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, (err, data) => {
      if (err) throw err;
      let j = JSON.parse(data);
      resolve(j);
    });
  });
}

// function writeJson(filename, data) {
//   let stringData = JSON.stringify(data);
//   fs.writeFileSync(filename, stringData);
// }

module.exports = {
  loadJson,
  // writeJson,
};