const OFFLINE_STEP_SECONDS = 60; // simulation granularity for offline progress

function onBoot(fn){
  if (document.readyState === 'complete' || document.readyState === 'interactive'){
    if (window.state) return fn();
  }
  const start = Date.now();
  const id = setInterval(()=>{
    if ((document.readyState === 'complete' || document.readyState === 'interactive') && window.state){
      clearInterval(id); fn();
    } else if (Date.now() - start > 4000){
      clearInterval(id); console.error('Boot timeout: state not ready');
    }
  }, 50);
}
window.onBoot = onBoot;

function bootGuard(fn){
  if(!window.state){
    console.warn('bootGuard: state not ready');
    return;
  }
  try {
    fn();
  } catch (e) {
    console.error(e);
  }
}
window.bootGuard = bootGuard;

function getTimeState(){
  return { now: Date.now(), speed: state?.timeScale ?? 1 };
}
window.getTimeState = getTimeState;

function syncLegacyVesselFields(vessel){
  const h = vessel.holds?.[0];
  if(!h) return;
  vessel.currentBiomassLoad = h.biomass; // TODO: remove scalar after holds migration
  vessel.cargoSpecies = h.species; // TODO: remove scalar after holds migration
  vessel.maxBiomassCapacity = h.capacity; // TODO: remove scalar after holds migration
}

function logVesselHolds(vessel){
  if(!vessel || !Array.isArray(vessel.holds)){
    console.log('No holds to log');
    return;
  }
  vessel.holds.forEach((h, i)=>{
    console.log(`Hold ${i}: ${h.biomass}/${h.capacity}kg ${h.species||'empty'}`);
  });
}

function sanitizePen(pen){
  if(!pen) return;
  pen.fishCount = Math.max(0, Math.floor(pen.fishCount || 0));
  if(pen.fishCount === 0) pen.averageWeight = 0;
}

function lockPen(pen, reason){
  pen.locked = true;
  pen.lastLockReason = reason;
  pen.lockedAt = Date.now();
  if(state.dev){
    state.debugLog.push(`lock:${reason}`);
  }
}

function unlockPen(pen, reason){
  pen.locked = false;
  pen.lastUnlockReason = reason;
  pen.unlockedAt = Date.now();
  if(state.dev){
    state.debugLog.push(`unlock:${reason}`);
  }
}

function buyFeed(amount=20){
  const site = state.sites[state.currentSiteIndex];
  const barge = site.barges[state.currentBargeIndex];
  amount = Math.max(0, amount);
  const cost = amount * state.FEED_COST_PER_KG;
  if(state.cash < cost) return (window.openModal || alert)("Not enough cash to buy feed.");
  if(barge.feed + amount > barge.feedCapacity)
    return (window.openModal || alert)("Not enough feed storage space!");
  state.cash -= cost;
  barge.feed += amount;
  updateDisplay();
}

function buyFeedStorageUpgrade(){
  const site = state.sites[state.currentSiteIndex];
  const barge = site.barges[state.currentBargeIndex];
  if(barge.storageUpgradeLevel>=feedStorageUpgrades.length) return (window.openModal || alert)("Max feed storage reached!");
  const up = feedStorageUpgrades[barge.storageUpgradeLevel];
  if(state.cash<up.cost) return (window.openModal || alert)("Not enough cash to upgrade feed storage!");
  state.cash-=up.cost; barge.feedCapacity=up.capacity;
  barge.storageUpgradeLevel++; updateDisplay();
}
function purchaseLicense(sp){
  const site = state.sites[state.currentSiteIndex];
  const cost = speciesData[sp]?.licenseCost || 0;
  if(site.licenses.includes(sp)) return (window.openModal || alert)('Already licensed');
  if(state.cash < cost) return (window.openModal || alert)('Insufficient funds');
  state.cash -= cost;
  site.licenses.push(sp);
  updateDisplay();
  updateSiteLicenses();
  updateLicenseDropdown();
  (window.openModal || alert)('License purchased successfully');
}

function purchaseSiteUpgrade(key){
  const site = state.sites[state.currentSiteIndex];
  if(!site.upgrades) site.upgrades = [];
  if(site.upgrades.includes(key)) return (window.openModal || alert)('Upgrade already purchased');
  const cost = 25000;
  if(state.cash < cost) return (window.openModal || alert)('Insufficient funds');
  state.cash -= cost;
  site.upgrades.push(key);
  updateDisplay();
  updateSiteUpgrades();
  (window.openModal || alert)('Upgrade purchased successfully');
}
function buyNewSite(){
  if(state.cash<20000) return (window.openModal || alert)("Not enough cash to buy a new site!");
  state.cash-=20000;
  state.sites.push(new Site({
    name: state.generateRandomSiteName(),
    // ensure farms spawn in water (upper portion of map)
    location: { x: Math.random()*100, y: Math.random()*60 },
    barges:[new Barge({
      feed:100,
      feedCapacity: siloUpgrades[0].feedCapacity,
      siloCapacity:1000,
      staffCapacity: housingUpgrades[0].staffCapacity,
      feederLimit: DEFAULT_FEEDER_LIMIT,
      maxFeederTier: DEFAULT_MAX_FEEDER_TIER,
      upgrades:[],
      storageUpgradeLevel: 0,
      housingUpgradeLevel: 0,
      siloUpgradeLevel: 0,
      blowerUpgradeLevel: 0,
      feedRateMultiplier: blowerUpgrades[0].rate
    })],
    staff: [],
    licenses:['shrimp'],
    pens:[new Pen({ species:"shrimp", fishCount:500, averageWeight:0.01, bargeIndex:0 })]
  }));
  updateDisplay();
  (window.openModal || alert)("New site purchased!");
}
function buyNewPen(bargeIdx = state.currentBargeIndex){
  const site = state.sites[state.currentSiteIndex];
  if(state.cash < state.penPurchaseCost) return (window.openModal || alert)("Not enough cash to buy a new pen!");
  if(bargeIdx < 0 || bargeIdx >= site.barges.length) return (window.openModal || alert)("Invalid barge selected.");
  state.cash -= state.penPurchaseCost;
  site.pens.push({ species:"shrimp", fishCount:0, averageWeight:0, bargeIndex: Number(bargeIdx) });
  state.penPurchaseCost *= 1.5;
  state.onboarding.steps.boughtPen = true;
  updateDisplay();
}

function buyNewBarge(){
  const site = state.sites[state.currentSiteIndex];
  if(state.cash < NEW_BARGE_COST) return (window.openModal || alert)("Not enough cash to buy a new barge!");
  state.cash -= NEW_BARGE_COST;
  site.barges.push({
    feed:100,
    feedCapacity: siloUpgrades[0].feedCapacity,
    siloCapacity:1000,
    staffCapacity: housingUpgrades[0].staffCapacity,
    feederLimit: DEFAULT_FEEDER_LIMIT,
    maxFeederTier: DEFAULT_MAX_FEEDER_TIER,
    upgrades:[],
    storageUpgradeLevel:0,
    housingUpgradeLevel:0,
    siloUpgradeLevel:0,
    blowerUpgradeLevel:0,
    feedRateMultiplier: blowerUpgrades[0].rate
  });
  state.currentBargeIndex = site.barges.length-1;
  updateDisplay();
  (window.openModal || alert)("New barge purchased!");
}
function hireStaff(){
  const site = state.sites[state.currentSiteIndex];
  const capacity = site.barges.reduce((t,b)=>t+b.staffCapacity,0);
  if(site.staff.length >= capacity)
    return (window.openModal || alert)("No staff housing available.");
  if(state.cash < STAFF_HIRE_COST) return (window.openModal || alert)("Not enough cash to hire staff.");
  state.cash -= STAFF_HIRE_COST;
  site.staff.push({ role: null });
  updateDisplay();
}
function fireStaff(role=null){
  const site = state.sites[state.currentSiteIndex];
  const idx = site.staff.findIndex(s => role ? s.role===role : !s.role);
  if(idx === -1) return (window.openModal || alert)("No staff member available to fire.");
  site.staff.splice(idx,1);
  updateDisplay();
}
function assignStaff(role){
  const site = state.sites[state.currentSiteIndex];
  const member = site.staff.find(s=>!s.role);
  if(!member) return (window.openModal || alert)("No unassigned staff available.");
  if(!staffRoles[role]) return;
  member.role = role;
  updateDisplay();
}
function unassignStaff(role){
  const site = state.sites[state.currentSiteIndex];
  const member = site.staff.find(s=>s.role===role);
  if(!member) return (window.openModal || alert)(`No staff assigned as ${role}.`);
  member.role = null;
  updateDisplay();
}

function upgradeSilo(barge = state.sites[state.currentSiteIndex].barges[state.currentBargeIndex]){
  if(!barge) return;
  const level = barge.siloUpgradeLevel || 0;
  if(level >= siloUpgrades.length - 1)
    return (window.openModal || alert)('Silo already at max level.');
  const next = siloUpgrades[level + 1];
  if(state.cash < next.cost) return (window.openModal || alert)('Not enough cash to upgrade silo.');
  state.cash -= next.cost;
  barge.siloUpgradeLevel = level + 1;
  barge.feedCapacity = next.feedCapacity;
  updateDisplay();
}

function upgradeBlower(barge = state.sites[state.currentSiteIndex].barges[state.currentBargeIndex]){
  if(!barge) return;
  const level = barge.blowerUpgradeLevel || 0;
  if(level >= blowerUpgrades.length - 1)
    return (window.openModal || alert)('Blower already at max level.');
  const next = blowerUpgrades[level + 1];
  if(state.cash < next.cost) return (window.openModal || alert)('Not enough cash to upgrade blower.');
  state.cash -= next.cost;
  barge.blowerUpgradeLevel = level + 1;
  barge.feedRateMultiplier = next.rate;
  updateDisplay();
}

function upgradeHousing(barge = state.sites[state.currentSiteIndex].barges[state.currentBargeIndex]){
  if(!barge) return;
  const level = barge.housingUpgradeLevel || 0;
  if(level >= housingUpgrades.length - 1)
    return (window.openModal || alert)('Housing already at max level.');
  const next = housingUpgrades[level + 1];
  if(state.cash < next.cost) return (window.openModal || alert)('Not enough cash to upgrade housing.');
  state.cash -= next.cost;
  barge.housingUpgradeLevel = level + 1;
  barge.staffCapacity = next.staffCapacity;
  updateDisplay();
}
function upgradeStaffHousing(){
  const site = state.sites[state.currentSiteIndex];
  const barge = site.barges[state.currentBargeIndex];
  if(barge.housingUpgradeLevel >= staffHousingUpgrades.length)
    return (window.openModal || alert)("Staff housing fully upgraded!");
  const up = staffHousingUpgrades[barge.housingUpgradeLevel];
  if(state.cash < up.cost) return (window.openModal || alert)("Not enough cash to upgrade housing.");
  state.cash -= up.cost;
  barge.staffCapacity += up.extraCapacity;
  barge.housingUpgradeLevel++;
  updateDisplay();
}


function upgradeVessel(){
  const vessel = state.vessels[state.currentVesselIndex];
  if(vessel.status !== 'idle')
    return (window.openModal || alert)('Vessel currently busy.');
  const currentTier = vessel.tier;
  if(currentTier >= vesselTiers.length - 1)
    return (window.openModal || alert)("Vessel already at max tier.");
  const next = vesselTiers[currentTier + 1];
  if(state.cash < next.cost) return (window.openModal || alert)("Not enough cash to upgrade vessel.");
  state.cash -= next.cost;
  vessel.tier++;
    vessel.maxBiomassCapacity = Math.max(vessel.maxBiomassCapacity, next.maxBiomassCapacity); // TODO: remove after holds migration
    if (vessel.holds && vessel.holds[0]) {
      vessel.holds[0].capacity = vessel.maxBiomassCapacity; // TODO: remove after holds migration
    }
  vessel.speed = next.speed;
  (window.openModal || alert)(`Vessel upgraded to ${next.name} tier!`);
  updateDisplay();
}

function buyNewVessel(){
  if(state.cash < NEW_VESSEL_COST) return (window.openModal || alert)("Not enough cash to buy a new vessel!");
  state.cash -= NEW_VESSEL_COST;
    state.vessels.push(new Vessel({
      name: `Vessel ${state.vessels.length + 1}`,
      maxBiomassCapacity: vesselTiers[0].maxBiomassCapacity, // TODO: remove after holds migration
      currentBiomassLoad: 0, // TODO: remove after holds migration
      cargoSpecies: null, // TODO: remove after holds migration
    speed: vesselTiers[0].speed,
    location: 'Dock',
    tier: 0,
    cargo: {},
    status: 'idle',
    destination: null,
    busyUntil: 0
  }));
  state.currentVesselIndex = state.vessels.length - 1;
  updateDisplay();
  (window.openModal || alert)('New vessel purchased!');
}

function renameVessel(){
  const vessel = state.vessels[state.currentVesselIndex];
  if(!vessel) return;
  if(vessel.status !== 'idle')
    return (window.openModal || alert)('Vessel currently busy.');
  const input = document.getElementById('renameInput');
  if(input){
    input.value = vessel.name;
    document.getElementById('renameModal').classList.add('visible');
  }
}

function closeRenameModal(){
  document.getElementById('renameModal').classList.remove('visible');
}

function confirmRename(){
  const vessel = state.vessels[state.currentVesselIndex];
  if(!vessel) return closeRenameModal();
  if(vessel.status !== 'idle')
    return (window.openModal || alert)('Vessel currently busy.');
  const input = document.getElementById('renameInput');
  const newName = input.value.trim();
  if(!newName) return closeRenameModal();
  if(state.cash < VESSEL_RENAME_FEE) return (window.openModal || alert)('Insufficient funds');
  state.cash -= VESSEL_RENAME_FEE;
  vessel.name = newName;
  closeRenameModal();
  updateDisplay();
  (window.openModal || alert)(`A Vessel Registry Update Fee of $${VESSEL_RENAME_FEE} has been applied for renaming.`);
}

function openMoveVesselModal(){
  const vessel = state.vessels[state.currentVesselIndex];
  if(vessel.status !== 'idle')
    return (window.openModal || alert)('Vessel currently busy.');
  const optionsDiv = document.getElementById('moveOptions');
  optionsDiv.innerHTML = '';
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

function toggleDevTools(){
  const modal = document.getElementById('devModal');
  if(modal.classList.contains('visible')) closeDevModal();
  else openDevModal();
}

function toggleOnboarding(){
  state.onboarding.enabled = !state.onboarding.enabled;
  if(!state.onboarding.enabled){
    state.onboarding.dismissed = true;
  } else {
    state.onboarding.dismissed = false;
  }
  updateDisplay();
  saveGame();
}

function refreshShipyardListings(){
  const daysSince = state.totalDaysElapsed - state.shipyardLastRefreshDay;
  if(daysSince < state.SHIPYARD_RESTOCK_INTERVAL) return;
  state.generateShipyardInventory();
  state.addStatusMessage('New used vessels have arrived at auction.');
  openShipyard();
}
function buyShipyardVessel(idx){
  const item = state.shipyardInventory[idx];
  if(!item) return;
  if(state.cash < item.cost) return (window.openModal || alert)('Not enough cash to buy this vessel.');
  state.cash -= item.cost;
    const vessel = new Vessel({
      name: item.name,
      maxBiomassCapacity: item.cargoCapacity, // TODO: remove after holds migration
      currentBiomassLoad: 0, // TODO: remove after holds migration
      cargoSpecies: null, // TODO: remove after holds migration
    speed: item.speed,
    location: 'Dock',
    tier: 0,
    upgradeSlots: item.upgradeSlots,
    upgrades: []
  });
  state.vessels.push(vessel);
  state.currentVesselIndex = state.vessels.length - 1;
  state.generateShipyardInventory();
  closeShipyard();
  updateDisplay();
  const msg = `You acquired a used vessel: ${item.name} (Condition: ${item.conditionLabel}). You haggled a fair price at the dockside classifieds.`;
  (window.openModal || alert)(msg);
}

function confirmCustomBuild(){
  const cls = document.getElementById('buildClassSelect').value;
  const input = document.getElementById('buildNameInput');
  const name = input.value.trim();
  if(!name){
    input.classList.add('input-error');
    input.title = 'Enter a vessel name';
    return (window.openModal || alert)('Enter a vessel name.');
  }
  if(state.vessels.some(v=>v.name.toLowerCase()===name.toLowerCase())){
    input.classList.add('input-error');
    input.title = 'Name already exists';
    return (window.openModal || alert)('A vessel with that name already exists.');
  }
  input.classList.remove('input-error');
  input.title = '';
  const req = vesselUnlockDays[cls] || 0;
  if(state.totalDaysElapsed < req && cls !== 'skiff'){
    return (window.openModal || alert)('This vessel class is not unlocked yet.');
  }
  const base = vesselClasses[cls];
  const cost = Math.round(base.cost * CUSTOM_BUILD_MARKUP);
  if(state.cash < cost) return (window.openModal || alert)('Not enough cash to build this vessel.');
  state.cash -= cost;
    const vessel = new Vessel({
      name: name,
      maxBiomassCapacity: base.baseCapacity, // TODO: remove after holds migration
      currentBiomassLoad: 0, // TODO: remove after holds migration
      cargoSpecies: null, // TODO: remove after holds migration
    speed: base.baseSpeed,
    location: 'Dock',
    tier: 0,
    upgradeSlots: base.slots,
    upgrades: []
  });
  state.vessels.push(vessel);
  state.currentVesselIndex = state.vessels.length - 1;
  updateDisplay();
  backToShipyardList();
  (window.openModal || alert)('Custom vessel constructed!');
}

function moveVesselTo(type, idx){
  const vessel = state.vessels[state.currentVesselIndex];
  if(vessel.status !== 'idle') { closeMoveModal(); return (window.openModal || alert)('Vessel currently busy.'); }
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
    return (window.openModal || alert)(`Vessel already at ${destName}.`);
  }
  if(vessel.destination === destName && vessel.status === 'enRoute'){
    closeMoveModal();
    return (window.openModal || alert)(`Vessel already en route to ${destName}.`);
  }
  const startLoc = state.getLocationByName(vessel.location) || state.sites[state.currentSiteIndex].location;
  const dx = startLoc.x - destLoc.x;
  const dy = startLoc.y - destLoc.y;
  const distance = Math.hypot(dx, dy);
  const travelTime = distance / vessel.speed * state.TRAVEL_TIME_FACTOR;
  vessel.destination = destName;
  vessel.status = 'enRoute';
  vessel.busyUntil = Date.now() + travelTime;
  vessel.actionEndsAt = vessel.busyUntil;
  closeMoveModal();
  if(vessel.travelInterval){ clearInterval(vessel.travelInterval); }
  vessel.travelInterval = setInterval(()=>{
    if(state.timePaused) return;
    if(Date.now() >= vessel.busyUntil){
      clearInterval(vessel.travelInterval);
      vessel.travelInterval = null;
      vessel.location = destName;
      vessel.destination = null;
      vessel.status = 'idle';
      vessel.busyUntil = 0;
      vessel.actionEndsAt = 0;
      updateDisplay();
    }
  },250);
}

// feed / harvest / restock
function feedFish(){
  const site = state.sites[state.currentSiteIndex];
  const pen  = site.pens[state.currentPenIndex];
  const barge = site.barges[pen.bargeIndex];
  if(pen.locked) return;
  if(barge.feed<1 || pen.fishCount===0) return;
  barge.feed--;
  const baseGain = 1 / speciesData[pen.species].fcr;
  let gain = baseGain;
  const max = speciesData[pen.species].maxWeight;
  if(max && pen.averageWeight > max){
    const excess = pen.averageWeight - max;
    const scale = Math.max(0.1, 1 - (excess / max));
    gain *= scale;
  }
  pen.averageWeight += gain/pen.fishCount;
}
function harvestPen(amount=null, holdIdx=0){
  const site = state.sites[state.currentSiteIndex];
  const pen  = site.pens[state.currentPenIndex];
  const vessel = state.vessels[state.currentVesselIndex];
  let holds = Array.isArray(vessel.holds) && vessel.holds.length>0 ? vessel.holds : null;
  if(holds){
    holdIdx = Math.max(0, Math.min(holdIdx, holds.length-1));
  } else {
    holdIdx = 0;
  }
  let hold = holds ? holds[holdIdx] : {
    species: vessel.cargoSpecies ?? null,
    biomass: vessel.currentBiomassLoad ?? 0,
    capacity: vessel.maxBiomassCapacity ?? 0
  };
  if(vessel.status !== 'idle')
    return (window.openModal || alert)('Vessel currently busy.');
  if(pen.fishCount===0) return;
  if(hold.biomass>0 && hold.species && hold.species !== pen.species){
    return (window.openModal || alert)('Vessel already contains a different species.');
  }
  const vesselRemaining = hold.capacity - hold.biomass;
  const penBiomass = pen.fishCount * pen.averageWeight;
  const maxHarvest = Math.min(penBiomass, vesselRemaining);
  if(maxHarvest <= 0) return (window.openModal || alert)("Vessel capacity full.");
  if(pen.locked) return (window.openModal || alert)('Pen currently busy.');
  const requested = amount === null ? maxHarvest : Math.max(0, Math.min(amount, maxHarvest));
  const avg = pen.averageWeight > 0 ? pen.averageWeight : 1;
  let fishNum = Math.floor(requested / avg);
  fishNum = Math.min(fishNum, pen.fishCount);
  fishNum = Math.min(fishNum, Math.floor(vesselRemaining / avg));
  if(fishNum <= 0) return;
  const biomass = fishNum * avg;
  const performHarvest = ()=>{
    lockPen(pen, 'harvest:start');
    vessel.harvestingPenIndex = state.currentPenIndex;
    if(!hold.species) hold.species = pen.species;
    if(!vessel.cargo[pen.species]) vessel.cargo[pen.species] = 0;
    vessel.harvestProgress = 0;
    vessel.harvestFishBuffer = 0;
    let remainingFish = fishNum;
    const lockedWeight = pen.averageWeight;
    let last = Date.now();
    const updateEta = () => {
      const rate = state.getSiteHarvestRate(site);
      vessel.busyUntil = Date.now() + (biomass - vessel.harvestProgress) / rate * 1000;
      vessel.actionEndsAt = vessel.busyUntil;
    };
    updateEta();
    vessel.harvestInterval = setInterval(()=>{
      const now = Date.now();
      if(state.timePaused){ last = now; return; }
      const dt = (now - last)/1000;
      last = now;
      const rate = state.getSiteHarvestRate(site);
      let delta = rate * dt;
      if(vessel.harvestProgress + delta > biomass) delta = biomass - vessel.harvestProgress;
      if(delta<=0) return;
      vessel.harvestProgress += delta;
      hold.biomass = Math.min(hold.biomass + delta, hold.capacity);
      if(!hold.species) hold.species = pen.species;
      if(holds){
        syncLegacyVesselFields(vessel);
      } else {
        vessel.currentBiomassLoad = hold.biomass;
        vessel.cargoSpecies = hold.species;
      }
      if(!vessel.cargo[pen.species]) vessel.cargo[pen.species] = 0;
      vessel.cargo[pen.species] += delta;
      vessel.harvestFishBuffer += delta / pen.averageWeight;
      let remove = Math.floor(vessel.harvestFishBuffer);
      if(remove > remainingFish) remove = remainingFish;
      if(remove>0){
        pen.fishCount -= remove;
        remainingFish -= remove;
        vessel.harvestFishBuffer -= remove;
        for(let i=0;i<remove;i++){
          vessel.fishBuffer.push({ species: pen.species, weight: lockedWeight });
        }
      }
      updateEta();
      if(vessel.harvestProgress >= biomass){
        clearInterval(vessel.harvestInterval);
        vessel.harvestInterval = null;
        vessel.harvestProgress = 0;
        const leftover = Math.min(remainingFish, Math.round(vessel.harvestFishBuffer));
        if(leftover > 0){
          pen.fishCount -= leftover;
          remainingFish -= leftover;
          for(let i=0; i<leftover; i++){
            vessel.fishBuffer.push({ species: pen.species, weight: lockedWeight });
          }
        }
        vessel.harvestFishBuffer = 0;
        sanitizePen(pen);
        if(pen.fishCount<=0){ pen.species = null; pen.averageWeight = 0; }
        unlockPen(pen, 'harvest:end');
        vessel.harvestingPenIndex = null;
        vessel.location = site.name;
        vessel.status = 'idle';
        vessel.isHarvesting = false;
        vessel.busyUntil = 0;
        vessel.destination = null;
        vessel.actionEndsAt = 0;
        syncLegacyVesselFields(vessel);
        state.harvestsCompleted++;
        state.onboarding.steps.harvested = true;
        (window.openModal || alert)(`Harvested ${biomass.toFixed(2)} kg loaded onto ${vessel.name}.`);
        checkVesselContractEligibility(vessel);
      }
      updateDisplay();
    }, 250);
  };
  if(vessel.location !== site.name){
    const startLoc = state.getLocationByName(vessel.location) || site.location;
    const dx = startLoc.x - site.location.x;
    const dy = startLoc.y - site.location.y;
    const distance = Math.hypot(dx, dy);
    const travelTime = distance / vessel.speed * state.TRAVEL_TIME_FACTOR;
    vessel.destination = site.name;
    vessel.status = 'harvesting';
    vessel.isHarvesting = true;
    vessel.busyUntil = Date.now() + travelTime;
    vessel.actionEndsAt = vessel.busyUntil;
    updateDisplay();
    if(vessel.travelInterval){ clearInterval(vessel.travelInterval); }
    vessel.travelInterval = setInterval(()=>{
      if(state.timePaused) return;
      if(Date.now() >= vessel.busyUntil){
        clearInterval(vessel.travelInterval);
        vessel.travelInterval = null;
        vessel.location = site.name;
        performHarvest();
      }
    },250);
  } else {
    vessel.status = 'harvesting';
    vessel.isHarvesting = true;
    performHarvest();
    updateDisplay();
  }
}


function cancelVesselHarvest(idx){
  const vessel = state.vessels[idx];
  if(vessel.status !== 'harvesting') return;
  if(vessel.harvestTimeout){ clearTimeout(vessel.harvestTimeout); vessel.harvestTimeout = null; }
  if(vessel.harvestInterval){ clearInterval(vessel.harvestInterval); vessel.harvestInterval = null; }
  if(vessel.travelInterval){ clearInterval(vessel.travelInterval); vessel.travelInterval = null; }
  vessel.harvestProgress = 0;
  vessel.harvestFishBuffer = 0;
  vessel.status = 'idle';
  vessel.isHarvesting = false;
  vessel.busyUntil = 0;
  vessel.destination = null;
  vessel.actionEndsAt = 0;
  if(vessel.harvestingPenIndex !== null){
    const site = state.sites[state.currentSiteIndex];
    const pen = site.pens[vessel.harvestingPenIndex];
    if(pen) unlockPen(pen, 'harvest:cancel');
    vessel.harvestingPenIndex = null;
  }
  (window.openModal || alert)('Harvest cancelled.');
  updateDisplay();
}
function restockPen(sp, qty){
  const site = state.sites[state.currentSiteIndex];
  const pen  = site.pens[state.currentPenIndex];
  if(pen.locked) return (window.openModal || alert)('Pen currently busy.');
  const data = speciesData[sp];
  qty = Math.max(0, Math.floor(qty));
  const unit = data.restockCost / data.restockCount;
  const cost = qty * unit;
  if(qty <= 0) return;
  if(state.cash < cost) return (window.openModal || alert)("Not enough cash to restock.");
  if(pen.fishCount > 0){
    if(pen.species !== sp) return;
    return; // require empty for now
  }
  state.cash -= cost;
  pen.species = sp;
  pen.averageWeight = data.startingWeight;
  pen.fishCount = qty;
  sanitizePen(pen);
  updateDisplay();
  closeRestockModal();
  state.milestones.firstStock = true;
  state.onboarding.steps.stocked = true;
  checkMilestones();
}
// dev menu
function addDevCash() {
  state.cash += 100000;
  updateDisplay();
}

function devHarvestAll(){
  state.sites.forEach(site=>{
    site.pens.forEach(pen=>{
      pen.fishCount = 0;
      pen.averageWeight = 0;
      sanitizePen(pen);
    });
  });
  updateDisplay();
}

function devRestockAll(){
  state.sites.forEach(site=>{
    site.pens.forEach(pen=>{
      const data = speciesData[pen.species];
      if(!data) return;
      pen.fishCount = data.restockCount;
      pen.averageWeight = data.startingWeight;
      sanitizePen(pen);
    });
  });
  updateDisplay();
}

function devAddBiomass(amount = 10){
  const site = state.sites[state.currentSiteIndex];
  const pen = site.pens[state.currentPenIndex];
  if(pen.fishCount <= 0) return;
  pen.averageWeight += amount / pen.fishCount;
  updateDisplay();
}

function devRestartGame() {
  if (confirm("Restart the game?")) {
    localStorage.clear();
    location.reload();
  }
}

function devAdvanceTime(days) {
  for (let i = 0; i < days; i++) state.advanceDay();
  updateDisplay();
}

function devSetDatePrompt() {
  const season = prompt("Season (Spring, Summer, Fall, Winter):");
  const year = parseInt(prompt("Year:"), 10);
  if (season && !isNaN(year)) {
    state.season = season;
    state.year = year;
    updateDisplay();
  }
}

function devSetTimeScalePrompt() {
  const scale = parseFloat(prompt("Set game speed multiplier:"));
  if (!isNaN(scale) && scale > 0) state.timeScale = scale;
}

function devResetMarketPrices() {
  markets.forEach(market => {
    Object.keys(market.basePrices).forEach(species => {
      market.prices[species] = market.basePrices[species];
    });
  });
  updateDisplay();
}

function devRandomizeMarket() {
  updateMarketPrices();
}

function devSetMarketModifierPrompt() {
  const market = prompt("Market name:");
  const species = prompt("Species name:");
  const modifier = parseFloat(prompt("Modifier (e.g. 1.2):"));
  const target = markets.find(m => m.name === market);
  if (target && !isNaN(modifier)) {
    target.priceModifiers[species] = modifier;
  }
  updateDisplay();
}

function calculateHarvestIncome(pen) {
  const species = pen.species;
  const biomass = pen.fishCount * pen.averageWeight;
  const price = markets[0].prices?.[species] ?? speciesData[species].marketPrice;
  return biomass * price;
}

function devInstantSellAll() {
  state.sites.forEach(site => {
    site.pens.forEach(pen => {
      state.cash += calculateHarvestIncome(pen);
      pen.fishCount = 0;
      pen.averageWeight = 0;
      sanitizePen(pen);
    });
  });
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
function restockPenUI(i){ state.currentPenIndex=i; openRestockModal(); }
function upgradeFeeder(i){
  const site = state.sites[state.currentSiteIndex];
  const pen = site.pens[i];
  if(pen.locked) return (window.openModal || alert)('Pen currently busy.');
  const currentTier = pen.feeder?.tier || 0;
  if(currentTier >= feederUpgrades.length) return (window.openModal || alert)("Feeder already at max tier.");
  const nextTier = currentTier + 1;
  const barge = site.barges[pen.bargeIndex];
  if(nextTier > barge.maxFeederTier) return (window.openModal || alert)("Barge tier too low for this feeder upgrade.");
  if(!pen.feeder && site.pens.filter(p=>p.feeder && p.bargeIndex===pen.bargeIndex).length >= barge.feederLimit)
    return (window.openModal || alert)("Barge cannot support more feeders.");
  const up = feederUpgrades[currentTier];
  if(state.cash < up.cost) return (window.openModal || alert)("Not enough cash for upgrade.");
  state.cash -= up.cost;
  pen.feeder = { type: up.type, tier: nextTier };
  (window.openModal || alert)(`Feeder upgraded to ${state.capitalizeFirstLetter(up.type)} (Tier ${nextTier}).`);
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
// Locked pens are skipped during auto-feeding
function autoFeedTick(){
  if(state.timePaused) return;
  state.sites.forEach(site=>{
    const staffRate = getStaffFeedRate(site);
    site.barges.forEach((barge,bIdx)=>{
      let activeFeeders = 0;
      site.pens.forEach(pen=>{
        if(pen.locked) return; // skip growth while locked
        if(pen.bargeIndex!==bIdx) return;
        let rate = staffRate;
        const feederRate = getFeederRate(pen.feeder);
        if(feederRate>0 && activeFeeders < barge.feederLimit){
          rate += feederRate;
          activeFeeders++;
        }
        const blowerRate = barge.feedRateMultiplier || 1;
        rate *= blowerRate;
        for(let i=0;i<rate;i++){
          if(barge.feed>=1 && pen.fishCount>0){
            barge.feed--;
            const baseGain = 1 / speciesData[pen.species].fcr;
            let gain = baseGain;
            const max = speciesData[pen.species].maxWeight;
            if(max && pen.averageWeight > max){
              const excess = pen.averageWeight - max;
              const scale = Math.max(0.1, 1 - (excess / max));
              gain *= scale;
            }
            pen.averageWeight += gain/pen.fishCount;
          }
        }
      });
    });
  });
  updateDisplay();
}

// --- AUTO FEED MANAGER ---
function checkFeedManagers(){
  if(state.timePaused) return;
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
// Locked pens are ignored when calculating feed usage
function simulateOfflineProgress(ms){
  state.isSimulatingOffline = true;
  state.shipyardRestockedDuringOffline = false;
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
          if(pen.locked) return; // skip growth while locked
          if(pen.bargeIndex !== bIdx) return;
          let rate = staffRate;
          const fr = getFeederRate(pen.feeder);
          if(fr > 0 && activeFeeders < barge.feederLimit){
            rate += fr;
            activeFeeders++;
          }
          const blowerRate = barge.feedRateMultiplier || 1;
          rate *= blowerRate;
          const need = rate * dt;
          const used = Math.min(need, barge.feed);
          barge.feed -= used;
          feedUsed += used;
          if(used > 0 && pen.fishCount > 0){
            const baseGain = used / speciesData[pen.species].fcr;
            let gain = baseGain;
            const max = speciesData[pen.species].maxWeight;
            if(max && pen.averageWeight > max){
              const excess = pen.averageWeight - max;
              const scale = Math.max(0.1, 1 - (excess / max));
              gain *= scale;
            }
            pen.averageWeight += gain / pen.fishCount;
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

    state.vessels.forEach(v => {
      if(Array.isArray(v.holds)){
        v.holds.forEach(h => {
          if(!h.species) return;
          h.biomass = Math.min(h.biomass, h.capacity);
        });
        const h0 = v.holds[0];
        if(h0){
          v.currentBiomassLoad = h0.biomass; // TODO: remove after holds migration
          v.cargoSpecies = h0.species; // TODO: remove after holds migration
          v.maxBiomassCapacity = h0.capacity; // TODO: remove after holds migration
        }
      }
    });
  }

  const daysPassed = Math.floor(totalSeconds / daySeconds);
  advanceDays(daysPassed);
  state.isSimulatingOffline = false;
  return { daysPassed, feedUsed, shipyardRestocked: state.shipyardRestockedDuringOffline };
}

// --- GAME TIME LOOP ---
function gameTimeTick(){
  if(!state.timePaused){
    state.advanceDay();
  }
}

// --- SAVE SYSTEM ---
function saveGame() {
  const data = {
    cash: state.cash,
    penPurchaseCost: state.penPurchaseCost,
    sites: state.sites,
    vessels: state.vessels,
    harvestsCompleted: state.harvestsCompleted,
    contracts: state.contracts,
    contractsCompletedByTier: state.contractsCompletedByTier,
    unlockedContractTiers: state.unlockedContractTiers,
    milestones: state.milestones,
    bank: state.bank,
    onboarding: state.onboarding,
    tips: state.tips,
    marketStates: markets.map(m => ({
      name: m.name,
      prices: m.prices,
      priceHistory: m.priceHistory,
      daysSinceSale: m.daysSinceSale,
      basePrices: m.basePrices
    })),
    lastMarketUpdate: state.lastMarketUpdateString,
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
  if (!raw) {
    setupMarketData();
    state.generateShipyardInventory();
    initMilestones();
    return;
  }
  try {
    const obj = JSON.parse(raw);
    if (obj && obj.sites) {
      state.cash = obj.cash ?? state.cash;
      state.penPurchaseCost = obj.penPurchaseCost ?? state.penPurchaseCost;
      state.harvestsCompleted = obj.harvestsCompleted ?? 0;
      state.contracts = obj.contracts ?? state.contracts;
      state.contractsCompletedByTier = obj.contractsCompletedByTier ?? {};
      state.unlockedContractTiers = obj.unlockedContractTiers ?? [0];
      state.milestones = obj.milestones ?? {};
      state.tips = Object.assign({ vesselUnlocked:false, penUnlocked:false, tipStockShown:false, tipHarvestShown:false, tipSellShown:false, tipBuyPenShown:false }, obj.tips);
      state.onboarding = Object.assign({ enabled:true, dismissed:false, steps:{ stocked:false, harvested:false, sold:false, boughtPen:false } }, obj.onboarding);
      if(!state.onboarding.steps){
        state.onboarding.steps = { stocked:false, harvested:false, sold:false, boughtPen:false };
      } else {
        state.onboarding.steps = Object.assign({ stocked:false, harvested:false, sold:false, boughtPen:false }, state.onboarding.steps);
      }
      if(obj.bank){
        state.bank.deposit = obj.bank.deposit ?? state.bank.deposit;
        state.bank.depositInterestRate = obj.bank.depositInterestRate ?? state.bank.depositInterestRate;
        state.bank.loans = obj.bank.loans ?? [];
        state.bank.nextLoanId = obj.bank.nextLoanId ?? state.bank.nextLoanId;
      }
      state.sites = obj.sites;
      state.sites.forEach(s => { if(!s.location) s.location = { x: Math.random()*100, y: Math.random()*100 }; });
      state.vessels = obj.vessels ?? state.vessels;
      state.vessels.forEach(v => {
        if(!v.cargo) v.cargo = {};
          if(v.cargoSpecies === undefined) v.cargoSpecies = Object.keys(v.cargo)[0] || null; // TODO: remove after holds migration
        if(v.status === undefined){
          if(v.isHarvesting) v.status = 'harvesting';
          else if(v.unloading) v.status = 'offloading';
          else if(v.deliveringContractId) v.status = 'selling';
          else v.status = 'idle';
        }
        if(v.destination === undefined) v.destination = null;
        if(v.busyUntil === undefined) v.busyUntil = v.actionEndsAt || 0;
        v.isHarvesting = v.status === 'harvesting';
        v.unloading = v.status === 'offloading';
        v.actionEndsAt = v.busyUntil;
        if(v.upgradeSlots === undefined) v.upgradeSlots = vesselClasses.skiff.slots;
        if(!v.upgrades) v.upgrades = [];
        if(!Array.isArray(v.holds)) {
          v.holds = [{
              species: v.cargoSpecies ?? null, // TODO: remove after holds migration
              biomass: v.currentBiomassLoad ?? 0, // TODO: remove after holds migration
              capacity: v.maxBiomassCapacity ?? 0, // TODO: remove after holds migration
          }];
        } else {
          v.holds = v.holds.map(h => ({
            species: h?.species ?? null,
            biomass: h?.biomass ?? 0,
              capacity: h?.capacity ?? v.maxBiomassCapacity ?? 0, // TODO: remove after holds migration
          }));
        }
        Object.defineProperty(v, 'harvestInterval', { value: null, writable: true, enumerable: false });
        Object.defineProperty(v, 'harvestTimeout', { value: null, writable: true, enumerable: false });
        Object.defineProperty(v, 'harvestProgress', { value: 0, writable: true, enumerable: false });
        Object.defineProperty(v, 'harvestFishBuffer', { value: 0, writable: true, enumerable: false });
        if(!v.fishBuffer) v.fishBuffer = [];
        Object.defineProperty(v, 'harvestingPenIndex', { value: null, writable: true, enumerable: false });
        Object.defineProperty(v, 'travelInterval', { value: null, writable: true, enumerable: false });
        Object.defineProperty(v, 'offloadInterval', { value: null, writable: true, enumerable: false });
        Object.defineProperty(v, 'offloadPrices', { value: null, writable: true, enumerable: false });
        Object.defineProperty(v, 'offloadMarket', { value: null, writable: true, enumerable: false });
        Object.defineProperty(v, 'contractInterval', { value: null, writable: true, enumerable: false });
        if(v.unloading === undefined) v.unloading = false;
        if(v.offloadRevenue === undefined) v.offloadRevenue = 0;
        if(v.deliveringContractId === undefined) v.deliveringContractId = null;
      });
      state.sites.forEach(site => {
        site.pens.forEach(pen => {
          if(pen.locked === undefined) unlockPen(pen, 'init');
        });
        site.barges.forEach(barge => {
          if(barge.siloUpgradeLevel === undefined) barge.siloUpgradeLevel = 0;
          if(barge.blowerUpgradeLevel === undefined) barge.blowerUpgradeLevel = 0;
          if(barge.feedRateMultiplier === undefined) {
            const lvl = barge.blowerUpgradeLevel ?? 0;
            barge.feedRateMultiplier = blowerUpgrades[lvl]?.rate || 1;
          }
          if(barge.feedCapacity === undefined) barge.feedCapacity = siloUpgrades[0].feedCapacity;
          if(barge.housingUpgradeLevel === undefined) barge.housingUpgradeLevel = 0;
          if(barge.staffCapacity === undefined) barge.staffCapacity = housingUpgrades[0].staffCapacity;
          if(barge.feederLimit === undefined) barge.feederLimit = DEFAULT_FEEDER_LIMIT;
          if(barge.maxFeederTier === undefined) barge.maxFeederTier = DEFAULT_MAX_FEEDER_TIER;
        });
      });
      if(obj.time){
        state.totalDaysElapsed = obj.time.totalDaysElapsed ?? state.totalDaysElapsed;
        state.dayInSeason = obj.time.dayInSeason ?? state.dayInSeason;
        state.seasonIndex = obj.time.seasonIndex ?? state.seasonIndex;
        state.year = obj.time.year ?? state.year;
      }
      if(obj.lastMarketUpdate){
        state.lastMarketUpdateString = obj.lastMarketUpdate;
      }
      if(obj.lastSaved){
        const diff = Date.now() - obj.lastSaved;
        if(diff > 1000){
          state.lastOfflineInfo = simulateOfflineProgress(diff);
          state.lastOfflineInfo.elapsedMs = diff;
        }
      }
      if(obj.marketStates){
        obj.marketStates.forEach(s => {
          const m = markets.find(x=>x.name===s.name);
          if(m){
            m.prices = s.prices;
            m.priceHistory = s.priceHistory;
            m.daysSinceSale = s.daysSinceSale;
            m.basePrices = s.basePrices;
          }
        });
      }
    }
  } catch (e) {
    console.error('Load failed', e);
  }
  setupMarketData();
  state.generateShipyardInventory();
}

function resetGame() {
  localStorage.removeItem(state.SAVE_KEY);
  location.reload();
}

function pauseTime(){
  state.pauseTime();
  updateDisplay();
}

function resumeTime(){
  state.resumeTime();
  updateDisplay();
}

// site/pen nav
function previousSite(){ if(state.currentSiteIndex>0) state.currentSiteIndex--; state.currentPenIndex=0; state.currentBargeIndex=0; updateDisplay(); }
function nextSite(){ if(state.currentSiteIndex<state.sites.length-1) state.currentSiteIndex++; state.currentPenIndex=0; state.currentBargeIndex=0; updateDisplay(); }

function previousBarge(){ if(state.currentBargeIndex>0) state.currentBargeIndex--; updateDisplay(); }
function nextBarge(){ const site = state.sites[state.currentSiteIndex]; if(state.currentBargeIndex<site.barges.length-1) state.currentBargeIndex++; updateDisplay(); }
function previousVessel(){ if(state.currentVesselIndex>0) state.currentVesselIndex--; updateDisplay(); }
function nextVessel(){ if(state.currentVesselIndex<state.vessels.length-1) state.currentVesselIndex++; updateDisplay(); }



const actions = {
  buyFeed,
  buyFeedStorageUpgrade,
  purchaseLicense,
  purchaseSiteUpgrade,
  buyNewSite,
  buyNewPen,
  buyNewBarge,
  hireStaff,
  fireStaff,
  assignStaff,
  lockPen,
  unlockPen,
  unassignStaff,
  upgradeSilo,
  upgradeBlower,
  upgradeHousing,
  upgradeStaffHousing,
  addDevCash,
  devHarvestAll,
  devRestockAll,
  devAddBiomass,
  devRestartGame,
  devAdvanceTime,
  devSetDatePrompt,
  devSetTimeScalePrompt,
  devResetMarketPrices,
  devRandomizeMarket,
  devSetMarketModifierPrompt,
  devInstantSellAll,
  togglePanel,
  harvestPen,
  cancelVesselHarvest,
  feedFishPen,
  restockPen,
  restockPenUI,
  upgradeFeeder,
  assignBarge,
  saveGame,
  loadGame,
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
  closeRenameModal,
  confirmRename,
  openMoveVesselModal,
  closeMoveModal,
  moveVesselTo,
  showTab,
  updateSelectedBargeDisplay,
  refreshShipyardListings,
  buyShipyardVessel,
  confirmCustomBuild,
  toggleDevTools,
  toggleOnboarding,
  pauseTime,
  resumeTime,
  logVesselHolds,
};

for (const key in actions){
  window[key] = (...args) => window.bootGuard(()=>actions[key](...args));
}

onBoot(()=>{
  loadGame();
  initContracts();
  initMilestones();
  setInterval(saveGame, state.AUTO_SAVE_INTERVAL_MS);
  setInterval(checkMilestones, 1000);
  setInterval(autoFeedTick, 1000);
  setInterval(checkFeedManagers, 5000);
  setInterval(gameTimeTick, state.DAY_DURATION_MS);
});
