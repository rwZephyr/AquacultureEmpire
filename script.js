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
  updateDisplay();
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

// --- UPDATE UI ---
function updateDisplay(){
  const site = sites[currentSiteIndex];
  const pen  = site.pens[currentPenIndex];

  // top-bar
  document.getElementById('siteName').innerText = site.name;
  document.getElementById('cashCount').innerText = cash.toFixed(2);
  const dateEl = document.getElementById('dateDisplay');
  if(dateEl) dateEl.innerText = getDateString();

  // barge card
  const barge = site.barges[currentBargeIndex];
  const tierData = bargeTiers[barge.tier];
  document.getElementById('bargeIndex').innerText = currentBargeIndex + 1;
  document.getElementById('bargeCount').innerText = site.barges.length;
  document.getElementById('bargeTierName').innerText   = tierData.name;
  document.getElementById('bargeFeedersUsed').innerText = site.pens.filter(p=>p.feeder && p.bargeIndex===currentBargeIndex).length;
  document.getElementById('bargeFeederLimit').innerText = tierData.feederLimit;
  document.getElementById('bargeMaxFeederTier').innerText = tierData.maxFeederTier;
  document.getElementById('bargeFeed').innerText         = barge.feed.toFixed(1);
  document.getElementById('bargeFeedCapacity').innerText = barge.feedCapacity;
  document.getElementById('bargeSiloCapacity').innerText = barge.siloCapacity;
  document.getElementById('bargeStaffCount').innerText    = site.staff.length;
  const totalCapacity = site.barges.reduce((t,b)=>t+b.staffCapacity,0);
  document.getElementById('bargeStaffCapacity').innerText = totalCapacity;
  document.getElementById('bargeStaffUnassigned').innerText = site.staff.filter(s=>!s.role).length;

  // vessel card
  const vessel = vessels[currentVesselIndex];
  const vesselTier = vesselTiers[vessel.tier];
  document.getElementById('vesselIndex').innerText = currentVesselIndex + 1;
  document.getElementById('vesselCount').innerText = vessels.length;
  document.getElementById('vesselName').innerText = vessel.name;
  document.getElementById('vesselTierName').innerText = vesselTier.name;
  document.getElementById('vesselLoad').innerText = vessel.currentBiomassLoad.toFixed(1);
  document.getElementById('vesselCapacity').innerText = vessel.maxBiomassCapacity;
  document.getElementById('vesselLocation').innerText = vessel.location;
  if(vessel.tier < vesselTiers.length - 1){
    const nextVessel = vesselTiers[vessel.tier + 1];
    document.getElementById('vesselUpgradeInfo').innerText =
      `Next Vessel Upgrade (${nextVessel.name}): $${nextVessel.cost}`;
  } else {
    document.getElementById('vesselUpgradeInfo').innerText = 'Vessel Fully Upgraded';
  }
  document.getElementById('vesselPurchaseInfo').innerText = `New Vessel Cost: $${NEW_VESSEL_COST}`;

  // staff card info
  document.getElementById('staffTotal').innerText = site.staff.length;
  document.getElementById('staffCapacity').innerText = totalCapacity;
  document.getElementById('staffUnassigned').innerText = site.staff.filter(s=>!s.role).length;
  document.getElementById('staffFeeders').innerText = site.staff.filter(s=>s.role==='feeder').length;
  document.getElementById('staffHarvesters').innerText = site.staff.filter(s=>s.role==='harvester').length;
  document.getElementById('staffManagers').innerText = site.staff.filter(s=>s.role==='feedManager').length;

  // shop panel info
  if(barge.storageUpgradeLevel < feedStorageUpgrades.length){
    document.getElementById('storageUpgradeInfo').innerText =
      `Next Feed Storage Upgrade: $${feedStorageUpgrades[barge.storageUpgradeLevel].cost}`;
  } else {
    document.getElementById('storageUpgradeInfo').innerText = 'Feed Storage Fully Upgraded';
  }
  if(barge.housingUpgradeLevel < staffHousingUpgrades.length){
    document.getElementById('housingUpgradeInfo').innerText =
      `Next Housing Upgrade: $${staffHousingUpgrades[barge.housingUpgradeLevel].cost}`;
  } else {
    document.getElementById('housingUpgradeInfo').innerText = 'Housing Fully Upgraded';
  }
  if(barge.tier < bargeTiers.length - 1){
    const next = bargeTiers[barge.tier + 1];
    document.getElementById('bargeUpgradeInfo').innerText =
      `Next Barge Upgrade (${next.name}): $${next.cost}`;
  } else {
    document.getElementById('bargeUpgradeInfo').innerText = 'Barge Fully Upgraded';
  }
  document.getElementById('bargePurchaseInfo').innerText = `New Barge Cost: $${NEW_BARGE_COST}`;
  document.getElementById('penPurchaseInfo').innerText = `Next Pen Purchase: $${penPurchaseCost.toFixed(0)}`;

  updateHarvestInfo();
  updateLicenseShop();
  renderPenGrid(site);
  renderMap();
  const statusEl = document.getElementById('statusMessages');
  if(statusEl) statusEl.innerText = statusMessage;
}

// harvest preview
function updateHarvestInfo(){
  const site = sites[currentSiteIndex];
  const pen  = site.pens[currentPenIndex];
  const infoDiv = document.getElementById('harvestInfo');
  if(pen.fishCount>0){
    const vessel = vessels[currentVesselIndex];
    if(vessel.currentBiomassLoad>0 && !vessel.cargo[pen.species]){
      infoDiv.innerText = 'Vessel carrying other species.';
      return;
    }
    const remaining = vessel.maxBiomassCapacity - vessel.currentBiomassLoad;
    const totalBiomass = pen.fishCount * pen.averageWeight;
    const harvestableBiomass = Math.min(getSiteHarvestCapacity(site), totalBiomass, remaining);
    infoDiv.innerText = `Harvest up to ${harvestableBiomass.toFixed(2)} kg (vessel capacity ${remaining.toFixed(2)} kg)`;
  } else {
    infoDiv.innerText = "No fish to harvest.";
  }
}

// license shop
function updateLicenseShop(){
  const licenseDiv = document.getElementById('licenseShop');
  const site = sites[currentSiteIndex];
  licenseDiv.innerHTML = '<h3>Licenses</h3>';
  for(let sp in speciesData){
    if(!site.licenses.includes(sp) && speciesData[sp].licenseCost>0){
      licenseDiv.innerHTML +=
        `<button onclick="buyLicense('${sp}')">Buy ${capitalizeFirstLetter(sp)} License ($${speciesData[sp].licenseCost})</button><br>`;
    }
  }
}

// pen grid
function renderPenGrid(site){
  const grid = document.getElementById('penGridContainer');
  grid.innerHTML = '';
  const select = document.getElementById('newPenBargeSelect');
  if(select){
    select.innerHTML = site.barges.map((b,i)=>`<option value="${i}">${i+1}</option>`).join('');
    select.value = currentBargeIndex;
    const disp = document.getElementById('selectedBargeDisplay');
    if(disp) disp.innerText = `Selected: ${Number(select.value)+1}`;
  }
  site.pens.forEach((pen, idx)=>{
    const bargeOptions = site.barges.map((b,i)=>`<option value="${i}" ${pen.bargeIndex===i?'selected':''}>${i+1}</option>`).join('');
    const biomass = pen.fishCount * pen.averageWeight;
    const feederType = pen.feeder?.type||'None';
    const feederTier = pen.feeder?.tier||0;
    const nextUpgrade = feederUpgrades[feederTier];
    const nextCostText = nextUpgrade ? `Upgrade Cost: $${nextUpgrade.cost}` : 'Feeder Maxed';
    const card = document.createElement('div');
    card.className = 'penCard';
    card.innerHTML = `
      <h3>Pen ${idx+1}</h3>
      <div class="stat">Species: ${capitalizeFirstLetter(pen.species)}</div>
      <div class="stat">Fish: ${pen.fishCount}</div>
      <div class="stat">Avg Weight: ${pen.averageWeight.toFixed(2)} kg</div>
      <div class="stat">Biomass: ${biomass.toFixed(2)} kg</div>
      <div class="stat">Feeder: ${capitalizeFirstLetter(feederType)} (Tier ${feederTier})</div>
      <div class="stat">Barge: <select onchange="assignBarge(${idx}, this.value)">${bargeOptions}</select></div>
      <div class="stat">${nextCostText}</div>
      <button onclick="feedFishPen(${idx})">Feed</button>
      <button onclick="harvestPenIndex(${idx})">Harvest</button>
      <button onclick="restockPenUI(${idx})">Restock</button>
      <button onclick="upgradeFeeder(${idx})">Upgrade Feeder</button>
    `;
    grid.appendChild(card);
  });
}

// store map marker data for tooltips
let mapMarkers = [];

// simple map renderer with emoji icons and curved coastline
function renderMap(){
  const canvas = document.getElementById('mapCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  mapMarkers = [];

  // draw water background
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = '#1c4979';
  ctx.fillRect(0,0,w,h);

  // compute and draw land shape
  const base = h * 0.6;
  const amp  = h * 0.05;
  ctx.beginPath();
  ctx.moveTo(0,h);
  for(let x=0;x<=w;x+=w/20){
    const y = base + Math.sin((x/w)*Math.PI*2)*amp;
    ctx.lineTo(x,y);
  }
  ctx.lineTo(w,h);
  ctx.closePath();
  ctx.fillStyle = '#406536';
  ctx.fill();

  // grid lines
  ctx.strokeStyle = '#2a3f55';
  for(let i=0;i<=10;i++){
    const x=i*w/10; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke();
    const y=i*h/10; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
  }

  // helper to convert coords
  const toPixel = p=>({x:p.x/100*w, y:p.y/100*h});
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // draw markets
  markets.forEach(m=>{
    const pos = toPixel(m.location);
    ctx.fillText('🏪', pos.x, pos.y);
    mapMarkers.push({x:pos.x, y:pos.y, name:m.name});
  });
  // draw sites
  sites.forEach(s=>{
    const pos = toPixel(s.location);
    ctx.fillText('🐟', pos.x, pos.y);
    mapMarkers.push({x:pos.x, y:pos.y, name:s.name});
  });
  // draw vessels
  vessels.forEach(v=>{
    let locName=v.location;
    if(locName.startsWith('Traveling to ')) locName=locName.replace('Traveling to ','');
    const site = sites.find(s=>s.name===locName);
    const market = markets.find(m=>m.name===locName);
    const loc = site?site.location:market?market.location:null;
    if(loc){
      const pos=toPixel(loc);
      ctx.fillText('🚢', pos.x, pos.y);
      mapMarkers.push({x:pos.x, y:pos.y, name:v.name});
    }
  });
}

// setup tooltip interactions for the map
function setupMapInteractions(){
  const canvas = document.getElementById('mapCanvas');
  const tooltip = document.getElementById('mapTooltip');
  if(!canvas || !tooltip) return;
  let hideTimeout;
  const show = marker => {
    tooltip.textContent = marker.name;
    tooltip.style.display = 'block';
    tooltip.style.left = `${marker.x + 10}px`;
    tooltip.style.top  = `${marker.y - 25}px`;
    clearTimeout(hideTimeout);
  };
  const handle = evt => {
    const rect = canvas.getBoundingClientRect();
    const cX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const cY = evt.touches ? evt.touches[0].clientY : evt.clientY;
    const x = cX - rect.left;
    const y = cY - rect.top;
    const marker = mapMarkers.find(m => Math.hypot(x-m.x, y-m.y) < 12);
    if(marker){
      show(marker);
      if(evt.type === 'click' || evt.type === 'touchstart'){
        hideTimeout = setTimeout(()=>{ tooltip.style.display='none'; },1500);
      }
    } else if(evt.type === 'mousemove'){
      tooltip.style.display='none';
    }
  };
  canvas.addEventListener('mousemove', handle);
  canvas.addEventListener('click', handle);
  canvas.addEventListener('touchstart', handle);
  canvas.addEventListener('mouseleave', ()=>{ tooltip.style.display='none'; });
}

// --- MODALS ---
function openModal(msg){ document.getElementById('modalText').innerText=msg; document.getElementById('modal').classList.add('visible'); }
function closeModal(){ document.getElementById('modal').classList.remove('visible'); }
function openRestockModal(){
  const site = sites[currentSiteIndex];
  const pen  = site.pens[currentPenIndex];
  if(pen.fishCount>0){ return openModal("You must harvest the pen before restocking!"); }
  const optionsDiv = document.getElementById('restockOptions');
  optionsDiv.innerHTML = '';
  site.licenses.forEach(sp=>{
    const btn = document.createElement('button');
    btn.innerText = `${capitalizeFirstLetter(sp)} ($${speciesData[sp].restockCost})`;
    btn.onclick = ()=>restockPen(sp);
    optionsDiv.appendChild(btn);
  });
  document.getElementById('restockModal').classList.add('visible');
}
function closeRestockModal(){ document.getElementById('restockModal').classList.remove('visible'); }

function openHarvestModal(i){
  currentPenIndex = i;
  const site = sites[currentSiteIndex];
  const pen  = site.pens[currentPenIndex];
  const vessel = vessels[currentVesselIndex];
  if(vessel.currentBiomassLoad>0 && !vessel.cargo[pen.species]){
    return openModal('Vessel already contains a different species.');
  }
  const remaining = vessel.maxBiomassCapacity - vessel.currentBiomassLoad;
  const maxHarvest = Math.min(
    getSiteHarvestCapacity(site),
    pen.fishCount * pen.averageWeight,
    remaining
  );
  document.getElementById('harvestMax').innerText = maxHarvest.toFixed(2);
  const input = document.getElementById('harvestAmount');
  input.max = maxHarvest;
  input.value = maxHarvest.toFixed(3);
  document.getElementById('harvestModal').classList.add('visible');
}
function closeHarvestModal(){ document.getElementById('harvestModal').classList.remove('visible'); }
function confirmHarvest(){
  const amount = parseFloat(document.getElementById('harvestAmount').value);
  harvestPen(amount);
  closeHarvestModal();
  updateDisplay();
}

function openSellModal(){
  const optionsDiv = document.getElementById('sellOptions');
  optionsDiv.innerHTML = '';
  const vessel = vessels[currentVesselIndex];
  markets.forEach((m,idx)=>{
    const btn = document.createElement('button');
    const price = estimateSellPrice(vessel, m);
    const secs = estimateTravelTime(vessel.location, m.location, vessel);
    btn.innerText = `${m.name} - $${price.toFixed(2)} (${secs.toFixed(1)}s)`;
    btn.onclick = ()=>sellCargo(idx);
    optionsDiv.appendChild(btn);
  });
  document.getElementById('sellModal').classList.add('visible');
}
function closeSellModal(){
  document.getElementById('sellModal').classList.remove('visible');
}

function sellCargo(idx){
  const vessel = vessels[currentVesselIndex];
  if(vessel.currentBiomassLoad<=0) return openModal('No biomass to sell.');
  const market = markets[idx];
  if(vessel.location === `Traveling to ${market.name}`){
    closeSellModal();
    return openModal('Vessel already en route to this market.');
  }
  const completeSale = ()=>{
    let total = 0;
    for(const sp in vessel.cargo){
      const weight = vessel.cargo[sp];
      const price = speciesData[sp].marketPrice * (market.modifiers[sp]||1);
      total += weight * price;
    }
    cash += total;
    vessel.currentBiomassLoad = 0;
    vessel.cargo = {};
    vessel.location = market.name;
    openModal(`Sold cargo for $${total.toFixed(2)} at ${market.name}.`);
    updateDisplay();
  };
  if(vessel.location === market.name){
    closeSellModal();
    completeSale();
  } else {
    const startLoc = getLocationByName(vessel.location) || market.location;
    const dx = startLoc.x - market.location.x;
    const dy = startLoc.y - market.location.y;
    const distance = Math.hypot(dx, dy);
    vessel.location = `Traveling to ${market.name}`;
    closeSellModal();
    setTimeout(completeSale, distance / vessel.speed * TRAVEL_TIME_FACTOR);
  }
}

// --- PURCHASES & ACTIONS ---
function buyFeed(amount=20){
  const site = sites[currentSiteIndex];
  const barge = site.barges[currentBargeIndex];
  amount = Math.max(0, amount);
  const cost = amount * FEED_COST_PER_KG;
  if(cash < cost) return openModal("Not enough cash to buy feed.");
  if(barge.feed + amount > barge.feedCapacity)
    return openModal("Not enough feed storage space!");
  cash -= cost;
  barge.feed += amount;
  updateDisplay();
}

function buyMaxFeed(){
  const site = sites[currentSiteIndex];
  const barge = site.barges[currentBargeIndex];
  const maxAffordable = Math.floor(cash / FEED_COST_PER_KG);
  const available = barge.feedCapacity - barge.feed;
  const qty = Math.min(maxAffordable, available);
  if(qty <= 0) return openModal("Cannot purchase feed right now.");
  buyFeed(qty);
}
function buyFeedStorageUpgrade(){
  const site = sites[currentSiteIndex];
  const barge = site.barges[currentBargeIndex];
  if(barge.storageUpgradeLevel>=feedStorageUpgrades.length) return openModal("Max feed storage reached!");
  const up = feedStorageUpgrades[barge.storageUpgradeLevel];
  if(cash<up.cost) return openModal("Not enough cash to upgrade feed storage!");
  cash-=up.cost; barge.feedCapacity=up.capacity;
  barge.storageUpgradeLevel++; updateDisplay();
}
function buyLicense(sp){
  const site = sites[currentSiteIndex];
  const cost = speciesData[sp].licenseCost;
  if(cash<cost) return openModal("Not enough cash to buy license.");
  cash-=cost; site.licenses.push(sp); updateDisplay();
}
function buyNewSite(){
  if(cash<20000) return openModal("Not enough cash to buy a new site!");
  cash-=20000;
  sites.push(new Site({
    name: generateRandomSiteName(),
    // ensure farms spawn in water (upper portion of map)
    location: { x: Math.random()*100, y: Math.random()*60 },
    barges:[new Barge({
      feed:100,
      feedCapacity: bargeTiers[0].feedCapacity,
      siloCapacity:1000,
      staffCapacity:2,
      tier:0,
      feederLimit: bargeTiers[0].feederLimit,
      maxFeederTier: bargeTiers[0].maxFeederTier,
      upgrades:[],
      storageUpgradeLevel: 0,
      housingUpgradeLevel: 0
    })],
    staff: [],
    licenses:['shrimp'],
    pens:[new Pen({ species:"shrimp", fishCount:500, averageWeight:0.01, bargeIndex:0 })]
  }));
  updateDisplay();
  openModal("New site purchased!");
}
function buyNewPen(bargeIdx = currentBargeIndex){
  const site = sites[currentSiteIndex];
  if(cash < penPurchaseCost) return openModal("Not enough cash to buy a new pen!");
  if(bargeIdx < 0 || bargeIdx >= site.barges.length) return openModal("Invalid barge selected.");
  cash -= penPurchaseCost;
  site.pens.push({ species:"shrimp", fishCount:0, averageWeight:0, bargeIndex: Number(bargeIdx) });
  penPurchaseCost *= 1.5;
  updateDisplay();
}

function buyNewBarge(){
  const site = sites[currentSiteIndex];
  if(cash < NEW_BARGE_COST) return openModal("Not enough cash to buy a new barge!");
  cash -= NEW_BARGE_COST;
  site.barges.push({
    feed:100,
    feedCapacity: bargeTiers[0].feedCapacity,
    siloCapacity:1000,
    staffCapacity:2,
    tier:0,
    feederLimit: bargeTiers[0].feederLimit,
    maxFeederTier: bargeTiers[0].maxFeederTier,
    upgrades:[],
    storageUpgradeLevel:0,
    housingUpgradeLevel:0
  });
  currentBargeIndex = site.barges.length-1;
  updateDisplay();
  openModal("New barge purchased!");
}
function hireStaff(){
  const site = sites[currentSiteIndex];
  const capacity = site.barges.reduce((t,b)=>t+b.staffCapacity,0);
  if(site.staff.length >= capacity)
    return openModal("No staff housing available.");
  if(cash < STAFF_HIRE_COST) return openModal("Not enough cash to hire staff.");
  cash -= STAFF_HIRE_COST;
  site.staff.push({ role: null });
  updateDisplay();
}
function fireStaff(role=null){
  const site = sites[currentSiteIndex];
  const idx = site.staff.findIndex(s => role ? s.role===role : !s.role);
  if(idx === -1) return openModal("No staff member available to fire.");
  site.staff.splice(idx,1);
  updateDisplay();
}
function assignStaff(role){
  const site = sites[currentSiteIndex];
  const member = site.staff.find(s=>!s.role);
  if(!member) return openModal("No unassigned staff available.");
  if(!staffRoles[role]) return;
  member.role = role;
  updateDisplay();
}
function unassignStaff(role){
  const site = sites[currentSiteIndex];
  const member = site.staff.find(s=>s.role===role);
  if(!member) return openModal(`No staff assigned as ${role}.`);
  member.role = null;
  updateDisplay();
}
function upgradeStaffHousing(){
  const site = sites[currentSiteIndex];
  const barge = site.barges[currentBargeIndex];
  if(barge.housingUpgradeLevel >= staffHousingUpgrades.length)
    return openModal("Staff housing fully upgraded!");
  const up = staffHousingUpgrades[barge.housingUpgradeLevel];
  if(cash < up.cost) return openModal("Not enough cash to upgrade housing.");
  cash -= up.cost;
  barge.staffCapacity += up.extraCapacity;
  barge.housingUpgradeLevel++;
  updateDisplay();
}

function upgradeBarge(){
  const site = sites[currentSiteIndex];
  const barge = site.barges[currentBargeIndex];
  const currentTier = barge.tier;
  if(currentTier >= bargeTiers.length - 1)
    return openModal("Barge already at max tier.");
  const next = bargeTiers[currentTier + 1];
  if(cash < next.cost) return openModal("Not enough cash to upgrade barge.");
  cash -= next.cost;
  barge.tier++;
  barge.feedCapacity = Math.max(barge.feedCapacity, next.feedCapacity);
  barge.feederLimit = next.feederLimit;
  barge.maxFeederTier = next.maxFeederTier;
  openModal(`Barge upgraded to ${next.name}!`);
  updateDisplay();
}

function upgradeVessel(){
  const vessel = vessels[currentVesselIndex];
  const currentTier = vessel.tier;
  if(currentTier >= vesselTiers.length - 1)
    return openModal("Vessel already at max tier.");
  const next = vesselTiers[currentTier + 1];
  if(cash < next.cost) return openModal("Not enough cash to upgrade vessel.");
  cash -= next.cost;
  vessel.tier++;
  vessel.maxBiomassCapacity = Math.max(vessel.maxBiomassCapacity, next.maxBiomassCapacity);
  vessel.speed = next.speed;
  openModal(`Vessel upgraded to ${next.name} tier!`);
  updateDisplay();
}

function buyNewVessel(){
  if(cash < NEW_VESSEL_COST) return openModal("Not enough cash to buy a new vessel!");
  cash -= NEW_VESSEL_COST;
  vessels.push(new Vessel({
    name: `Vessel ${vessels.length + 1}`,
    maxBiomassCapacity: vesselTiers[0].maxBiomassCapacity,
    currentBiomassLoad: 0,
    speed: vesselTiers[0].speed,
    location: 'Dock',
    tier: 0,
    cargo: {}
  }));
  currentVesselIndex = vessels.length - 1;
  updateDisplay();
  openModal('New vessel purchased!');
}

function renameVessel(){
  const vessel = vessels[currentVesselIndex];
  const newName = prompt('Enter vessel name:', vessel.name);
  if(newName){
    vessel.name = newName.trim();
    updateDisplay();
  }
}

function openMoveVesselModal(){
  const optionsDiv = document.getElementById('moveOptions');
  optionsDiv.innerHTML = '';
  const vessel = vessels[currentVesselIndex];
  sites.forEach((s, idx)=>{
    const btn = document.createElement('button');
    const secs = estimateTravelTime(vessel.location, s.location, vessel);
    btn.innerText = `${s.name} (${secs.toFixed(1)}s)`;
    btn.onclick = ()=>moveVesselTo('site', idx);
    optionsDiv.appendChild(btn);
  });
  markets.forEach((m, idx)=>{
    const btn = document.createElement('button');
    const secs = estimateTravelTime(vessel.location, m.location, vessel);
    btn.innerText = `${m.name} (${secs.toFixed(1)}s)`;
    btn.onclick = ()=>moveVesselTo('market', idx);
    optionsDiv.appendChild(btn);
  });
  document.getElementById('moveModal').classList.add('visible');
}
function closeMoveModal(){
  document.getElementById('moveModal').classList.remove('visible');
}

function moveVesselTo(type, idx){
  const vessel = vessels[currentVesselIndex];
  let destName;
  let destLoc;
  if(type==='site'){
    const site = sites[idx];
    destName = site.name;
    destLoc = site.location;
  } else {
    const market = markets[idx];
    destName = market.name;
    destLoc = market.location;
  }
  if(vessel.location === destName){
    closeMoveModal();
    return openModal(`Vessel already at ${destName}.`);
  }
  if(vessel.location === `Traveling to ${destName}`){
    closeMoveModal();
    return openModal(`Vessel already en route to ${destName}.`);
  }
  const startLoc = getLocationByName(vessel.location) || sites[currentSiteIndex].location;
  const dx = startLoc.x - destLoc.x;
  const dy = startLoc.y - destLoc.y;
  const distance = Math.hypot(dx, dy);
  vessel.location = `Traveling to ${destName}`;
  closeMoveModal();
  setTimeout(()=>{
    vessel.location = destName;
    updateDisplay();
  }, distance / vessel.speed * TRAVEL_TIME_FACTOR);
}

// feed / harvest / restock
function feedFish(){
  const site = sites[currentSiteIndex];
  const pen  = site.pens[currentPenIndex];
  const barge = site.barges[pen.bargeIndex];
  if(barge.feed<1 || pen.fishCount===0) return;
  barge.feed--;
  const gain = 1 / speciesData[pen.species].fcr;
  pen.averageWeight += gain/pen.fishCount;
}
function harvestPen(amount=null){
  const site = sites[currentSiteIndex];
  const pen  = site.pens[currentPenIndex];
  const vessel = vessels[currentVesselIndex];
  if(pen.fishCount===0) return;
  if(vessel.currentBiomassLoad>0 && !vessel.cargo[pen.species]){
    return openModal('Vessel already contains a different species.');
  }
  const totalBiomass = pen.fishCount * pen.averageWeight;
  const maxHarvest = Math.min(
    getSiteHarvestCapacity(site),
    totalBiomass,
    vessel.maxBiomassCapacity - vessel.currentBiomassLoad
  );
  if(maxHarvest <= 0) return openModal("Vessel capacity full.");
  let desired = amount === null ? maxHarvest : Math.max(0, Math.min(amount, maxHarvest));
  let fishNum = Math.floor((desired + pen.averageWeight * 0.0001) / pen.averageWeight);
  if(fishNum === 0 && desired > 0) fishNum = 1;
  fishNum = Math.min(fishNum, pen.fishCount);
  const biomass = fishNum * pen.averageWeight;
  const performHarvest = ()=>{
    vessel.currentBiomassLoad += biomass;
    if(!vessel.cargo[pen.species]) vessel.cargo[pen.species] = 0;
    vessel.cargo[pen.species] += biomass;
    vessel.location = site.name;
    pen.fishCount -= fishNum;
    if(pen.fishCount===0) pen.averageWeight = 0;
    openModal(`Harvested ${biomass.toFixed(2)} kg loaded onto ${vessel.name}.`);
    updateDisplay();
  };
  if(vessel.location !== site.name){
    const startLoc = getLocationByName(vessel.location) || site.location;
    const dx = startLoc.x - site.location.x;
    const dy = startLoc.y - site.location.y;
    const distance = Math.hypot(dx, dy);
    vessel.location = `Traveling to ${site.name}`;
    setTimeout(()=>{
      vessel.location = site.name;
      performHarvest();
    }, distance / vessel.speed * TRAVEL_TIME_FACTOR);
  } else {
    performHarvest();
  }
}
function restockPen(sp){
  const site = sites[currentSiteIndex];
  const pen  = site.pens[currentPenIndex];
  const data = speciesData[sp];
  if(cash < data.restockCost) return openModal("Not enough cash to restock.");
  cash -= data.restockCost;
  pen.species = sp;
  pen.fishCount = data.restockCount;
  pen.averageWeight = data.startingWeight;
  closeRestockModal();
}
// dev menu
function addDevCash() {
  cash += 100000;
  updateDisplay();
}

// sidebar nav
function togglePanel(id){
  const sb = document.getElementById('sidebar');
  const container = document.querySelector('.container');
  const p  = document.getElementById(id);
  if(!sb.classList.contains('open')) {
    sb.classList.add('open');
    container.classList.add('shifted');
  } else {
    container.classList.add('shifted');
  }
  document.querySelectorAll('#sidebar .panel').forEach(x=>x.classList.remove('visible'));
  document.querySelectorAll('#sidebarContent button').forEach(x=>x.classList.remove('active'));
  p.classList.add('visible');
  document.getElementById('toggle'+capitalizeFirstLetter(id)).classList.add('active');
}
document.getElementById('toggleSidebar').addEventListener('click',()=>{
  const sb = document.getElementById('sidebar');
  const container = document.querySelector('.container');
  sb.classList.toggle('open');
  if(sb.classList.contains('open')){
    container.classList.add('shifted');
  } else {
    container.classList.remove('shifted');
    document.querySelectorAll('#sidebar .panel').forEach(x=>x.classList.remove('visible'));
    document.querySelectorAll('#sidebarContent button').forEach(x=>x.classList.remove('active'));
  }
});

function toggleSection(id){
  const el = document.getElementById(id);
  if(el) el.classList.toggle('visible');
}

function closeSidebar(){
  const sb = document.getElementById('sidebar');
  const container = document.querySelector('.container');
  sb.classList.remove('open');
  container.classList.remove('shifted');
  document.querySelectorAll('#sidebar .panel').forEach(x=>x.classList.remove('visible'));
  document.querySelectorAll('#sidebarContent button').forEach(x=>x.classList.remove('active'));
}

function showTab(tab){
  closeSidebar();
  document.querySelectorAll('#tabBar button').forEach(b=>b.classList.remove('active'));
  const btn = document.getElementById(tab+'Tab');
  if(btn) btn.classList.add('active');
  const hide = id => { const el=document.getElementById(id); if(el) el.style.display='none'; };
  hide('cardContainer');
  hide('penGrid');
  hide('harvestInfo');
  hide('bargeCard');
  hide('vesselCard');
  hide('staffCard');

  switch(tab){
    case 'overview':
      document.getElementById('cardContainer').style.display='block';
      document.getElementById('harvestInfo').style.display='block';
      document.getElementById('bargeCard').style.display='block';
      document.getElementById('vesselCard').style.display='block';
      document.getElementById('staffCard').style.display='block';
      break;
    case 'pens':
      document.getElementById('cardContainer').style.display='block';
      document.getElementById('bargeCard').style.display='block';
      document.getElementById('penGrid').style.display='block';
      break;
    case 'barges':
      document.getElementById('cardContainer').style.display='block';
      document.getElementById('bargeCard').style.display='block';
      break;
    case 'vessels':
      document.getElementById('cardContainer').style.display='block';
      document.getElementById('vesselCard').style.display='block';
      break;
    case 'staffing':
      document.getElementById('cardContainer').style.display='block';
      document.getElementById('staffCard').style.display='block';
      break;
    case 'shop':
      togglePanel('shop');
      break;
  }
}

// pen buttons helper
function feedFishPen(i){ currentPenIndex=i; feedFish(); updateDisplay(); }
function harvestPenIndex(i){ openHarvestModal(i); }
function restockPenUI(i){ currentPenIndex=i; openRestockModal(); }
function upgradeFeeder(i){
  const site = sites[currentSiteIndex];
  const pen = site.pens[i];
  const currentTier = pen.feeder?.tier || 0;
  if(currentTier >= feederUpgrades.length) return openModal("Feeder already at max tier.");
  const nextTier = currentTier + 1;
  const barge = site.barges[pen.bargeIndex];
  if(nextTier > barge.maxFeederTier) return openModal("Barge tier too low for this feeder upgrade.");
  if(!pen.feeder && site.pens.filter(p=>p.feeder && p.bargeIndex===pen.bargeIndex).length >= barge.feederLimit)
    return openModal("Barge cannot support more feeders.");
  const up = feederUpgrades[currentTier];
  if(cash < up.cost) return openModal("Not enough cash for upgrade.");
  cash -= up.cost;
  pen.feeder = { type: up.type, tier: nextTier };
  openModal(`Feeder upgraded to ${capitalizeFirstLetter(up.type)} (Tier ${nextTier}).`);
  updateDisplay();
}

function assignBarge(penIdx, bargeIdx){
  const site = sites[currentSiteIndex];
  const pen = site.pens[penIdx];
  const idx = Number(bargeIdx);
  if(idx >= 0 && idx < site.barges.length){
    pen.bargeIndex = idx;
    updateDisplay();
  }
}

function updateSelectedBargeDisplay(){
  const select = document.getElementById('newPenBargeSelect');
  const disp = document.getElementById('selectedBargeDisplay');
  if(select && disp){
    disp.innerText = `Selected: ${Number(select.value)+1}`;
  }
}
function getFeederRate(f){
  if(!f) return 0;
  const data = feederUpgrades[f.tier - 1];
  return data ? data.rate : 0;
}
function getStaffFeedRate(site){
  return site.staff.filter(s=>s.role==='feeder').length;
}
function getSiteHarvestCapacity(site, elapsedSeconds = 1){
  const harvesters = site.staff.filter(s=>s.role==='harvester').length;
  return BASE_HARVEST_CAPACITY + (HARVESTER_RATE * harvesters * elapsedSeconds);
}

// --- AUTO-FEED ALL SITES & PENS EVERY SECOND ---
setInterval(()=>{
  sites.forEach(site=>{
    const staffRate = getStaffFeedRate(site);
    site.barges.forEach((barge,bIdx)=>{
      let activeFeeders = 0;
      site.pens.forEach(pen=>{
        if(pen.bargeIndex!==bIdx) return;
        let rate = staffRate;
        const feederRate = getFeederRate(pen.feeder);
        if(feederRate>0 && activeFeeders < barge.feederLimit){
          rate += feederRate;
          activeFeeders++;
        }
        for(let i=0;i<rate;i++){
          if(barge.feed>=1 && pen.fishCount>0){
            barge.feed--;
            const gain = 1 / speciesData[pen.species].fcr;
            pen.averageWeight += gain/pen.fishCount;
          }
        }
      });
    });
  });
  updateDisplay();
},1000);

// --- AUTO FEED MANAGER ---
function checkFeedManagers(){
  sites.forEach(site=>{
    if(!site.staff.some(s=>s.role==='feedManager')) return;
    site.barges.forEach(barge=>{
      if(barge.feed/barge.feedCapacity < FEED_THRESHOLD_PERCENT){
        const maxAffordable = Math.floor(cash / FEED_COST_PER_KG);
        const available = barge.feedCapacity - barge.feed;
        const qty = Math.min(maxAffordable, available);
        if(qty > 0){
          cash -= qty * FEED_COST_PER_KG;
          barge.feed += qty;
          addStatusMessage(`Feed Manager purchased ${qty}kg of feed for ${site.name}.`);
        }
      }
    });
  });
  updateDisplay();
}
setInterval(checkFeedManagers, 5000);

// simplified feed manager logic for offline simulation
function simulateFeedManagers(){
  sites.forEach(site=>{
    if(!site.staff.some(s=>s.role==='feedManager')) return;
    site.barges.forEach(barge=>{
      if(barge.feed/barge.feedCapacity < FEED_THRESHOLD_PERCENT){
        const maxAffordable = Math.floor(cash / FEED_COST_PER_KG);
        const available = barge.feedCapacity - barge.feed;
        const qty = Math.min(maxAffordable, available);
        if(qty>0){
          cash -= qty * FEED_COST_PER_KG;
          barge.feed += qty;
        }
      }
    });
  });
}

// Run simplified game ticks to account for offline progress
function simulateOfflineProgress(ms){
  const seconds = Math.floor(ms/1000);
  let feedUsed = 0;
  let daysPassed = 0;
  for(let i=0;i<seconds;i++){
    // auto feed logic
    sites.forEach(site=>{
      const staffRate = getStaffFeedRate(site);
      site.barges.forEach((barge,bIdx)=>{
        let activeFeeders = 0;
        site.pens.forEach(pen=>{
          if(pen.bargeIndex!==bIdx) return;
          let rate = staffRate;
          const fr = getFeederRate(pen.feeder);
          if(fr>0 && activeFeeders < barge.feederLimit){
            rate += fr;
            activeFeeders++;
          }
          for(let j=0;j<rate;j++){
            if(barge.feed>=1 && pen.fishCount>0){
              barge.feed--;
              feedUsed++;
              const gain = 1 / speciesData[pen.species].fcr;
              pen.averageWeight += gain/pen.fishCount;
            }
          }
        });
      });
    });

    if((i+1)%5===0) simulateFeedManagers();

    if((i+1)%(DAY_DURATION_MS/1000)===0){
      advanceDay();
      daysPassed++;
    }
  }
  return {daysPassed, feedUsed};
}

// --- GAME TIME LOOP ---
setInterval(()=>{
  if(!timePaused){
    advanceDay();
  }
}, DAY_DURATION_MS);

// --- SAVE SYSTEM ---
function saveGame() {
  const data = {
    cash,
    penPurchaseCost,
    sites,
    vessels,
    lastSaved: Date.now(),
    time: {
      totalDaysElapsed,
      dayInSeason,
      seasonIndex,
      year
    }
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    addStatusMessage('Game saved!');
  } catch (e) {
    console.error('Save failed', e);
  }
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;
  try {
    const obj = JSON.parse(raw);
    if (obj && obj.sites) {
      cash = obj.cash ?? cash;
      penPurchaseCost = obj.penPurchaseCost ?? penPurchaseCost;
      sites = obj.sites;
      sites.forEach(s => { if(!s.location) s.location = { x: Math.random()*100, y: Math.random()*100 }; });
      vessels = obj.vessels ?? vessels;
      vessels.forEach(v => { if(!v.cargo) v.cargo = {}; });
      if(obj.time){
        totalDaysElapsed = obj.time.totalDaysElapsed ?? totalDaysElapsed;
        dayInSeason = obj.time.dayInSeason ?? dayInSeason;
        seasonIndex = obj.time.seasonIndex ?? seasonIndex;
        year = obj.time.year ?? year;
      }
      if(obj.lastSaved){
        const diff = Date.now() - obj.lastSaved;
        if(diff > 1000){
          lastOfflineInfo = simulateOfflineProgress(diff);
          lastOfflineInfo.elapsedMs = diff;
        }
      }
    }
  } catch (e) {
    console.error('Load failed', e);
  }
}

function resetGame() {
  localStorage.removeItem(SAVE_KEY);
  location.reload();
}

// site/pen nav
function previousSite(){ if(currentSiteIndex>0) currentSiteIndex--; currentPenIndex=0; currentBargeIndex=0; updateDisplay(); }
function nextSite(){ if(currentSiteIndex<sites.length-1) currentSiteIndex++; currentPenIndex=0; currentBargeIndex=0; updateDisplay(); }

function previousBarge(){ if(currentBargeIndex>0) currentBargeIndex--; updateDisplay(); }
function nextBarge(){ const site = sites[currentSiteIndex]; if(currentBargeIndex<site.barges.length-1) currentBargeIndex++; updateDisplay(); }
function previousVessel(){ if(currentVesselIndex>0) currentVesselIndex--; updateDisplay(); }
function nextVessel(){ if(currentVesselIndex<vessels.length-1) currentVesselIndex++; updateDisplay(); }

// Expose functions for HTML event handlers
Object.assign(window, {
  buyFeed,
  buyMaxFeed,
  buyFeedStorageUpgrade,
  buyLicense,
  buyNewSite,
  buyNewPen,
  buyNewBarge,
  hireStaff,
  fireStaff,
  assignStaff,
  unassignStaff,
  upgradeStaffHousing,
  upgradeBarge,
  addDevCash,
  togglePanel,
  openModal,
  closeModal,
  openRestockModal,
  closeRestockModal,
  openHarvestModal,
  closeHarvestModal,
  confirmHarvest,
  feedFishPen,
  harvestPenIndex,
  restockPenUI,
  upgradeFeeder,
  assignBarge,
  openSellModal,
  closeSellModal,
  sellCargo,
  toggleSection,
  saveGame,
  resetGame,
  previousSite,
  nextSite,
  previousBarge,
  nextBarge,
  previousVessel,
  nextVessel,
  upgradeVessel,
  buyNewVessel,
  renameVessel,
  openMoveVesselModal,
  closeMoveModal,
  moveVesselTo,
  showTab,
  updateSelectedBargeDisplay,
  getTimeState
});

// Initialize
document.addEventListener("DOMContentLoaded",()=>{
  loadGame();
  updateDisplay();
  setupMapInteractions();
  showTab('overview');
  if(lastOfflineInfo){
    const days = lastOfflineInfo.daysPassed;
    const feed = lastOfflineInfo.feedUsed.toFixed(0);
    const hrs = (lastOfflineInfo.elapsedMs/3600000).toFixed(1);
    openModal(`Welcome back! ${hrs}h passed while you were away. `+
              `${days} in-game days progressed and about ${feed}kg feed was used.`);
  }
  setInterval(saveGame, AUTO_SAVE_INTERVAL_MS);
});
