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
  vesselTiers,
  markets
} from "./data.js";
import { Site, Barge, Pen, Vessel } from "./models.js";
import {
  cash,
  penPurchaseCost,
  currentPenIndex,
  currentSiteIndex,
  currentBargeIndex,
  currentVesselIndex,
  FEED_COST_PER_KG,
  AUTO_SAVE_INTERVAL_MS,
  TRAVEL_TIME_FACTOR,
  sites,
  vessels,
  timePaused,
  lastOfflineInfo,
  addStatusMessage,
  getSiteHarvestCapacity
} from "./gameState.js";
import {
  updateDisplay,
  openModal,
  closeModal,
  setupMapInteractions
} from "./ui.js";

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

function harvestWithVessel(vIndex, amount){
  const vessel = vessels[vIndex];
  const site = sites[currentSiteIndex];
  let remaining = Math.min(
    amount,
    vessel.maxBiomassCapacity - vessel.currentBiomassLoad,
    getSiteHarvestCapacity(site)
  );
  if(remaining<=0) return openModal('Vessel capacity full.');
  let species = vessel.currentBiomassLoad>0 ? Object.keys(vessel.cargo)[0] : null;
  const perform = ()=>{
    let harvested = 0;
    for(const pen of site.pens){
      if(remaining<=0) break;
      if(pen.fishCount===0) continue;
      if(species && pen.species!==species) continue;
      if(!species) species = pen.species;
      const penBiomass = pen.fishCount * pen.averageWeight;
      let take = Math.min(penBiomass, remaining);
      let fishNum = Math.floor((take + pen.averageWeight * 0.0001)/pen.averageWeight);
      if(fishNum===0 && take>0) fishNum = 1;
      fishNum = Math.min(fishNum, pen.fishCount);
      const biomass = fishNum * pen.averageWeight;
      pen.fishCount -= fishNum;
      if(pen.fishCount===0) pen.averageWeight = 0;
      vessel.currentBiomassLoad += biomass;
      if(!vessel.cargo[species]) vessel.cargo[species]=0;
      vessel.cargo[species]+=biomass;
      harvested += biomass;
      remaining -= biomass;
    }
    vessel.location = site.name;
    openModal(`Harvested ${harvested.toFixed(2)} kg loaded onto ${vessel.name}.`);
    updateDisplay();
  };
  if(vessel.location !== site.name){
    const startLoc = getLocationByName(vessel.location) || site.location;
    const dx = startLoc.x - site.location.x;
    const dy = startLoc.y - site.location.y;
    const distance = Math.hypot(dx, dy);
    vessel.location = `Traveling to ${site.name}`;
    setTimeout(()=>{ vessel.location = site.name; perform(); }, distance / vessel.speed * TRAVEL_TIME_FACTOR);
  } else {
    perform();
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



export { buyFeed, buyMaxFeed, buyFeedStorageUpgrade, buyLicense, buyNewSite, buyNewPen, buyNewBarge, hireStaff, fireStaff, assignStaff, unassignStaff, upgradeStaffHousing, upgradeBarge, addDevCash, togglePanel, openModal, closeModal, openRestockModal, closeRestockModal, openHarvestModal, closeHarvestModal, confirmHarvest, openVesselHarvestModal, closeVesselHarvestModal, confirmVesselHarvest, feedFishPen, harvestPenIndex, harvestWithVessel, restockPenUI, upgradeFeeder, assignBarge, openSellModal, closeSellModal, sellCargo, toggleSection, saveGame, resetGame, previousSite, nextSite, previousBarge, nextBarge, previousVessel, nextVessel, upgradeVessel, buyNewVessel, renameVessel, openMoveVesselModal, closeMoveModal, moveVesselTo, showTab, updateSelectedBargeDisplay, getTimeState  };
