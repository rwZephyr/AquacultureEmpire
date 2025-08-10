
class Barge {
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

class Pen {
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

class Site {
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

class Vessel {
  constructor({
    name,
      maxBiomassCapacity = 1000, // TODO: remove after holds migration
      currentBiomassLoad = 0, // TODO: remove after holds migration
      cargo = {},
      cargoSpecies = null, // TODO: remove after holds migration
    holds = null,
    speed = 10,
    location = '',
    upgradeSlots = 2,
    upgrades = [],
    tier = 0,
    status = 'idle',
    destination = null,
    busyUntil = 0,
    // legacy fields
    isHarvesting = false,
    actionEndsAt = 0
  } = {}) {
    this.name = name;
      this.maxBiomassCapacity = maxBiomassCapacity; // TODO: remove after holds migration
      this.currentBiomassLoad = currentBiomassLoad; // TODO: remove after holds migration
    // Deprecated: cargo is maintained for legacy saves but no longer used
    this.cargo = cargo;
      this.cargoSpecies = cargoSpecies; // TODO: remove after holds migration
    this.speed = speed;
    this.location = location;
    this.upgradeSlots = upgradeSlots;
    this.upgrades = upgrades;
    this.tier = tier;
    this.status = status;
    this.destination = destination;
    this.busyUntil = busyUntil;
    // maintain legacy flags for backward compatibility
    this.isHarvesting = status === 'harvesting' ? true : isHarvesting;
    this.actionEndsAt = busyUntil || actionEndsAt;

    // future: support multiple holds; hold[0] mirrors legacy fields
    if (Array.isArray(holds) && holds.length) {
      this.holds = holds.map(h => ({
        species: h?.species ?? null,
        biomass: h?.biomass ?? 0,
          capacity: h?.capacity ?? maxBiomassCapacity, // TODO: remove after holds migration
      }));
    } else {
      this.holds = [{
          species: cargoSpecies, // TODO: remove after holds migration
          biomass: currentBiomassLoad, // TODO: remove after holds migration
          capacity: maxBiomassCapacity, // TODO: remove after holds migration
      }];
    }

    this.unloading = status === 'offloading';
    this.offloadRevenue = 0;
    this.deliveringContractId = null;

    // timers and progress (non-enumerable so they aren't saved)
    Object.defineProperty(this, 'harvestInterval', { value: null, writable: true, enumerable: false });
    Object.defineProperty(this, 'harvestTimeout', { value: null, writable: true, enumerable: false });
    Object.defineProperty(this, 'harvestProgress', { value: 0, writable: true, enumerable: false });
    Object.defineProperty(this, 'harvestFishBuffer', { value: 0, writable: true, enumerable: false });
    // fishBuffer needs to persist so make it enumerable
    this.fishBuffer = [];
    Object.defineProperty(this, 'harvestingPenIndex', { value: null, writable: true, enumerable: false });
    Object.defineProperty(this, 'travelInterval', { value: null, writable: true, enumerable: false });
    Object.defineProperty(this, 'offloadInterval', { value: null, writable: true, enumerable: false });
    Object.defineProperty(this, 'offloadPrices', { value: null, writable: true, enumerable: false });
    Object.defineProperty(this, 'offloadMarket', { value: null, writable: true, enumerable: false });
    Object.defineProperty(this, 'contractInterval', { value: null, writable: true, enumerable: false });
  }
}
