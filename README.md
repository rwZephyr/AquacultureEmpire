# Aquaculture Empire

Aquaculture Empire is a lightweight browser-based aquaculture management game. Everything runs locally in your browser using plain HTML, CSS and JavaScript. You can operate multiple farming sites, hire staff, upgrade equipment and grow your business without any server side dependencies.

![Screenshot Placeholder](docs/screenshot.png)

The most up-to-date build is available on **GitHub Pages**, so you can play online or deploy your own fork with zero server setup.

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

### Time Data
Several read-only time values are exposed on the global `window` object:

- `currentDayInSeason` – day number within the season (1–30)
- `currentSeason` – season name such as "Spring"
- `currentYear` – the current year count
- `totalDaysElapsed` – total days since starting the game

You can also call `getTimeState()` to retrieve these values as an object for
use in mods or custom event hooks.

## Quickstart
1. Clone or fork the repository:
   ```bash
   git clone https://github.com/yourusername/AquacultureEmpire.git
   cd AquacultureEmpire
   ```
2. (Optional) launch a simple local server to test changes:
   ```bash
   python3 -m http.server
   ```
   Then open your browser at [http://localhost:8000](http://localhost:8000).
3. You can also deploy directly to **GitHub Pages**. The latest build of this game is hosted there, so no self‑hosting is required.

## Module Breakdown
- `index.html` – markup for the sidebar, top bar and modal dialogs.
- `style.css` – minimal styling for layout and components.
- `script.js` – entry point that wires everything together and sets up the auto-save timer.
- `actions.js` – handles user actions such as buying feed, upgrading equipment, saving and simulating offline progress.
- `ui.js` – updates DOM elements, renders the map and manages all modal dialogs.
- `gameState.js` – central state container and time system.
- `data.js` – constants for species, upgrades, barges, vessels and map locations.
- `models.js` – simple ES6 classes representing Barges, Pens, Sites and Vessels.

Feel free to modify `data.js` or the modules above to tweak starting values, species parameters or upgrade costs.

## Auto Save and Offline Progress
The game automatically saves to your browser's `localStorage` every 30&nbsp;seconds. When you return, `loadGame()` compares the current time with the last save and uses `simulateOfflineProgress()` to advance the simulation in one‑minute steps. A modal dialog shows how many in‑game days passed and how much feed was consumed while you were away.

## Contributing
Contributions are welcome! Please check the repository's `AGENTS.md` (if present)
for any project-specific guidelines before submitting a pull request.

## License
This project is licensed under the [MIT License](LICENSE).
