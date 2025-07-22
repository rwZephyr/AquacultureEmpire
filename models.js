export class Barge {
  constructor({
    feed = 100,
    feedCapacity,
    siloCapacity = 1000,
    staffCapacity = 2,
    tier = 0,
    feederLimit,
    maxFeederTier,
    upgrades = [],
    storageUpgradeLevel = 0,
    housingUpgradeLevel = 0
  } = {}) {
    this.feed = feed;
    this.feedCapacity = feedCapacity;
    this.siloCapacity = siloCapacity;
    this.staffCapacity = staffCapacity;
    this.tier = tier;
    this.feederLimit = feederLimit;
    this.maxFeederTier = maxFeederTier;
    this.upgrades = upgrades;
    this.storageUpgradeLevel = storageUpgradeLevel;
    this.housingUpgradeLevel = housingUpgradeLevel;
  }
}

export class Pen {
  constructor({
    species = 'shrimp',
    fishCount = 0,
    averageWeight = 0,
    bargeIndex = 0,
    feeder = null
  } = {}) {
    this.species = species;
    this.fishCount = fishCount;
    this.averageWeight = averageWeight;
    this.bargeIndex = bargeIndex;
    this.feeder = feeder;
  }
}

export class Site {
  constructor({
    name,
    location = { x: 0, y: 0 },
    barges = [],
    staff = [],
    licenses = [],
    pens = []
  } = {}) {
    this.name = name;
    this.location = location;
    this.barges = barges;
    this.staff = staff;
    this.licenses = licenses;
    this.pens = pens;
  }
}

export class Vessel {
  constructor({
    name,
    maxBiomassCapacity = 1000,
    currentBiomassLoad = 0,
    cargo = {},
    speed = 10,
    location = '',
    tier = 0,
    isHarvesting = false
  } = {}) {
    this.name = name;
    this.maxBiomassCapacity = maxBiomassCapacity;
    this.currentBiomassLoad = currentBiomassLoad;
    this.cargo = cargo;
    this.speed = speed;
    this.location = location;
    this.tier = tier;
    this.isHarvesting = isHarvesting;
  }
}
