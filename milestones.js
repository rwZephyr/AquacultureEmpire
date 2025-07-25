import state from './gameState.js';
import { openModal } from './ui.js';

// List of milestone definitions
const milestones = [
  {
    id: 'firstHarvest',
    description: 'Harvest any pen for the first time.',
    check: () => state.harvestsCompleted > 0,
    reward: () => { state.cash += 500; }
  },
  {
    id: 'ownSecondPen',
    description: 'Purchase a second pen.',
    check: () => state.sites.reduce((t,s)=>t + s.pens.length, 0) >= 2,
    reward: () => { state.cash += 1000; }
  }
];

function initMilestones(){
  if(!state.milestones) state.milestones = {};
  milestones.forEach(m => {
    if(state.milestones[m.id] === undefined){
      state.milestones[m.id] = false;
    }
  });
}

function checkMilestones(){
  milestones.forEach(m => {
    if(!state.milestones[m.id] && m.check()){
      state.milestones[m.id] = true;
      m.reward();
      openModal(`Milestone reached: ${m.description}`);
    }
  });
}

export { milestones, initMilestones, checkMilestones };
