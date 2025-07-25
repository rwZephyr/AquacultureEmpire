# Harvesting and Vessel Loading

This document explains how fish are harvested from pens and how vessels load and offload biomass. It serves as a reference for future upgrades.

## Harvest Workflow
1. Players select a pen in the UI. `openHarvestModal` populates available pens and when confirmed, `window.harvestPen(amount)` invokes the main logic.
2. [`harvestPen`](../actions.js) validates vessel capacity and species, then calculates how much biomass can be moved. If the vessel is at another location it travels first, otherwise harvesting begins immediately.
3. During harvesting the pen is locked and progress accumulates every 250&nbsp;ms. The rate is based on `state.getSiteHarvestRate`, which combines a base rate with bonuses for harvester staff. The vessel's load and the pen's fish count update over time.
4. Completion clears timers, unlocks the pen and sets the vessel back to idle. Each harvest increments `state.harvestsCompleted` for milestone tracking.

```javascript
// actions.js excerpt
function harvestPen(amount=null){
  const site = state.sites[state.currentSiteIndex];
  const pen  = site.pens[state.currentPenIndex];
  const vessel = state.vessels[state.currentVesselIndex];
  if(vessel.isHarvesting) return openModal('Vessel currently harvesting.');
  if(pen.fishCount===0) return;
  if(vessel.currentBiomassLoad>0 && vessel.cargoSpecies && vessel.cargoSpecies !== pen.species){
    return openModal('Vessel already contains a different species.');
  }
  const totalBiomass = pen.fishCount * pen.averageWeight;
  const maxHarvest = Math.min(
    totalBiomass,
    vessel.maxBiomassCapacity - vessel.currentBiomassLoad
  );
  if(maxHarvest <= 0) return openModal("Vessel capacity full.");
  if(pen.locked) return openModal('Pen currently busy.');
  let desired = amount === null ? maxHarvest : Math.max(0, Math.min(amount, maxHarvest));
  let fishNum = Math.floor((desired + pen.averageWeight * 0.0001) / pen.averageWeight);
  if(fishNum === 0 && desired > 0) fishNum = 1;
  fishNum = Math.min(fishNum, pen.fishCount);
  const biomass = fishNum * pen.averageWeight;
  const performHarvest = ()=>{
    pen.locked = true;
    vessel.harvestingPenIndex = state.currentPenIndex;
    if(!vessel.cargoSpecies) vessel.cargoSpecies = pen.species;
    if(!vessel.cargo[pen.species]) vessel.cargo[pen.species] = 0;
    vessel.harvestProgress = 0;
    vessel.harvestFishBuffer = 0;
    const startFishCount = pen.fishCount;
    let last = Date.now();
    const updateEta = () => {
      const rate = state.getSiteHarvestRate(site);
      vessel.actionEndsAt = Date.now() + (biomass - vessel.harvestProgress) / rate * 1000;
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
      vessel.currentBiomassLoad += delta;
      if(!vessel.cargoSpecies) vessel.cargoSpecies = pen.species;
      if(!vessel.cargo[pen.species]) vessel.cargo[pen.species] = 0;
      vessel.cargo[pen.species] += delta;
      vessel.harvestFishBuffer += delta / pen.averageWeight;
      const remove = Math.floor(vessel.harvestFishBuffer);
      if(remove>0){
        pen.fishCount -= remove;
        vessel.harvestFishBuffer -= remove;
        if(pen.fishCount<=0) pen.averageWeight = 0;
      }
      updateEta();
      if(vessel.harvestProgress >= biomass){
        clearInterval(vessel.harvestInterval);
        vessel.harvestInterval = null;
        vessel.harvestProgress = 0;
        // ensure final fish count accounts for rounding
        pen.fishCount = Math.max(0, startFishCount - fishNum);
        if(pen.fishCount === 0) pen.averageWeight = 0;
        vessel.harvestFishBuffer = 0;
        pen.locked = false;
        vessel.harvestingPenIndex = null;
        vessel.location = site.name;
        vessel.isHarvesting = false;
        vessel.actionEndsAt = 0;
        state.harvestsCompleted++;
        openModal(`Harvested ${biomass.toFixed(2)} kg loaded onto ${vessel.name}.`);
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
    vessel.location = `Traveling to ${site.name}`;
    vessel.isHarvesting = true;
    vessel.actionEndsAt = Date.now() + travelTime;
    updateDisplay();
    if(vessel.travelInterval){ clearInterval(vessel.travelInterval); }
    vessel.travelInterval = setInterval(()=>{
      if(state.timePaused) return;
      if(Date.now() >= vessel.actionEndsAt){
        clearInterval(vessel.travelInterval);
        vessel.travelInterval = null;
        vessel.location = site.name;
        performHarvest();
      }
    },250);
  } else {
    vessel.isHarvesting = true;
    performHarvest();
    updateDisplay();
  }
}
```

## Offloading Workflow
1. `sellCargo` chooses a market and locks in prices. If the vessel is elsewhere it travels first using the same travel logic as harvesting.
2. Once at the destination, `startOffloading` repeatedly moves biomass from cargo into revenue at `state.OFFLOAD_RATE` kilograms per second and updates ETA.
3. When no biomass remains, `finishOffloading` credits cash, clears cargo and optionally resets market `daysSinceSale` counters. Canceling calls the same function with a flag to keep remaining cargo.

```javascript
// ui.js excerpt
function startOffloading(vessel, market){
  vessel.unloading = true;
  vessel.offloadRevenue = 0;
  vessel.offloadMarket = market.name;
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
```

## System Interactions
- **Time Manager:** Both loops check `state.timePaused` so progress halts while the game is paused.
- **Vessel Manager:** Travel uses `state.TRAVEL_TIME_FACTOR` and vessel speed for ETA calculations.
- **Market System:** Offload prices come from `market.prices` and `speciesData` modifiers. `finishOffloading` resets `daysSinceSale` counters when cargo is sold.
- **Save/Load Manager:** Non-enumerable timer fields are recreated on load so active harvest or offload actions stop after a refresh.
- **Milestone Tracker:** `state.harvestsCompleted` increments after each successful harvest.

`state.BASE_HARVEST_RATE`, `state.HARVESTER_RATE` and `state.OFFLOAD_RATE` in `gameState.js` control how fast these operations proceed.
