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
  },
  {
    id: 'firstAutoFeeder',
    description: 'Install your first auto feeder.',
    check: () => state.sites.some(site => site.pens.some(p => p.feeder)),
    reward: () => { state.cash += 250; }
  },
  {
    id: 'hireFirstStaff',
    description: 'Hire your first staff member.',
    check: () => state.sites.some(site => site.staff.length > 0),
    reward: () => { state.cash += 300; }
  },
  {
    id: 'purchaseSecondBarge',
    description: 'Purchase a second barge.',
    check: () => state.sites.some(site => site.barges.length >= 2),
    reward: () => { state.cash += 700; }
  },
  {
    id: 'buySecondVessel',
    description: 'Purchase a second vessel.',
    check: () => state.vessels.length >= 2,
    reward: () => { state.cash += 1000; }
  },
  {
    id: 'harvestTenTimes',
    description: 'Complete 10 harvests.',
    check: () => state.harvestsCompleted >= 10,
    reward: () => { state.cash += 2000; }
  },
  {
    id: 'ownThreePens',
    description: 'Own three pens in total.',
    check: () => state.sites.reduce((t,s)=>t + s.pens.length, 0) >= 3,
    reward: () => { state.cash += 1500; }
  },
  {
    id: 'raiseTwoSpecies',
    description: 'Raise two different species at once.',
    check: () => new Set(state.sites.flatMap(s=>s.pens.map(p=>p.species))).size >= 2,
    reward: () => { state.cash += 1500; }
  },
  {
    id: 'hireFeedManager',
    description: 'Hire a feed manager.',
    check: () => state.sites.some(site => site.staff.some(s => s.role === 'feedManager')),
    reward: () => { state.cash += 2000; }
  },
  {
    id: 'runThreeSites',
    description: 'Operate three farm sites.',
    check: () => state.sites.length >= 3,
    reward: () => { state.cash += 3000; }
  },
  {
    id: 'cash50k',
    description: 'Accumulate $50,000 cash.',
    check: () => state.cash >= 50000,
    reward: () => { state.cash += 5000; }
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
