// Global contracts list uses shared game state
let contracts = [];

// Capitalize helper replicated here to keep module independent
function capitalizeFirstLetter(str){
  if(!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function initContracts(){
  if(!state.contracts) state.contracts = [];
  if(!state.contractsCompletedByTier) state.contractsCompletedByTier = {};
  if(!state.unlockedContractTiers) state.unlockedContractTiers = [0];
  contracts = state.contracts;
  // seed a starter contract for the logbook
  if(contracts.length === 0){
    contracts.push({
      id: 1,
      tier: 0,
      species: 'shrimp',
      type: 'biomass',
      biomassGoalKg: 100,
      destination: 'Capital Wharf',
      startDay: state.totalDaysElapsed,
      durationDays: 10,
      rewardCash: 500,
      priceMultiplier: 1.15,
      flavorKey: 'basicDelivery',
      buyer: 'Local Co-op',
      status: 'active',
      reminders: {}
    });
  }
}

const contractFlavors = {
  basicDelivery: "Ship {species} to {destination} on time.",
  bigOrder: "A bulk request for {species} has come in from {destination}.",
};

const contractTiers = [
  {
    tier: 0,
    biomassRange: [50, 300],
    rewardMultiplier: 1.1,
    priceMultiplier: 1.1,
    flavorKeys: ['basicDelivery'],
    minContractsFulfilled: 0,
  },
  {
    tier: 1,
    biomassRange: [300, 1000],
    rewardMultiplier: 1.3,
    priceMultiplier: 1.15,
    flavorKeys: ['basicDelivery', 'bigOrder'],
    minContractsFulfilled: 3,
  },
  {
    tier: 2,
    biomassRange: [1000, 2500],
    rewardMultiplier: 1.5,
    priceMultiplier: 1.25,
    flavorKeys: ['bigOrder'],
    minContractsFulfilled: 8,
  },
];

function selectBuyerForTier(tier){
  if(!contractBuyers) return null;
  const options = contractBuyers.filter(b=>!b.tiers || b.tiers.includes(tier));
  if(options.length === 0) return null;
  return options[Math.floor(Math.random()*options.length)].name;
}

function rollContractTier(){
  const unlocked = state.unlockedContractTiers || [0];
  const weights = {0:0.6,1:0.3,2:0.1};
  const total = unlocked.reduce((sum,t)=>sum+(weights[t]||0),0);
  let r = Math.random()*total;
  for(const t of unlocked){
    r -= (weights[t]||0);
    if(r<=0) return t;
  }
  return unlocked[0];
}

function generateDailyContracts(count=2){
  for(let i=0;i<count;i++){
    const tierIdx = rollContractTier();
    const meta = contractTiers.find(t=>t.tier===tierIdx);
    if(!meta) continue;
    const speciesKeys = Object.keys(speciesData);
    const species = speciesKeys[Math.floor(Math.random()*speciesKeys.length)];
    const biomass = Math.round(meta.biomassRange[0] + Math.random()*(meta.biomassRange[1]-meta.biomassRange[0]));
    const flavor = meta.flavorKeys[Math.floor(Math.random()*meta.flavorKeys.length)];
    const market = markets[Math.floor(Math.random()*markets.length)];
    const base = speciesData[species].marketPrice;
    const reward = Math.round(biomass * base * meta.rewardMultiplier);
    const id = contracts.length>0 ? Math.max(...contracts.map(c=>c.id))+1 : 1;
    contracts.push({
      id,
      tier: tierIdx,
      species,
      type:'biomass',
      biomassGoalKg: biomass,
      destination: market.name,
      startDay: state.totalDaysElapsed,
      durationDays: 10,
      rewardCash: reward,
      priceMultiplier: meta.priceMultiplier,
      flavorKey: flavor,
      buyer: selectBuyerForTier(tierIdx),
      status:'active',
      reminders:{}
    });
  }
}

function checkContractTierUnlocks(){
  contractTiers.forEach(tier=>{
    if(state.unlockedContractTiers.includes(tier.tier)) return;
    const completed = state.contractsCompletedByTier[tier.tier] || 0;
    if(completed >= (tier.minContractsFulfilled||0)){
      state.unlockedContractTiers.push(tier.tier);
      state.addStatusMessage(`New contract tier ${tier.tier} unlocked!`);
    }
  });
}

function getContractFlavor(contract){
  let text = contractFlavors[contract.flavorKey] || '';
  return text
    .replace('{species}', capitalizeFirstLetter(contract.species))
    .replace('{destination}', contract.destination);
}

function checkContractExpirations(){
  contracts.forEach(c => {
    if(c.status === 'active' && state.totalDaysElapsed > c.startDay + c.durationDays){
      c.status = 'expired';
      if(c.reminders) c.reminders = {};
    }
  });
}

function getEligibleVessels(contract){
  return state.vessels.filter(v => {
    const hold = v.holds?.[0];
    return !v.isHarvesting && !v.unloading && !v.deliveringContractId &&
      hold?.species === contract.species &&
      hold.biomass >= contract.biomassGoalKg;
  });
}

function checkVesselContractEligibility(vessel){
  contracts.forEach(c => {
    if(c.status !== 'active') return;
    if(!c.reminders) c.reminders = {};
    if(c.reminders[vessel.name]) return;
    const hold = vessel.holds?.[0];
    if(hold?.species === c.species && hold.biomass >= c.biomassGoalKg){
      state.addStatusMessage(`✅ ${vessel.name} can now fulfill a contract for ${capitalizeFirstLetter(c.species)}! Check the Contracts screen.`);
      c.reminders[vessel.name] = true;
    }
  });
}

function openContractDeliveryModal(id){
  const contract = contracts.find(c=>c.id===id);
  if(!contract) return;
  const optionsDiv = document.getElementById('contractDeliveryOptions');
  if(!optionsDiv) return;
  optionsDiv.innerHTML = '';
  const vessels = getEligibleVessels(contract);
  if(vessels.length === 0) return state.addStatusMessage('No eligible vessels.');
  if(vessels.length === 1){
    deliverContract(id, state.vessels.indexOf(vessels[0]));
    return;
  }
  vessels.forEach(v => {
    const btn = document.createElement('button');
    btn.textContent = v.name;
    btn.onclick = ()=>{ deliverContract(id, state.vessels.indexOf(v)); closeContractDeliveryModal(); };
    optionsDiv.appendChild(btn);
  });
  document.getElementById('contractDeliveryModal').classList.add('visible');
}

function closeContractDeliveryModal(){
  const modal = document.getElementById('contractDeliveryModal');
  if(modal) modal.classList.remove('visible');
}

function finishContractDelivery(vessel, contract){
    vessel.location = contract.destination;
    vessel.deliveringContractId = null;
    const hold = vessel.holds?.[0];
    let remaining = contract.biomassGoalKg;
    for(let i=0;i<vessel.fishBuffer.length && remaining>0;){
      const fish = vessel.fishBuffer[i];
      if(fish.weight <= remaining){
        remaining -= fish.weight;
        if(hold) hold.biomass -= fish.weight;
        vessel.fishBuffer.splice(i,1);
      } else {
        fish.weight -= remaining;
        if(hold) hold.biomass -= remaining;
        remaining = 0;
      }
    }
    if(hold && hold.biomass <= 0.001){
      hold.biomass = 0;
      hold.species = null;
      vessel.cargoSpecies = null; // TODO: remove after holds migration
      vessel.currentBiomassLoad = 0; // TODO: remove after holds migration
    } else if(hold){
      vessel.cargoSpecies = hold.species; // TODO: remove after holds migration
      vessel.currentBiomassLoad = hold.biomass; // TODO: remove after holds migration
    }
  const base = speciesData[contract.species]?.marketPrice || 0;
  const market = state.findMarketByName(contract.destination);
  let payout = contract.biomassGoalKg * base;
  if(market) payout *= (market.modifiers[contract.species] || 1);
  payout *= (contract.priceMultiplier || 1.1);
  state.cash += payout;
  const tier = contract.tier || 0;
  if(!state.contractsCompletedByTier[tier]) state.contractsCompletedByTier[tier] = 0;
  state.contractsCompletedByTier[tier]++;
  checkContractTierUnlocks();
  contract.status = 'fulfilled';
  if(contract.reminders) contract.reminders = {};
  state.addStatusMessage(`Contract fulfilled for $${payout.toFixed(2)}.`);
  closeContractDeliveryModal();
  if(typeof updateDisplay === 'function') updateDisplay();
}

function deliverContract(id, vIdx){
  const contract = contracts.find(c=>c.id===id);
  if(!contract || contract.status !== 'active') return state.addStatusMessage('Contract unavailable.');
  const vessel = state.vessels[vIdx];
  if(!vessel || vessel.isHarvesting || vessel.unloading || vessel.deliveringContractId)
    return state.addStatusMessage('Vessel currently busy.');
    const hold = vessel.holds?.[0];
    if(!hold || hold.species !== contract.species || hold.biomass < contract.biomassGoalKg)
      return state.addStatusMessage('Vessel lacks required cargo.');
  const market = state.findMarketByName(contract.destination);
  const destLoc = market ? market.location : null;
  const startLoc = state.getLocationByName(vessel.location) || (market ? market.location : {x:0,y:0});
  let travelTime = 10000;
  if(destLoc){
    const dx = startLoc.x - destLoc.x;
    const dy = startLoc.y - destLoc.y;
    const dist = Math.hypot(dx, dy);
    travelTime = dist / vessel.speed * state.TRAVEL_TIME_FACTOR;
  }
  vessel.location = `Traveling to ${contract.destination}`;
  vessel.actionEndsAt = Date.now() + travelTime;
  vessel.deliveringContractId = contract.id;
  if(vessel.travelInterval){ clearInterval(vessel.travelInterval); }
  vessel.travelInterval = setInterval(()=>{
    if(state.timePaused) return;
    if(Date.now() >= vessel.actionEndsAt){
      clearInterval(vessel.travelInterval);
      vessel.travelInterval = null;
      vessel.actionEndsAt = 0;
      finishContractDelivery(vessel, contract);
    }
  },250);
}

function renderContracts(){
  const container = document.getElementById('contractsPlaceholder');
  if(!container) return;
  container.innerHTML = '';
  const now = state.totalDaysElapsed;
  const activeContracts = contracts.filter(c =>
    c.status === 'active' && now <= c.startDay + c.durationDays
  );
  activeContracts.sort((a,b)=>{
    const aEligible = getEligibleVessels(a).length>0;
    const bEligible = getEligibleVessels(b).length>0;
    if(aEligible && !bEligible) return -1;
    if(!aEligible && bEligible) return 1;
    return 0;
  });
  activeContracts.forEach(c => {
    const endDay = c.startDay + c.durationDays;
    const row = document.createElement('div');
    row.className = 'contract-entry';

    const img = document.createElement('img');
    img.src = `assets/species-icons/${c.species}.png`;
    img.alt = c.species;
    img.className = 'contract-species-icon';

    const info = document.createElement('div');
    info.className = 'contract-info';

    const title = document.createElement('div');
    title.className = 'contract-title';
    const desc = c.type === 'biomass'
      ? `Deliver ${c.biomassGoalKg}kg`
      : `Deliver ${c.targetCount} fish at ${c.minWeightKg}kg+`;
    title.textContent = `${capitalizeFirstLetter(c.species)} – ${desc}`;

    const dest = document.createElement('div');
    dest.textContent = `Destination: ${c.destination}`;

    const time = document.createElement('div');
    time.textContent = `Days left: ${endDay - now}`;

    const reward = document.createElement('div');
    reward.textContent = `Reward: $${c.rewardCash}`;

    const buyer = document.createElement('div');
    if(c.buyer) buyer.textContent = `Buyer: ${c.buyer}`;

    const flavor = document.createElement('div');
    flavor.className = 'contract-flavor';
    flavor.textContent = getContractFlavor(c);

    const btn = document.createElement('button');
    btn.textContent = 'Deliver to Contract';
    const eligible = getEligibleVessels(c);
    if(eligible.length > 0){
      row.classList.add('eligible');
      btn.onclick = ()=>openContractDeliveryModal(c.id);
    } else {
      btn.disabled = true;
    }

    info.appendChild(title);
    info.appendChild(dest);
    info.appendChild(time);
    info.appendChild(reward);
    if(c.buyer) info.appendChild(buyer);
    info.appendChild(flavor);
    info.appendChild(btn);

    row.appendChild(img);
    row.appendChild(info);
    container.appendChild(row);
  });
}

// expose contract helpers globally for existing event handlers
const contractAPI = {
  initContracts,
  renderContracts,
  openContractDeliveryModal,
  closeContractDeliveryModal,
  deliverContract,
  checkVesselContractEligibility,
};

for (const key in contractAPI) {
  window[key] = (...args) => window.bootGuard(() => contractAPI[key](...args));
}
