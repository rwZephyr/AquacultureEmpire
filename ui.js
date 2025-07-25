import {
  NEW_BARGE_COST,
  NEW_VESSEL_COST,
  feedStorageUpgrades,
  staffHousingUpgrades,
  speciesData,
  feederUpgrades,
  vesselTiers,
  markets,
  vesselClasses,
  vesselUnlockDays,
  CUSTOM_BUILD_MARKUP,
  siloUpgrades,
  blowerUpgrades,
  housingUpgrades
} from "./data.js";
import state, {
  capitalizeFirstLetter,
  getDateString,
  estimateSellPrice,
  estimateTravelTime,
  getSiteHarvestRate,
} from "./gameState.js";
import { milestones } from './milestones.js';

const speciesColors = {
  shrimp: '#e74c3c',
  salmon: '#f39c12',
  tuna: '#3498db',
  tilapia: '#74c476',
  barramundi: '#9b59b6',
  cod: '#95a5a6',
  grouper: '#d35400'
};

const vesselIcons = {
  skiff: '🛶',
  lobsterBoat: '⚓',
  retiredTrawler: '🚢',
  wellboat: '🚤'
};

// close site dropdown when clicking outside
document.addEventListener('click', evt => {
  const list = document.getElementById('siteDropdownList');
  const btn  = document.getElementById('siteNameBtn');
  if(!list || !btn) return;
  if(list.classList.contains('visible') &&
     !list.contains(evt.target) && !btn.contains(evt.target)){
    list.classList.remove('visible');
    list.classList.add('hidden');
  }
});

function toggleMobileActions(){
  const group = document.getElementById('mobileActionGroup');
  if(!group) return;
  if(group.classList.contains('visible')){
    group.classList.remove('visible');
    group.classList.add('hidden');
  } else {
    group.classList.remove('hidden');
    group.classList.add('visible');
  }
}

function outsideMobileActionHandler(evt){
  const group = document.getElementById('mobileActionGroup');
  const toggle = document.getElementById('mobileActionToggle');
  if(!group || !toggle) return;
  if(group.classList.contains('visible') &&
     !group.contains(evt.target) && !toggle.contains(evt.target)){
    group.classList.remove('visible');
    group.classList.add('hidden');
  }
}

document.addEventListener('click', outsideMobileActionHandler);

function toggleSiteActions(){
  const menu = document.getElementById('siteActionMenu');
  if(!menu) return;
  if(menu.classList.contains('visible')){
    menu.classList.remove('visible');
    menu.classList.add('hidden');
  } else {
    menu.classList.remove('hidden');
    menu.classList.add('visible');
    document.addEventListener('click', outsideSiteActionHandler);
  }
}

function outsideSiteActionHandler(e){
  const menu = document.getElementById('siteActionMenu');
  const toggle = document.getElementById('siteActionToggle');
  if(!menu || !toggle) return;
  if(!menu.contains(e.target) && !toggle.contains(e.target)){
    menu.classList.remove('visible');
    menu.classList.add('hidden');
    document.removeEventListener('click', outsideSiteActionHandler);
  }
}

// Track counts to avoid re-rendering lists every tick
let lastSiteIndex = -1;
let lastPenCount = 0;
let lastVesselCount = 0;

// --- UPDATE UI ---
function updateDisplay(){
  const site = state.sites[state.currentSiteIndex];
  const pen  = site.pens[state.currentPenIndex];

  // top-bar
  document.getElementById('siteName').innerText = site.name;
  populateSiteList();
  document.getElementById('cashCount').innerText = state.cash.toFixed(2);
  const dateEl = document.getElementById('dateDisplay');
  if(dateEl) dateEl.innerText = getDateString();
  const playBtn = document.getElementById('playButton');
  const pauseBtn = document.getElementById('pauseButton');
  if(playBtn && pauseBtn){
    if(state.timePaused){
      playBtn.style.display = 'inline';
      pauseBtn.style.display = 'none';
    } else {
      playBtn.style.display = 'none';
      pauseBtn.style.display = 'inline';
    }
  }

  // barge card & feed overview
  const barge = site.barges[state.currentBargeIndex];
  document.getElementById('bargeIndex').innerText = state.currentBargeIndex + 1;
  document.getElementById('bargeCount').innerText = site.barges.length;
  document.getElementById('bargeFeedersUsed').innerText = site.pens.filter(p=>p.feeder && p.bargeIndex===state.currentBargeIndex).length;
  document.getElementById('bargeFeederLimit').innerText = barge.feederLimit;
  document.getElementById('bargeMaxFeederTier').innerText = barge.maxFeederTier;
  document.getElementById('bargeFeed').innerText         = barge.feed.toFixed(1);
  document.getElementById('bargeFeedCapacity').innerText = barge.feedCapacity;
  document.getElementById('bargeSiloCapacity').innerText = barge.siloCapacity;
  document.getElementById('bargeStaffCount').innerText    = site.staff.length;
  const totalCapacity = site.barges.reduce((t,b)=>t+b.staffCapacity,0);
  document.getElementById('bargeStaffCapacity').innerText = totalCapacity;
  document.getElementById('bargeStaffUnassigned').innerText = site.staff.filter(s=>!s.role).length;

  const totalFeed = site.barges.reduce((t,b)=>t+b.feed,0);
  const totalFeedCap = site.barges.reduce((t,b)=>t+b.feedCapacity,0);
  const feedPercent = totalFeedCap ? (totalFeed/totalFeedCap)*100 : 0;
  const prog = document.getElementById('feedProgress');
  if(prog) prog.style.width = feedPercent + '%';
  const totalFeedEl = document.getElementById('totalFeed');
  if(totalFeedEl) totalFeedEl.innerText = totalFeed.toFixed(1);
  const totalFeedCapEl = document.getElementById('totalFeedCapacity');
  if(totalFeedCapEl) totalFeedCapEl.innerText = totalFeedCap;

  // vessel grid

  // staff card info
  document.getElementById('staffTotal').innerText = site.staff.length;
  document.getElementById('staffCapacity').innerText = totalCapacity;
  document.getElementById('staffUnassigned').innerText = site.staff.filter(s=>!s.role).length;
  document.getElementById('staffFeeders').innerText = site.staff.filter(s=>s.role==='feeder').length;
  document.getElementById('staffHarvesters').innerText = site.staff.filter(s=>s.role==='harvester').length;
  document.getElementById('staffManagers').innerText = site.staff.filter(s=>s.role==='feedManager').length;

  // shop panel info
  const storageInfoEl = document.getElementById('storageUpgradeInfo');
  if(storageInfoEl){
    if(barge.storageUpgradeLevel < feedStorageUpgrades.length){
      storageInfoEl.innerText = `Next Feed Storage Upgrade: $${feedStorageUpgrades[barge.storageUpgradeLevel].cost}`;
    } else {
      storageInfoEl.innerText = 'Feed Storage Fully Upgraded';
    }
  }
  const housingInfoEl = document.getElementById('bargeHousingInfo');
  if(housingInfoEl){
    if(barge.housingUpgradeLevel < staffHousingUpgrades.length){
      housingInfoEl.innerText =
        `Next Housing Upgrade: $${staffHousingUpgrades[barge.housingUpgradeLevel].cost}`;
    } else {
      housingInfoEl.innerText = 'Housing Fully Upgraded';
    }
  }
  const bargePurchaseEl = document.getElementById('bargePurchaseInfo');
  if(bargePurchaseEl) bargePurchaseEl.innerText = `New Barge Cost: $${NEW_BARGE_COST}`;
  const penPurchaseEl = document.getElementById('penPurchaseInfo');
  if(penPurchaseEl) penPurchaseEl.innerText = `Next Pen Purchase: $${state.penPurchaseCost.toFixed(0)}`;

  updateLicenseShop();

  if(lastSiteIndex !== state.currentSiteIndex || site.pens.length !== lastPenCount){
    renderPenGrid(site);
    lastPenCount = site.pens.length;
    lastSiteIndex = state.currentSiteIndex;
  } else {
    updatePenCards(site);
  }

  if(state.vessels.length !== lastVesselCount){
    renderVesselGrid();
    lastVesselCount = state.vessels.length;
  } else {
    updateVesselCards();
  }

  renderMap();
  const tsEl = document.querySelector('#marketReportContent .market-timestamp');
  if(tsEl) tsEl.innerText = `Prices last updated: ${state.lastMarketUpdateString}`;
  updateFeedPurchaseUI();
  updateMarketCharts();
}

// harvest preview
// license management
function updateSiteLicenses(){
  const listDiv = document.getElementById('siteLicenses');
  if(!listDiv) return;
  const site = state.sites[state.currentSiteIndex];
  listDiv.innerHTML = '<h3>Licensed Species</h3>';
  site.licenses.forEach(sp=>{
    const entry = document.createElement('div');
    entry.className = 'license-entry';
    entry.textContent = `Species: ${capitalizeFirstLetter(sp)} \u2013 \u2705`;
    listDiv.appendChild(entry);
  });
}

function updateLicenseShop(){
  const licenseDiv = document.getElementById('licenseShop');
  if(!licenseDiv) return;
  updateSiteLicenses();
  const site = state.sites[state.currentSiteIndex];
  licenseDiv.innerHTML = '';
  const select = document.createElement('select');
  select.id = 'licenseSelect';
  const sorted = Object.keys(speciesData).sort((a,b)=>a.localeCompare(b));
  sorted.forEach(sp=>{
    const data = speciesData[sp];
    if(!site.licenses.includes(sp) && data.licenseCost>0){
      const option = document.createElement('option');
      option.value = sp;
      option.textContent = `${capitalizeFirstLetter(sp)} - $${data.licenseCost}`;
      select.appendChild(option);
    }
  });
  if(select.options.length===0){
    licenseDiv.innerText = 'All licenses purchased.';
    return;
  }
  const btn = document.createElement('button');
  btn.id = 'buyLicenseBtn';
  btn.textContent = 'Buy License';
  btn.onclick = () => purchaseLicense(select.value);
  licenseDiv.appendChild(select);
  licenseDiv.appendChild(btn);
}

function updateSiteUpgrades(){
  const site = state.sites[state.currentSiteIndex];
  if(!site.upgrades) site.upgrades = [];
  const cards = document.querySelectorAll('#siteUpgrades .site-upgrade-card button');
  cards.forEach(btn => {
    const key = btn.dataset.upgrade;
    btn.disabled = true;
    if(site.upgrades.includes(key)){
      btn.textContent = 'Purchased';
    } else {
      btn.textContent = 'Work in Progress';
    }
  });
}

// pen grid
function renderPenGrid(site){
  const grid = document.getElementById('penGridContainer');
  grid.innerHTML = '';
  const select = document.getElementById('newPenBargeSelect');
  if(select){
    select.innerHTML = site.barges.map((b,i)=>`<option value="${i}">${i+1}</option>`).join('');
    select.value = state.currentBargeIndex;
    const disp = document.getElementById('selectedBargeDisplay');
    if(disp) disp.innerText = `Selected: ${Number(select.value)+1}`;
  }
  const tmpl = document.getElementById('penCardTemplate');
  site.pens.forEach((pen, idx)=>{
    const clone = tmpl.content.cloneNode(true);
    const card = clone.querySelector('.penCard');
    card.querySelector('.pen-name').textContent = `Pen ${idx+1}`;
    card.querySelector('.pen-species').textContent = capitalizeFirstLetter(pen.species);
    card.querySelector('.pen-fish').textContent = pen.fishCount;
    card.querySelector('.pen-avg').textContent = pen.averageWeight.toFixed(2);
    card.querySelector('.pen-biomass').textContent = (pen.fishCount * pen.averageWeight).toFixed(2);
    const feederType = pen.feeder?.type||'None';
    const feederTier = pen.feeder?.tier||0;
    card.querySelector('.pen-feeder').textContent = `${capitalizeFirstLetter(feederType)} (Tier ${feederTier})`;
    const warnEl = card.querySelector('.pen-warning');
    updatePenWarning(warnEl, pen);

    const hasFish = pen.species && pen.fishCount > 0;
    // single badge overlay in the top-right corner
    const badge = document.createElement('div');
    badge.classList.add('species-badge');
    if(hasFish){
      const icon = document.createElement('img');
      icon.src = 'assets/species-icons/' + pen.species + '.png';
      icon.alt = pen.species;
      icon.className = 'species-icon';
      badge.appendChild(icon);
      badge.style.backgroundColor = speciesColors[pen.species] || 'rgba(0,0,0,0.2)';
    } else {
      badge.style.backgroundColor = 'rgba(0,0,0,0.2)';
    }
    card.appendChild(badge);
    card.querySelector('.feed-btn').onclick = () => feedFishPen(idx);
    card.querySelector('.restock-btn').onclick = () => restockPenUI(idx);
    card.querySelector('.upgrade-btn').onclick = () => upgradeFeeder(idx);
    grid.appendChild(clone);
  });
}

function updatePenCards(site){
  const grid = document.getElementById('penGridContainer');
  if(!grid) return;
  site.pens.forEach((pen, idx)=>{
    const card = grid.children[idx];
    if(!card) return;
    card.querySelector('.pen-name').textContent = `Pen ${idx+1}`;
    card.querySelector('.pen-species').textContent = capitalizeFirstLetter(pen.species);
    card.querySelector('.pen-fish').textContent = pen.fishCount;
    card.querySelector('.pen-avg').textContent = pen.averageWeight.toFixed(2);
    card.querySelector('.pen-biomass').textContent = (pen.fishCount * pen.averageWeight).toFixed(2);
    const feederType = pen.feeder?.type||'None';
    const feederTier = pen.feeder?.tier||0;
    card.querySelector('.pen-feeder').textContent = `${capitalizeFirstLetter(feederType)} (Tier ${feederTier})`;
    const warnEl = card.querySelector('.pen-warning');
    updatePenWarning(warnEl, pen);

    let badge = card.querySelector('.species-badge');
    if(!badge){
      // create badge once per card
      badge = document.createElement('div');
      badge.classList.add('species-badge');
      card.appendChild(badge);
    }
    const hasFish = pen.species && pen.fishCount > 0;
    badge.innerHTML = '';
    if(hasFish){
      const icon = document.createElement('img');
      icon.src = 'assets/species-icons/' + pen.species + '.png';
      icon.alt = pen.species;
      icon.className = 'species-icon';
      badge.appendChild(icon);
      badge.style.backgroundColor = speciesColors[pen.species] || 'rgba(0,0,0,0.2)';
    } else {
      badge.style.backgroundColor = 'rgba(0,0,0,0.2)';
    }
  });
}

function updatePenWarning(el, pen){
  if(!el) return;
  const data = speciesData[pen.species];
  el.innerHTML = '';
  el.className = 'pen-warning';
  if(!data || !data.maxWeight) return;
  const max = data.maxWeight;
  const messages = [];
  if(pen.averageWeight >= max){
    messages.push('⚠ Exceeds ideal harvest weight — further growth may be inefficient');
    el.classList.add('critical');
    messages.push('<span class="diminish-note">⚠ Growth slowed — over optimal weight</span>');
  } else if(pen.averageWeight >= max*0.8){
    messages.push('Approaching harvest weight limit');
    el.classList.add('soft');
  }
  el.innerHTML = messages.join('<br>');
}

function renderVesselGrid(){
  const grid = document.getElementById('vesselGridContainer');
  if(!grid) return;
  grid.innerHTML = '';
  const tmpl = document.getElementById('vesselCardTemplate');
  state.vessels.forEach((vessel, idx)=>{
    const clone = tmpl.content.cloneNode(true);
    const card = clone.querySelector('.vesselCard');
    card.querySelector('.vessel-name .name-text').textContent = vessel.name;
    card.querySelector('.rename-icon').onclick = ()=>{ state.currentVesselIndex = idx; renameVessel(); };
    card.querySelector('.vessel-tier').textContent = vesselTiers[vessel.tier].name;
    card.querySelector('.vessel-location').textContent = vessel.location;
    const statusEl = card.querySelector('.vessel-status');
    let status = vessel.isHarvesting ? 'Harvesting' : vessel.unloading ? 'Unloading' : (vessel.location.startsWith('Traveling') ? 'Traveling' : 'Idle');
    if(vessel.actionEndsAt && vessel.actionEndsAt > Date.now()){
      const eta = Math.max(0, (vessel.actionEndsAt - Date.now())/1000);
      status += ` (${eta.toFixed(0)}s)`;
    }
    statusEl.textContent = status;
    const speciesEl = card.querySelector('.harvest-species');
    if(vessel.unloading){
      speciesEl.textContent = `Revenue $${vessel.offloadRevenue.toFixed(2)}`;
    } else {
      speciesEl.textContent = vessel.isHarvesting && vessel.cargoSpecies ? `Harvesting ${capitalizeFirstLetter(vessel.cargoSpecies)}` : '';
    }
    const loadPercent = vessel.maxBiomassCapacity ? (vessel.currentBiomassLoad / vessel.maxBiomassCapacity)*100 : 0;
    card.querySelector('.vessel-progress').style.width = loadPercent + '%';
    card.querySelector('.vessel-load').textContent = vessel.currentBiomassLoad.toFixed(1);
    card.querySelector('.vessel-capacity').textContent = vessel.maxBiomassCapacity;
    const harvestBtn = card.querySelector('.harvest-btn');
    harvestBtn.onclick = ()=>{ state.currentVesselIndex = idx; openHarvestModal(idx); };
    harvestBtn.style.display = (vessel.isHarvesting || vessel.unloading) ? 'none' : 'block';
    const moveBtn = card.querySelector('.move-btn');
    moveBtn.onclick = ()=>{ state.currentVesselIndex = idx; openMoveVesselModal(); };
    moveBtn.disabled = vessel.isHarvesting || vessel.unloading;
    const sellBtn = card.querySelector('.sell-btn');
    sellBtn.onclick = ()=>{ state.currentVesselIndex = idx; openSellModal(); };
    sellBtn.disabled = vessel.isHarvesting || vessel.unloading;
    const upBtn = card.querySelector('.upgrade-btn');
    upBtn.onclick = ()=>{ state.currentVesselIndex = idx; upgradeVessel(); };
    upBtn.disabled = vessel.isHarvesting || vessel.unloading;
    const cancelBtn = card.querySelector('.cancel-btn');
    cancelBtn.onclick = ()=>{
      state.currentVesselIndex = idx;
      if(vessel.unloading){
        const market = markets.find(m=>m.name===vessel.offloadMarket);
        finishOffloading(vessel, market, true);
      } else {
        cancelVesselHarvest(idx);
      }
    };
    cancelBtn.textContent = vessel.unloading ? 'Cancel Offloading' : 'Cancel';
    cancelBtn.style.display = (vessel.isHarvesting || vessel.unloading) ? 'block' : 'none';
    grid.appendChild(clone);
  });
}

function updateVesselCards(){
  const grid = document.getElementById('vesselGridContainer');
  if(!grid) return;
  state.vessels.forEach((vessel, idx)=>{
    const card = grid.children[idx];
    if(!card) return;
    card.querySelector('.vessel-name').textContent = vessel.name;
    card.querySelector('.vessel-tier').textContent = vesselTiers[vessel.tier].name;
    card.querySelector('.vessel-location').textContent = vessel.location;
    const statusEl = card.querySelector('.vessel-status');
    let status = vessel.isHarvesting ? 'Harvesting' : vessel.unloading ? 'Unloading' : (vessel.location.startsWith('Traveling') ? 'Traveling' : 'Idle');
    if(vessel.actionEndsAt && vessel.actionEndsAt > Date.now()){
      const eta = Math.max(0, (vessel.actionEndsAt - Date.now())/1000);
      status += ` (${eta.toFixed(0)}s)`;
    }
    statusEl.textContent = status;
    const speciesEl = card.querySelector('.harvest-species');
    if(vessel.unloading){
      speciesEl.textContent = `Revenue $${vessel.offloadRevenue.toFixed(2)}`;
    } else {
      speciesEl.textContent = vessel.isHarvesting && vessel.cargoSpecies ? `Harvesting ${capitalizeFirstLetter(vessel.cargoSpecies)}` : '';
    }
    const loadPercent = vessel.maxBiomassCapacity ? (vessel.currentBiomassLoad / vessel.maxBiomassCapacity)*100 : 0;
    card.querySelector('.vessel-progress').style.width = loadPercent + '%';
    card.querySelector('.vessel-load').textContent = vessel.currentBiomassLoad.toFixed(1);
    card.querySelector('.vessel-capacity').textContent = vessel.maxBiomassCapacity;
    const harvestBtn2 = card.querySelector('.harvest-btn');
    harvestBtn2.onclick = ()=>{ state.currentVesselIndex = idx; openHarvestModal(idx); };
    harvestBtn2.style.display = (vessel.isHarvesting || vessel.unloading) ? 'none' : 'block';
    const moveBtn2 = card.querySelector('.move-btn');
    moveBtn2.disabled = vessel.isHarvesting || vessel.unloading;
    moveBtn2.onclick = ()=>{ state.currentVesselIndex = idx; openMoveVesselModal(); };
    const sellBtn2 = card.querySelector('.sell-btn');
    sellBtn2.disabled = vessel.isHarvesting || vessel.unloading;
    sellBtn2.onclick = ()=>{ state.currentVesselIndex = idx; openSellModal(); };
    const upBtn2 = card.querySelector('.upgrade-btn');
    upBtn2.disabled = vessel.isHarvesting || vessel.unloading;
    upBtn2.onclick = ()=>{ state.currentVesselIndex = idx; upgradeVessel(); };
    const cancelBtn = card.querySelector('.cancel-btn');
    cancelBtn.onclick = ()=>{
      state.currentVesselIndex = idx;
      if(vessel.unloading){
        const market = markets.find(m=>m.name===vessel.offloadMarket);
        finishOffloading(vessel, market, true);
      } else {
        cancelVesselHarvest(idx);
      }
    };
    cancelBtn.textContent = vessel.unloading ? 'Cancel Offloading' : 'Cancel';
    cancelBtn.style.display = (vessel.isHarvesting || vessel.unloading) ? 'block' : 'none';
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
  state.sites.forEach(s=>{
    const pos = toPixel(s.location);
    ctx.fillText('🐟', pos.x, pos.y);
    mapMarkers.push({x:pos.x, y:pos.y, name:s.name});
  });
  // draw vessels
  state.vessels.forEach(v=>{
    let locName=v.location;
    if(locName.startsWith('Traveling to ')) locName=locName.replace('Traveling to ','');
    const site = state.sites.find(s=>s.name===locName);
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
function openModal(msg){
  const bargeModal = document.getElementById('bargeUpgradeModal');
  if(bargeModal && bargeModal.classList.contains('visible')){
    const alertEl = document.getElementById('bargeUpgradeMessage');
    if(alertEl){
      alertEl.textContent = msg;
      alertEl.style.display = 'block';
      setTimeout(()=>{ alertEl.style.display = 'none'; }, 3000);
    }
    return;
  }
  document.getElementById('modalText').innerText = msg;
  document.getElementById('modal').classList.add('visible');
}
function closeModal(){ document.getElementById('modal').classList.remove('visible'); }
function openRestockModal(){
  const site = state.sites[state.currentSiteIndex];
  const pen  = site.pens[state.currentPenIndex];
  if(pen.locked) return openModal('Pen currently busy.');
  if(pen.fishCount>0){ return openModal("You must harvest the pen before restocking!"); }
  const optionsDiv = document.getElementById('restockOptions');
  optionsDiv.innerHTML = '';
  site.licenses.forEach(sp => {
    const data = speciesData[sp];
    const card = document.createElement('div');
    card.className = 'species-card';
    card.onclick = () => {
      optionsDiv.querySelectorAll('.species-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      restockPen(sp);
    };

    const img = document.createElement('img');
    img.src = `assets/species-icons/${sp}.png`;
    img.className = 'species-icon';

    const info = document.createElement('div');
    info.className = 'species-info';

    const name = document.createElement('div');
    name.className = 'species-name';
    name.textContent = `${capitalizeFirstLetter(sp)} ($${data.restockCost})`;

    const tagRow = document.createElement('div');
    tagRow.className = 'species-tags';
    if (data.tags && data.tags.length) {
      data.tags.forEach(t => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = t;
        tagRow.appendChild(span);
      });
    }

    info.appendChild(name);
    info.appendChild(tagRow);
    card.appendChild(img);
    card.appendChild(info);
    optionsDiv.appendChild(card);
  });
  document.getElementById('restockModal').classList.add('visible');
}
function closeRestockModal(){ document.getElementById('restockModal').classList.remove('visible'); }

function updateHarvestModal(){
  const site = state.sites[state.currentSiteIndex];
  const vessel = state.vessels[state.currentVesselIndex];
  const penIdx = Number(document.getElementById('harvestPenSelect').value);
  state.currentPenIndex = penIdx;
  const pen  = site.pens[penIdx];
  const remaining = vessel.maxBiomassCapacity - vessel.currentBiomassLoad;
  const maxHarvest = Math.min(pen.fishCount * pen.averageWeight, remaining);
  const rate = getSiteHarvestRate(site);
  const secs = maxHarvest / rate;
  document.getElementById('harvestMax').innerText = maxHarvest.toFixed(2);
  const input = document.getElementById('harvestAmount');
  input.max = maxHarvest;
  input.value = maxHarvest.toFixed(3);
  document.getElementById('harvestModalContent').querySelector('h2').innerText =
    `Start Harvest (~${secs.toFixed(1)}s)`;
}

function openHarvestModal(vIdx){
  state.currentVesselIndex = vIdx;
  const site = state.sites[state.currentSiteIndex];
  const vessel = state.vessels[vIdx];
  if(vessel.isHarvesting) return openModal('Vessel currently harvesting.');
  const select = document.getElementById('harvestPenSelect');
  select.innerHTML = '';
  site.pens.forEach((pen, idx)=>{
    const biomass = (pen.fishCount * pen.averageWeight).toFixed(2);
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = `Pen ${idx+1} - ${capitalizeFirstLetter(pen.species)} (${biomass}kg)`;
    if(pen.locked || pen.fishCount<=0) opt.disabled = true;
    select.appendChild(opt);
  });
  if(select.options.length===0) return openModal('No available pens to harvest.');
  select.onchange = updateHarvestModal;
  select.value = select.options[0].value;
  updateHarvestModal();
  document.getElementById('harvestModal').classList.add('visible');
}
function closeHarvestModal(){ document.getElementById('harvestModal').classList.remove('visible'); }
function confirmHarvest(){
  const amount = parseFloat(document.getElementById('harvestAmount').value);
  window.harvestPen(amount);
  closeHarvestModal();
  updateDisplay();
}


function openSellModal(){
  const optionsDiv = document.getElementById('sellOptions');
  optionsDiv.innerHTML = '';
  const vessel = state.vessels[state.currentVesselIndex];
  if(vessel.isHarvesting) return openModal('Vessel currently harvesting.');
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

function openBargeUpgradeModal(){
  const site = state.sites[state.currentSiteIndex];
  const barge = site.barges[state.currentBargeIndex];

  const setRow = (id, label, lvl, table, key, fnName) => {
    const row = document.getElementById(id);
    if(!row) return;
    row.innerHTML = '';
    const span = document.createElement('span');
    const curr = table[lvl];
    const next = table[lvl + 1];
    const unit = key==='rate' ? 'x' : (key==='staffCapacity' ? '' : 'kg');
    if(next){
      span.textContent = `${label}: ${curr[key]}${unit} → ${next[key]}${unit}`;
      const btn = document.createElement('button');
      btn.textContent = `Upgrade ($${next.cost})`;
      btn.onclick = () => window[fnName]();
      row.appendChild(span);
      row.appendChild(btn);
    } else {
      span.textContent = `${label}: ${curr[key]}${unit} (Max)`;
      row.appendChild(span);
    }
  };

  setRow('upgradeSiloRow','Silo Capacity',barge.siloUpgradeLevel,siloUpgrades,'feedCapacity','upgradeSilo');
  setRow('upgradeBlowerRow','Blower Rate',barge.blowerUpgradeLevel,blowerUpgrades,'rate','upgradeBlower');
  setRow('upgradeHousingRow','Staff Capacity',barge.housingUpgradeLevel,housingUpgrades,'staffCapacity','upgradeHousing');

  document.getElementById('bargeUpgradeModal').classList.add('visible');
}
function closeBargeUpgradeModal(){
  document.getElementById('bargeUpgradeModal').classList.remove('visible');
}

function openShipyard(){
  const list = document.getElementById('shipyardList');
  list.innerHTML = '';
  state.shipyardInventory.forEach((v, idx)=>{
    const row = document.createElement('div');
    row.className = 'shipyard-row shipyard-card';
    const icon = vesselIcons[v.class] || '🛥️';
    row.innerHTML = `
      <div class="vessel-name">${v.name}</div>
      <div class="vessel-class">${icon} ${vesselClasses[v.class].name}</div>
      <div class="shipyard-stat"><span>Capacity</span><span>${v.cargoCapacity} kg</span></div>
      <div class="shipyard-stat"><span>Speed</span><span>${v.speed}</span></div>
      <div class="shipyard-stat"><span>Slots</span><span>${v.upgradeSlots}</span></div>
      <div class="shipyard-stat price"><span>Price</span><span>$${v.cost}</span></div>`;
    const btn = document.createElement('button');
    btn.innerText = 'Buy';
    btn.onclick = ()=>buyShipyardVessel(idx);
    if(state.cash < v.cost) btn.disabled = true;
    row.appendChild(btn);
    list.appendChild(row);
  });
  document.getElementById('customBuildPage').style.display = 'none';
  document.getElementById('shipyardList').style.display = 'block';
  document.getElementById('openCustomBuildBtn').style.display = 'block';
  document.getElementById('shipyardModal').classList.add('visible');
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
}
function closeShipyard(){
  document.getElementById('shipyardModal').classList.remove('visible');
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
}

function openCustomBuild(){
  const select = document.getElementById('buildClassSelect');
  select.innerHTML = Object.entries(vesselClasses)
    .map(([cls,data])=>`<option value="${cls}">${data.name}</option>`).join('');
  select.value = Object.keys(vesselClasses)[0];
  document.getElementById('buildNameInput').value = '';
  updateCustomBuildStats();
  document.getElementById('shipyardList').style.display = 'none';
  document.getElementById('openCustomBuildBtn').style.display = 'none';
  document.getElementById('customBuildPage').style.display = 'block';
}

function backToShipyardList(){
  document.getElementById('customBuildPage').style.display = 'none';
  document.getElementById('shipyardList').style.display = 'block';
  document.getElementById('openCustomBuildBtn').style.display = 'block';
}

function updateCustomBuildStats(){
  const cls = document.getElementById('buildClassSelect').value;
  const data = vesselClasses[cls];
  const cost = Math.round(data.cost * CUSTOM_BUILD_MARKUP);
  document.getElementById('buildCost').innerText = cost;
  document.getElementById('buildStats').innerText =
    `Cap ${data.baseCapacity}kg | Speed ${data.baseSpeed} | Slots ${data.slots}`;
  const msgEl = document.getElementById('buildLockMessage');
  const req = vesselUnlockDays[cls] || 0;
  if(state.totalDaysElapsed < req && cls !== 'skiff'){
    msgEl.style.display = 'block';
    msgEl.innerText = `Locked until Day ${req}`;
  } else {
    msgEl.style.display = 'none';
    msgEl.innerText = '';
  }
}

function startOffloading(vessel, market){
  vessel.unloading = true;
  vessel.offloadRevenue = 0;
  vessel.offloadMarket = market.name;
  // offloadPrices may be pre-set when the market was chosen. If not, lock prices now.
  if(!vessel.offloadPrices){
    vessel.offloadPrices = {};
    for(const sp in vessel.cargo){
      const price = market.prices?.[sp] ?? (speciesData[sp].marketPrice * (market.modifiers[sp]||1));
      vessel.offloadPrices[sp] = price;
    }
  }
  const rate = state.OFFLOAD_RATE;
  const updateEta = ()=>{ vessel.actionEndsAt = Date.now() + (vessel.currentBiomassLoad / rate) * 1000; };
  updateEta();
  let last = Date.now();
  vessel.offloadInterval = setInterval(()=>{
    const now = Date.now();
    if(state.timePaused){ last = now; return; }
    let dt = (now - last)/1000;
    last = now;
    let remaining = rate * dt;
    while(remaining > 0 && vessel.currentBiomassLoad > 0){
      const sp = Object.keys(vessel.cargo).find(s=>vessel.cargo[s]>0);
      if(!sp) break;
      const amt = Math.min(remaining, vessel.cargo[sp]);
      vessel.cargo[sp] -= amt;
      vessel.currentBiomassLoad -= amt;
      vessel.offloadRevenue += amt * vessel.offloadPrices[sp];
      if(market.daysSinceSale) market.daysSinceSale[sp] = 0;
      if(vessel.cargo[sp] <= 0){
        delete vessel.cargo[sp];
        if(Object.keys(vessel.cargo).length===0) vessel.cargoSpecies = null;
      }
      remaining -= amt;
    }
    updateEta();
    updateDisplay();
    if(vessel.currentBiomassLoad <= 0){
      finishOffloading(vessel, market);
    }
  },250);
}

function finishOffloading(vessel, market, canceled=false){
  if(vessel.offloadInterval){ clearInterval(vessel.offloadInterval); vessel.offloadInterval = null; }
  vessel.unloading = false;
  vessel.actionEndsAt = 0;
  const earned = vessel.offloadRevenue || 0;
  const prices = vessel.offloadPrices || {};
  state.cash += earned;
  vessel.offloadRevenue = 0;
  vessel.offloadPrices = null;
  vessel.offloadMarket = null;
  if(!canceled){
    vessel.cargo = {};
    vessel.cargoSpecies = null;
    vessel.currentBiomassLoad = 0;
    if(market && market.daysSinceSale){
      for(const sp in prices){ market.daysSinceSale[sp] = 0; }
    }
  }
  const msg = canceled ? `Offloading canceled. Earned $${earned.toFixed(2)} so far.` :
                         `Sold cargo for $${earned.toFixed(2)} at ${market.name}.`;
  openModal(msg);
  updateDisplay();
}

function sellCargo(idx){
  const vessel = state.vessels[state.currentVesselIndex];
  if(vessel.isHarvesting || vessel.unloading){ closeSellModal(); return openModal('Vessel currently busy.'); }
  if(vessel.currentBiomassLoad<=0) return openModal('No biomass to sell.');
  const market = markets[idx];
  if(vessel.location === `Traveling to ${market.name}`){
    closeSellModal();
    return openModal('Vessel already en route to this market.');
  }
  // lock in prices when the market is chosen
  vessel.offloadPrices = {};
  vessel.offloadMarket = market.name;
  for(const sp in vessel.cargo){
    const price = market.prices?.[sp] ?? (speciesData[sp].marketPrice * (market.modifiers[sp]||1));
    vessel.offloadPrices[sp] = price;
  }
  vessel.offloadRevenue = 0;
  const begin = ()=>{ startOffloading(vessel, market); updateDisplay(); };
  if(vessel.location === market.name){
    closeSellModal();
    begin();
  } else {
    const startLoc = state.getLocationByName(vessel.location) || market.location;
    const dx = startLoc.x - market.location.x;
    const dy = startLoc.y - market.location.y;
    const distance = Math.hypot(dx, dy);
    const travelTime = distance / vessel.speed * state.TRAVEL_TIME_FACTOR;
    vessel.location = `Traveling to ${market.name}`;
    vessel.actionEndsAt = Date.now() + travelTime;
    closeSellModal();
    if(vessel.travelInterval){ clearInterval(vessel.travelInterval); }
    vessel.travelInterval = setInterval(()=>{
      if(state.timePaused) return;
      if(Date.now() >= vessel.actionEndsAt){
        clearInterval(vessel.travelInterval);
        vessel.travelInterval = null;
        vessel.actionEndsAt = 0;
        vessel.location = market.name;
        begin();
      }
    },250);
  }
}

function openMarketReport(){
  const container = document.getElementById('marketReportContent');
  container.innerHTML = '<h2>Market Report</h2>';

  const timestamp = document.createElement('div');
  timestamp.className = 'market-timestamp';
  const dateStr = state.lastMarketUpdateString || getDateString();
  timestamp.innerText = `Prices last updated: ${dateStr}`;
  container.appendChild(timestamp);

  markets.forEach(m => {
    const section = document.createElement('div');
    section.classList.add('market-section');

    const h = document.createElement('h3');
    h.innerText = m.name;
    section.appendChild(h);

    const table = document.createElement('table');
    table.classList.add('market-table');

    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Species</th><th>Price</th><th>Change</th><th>5-Day Trend</th><th>Last 5</th></tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for(const sp in m.prices){
      const row = document.createElement('tr');

      const nameCell = document.createElement('td');
      nameCell.innerText = state.capitalizeFirstLetter(sp);

      const price = m.prices[sp];
      const history = m.priceHistory[sp];
      const prevPrice = history[history.length - 2] || price;
      const delta = price - prevPrice;

      const recent = history.slice(-5).map(p=>p.toFixed(2)).join(', ');
      const trendDeltas = [];
      for(let i=Math.max(history.length-5,1); i<history.length; i++){
        const diff = history[i] - history[i-1];
        trendDeltas.push(diff);
      }
      const trendHtml = trendDeltas.map(d=>{
        const arrow = d > 0 ? '↑' : d < 0 ? '↓' : '→';
        const cls = d > 0 ? 'trend-up' : d < 0 ? 'trend-down' : 'trend-flat';
        return `<span class="${cls}">${d>=0?'+':''}${d.toFixed(2)}${arrow}</span>`;
      }).join(', ');
      const high = Math.max(...history.slice(-7));
      const low = Math.min(...history.slice(-7));

      const priceCell = document.createElement('td');
      priceCell.innerText = `$${price.toFixed(2)}`;
      if(price === high) priceCell.innerText += ' ▲';
      if(price === low) priceCell.innerText += ' ▼';

      const changeCell = document.createElement('td');
      const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
      changeCell.innerText = `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} ${arrow}`;
      changeCell.className = delta > 0 ? 'trend-up' : delta < 0 ? 'trend-down' : '';

      const trendCell = document.createElement('td');
      trendCell.innerHTML = trendHtml;
      trendCell.classList.add('trend-history');

      const histCell = document.createElement('td');
      histCell.innerText = recent;
      histCell.classList.add('history-cell');

      row.appendChild(nameCell);
      row.appendChild(priceCell);
      row.appendChild(changeCell);
      row.appendChild(trendCell);
      row.appendChild(histCell);
      tbody.appendChild(row);
    }

    table.appendChild(tbody);
    section.appendChild(table);

    const canvas = document.createElement('canvas');
    canvas.classList.add('market-chart');
    canvas.width = 300;
    canvas.height = 150;
    canvas.dataset.market = m.name;
    section.appendChild(canvas);

    const legend = document.createElement('div');
    legend.classList.add('market-legend');
    for(const sp in m.prices){
      const item = document.createElement('span');
      item.classList.add('legend-item');
      const colorBox = document.createElement('span');
      colorBox.classList.add('legend-color');
      colorBox.style.backgroundColor = speciesColors[sp] || '#fff';
      item.appendChild(colorBox);
      const lbl = document.createElement('span');
      lbl.innerText = state.capitalizeFirstLetter(sp);
      item.appendChild(lbl);
      legend.appendChild(item);
    }
    section.appendChild(legend);

    renderMarketChart(m, canvas);

    container.appendChild(section);
  });

  document.getElementById('marketReportPage').classList.add('visible');
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
}

function closeMarketReport(){
  document.getElementById('marketReportPage').classList.remove('visible');
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
}

function openSiteManagement(){
  const modal = document.getElementById('siteManagementModal');
  const nameEl = document.getElementById('siteManagementSiteName');
  if(nameEl) nameEl.innerText = state.sites[state.currentSiteIndex].name;
  updateSiteLicenses();
  updateLicenseShop();
  updateSiteUpgrades();
  modal.classList.add('visible');
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
}

function closeSiteManagement(){
  document.getElementById('siteManagementModal').classList.remove('visible');
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
}

function openDevModal(){
  document.getElementById('devModal').classList.add('visible');
}

function closeDevModal(){
  document.getElementById('devModal').classList.remove('visible');
}

function openSpeciesData() {
  const modal = document.getElementById('speciesDataModal');
  const tbody = modal.querySelector('tbody');
  tbody.innerHTML = '';
  Object.entries(speciesData).forEach(([name, s]) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${name}</td>
      <td>${s.fcr ?? '-'}</td>
      <td>${s.restockCount ?? '-'}</td>
      <td>${s.growthRate ?? '-'}</td>
    `;
    tbody.appendChild(row);
  });
  modal.classList.add('visible');
}

function closeSpeciesData() {
  document.getElementById('speciesDataModal').classList.remove('visible');
}

function renderLogbook(){
  const list = document.getElementById('milestoneList');
  if(!list) return;
  list.innerHTML = '';
  milestones.forEach(m => {
    const row = document.createElement('div');
    row.className = 'milestone-entry';
    const desc = document.createElement('span');
    desc.textContent = m.description;
    const status = document.createElement('span');
    status.textContent = state.milestones[m.id] ? '✅' : '❌';
    row.appendChild(desc);
    row.appendChild(status);
    list.appendChild(row);
  });
}

function openLogbook(){
  renderLogbook();
  const modal = document.getElementById('logbookModal');
  if(modal){
    modal.classList.add('visible');
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }
}

function closeLogbook(){
  const modal = document.getElementById('logbookModal');
  if(modal){
    modal.classList.remove('visible');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }
}

function updateMarketCharts(){
  const charts = document.querySelectorAll('.market-chart');
  charts.forEach(c => {
    const market = markets.find(m => m.name === c.dataset.market);
    if(market) renderMarketChart(market, c);
  });
}

function renderMarketChart(market, canvas){
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0,0,width,height);

  const species = Object.keys(market.prices);
  let values = [];
  species.forEach(sp => { values = values.concat(market.priceHistory[sp]); });
  const max = Math.max(...values);
  const min = Math.min(...values);
  const padding = 10;

  species.forEach(sp => {
    const hist = market.priceHistory[sp];
    const step = (width - padding*2) / (hist.length - 1);
    ctx.beginPath();
    ctx.strokeStyle = speciesColors[sp] || '#fff';
    ctx.lineWidth = 2;
    hist.forEach((val, idx) => {
      const x = padding + idx * step;
      const yRange = max - min || 1;
      const y = height - padding - ((val - min)/yRange)*(height - padding*2);
      if(idx===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
  });
}

// --- Feed Purchase UI ---
function updateFeedPurchaseCost(){
  const slider = document.getElementById('feedPurchaseSlider');
  if(!slider) return;
  const costEl = document.getElementById('feedPurchaseCost');
  const val = Number(slider.value) || 0;
  if(costEl) costEl.innerText = `Cost: $${(val * state.FEED_COST_PER_KG).toFixed(2)}`;
}

function syncFeedPurchase(source){
  const slider = document.getElementById('feedPurchaseSlider');
  const input = document.getElementById('feedPurchaseInput');
  if(!slider || !input) return;
  let val = source === 'slider' ? Number(slider.value) : Number(input.value);
  if(isNaN(val)) val = 0;
  if(val < 0) val = 0;
  const max = Number(slider.max || 0);
  if(val > max) val = max;
  slider.value = val;
  input.value = val;
  updateFeedPurchaseCost();
}

function updateFeedPurchaseUI(){
  const slider = document.getElementById('feedPurchaseSlider');
  const input = document.getElementById('feedPurchaseInput');
  if(!slider || !input) return;
  const site = state.sites[state.currentSiteIndex];
  const barge = site.barges[state.currentBargeIndex];
  const maxAffordable = Math.floor(state.cash / state.FEED_COST_PER_KG);
  const available = barge.feedCapacity - barge.feed;
  const max = Math.max(0, Math.min(maxAffordable, available));
  slider.max = max;
  input.max = max;
  if(Number(slider.value) > max) slider.value = max;
  if(Number(input.value) > max) input.value = max;
  updateFeedPurchaseCost();
}

function confirmBuyFeed(){
  const slider = document.getElementById('feedPurchaseSlider');
  if(!slider) return;
  const amount = Number(slider.value) || 0;
  window.buyFeed(amount);
  slider.value = 0;
  const input = document.getElementById('feedPurchaseInput');
  if(input) input.value = 0;
  updateFeedPurchaseUI();
}

function setFeedPurchaseMax(){
  const slider = document.getElementById('feedPurchaseSlider');
  const input = document.getElementById('feedPurchaseInput');
  if(!slider || !input) return;
  updateFeedPurchaseUI();
  slider.value = slider.max;
  input.value = slider.max;
  updateFeedPurchaseCost();
}

// --- Site Switcher ---
function toggleSiteList(){
  const list = document.getElementById('siteDropdownList');
  if(!list) return;
  if(list.classList.contains('visible')){
    list.classList.remove('visible');
    list.classList.add('hidden');
  } else {
    list.classList.remove('hidden');
    list.classList.add('visible');
  }
}

function selectSite(index){
  if(index < 0 || index >= state.sites.length) return;
  state.currentSiteIndex = index;
  state.currentPenIndex = 0;
  state.currentBargeIndex = 0;
  updateDisplay();
  const list = document.getElementById('siteDropdownList');
  if(list){
    list.classList.remove('visible');
    list.classList.add('hidden');
  }
}

function populateSiteList(){
  const list = document.getElementById('siteDropdownList');
  if(!list) return;
  list.innerHTML = '';
  state.sites.forEach((s, i) => {
    const item = document.createElement('div');
    item.textContent = s.name;
    if(i === state.currentSiteIndex) item.classList.add('active');
    item.onclick = () => selectSite(i);
    list.appendChild(item);
  });
}

// --- PURCHASES & ACTIONS ---
export {
  updateDisplay,
  updateLicenseShop,
  renderPenGrid,
  renderVesselGrid,
  renderMap,
  setupMapInteractions,
  openModal,
  closeModal,
  openRestockModal,
  closeRestockModal,
  openHarvestModal,
  closeHarvestModal,
  confirmHarvest,
  openSellModal,
  closeSellModal,
  sellCargo,
  startOffloading,
  finishOffloading,
  openBargeUpgradeModal,
  closeBargeUpgradeModal,
  openShipyard,
  closeShipyard,
  openCustomBuild,
  backToShipyardList,
  updateCustomBuildStats,
  openMarketReport,
  closeMarketReport,
  openSiteManagement,
  closeSiteManagement,
  updateSiteUpgrades,
  openDevModal,
  closeDevModal,
  openLogbook,
  closeLogbook,
  openSpeciesData,
  closeSpeciesData,
  updateFeedPurchaseUI,
  syncFeedPurchase,
  confirmBuyFeed,
  setFeedPurchaseMax,
  toggleSiteList,
  toggleMobileActions,
  outsideMobileActionHandler,
  toggleSiteActions,
  outsideSiteActionHandler,
  selectSite,
  populateSiteList
};
