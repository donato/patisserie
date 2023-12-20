function setupDistro(input) {
  const dist = []
  let counter = 0;
  for (const k of Object.keys(input)) {
    counter += input[k];
    dist.push({
      max: counter,
      type: k
    });
  }
  return dist;
}

function sum(arr) {
  return arr.reduce((memo, curr) => {
    return memo + curr;
  }, 0);
}

class Distribution {
  constructor(input) {
    if (sum(Object.values(input)) != 1.0) {
      throw "Distribution error";
    }
    this.distro = setupDistro(input);
  }

  chooseOne() {
    const r = Math.random();
    for (const i of this.distro) {
      if (r <= i.max) {
        return i.type;
      }
    }
  }
}

module.exports = Distribution;