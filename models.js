import { siloUpgrades, blowerUpgrades, housingUpgrades, DEFAULT_FEEDER_LIMIT, DEFAULT_MAX_FEEDER_TIER } from './data.js';

export class Barge {
  constructor({
    feed = 100,
    feedCapacity = siloUpgrades[0].feedCapacity,
    siloCapacity = 1000,
    staffCapacity = housingUpgrades[0].staffCapacity,
    feederLimit = DEFAULT_FEEDER_LIMIT,
    maxFeederTier = DEFAULT_MAX_FEEDER_TIER,
    upgrades = [],
    storageUpgradeLevel = 0,
    housingUpgradeLevel = 0,
    siloUpgradeLevel = 0,
    blowerUpgradeLevel = 0,
    feedRateMultiplier = blowerUpgrades[0].rate
  } = {}) {
    this.feed = feed;
    this.feedCapacity = feedCapacity;
    this.siloCapacity = siloCapacity;
    this.staffCapacity = staffCapacity;
    this.feederLimit = feederLimit;
    this.maxFeederTier = maxFeederTier;
    this.upgrades = upgrades;
    this.storageUpgradeLevel = storageUpgradeLevel;
    this.housingUpgradeLevel = housingUpgradeLevel;
    this.siloUpgradeLevel = siloUpgradeLevel;
    this.blowerUpgradeLevel = blowerUpgradeLevel;
    this.feedRateMultiplier = feedRateMultiplier;
  }
}

export class Pen {
  constructor({
    species = 'shrimp',
    fishCount = 0,
    averageWeight = 0,
    bargeIndex = 0,
    feeder = null,
    locked = false
  } = {}) {
    this.species = species;
    this.fishCount = fishCount;
    this.averageWeight = averageWeight;
    this.bargeIndex = bargeIndex;
    this.feeder = feeder;
    this.locked = locked;
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
    cargoSpecies = null,
    speed = 10,
    location = '',
    upgradeSlots = 2,
    upgrades = [],
    tier = 0,
    isHarvesting = false,
    actionEndsAt = 0
  } = {}) {
    this.name = name;
    this.maxBiomassCapacity = maxBiomassCapacity;
    this.currentBiomassLoad = currentBiomassLoad;
    this.cargo = cargo;
    this.cargoSpecies = cargoSpecies;
    this.speed = speed;
    this.location = location;
    this.upgradeSlots = upgradeSlots;
    this.upgrades = upgrades;
    this.tier = tier;
    this.isHarvesting = isHarvesting;
    this.actionEndsAt = actionEndsAt;

    this.unloading = false;
    this.offloadRevenue = 0;

    // timers and progress (non-enumerable so they aren't saved)
    Object.defineProperty(this, 'harvestInterval', { value: null, writable: true, enumerable: false });
    Object.defineProperty(this, 'harvestTimeout', { value: null, writable: true, enumerable: false });
    Object.defineProperty(this, 'harvestProgress', { value: 0, writable: true, enumerable: false });
    Object.defineProperty(this, 'harvestFishBuffer', { value: 0, writable: true, enumerable: false });
    Object.defineProperty(this, 'fishBuffer', { value: [], writable: true, enumerable: false });
    Object.defineProperty(this, 'harvestingPenIndex', { value: null, writable: true, enumerable: false });
    Object.defineProperty(this, 'travelInterval', { value: null, writable: true, enumerable: false });
    Object.defineProperty(this, 'offloadInterval', { value: null, writable: true, enumerable: false });
    Object.defineProperty(this, 'offloadPrices', { value: null, writable: true, enumerable: false });
    Object.defineProperty(this, 'offloadMarket', { value: null, writable: true, enumerable: false });
  }
}
