export const bargeTiers = [
  { name: 'Small',  feedCapacity: 200, feederLimit: 2, maxFeederTier: 1, cost: 0 },
  { name: 'Medium', feedCapacity: 500, feederLimit: 4, maxFeederTier: 2, cost: 5000 },
  { name: 'Large',  feedCapacity: 1000, feederLimit: 8, maxFeederTier: 3, cost: 15000 }
];

export const NEW_BARGE_COST = 8000;

export const feedStorageUpgrades = [
  { capacity: 250, cost: 100 }, { capacity: 500, cost: 250 },
  { capacity: 1000, cost: 500 }, { capacity: 2000, cost: 1000 },
  { capacity: 5000, cost: 2500 }, { capacity: 10000, cost: 6000 },
  { capacity: 20000, cost: 12000 }, { capacity: 30000, cost: 20000 }
];

export const STAFF_HIRE_COST = 500;

export const staffRoles = {
  feeder:    { cost: 500,  description: 'Boosts auto feed rate' },
  harvester: { cost: 800,  description: 'Increases harvest capacity' },
  feedManager:{ cost: 1000, description: 'Automatically buys feed' }
};

export const staffHousingUpgrades = [
  { extraCapacity: 2, cost: 1000 },
  { extraCapacity: 2, cost: 2000 },
  { extraCapacity: 4, cost: 4000 }
];

export const speciesData = {
  shrimp: { marketPrice:8, fcr:1.25, startingWeight:0.01, restockCount:500, restockCost:200, licenseCost:0 },
  salmon: { marketPrice:5, fcr:1.5, startingWeight:0.05, restockCount:250, restockCost:400, licenseCost:500 },
  tuna:   { marketPrice:10,fcr:2.0, startingWeight:0.2,  restockCount:100, restockCost:800, licenseCost:1500 }
};

export const feederUpgrades = [
  { type: 'floating',   rate: 1, cost: 500  },
  { type: 'spreader',   rate: 2, cost: 1200 },
  { type: 'underwater', rate: 3, cost: 2500 }
];

export const vesselTiers = [
  { name: 'Small',  maxBiomassCapacity: 1000, speed: 10, cost: 0 },
  { name: 'Medium', maxBiomassCapacity: 2500, speed: 8,  cost: 10000 },
  { name: 'Large',  maxBiomassCapacity: 5000, speed: 6,  cost: 30000 }
];

export const NEW_VESSEL_COST = 12000;

export const siteNamePrefixes = [
  'Driftwood','Stormreach','Gullrock','Cedar','Misty','Haven','Breakwater','Whispering','Duskwater','Salmonstone','SeaLion'
];
export const siteNameSuffixes = ['Sound','Inlet','Bay','Island','Channel','Passage','Lagoon','Rock'];

export const markets = [
  {
    name: 'Capital Wharf',
    location: { x: 0, y: 0 },
    modifiers: { shrimp: 1.0, salmon: 1.1, tuna: 0.9 }
  },
  {
    name: 'East Bay Processing',
    location: { x: 80, y: 60 },
    modifiers: { shrimp: 1.2, salmon: 0.9, tuna: 1.1 }
  }
];
