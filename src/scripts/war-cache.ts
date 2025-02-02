// ==UserScript==
// @name         Thing
// @namespace    torn.faction.war.stats
// @version      0.1
// @author       Scrattch
// @match        *://*.torn.com/factions.php*
// @run-at      document-end
// @grant       GM.xmlHttpRequest
// @connect     www.tornstats.com
// ==/UserScript==

import { TornStatsFactionInfo, TornStatsSpyFactionInfo, TornStatsSpyMember } from './types';
import { divWithClass, addStyling, renderLoginButtons, renderControlButtons } from './dom-stuff';
import { formatBattleStats, fetchAlternative } from './string-utils';

// npx webpack

const STORAGE_PREFIX = 'scrattch-';
function storageKey(item: string) {
  return `${STORAGE_PREFIX}${item}`;
}

function clearCacheCallback() {
  Object.keys(localStorage).forEach(function(key){
    if (key.indexOf(STORAGE_PREFIX) === 0) {
      localStorage.removeItem(key);
    }
 });
}

function isLoggedIn() {
  const tsApiKey = window.localStorage.getItem(storageKey('apikey'));
  return !!tsApiKey;
}

function isHonorBarsShowing() {
  return document.getElementsByClassName('honor-text-wrap').length > 0;
}

async function readTornStatsInfo(): Promise<TornStatsFactionInfo> {
  const tsApiKey = window.localStorage.getItem(storageKey('apikey'));
  const url = `https://www.tornstats.com/api/v2/${tsApiKey}/faction/roster`;
  console.log(url);
  const result = await fetch(url);
  return result.json();
}

async function readFactionSpies(factionId: number): Promise<TornStatsSpyFactionInfo> {
  const tsApiKey = window.localStorage.getItem(storageKey('apikey'));
  const url = `https://www.tornstats.com/api/v2/${tsApiKey}/spy/faction/${factionId}`;
  console.log(url);
  return await fetchAlternative(url) as TornStatsSpyFactionInfo;
}

function isFactionPage() {
  return true;
}

async function getSpies(factionId: number) {
  let stringData = window.localStorage.getItem(storageKey(`spy-fac-${factionId}`));
  let data: TornStatsSpyFactionInfo
  if (stringData) {
    console.log(`scrattch - pulling spies from storage for ${factionId}`);
    data = JSON.parse(stringData);
    if (data) {
      return data;
    }
  }
  console.log(`scrattch - fetching spies from tornstats for ${factionId}`);
  data = await readFactionSpies(factionId);
  console.log(data);
  window.localStorage.setItem(storageKey(`spy-fac-${factionId}`), JSON.stringify(data));
  return data;
}

async function doit(node: ParentNode) {
  if (!node.querySelectorAll) {
    return;
  }

  const littleBoxes: { [id: number]: HTMLElement } = {};
  let factionIds = new Set<number>();
  const allLinks = node.querySelectorAll('#factions a[href*=XID]');
  for (let link of Array.from(allLinks)) {
    if (link.querySelector('.scrattch-container')) {
      continue;
    }
    const container = divWithClass('scrattch-container');
    const el = divWithClass('scrattch-little-box');
    container.appendChild(el)

    link.parentNode.prepend(container);
    const id = parseInt(link.getAttribute('href')?.split('XID=')[1] || '');
    littleBoxes[id] = el;

    const factionLink = link.parentNode?.parentNode?.querySelectorAll('a[href*=factions]')[0];
    const factionId = factionLink?.getAttribute('href')?.split('ID=')[1];
    if (factionId) { factionIds.add(parseInt(factionId)); }
  }


  for (let factionId of Array.from(factionIds)) {
    const spies = await getSpies(factionId);
    if (!spies) {
      console.log(`scrattch - invalid spy for ${factionId}`);
    }
    for (let member of Object.values(spies.faction.members)) {
      if (littleBoxes[member.id]) {
        let text;
        if (!member || !member.spy || !member.spy.total) {
          littleBoxes[member.id].innerText = '?';
        } else {
          littleBoxes[member.id].innerText = formatBattleStats(member.spy.total)
        }
      }
    }
  }
}

async function main() {
  if (!isFactionPage()) {
    return;
  }

  // need to add before asking for api key modal dialogue
  addStyling();
  
  var observer = new MutationObserver(async function (mutations, observer) {
    const factionWar = document.querySelector('div.faction-war') as HTMLDivElement;
    const addedNodes = mutations.map(m => Array.from(m.addedNodes)).flat();
    const filteredNodes = addedNodes
      .map(n => n.parentNode)
      .filter(n => !!n)
      .map(node => node.querySelector('.faction-war'))
      .filter(n => !!n);
    if (filteredNodes.length == 0) {
      return;
    }
    console.log('scrattch - mutation found faction div');

    if (!document.querySelector('.scrattch-controlpanel')) {
      if (!isLoggedIn()) {
        const newKey = await renderLoginButtons(factionWar); 
        if (!newKey) {
          alert('failed to get ts api key');
          return;
        }
        window.localStorage.setItem('scrattch-apikey', newKey)
      }
      renderControlButtons(factionWar, clearCacheCallback);
    }
    if (isLoggedIn()) {
      filteredNodes.map(doit);
    }
  });

  observer.observe(document, { attributes: false, childList: true, characterData: false, subtree: true });
}

main();