import state from './gameState.js';
import * as ui from './ui.js';
import * as actions from './actions.js';
import { initMilestones, checkMilestones } from './milestones.js';

Object.assign(window, actions);
Object.assign(window, ui);

function adjustHeaderPadding(){
  const header = document.getElementById('topHeader');
  if(header){
    const height = header.offsetHeight;
    document.documentElement.style.setProperty('--header-height', height + 'px');
  }
}

window.addEventListener('resize', adjustHeaderPadding);


document.addEventListener('DOMContentLoaded', () => {
  adjustHeaderPadding();
  actions.loadGame();
  initMilestones();
  ui.updateDisplay();
  ui.setupMapInteractions();
  if(state.lastOfflineInfo){
    const days = state.lastOfflineInfo.daysPassed;
    const feed = state.lastOfflineInfo.feedUsed.toFixed(0);
    const hrs = (state.lastOfflineInfo.elapsedMs/3600000).toFixed(1);
    ui.openModal(`Welcome back! ${hrs}h passed while you were away. `+
                 `${days} in-game days progressed and about ${feed}kg feed was used.`);
  }
  setInterval(actions.saveGame, state.AUTO_SAVE_INTERVAL_MS);
  setInterval(checkMilestones, 1000);
});

// Ensure progress is persisted if the tab is closed before the next
// auto-save interval fires. Because saveGame writes synchronously to
// localStorage, invoking it during page unload reliably stores the state.
window.addEventListener('pagehide', actions.saveGame);
window.addEventListener('beforeunload', actions.saveGame);
