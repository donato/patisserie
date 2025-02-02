
declare global {
  var GM: {
    xmlHttpRequest: any
  }
}

export function formatBattleStats(num: number): string {
  var localized = num.toLocaleString('en-US');
  var myArray = localized.split(",");
  if (myArray.length < 1) {
      return 'ERROR';
  }

  var toReturn = myArray[0];
  if (num < 1000) return num + '';
  if (parseInt(toReturn) < 10) {
      if (parseInt(myArray[1][0]) != 0) {
          toReturn += '.' + myArray[1][0];
      }
  }
  switch (myArray.length) {
      case 2:
          toReturn += "k";
          break;
      case 3:
          toReturn += "m";
          break;
      case 4:
          toReturn += "b";
          break;
      case 5:
          toReturn += "t";
          break;
      case 6:
          toReturn += "q";
          break;
  }

  return toReturn;
}

export function fetchAlternative(url: string):Promise<unknown> {
  return new Promise((resolve, reject) => {
    GM.xmlHttpRequest({
      method: 'GET',
      url,
      headers: {
        'Content-Type': 'application/json'
      },
      onload: (response: { responseText: string }) => {
        try {
          var result = JSON.parse(response.responseText);
          if (result == undefined) {
            resolve(null);
            return;
          }
          if (result.status === false) {
            resolve(null);
            return;
          }
          resolve(result);
        } catch (err) {
          resolve(null);
        }
      },
    });
  });
}