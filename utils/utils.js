
function toUpperCamelCase(str) {
  str = str.toLowerCase();
  return str.split(' ').map(s => {
    return s.slice(0, 1).toUpperCase() + s.slice(1);
  }).join(' ');
}

function nameSearch(allNames, namePrefix, nicksDb) {
  namePrefix = namePrefix.toLowerCase();
  if (nicksDb.get(namePrefix)) {
    return nicksDb.get(namePrefix);
  }
  // namePrefix = toUpperCamelCase(namePrefix);
  // if (heroData[namePrefix]) {
  //   return namePrefix;
  // }
  let backupName;
  for (let name of allNames) {
    if (name.toLowerCase().indexOf(namePrefix) === 0) {
      return name;
    }
    if (name.toLowerCase().indexOf(namePrefix) != -1) {
      backupName = name;
    }
  }
  return backupName;
}

function effectivenessCalc(eff, res) {
  // return Math.max(15, Math.min(85, (100 + eff - res)));
  return Math.max(0, Math.min(85, (100 + eff - res)));
}

module.exports = {
  nameSearch,
  effectivenessCalc,
};