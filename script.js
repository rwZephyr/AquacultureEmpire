import state from './gameState.js';
import * as ui from './ui.js';
import * as actions from './actions.js';

Object.assign(window, actions, ui);

document.addEventListener('DOMContentLoaded', () => {
  actions.loadGame();
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
});
