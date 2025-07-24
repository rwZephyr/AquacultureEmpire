# Systems Overview

Aquaculture Empire is organized into several functional modules. Each plays a role similar to an "agent" responsible for a slice of the game loop. Use this guide when diving into the codebase or planning AI driven behaviors.

## Time Manager
- **Purpose:** Drives the in‑game calendar and handles seasonal progression.
- **Key Functions:** `advanceDay`, `advanceDays`, `pauseTime`, `resumeTime`, `getDateString` in `gameState.js`.
- **Interactions:** Called every real-time interval. Other systems query `currentDayInSeason`, `currentSeason`, and `currentYear` from the exposed getters.

## Market System
- **Purpose:** Simulates dynamic fish prices at trading hubs.
- **Key Files/Functions:** Market constants in `data.js`; `setupMarketData` and `updateMarketPrices` in `gameState.js`.
- **Interactions:** Vessels sell cargo to markets using prices maintained by this system. Prices update daily and track recent history for charts.

## Resource Manager
- **Purpose:** Handles feed storage, automatic feeders, and staff-driven feed purchases.
- **Key Files/Functions:** `buyFeed`, `buyFeedStorageUpgrade`, auto-feeding loops in `actions.js`.
- **Interactions:** Uses state from barges and pens. Feed managers automatically purchase feed when below a threshold.

## Harvest Logic
- **Purpose:** Manages fish growth, vessel harvest operations, and restocking.
- **Key Functions:** `feedFish`, `harvestPen`, `confirmHarvest`, and `restockPen` in `actions.js`.
- **Interactions:** Works closely with the Vessel Manager for biomass capacity and with the UI Renderer for modal prompts.

## Vessel Manager
- **Purpose:** Controls vessel construction, upgrades, travel, and cargo selling.
- **Key Files/Functions:** `buyNewVessel`, `moveVesselTo`, `sellCargo`, and shipyard functions across `actions.js` and `ui.js`.
- **Interactions:** Vessels move between sites and markets on the map, respecting travel time calculations from `gameState.js`.

## Save/Load Manager
- **Purpose:** Persists game progress to local storage and handles offline simulation.
- **Key Functions:** `saveGame`, `loadGame`, and `simulateOfflineProgress` in `actions.js`.
- **Interactions:** Triggered on page load and every 30 seconds. When returning after a break, it advances time and feeds fish as if the game kept running.

## UI Renderer
- **Purpose:** Updates on-screen stats, handles modals, and renders the map and market reports.
- **Key Files/Functions:** The majority of `ui.js`, particularly `updateDisplay`, `renderMap`, and `openMarketReport`.
- **Interactions:** Consumes state from other systems and exposes HTML elements for player input. Actions from buttons call functions in `actions.js`.

## Data & Models
- **Purpose:** Stores configuration values and data classes for sites, barges, pens, and vessels.
- **Key Files:** `data.js` (constants) and `models.js` (ES6 classes).
- **Interactions:** Other modules import these values to construct game objects and enforce upgrade limits.

## Module Map
```
index.html   -> page layout and template elements
script.js    -> startup wiring; imports actions and UI modules
models.js    -> base classes for Barge, Pen, Site, Vessel
data.js      -> numeric constants and upgrade definitions
gameState.js -> global state container and time/market utilities
actions.js   -> player actions, automation loops, save/load
ui.js        -> DOM updates, modals, map rendering, charts
```
Use this document as an entry point when planning contributions or implementing automated behaviors. Each section corresponds to a logical subsystem that can be swapped or extended independently.
