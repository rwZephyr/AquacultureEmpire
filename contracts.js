// Local state reference initialized via initContracts to avoid circular imports
import { updateDisplay } from './ui.js';
import { speciesData } from './data.js';
let state;
let contracts = [];

// Capitalize helper replicated here to keep module independent
function capitalizeFirstLetter(str){
  if(!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function initContracts(gameState){
  state = gameState;
  if(!state.contracts) state.contracts = [];
  contracts = state.contracts;
  // seed a starter contract for the logbook
  if(contracts.length === 0){
    contracts.push({
      id: 1,
      species: 'shrimp',
      type: 'biomass',
      biomassGoalKg: 100,
      destination: 'Capital Wharf',
      startDay: state.totalDaysElapsed,
      durationDays: 10,
      rewardCash: 500,
      priceMultiplier: 1.15,
      flavorKey: 'basicDelivery',
      status: 'active',
      reminders: {}
    });
  }
}

export const contractFlavors = {
  basicDelivery: "Ship {species} to {destination} on time.",
  bigOrder: "A bulk request for {species} has come in from {destination}.",
};

export function getContractFlavor(contract){
  let text = contractFlavors[contract.flavorKey] || '';
  return text
    .replace('{species}', capitalizeFirstLetter(contract.species))
    .replace('{destination}', contract.destination);
}

export function checkContractExpirations(){
  contracts.forEach(c => {
    if(c.status === 'active' && state.totalDaysElapsed > c.startDay + c.durationDays){
      c.status = 'expired';
      if(c.reminders) c.reminders = {};
    }
  });
}

function getEligibleVessels(contract){
  return state.vessels.filter(v =>
    !v.isHarvesting && !v.unloading && !v.deliveringContractId &&
    v.cargoSpecies === contract.species &&
    v.currentBiomassLoad >= contract.biomassGoalKg
  );
}

export function checkVesselContractEligibility(vessel){
  contracts.forEach(c => {
    if(c.status !== 'active') return;
    if(!c.reminders) c.reminders = {};
    if(c.reminders[vessel.name]) return;
    if(vessel.cargoSpecies === c.species && vessel.currentBiomassLoad >= c.biomassGoalKg){
      state.addStatusMessage(`✅ ${vessel.name} can now fulfill a contract for ${capitalizeFirstLetter(c.species)}! Check the Contracts screen.`);
      c.reminders[vessel.name] = true;
    }
  });
}

export function openContractDeliveryModal(id){
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

export function closeContractDeliveryModal(){
  const modal = document.getElementById('contractDeliveryModal');
  if(modal) modal.classList.remove('visible');
}

function finishContractDelivery(vessel, contract){
  vessel.location = contract.destination;
  vessel.deliveringContractId = null;
  let remaining = contract.biomassGoalKg;
  for(let i=0;i<vessel.fishBuffer.length && remaining>0;){
    const fish = vessel.fishBuffer[i];
    if(fish.weight <= remaining){
      remaining -= fish.weight;
      vessel.currentBiomassLoad -= fish.weight;
      vessel.fishBuffer.splice(i,1);
    } else {
      fish.weight -= remaining;
      vessel.currentBiomassLoad -= remaining;
      remaining = 0;
    }
  }
  if(vessel.currentBiomassLoad <= 0.001){
    vessel.currentBiomassLoad = 0;
    vessel.cargoSpecies = null;
  }
  const base = speciesData[contract.species]?.marketPrice || 0;
  const market = state.findMarketByName(contract.destination);
  let payout = contract.biomassGoalKg * base;
  if(market) payout *= (market.modifiers[contract.species] || 1);
  payout *= (contract.priceMultiplier || 1.1);
  state.cash += payout;
  contract.status = 'fulfilled';
  if(contract.reminders) contract.reminders = {};
  state.addStatusMessage(`Contract fulfilled for $${payout.toFixed(2)}.`);
  closeContractDeliveryModal();
  if(typeof updateDisplay === 'function') updateDisplay();
}

export function deliverContract(id, vIdx){
  const contract = contracts.find(c=>c.id===id);
  if(!contract || contract.status !== 'active') return state.addStatusMessage('Contract unavailable.');
  const vessel = state.vessels[vIdx];
  if(!vessel || vessel.isHarvesting || vessel.unloading || vessel.deliveringContractId)
    return state.addStatusMessage('Vessel currently busy.');
  if(vessel.cargoSpecies !== contract.species || vessel.currentBiomassLoad < contract.biomassGoalKg)
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

export function renderContracts(){
  const container = document.getElementById('contractsPlaceholder');
  if(!container) return;
  container.innerHTML = '';
  const now = state.totalDaysElapsed;
  contracts.forEach(c => {
    const endDay = c.startDay + c.durationDays;
    if(c.status !== 'active' || now > endDay) return;
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

    const flavor = document.createElement('div');
    flavor.className = 'contract-flavor';
    flavor.textContent = getContractFlavor(c);

    const btn = document.createElement('button');
    btn.textContent = 'Deliver to Contract';
    const eligible = getEligibleVessels(c);
    if(eligible.length > 0){
      btn.onclick = ()=>openContractDeliveryModal(c.id);
    } else {
      btn.disabled = true;
    }

    info.appendChild(title);
    info.appendChild(dest);
    info.appendChild(time);
    info.appendChild(reward);
    info.appendChild(flavor);
    info.appendChild(btn);

    row.appendChild(img);
    row.appendChild(info);
    container.appendChild(row);
  });
}

export { contracts };
