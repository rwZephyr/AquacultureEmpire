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
  markets,
} from './data.js';
import { Site, Barge, Pen, Vessel } from './models.js';

// Core Game State wrapped in a mutable object so other modules can update it
const state = {
  cash: 200,
  BASE_HARVEST_RATE: 5, // kg per second
  HARVESTER_RATE: 10, // additional kg/s per harvester
  penPurchaseCost: 1000,
  currentPenIndex: 0,
  currentSiteIndex: 0,
  currentBargeIndex: 0,
  currentVesselIndex: 0,

  FEED_COST_PER_KG: 0.25,
  FEED_THRESHOLD_PERCENT: 0.2,
  AUTO_SAVE_INTERVAL_MS: 30000, // 30 seconds
  SAVE_KEY: 'aquacultureEmpireSave',
  TRAVEL_TIME_FACTOR: 1000, // ms per distance unit

  // --- Game Time System ---
  SEASONS: ['Spring', 'Summer', 'Fall', 'Winter'],
  DAYS_PER_SEASON: 30,
  DAY_DURATION_MS: 10000, // 10 seconds per in-game day
  timePaused: false,
  totalDaysElapsed: 0,
  dayInSeason: 1,
  seasonIndex: 0,
  year: 1,

  statusMessage: '',
  lastOfflineInfo: null,
};

// Expose read-only accessors for external logic
Object.defineProperties(window, {
  currentDayInSeason: { get: () => state.dayInSeason },
  currentSeason:      { get: () => state.SEASONS[state.seasonIndex] },
  currentYear:        { get: () => state.year },
  totalDaysElapsed:   { get: () => state.totalDaysElapsed },
});

function getTimeState() {
  return {
    currentDayInSeason: state.dayInSeason,
    currentSeason: state.SEASONS[state.seasonIndex],
    currentYear: state.year,
    totalDaysElapsed: state.totalDaysElapsed,
  };
}

state.getTimeState = getTimeState;

function getDateString() {
  return `${state.SEASONS[state.seasonIndex]} ${state.dayInSeason}, Year ${state.year}`;
}

state.getDateString = getDateString;

function advanceDay() {
  state.totalDaysElapsed++;
  state.dayInSeason++;
  if (state.dayInSeason > state.DAYS_PER_SEASON) {
    state.dayInSeason = 1;
    state.seasonIndex++;
    if (state.seasonIndex >= state.SEASONS.length) {
      state.seasonIndex = 0;
      state.year++;
    }
  }
}

state.advanceDay = advanceDay;

function advanceDays(n){
  if(!n || n <= 0) return;
  const daysPerYear = state.DAYS_PER_SEASON * state.SEASONS.length;
  // total days counted from game start
  let total = state.totalDaysElapsed + n;
  state.totalDaysElapsed = total;
  const dayOfYear = total % daysPerYear;
  state.year = Math.floor(total / daysPerYear) + 1;
  state.seasonIndex = Math.floor(dayOfYear / state.DAYS_PER_SEASON);
  state.dayInSeason = (dayOfYear % state.DAYS_PER_SEASON) + 1;
}

state.advanceDays = advanceDays;

function addStatusMessage(msg) {
  state.statusMessage = msg;
  const el = document.getElementById('notifications');
  if(el) el.innerText = msg;
}

state.addStatusMessage = addStatusMessage;

// Game Data
state.sites = [
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

state.vessels = [
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

// expose utility functions on the state object for legacy callers
state.capitalizeFirstLetter = capitalizeFirstLetter;
state.generateRandomSiteName = generateRandomSiteName;
state.findSiteByName = findSiteByName;
state.findMarketByName = findMarketByName;
state.getLocationByName = getLocationByName;
state.estimateTravelTime = estimateTravelTime;
state.estimateSellPrice = estimateSellPrice;
function findSiteByName(n){ return state.sites.find(s=>s.name===n); }
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
  const start = getLocationByName(fromName) || state.sites[state.currentSiteIndex].location;
  if(!start || !destLoc) return 0;
  const dx = start.x - destLoc.x;
  const dy = start.y - destLoc.y;
  const distance = Math.hypot(dx, dy);
  return (distance / vessel.speed * state.TRAVEL_TIME_FACTOR) / 1000; // seconds
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

function getSiteHarvestRate(site) {
  const harvesters = site.staff.filter((s) => s.role == 'harvester').length;
  return state.BASE_HARVEST_RATE + state.HARVESTER_RATE * harvesters;
}

state.getSiteHarvestRate = getSiteHarvestRate;

export default state;
export {
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
  advanceDays,
  addStatusMessage,
  getSiteHarvestRate,
};


