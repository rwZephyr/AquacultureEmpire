// Local state reference initialized via initContracts to avoid circular imports
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
      flavorKey: 'basicDelivery',
      status: 'active',
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
    }
  });
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

    info.appendChild(title);
    info.appendChild(dest);
    info.appendChild(time);
    info.appendChild(reward);
    info.appendChild(flavor);

    row.appendChild(img);
    row.appendChild(info);
    container.appendChild(row);
  });
}

export { contracts };
