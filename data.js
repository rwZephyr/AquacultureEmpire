export const bargeTiers = [
  { name: 'Small',  feedCapacity: 200, feederLimit: 2, maxFeederTier: 1, cost: 0 },
  { name: 'Medium', feedCapacity: 500, feederLimit: 4, maxFeederTier: 2, cost: 5000 },
  { name: 'Large',  feedCapacity: 1000, feederLimit: 8, maxFeederTier: 3, cost: 15000 }
];

export const DEFAULT_FEEDER_LIMIT = bargeTiers[0].feederLimit;
export const DEFAULT_MAX_FEEDER_TIER = bargeTiers[0].maxFeederTier;

export const NEW_BARGE_COST = 8000;

export const siloUpgrades = [
  { level: 0, feedCapacity: 200,  cost: 0 },
  { level: 1, feedCapacity: 500,  cost: 2500 },
  { level: 2, feedCapacity: 1000, cost: 7500 },
  { level: 3, feedCapacity: 2000, cost: 15000 }
];

export const blowerUpgrades = [
  { level: 0, rate: 1, cost: 0 },
  { level: 1, rate: 2, cost: 3000 },
  { level: 2, rate: 3, cost: 8000 },
  { level: 3, rate: 4, cost: 16000 }
];

export const housingUpgrades = [
  { level: 0, staffCapacity: 2, cost: 0 },
  { level: 1, staffCapacity: 4, cost: 4000 },
  { level: 2, staffCapacity: 6, cost: 9000 },
  { level: 3, staffCapacity: 8, cost: 18000 }
];

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
  shrimp: {
    marketPrice: 8,
    fcr: 1.25,
    startingWeight: 0.01,
    restockCount: 500,
    restockCost: 200,
    licenseCost: 0,
    maxWeight: 0.05,
    tags: ["starter", "fast-grow", "low-margin"]
  },
  salmon: {
    marketPrice: 5,
    fcr: 1.5,
    startingWeight: 0.05,
    restockCount: 250,
    restockCost: 400,
    licenseCost: 500,
    maxWeight: 6,
    tags: ["standard", "coldwater"]
  },
  tuna: {
    marketPrice: 10,
    fcr: 2.0,
    startingWeight: 0.2,
    restockCount: 100,
    restockCost: 800,
    licenseCost: 1500,
    maxWeight: 20,
    tags: ["premium", "late-game", "offshore"]
  },
  tilapia: {
    marketPrice: 3.5,
    fcr: 1.2,
    startingWeight: 0.03,
    restockCount: 400,
    restockCost: 150,
    licenseCost: 250,
    maxWeight: 2,
    tags: ["cheap", "fast-grow", "warmwater"]
  },
  barramundi: {
    marketPrice: 6,
    fcr: 1.3,
    startingWeight: 0.04,
    restockCount: 300,
    restockCost: 350,
    licenseCost: 750,
    maxWeight: 4,
    tags: ["balanced", "warmwater"]
  },
  cod: {
    marketPrice: 7.5,
    fcr: 1.6,
    startingWeight: 0.07,
    restockCount: 200,
    restockCost: 500,
    licenseCost: 1000,
    maxWeight: 7,
    tags: ["stable", "coldwater", "mid-tier"]
  },
  grouper: {
    marketPrice: 12,
    fcr: 2.5,
    startingWeight: 0.25,
    restockCount: 80,
    restockCost: 1000,
    licenseCost: 2000,
    maxWeight: 12,
    tags: ["premium", "deepwater", "slow-grow"]
  }
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

export const vesselClasses = {
  skiff: {
    name: 'Skiff',
    baseCapacity: 800,
    baseSpeed: 12,
    slots: 2,
    cost: 5000
  },
  lobsterBoat: {
    name: 'Lobster Boat',
    baseCapacity: 2000,
    baseSpeed: 9,
    slots: 3,
    cost: 15000
  },
  retiredTrawler: {
    name: 'Retired Trawler',
    baseCapacity: 4000,
    baseSpeed: 7,
    slots: 4,
    cost: 30000
  },
  wellboat: {
    name: 'Wellboat',
    baseCapacity: 6000,
    baseSpeed: 5,
    slots: 6,
    cost: 60000
  }
};

export const vesselUnlockDays = {
  lobsterBoat: 30,
  retiredTrawler: 60,
  wellboat: 120
};

export const vesselNamePrefixes = [
  'Sea', 'Wave', 'Storm', 'Lucky', 'Salty', 'Swift', 'Coral', 'Northern', 'Coastal', 'Rapid', 'Brazen', 'Lady', 'Sir' 
];
export const vesselNameSuffixes = [
  'Runner', 'Queen', 'Voyager', 'Dream', 'Star', 'Dawn', 'Breeze', 'Spirit', 'Nightmare', 'Squall', 'Cloud', 'Tidus','Flotsam'
];

export const NEW_VESSEL_COST = 12000;

export const CUSTOM_BUILD_MARKUP = 1.25;

export const siteNamePrefixes = [
  'Driftwood','Stormreach','Gullrock','Cedar','Misty','Haven','Breakwater','Whispering','Duskwater','Salmonstone','SeaLion'
];
export const siteNameSuffixes = ['Sound','Inlet','Bay','Island','Channel','Passage','Lagoon','Rock'];

export const markets = [
  {
    name: 'Capital Wharf',
    location: { x: 10, y: 80 },
    modifiers: {
      shrimp: 1.0,
      salmon: 1.1,
      tuna: 0.9,
      tilapia: 1.0,
      barramundi: 1.0,
      cod: 1.0,
      grouper: 1.0
    }
  },
  {
    name: 'East Bay Processing',
    location: { x: 80, y: 85 },
    modifiers: {
      shrimp: 1.2,
      salmon: 0.9,
      tuna: 1.1,
      tilapia: 1.0,
      barramundi: 1.0,
      cod: 1.0,
      grouper: 1.0
    }
  }
];
