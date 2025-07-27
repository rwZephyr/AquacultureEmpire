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

function reflowTopBar(){
  const mobileBreak = 500;
  const siteGroup = document.getElementById('siteGroup');
  const siteActions = document.getElementById('siteActionGroup');
  const toolsGroup = document.getElementById('toolsGroup');
  const toolsActions = document.getElementById('toolsActionGroup');
  const bankGroup = document.getElementById('bankGroup');
  const bankActions = document.getElementById('bankActionGroup');
  const mobileBar = document.getElementById('mobileIconBar');
  if(!siteGroup || !siteActions || !toolsGroup || !toolsActions || !bankGroup || !bankActions || !mobileBar) return;
  if(window.innerWidth <= mobileBreak){
    if(!mobileBar.contains(siteActions)) mobileBar.appendChild(siteActions);
    if(!mobileBar.contains(toolsActions)) mobileBar.appendChild(toolsActions);
    if(!mobileBar.contains(bankActions)) mobileBar.appendChild(bankActions);
  } else {
    if(!siteGroup.contains(siteActions)) siteGroup.appendChild(siteActions);
    if(!toolsGroup.contains(toolsActions)) toolsGroup.appendChild(toolsActions);
    if(!bankGroup.contains(bankActions)) bankGroup.appendChild(bankActions);
  }
}

window.addEventListener('resize', reflowTopBar);

document.addEventListener('DOMContentLoaded', () => {
  adjustHeaderPadding();
  reflowTopBar();
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
