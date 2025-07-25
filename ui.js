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

const PLAY_ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBvbHlnb24gcG9pbnRzPSI4LDUgMTksMTIgOCwxOSIvPjwvc3ZnPg==';
const PAUSE_ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3QgeD0iNiIgeT0iNSIgd2lkdGg9IjQiIGhlaWdodD0iMTQiLz48cmVjdCB4PSIxNCIgeT0iNSIgd2lkdGg9IjQiIGhlaWdodD0iMTQiLz48L3N2Zz4=';

// --- UPDATE UI ---
function updateDisplay(){
  const site = state.sites[state.currentSiteIndex];
  const pen  = site.pens[state.currentPenIndex];

  // top-bar
  document.getElementById('siteName').innerText = site.name;
  document.getElementById('cashCount').innerText = state.cash.toFixed(2);
  const dateEl = document.getElementById('dateDisplay');
  if(dateEl) dateEl.innerText = getDateString();

  // barge card
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

  // vessel card
  const vessel = state.vessels[state.currentVesselIndex];
  const vesselTier = vesselTiers[vessel.tier];
  document.getElementById('vesselIndex').innerText = state.currentVesselIndex + 1;
  document.getElementById('vesselCount').innerText = state.vessels.length;
  document.getElementById('vesselName').innerText = vessel.name;
  document.getElementById('vesselTierName').innerText = vesselTier.name;
  document.getElementById('vesselLoad').innerText = vessel.currentBiomassLoad.toFixed(1);
  document.getElementById('vesselCapacity').innerText = vessel.maxBiomassCapacity;
  document.getElementById('vesselSpeed').innerText = vessel.speed;
  document.getElementById('vesselLocation').innerText = vessel.location;
  const priceEl = document.getElementById('vesselPrice');
  if(priceEl) priceEl.innerText = `$${NEW_VESSEL_COST}`;
  const vesselHarvestBtn = document.getElementById('vesselHarvestBtn');
  if(vesselHarvestBtn) vesselHarvestBtn.disabled = vessel.isHarvesting;
  if(vessel.tier < vesselTiers.length - 1){
    const nextVessel = vesselTiers[vessel.tier + 1];
    document.getElementById('vesselUpgradeInfo').innerText =
      `Next Vessel Upgrade (${nextVessel.name}): $${nextVessel.cost}`;
  } else {
    document.getElementById('vesselUpgradeInfo').innerText = 'Vessel Fully Upgraded';
  }

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
  renderPenGrid(site);
  renderMap();
  const statusEl = document.getElementById('statusMessages');
  if(statusEl) statusEl.innerText = state.statusMessage;
  const timeToggle = document.getElementById('timeToggle');
  const icon = document.getElementById('timeToggleIcon');
  if(timeToggle && icon){
    if(state.timePaused){
      timeToggle.classList.add('paused');
      icon.src = PLAY_ICON;
    } else {
      timeToggle.classList.remove('paused');
      icon.src = PAUSE_ICON;
    }
  }
}

// harvest preview
function updateHarvestInfo(){
  const site = state.sites[state.currentSiteIndex];
  const pen  = site.pens[state.currentPenIndex];
  const infoDiv = document.getElementById('harvestInfo');
  if(pen.fishCount>0){
    const vessel = state.vessels[state.currentVesselIndex];
    if(vessel.currentBiomassLoad>0 && !vessel.cargo[pen.species]){
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
      <button onclick="harvestPenIndex(${idx})" ${state.vessels[state.currentVesselIndex].isHarvesting?'disabled':''}>Harvest</button>
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
  if(vessel.currentBiomassLoad>0 && !vessel.cargo[pen.species]){
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

function openVesselHarvestModal(){
  const site = state.sites[state.currentSiteIndex];
  const vessel = state.vessels[state.currentVesselIndex];
  if(vessel.isHarvesting) return openModal('Vessel currently harvesting.');
  let species = vessel.currentBiomassLoad>0 ? Object.keys(vessel.cargo)[0] : null;
  let available = 0;
  site.pens.forEach(pen=>{
    if(pen.fishCount===0) return;
    if(species && pen.species!==species) return;
    if(!species) species = pen.species;
    if(pen.species===species) available += pen.fishCount * pen.averageWeight;
  });
  const remaining = vessel.maxBiomassCapacity - vessel.currentBiomassLoad;
  const maxHarvest = Math.min(remaining, available);
  const rate = getSiteHarvestRate(site);
  const secs = maxHarvest / rate;
  if(maxHarvest<=0) return openModal('No biomass available.');
  document.getElementById('vesselHarvestMax').innerText = maxHarvest.toFixed(2);
  const input = document.getElementById('vesselHarvestAmount');
  input.max = maxHarvest;
  input.value = maxHarvest.toFixed(3);
  document.getElementById('vesselHarvestModalContent').querySelector('h2').innerText =
    `Select Biomass to Harvest (~${secs.toFixed(1)}s)`;
  document.getElementById('vesselHarvestModal').classList.add('visible');
}
function closeVesselHarvestModal(){
  document.getElementById('vesselHarvestModal').classList.remove('visible');
}
function confirmVesselHarvest(){
  const amount = parseFloat(document.getElementById('vesselHarvestAmount').value);
  harvestWithVessel(state.currentVesselIndex, amount);
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

function openCustomBuild(){
  // Placeholder for shipyard custom build interface
  openModal('Custom build feature coming soon!');
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
    vessel.location = `Traveling to ${market.name}`;
    closeSellModal();
    setTimeout(completeSale, distance / vessel.speed * state.TRAVEL_TIME_FACTOR);
  }
}

// --- PURCHASES & ACTIONS ---
export {
  updateDisplay,
  updateHarvestInfo,
  updateLicenseShop,
  renderPenGrid,
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
  openSellModal,
  closeSellModal,
  openCustomBuild,
  sellCargo
};
