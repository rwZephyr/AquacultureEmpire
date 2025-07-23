# Aquaculture Empire

Aquaculture Empire is a small browser-based aquaculture management game written in plain HTML, CSS and JavaScript. It lets you run multiple fish farming sites, feed and harvest pens and purchase upgrades without needing any server side components.

## Features
- Manage one or more farming sites. Each site has a barge with feed capacity and a number of pens for raising fish.
- Side panel shop to buy additional feed, upgrade storage and acquire new pens.
- Purchase licenses to farm new species such as shrimp, salmon and tuna.
- Harvest pens for cash, restock them and upgrade automatic feeders.
- Each pen has a tiered auto-feeder path from floating rafts to
  underwater systems with individual upgrade costs.
- Expand your business by buying entirely new sites.
- Development menu with helper buttons to add cash, harvest all pens and restock them for free.
- Progress is automatically saved every 30 seconds.
- Hire and assign staff as feeders, harvesters or feed managers.
- Upgrade staff housing and barge tiers to unlock more automation.
- Operate harvest vessels, move them between sites and markets and sell cargo.
- Interactive map displays sites, markets and vessel locations.
- Game state is saved in local storage so progress persists across sessions.
- In-game time tracks days, seasons and years that advance automatically.
- Each in-game day lasts about 30 seconds by default.

### Time Data
Several read-only time values are exposed on the global `window` object:

- `currentDayInSeason` – day number within the season (1–30)
- `currentSeason` – season name such as "Spring"
- `currentYear` – the current year count
- `totalDaysElapsed` – total days since starting the game

You can also call `getTimeState()` to retrieve these values as an object for
use in mods or custom event hooks.
Call `pauseTime()` to halt all in-game timers and `resumeTime()` to continue.
While paused, day progression, market prices, vessel travel and other timed
activities are completely suspended. Resuming simply continues each task from
the moment it was paused with no time skipped.
Small play (▶️) and pause (⏸️) icons next to the in-game date let you control
this without using the console.

## Getting Started
No build steps are required. Open `index.html` in any modern web browser to start the game. Everything runs locally in the browser.

## File Overview
- `index.html` – markup for the sidebar, top bar and modal dialogs.
- `script.js` – game logic including purchases, feeding, harvesting and UI updates.
- `data.js` – contains constants for species, upgrades and map locations.
- `models.js` – simple ES6 classes for Barges, Pens, Sites and Vessels.
- `style.css` – minimal styling for layout and components.

Feel free to modify `script.js` or `data.js` to tweak starting values, species parameters or upgrade costs.
