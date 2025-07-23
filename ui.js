import {
  bargeTiers,
  NEW_BARGE_COST,
  NEW_VESSEL_COST,
  feedStorageUpgrades,
  staffHousingUpgrades,
  speciesData,
  feederUpgrades,
  vesselTiers,
  markets
} from "./data.js";
import state, {
  capitalizeFirstLetter,
  getDateString,
  estimateSellPrice,
  estimateTravelTime,
  getSiteHarvestRate,
} from "./gameState.js";

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
  document.getElementById('cashCount').innerText = state.cash.toFixed(2);
  const dateEl = document.getElementById('dateDisplay');
  if(dateEl) dateEl.innerText = getDateString();

  // barge card & feed overview
  const barge = site.barges[state.currentBargeIndex];
  const tierData = bargeTiers[barge.tier];
  document.getElementById('bargeIndex').innerText = state.currentBargeIndex + 1;
  document.getElementById('bargeCount').innerText = site.barges.length;
  document.getElementById('bargeTierName').innerText   = tierData.name;
  document.getElementById('bargeFeedersUsed').innerText = site.pens.filter(p=>p.feeder && p.bargeIndex===state.currentBargeIndex).length;
  document.getElementById('bargeFeederLimit').innerText = tierData.feederLimit;
  document.getElementById('bargeMaxFeederTier').innerText = tierData.maxFeederTier;
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
  document.getElementById('penPurchaseInfo').innerText = `Next Pen Purchase: $${state.penPurchaseCost.toFixed(0)}`;

  updateHarvestInfo();
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
  const statusEl = document.getElementById('statusMessages');
  if(statusEl) statusEl.innerText = state.statusMessage;
  const tipsEl = document.getElementById('operationalTips');
  if(tipsEl) tipsEl.innerText = state.statusMessage || 'All systems nominal.';
}

// harvest preview
function updateHarvestInfo(){
  const site = state.sites[state.currentSiteIndex];
  const pen  = site.pens[state.currentPenIndex];
  const infoDiv = document.getElementById('harvestInfo');
  if(pen.fishCount>0){
    const vessel = state.vessels[state.currentVesselIndex];
    if(vessel.currentBiomassLoad>0 && vessel.cargoSpecies && vessel.cargoSpecies !== pen.species){
      infoDiv.innerText = 'Vessel carrying other species.';
      return;
    }
    const remaining = vessel.maxBiomassCapacity - vessel.currentBiomassLoad;
    const totalBiomass = pen.fishCount * pen.averageWeight;
    const harvestableBiomass = Math.min(totalBiomass, remaining);
    const rate = getSiteHarvestRate(site);
    const secs  = harvestableBiomass / rate;
    infoDiv.innerText = `Harvest up to ${harvestableBiomass.toFixed(2)} kg (~${secs.toFixed(1)}s, vessel capacity ${remaining.toFixed(2)} kg)`;
  } else {
    infoDiv.innerText = "No fish to harvest.";
  }
}

// license shop
function updateLicenseShop(){
  const licenseDiv = document.getElementById('licenseShop');
  const site = state.sites[state.currentSiteIndex];
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
  });
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
    let status = vessel.isHarvesting ? 'Harvesting' : (vessel.location.startsWith('Traveling') ? 'Traveling' : 'Idle');
    if(vessel.actionEndsAt && vessel.actionEndsAt > Date.now()){
      const eta = Math.max(0, (vessel.actionEndsAt - Date.now())/1000);
      status += ` (${eta.toFixed(0)}s)`;
    }
    statusEl.textContent = status;
    const loadPercent = vessel.maxBiomassCapacity ? (vessel.currentBiomassLoad / vessel.maxBiomassCapacity)*100 : 0;
    card.querySelector('.vessel-progress').style.width = loadPercent + '%';
    card.querySelector('.vessel-load').textContent = vessel.currentBiomassLoad.toFixed(1);
    card.querySelector('.vessel-capacity').textContent = vessel.maxBiomassCapacity;
    card.querySelector('.harvest-btn').onclick = ()=>{ openVesselHarvestModal(idx); };
    card.querySelector('.move-btn').onclick = ()=>{ state.currentVesselIndex = idx; openMoveVesselModal(); };
    card.querySelector('.sell-btn').onclick = ()=>{ state.currentVesselIndex = idx; openSellModal(); };
    card.querySelector('.upgrade-btn').onclick = ()=>{ state.currentVesselIndex = idx; upgradeVessel(); };
    card.querySelector('.cancel-btn').onclick = ()=>{ state.currentVesselIndex = idx; cancelVesselHarvest(idx); };
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
    let status = vessel.isHarvesting ? 'Harvesting' : (vessel.location.startsWith('Traveling') ? 'Traveling' : 'Idle');
    if(vessel.actionEndsAt && vessel.actionEndsAt > Date.now()){
      const eta = Math.max(0, (vessel.actionEndsAt - Date.now())/1000);
      status += ` (${eta.toFixed(0)}s)`;
    }
    statusEl.textContent = status;
    const loadPercent = vessel.maxBiomassCapacity ? (vessel.currentBiomassLoad / vessel.maxBiomassCapacity)*100 : 0;
    card.querySelector('.vessel-progress').style.width = loadPercent + '%';
    card.querySelector('.vessel-load').textContent = vessel.currentBiomassLoad.toFixed(1);
    card.querySelector('.vessel-capacity').textContent = vessel.maxBiomassCapacity;
    card.querySelector('.harvest-btn').onclick = ()=>{ openVesselHarvestModal(idx); };
    card.querySelector('.cancel-btn').onclick = ()=>{ state.currentVesselIndex = idx; cancelVesselHarvest(idx); };
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
function openModal(msg){ document.getElementById('modalText').innerText=msg; document.getElementById('modal').classList.add('visible'); }
function closeModal(){ document.getElementById('modal').classList.remove('visible'); }
function openRestockModal(){
  const site = state.sites[state.currentSiteIndex];
  const pen  = site.pens[state.currentPenIndex];
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
  state.currentPenIndex = i;
  const site = state.sites[state.currentSiteIndex];
  const pen  = site.pens[state.currentPenIndex];
  const vessel = state.vessels[state.currentVesselIndex];
  if(vessel.isHarvesting) return openModal('Vessel currently harvesting.');
  if(vessel.currentBiomassLoad>0 && vessel.cargoSpecies && vessel.cargoSpecies !== pen.species){
    return openModal('Vessel already contains a different species.');
  }
  const remaining = vessel.maxBiomassCapacity - vessel.currentBiomassLoad;
  const maxHarvest = Math.min(
    pen.fishCount * pen.averageWeight,
    remaining
  );
  const rate = getSiteHarvestRate(site);
  const secs = maxHarvest / rate;
  document.getElementById('harvestMax').innerText = maxHarvest.toFixed(2);
  const input = document.getElementById('harvestAmount');
  input.max = maxHarvest;
  input.value = maxHarvest.toFixed(3);
  document.getElementById('harvestModalContent').querySelector('h2').innerText =
    `Select Biomass to Harvest (~${secs.toFixed(1)}s)`;
  document.getElementById('harvestModal').classList.add('visible');
}
function closeHarvestModal(){ document.getElementById('harvestModal').classList.remove('visible'); }
function confirmHarvest(){
  const amount = parseFloat(document.getElementById('harvestAmount').value);
  harvestPen(amount);
  closeHarvestModal();
  updateDisplay();
}

function updateVesselHarvestModal(){
  const site = state.sites[state.currentSiteIndex];
  const vessel = state.vessels[state.currentVesselIndex];
  const select = document.getElementById('vesselHarvestPenSelect');
  if(!select) return;
  const penIndex = Number(select.value);
  state.currentPenIndex = penIndex;
  const pen = site.pens[penIndex];
  const remaining = vessel.maxBiomassCapacity - vessel.currentBiomassLoad;
  const available = pen.fishCount * pen.averageWeight;
  const maxHarvest = Math.min(available, remaining);
  const amountInput = document.getElementById('vesselHarvestAmount');
  if(amountInput){
    amountInput.max = maxHarvest;
    if(!amountInput.value || parseFloat(amountInput.value) > maxHarvest){
      amountInput.value = maxHarvest.toFixed(3);
    }
  }
  document.getElementById('vesselHarvestMax').innerText = maxHarvest.toFixed(2);
  const amount = parseFloat(amountInput.value);
  const rate = getSiteHarvestRate(site);
  const secs = amount / rate;
  const etaEl = document.getElementById('vesselHarvestEta');
  if(etaEl) etaEl.innerText = `ETA: ${secs.toFixed(1)}s`;
  const loadEl = document.getElementById('vesselHarvestLoad');
  if(loadEl) loadEl.innerText = `Load after harvest: ${(vessel.currentBiomassLoad + amount).toFixed(1)} / ${vessel.maxBiomassCapacity} kg`;
}

function openVesselHarvestModal(vIdx){
  state.currentVesselIndex = vIdx;
  const vessel = state.vessels[vIdx];
  if(vessel.isHarvesting) return openModal('Vessel currently harvesting.');
  const site = state.sites[state.currentSiteIndex];
  const select = document.getElementById('vesselHarvestPenSelect');
  select.innerHTML = '';
  site.pens.forEach((pen,i)=>{
    if(pen.fishCount<=0) return;
    if(vessel.cargoSpecies && vessel.cargoSpecies !== pen.species) return;
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `Pen ${i+1} (${pen.species})`;
    select.appendChild(opt);
  });
  if(select.options.length===0) return openModal('No valid pens to harvest.');
  select.value = select.options[0].value;
  document.getElementById('vesselHarvestAmount').value = 0;
  select.onchange = updateVesselHarvestModal;
  document.getElementById('vesselHarvestAmount').oninput = updateVesselHarvestModal;
  updateVesselHarvestModal();
  document.getElementById('vesselHarvestModal').classList.add('visible');
}
function closeVesselHarvestModal(){ document.getElementById('vesselHarvestModal').classList.remove('visible'); }
function confirmVesselHarvest(){
  const amount = parseFloat(document.getElementById('vesselHarvestAmount').value);
  harvestPen(amount);
  closeVesselHarvestModal();
  updateDisplay();
}


function openSellModal(){
  const optionsDiv = document.getElementById('sellOptions');
  optionsDiv.innerHTML = '';
  const vessel = state.vessels[state.currentVesselIndex];
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
  const vessel = state.vessels[state.currentVesselIndex];
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
    state.cash += total;
    vessel.currentBiomassLoad = 0;
    vessel.cargo = {};
    vessel.cargoSpecies = null;
    vessel.location = market.name;
    openModal(`Sold cargo for $${total.toFixed(2)} at ${market.name}.`);
    updateDisplay();
  };
  if(vessel.location === market.name){
    closeSellModal();
    completeSale();
  } else {
    const startLoc = state.getLocationByName(vessel.location) || market.location;
    const dx = startLoc.x - market.location.x;
    const dy = startLoc.y - market.location.y;
    const distance = Math.hypot(dx, dy);
    const travelTime = distance / vessel.speed * state.TRAVEL_TIME_FACTOR;
    vessel.location = `Traveling to ${market.name}`;
    vessel.actionEndsAt = Date.now() + travelTime;
    closeSellModal();
    setTimeout(()=>{
      vessel.actionEndsAt = 0;
      completeSale();
    }, travelTime);
  }
}

// --- PURCHASES & ACTIONS ---
export {
  updateDisplay,
  updateHarvestInfo,
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
  openVesselHarvestModal,
  closeVesselHarvestModal,
  confirmVesselHarvest,
  updateVesselHarvestModal,
  openSellModal,
  closeSellModal,
  sellCargo
};
