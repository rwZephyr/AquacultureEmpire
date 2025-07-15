// Core Game State
let cash = 200;
let harvestCapacity = 50;
let storageUpgradeLevel = 0;
let penPurchaseCost = 1000;
let currentPenIndex = 0;
let currentSiteIndex = 0;

// Game Data
let sites = [
  {
    name: "Mernan Inlet",
    barge: {
      feed: 100,
      feedCapacity: 100,
      siloCapacity: 1000,
      staffCapacity: 2,
      upgrades: []
    },
    licenses: ['shrimp'],
    pens: [
      { species: "shrimp", fishCount: 500, averageWeight: 0.01 }
    ]
  }
];

// Upgrades & Species
const feedStorageUpgrades = [
  { capacity: 250, cost: 100 }, { capacity: 500, cost: 250 },
  { capacity: 1000, cost: 500 }, { capacity: 2000, cost: 1000 },
  { capacity: 5000, cost: 2500 }, { capacity: 10000, cost: 6000 },
  { capacity: 20000, cost: 12000 }, { capacity: 30000, cost: 20000 }
];
const speciesData = {
  shrimp: { marketPrice:8, fcr:1.25, startingWeight:0.01, restockCount:500, restockCost:200, licenseCost:0 },
  salmon: { marketPrice:5, fcr:1.5, startingWeight:0.05, restockCount:250, restockCost:400, licenseCost:500 },
  tuna:   { marketPrice:10,fcr:2.0, startingWeight:0.2,  restockCount:100, restockCost:800, licenseCost:1500 }
};
const siteNamePrefixes = ["Driftwood","Stormreach","Gullrock","Cedar","Misty","Haven","Breakwater","Whispering","Duskwater","Salmonstone","SeaLion"];
const siteNameSuffixes = ["Sound","Inlet","Bay","Island","Channel","Passage","Lagoon","Rock"];

// UTILITIES
function capitalizeFirstLetter(str){ return str.charAt(0).toUpperCase()+str.slice(1); }
function generateRandomSiteName(){
  const p = siteNamePrefixes[Math.floor(Math.random()*siteNamePrefixes.length)];
  const s = siteNameSuffixes[Math.floor(Math.random()*siteNameSuffixes.length)];
  return `${p} ${s}`;
}

// --- UPDATE UI ---
function updateDisplay(){
  const site = sites[currentSiteIndex];
  const pen  = site.pens[currentPenIndex];

  // top-bar
  document.getElementById('siteName').innerText = site.name;
  document.getElementById('cashCount').innerText = cash.toFixed(2);

  // barge card
  document.getElementById('bargeFeed').innerText         = site.barge.feed.toFixed(1);
  document.getElementById('bargeFeedCapacity').innerText = site.barge.feedCapacity;
  document.getElementById('bargeSiloCapacity').innerText = site.barge.siloCapacity;
  document.getElementById('bargeStaffCapacity').innerText= site.barge.staffCapacity;

  // shop panel info
  if(storageUpgradeLevel < feedStorageUpgrades.length){
    document.getElementById('storageUpgradeInfo').innerText =
      `Next Feed Storage Upgrade: $${feedStorageUpgrades[storageUpgradeLevel].cost}`;
  } else {
    document.getElementById('storageUpgradeInfo').innerText = 'Feed Storage Fully Upgraded';
  }
  document.getElementById('penPurchaseInfo').innerText = `Next Pen Purchase: $${penPurchaseCost.toFixed(0)}`;

  updateHarvestInfo();
  updateLicenseShop();
  renderPenGrid(site);
}

// harvest preview
function updateHarvestInfo(){
  const site = sites[currentSiteIndex];
  const pen  = site.pens[currentPenIndex];
  const infoDiv = document.getElementById('harvestInfo');
  if(pen.fishCount>0){
    const totalBiomass = pen.fishCount * pen.averageWeight;
    const harvestableBiomass = Math.min(harvestCapacity, totalBiomass);
    const earnings = harvestableBiomass * speciesData[pen.species].marketPrice;
    infoDiv.innerText = `Next harvest: ~${harvestableBiomass.toFixed(2)} kg for ~$${earnings.toFixed(2)}`;
  } else {
    infoDiv.innerText = "No fish to harvest.";
  }
}

// license shop
function updateLicenseShop(){
  const licenseDiv = document.getElementById('licenseShop');
  const site = sites[currentSiteIndex];
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
  site.pens.forEach((pen, idx)=>{
    const biomass = pen.fishCount * pen.averageWeight;
    const feederType = pen.feeder?.type||'None';
    const feederTier = pen.feeder?.tier||0;
    const card = document.createElement('div');
    card.className = 'penCard';
    card.innerHTML = `
      <h3>Pen ${idx+1}</h3>
      <div class="stat">Species: ${capitalizeFirstLetter(pen.species)}</div>
      <div class="stat">Fish: ${pen.fishCount}</div>
      <div class="stat">Avg Weight: ${pen.averageWeight.toFixed(2)} kg</div>
      <div class="stat">Biomass: ${biomass.toFixed(2)} kg</div>
      <div class="stat">Feeder: ${capitalizeFirstLetter(feederType)} (Tier ${feederTier})</div>
      <button onclick="feedFishPen(${idx})">Feed</button>
      <button onclick="harvestPenIndex(${idx})">Harvest</button>
      <button onclick="restockPenUI(${idx})">Restock</button>
      <button onclick="upgradeFeeder(${idx})">Upgrade Feeder</button>
    `;
    grid.appendChild(card);
  });
}

// --- MODALS ---
function openModal(msg){ document.getElementById('modalText').innerText=msg; document.getElementById('modal').classList.add('visible'); }
function closeModal(){ document.getElementById('modal').classList.remove('visible'); }
function openRestockModal(){
  const site = sites[currentSiteIndex];
  const pen  = site.pens[currentPenIndex];
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

// --- PURCHASES & ACTIONS ---
function buyFeed(){
  const site = sites[currentSiteIndex];
  if(cash<5) return;
  if(site.barge.feed+20>site.barge.feedCapacity) return openModal("Not enough feed storage space!");
  cash-=5; site.barge.feed+=20; updateDisplay();
}
function buyFeedStorageUpgrade(){
  if(storageUpgradeLevel>=feedStorageUpgrades.length) return openModal("Max feed storage reached!");
  const up = feedStorageUpgrades[storageUpgradeLevel];
  if(cash<up.cost) return openModal("Not enough cash to upgrade feed storage!");
  cash-=up.cost; sites[currentSiteIndex].barge.feedCapacity=up.capacity;
  storageUpgradeLevel++; updateDisplay();
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
  sites.push({
    name: generateRandomSiteName(),
    barge: { feed:100, feedCapacity:100, siloCapacity:1000, staffCapacity:2, upgrades:[] },
    licenses:['shrimp'],
    pens:[{ species:"shrimp", fishCount:500, averageWeight:0.01 }]
  });
  updateDisplay();
  openModal("New site purchased!");
}
function buyNewPen(){
  if(cash<penPurchaseCost) return openModal("Not enough cash to buy a new pen!");
  cash -= penPurchaseCost;
  sites[currentSiteIndex].pens.push({ species:"shrimp", fishCount:0, averageWeight:0 });
  penPurchaseCost *= 1.5;
  updateDisplay();
}

// feed / harvest / restock
function feedFish(){
  const site = sites[currentSiteIndex];
  const pen  = site.pens[currentPenIndex];
  if(site.barge.feed<1 || pen.fishCount===0) return;
  site.barge.feed--;
  const gain = 1 / speciesData[pen.species].fcr;
  pen.averageWeight += gain/pen.fishCount;
}
function harvestPen(){
  const site = sites[currentSiteIndex];
  const pen  = site.pens[currentPenIndex];
  if(pen.fishCount===0) return;
  const totalBiomass = pen.fishCount * pen.averageWeight;
  const harvestable = Math.min(harvestCapacity, totalBiomass);
  let fishNum = Math.floor(harvestable/pen.averageWeight);
  fishNum = Math.min(fishNum, pen.fishCount);
  const biomass = fishNum * pen.averageWeight;
  cash += biomass * speciesData[pen.species].marketPrice;
  pen.fishCount -= fishNum;
  if(pen.fishCount===0) pen.averageWeight = 0;
  openModal(`Harvested ${biomass.toFixed(2)} kg and earned $${(biomass*speciesData[pen.species].marketPrice).toFixed(2)}!`);
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
  const p  = document.getElementById(id);
  if(!sb.classList.contains('open')) sb.classList.add('open');
  document.querySelectorAll('#sidebar .panel').forEach(x=>x.classList.remove('visible'));
  document.querySelectorAll('#sidebarContent button').forEach(x=>x.classList.remove('active'));
  p.classList.add('visible');
  document.getElementById('toggle'+capitalizeFirstLetter(id)).classList.add('active');
}
document.getElementById('toggleSidebar').addEventListener('click',()=>{
  document.getElementById('sidebar').classList.toggle('open');
  if(!document.getElementById('sidebar').classList.contains('open')){
    document.querySelectorAll('#sidebar .panel').forEach(x=>x.classList.remove('visible'));
    document.querySelectorAll('#sidebarContent button').forEach(x=>x.classList.remove('active'));
  }
});

// pen buttons helper
function feedFishPen(i){ currentPenIndex=i; feedFish(); updateDisplay(); }
function harvestPenIndex(i){ currentPenIndex=i; harvestPen(); updateDisplay(); }
function restockPenUI(i){ currentPenIndex=i; openRestockModal(); }
function upgradeFeeder(i){
  const pen = sites[currentSiteIndex].pens[i];
  if(!pen.feeder){
    pen.feeder = { type:'floating', tier:1 };
    openModal("Installed floating feeder (Tier 1).");
  } else if(pen.feeder.tier<3){
    pen.feeder.tier++;
    pen.feeder.type = pen.feeder.tier===2?'spreader':'underwater';
    openModal(`Feeder upgraded to ${capitalizeFirstLetter(pen.feeder.type)} Tier ${pen.feeder.tier}.`);
  } else {
    openModal("Feeder already at max tier.");
  }
}
function getFeederRate(f){ return f?.type==='spreader'?2:(f?.type==='underwater'?3:(f?.type==='floating'?1:0)); }

// --- AUTO-FEED ALL SITES & PENS EVERY SECOND ---
setInterval(()=>{
  sites.forEach(site=>{
    site.pens.forEach(pen=>{
      const rate = getFeederRate(pen.feeder);
      for(let i=0;i<rate;i++){
        if(site.barge.feed>=1 && pen.fishCount>0){
          site.barge.feed--;
          const gain = 1 / speciesData[pen.species].fcr;
          pen.averageWeight += gain/pen.fishCount;
        }
      }
    });
  });
  updateDisplay();
},1000);

// site/pen nav
function previousSite(){ if(currentSiteIndex>0) currentSiteIndex--; currentPenIndex=0; updateDisplay(); }
function nextSite(){ if(currentSiteIndex<sites.length-1) currentSiteIndex++; currentPenIndex=0; updateDisplay(); }

// Initialize
document.addEventListener("DOMContentLoaded",()=>updateDisplay());
