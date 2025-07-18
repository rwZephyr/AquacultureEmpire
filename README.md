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
- Development menu with a helper button to add cash instantly.
- Progress is automatically saved every 30 seconds.
- Hire and assign staff as feeders, harvesters or feed managers.
- Upgrade staff housing and barge tiers to unlock more automation.
- Operate harvest vessels, move them between sites and markets and sell cargo.
- Interactive map displays sites, markets and vessel locations.
- Game state is saved in local storage so progress persists across sessions.

## Getting Started
No build steps are required. Open `index.html` in any modern web browser to start the game. Everything runs locally in the browser.

## File Overview
- `index.html` – markup for the sidebar, top bar and modal dialogs.
- `script.js` – game logic including purchases, feeding, harvesting and UI updates.
- `data.js` – contains constants for species, upgrades and map locations.
- `models.js` – simple ES6 classes for Barges, Pens, Sites and Vessels.
- `style.css` – minimal styling for layout and components.

Feel free to modify `script.js` or `data.js` to tweak starting values, species parameters or upgrade costs.
