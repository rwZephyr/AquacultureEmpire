import {
  bargeTiers,
  NEW_BARGE_COST,
  feedStorageUpgrades,
  STAFF_HIRE_COST,
  staffRoles,
  staffHousingUpgrades,
  speciesData,
  feederUpgrades,
  siteNamePrefixes,
  siteNameSuffixes
} from './data.js';
import { Site, Barge, Pen } from './models.js';

// Core Game State
let cash = 200;
const BASE_HARVEST_CAPACITY = 50;
let penPurchaseCost = 1000;
let currentPenIndex = 0;
let currentSiteIndex = 0;
let currentBargeIndex = 0;

const FEED_COST_PER_KG = 0.25;
const FEED_THRESHOLD_PERCENT = 0.2;

let statusMessage = '';
function addStatusMessage(msg){
  statusMessage = msg;
  const el = document.getElementById('statusMessages');
  if(el) el.innerText = msg;
}

// Game Data
let sites = [
  new Site({
    name: 'Mernan Inlet',
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

// Upgrades & Species constants are imported from data.js

// UTILITIES
function capitalizeFirstLetter(str){ return str.charAt(0).toUpperCase()+str.slice(1); }
function generateRandomSiteName(){
  const p = siteNamePrefixes[Math.floor(Math.random()*siteNamePrefixes.length)];
  const s = siteNameSuffixes[Math.floor(Math.random()*siteNameSuffixes.length)];
  return `${p} ${s}`;
}

// --- UPDATE UI ---
function updateDisplay(){
  const site = sites[currentSiteIndex];
  const pen  = site.pens[currentPenIndex];

  // top-bar
  document.getElementById('siteName').innerText = site.name;
  document.getElementById('cashCount').innerText = cash.toFixed(2);

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
  const statusEl = document.getElementById('statusMessages');
  if(statusEl) statusEl.innerText = statusMessage;
}

// harvest preview
function updateHarvestInfo(){
  const site = sites[currentSiteIndex];
  const pen  = site.pens[currentPenIndex];
  const infoDiv = document.getElementById('harvestInfo');
  if(pen.fishCount>0){
    const totalBiomass = pen.fishCount * pen.averageWeight;
    const harvestableBiomass = Math.min(getSiteHarvestCapacity(site), totalBiomass);
    const earnings = harvestableBiomass * speciesData[pen.species].marketPrice;
    infoDiv.innerText = `Next harvest: ~${harvestableBiomass.toFixed(2)} kg for ~$${earnings.toFixed(2)}`;
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
  site.pens.forEach((pen, idx)=>{
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
      <div class="stat">Barge: ${pen.bargeIndex+1}</div>
      <div class="stat">${nextCostText}</div>
      <button onclick="feedFishPen(${idx})">Feed</button>
      <button onclick="harvestPenIndex(${idx})">Harvest</button>
      <button onclick="restockPenUI(${idx})">Restock</button>
      <button onclick="upgradeFeeder(${idx})">Upgrade Feeder</button>
      <button onclick="assignBarge(${idx})">Assign Barge</button>
    `;
    grid.appendChild(card);
  });
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
  sites.push({
    name: generateRandomSiteName(),
    barges:[{
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
    }],
    staff: [],
    licenses:['shrimp'],
    pens:[{ species:"shrimp", fishCount:500, averageWeight:0.01, bargeIndex:0 }]
  });
  updateDisplay();
  openModal("New site purchased!");
}
function buyNewPen(){
  if(cash<penPurchaseCost) return openModal("Not enough cash to buy a new pen!");
  cash -= penPurchaseCost;
  sites[currentSiteIndex].pens.push({ species:"shrimp", fishCount:0, averageWeight:0, bargeIndex: currentBargeIndex });
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
function buyDevCash(){ cash+=100000; updateDisplay(); }

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
function harvestPen(){
  const site = sites[currentSiteIndex];
  const pen  = site.pens[currentPenIndex];
  if(pen.fishCount===0) return;
  const totalBiomass = pen.fishCount * pen.averageWeight;
  const harvestable = Math.min(getSiteHarvestCapacity(site), totalBiomass);
  let fishNum = Math.floor(harvestable/pen.averageWeight);
  fishNum = Math.min(fishNum, pen.fishCount);
  const biomass = fishNum * pen.averageWeight;
  cash += biomass * speciesData[pen.species].marketPrice;
  pen.fishCount -= fishNum;
  if(pen.fishCount===0) pen.averageWeight = 0;
  openModal(`Harvested ${biomass.toFixed(2)} kg and earned $${(biomass*speciesData[pen.species].marketPrice).toFixed(2)}!`);
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

// pen buttons helper
function feedFishPen(i){ currentPenIndex=i; feedFish(); updateDisplay(); }
function harvestPenIndex(i){ currentPenIndex=i; harvestPen(); updateDisplay(); }
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

function assignBarge(i){
  const site = sites[currentSiteIndex];
  const pen = site.pens[i];
  pen.bargeIndex = (pen.bargeIndex + 1) % site.barges.length;
  updateDisplay();
}
function getFeederRate(f){
  if(!f) return 0;
  const data = feederUpgrades[f.tier - 1];
  return data ? data.rate : 0;
}
function getStaffFeedRate(site){
  return site.staff.filter(s=>s.role==='feeder').length;
}
function getSiteHarvestCapacity(site){
  const harvesters = site.staff.filter(s=>s.role==='harvester').length;
  return BASE_HARVEST_CAPACITY + harvesters * 10;
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

// --- SAVE SYSTEM ---
function saveGame() {
  const data = {
    cash,
    penPurchaseCost,
    sites
  };
  try {
    localStorage.setItem('aquacultureEmpireSave', JSON.stringify(data));
    addStatusMessage('Game saved!');
  } catch (e) {
    console.error('Save failed', e);
  }
}

function loadGame() {
  const raw = localStorage.getItem('aquacultureEmpireSave');
  if (!raw) return;
  try {
    const obj = JSON.parse(raw);
    if (obj && obj.sites) {
      cash = obj.cash ?? cash;
      penPurchaseCost = obj.penPurchaseCost ?? penPurchaseCost;
      sites = obj.sites;
    }
  } catch (e) {
    console.error('Load failed', e);
  }
}

function resetGame() {
  localStorage.removeItem('aquacultureEmpireSave');
  location.reload();
}

// site/pen nav
function previousSite(){ if(currentSiteIndex>0) currentSiteIndex--; currentPenIndex=0; currentBargeIndex=0; updateDisplay(); }
function nextSite(){ if(currentSiteIndex<sites.length-1) currentSiteIndex++; currentPenIndex=0; currentBargeIndex=0; updateDisplay(); }

function previousBarge(){ if(currentBargeIndex>0) currentBargeIndex--; updateDisplay(); }
function nextBarge(){ const site = sites[currentSiteIndex]; if(currentBargeIndex<site.barges.length-1) currentBargeIndex++; updateDisplay(); }

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
  feedFishPen,
  harvestPenIndex,
  restockPenUI,
  upgradeFeeder,
  assignBarge,
  saveGame,
  resetGame,
  previousSite,
  nextSite,
  previousBarge,
  nextBarge
});

// Initialize
document.addEventListener("DOMContentLoaded",()=>{ loadGame(); updateDisplay(); });
