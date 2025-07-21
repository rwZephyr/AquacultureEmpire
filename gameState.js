import {
  bargeTiers,
  NEW_BARGE_COST,
  NEW_VESSEL_COST,
  feedStorageUpgrades,
  STAFF_HIRE_COST,
  staffRoles,
  staffHousingUpgrades,
  speciesData,
  feederUpgrades,
  siteNamePrefixes,
  siteNameSuffixes,
  vesselTiers,
  markets
} from './data.js';
import { Site, Barge, Pen, Vessel } from './models.js';

// Core Game State
let cash = 200;
const BASE_HARVEST_CAPACITY = 50;
const HARVESTER_RATE = 10; // kg per second per harvester
let penPurchaseCost = 1000;
let currentPenIndex = 0;
let currentSiteIndex = 0;
let currentBargeIndex = 0;
let currentVesselIndex = 0;

const FEED_COST_PER_KG = 0.25;
const FEED_THRESHOLD_PERCENT = 0.2;
const AUTO_SAVE_INTERVAL_MS = 30000; // 30 seconds
const SAVE_KEY = 'aquacultureEmpireSave';
const TRAVEL_TIME_FACTOR = 1000; // ms per distance unit

// --- Game Time System ---
const SEASONS = ['Spring','Summer','Fall','Winter'];
const DAYS_PER_SEASON = 30;
const DAY_DURATION_MS = 10000; // 10 seconds per in-game day
let timePaused = false;
let totalDaysElapsed = 0;
let dayInSeason = 1;
let seasonIndex = 0;
let year = 1;

// Expose read-only accessors for external logic
Object.defineProperties(window, {
  currentDayInSeason: { get: () => dayInSeason },
  currentSeason:      { get: () => SEASONS[seasonIndex] },
  currentYear:        { get: () => year },
  totalDaysElapsed:   { get: () => totalDaysElapsed }
});

function getTimeState(){
  return {
    currentDayInSeason: dayInSeason,
    currentSeason: SEASONS[seasonIndex],
    currentYear: year,
    totalDaysElapsed
  };
}

function getDateString(){
  return `${SEASONS[seasonIndex]} ${dayInSeason}, Year ${year}`;
}

function advanceDay(){
  totalDaysElapsed++;
  dayInSeason++;
  if(dayInSeason > DAYS_PER_SEASON){
    dayInSeason = 1;
    seasonIndex++;
    if(seasonIndex >= SEASONS.length){
      seasonIndex = 0;
      year++;
    }
  }
}

let statusMessage = '';
let lastOfflineInfo = null;
function addStatusMessage(msg){
  statusMessage = msg;
  const el = document.getElementById('statusMessages');
  if(el) el.innerText = msg;
}

// Game Data
let sites = [
  new Site({
    name: 'Mernan Inlet',
    location: { x: 20, y: 20 },
    barges: [
      new Barge({
        feed: 100,
        feedCapacity: bargeTiers[0].feedCapacity,
        siloCapacity: 1000,
        staffCapacity: 2,
        tier: 0,
        feederLimit: bargeTiers[0].feederLimit,
        maxFeederTier: bargeTiers[0].maxFeederTier,
        upgrades: [],
        storageUpgradeLevel: 0,
        housingUpgradeLevel: 0
      })
    ],
    staff: [],
    licenses: ['shrimp'],
    pens: [
      new Pen({ species: 'shrimp', fishCount: 500, averageWeight: 0.01, bargeIndex: 0 })
    ]
  })
];

let vessels = [
  new Vessel({
    name: 'Hauler 1',
    maxBiomassCapacity: vesselTiers[0].maxBiomassCapacity,
    currentBiomassLoad: 0,
    speed: vesselTiers[0].speed,
    location: 'Dock',
    tier: 0
  })
];

// Upgrades & Species constants are imported from data.js

// UTILITIES
function capitalizeFirstLetter(str){ return str.charAt(0).toUpperCase()+str.slice(1); }
function generateRandomSiteName(){
  const p = siteNamePrefixes[Math.floor(Math.random()*siteNamePrefixes.length)];
  const s = siteNameSuffixes[Math.floor(Math.random()*siteNameSuffixes.length)];
  return `${p} ${s}`;
}
function findSiteByName(n){ return sites.find(s=>s.name===n); }
function findMarketByName(n){ return markets.find(m=>m.name===n); }
function getLocationByName(n){
  if(!n) return null;
  if(n.startsWith('Traveling to ')) n = n.replace('Traveling to ','');
  const site = findSiteByName(n);
  if(site) return site.location;
  const market = findMarketByName(n);
  if(market) return market.location;
  return null;
}

function estimateTravelTime(fromName, destLoc, vessel){
  const start = getLocationByName(fromName) || sites[currentSiteIndex].location;
  if(!start || !destLoc) return 0;
  const dx = start.x - destLoc.x;
  const dy = start.y - destLoc.y;
  const distance = Math.hypot(dx, dy);
  return (distance / vessel.speed * TRAVEL_TIME_FACTOR) / 1000; // seconds
}

function estimateSellPrice(vessel, market){
  let total = 0;
  for(const sp in vessel.cargo){
    const weight = vessel.cargo[sp];
    const price = speciesData[sp].marketPrice * (market.modifiers[sp]||1);
    total += weight * price;
  }
  return total;
}

function getSiteHarvestCapacity(site, elapsedSeconds = 1){
  const harvesters = site.staff.filter(s=>s.role=="harvester").length;
  return BASE_HARVEST_CAPACITY + (HARVESTER_RATE * harvesters * elapsedSeconds);
}

export {
  cash,
  penPurchaseCost,

  currentPenIndex,
  currentSiteIndex,
  currentBargeIndex,
  currentVesselIndex,
  FEED_COST_PER_KG,
  FEED_THRESHOLD_PERCENT,
  AUTO_SAVE_INTERVAL_MS,
  SAVE_KEY,
  TRAVEL_TIME_FACTOR,
  SEASONS,
  DAYS_PER_SEASON,
  DAY_DURATION_MS,
  timePaused,
  totalDaysElapsed,
  dayInSeason,
  seasonIndex,
  year,
  statusMessage,
  lastOfflineInfo,
  BASE_HARVEST_CAPACITY,
  HARVESTER_RATE,
  sites,
  vessels,
  capitalizeFirstLetter,
  generateRandomSiteName,
  findSiteByName,
  findMarketByName,
  getLocationByName,
  estimateTravelTime,
  estimateSellPrice,
  getTimeState,
  getDateString,
  advanceDay,
  addStatusMessage,
  getSiteHarvestCapacity
};


