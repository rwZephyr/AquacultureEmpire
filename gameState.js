import {
  siloUpgrades,
  blowerUpgrades,
  housingUpgrades,
  DEFAULT_FEEDER_LIMIT,
  DEFAULT_MAX_FEEDER_TIER,
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
  vesselNamePrefixes,
  vesselNameSuffixes,
  vesselClasses,
  vesselUnlockDays,
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
  DAY_DURATION_MS: 30000, // 30 seconds per in-game day
  timePaused: false,
  pauseStartedAt: 0,
  totalDaysElapsed: 0,
  dayInSeason: 1,
  seasonIndex: 0,
  year: 1,

  statusMessage: '',
  lastOfflineInfo: null,
  lastMarketUpdateString: 'Spring 1, Year 1',
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

// initialize last market update timestamp
state.lastMarketUpdateString = getDateString();

// ---- Market Pricing ----
function setupMarketData(){
  markets.forEach(m => {
    if(!m.basePrices) m.basePrices = {};
    if(!m.prices) m.prices = {};
    if(!m.priceHistory) m.priceHistory = {};
    if(!m.daysSinceSale) m.daysSinceSale = {};
    for(const sp in speciesData){
      const base = speciesData[sp].marketPrice * (m.modifiers[sp]||1);
      if(m.basePrices[sp] === undefined) m.basePrices[sp] = base;
      if(m.prices[sp] === undefined) m.prices[sp] = base;
      if(!Array.isArray(m.priceHistory[sp])) m.priceHistory[sp] = [m.prices[sp]];
      if(m.daysSinceSale[sp] === undefined) m.daysSinceSale[sp] = 0;
    }
  });
}

function updateMarketPrices(){
  markets.forEach(m => {
    for(const sp in m.prices){
      const base = m.basePrices[sp];
      let price = m.prices[sp];
      const change = (Math.random()*0.1 - 0.05); // +/-5%
      price *= (1 + change);
      const min = base * 0.5;
      const max = base * 1.5;
      price = Math.min(max, Math.max(min, price));
      m.prices[sp] = price;
      m.priceHistory[sp].push(price);
      if(m.priceHistory[sp].length > 10) m.priceHistory[sp].shift();
      m.daysSinceSale[sp]++;
    }
  });
}

state.setupMarketData = setupMarketData;
state.updateMarketPrices = updateMarketPrices;

function advanceDay() {
  state.lastMarketUpdateString = getDateString();
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
  updateMarketPrices();
}

state.advanceDay = advanceDay;

function advanceDays(n){
  if(!n || n <= 0) return;
  for(let i=0;i<n;i++){
    advanceDay();
  }
}

state.advanceDays = advanceDays;

function addStatusMessage(msg) {
  state.statusMessage = msg;
  const el = document.getElementById('statusMessages');
  if(el) el.innerText = msg;
}

state.addStatusMessage = addStatusMessage;

function pauseTime(){
  if(state.timePaused) return;
  state.timePaused = true;
  state.pauseStartedAt = Date.now();
}

function resumeTime(){
  if(!state.timePaused) return;
  const diff = Date.now() - state.pauseStartedAt;
  state.timePaused = false;
  state.pauseStartedAt = 0;
  state.vessels.forEach(v=>{
    if(v.actionEndsAt) v.actionEndsAt += diff;
  });
}

state.pauseTime = pauseTime;
state.resumeTime = resumeTime;

// Game Data
state.sites = [
  new Site({
    name: 'Mernan Inlet',
    location: { x: 20, y: 20 },
    barges: [
      new Barge({
        feed: 100,
        feedCapacity: siloUpgrades[0].feedCapacity,
        siloCapacity: 1000,
        staffCapacity: housingUpgrades[0].staffCapacity,
        feederLimit: DEFAULT_FEEDER_LIMIT,
        maxFeederTier: DEFAULT_MAX_FEEDER_TIER,
        upgrades: [],
        storageUpgradeLevel: 0,
        housingUpgradeLevel: 0,
        siloUpgradeLevel: 0,
        blowerUpgradeLevel: 0,
        feedRateMultiplier: blowerUpgrades[0].rate
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
    cargoSpecies: null,
    speed: vesselTiers[0].speed,
    location: 'Dock',
    upgradeSlots: vesselClasses.skiff.slots,
    upgrades: [],
    tier: 0,
    actionEndsAt: 0
  })
];

generateShipyardInventory();

// Upgrades & Species constants are imported from data.js

// UTILITIES
function capitalizeFirstLetter(str){ return str.charAt(0).toUpperCase()+str.slice(1); }
function generateRandomSiteName(){
  const p = siteNamePrefixes[Math.floor(Math.random()*siteNamePrefixes.length)];
  const s = siteNameSuffixes[Math.floor(Math.random()*siteNameSuffixes.length)];
  return `${p} ${s}`;
}

function generateRandomVesselName(){
  const p = vesselNamePrefixes[Math.floor(Math.random()*vesselNamePrefixes.length)];
  const s = vesselNameSuffixes[Math.floor(Math.random()*vesselNameSuffixes.length)];
  return `${p} ${s}`;
}

function isClassUnlocked(cls){
  if(cls === 'skiff') return true;
  const req = vesselUnlockDays[cls] || 0;
  return state.totalDaysElapsed >= req;
}

function generateShipyardInventory(){
  state.shipyardInventory = [];
  for(const cls in vesselClasses){
    if(!isClassUnlocked(cls)) continue;
    const base = vesselClasses[cls];
    const capacity = Math.round(base.baseCapacity * (0.9 + Math.random()*0.2));
    const speed = +(base.baseSpeed * (0.9 + Math.random()*0.2)).toFixed(1);
    state.shipyardInventory.push({
      class: cls,
      name: generateRandomVesselName(),
      cargoCapacity: capacity,
      speed: speed,
      upgradeSlots: base.slots,
      cost: base.cost
    });
  }
}

// expose utility functions on the state object for legacy callers
state.capitalizeFirstLetter = capitalizeFirstLetter;
state.generateRandomSiteName = generateRandomSiteName;
state.generateRandomVesselName = generateRandomVesselName;
state.generateShipyardInventory = generateShipyardInventory;
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
    const price = market.prices?.[sp] ?? (speciesData[sp].marketPrice * (market.modifiers[sp]||1));
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
  generateRandomVesselName,
  generateShipyardInventory,
  findSiteByName,
  findMarketByName,
  getLocationByName,
  estimateTravelTime,
  estimateSellPrice,
  getTimeState,
  getDateString,
  setupMarketData,
  updateMarketPrices,
  advanceDay,
  advanceDays,
  addStatusMessage,
  pauseTime,
  resumeTime,
  getSiteHarvestRate,
};


