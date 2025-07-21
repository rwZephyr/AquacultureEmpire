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
import state, { getTimeState, addStatusMessage, advanceDays } from "./gameState.js";

const OFFLINE_STEP_SECONDS = 60; // simulation granularity for offline progress
import {
  updateDisplay,
  openModal,
  closeModal,
  setupMapInteractions,
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
  sellCargo
} from "./ui.js";

function buyFeed(amount=20){
  const site = state.sites[state.currentSiteIndex];
  const barge = site.barges[state.currentBargeIndex];
  amount = Math.max(0, amount);
  const cost = amount * state.FEED_COST_PER_KG;
  if(state.cash < cost) return openModal("Not enough cash to buy feed.");
  if(barge.feed + amount > barge.feedCapacity)
    return openModal("Not enough feed storage space!");
  state.cash -= cost;
  barge.feed += amount;
  updateDisplay();
}

function buyMaxFeed(){
  const site = state.sites[state.currentSiteIndex];
  const barge = site.barges[state.currentBargeIndex];
  const maxAffordable = Math.floor(state.cash / state.FEED_COST_PER_KG);
  const available = barge.feedCapacity - barge.feed;
  const qty = Math.min(maxAffordable, available);
  if(qty <= 0) return openModal("Cannot purchase feed right now.");
  buyFeed(qty);
}
function buyFeedStorageUpgrade(){
  const site = state.sites[state.currentSiteIndex];
  const barge = site.barges[state.currentBargeIndex];
  if(barge.storageUpgradeLevel>=feedStorageUpgrades.length) return openModal("Max feed storage reached!");
  const up = feedStorageUpgrades[barge.storageUpgradeLevel];
  if(state.cash<up.cost) return openModal("Not enough cash to upgrade feed storage!");
  state.cash-=up.cost; barge.feedCapacity=up.capacity;
  barge.storageUpgradeLevel++; updateDisplay();
}
function buyLicense(sp){
  const site = state.sites[state.currentSiteIndex];
  const cost = speciesData[sp].licenseCost;
  if(state.cash<cost) return openModal("Not enough cash to buy license.");
  state.cash-=cost; site.licenses.push(sp); updateDisplay();
}
function buyNewSite(){
  if(state.cash<20000) return openModal("Not enough cash to buy a new site!");
  state.cash-=20000;
  state.sites.push(new Site({
    name: state.generateRandomSiteName(),
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
function buyNewPen(bargeIdx = state.currentBargeIndex){
  const site = state.sites[state.currentSiteIndex];
  if(state.cash < state.penPurchaseCost) return openModal("Not enough cash to buy a new pen!");
  if(bargeIdx < 0 || bargeIdx >= site.barges.length) return openModal("Invalid barge selected.");
  state.cash -= state.penPurchaseCost;
  site.pens.push({ species:"shrimp", fishCount:0, averageWeight:0, bargeIndex: Number(bargeIdx) });
  state.penPurchaseCost *= 1.5;
  updateDisplay();
}

function buyNewBarge(){
  const site = state.sites[state.currentSiteIndex];
  if(state.cash < NEW_BARGE_COST) return openModal("Not enough cash to buy a new barge!");
  state.cash -= NEW_BARGE_COST;
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
  state.currentBargeIndex = site.barges.length-1;
  updateDisplay();
  openModal("New barge purchased!");
}
function hireStaff(){
  const site = state.sites[state.currentSiteIndex];
  const capacity = site.barges.reduce((t,b)=>t+b.staffCapacity,0);
  if(site.staff.length >= capacity)
    return openModal("No staff housing available.");
  if(state.cash < STAFF_HIRE_COST) return openModal("Not enough cash to hire staff.");
  state.cash -= STAFF_HIRE_COST;
  site.staff.push({ role: null });
  updateDisplay();
}
function fireStaff(role=null){
  const site = state.sites[state.currentSiteIndex];
  const idx = site.staff.findIndex(s => role ? s.role===role : !s.role);
  if(idx === -1) return openModal("No staff member available to fire.");
  site.staff.splice(idx,1);
  updateDisplay();
}
function assignStaff(role){
  const site = state.sites[state.currentSiteIndex];
  const member = site.staff.find(s=>!s.role);
  if(!member) return openModal("No unassigned staff available.");
  if(!staffRoles[role]) return;
  member.role = role;
  updateDisplay();
}
function unassignStaff(role){
  const site = state.sites[state.currentSiteIndex];
  const member = site.staff.find(s=>s.role===role);
  if(!member) return openModal(`No staff assigned as ${role}.`);
  member.role = null;
  updateDisplay();
}
function upgradeStaffHousing(){
  const site = state.sites[state.currentSiteIndex];
  const barge = site.barges[state.currentBargeIndex];
  if(barge.housingUpgradeLevel >= staffHousingUpgrades.length)
    return openModal("Staff housing fully upgraded!");
  const up = staffHousingUpgrades[barge.housingUpgradeLevel];
  if(state.cash < up.cost) return openModal("Not enough cash to upgrade housing.");
  state.cash -= up.cost;
  barge.staffCapacity += up.extraCapacity;
  barge.housingUpgradeLevel++;
  updateDisplay();
}

function upgradeBarge(){
  const site = state.sites[state.currentSiteIndex];
  const barge = site.barges[state.currentBargeIndex];
  const currentTier = barge.tier;
  if(currentTier >= bargeTiers.length - 1)
    return openModal("Barge already at max tier.");
  const next = bargeTiers[currentTier + 1];
  if(state.cash < next.cost) return openModal("Not enough cash to upgrade barge.");
  state.cash -= next.cost;
  barge.tier++;
  barge.feedCapacity = Math.max(barge.feedCapacity, next.feedCapacity);
  barge.feederLimit = next.feederLimit;
  barge.maxFeederTier = next.maxFeederTier;
  openModal(`Barge upgraded to ${next.name}!`);
  updateDisplay();
}

function upgradeVessel(){
  const vessel = state.vessels[state.currentVesselIndex];
  const currentTier = vessel.tier;
  if(currentTier >= vesselTiers.length - 1)
    return openModal("Vessel already at max tier.");
  const next = vesselTiers[currentTier + 1];
  if(state.cash < next.cost) return openModal("Not enough cash to upgrade vessel.");
  state.cash -= next.cost;
  vessel.tier++;
  vessel.maxBiomassCapacity = Math.max(vessel.maxBiomassCapacity, next.maxBiomassCapacity);
  vessel.speed = next.speed;
  openModal(`Vessel upgraded to ${next.name} tier!`);
  updateDisplay();
}

function buyNewVessel(){
  if(state.cash < NEW_VESSEL_COST) return openModal("Not enough cash to buy a new vessel!");
  state.cash -= NEW_VESSEL_COST;
  state.vessels.push(new Vessel({
    name: `Vessel ${state.vessels.length + 1}`,
    maxBiomassCapacity: vesselTiers[0].maxBiomassCapacity,
    currentBiomassLoad: 0,
    speed: vesselTiers[0].speed,
    location: 'Dock',
    tier: 0,
    cargo: {}
  }));
  state.currentVesselIndex = state.vessels.length - 1;
  updateDisplay();
  openModal('New vessel purchased!');
}

function renameVessel(){
  const vessel = state.vessels[state.currentVesselIndex];
  const newName = prompt('Enter vessel name:', vessel.name);
  if(newName){
    vessel.name = newName.trim();
    updateDisplay();
  }
}

function openMoveVesselModal(){
  const optionsDiv = document.getElementById('moveOptions');
  optionsDiv.innerHTML = '';
  const vessel = state.vessels[state.currentVesselIndex];
  state.sites.forEach((s, idx)=>{
    const btn = document.createElement('button');
    const secs = state.estimateTravelTime(vessel.location, s.location, vessel);
    btn.innerText = `${s.name} (${secs.toFixed(1)}s)`;
    btn.onclick = ()=>moveVesselTo('site', idx);
    optionsDiv.appendChild(btn);
  });
  markets.forEach((m, idx)=>{
    const btn = document.createElement('button');
    const secs = state.estimateTravelTime(vessel.location, m.location, vessel);
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
  const vessel = state.vessels[state.currentVesselIndex];
  let destName;
  let destLoc;
  if(type==='site'){
    const site = state.sites[idx];
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
  const startLoc = state.getLocationByName(vessel.location) || state.sites[state.currentSiteIndex].location;
  const dx = startLoc.x - destLoc.x;
  const dy = startLoc.y - destLoc.y;
  const distance = Math.hypot(dx, dy);
  vessel.location = `Traveling to ${destName}`;
  closeMoveModal();
  setTimeout(()=>{
    vessel.location = destName;
    updateDisplay();
  }, distance / vessel.speed * state.TRAVEL_TIME_FACTOR);
}

// feed / harvest / restock
function feedFish(){
  const site = state.sites[state.currentSiteIndex];
  const pen  = site.pens[state.currentPenIndex];
  const barge = site.barges[pen.bargeIndex];
  if(barge.feed<1 || pen.fishCount===0) return;
  barge.feed--;
  const gain = 1 / speciesData[pen.species].fcr;
  pen.averageWeight += gain/pen.fishCount;
}
function harvestPen(amount=null){
  const site = state.sites[state.currentSiteIndex];
  const pen  = site.pens[state.currentPenIndex];
  const vessel = state.vessels[state.currentVesselIndex];
  if(pen.fishCount===0) return;
  if(vessel.currentBiomassLoad>0 && !vessel.cargo[pen.species]){
    return openModal('Vessel already contains a different species.');
  }
  const totalBiomass = pen.fishCount * pen.averageWeight;
  const maxHarvest = Math.min(
    state.getSiteHarvestCapacity(site),
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
    const startLoc = state.getLocationByName(vessel.location) || site.location;
    const dx = startLoc.x - site.location.x;
    const dy = startLoc.y - site.location.y;
    const distance = Math.hypot(dx, dy);
    vessel.location = `Traveling to ${site.name}`;
    setTimeout(()=>{
      vessel.location = site.name;
      performHarvest();
    }, distance / vessel.speed * state.TRAVEL_TIME_FACTOR);
  } else {
    performHarvest();
  }
}

function harvestWithVessel(vIndex, amount){
  const vessel = state.vessels[vIndex];
  const site = state.sites[state.currentSiteIndex];
  let remaining = Math.min(
    amount,
    vessel.maxBiomassCapacity - vessel.currentBiomassLoad,
    state.getSiteHarvestCapacity(site)
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
    const startLoc = state.getLocationByName(vessel.location) || site.location;
    const dx = startLoc.x - site.location.x;
    const dy = startLoc.y - site.location.y;
    const distance = Math.hypot(dx, dy);
    vessel.location = `Traveling to ${site.name}`;
    setTimeout(()=>{ vessel.location = site.name; perform(); }, distance / vessel.speed * state.TRAVEL_TIME_FACTOR);
  } else {
    perform();
  }
}
function restockPen(sp){
  const site = state.sites[state.currentSiteIndex];
  const pen  = site.pens[state.currentPenIndex];
  const data = speciesData[sp];
  if(state.cash < data.restockCost) return openModal("Not enough cash to restock.");
  state.cash -= data.restockCost;
  pen.species = sp;
  pen.fishCount = data.restockCount;
  pen.averageWeight = data.startingWeight;
  closeRestockModal();
}
// dev menu
function addDevCash() {
  state.cash += 100000;
  updateDisplay();
}

// sidebar nav
function togglePanel(id){
  const p = document.getElementById(id);
  if(p) p.classList.toggle('visible');
}
const toggleSidebarBtn = document.getElementById('toggleSidebar');
if(toggleSidebarBtn){
  toggleSidebarBtn.addEventListener('click', () => {
    const sb = document.getElementById('sidebar');
    const container = document.querySelector('.container');
    if(!sb) return;
    sb.classList.toggle('open');
    if(sb.classList.contains('open')){
      container.classList.add('shifted');
    } else {
      container.classList.remove('shifted');
      document.querySelectorAll('#sidebar .panel').forEach(x=>x.classList.remove('visible'));
      document.querySelectorAll('#sidebarContent button').forEach(x=>x.classList.remove('active'));
    }
  });
}

function toggleSection(id){
  const el = document.getElementById(id);
  if(el) el.classList.toggle('visible');
}

function closeSidebar(){
  const sb = document.getElementById('sidebar');
  const container = document.querySelector('.container');
  if(sb) sb.classList.remove('open');
  if(container) container.classList.remove('shifted');
  document.querySelectorAll('#sidebar .panel').forEach(x=>x.classList.remove('visible'));
  document.querySelectorAll('#sidebarContent button').forEach(x=>x.classList.remove('active'));
}

function showTab(tab){
  // Tab navigation removed in new layout
}

// pen buttons helper
function feedFishPen(i){ state.currentPenIndex=i; feedFish(); updateDisplay(); }
function harvestPenIndex(i){ openHarvestModal(i); }
function restockPenUI(i){ state.currentPenIndex=i; openRestockModal(); }
function upgradeFeeder(i){
  const site = state.sites[state.currentSiteIndex];
  const pen = site.pens[i];
  const currentTier = pen.feeder?.tier || 0;
  if(currentTier >= feederUpgrades.length) return openModal("Feeder already at max tier.");
  const nextTier = currentTier + 1;
  const barge = site.barges[pen.bargeIndex];
  if(nextTier > barge.maxFeederTier) return openModal("Barge tier too low for this feeder upgrade.");
  if(!pen.feeder && site.pens.filter(p=>p.feeder && p.bargeIndex===pen.bargeIndex).length >= barge.feederLimit)
    return openModal("Barge cannot support more feeders.");
  const up = feederUpgrades[currentTier];
  if(state.cash < up.cost) return openModal("Not enough cash for upgrade.");
  state.cash -= up.cost;
  pen.feeder = { type: up.type, tier: nextTier };
  openModal(`Feeder upgraded to ${state.capitalizeFirstLetter(up.type)} (Tier ${nextTier}).`);
  updateDisplay();
}

function assignBarge(penIdx, bargeIdx){
  const site = state.sites[state.currentSiteIndex];
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
  state.sites.forEach(site=>{
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
  state.sites.forEach(site=>{
    if(!site.staff.some(s=>s.role==='feedManager')) return;
    site.barges.forEach(barge=>{
      if(barge.feed/barge.feedCapacity < state.FEED_THRESHOLD_PERCENT){
        const maxAffordable = Math.floor(state.cash / state.FEED_COST_PER_KG);
        const available = barge.feedCapacity - barge.feed;
        const qty = Math.min(maxAffordable, available);
        if(qty > 0){
          state.cash -= qty * state.FEED_COST_PER_KG;
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
  state.sites.forEach(site=>{
    if(!site.staff.some(s=>s.role==='feedManager')) return;
    site.barges.forEach(barge=>{
      if(barge.feed/barge.feedCapacity < state.FEED_THRESHOLD_PERCENT){
        const maxAffordable = Math.floor(state.cash / state.FEED_COST_PER_KG);
        const available = barge.feedCapacity - barge.feed;
        const qty = Math.min(maxAffordable, available);
        if(qty>0){
          state.cash -= qty * state.FEED_COST_PER_KG;
          barge.feed += qty;
        }
      }
    });
  });
}

// Run simplified game ticks to account for offline progress
function simulateOfflineProgress(ms){
  const totalSeconds = Math.floor(ms / 1000);
  const daySeconds = state.DAY_DURATION_MS / 1000;
  let feedUsed = 0;

  for(let elapsed = 0; elapsed < totalSeconds; elapsed += OFFLINE_STEP_SECONDS){
    const dt = Math.min(OFFLINE_STEP_SECONDS, totalSeconds - elapsed);

    state.sites.forEach(site => {
      const staffRate = getStaffFeedRate(site);
      site.barges.forEach((barge, bIdx) => {
        let activeFeeders = 0;
        site.pens.forEach(pen => {
          if(pen.bargeIndex !== bIdx) return;
          let rate = staffRate;
          const fr = getFeederRate(pen.feeder);
          if(fr > 0 && activeFeeders < barge.feederLimit){
            rate += fr;
            activeFeeders++;
          }
          const need = rate * dt;
          const used = Math.min(need, barge.feed);
          barge.feed -= used;
          feedUsed += used;
          if(used > 0 && pen.fishCount > 0){
            const gain = used / speciesData[pen.species].fcr / pen.fishCount;
            pen.averageWeight += gain;
          }
        });

        if(site.staff.some(s => s.role === 'feedManager')){
          if(barge.feed / barge.feedCapacity < state.FEED_THRESHOLD_PERCENT){
            const maxAffordable = Math.floor(state.cash / state.FEED_COST_PER_KG);
            const available = barge.feedCapacity - barge.feed;
            const qty = Math.min(maxAffordable, available);
            if(qty > 0){
              state.cash -= qty * state.FEED_COST_PER_KG;
              barge.feed += qty;
            }
          }
        }
      });
    });
  }

  const daysPassed = Math.floor(totalSeconds / daySeconds);
  advanceDays(daysPassed);

  return { daysPassed, feedUsed };
}

// --- GAME TIME LOOP ---
setInterval(()=>{
  if(!state.timePaused){
    state.advanceDay();
  }
}, state.DAY_DURATION_MS);

// --- SAVE SYSTEM ---
function saveGame() {
  const data = {
    cash: state.cash,
    penPurchaseCost: state.penPurchaseCost,
    sites: state.sites,
    vessels: state.vessels,
    lastSaved: Date.now(),
    time: {
      totalDaysElapsed: state.totalDaysElapsed,
      dayInSeason: state.dayInSeason,
      seasonIndex: state.seasonIndex,
      year: state.year
    }
  };
  try {
    localStorage.setItem(state.SAVE_KEY, JSON.stringify(data));
    addStatusMessage('Game saved!');
  } catch (e) {
    console.error('Save failed', e);
  }
}

function loadGame() {
  const raw = localStorage.getItem(state.SAVE_KEY);
  if (!raw) return;
  try {
    const obj = JSON.parse(raw);
    if (obj && obj.sites) {
      state.cash = obj.cash ?? state.cash;
      state.penPurchaseCost = obj.penPurchaseCost ?? state.penPurchaseCost;
      state.sites = obj.sites;
      state.sites.forEach(s => { if(!s.location) s.location = { x: Math.random()*100, y: Math.random()*100 }; });
      state.vessels = obj.vessels ?? state.vessels;
      state.vessels.forEach(v => { if(!v.cargo) v.cargo = {}; });
      if(obj.time){
        state.totalDaysElapsed = obj.time.totalDaysElapsed ?? state.totalDaysElapsed;
        state.dayInSeason = obj.time.dayInSeason ?? state.dayInSeason;
        state.seasonIndex = obj.time.seasonIndex ?? state.seasonIndex;
        state.year = obj.time.year ?? state.year;
      }
      if(obj.lastSaved){
        const diff = Date.now() - obj.lastSaved;
        if(diff > 1000){
          state.lastOfflineInfo = simulateOfflineProgress(diff);
          state.lastOfflineInfo.elapsedMs = diff;
        }
      }
    }
  } catch (e) {
    console.error('Load failed', e);
  }
}

function resetGame() {
  localStorage.removeItem(state.SAVE_KEY);
  location.reload();
}

// site/pen nav
function previousSite(){ if(state.currentSiteIndex>0) state.currentSiteIndex--; state.currentPenIndex=0; state.currentBargeIndex=0; updateDisplay(); }
function nextSite(){ if(state.currentSiteIndex<state.sites.length-1) state.currentSiteIndex++; state.currentPenIndex=0; state.currentBargeIndex=0; updateDisplay(); }

function previousBarge(){ if(state.currentBargeIndex>0) state.currentBargeIndex--; updateDisplay(); }
function nextBarge(){ const site = state.sites[state.currentSiteIndex]; if(state.currentBargeIndex<site.barges.length-1) state.currentBargeIndex++; updateDisplay(); }
function previousVessel(){ if(state.currentVesselIndex>0) state.currentVesselIndex--; updateDisplay(); }
function nextVessel(){ if(state.currentVesselIndex<state.vessels.length-1) state.currentVesselIndex++; updateDisplay(); }



export { buyFeed, buyMaxFeed, buyFeedStorageUpgrade, buyLicense, buyNewSite, buyNewPen, buyNewBarge, hireStaff, fireStaff, assignStaff, unassignStaff, upgradeStaffHousing, upgradeBarge, addDevCash, togglePanel, openModal, closeModal, openRestockModal, closeRestockModal, openHarvestModal, closeHarvestModal, confirmHarvest, openVesselHarvestModal, closeVesselHarvestModal, confirmVesselHarvest, feedFishPen, harvestPenIndex, harvestWithVessel, restockPenUI, upgradeFeeder, assignBarge, openSellModal, closeSellModal, sellCargo, toggleSection, saveGame, resetGame, previousSite, nextSite, previousBarge, nextBarge, previousVessel, nextVessel, upgradeVessel, buyNewVessel, renameVessel, openMoveVesselModal, closeMoveModal, moveVesselTo, showTab, updateSelectedBargeDisplay, getTimeState  };
