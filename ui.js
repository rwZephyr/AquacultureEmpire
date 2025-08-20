

const speciesColors = {
  shrimp: '#e74c3c',
  salmon: '#f39c12',
  tuna: '#3498db',
  tilapia: '#74c476',
  barramundi: '#9b59b6',
  cod: '#95a5a6',
  grouper: '#d35400'
};

const vesselIcons = {
  skiff: 'assets/vessel-icons/skiff.png',
  lobsterBoat: 'assets/vessel-icons/lobsterboat.png',
  retiredTrawler: 'assets/vessel-icons/oldwellboat.png',
  wellboat: 'assets/vessel-icons/modernwellboat.png'
};

function adjustHeaderPadding(){
  const header = document.getElementById('topHeader');
  if(header){
    const height = header.offsetHeight;
    document.documentElement.style.setProperty('--header-height', height + 'px');
  }
}
window.addEventListener('resize', adjustHeaderPadding);

// lightweight view router
(function(){
  const sections = Array.from(document.querySelectorAll('#app-main > section[id^="view-"]'));
  const navLinks = document.getElementById('nav-links');
  const buttons = navLinks ? Array.from(navLinks.querySelectorAll('button[data-view]')) : [];
  const toggle = document.getElementById('nav-toggle');

  function show(view){
    sections.forEach(sec => {
      sec.classList.toggle('hidden', sec.id !== `view-${view}`);
    });
    buttons.forEach(btn => {
      if(btn.dataset.view === view){
        btn.setAttribute('aria-current','page');
      } else {
        btn.removeAttribute('aria-current');
      }
    });
    localStorage.setItem('aqe_view', view);
    if(location.hash !== `#${view}`) location.hash = `#${view}`;
    document.dispatchEvent(new CustomEvent('view:changed',{ detail:{ view } }));
    window.updateDisplay && window.updateDisplay();
  }

  window.AQE = window.AQE || {};
  window.AQE.router = { show };

  if(navLinks){
    navLinks.addEventListener('click', e => {
      const btn = e.target.closest('button[data-view]');
      if(!btn) return;
      show(btn.dataset.view);
      if(document.body.classList.contains('drawer-open')){
        document.body.classList.remove('drawer-open');
        if(toggle) toggle.setAttribute('aria-expanded','false');
      }
    });
  }

  if(toggle){
    toggle.setAttribute('aria-expanded','false');
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      document.body.classList.toggle('drawer-open', !expanded);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    let initial = 'Farm';
    const hash = location.hash.replace('#','');
    if(hash) initial = hash;
    else if(localStorage.getItem('aqe_view')) initial = localStorage.getItem('aqe_view');
    if(!sections.some(sec => sec.id === `view-${initial}`)) initial = 'Farm';
    show(initial);
  });
})();

// close site dropdown when clicking outside
document.addEventListener('click', evt => {
  const list = document.getElementById('siteDropdownList');
  const btn  = document.getElementById('siteNameBtn');
  if(!list || !btn) return;
  if(list.classList.contains('visible') &&
     !list.contains(evt.target) && !btn.contains(evt.target)){
    list.classList.remove('visible');
    list.classList.add('hidden');
  }
});

// close license dropdown when clicking outside
document.addEventListener('click', evt => {
  const list = document.getElementById('licenseDropdownList');
  const btn  = document.getElementById('licenseDropdownBtn');
  if(!list || !btn) return;
  if(list.classList.contains('visible') &&
     !list.contains(evt.target) && !btn.contains(evt.target)){
    list.classList.remove('visible');
    list.classList.add('hidden');
  }
});

// simple shared dropdown manager
const menuManager = (()=>{
  let current = null;
  function register(trigger, menu, closeFn){
    if(current && current.closeFn && current.closeFn !== closeFn){
      current.closeFn();
    }
    current = { trigger, menu, closeFn };
  }
  function clear(fn){
    if(current && (!fn || current.closeFn === fn)) current = null;
  }
  document.addEventListener('pointerdown', e=>{
    if(current && !current.menu.contains(e.target) && !current.trigger.contains(e.target)){
      current.closeFn();
    }
  });
  document.addEventListener('keydown', e=>{
    if(e.key === 'Escape' && current){
      current.closeFn();
      current.trigger.focus();
    }
  });
  return { register, clear };
})();

function pulseOnce(el){
  if(!el) return;
  el.classList.add('pulse-once');
  setTimeout(()=>el.classList.remove('pulse-once'), 1500);
}

// Track counts to avoid re-rendering lists every tick
let lastSiteIndex = -1;
let lastPenCount = 0;
let lastVesselCount = 0;
let logbookSection = 'milestones';

// --- UPDATE UI ---
function legacyUpdateDisplay(){
  const site = state.sites[state.currentSiteIndex];
  const pen  = site.pens[state.currentPenIndex];

  // top-bar
  document.getElementById('siteName').innerText = site.name;
  populateSiteList();
  document.getElementById('cashCount').innerText = state.cash.toFixed(2);
  const dateEl = document.getElementById('dateDisplay');
  if(dateEl) dateEl.innerText = getDateString();
  const playBtn = document.getElementById('playButton');
  const pauseBtn = document.getElementById('pauseButton');
  if(playBtn && pauseBtn){
    if(state.timePaused){
      playBtn.style.display = 'inline';
      pauseBtn.style.display = 'none';
    } else {
      playBtn.style.display = 'none';
      pauseBtn.style.display = 'inline';
    }
  }

    // milestone-gated actions
    const shipyardUnlocked = state.milestones.firstStock;
    const vesselAction = document.getElementById('action-vessels');
    if(vesselAction){
      vesselAction.classList.toggle('locked', !shipyardUnlocked);
      vesselAction.setAttribute('aria-disabled', String(!shipyardUnlocked));
      if(!shipyardUnlocked) vesselAction.title = 'Unlocks after stocking your first pen.';
      else vesselAction.removeAttribute('title');
    }
  const penBtn = document.getElementById('buyPenBtn');
  const penReason = document.getElementById('penLockReason');
  const penUnlocked = state.milestones.firstHarvest && state.milestones.firstSale;
  if(penBtn){
    penBtn.disabled = !penUnlocked;
    if(penReason) penReason.textContent = penUnlocked ? '' : 'Unlocks after your first harvest & sale.';
    if(penUnlocked && !state.tips.penUnlocked){
      pulseOnce(penBtn);
      openModal('Now you can buy another pen to expand your farm.');
      state.tips.penUnlocked = true;
    }
  }

  // barge card & feed overview
  const barge = site.barges[state.currentBargeIndex];
  document.getElementById('bargeIndex').innerText = state.currentBargeIndex + 1;
  document.getElementById('bargeCount').innerText = site.barges.length;
  document.getElementById('bargeFeedersUsed').innerText = site.pens.filter(p=>p.feeder && p.bargeIndex===state.currentBargeIndex).length;
  document.getElementById('bargeFeederLimit').innerText = barge.feederLimit;
  document.getElementById('bargeMaxFeederTier').innerText = barge.maxFeederTier;
  document.getElementById('bargeFeed').innerText         = barge.feed.toFixed(1);
  document.getElementById('bargeFeedCapacity').innerText = barge.feedCapacity;
  document.getElementById('bargeSiloCapacity').innerText = barge.siloCapacity;
  document.getElementById('bargeStaffCount').innerText    = site.staff.length;
  const totalCapacity = site.barges.reduce((t,b)=>t+b.staffCapacity,0);
  document.getElementById('bargeStaffCapacity').innerText = totalCapacity;
  document.getElementById('bargeStaffUnassigned').innerText = site.staff.filter(s=>!s.role).length;

  const totalFeed = site.barges.reduce((t,b)=>t+b.feed,0);
  const totalFeedCap = site.barges.reduce((t,b)=>t+b.feedCapacity,0);
  const feedPercent = totalFeedCap ? (totalFeed/totalFeedCap)*100 : 0;
  const prog = document.getElementById('feedProgress');
  if(prog) prog.style.width = feedPercent + '%';
  const totalFeedEl = document.getElementById('totalFeed');
  if(totalFeedEl) totalFeedEl.innerText = totalFeed.toFixed(1);
  const totalFeedCapEl = document.getElementById('totalFeedCapacity');
  if(totalFeedCapEl) totalFeedCapEl.innerText = totalFeedCap;
  const feedBadge = document.getElementById('feedStatusBadge');
  if(feedBadge) feedBadge.textContent = `${totalFeed.toFixed(0)}/${totalFeedCap}kg`;
  const bargeBadge = document.getElementById('bargeStatusBadge');
  if(bargeBadge) bargeBadge.textContent = `${site.pens.filter(p=>p.feeder && p.bargeIndex===state.currentBargeIndex).length}/${barge.feederLimit}`;
  const staffBadge = document.getElementById('staffStatusBadge');
  const unassigned = site.staff.filter(s=>!s.role).length;
  if(staffBadge){
    if(unassigned>0){
      staffBadge.textContent = `Idle:${unassigned}`;
      staffBadge.classList.add('alert');
    } else {
      staffBadge.textContent = site.staff.length;
      staffBadge.classList.remove('alert');
    }
  }
  const feedActionBadge = document.getElementById('feedActionBadge');
  if(feedActionBadge) feedActionBadge.textContent = `${totalFeed.toFixed(0)}/${totalFeedCap}kg`;
  const vesselActionBadge = document.getElementById('vesselActionBadge');
  if(vesselActionBadge){
    const owned = state.vessels?.length || 0;
    const limit = state.vesselLimit;
    vesselActionBadge.textContent = limit ? `${owned}/${limit}` : String(owned);
  }
  const staffActionBadge = document.getElementById('staffActionBadge');
  if(staffActionBadge) staffActionBadge.textContent = site.staff.length;

  // vessel grid

  // staff card info
  document.getElementById('staffTotal').innerText = site.staff.length;
  document.getElementById('staffCapacity').innerText = totalCapacity;
  document.getElementById('staffUnassigned').innerText = site.staff.filter(s=>!s.role).length;
  document.getElementById('staffFeeders').innerText = site.staff.filter(s=>s.role==='feeder').length;
  document.getElementById('staffHarvesters').innerText = site.staff.filter(s=>s.role==='harvester').length;
  document.getElementById('staffManagers').innerText = site.staff.filter(s=>s.role==='feedManager').length;

  // shop panel info
  const storageInfoEl = document.getElementById('storageUpgradeInfo');
  if(storageInfoEl){
    if(barge.storageUpgradeLevel < feedStorageUpgrades.length){
      storageInfoEl.innerText = `Next Feed Storage Upgrade: $${feedStorageUpgrades[barge.storageUpgradeLevel].cost}`;
    } else {
      storageInfoEl.innerText = 'Feed Storage Fully Upgraded';
    }
  }
  const housingInfoEl = document.getElementById('bargeHousingInfo');
  if(housingInfoEl){
    if(barge.housingUpgradeLevel < staffHousingUpgrades.length){
      housingInfoEl.innerText =
        `Next Housing Upgrade: $${staffHousingUpgrades[barge.housingUpgradeLevel].cost}`;
    } else {
      housingInfoEl.innerText = 'Housing Fully Upgraded';
    }
  }
  const bargePurchaseEl = document.getElementById('bargePurchaseInfo');
  if(bargePurchaseEl) bargePurchaseEl.innerText = `New Barge Cost: $${NEW_BARGE_COST}`;
  const penPurchaseEl = document.getElementById('penPurchaseInfo');
  if(penPurchaseEl) penPurchaseEl.innerText = `Next Pen Purchase: $${state.penPurchaseCost.toFixed(0)}`;



  if(lastSiteIndex !== state.currentSiteIndex || site.pens.length !== lastPenCount){
    renderPenGrid(site);
    lastPenCount = site.pens.length;
    lastSiteIndex = state.currentSiteIndex;
  } else {
    updatePenCards(site);
  }

  if(state.vessels.length !== lastVesselCount){
    renderVesselGrid();
    lastVesselCount = state.vessels.length;
  } else {
    updateVesselCards();
  }

  renderMap();
  const tsEl = document.querySelector('#marketReportContent .market-timestamp');
  if(tsEl) tsEl.innerText = `Prices last updated: ${state.lastMarketUpdateString}`;
  updateFeedPurchaseUI();
  updateMarketCharts();
  if(logbookSection === 'contracts') renderContracts();
  renderOnboardingChecklist();
  updateOnboardingToggleButton();
  maybeShowOnboardingTips();
}

// global display updater shim for legacy calls
window.updateDisplay = (function(){
  const safe = fn => { try { typeof fn === 'function' && fn(); } catch(e){ console.warn('updateDisplay part failed', e); } };
  return function(){
    // top status
    safe(window.renderTopBar || function(){
      try {
        const site = window.state?.sites?.[window.state.currentSiteIndex];
        if(site){
          const siteEl = document.getElementById('siteName');
          if(siteEl) siteEl.innerText = site.name;
          const cashEl = document.getElementById('cashCount');
          if(cashEl) cashEl.innerText = state.cash.toFixed(2);
          const dateEl = document.getElementById('dateDisplay');
          if(dateEl && typeof getDateString === 'function') dateEl.innerText = getDateString();
        }
      } catch(err){ console.warn('updateDisplay topbar failed', err); }
    });

    const active = document.querySelector('#nav-links [aria-current="page"]')?.dataset.view
      || localStorage.getItem('aqe_view') || 'Farm';
    if(active === 'Farm')      safe(window.renderFarm || legacyUpdateDisplay);
    if(active === 'Vessels')   safe(window.renderVessels);
    if(active === 'Market')    safe(window.renderMarket);
    if(active === 'Finance')   safe(window.renderFinance);
    if(active === 'Staff')     safe(window.renderStaff);
    if(active === 'Shipyard')  safe(window.renderShipyard);
    if(active === 'Logbook')   safe(window.renderLogbook);

    const section = document.getElementById(`view-${active}`);
    if(section && section.innerHTML.trim() === ''){
      const p = document.createElement('p');
      p.className = 'placeholder';
      p.textContent = 'Coming soon';
      section.appendChild(p);
    }
  };
})();

window.renderVessels = window.renderVessels || function(){
  const section = document.getElementById('view-Vessels');
  if(!section) return;
  section.querySelectorAll('.placeholder').forEach(el => el.remove());
  const grid = section.querySelector('#vesselGridContainer');
  if(grid && typeof renderVesselGrid === 'function'){
    renderVesselGrid();
  }
  if(section.children.length === 1){
    const p = document.createElement('p');
    p.className = 'placeholder';
    p.textContent = 'Coming soon';
    section.appendChild(p);
  }
};

// harvest preview
// license management
function updateSiteLicenses(){
  const listDiv = document.getElementById('siteLicenses');
  if(!listDiv) return;
  const site = state.sites[state.currentSiteIndex];
  listDiv.innerHTML = '<h3>Licensed Species</h3>';
  site.licenses.forEach(sp=>{
    const entry = document.createElement('div');
    entry.className = 'license-entry';
    entry.textContent = `Species: ${capitalizeFirstLetter(sp)} \u2013 \u2705`;
    listDiv.appendChild(entry);
  });
}

function populateLicenseDropdown(){
  const list = document.getElementById('licenseDropdownList');
  if(!list) return;
  list.innerHTML = '';
  const site = state.sites[state.currentSiteIndex];
  const sorted = Object.keys(speciesData).sort((a,b)=>a.localeCompare(b));
  sorted.forEach(sp => {
    const data = speciesData[sp];
    if(!site.licenses.includes(sp) && data.licenseCost>0){
      const item = document.createElement('div');
      const icon = document.createElement('img');
      icon.src = `assets/species-icons/${sp}.png`;
      icon.alt = sp;
      item.appendChild(icon);
      const label = document.createElement('span');
      label.textContent = `${capitalizeFirstLetter(sp)} - $${data.licenseCost}`;
      item.appendChild(label);
      item.onclick = () => {
        purchaseLicense(sp);
        const list = document.getElementById('licenseDropdownList');
        if(list){
          list.classList.remove('visible');
          list.classList.add('hidden');
        }
      };
      list.appendChild(item);
    }
  });
  if(list.children.length===0){
    list.textContent = 'All licenses purchased.';
  }
}

function toggleLicenseList(){
  const list = document.getElementById('licenseDropdownList');
  if(!list) return;
  if(list.classList.contains('visible')){
    list.classList.remove('visible');
    list.classList.add('hidden');
  } else {
    populateLicenseDropdown();
    list.classList.remove('hidden');
    list.classList.add('visible');
  }
}

function updateLicenseDropdown(){
  populateLicenseDropdown();
}

function renderOnboardingChecklist(){
  const box = document.getElementById('onboardingChecklist');
  if(!box) return;
  const steps = state.onboarding.steps;
  const allDone = Object.values(steps).every(v=>v);
  if(!state.onboarding.enabled || state.onboarding.dismissed || allDone){
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }
  box.classList.remove('hidden');
  box.innerHTML = `
    <ul>
      <li class="${steps.stocked?'done':''}">${steps.stocked?'\u2713 ':''}Stock a pen</li>
      <li class="${steps.harvested?'done':''}">${steps.harvested?'\u2713 ':''}Harvest a pen</li>
      <li class="${steps.sold?'done':''}">${steps.sold?'\u2713 ':''}Sell your catch</li>
      <li class="${steps.boughtPen?'done':''}">${steps.boughtPen?'\u2713 ':''}Buy another pen</li>
    </ul>
    <a id="hideGuideLink" href="#">Hide guide</a>
  `;
  const hide = document.getElementById('hideGuideLink');
  if(hide){
    hide.onclick = (e)=>{
      e.preventDefault();
      state.onboarding.enabled = false;
      state.onboarding.dismissed = true;
      saveGame();
      renderOnboardingChecklist();
    };
  }
}

function updateOnboardingToggleButton(){
  const btn = document.getElementById('onboardingToggleBtn');
  if(btn){
    btn.textContent = `Onboarding: ${state.onboarding.enabled ? 'On' : 'Off'}`;
  }
}

function showOnboardingTip(target, message){
  if(!target) return;
  const tip = document.createElement('div');
  tip.className = 'onboarding-tooltip';
  let text = message;
  const reasonEl = target.disabled ? (document.getElementById(target.id + 'LockReason') || target.parentElement?.querySelector('.lock-reason')) : null;
  if(reasonEl && reasonEl.textContent) text += ' ' + reasonEl.textContent;
  tip.textContent = text;
  document.body.appendChild(tip);
  const rect = target.getBoundingClientRect();
  tip.style.top = `${rect.top - tip.offsetHeight - 8 + window.scrollY}px`;
  tip.style.left = `${rect.left + window.scrollX}px`;
  setTimeout(()=> tip.remove(), 4000);
}

function maybeShowOnboardingTips(){
  if(!state.onboarding.enabled) return;
  if(!state.tips.tipStockShown){
    const btn = document.querySelector('.restock-btn');
    if(btn){
      showOnboardingTip(btn, 'Start by stocking a pen.');
      state.tips.tipStockShown = true;
      saveGame();
    }
    return;
  }
  if(state.onboarding.steps.stocked && !state.onboarding.steps.harvested && !state.tips.tipHarvestShown){
    const btn = document.querySelector('.harvest-btn');
    if(btn && btn.style.display !== 'none'){
      showOnboardingTip(btn, 'Harvest to load your vessel.');
      state.tips.tipHarvestShown = true;
      saveGame();
    }
    return;
  }
  if(state.onboarding.steps.harvested && !state.onboarding.steps.sold && !state.tips.tipSellShown){
    const btn = document.querySelector('.offload-btn');
    if(btn){
      showOnboardingTip(btn, 'Sell at market to make cash.');
      state.tips.tipSellShown = true;
      saveGame();
    }
    return;
  }
  if(state.onboarding.steps.sold && !state.onboarding.steps.boughtPen && !state.tips.tipBuyPenShown){
    const btn = document.getElementById('buyPenBtn');
    if(btn){
      showOnboardingTip(btn, 'Now buy another pen to expand.');
      state.tips.tipBuyPenShown = true;
      saveGame();
    }
  }
}

function updateSiteUpgrades(){
  const site = state.sites[state.currentSiteIndex];
  if(!site.upgrades) site.upgrades = [];
  const cards = document.querySelectorAll('#siteUpgrades .site-upgrade-card button');
  cards.forEach(btn => {
    const key = btn.dataset.upgrade;
    btn.disabled = true;
    if(site.upgrades.includes(key)){
      btn.textContent = 'Purchased';
    } else {
      btn.textContent = 'Work in Progress';
    }
  });
}

// pen grid
function renderPenGrid(site){
  const grid = document.getElementById('penGridContainer');
  grid.innerHTML = '';
  const select = document.getElementById('newPenBargeSelect');
  if(select){
    select.innerHTML = site.barges.map((b,i)=>`<option value="${i}">${i+1}</option>`).join('');
    select.value = state.currentBargeIndex;
    const disp = document.getElementById('selectedBargeDisplay');
    if(disp) disp.innerText = `Selected: ${Number(select.value)+1}`;
  }
  const tmpl = document.getElementById('penCardTemplate');
  site.pens.forEach((pen, idx)=>{
    const clone = tmpl.content.cloneNode(true);
    const card = clone.querySelector('.penCard');
    card.querySelector('.pen-name').textContent = `Pen ${idx+1}`;
    card.querySelector('.pen-species').textContent = capitalizeFirstLetter(pen.species);
    card.querySelector('.pen-fish').textContent = pen.fishCount;
    const avg = pen.fishCount > 0 ? pen.averageWeight : 0;
    const biomass = pen.fishCount > 0 ? pen.fishCount * pen.averageWeight : 0;
    card.querySelector('.pen-avg').textContent = avg.toFixed(2);
    card.querySelector('.pen-biomass').textContent = biomass.toFixed(2);
    const feederType = pen.feeder?.type||'None';
    const feederTier = pen.feeder?.tier||0;
    card.querySelector('.pen-feeder').textContent = `${capitalizeFirstLetter(feederType)} (Tier ${feederTier})`;
    const warnEl = card.querySelector('.pen-warning');
    updatePenWarning(warnEl, pen);

    const hasFish = pen.species && pen.fishCount > 0;
    // single badge overlay in the top-right corner
    const badge = document.createElement('div');
    badge.classList.add('species-badge');
    if(hasFish){
      const icon = document.createElement('img');
      icon.src = 'assets/species-icons/' + pen.species + '.png';
      icon.alt = pen.species;
      icon.className = 'species-icon';
      badge.appendChild(icon);
      badge.style.backgroundColor = speciesColors[pen.species] || 'rgba(0,0,0,0.2)';
    } else {
      badge.style.backgroundColor = 'rgba(0,0,0,0.2)';
    }
    card.appendChild(badge);

    const lockBadge = document.createElement('div');
    lockBadge.className = 'status-badge pen-locked';
    lockBadge.title = 'Locked during harvest';
    lockBadge.textContent = 'Locked';
    if(!pen.locked) lockBadge.style.display = 'none';
    card.appendChild(lockBadge);
    card.querySelector('.feed-btn').onclick = () => feedFishPen(idx);
    card.querySelector('.restock-btn').onclick = () => restockPenUI(idx);
    card.querySelector('.upgrade-btn').onclick = () => upgradeFeeder(idx);
    grid.appendChild(clone);
  });
}

function updatePenCards(site){
  const grid = document.getElementById('penGridContainer');
  if(!grid) return;
  site.pens.forEach((pen, idx)=>{
    const card = grid.children[idx];
    if(!card) return;
    card.querySelector('.pen-name').textContent = `Pen ${idx+1}`;
    card.querySelector('.pen-species').textContent = capitalizeFirstLetter(pen.species);
    card.querySelector('.pen-fish').textContent = pen.fishCount;
    const avg2 = pen.fishCount > 0 ? pen.averageWeight : 0;
    const biomass2 = pen.fishCount > 0 ? pen.fishCount * pen.averageWeight : 0;
    card.querySelector('.pen-avg').textContent = avg2.toFixed(2);
    card.querySelector('.pen-biomass').textContent = biomass2.toFixed(2);
    const feederType = pen.feeder?.type||'None';
    const feederTier = pen.feeder?.tier||0;
    card.querySelector('.pen-feeder').textContent = `${capitalizeFirstLetter(feederType)} (Tier ${feederTier})`;
    const warnEl = card.querySelector('.pen-warning');
    updatePenWarning(warnEl, pen);

    let badge = card.querySelector('.species-badge');
    if(!badge){
      // create badge once per card
      badge = document.createElement('div');
      badge.classList.add('species-badge');
      card.appendChild(badge);
    }
    const hasFish = pen.species && pen.fishCount > 0;
    badge.innerHTML = '';
    if(hasFish){
      const icon = document.createElement('img');
      icon.src = 'assets/species-icons/' + pen.species + '.png';
      icon.alt = pen.species;
      icon.className = 'species-icon';
      badge.appendChild(icon);
      badge.style.backgroundColor = speciesColors[pen.species] || 'rgba(0,0,0,0.2)';
    } else {
      badge.style.backgroundColor = 'rgba(0,0,0,0.2)';
    }

    let lockBadge = card.querySelector('.pen-locked');
    if(!lockBadge){
      lockBadge = document.createElement('div');
      lockBadge.className = 'status-badge pen-locked';
      lockBadge.title = 'Locked during harvest';
      lockBadge.textContent = 'Locked';
      card.appendChild(lockBadge);
    }
    lockBadge.style.display = pen.locked ? '' : 'none';
  });
}

function updatePenWarning(el, pen){
  if(!el) return;
  const data = speciesData[pen.species];
  el.innerHTML = '';
  el.className = 'pen-warning';
  if(!data || !data.maxWeight) return;
  const max = data.maxWeight;
  const messages = [];
  if(pen.averageWeight >= max){
    messages.push('⚠ Exceeds ideal harvest weight — further growth may be inefficient');
    el.classList.add('critical');
    messages.push('<span class="diminish-note">⚠ Growth slowed — over optimal weight</span>');
  } else if(pen.averageWeight >= max*0.8){
    messages.push('Approaching harvest weight limit');
    el.classList.add('soft');
  }
  el.innerHTML = messages.join('<br>');
}

function getFishBufferInfo(buffer){
  if(!buffer || buffer.length === 0) return '';
  const counts = {};
  const weights = {};
  buffer.forEach(f => {
    const sp = f.species;
    counts[sp] = (counts[sp] || 0) + 1;
    weights[sp] = (weights[sp] || 0) + f.weight;
  });
  return Object.keys(counts).map(sp => {
    const w = weights[sp].toFixed(1);
    return `${capitalizeFirstLetter(sp)} x${counts[sp]} (${w}kg)`;
  }).join(', ');
}

function renderVesselGrid(){
  const grid = document.getElementById('vesselGridContainer');
  if(!grid) return;
  grid.innerHTML = '';
  const tmpl = document.getElementById('vesselCardTemplate');
  state.vessels.forEach((vessel, idx)=>{
    const clone = tmpl.content.cloneNode(true);
    const card = clone.querySelector('.vesselCard');
    const iconPath = vesselIcons[vessel.class];
    let badge = card.querySelector('.vessel-badge');
    if(!badge){
      badge = document.createElement('div');
      badge.classList.add('vessel-badge');
      card.appendChild(badge);
    }
    badge.innerHTML = '';
    if(iconPath){
      const icon = document.createElement('img');
      icon.src = iconPath;
      icon.alt = vessel.class;
      badge.appendChild(icon);
    }
    card.querySelector('.vessel-name .name-text').textContent = vessel.name;
    card.querySelector('.vessel-tier').textContent = vesselTiers[vessel.tier].name;
    card.querySelector('.vessel-location').textContent = vessel.location;
    const statusEl = card.querySelector('.vessel-status');
    let statusClass = 'status-idle';
    let status = 'Idle';
    if(vessel.status === 'harvesting'){ status='Harvesting'; statusClass='status-harvesting'; }
    else if(vessel.status === 'offloading' || vessel.status === 'selling'){ status='Delivering'; statusClass='status-delivering'; }
    else if(vessel.status === 'enRoute'){ status='Traveling'; statusClass='status-delivering'; }
    else if(vessel.location === 'Dock'){ status='Docked'; statusClass='status-docked'; }
    if(vessel.busyUntil && vessel.busyUntil > Date.now()){
      const eta = Math.max(0, (vessel.busyUntil - Date.now())/1000);
      status += ` (${eta.toFixed(0)}s)`;
    }
    statusEl.textContent = status;
    card.classList.add(statusClass);
    const speciesEl = card.querySelector('.harvest-species');
    if(vessel.status === 'offloading'){
      speciesEl.textContent = `Revenue $${vessel.offloadRevenue.toFixed(2)}`;
    } else {
        speciesEl.textContent = vessel.status === 'harvesting' && vessel.cargoSpecies ? `Harvesting ${capitalizeFirstLetter(vessel.cargoSpecies)}` : ''; // TODO: remove after holds migration
    }
      const loadPercent = vessel.maxBiomassCapacity ? (vessel.currentBiomassLoad / vessel.maxBiomassCapacity)*100 : 0; // TODO: derive from holds[0]
      card.querySelector('.vessel-progress').style.width = loadPercent + '%';
      card.querySelector('.vessel-load').textContent = vessel.currentBiomassLoad.toFixed(1); // TODO: remove after holds migration
      card.querySelector('.vessel-capacity').textContent = vessel.maxBiomassCapacity; // TODO: remove after holds migration
    card.querySelector('.load-percent').textContent = loadPercent.toFixed(0);
    const infoEl = card.querySelector('.fishbuffer-info');
    const infoStr = getFishBufferInfo(vessel.fishBuffer);
    if(infoEl){ infoEl.textContent = infoStr; infoEl.title = infoStr; }
    const harvestBtn = card.querySelector('.harvest-btn');
    harvestBtn.id = `btn-harvest-${idx}`;
    harvestBtn.onclick = ()=>{ state.currentVesselIndex = idx; openHarvestModal(idx); };
    const moveBtn = card.querySelector('.move-btn');
    moveBtn.id = `btn-move-${idx}`;
    moveBtn.onclick = ()=>{ state.currentVesselIndex = idx; openMoveVesselModal(); };
    const offloadBtn = card.querySelector('.offload-btn');
    offloadBtn.id = `btn-offload-${idx}`;
    offloadBtn.onclick = ()=>{ state.currentVesselIndex = idx; openSellModal(); };

    const actionsToggle = card.querySelector('.ellipsis-trigger');
    const actionMenu = card.querySelector('.action-menu');
    actionMenu.id = `vessel-menu-${idx}`;
    actionsToggle.setAttribute('aria-controls', actionMenu.id);
    const closeMenu = ()=>{
      actionMenu.classList.add('hidden');
      actionsToggle.setAttribute('aria-expanded', 'false');
      menuManager.clear(closeMenu);
      actionsToggle.focus();
    };
    const openMenu = ()=>{
      actionMenu.classList.remove('hidden');
      actionsToggle.setAttribute('aria-expanded', 'true');
      menuManager.register(actionsToggle, actionMenu, closeMenu);
      const first = actionMenu.querySelector('[role="menuitem"]');
      if(first) first.focus();
    };
    actionsToggle.addEventListener('click', e=>{
      e.stopPropagation();
      if(actionMenu.classList.contains('hidden')) openMenu();
      else closeMenu();
    });
    const hideOnLeave = e=>{
      if(actionMenu.classList.contains('hidden')) return;
      const to = e.relatedTarget;
      if(!actionMenu.contains(to) && !actionsToggle.contains(to)){
        closeMenu();
      }
    };
    actionsToggle.addEventListener('pointerleave', hideOnLeave);
    actionMenu.addEventListener('pointerleave', hideOnLeave);
    
    const renameBtn = card.querySelector('.rename-btn');
    renameBtn.onclick = ()=>{ state.currentVesselIndex = idx; closeMenu(); renameVessel(); };
    const upBtn = card.querySelector('.upgrade-btn');
    upBtn.onclick = ()=>{ state.currentVesselIndex = idx; closeMenu(); upgradeVessel(); };
    const sellVesselBtn = card.querySelector('.sell-vessel-btn');
    sellVesselBtn.onclick = ()=>{ closeMenu(); openModal('Selling vessels not yet implemented'); };
    const detailsBtn = card.querySelector('.details-btn');
    const details = card.querySelector('.vessel-details');
    detailsBtn.onclick = ()=>{ details.classList.toggle('hidden'); closeMenu(); };
    const cancelBtn = card.querySelector('.cancel-btn');
    cancelBtn.onclick = ()=>{
      state.currentVesselIndex = idx;
      if(vessel.unloading){
        const market = markets.find(m=>m.name===vessel.offloadMarket);
        finishOffloading(vessel, market, true);
      } else {
        cancelVesselHarvest(idx);
      }
      closeMenu();
    };
    const busy = vessel.status !== 'idle';
    harvestBtn.disabled = busy;
    harvestBtn.setAttribute('aria-disabled', busy ? 'true' : 'false');
    moveBtn.disabled = busy;
    moveBtn.setAttribute('aria-disabled', busy ? 'true' : 'false');
    offloadBtn.disabled = busy;
    offloadBtn.setAttribute('aria-disabled', busy ? 'true' : 'false');
    upBtn.disabled = busy;
    renameBtn.disabled = busy;
    sellVesselBtn.disabled = busy;
    cancelBtn.textContent = vessel.status === 'offloading' ? 'Cancel Offloading' : 'Cancel';
    cancelBtn.style.display = (vessel.status === 'harvesting' || vessel.status === 'offloading') ? 'block' : 'none';

    grid.appendChild(clone);
  });
}

function updateVesselCards(){
  const grid = document.getElementById('vesselGridContainer');
  if(!grid) return;
  state.vessels.forEach((vessel, idx)=>{
    const card = grid.children[idx];
    if(!card) return;
    const iconPath = vesselIcons[vessel.class];
    let badge = card.querySelector('.vessel-badge');
    if(!badge){
      badge = document.createElement('div');
      badge.classList.add('vessel-badge');
      card.appendChild(badge);
    }
    badge.innerHTML = '';
    if(iconPath){
      const icon = document.createElement('img');
      icon.src = iconPath;
      icon.alt = vessel.class;
      badge.appendChild(icon);
    }
    card.querySelector('.vessel-name .name-text').textContent = vessel.name;
    card.querySelector('.vessel-tier').textContent = vesselTiers[vessel.tier].name;
    card.querySelector('.vessel-location').textContent = vessel.location;
    const statusEl = card.querySelector('.vessel-status');
    let statusClass = 'status-idle';
    let status = 'Idle';
    if(vessel.status === 'harvesting'){ status='Harvesting'; statusClass='status-harvesting'; }
    else if(vessel.status === 'offloading' || vessel.status === 'selling'){ status='Delivering'; statusClass='status-delivering'; }
    else if(vessel.status === 'enRoute'){ status='Traveling'; statusClass='status-delivering'; }
    else if(vessel.location === 'Dock'){ status='Docked'; statusClass='status-docked'; }
    if(vessel.busyUntil && vessel.busyUntil > Date.now()){
      const eta = Math.max(0, (vessel.busyUntil - Date.now())/1000);
      status += ` (${eta.toFixed(0)}s)`;
    }
    statusEl.textContent = status;
    card.classList.remove('status-harvesting','status-idle','status-delivering','status-docked');
    card.classList.add(statusClass);
    const speciesEl = card.querySelector('.harvest-species');
    if(vessel.status === 'offloading'){
      speciesEl.textContent = `Revenue $${vessel.offloadRevenue.toFixed(2)}`;
    } else {
        speciesEl.textContent = vessel.status === 'harvesting' && vessel.cargoSpecies ? `Harvesting ${capitalizeFirstLetter(vessel.cargoSpecies)}` : ''; // TODO: remove after holds migration
    }
      const loadPercent = vessel.maxBiomassCapacity ? (vessel.currentBiomassLoad / vessel.maxBiomassCapacity)*100 : 0; // TODO: derive from holds[0]
      card.querySelector('.vessel-progress').style.width = loadPercent + '%';
      card.querySelector('.vessel-load').textContent = vessel.currentBiomassLoad.toFixed(1); // TODO: remove after holds migration
      card.querySelector('.vessel-capacity').textContent = vessel.maxBiomassCapacity; // TODO: remove after holds migration
    const lp = card.querySelector('.load-percent');
    if(lp) lp.textContent = loadPercent.toFixed(0);
    const infoEl2 = card.querySelector('.fishbuffer-info');
    const infoStr2 = getFishBufferInfo(vessel.fishBuffer);
    if(infoEl2){ infoEl2.textContent = infoStr2; infoEl2.title = infoStr2; }
    const harvestBtn2 = card.querySelector('.harvest-btn');
    harvestBtn2.onclick = ()=>{ state.currentVesselIndex = idx; openHarvestModal(idx); };
    const moveBtn2 = card.querySelector('.move-btn');
    moveBtn2.onclick = ()=>{ state.currentVesselIndex = idx; openMoveVesselModal(); };
    const offloadBtn2 = card.querySelector('.offload-btn');
    offloadBtn2.onclick = ()=>{ state.currentVesselIndex = idx; openSellModal(); };
    const upBtn2 = card.querySelector('.upgrade-btn');
    upBtn2.onclick = ()=>{ state.currentVesselIndex = idx; upgradeVessel(); };
    const renameBtn2 = card.querySelector('.rename-btn');
    const sellVesselBtn2 = card.querySelector('.sell-vessel-btn');
    const busy2 = vessel.status !== 'idle';
    harvestBtn2.disabled = busy2;
    harvestBtn2.setAttribute('aria-disabled', busy2 ? 'true' : 'false');
    moveBtn2.disabled = busy2;
    moveBtn2.setAttribute('aria-disabled', busy2 ? 'true' : 'false');
    offloadBtn2.disabled = busy2;
    offloadBtn2.setAttribute('aria-disabled', busy2 ? 'true' : 'false');
    upBtn2.disabled = busy2;
    if(renameBtn2) renameBtn2.disabled = busy2;
    if(sellVesselBtn2) sellVesselBtn2.disabled = busy2;
    const cancelBtn = card.querySelector('.cancel-btn');
    cancelBtn.onclick = ()=>{
      state.currentVesselIndex = idx;
      if(vessel.unloading){
        const market = markets.find(m=>m.name===vessel.offloadMarket);
        finishOffloading(vessel, market, true);
      } else {
        cancelVesselHarvest(idx);
      }
    };
    cancelBtn.textContent = vessel.status === 'offloading' ? 'Cancel Offloading' : 'Cancel';
    cancelBtn.style.display = (vessel.status === 'harvesting' || vessel.status === 'offloading') ? 'block' : 'none';
  });
}

// store map marker data for tooltips
let mapMarkers = [];

// simple map renderer with emoji icons and curved coastline
function renderMap(){
  const canvas = document.getElementById('mapCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  mapMarkers = [];

  // draw water background
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = '#1c4979';
  ctx.fillRect(0,0,w,h);

  // compute and draw land shape
  const base = h * 0.6;
  const amp  = h * 0.05;
  ctx.beginPath();
  ctx.moveTo(0,h);
  for(let x=0;x<=w;x+=w/20){
    const y = base + Math.sin((x/w)*Math.PI*2)*amp;
    ctx.lineTo(x,y);
  }
  ctx.lineTo(w,h);
  ctx.closePath();
  ctx.fillStyle = '#406536';
  ctx.fill();

  // grid lines
  ctx.strokeStyle = '#2a3f55';
  for(let i=0;i<=10;i++){
    const x=i*w/10; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke();
    const y=i*h/10; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
  }

  // helper to convert coords
  const toPixel = p=>({x:p.x/100*w, y:p.y/100*h});
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // draw markets
  markets.forEach(m=>{
    const pos = toPixel(m.location);
    ctx.fillText('🏪', pos.x, pos.y);
    mapMarkers.push({x:pos.x, y:pos.y, name:m.name});
  });
  // draw sites
  state.sites.forEach(s=>{
    const pos = toPixel(s.location);
    ctx.fillText('🐟', pos.x, pos.y);
    mapMarkers.push({x:pos.x, y:pos.y, name:s.name});
  });
  // draw vessels
  state.vessels.forEach(v=>{
    let locName=v.location;
    if(locName.startsWith('Traveling to ')) locName=locName.replace('Traveling to ','');
    const site = state.sites.find(s=>s.name===locName);
    const market = markets.find(m=>m.name===locName);
    const loc = site?site.location:market?market.location:null;
    if(loc){
      const pos=toPixel(loc);
      ctx.fillText('🚢', pos.x, pos.y);
      mapMarkers.push({x:pos.x, y:pos.y, name:v.name});
    }
  });
}

// setup tooltip interactions for the map
function setupMapInteractions(){
  const canvas = document.getElementById('mapCanvas');
  const tooltip = document.getElementById('mapTooltip');
  if(!canvas || !tooltip) return;
  let hideTimeout;
  const show = marker => {
    tooltip.textContent = marker.name;
    tooltip.style.display = 'block';
    tooltip.style.left = `${marker.x + 10}px`;
    tooltip.style.top  = `${marker.y - 25}px`;
    clearTimeout(hideTimeout);
  };
  const handle = evt => {
    const rect = canvas.getBoundingClientRect();
    const cX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const cY = evt.touches ? evt.touches[0].clientY : evt.clientY;
    const x = cX - rect.left;
    const y = cY - rect.top;
    const marker = mapMarkers.find(m => Math.hypot(x-m.x, y-m.y) < 12);
    if(marker){
      show(marker);
      if(evt.type === 'click' || evt.type === 'touchstart'){
        hideTimeout = setTimeout(()=>{ tooltip.style.display='none'; },1500);
      }
    } else if(evt.type === 'mousemove'){
      tooltip.style.display='none';
    }
  };
  canvas.addEventListener('mousemove', handle);
  canvas.addEventListener('click', handle);
  canvas.addEventListener('touchstart', handle);
  canvas.addEventListener('mouseleave', ()=>{ tooltip.style.display='none'; });
}

// tooltip for quick status icons
function setupStatusTooltips(){
  const actions = document.querySelector('.topbar-actions');
  if(!actions || getComputedStyle(actions).display === 'none') return;
  const tooltip = document.getElementById('statusTooltip');
  if(!tooltip) return;

  const getInfo = {
    feedStatusIcon(){
      const site = state.sites[state.currentSiteIndex];
      const total = site.barges.reduce((t,b)=>t+b.feed,0);
      const cap = site.barges.reduce((t,b)=>t+b.feedCapacity,0);
      return total >= cap ? 'Feed silos full' : `Feed: ${total.toFixed(0)}/${cap} kg`;
    },
    bargeStatusIcon(){
      const site = state.sites[state.currentSiteIndex];
      const barge = site.barges[state.currentBargeIndex];
      const feeders = site.pens.filter(p=>p.feeder && p.bargeIndex===state.currentBargeIndex).length;
      return feeders >= barge.feederLimit ? 'Feeder capacity full' : `${feeders}/${barge.feederLimit} feeders in use`;
    },
    staffStatusIcon(){
      const site = state.sites[state.currentSiteIndex];
      const unassigned = site.staff.filter(s=>!s.role).length;
      if(unassigned>0) return `${unassigned} unassigned workers`;
      const cap = site.barges.reduce((t,b)=>t+b.staffCapacity,0);
      return `${site.staff.length}/${cap} staff`;
    }
  };

  const attach = id => {
    const icon = document.getElementById(id);
    if(!icon) return;
    let pressTimer;
    let autoHide;
    const show = () => {
      tooltip.textContent = getInfo[id]();
      tooltip.classList.add('visible');
      tooltip.classList.remove('below');
      const rect = icon.getBoundingClientRect();
      tooltip.style.left = `${rect.left + rect.width/2}px`;
      tooltip.style.top = `${rect.top - 8}px`;
      requestAnimationFrame(()=>{
        const tRect = tooltip.getBoundingClientRect();
        let top = rect.top - tRect.height - 8;
        let below = false;
        if(window.innerWidth <= 700){
          top = rect.bottom + 8;
          below = true;
        }
        if(top < 4){ top = rect.bottom + 8; below = true; }
        if(top + tRect.height > window.innerHeight){ top = rect.top - tRect.height - 8; below = false; }
        tooltip.style.top = `${top}px`;
        if(below) tooltip.classList.add('below'); else tooltip.classList.remove('below');
        const left = Math.min(window.innerWidth - tRect.width/2 - 4, Math.max(tRect.width/2 + 4, rect.left + rect.width/2));
        tooltip.style.left = `${left}px`;
      });
    };
    const hide = () => {
      tooltip.classList.remove('visible');
    };
    icon.addEventListener('mouseenter', show);
    icon.addEventListener('mouseleave', hide);
    icon.addEventListener('focus', show);
    icon.addEventListener('blur', hide);
    icon.addEventListener('touchstart', () => {
      pressTimer = setTimeout(()=>{ show(); autoHide=setTimeout(hide,1500); }, 500);
    });
    icon.addEventListener('touchend', () => {
      clearTimeout(pressTimer);
    });
    icon.addEventListener('touchcancel', () => {
      clearTimeout(pressTimer);
      clearTimeout(autoHide);
      hide();
    });
  };

  ['feedStatusIcon','bargeStatusIcon','staffStatusIcon'].forEach(attach);
  window.addEventListener('scroll', () => tooltip.classList.remove('visible'));
  window.addEventListener('resize', () => tooltip.classList.remove('visible'));
}

// --- MODALS ---
function openModal(html){
  const bargeModal = document.getElementById('bargeUpgradeModal');
  if(bargeModal && bargeModal.classList.contains('visible')){
    const alertEl = document.getElementById('bargeUpgradeMessage');
    if(alertEl){
      alertEl.textContent = html;
      alertEl.style.display = 'block';
      setTimeout(()=>{ alertEl.style.display = 'none'; }, 3000);
    }
    return;
  }
  document.getElementById('modalText').innerText = html;
  document.getElementById('modal').classList.add('visible');
}
window.openModal = openModal;
function closeModal(){ document.getElementById('modal').classList.remove('visible'); }
let restockSpecies = null;
let restockUnitCost = 0;
let restockMaxQty = 0;
function openRestockModal(){
  const site = state.sites[state.currentSiteIndex];
  const pen  = site.pens[state.currentPenIndex];
  if(pen.locked) return openModal('Pen currently busy.');
  const optionsDiv = document.getElementById('restockOptions');
  optionsDiv.innerHTML = '';
  restockSpecies = null;
  const qtySection = ensureRestockControls();
  qtySection.style.display = 'none';
  site.licenses.forEach(sp => {
    const data = speciesData[sp];
    const card = document.createElement('div');
    card.className = 'species-card';
    card.onclick = () => {
      if(pen.fishCount>0 && pen.species !== sp){
        return openModal("You must harvest the pen before restocking!");
      }
      optionsDiv.querySelectorAll('.species-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      restockSpecies = sp;
      restockUnitCost = data.restockCost / data.restockCount;
      const maxAffordable = Math.floor(state.cash / restockUnitCost);
      restockMaxQty = Math.min(maxAffordable, 10000);
      const input = document.getElementById('restockQtyInput');
      input.max = restockMaxQty;
      input.value = Math.min(data.restockCount, restockMaxQty);
      updateRestockCost();
      qtySection.style.display = 'block';
    };

    const img = document.createElement('img');
    img.src = `assets/species-icons/${sp}.png`;
    img.className = 'species-icon';

    const info = document.createElement('div');
    info.className = 'species-info';

    const name = document.createElement('div');
    name.className = 'species-name';
    name.textContent = `${capitalizeFirstLetter(sp)} ($${data.restockCost})`;

    const tagRow = document.createElement('div');
    tagRow.className = 'species-tags';
    if (data.tags && data.tags.length) {
      data.tags.forEach(t => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = t;
        tagRow.appendChild(span);
      });
    }

    info.appendChild(name);
    info.appendChild(tagRow);
    card.appendChild(img);
    card.appendChild(info);
    optionsDiv.appendChild(card);
  });
  document.getElementById('restockModal').classList.add('visible');
}
function ensureRestockControls(){
  let section = document.getElementById('restockQtySection');
  if(section) return section;
  const modalContent = document.getElementById('restockModalContent');
  section = document.createElement('div');
  section.id = 'restockQtySection';
  section.style.display = 'none';
  const input = document.createElement('input');
  input.type = 'number';
  input.id = 'restockQtyInput';
  input.min = 0;
  input.addEventListener('input', updateRestockCost);
  const costDiv = document.createElement('div');
  costDiv.innerHTML = 'Total Cost: $<span id="restockTotalCost">0</span>';
  const btn = document.createElement('button');
  btn.id = 'restockConfirm';
  btn.textContent = 'Restock';
  btn.onclick = () => {
    const qty = Number(document.getElementById('restockQtyInput').value);
    restockPen(restockSpecies, qty);
  };
  section.appendChild(input);
  section.appendChild(costDiv);
  section.appendChild(btn);
  modalContent.insertBefore(section, modalContent.querySelector('.secondary-btn'));
  return section;
}
function updateRestockCost(){
  const input = document.getElementById('restockQtyInput');
  const costEl = document.getElementById('restockTotalCost');
  let val = Number(input.value);
  if(val > restockMaxQty) val = restockMaxQty;
  if(val < 0) val = 0;
  input.value = val;
  costEl.textContent = (val * restockUnitCost).toFixed(2);
}
function closeRestockModal(){ document.getElementById('restockModal').classList.remove('visible'); }

let lastHarvestTrigger = null;

function updateHarvestModal(){
  const site = state.sites[state.currentSiteIndex];
  const vessel = state.vessels[state.currentVesselIndex];
  const penIdx = Number(document.getElementById('harvestPenSelect').value);
  state.currentPenIndex = penIdx;
  const pen = site.pens[penIdx];
  const holdSelectEl = document.getElementById('harvestHoldSelect');
  const holds = vessel.holds && vessel.holds.length > 0 ? vessel.holds : [{ species: vessel.cargoSpecies ?? null, biomass: vessel.currentBiomassLoad ?? 0, capacity: vessel.maxBiomassCapacity ?? 0 }];
  let holdIdx = 0;
  if(holds.length > 1){
    holdIdx = Number(holdSelectEl.value) || 0;
    if(holdIdx < 0 || holdIdx >= holds.length) holdIdx = 0;
  }
  const hold = holds[holdIdx];
  const vesselRemaining = hold ? (hold.capacity - hold.biomass) : (vessel.maxBiomassCapacity - vessel.currentBiomassLoad);
  const penBiomass = pen.fishCount > 0 ? pen.fishCount * pen.averageWeight : 0;
  const maxHarvest = Math.min(penBiomass, vesselRemaining);
  document.getElementById('harvestMax').innerText = maxHarvest.toFixed(2);
  const input = document.getElementById('harvestAmount');
  const slider = document.getElementById('harvestSlider');
  const requested = parseFloat(input.value) || 0;
  const avg = pen.averageWeight > 0 ? pen.averageWeight : 1;
  let fishToMove = Math.floor(requested / avg);
  fishToMove = Math.min(fishToMove, pen.fishCount);
  fishToMove = Math.min(fishToMove, Math.floor(vesselRemaining / avg));
  const effectiveKg = fishToMove * avg;
  input.max = maxHarvest;
  slider.max = maxHarvest;
  input.value = effectiveKg.toFixed(2);
  slider.value = effectiveKg;
  const rate = getSiteHarvestRate(site);
  const secs = Math.max(0, effectiveKg / rate);
  document.getElementById('harvestModalContent').querySelector('h2').innerText =
    `Start Harvest (~${secs.toFixed(1)}s)`;
  document.getElementById('harvestFishCount').textContent = `= ${fishToMove} fish`;
  const infoEl = document.getElementById('harvestHoldInfo');
  const confirmBtn = document.getElementById('harvestConfirmBtn');
  const reasonEl = document.getElementById('harvestReason');
  let reason = '';
  if(hold){
    const free = hold.capacity - hold.biomass;
    infoEl.textContent = `Hold ${holdIdx+1} — ${hold.species ? capitalizeFirstLetter(hold.species) : 'Empty'} — ${free.toFixed(1)} kg free`;
    const mismatch = hold.species && hold.species !== pen.species;
    if(mismatch){ reason = 'Hold contains a different species'; }
    confirmBtn.disabled = mismatch || maxHarvest <= 0;
  } else {
    infoEl.textContent = 'N/A';
    confirmBtn.disabled = maxHarvest <= 0;
  }
  if(maxHarvest <= 0 && !reason) reason = 'No capacity';
  confirmBtn.title = reason;
  reasonEl.textContent = reason;

  const maxHoldBtn = document.getElementById('harvestMaxHoldBtn');
  const maxPenBtn = document.getElementById('harvestMaxPenBtn');
  if(maxHoldBtn) maxHoldBtn.onclick = ()=>{ input.value = Math.min(vesselRemaining, penBiomass).toFixed(2); slider.value = input.value; updateHarvestModal(); };
  if(maxPenBtn) maxPenBtn.onclick = ()=>{ input.value = Math.min(penBiomass, vesselRemaining).toFixed(2); slider.value = input.value; updateHarvestModal(); };
}

function openHarvestModal(vIdx){
  state.currentVesselIndex = vIdx;
  const site = state.sites[state.currentSiteIndex];
  const vessel = state.vessels[vIdx];
  if(vessel.status !== 'idle')
    return openModal('Vessel currently busy.');
  lastHarvestTrigger = document.activeElement;
  const select = document.getElementById('harvestPenSelect');
  select.innerHTML = '';
  site.pens.forEach((pen, idx)=>{
    const biomass = (pen.fishCount > 0 ? pen.fishCount * pen.averageWeight : 0).toFixed(2);
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = `Pen ${idx+1} - ${capitalizeFirstLetter(pen.species)} (${biomass}kg)`;
    if(pen.locked || pen.fishCount<=0) opt.disabled = true;
    select.appendChild(opt);
  });
  if(select.options.length===0) return openModal('No available pens to harvest.');
  const holdSelect = document.getElementById('harvestHoldSelect');
  const holdLabel = document.querySelector('label[for="harvestHoldSelect"]');
  holdSelect.innerHTML = '';
  const holds = vessel.holds && vessel.holds.length > 0 ? vessel.holds : [{ species: vessel.cargoSpecies ?? null, biomass: vessel.currentBiomassLoad ?? 0, capacity: vessel.maxBiomassCapacity ?? 0 }];
  if(holds.length > 1){
    if(holdLabel) holdLabel.style.display = '';
    holdSelect.style.display = '';
    holds.forEach((h, idx)=>{
      const free = h.capacity - h.biomass;
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `Hold ${idx+1} — ${h.species ? capitalizeFirstLetter(h.species) : 'Empty'} — ${free.toFixed(1)} kg free`;
      holdSelect.appendChild(opt);
    });
    holdSelect.onchange = updateHarvestModal;
    holdSelect.value = '0';
  } else {
    if(holdLabel) holdLabel.style.display = 'none';
    holdSelect.style.display = 'none';
    holdSelect.onchange = null;
    holdSelect.value = '0';
  }
  select.onchange = updateHarvestModal;
  select.value = select.options[0].value;
  const amountInput = document.getElementById('harvestAmount');
  const slider = document.getElementById('harvestSlider');
  amountInput.oninput = ()=>{ slider.value = amountInput.value; updateHarvestModal(); };
  slider.oninput = ()=>{ amountInput.value = slider.value; updateHarvestModal(); };
  updateHarvestModal();
  const modal = document.getElementById('harvestModal');
  modal.classList.add('visible');
  modal.onkeydown = (e)=>{
    if(e.key==='Escape'){ e.preventDefault(); closeHarvestModal(); }
    if(e.key==='Enter'){ e.preventDefault(); confirmHarvest(); }
  };
  amountInput.focus();
}
function closeHarvestModal(){
  const modal = document.getElementById('harvestModal');
  modal.classList.remove('visible');
  modal.onkeydown = null;
  if(lastHarvestTrigger) lastHarvestTrigger.focus();
}
function confirmHarvest(){
  const amount = parseFloat(document.getElementById('harvestAmount').value);
  const holdIdx = Number(document.getElementById('harvestHoldSelect').value) || 0;
  window.harvestPen(amount, holdIdx);
  closeHarvestModal();
  updateDisplay();
}


function openSellModal(){
  const optionsDiv = document.getElementById('sellOptions');
  optionsDiv.innerHTML = '';
  const vessel = state.vessels[state.currentVesselIndex];
  if(vessel.status !== 'idle')
    return openModal('Vessel currently busy.');
  const holdSelect = document.getElementById('sellHoldSelect');
  const holdLabel = document.querySelector('label[for="sellHoldSelect"]');
  holdSelect.innerHTML = '';
  const holds = vessel.holds && vessel.holds.length > 0 ? vessel.holds : [{ species: vessel.cargoSpecies ?? null, biomass: vessel.currentBiomassLoad ?? 0, capacity: vessel.maxBiomassCapacity ?? 0 }];
  const updateHoldInfo = ()=>{
    const idx = holds.length > 1 ? (Number(holdSelect.value) || 0) : 0;
    const hold = holds[idx];
    const free = hold.capacity - hold.biomass;
    const info = hold ? `Hold ${idx+1} — ${hold.species ? capitalizeFirstLetter(hold.species) : 'Empty'} — ${free.toFixed(1)} kg free` : 'N/A';
    document.getElementById('sellHoldInfo').textContent = info;
  };
  if(holds.length > 1){
    if(holdLabel) holdLabel.style.display = '';
    holdSelect.style.display = '';
    holds.forEach((h, idx)=>{
      const free = h.capacity - h.biomass;
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `Hold ${idx+1} — ${h.species ? capitalizeFirstLetter(h.species) : 'Empty'} — ${free.toFixed(1)} kg free`;
      holdSelect.appendChild(opt);
    });
    holdSelect.onchange = updateHoldInfo;
    holdSelect.value = '0';
  } else {
    if(holdLabel) holdLabel.style.display = 'none';
    holdSelect.style.display = 'none';
    holdSelect.onchange = null;
    holdSelect.value = '0';
  }
  updateHoldInfo();
  markets.forEach((m,idx)=>{
    const btn = document.createElement('button');
    const price = estimateSellPrice(vessel, m);
    const secs = estimateTravelTime(vessel.location, m.location, vessel);
    btn.innerText = `${m.name} - $${price.toFixed(2)} (${secs.toFixed(1)}s)`;
    btn.onclick = ()=>{
      const hIdx = holds.length > 1 ? (Number(holdSelect.value) || 0) : 0;
      sellCargo(idx, hIdx);
    };
    optionsDiv.appendChild(btn);
  });
  document.getElementById('sellModal').classList.add('visible');
}
function closeSellModal(){
  document.getElementById('sellModal').classList.remove('visible');
}

function openBargeUpgradeModal(){
  const site = state.sites[state.currentSiteIndex];
  const barge = site.barges[state.currentBargeIndex];

  const setRow = (id, label, lvl, table, key, fnName) => {
    const row = document.getElementById(id);
    if(!row) return;
    row.innerHTML = '';
    const span = document.createElement('span');
    const curr = table[lvl];
    const next = table[lvl + 1];
    const unit = key==='rate' ? 'x' : (key==='staffCapacity' ? '' : 'kg');
    if(next){
      span.textContent = `${label}: ${curr[key]}${unit} → ${next[key]}${unit}`;
      const btn = document.createElement('button');
      btn.textContent = `Upgrade ($${next.cost})`;
      btn.onclick = () => window[fnName]();
      row.appendChild(span);
      row.appendChild(btn);
    } else {
      span.textContent = `${label}: ${curr[key]}${unit} (Max)`;
      row.appendChild(span);
    }
  };

  setRow('upgradeSiloRow','Silo Capacity',barge.siloUpgradeLevel,siloUpgrades,'feedCapacity','upgradeSilo');
  setRow('upgradeBlowerRow','Blower Rate',barge.blowerUpgradeLevel,blowerUpgrades,'rate','upgradeBlower');
  setRow('upgradeHousingRow','Staff Capacity',barge.housingUpgradeLevel,housingUpgrades,'staffCapacity','upgradeHousing');

  document.getElementById('bargeUpgradeModal').classList.add('visible');
}
function closeBargeUpgradeModal(){
  document.getElementById('bargeUpgradeModal').classList.remove('visible');
}

function openShipyard(){
  const list = document.getElementById('shipyardList');
  list.innerHTML = '';
  const refreshBtn = document.getElementById('refreshListingsBtn');
  if(refreshBtn){
    const daysSince = state.totalDaysElapsed - state.shipyardLastRefreshDay;
    refreshBtn.disabled = daysSince < state.SHIPYARD_RESTOCK_INTERVAL;
  }
  state.shipyardInventory.forEach((v, idx)=>{
    const row = document.createElement('div');
    row.className = 'shipyard-row shipyard-card used-vessel-card';
    if(v.conditionNote) row.title = v.conditionNote;
    const iconPath = vesselIcons[v.class];
    const iconHTML = iconPath ?
      `<img src="${iconPath}" class="vessel-icon-small" alt="${v.class}">` : '🛥️';
    row.innerHTML = `
      <div class="used-label">Used Vessel - ${v.conditionLabel}</div>
      <div class="vessel-name">${v.name}</div>
      <div class="vessel-class">${iconHTML} ${vesselClasses[v.class].name}</div>
      <div class="shipyard-stat"><span>Capacity</span><span>${v.cargoCapacity} kg</span></div>
      <div class="shipyard-stat"><span>Speed</span><span>${v.speed}</span></div>
      <div class="shipyard-stat"><span>Slots</span><span>${v.upgradeSlots}</span></div>
      <div class="shipyard-stat price"><span>Price</span><span>$${v.cost}</span></div>`;
    const btn = document.createElement('button');
    btn.innerText = 'Buy';
    btn.onclick = ()=>buyShipyardVessel(idx);
    if(state.cash < v.cost) btn.disabled = true;
    row.appendChild(btn);
    list.appendChild(row);
  });
  prepareCustomBuildPanel();
  const toggles = document.getElementById('shipyardToggleButtons');
  toggles.innerHTML = `
    <button id="toggleUsedBtn" onclick="backToShipyardList()">Used</button>
    <button id="toggleBuildBtn" onclick="openCustomBuild()">Custom Build</button>
  `;
  backToShipyardList();
  document.getElementById('shipyardModal').classList.add('visible');
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  document.body.classList.add('modal-open');
  document.documentElement.classList.add('modal-open');
}

function prepareCustomBuildPanel(){
  const select = document.getElementById('buildClassSelect');
  select.innerHTML = Object.entries(vesselClasses)
    .map(([cls,data])=>`<option value="${cls}">${data.name}</option>`).join('');
  select.value = Object.keys(vesselClasses)[0];
  const nameInput = document.getElementById('buildNameInput');
  nameInput.value = '';
  nameInput.classList.remove('input-error');
  nameInput.title = '';
  nameInput.removeEventListener('input', validateBuildName);
  nameInput.addEventListener('input', validateBuildName);
  updateCustomBuildStats();
}
function closeShipyard(){
  document.getElementById('shipyardModal').classList.remove('visible');
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  document.body.classList.remove('modal-open');
  document.documentElement.classList.remove('modal-open');
}

function openCustomBuild(){
  prepareCustomBuildPanel();
  document.getElementById('customBuildPanel').classList.add('active');
  document.getElementById('usedVesselsPanel').classList.remove('active');
  const usedBtn = document.getElementById('toggleUsedBtn');
  const buildBtn = document.getElementById('toggleBuildBtn');
  if(usedBtn && buildBtn){
    usedBtn.classList.remove('active');
    buildBtn.classList.add('active');
  }
}

function backToShipyardList(){
  document.getElementById('customBuildPanel').classList.remove('active');
  document.getElementById('usedVesselsPanel').classList.add('active');
  const usedBtn = document.getElementById('toggleUsedBtn');
  const buildBtn = document.getElementById('toggleBuildBtn');
  if(usedBtn && buildBtn){
    usedBtn.classList.add('active');
    buildBtn.classList.remove('active');
  }
}

function updateCustomBuildStats(){
  const cls = document.getElementById('buildClassSelect').value;
  const data = vesselClasses[cls];
  const cost = Math.round(data.cost * CUSTOM_BUILD_MARKUP);
  const costRow = document.getElementById('buildCostRow');
  costRow.innerHTML = `<span>Cost</span><span>$${cost}</span>`;
  document.getElementById('buildStats').innerHTML = `
    <div class="shipyard-stat"><span>Capacity</span><span>${data.baseCapacity} kg</span></div>
    <div class="shipyard-stat"><span>Speed</span><span>${data.baseSpeed}</span></div>
    <div class="shipyard-stat"><span>Slots</span><span>${data.slots}</span></div>`;
  const iconPath = vesselIcons[cls];
  const iconEl = document.getElementById('classIconPreview');
  if(iconEl){
    if(iconPath){
      iconEl.innerHTML = `<img src="${iconPath}" class="build-icon" alt="${cls}">`;
    } else {
      iconEl.textContent = '🛥️';
    }
  }
  const msgEl = document.getElementById('buildLockMessage');
  const req = vesselUnlockDays[cls] || 0;
  if(state.totalDaysElapsed < req && cls !== 'skiff'){
    msgEl.style.display = 'block';
    msgEl.innerText = `Locked until Day ${req}`;
  } else {
    msgEl.style.display = 'none';
    msgEl.innerText = '';
  }
}

function validateBuildName(){
  const input = document.getElementById('buildNameInput');
  const name = input.value.trim();
  if(!name){
    input.classList.remove('input-error');
    input.title = '';
    return;
  }
  if(state.vessels.some(v=>v.name.toLowerCase()===name.toLowerCase())){
    input.classList.add('input-error');
    input.title = 'Name already exists';
  } else {
    input.classList.remove('input-error');
    input.title = '';
  }
}

function startOffloading(vessel, market, holdIndex=0){
  vessel.unloading = true;
  vessel.status = 'offloading';
  vessel.offloadRevenue = 0;
  vessel.offloadMarket = market.name;
  const holds = vessel.holds && vessel.holds.length > 0 ? vessel.holds : [{ species: vessel.cargoSpecies ?? null, biomass: vessel.currentBiomassLoad ?? 0, capacity: vessel.maxBiomassCapacity ?? 0 }];
  if(holdIndex < 0 || holdIndex >= holds.length) holdIndex = 0;
  vessel.offloadHoldIndex = holdIndex;
  const hold = holds[holdIndex];
  vessel.fishBuffer.forEach(fish => {
    if(fish.salePrice === undefined){
      const sp = fish.species || hold?.species;
      const mp = market.prices?.[sp];
      if(mp !== undefined){
        fish.salePrice = mp;
      } else {
        const base = speciesData[sp]?.marketPrice || 0;
        const mod  = market.modifiers[sp] || 1;
        fish.salePrice = base * mod;
      }
    }
  });
  const rate = state.OFFLOAD_RATE;
  const updateEta = ()=>{ vessel.busyUntil = Date.now() + (hold.biomass / rate) * 1000; vessel.actionEndsAt = vessel.busyUntil; };
  updateEta();
  let last = Date.now();
  vessel.offloadInterval = setInterval(()=>{
    const now = Date.now();
    if(state.timePaused){ last = now; return; }
    let dt = (now - last)/1000;
    last = now;
    let remaining = rate * dt;
    while(remaining > 0 && hold.biomass > 0 && vessel.fishBuffer.length > 0){
      const fish = vessel.fishBuffer[0];
      const sp = fish.species || hold.species;
      const price = fish.salePrice || 0;
      if(fish.weight <= remaining){
        remaining -= fish.weight;
        hold.biomass -= fish.weight;
        vessel.offloadRevenue += fish.weight * price;
        if(market.daysSinceSale) market.daysSinceSale[sp] = 0;
        vessel.fishBuffer.shift();
      } else {
        fish.weight -= remaining;
        hold.biomass -= remaining;
        vessel.offloadRevenue += remaining * price;
        if(market.daysSinceSale) market.daysSinceSale[sp] = 0;
        remaining = 0;
      }
    }
    vessel.currentBiomassLoad = hold.biomass; // TODO: remove after holds migration
    vessel.cargoSpecies = hold.species; // TODO: remove after holds migration
    updateEta();
    updateDisplay();
    const epsilon = 0.0001;
    if(hold.biomass <= epsilon || vessel.fishBuffer.length === 0){
      hold.biomass = 0;
      finishOffloading(vessel, market);
    }
  },250);
}

function finishOffloading(vessel, market, canceled=false){
  if(vessel.offloadInterval){ clearInterval(vessel.offloadInterval); vessel.offloadInterval = null; }
  vessel.unloading = false;
  vessel.status = 'idle';
  vessel.busyUntil = 0;
  vessel.destination = null;
  vessel.actionEndsAt = 0;
  let earned = vessel.offloadRevenue || 0;
  state.cash += earned;
  if(earned > 0){
    state.milestones.firstSale = true;
    state.onboarding.steps.sold = true;
    checkMilestones();
  }
  vessel.offloadRevenue = 0;
  vessel.offloadMarket = null;
  const hIdx = vessel.offloadHoldIndex ?? 0;
  const hold = vessel.holds?.[hIdx];
  if(!canceled){
    vessel.fishBuffer = [];
    if(hold){
      hold.biomass = 0;
      hold.species = null;
    }
    vessel.currentBiomassLoad = 0; // TODO: remove after holds migration
    vessel.cargoSpecies = null; // TODO: remove after holds migration
    vessel.cargo = {};
    if(market && market.daysSinceSale){
      // daysSinceSale already updated during offload
    }
  }
  const msg = canceled ? `Offloading canceled. Earned $${earned.toFixed(2)} so far.` :
                         `Sold cargo for $${earned.toFixed(2)} at ${market.name}.`;
  openModal(msg);
  vessel.offloadHoldIndex = null;
  syncLegacyVesselFields(vessel);
  updateDisplay();
}

function sellCargo(idx, holdIndex=0){
  const vessel = state.vessels[state.currentVesselIndex];
  const holds = vessel.holds && vessel.holds.length > 0 ? vessel.holds : [{ species: vessel.cargoSpecies ?? null, biomass: vessel.currentBiomassLoad ?? 0, capacity: vessel.maxBiomassCapacity ?? 0 }];
  if(holdIndex < 0 || holdIndex >= holds.length) holdIndex = 0;
  const hold = holds[holdIndex];
  if(vessel.status !== 'idle'){ closeSellModal(); return openModal('Vessel currently busy.'); }
  if(!hold || hold.biomass<=0) return openModal('No biomass to sell.');
  const market = markets[idx];
  if(vessel.destination === market.name && vessel.status === 'enRoute'){
    closeSellModal();
    return openModal('Vessel already en route to this market.');
  }
  vessel.offloadMarket = market.name;
  vessel.offloadRevenue = 0;
  const begin = ()=>{ startOffloading(vessel, market, holdIndex); updateDisplay(); };
  if(vessel.location === market.name){
    closeSellModal();
    begin();
  } else {
    const startLoc = state.getLocationByName(vessel.location) || market.location;
    const dx = startLoc.x - market.location.x;
    const dy = startLoc.y - market.location.y;
    const distance = Math.hypot(dx, dy);
    const travelTime = distance / vessel.speed * state.TRAVEL_TIME_FACTOR;
    vessel.destination = market.name;
    vessel.status = 'enRoute';
    vessel.busyUntil = Date.now() + travelTime;
    vessel.actionEndsAt = vessel.busyUntil;
    closeSellModal();
    if(vessel.travelInterval){ clearInterval(vessel.travelInterval); }
    vessel.travelInterval = setInterval(()=>{
      if(state.timePaused) return;
      if(Date.now() >= vessel.busyUntil){
        clearInterval(vessel.travelInterval);
        vessel.travelInterval = null;
        vessel.busyUntil = 0;
        vessel.actionEndsAt = 0;
        vessel.location = market.name;
        vessel.destination = null;
        begin();
      }
    },250);
  }
}

function openMarketReport(){
  const container = document.getElementById('marketReportContent');
  container.innerHTML = '<h2>Market Report</h2>';

  const timestamp = document.createElement('div');
  timestamp.className = 'market-timestamp';
  const dateStr = state.lastMarketUpdateString || getDateString();
  timestamp.innerText = `Prices last updated: ${dateStr}`;
  container.appendChild(timestamp);

  markets.forEach(m => {
    const section = document.createElement('div');
    section.classList.add('market-section');

    const h = document.createElement('h3');
    h.innerText = m.name;
    section.appendChild(h);

    const table = document.createElement('table');
    table.classList.add('market-table');

    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Species</th><th>Price</th><th>Change</th><th>5-Day Trend</th><th>Last 5</th></tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for(const sp in m.prices){
      const row = document.createElement('tr');

      const nameCell = document.createElement('td');
      nameCell.innerText = state.capitalizeFirstLetter(sp);

      const price = m.prices[sp];
      const history = m.priceHistory[sp];
      const prevPrice = history[history.length - 2] || price;
      const delta = price - prevPrice;

      const recent = history.slice(-5).map(p=>p.toFixed(2)).join(', ');
      const trendDeltas = [];
      for(let i=Math.max(history.length-5,1); i<history.length; i++){
        const diff = history[i] - history[i-1];
        trendDeltas.push(diff);
      }
      const trendHtml = trendDeltas.map(d=>{
        const arrow = d > 0 ? '↑' : d < 0 ? '↓' : '→';
        const cls = d > 0 ? 'trend-up' : d < 0 ? 'trend-down' : 'trend-flat';
        return `<span class="${cls}">${d>=0?'+':''}${d.toFixed(2)}${arrow}</span>`;
      }).join(', ');
      const high = Math.max(...history.slice(-7));
      const low = Math.min(...history.slice(-7));

      const priceCell = document.createElement('td');
      priceCell.innerText = `$${price.toFixed(2)}`;
      if(price === high) priceCell.innerText += ' ▲';
      if(price === low) priceCell.innerText += ' ▼';

      const changeCell = document.createElement('td');
      const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
      changeCell.innerText = `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} ${arrow}`;
      changeCell.className = delta > 0 ? 'trend-up' : delta < 0 ? 'trend-down' : '';

      const trendCell = document.createElement('td');
      trendCell.innerHTML = trendHtml;
      trendCell.classList.add('trend-history');

      const histCell = document.createElement('td');
      histCell.innerText = recent;
      histCell.classList.add('history-cell');

      row.appendChild(nameCell);
      row.appendChild(priceCell);
      row.appendChild(changeCell);
      row.appendChild(trendCell);
      row.appendChild(histCell);
      tbody.appendChild(row);
    }

    table.appendChild(tbody);
    section.appendChild(table);

    const canvas = document.createElement('canvas');
    canvas.classList.add('market-chart');
    canvas.width = 300;
    canvas.height = 150;
    canvas.dataset.market = m.name;
    section.appendChild(canvas);

    const legend = document.createElement('div');
    legend.classList.add('market-legend');
    for(const sp in m.prices){
      const item = document.createElement('span');
      item.classList.add('legend-item');
      const colorBox = document.createElement('span');
      colorBox.classList.add('legend-color');
      colorBox.style.backgroundColor = speciesColors[sp] || '#fff';
      item.appendChild(colorBox);
      const lbl = document.createElement('span');
      lbl.innerText = state.capitalizeFirstLetter(sp);
      item.appendChild(lbl);
      legend.appendChild(item);
    }
    section.appendChild(legend);

    renderMarketChart(m, canvas);

    container.appendChild(section);
  });

  document.getElementById('marketReportPage').classList.add('visible');
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
}

function closeMarketReport(){
  document.getElementById('marketReportPage').classList.remove('visible');
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
}

function openBank(){
  const modal = document.getElementById('bankModal');
  if(modal){
    updateBankDisplay();
    modal.classList.add('visible');
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }
}

function closeBank(){
  const modal = document.getElementById('bankModal');
  if(modal){
    modal.classList.remove('visible');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }
}

function handleDeposit() {
  const amount = parseFloat(document.getElementById('bankDepositInput').value);
  depositToBank(amount);
  updateBankDisplay();
}

function handleWithdraw() {
  const amount = parseFloat(document.getElementById('bankWithdrawInput').value);
  withdrawFromBank(amount);
  updateBankDisplay();
}

function handleTakeLoan() {
  const amount = parseFloat(document.getElementById('loanAmountInput').value);
  takeLoan(amount);
  updateBankDisplay();
}

function updateBankDisplay() {
  const depositEl = document.getElementById('bankDepositDisplay');
  if(depositEl) depositEl.textContent = state.bank.deposit.toFixed(2);

  const list = document.getElementById('loanList');
  if(!list) return;
  list.innerHTML = '';
  if(state.bank.loans.length === 0){
    list.textContent = 'No active loans';
    return;
  }

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Remaining</th><th>Days</th><th></th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');

  state.bank.loans.forEach(loan => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>$${loan.remaining.toFixed(2)}</td><td>${loan.daysActive}</td>`;
    const btnCell = document.createElement('td');
    const btn = document.createElement('button');
    btn.textContent = 'Repay';
    btn.onclick = () => { repayLoan(loan.id, loan.remaining); updateBankDisplay(); };
    btnCell.appendChild(btn);
    row.appendChild(btnCell);
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  list.appendChild(table);
}

function openMarketReports(){
  openMarketReport();
}

function openSiteManagementModalLegacy(){
  // Legacy helper now routes to the in-page panel
  openSiteManagement();
}

function closeSiteManagementModalLegacy(){
  // Legacy helper now routes to the in-page panel
  closeSiteManagement();
}

let siteMgmtTriggerEl = null;
let siteMgmtKeyHandler = null;

function openSiteManagement(tab = null, trigger = null){
  const panel = document.getElementById('siteManagementPanel');
  if(!panel || panel.classList.contains('open')) return;
  siteMgmtTriggerEl = trigger || document.activeElement;
  const nameEl = document.getElementById('siteMgmtSiteName');
  if(nameEl) nameEl.innerText = state.sites[state.currentSiteIndex].name;
  updateSiteLicenses();
  updateLicenseDropdown();
  updateSiteUpgrades();
  panel.classList.add('open');
  panel.setAttribute('aria-hidden','false');
  const backdrop = document.getElementById('siteMgmtBackdrop');
  backdrop && backdrop.classList.add('open');
  document.body.classList.add('panel-open');
  switchSiteMgmtTab(tab || localStorage.getItem('siteMgmtTab') || 'licenses');
  localStorage.setItem('siteMgmtOpen','true');
  siteMgmtKeyHandler = function(e){
    if(e.key === 'Escape'){
      e.preventDefault();
      closeSiteManagement();
    } else if(e.key === 'Tab'){
      const focusables = panel.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
      if(focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if(e.shiftKey && document.activeElement === first){
        e.preventDefault();
        last.focus();
      } else if(!e.shiftKey && document.activeElement === last){
        e.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener('keydown', siteMgmtKeyHandler);
  const header = document.getElementById('siteMgmtHeader');
  header && header.focus();
}

function closeSiteManagement(){
  const panel = document.getElementById('siteManagementPanel');
  if(panel){
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden','true');
  }
  const backdrop = document.getElementById('siteMgmtBackdrop');
  backdrop && backdrop.classList.remove('open');
  document.body.classList.remove('panel-open');
  if(siteMgmtKeyHandler){
    document.removeEventListener('keydown', siteMgmtKeyHandler);
    siteMgmtKeyHandler = null;
  }
  localStorage.setItem('siteMgmtOpen','false');
  if(siteMgmtTriggerEl){
    siteMgmtTriggerEl.focus();
    siteMgmtTriggerEl = null;
  }
}

function switchSiteMgmtTab(tab){
  const tabs = ['licenses','upgrades','settings'];
  tabs.forEach(t => {
    const btn = document.getElementById('siteMgmtTab-' + t);
    const pane = document.getElementById('siteMgmtPane-' + t);
    const selected = t === tab;
    if(btn){
      btn.setAttribute('aria-selected', String(selected));
    }
    if(pane){
      pane.classList.toggle('hidden', !selected);
    }
  });
  localStorage.setItem('siteMgmtTab', tab);
}

function initSiteManagementPanel(){
  const storedTab = localStorage.getItem('siteMgmtTab') || 'licenses';
  switchSiteMgmtTab(storedTab);
  if(localStorage.getItem('siteMgmtOpen') === 'true'){
    openSiteManagement(storedTab);
  }
}

function openDevModal(){
  document.getElementById('devModal').classList.add('visible');
  updateOnboardingToggleButton();
}

function closeDevModal(){
  document.getElementById('devModal').classList.remove('visible');
}

function openSpeciesData() {
  const modal = document.getElementById('speciesDataModal');
  const tbody = modal.querySelector('tbody');
  tbody.innerHTML = '';
  Object.entries(speciesData).forEach(([name, s]) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${name}</td>
      <td>${s.fcr ?? '-'}</td>
      <td>${s.restockCount ?? '-'}</td>
      <td>${s.growthRate ?? '-'}</td>
    `;
    tbody.appendChild(row);
  });
  modal.classList.add('visible');
}

function closeSpeciesData() {
  document.getElementById('speciesDataModal').classList.remove('visible');
}

function renderLogbook(){
  const list = document.getElementById('milestoneList');
  if(!list) return;
  list.innerHTML = '';
  milestones.forEach(m => {
    const row = document.createElement('div');
    row.className = 'milestone-entry';
    const desc = document.createElement('span');
    desc.textContent = m.description;
    const status = document.createElement('span');
    status.textContent = state.milestones[m.id] ? '✅' : '❌';
    row.appendChild(desc);
    row.appendChild(status);
    list.appendChild(row);
  });
}

function renderSpeciesInfo(){
  const container = document.getElementById('speciesInfoList');
  if(!container) return;
  container.innerHTML = '';
  const sorted = Object.keys(speciesData).sort((a,b)=>a.localeCompare(b));
  sorted.forEach(key => {
    const data = speciesData[key];
    const row = document.createElement('div');
    row.className = 'logbook-species-entry';

    const img = document.createElement('img');
    img.src = `assets/species-icons/${key}.png`;
    img.alt = key;
    img.className = 'logbook-species-icon';

    const info = document.createElement('div');
    info.className = 'species-info';

    const name = document.createElement('div');
    name.className = 'species-name';
    name.textContent = data.displayName || capitalizeFirstLetter(key);

    const stats = document.createElement('div');
    stats.className = 'species-stats';
    stats.innerHTML =
      `<span>Max ${data.maxWeight}kg</span>`+
      ` <span>$${data.marketPrice}/kg</span>`+
      ` <span>FCR ${data.fcr}</span>`+
      ` <span>Restock ${data.restockCount}</span>`;

    const tagsRow = document.createElement('div');
    tagsRow.className = 'species-tags';
    if(data.tags && data.tags.length){
      data.tags.forEach(t => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = t;
        tagsRow.appendChild(span);
      });
    }

    info.appendChild(name);
    info.appendChild(stats);
    info.appendChild(tagsRow);

    row.appendChild(img);
    row.appendChild(info);
    container.appendChild(row);
  });
}

function switchLogbookSection(section){
  logbookSection = section;
  const sections = ['milestones','species','contracts','upgrades'];
  sections.forEach(s => {
    const content = document.getElementById('logbook' + capitalizeFirstLetter(s));
    const tab = document.getElementById('tab' + capitalizeFirstLetter(s));
    if(content) content.classList.toggle('hidden', s !== section);
    if(tab) tab.classList.toggle('active', s === section);
  });
  if(section === 'milestones') renderLogbook();
  if(section === 'species') renderSpeciesInfo();
  if(section === 'contracts') renderContracts();
}

function openLogbook(){
  switchLogbookSection('milestones');
  const modal = document.getElementById('logbookModal');
  if(modal){
    modal.classList.add('visible');
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }
}

function closeLogbook(){
  const modal = document.getElementById('logbookModal');
  if(modal){
    modal.classList.remove('visible');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }
}

function updateMarketCharts(){
  const charts = document.querySelectorAll('.market-chart');
  charts.forEach(c => {
    const market = markets.find(m => m.name === c.dataset.market);
    if(market) renderMarketChart(market, c);
  });
}

function renderMarketChart(market, canvas){
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0,0,width,height);

  const species = Object.keys(market.prices);
  let values = [];
  species.forEach(sp => { values = values.concat(market.priceHistory[sp]); });
  const max = Math.max(...values);
  const min = Math.min(...values);
  const padding = 10;

  species.forEach(sp => {
    const hist = market.priceHistory[sp];
    const step = (width - padding*2) / (hist.length - 1);
    ctx.beginPath();
    ctx.strokeStyle = speciesColors[sp] || '#fff';
    ctx.lineWidth = 2;
    hist.forEach((val, idx) => {
      const x = padding + idx * step;
      const yRange = max - min || 1;
      const y = height - padding - ((val - min)/yRange)*(height - padding*2);
      if(idx===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
  });
}

// --- Feed Purchase UI ---
function updateFeedPurchaseCost(){
  const slider = document.getElementById('feedPurchaseSlider');
  if(!slider) return;
  const costEl = document.getElementById('feedPurchaseCost');
  const val = Number(slider.value) || 0;
  if(costEl) costEl.innerText = `Cost: $${(val * state.FEED_COST_PER_KG).toFixed(2)}`;
}

function syncFeedPurchase(source){
  const slider = document.getElementById('feedPurchaseSlider');
  const input = document.getElementById('feedPurchaseInput');
  if(!slider || !input) return;
  let val = source === 'slider' ? Number(slider.value) : Number(input.value);
  if(isNaN(val)) val = 0;
  if(val < 0) val = 0;
  const max = Number(slider.max || 0);
  if(val > max) val = max;
  slider.value = val;
  input.value = val;
  updateFeedPurchaseCost();
}

function updateFeedPurchaseUI(){
  const slider = document.getElementById('feedPurchaseSlider');
  const input = document.getElementById('feedPurchaseInput');
  if(!slider || !input) return;
  const site = state.sites[state.currentSiteIndex];
  const barge = site.barges[state.currentBargeIndex];
  const maxAffordable = Math.floor(state.cash / state.FEED_COST_PER_KG);
  const available = barge.feedCapacity - barge.feed;
  const max = Math.max(0, Math.min(maxAffordable, available));
  slider.max = max;
  input.max = max;
  if(Number(slider.value) > max) slider.value = max;
  if(Number(input.value) > max) input.value = max;
  updateFeedPurchaseCost();
}

function confirmBuyFeed(){
  const slider = document.getElementById('feedPurchaseSlider');
  if(!slider) return;
  const amount = Number(slider.value) || 0;
  window.buyFeed(amount);
  slider.value = 0;
  const input = document.getElementById('feedPurchaseInput');
  if(input) input.value = 0;
  updateFeedPurchaseUI();
}

function setFeedPurchaseMax(){
  const slider = document.getElementById('feedPurchaseSlider');
  const input = document.getElementById('feedPurchaseInput');
  if(!slider || !input) return;
  updateFeedPurchaseUI();
  slider.value = slider.max;
  input.value = slider.max;
  updateFeedPurchaseCost();
}

// --- Site Switcher ---
function toggleSiteList(){
  const list = document.getElementById('siteDropdownList');
  if(!list) return;
  if(list.classList.contains('visible')){
    list.classList.remove('visible');
    list.classList.add('hidden');
  } else {
    list.classList.remove('hidden');
    list.classList.add('visible');
  }
}

function selectSite(index){
  if(index < 0 || index >= state.sites.length) return;
  state.currentSiteIndex = index;
  state.currentPenIndex = 0;
  state.currentBargeIndex = 0;
  updateDisplay();
  updateLicenseDropdown();
  const list = document.getElementById('siteDropdownList');
  if(list){
    list.classList.remove('visible');
    list.classList.add('hidden');
  }
}

function populateSiteList(){
  const list = document.getElementById('siteDropdownList');
  if(!list) return;
  list.innerHTML = '';
  state.sites.forEach((s, i) => {
    const item = document.createElement('div');
    item.textContent = s.name;
    if(i === state.currentSiteIndex) item.classList.add('active');
    item.onclick = () => selectSite(i);
    list.appendChild(item);
  });
}

function toggleStatusPanel(key){
  const panels = { feed: 'feedPanel', barge: 'bargePanel', staff: 'staffPanel' };
  const icons  = { feed: 'feedStatusIcon', barge: 'bargeStatusIcon', staff: 'staffStatusIcon' };
  const panel = document.getElementById(panels[key]);
  if(!panel) return;
  const isVisible = panel.classList.contains('visible');
  Object.values(panels).forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.classList.remove('visible');
  });
  Object.values(icons).forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.classList.remove('active');
  });
  if(!isVisible){
    panel.classList.add('visible');
    const icon = document.getElementById(icons[key]);
    if(icon) icon.classList.add('active');
  }
}

  // setup collapsible sections for farm actions
  function initFarmActions(){
    const sections = [
      { key: 'operations', toggle: 'operations-toggle', panel: 'operations-list' },
      { key: 'site',       toggle: 'site-toggle',       panel: 'site-list' },
      { key: 'tools',      toggle: 'tools-toggle',      panel: 'tools-list' }
    ];
    const isDesktop = window.matchMedia('(min-width: 701px)').matches;
    sections.forEach(({key, toggle, panel}) => {
      const btn = document.getElementById(toggle);
      const list = document.getElementById(panel);
      if(!btn || !list) return;
      const storageKey = `farm-section-${key}`;
      function set(open){
        btn.setAttribute('aria-expanded', String(open));
        list.hidden = !open;
      }
      const stored = localStorage.getItem(storageKey);
      if(stored === null){
        set(isDesktop);
      } else {
        set(stored === 'true');
      }
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') !== 'true';
        set(open);
        localStorage.setItem(storageKey, open);
      });
    });
  }

  // --- PURCHASES & ACTIONS ---
  const ui = {
  updateLicenseDropdown,
  updateSiteLicenses,
  renderPenGrid,
  renderVesselGrid,
  renderMap,
  setupMapInteractions,
  setupStatusTooltips,
  closeModal,
  openRestockModal,
  closeRestockModal,
  openHarvestModal,
  closeHarvestModal,
  confirmHarvest,
  openSellModal,
  closeSellModal,
  sellCargo,
  startOffloading,
  finishOffloading,
  openBargeUpgradeModal,
  closeBargeUpgradeModal,
  openShipyard,
  closeShipyard,
  openCustomBuild,
  backToShipyardList,
  updateCustomBuildStats,
  openMarketReport,
  closeMarketReport,
  openBank,
  closeBank,
  handleDeposit,
  handleWithdraw,
  handleTakeLoan,
  updateBankDisplay,
  openMarketReports,
  openSiteManagement,
  closeSiteManagement,
  switchSiteMgmtTab,
  updateSiteUpgrades,
  openDevModal,
  closeDevModal,
  switchLogbookSection,
  openLogbook,
  closeLogbook,
  openSpeciesData,
  closeSpeciesData,
  updateFeedPurchaseUI,
  syncFeedPurchase,
  confirmBuyFeed,
    setFeedPurchaseMax,
    toggleSiteList,
    selectSite,
    populateSiteList,
    toggleLicenseList,
    toggleStatusPanel,
  };

for (const key in ui){
  window[key] = (...args) => window.bootGuard(()=>ui[key](...args));
}

  onBoot(()=>{
    adjustHeaderPadding();
    updateDisplay();
    setupStatusTooltips();
    setupMapInteractions();
    initFarmActions();
    initSiteManagementPanel();
  });

window.addEventListener('pagehide', saveGame);
window.addEventListener('beforeunload', saveGame);

(function mobileDebugToggle(){
  function toggleDebugNav(){
    window.__AQE_setDebugNav?.(!document.body.classList.contains('debug-nav'));
  }

  (function enhanceDebugOverlay(){
    function closeLegacyMenus(){
      document.querySelectorAll('.open,.is-open,[data-open="true"]')
        .forEach(el => el.classList.remove('open','is-open'));
    }

    const originalToggle = document.body.classList.contains('debug-nav');

    function setDebugNav(on){
      document.body.classList.toggle('debug-nav', on);
      if (on) closeLegacyMenus();
      console.log('Debug nav:', on ? 'ON' : 'OFF');
    }

    window.__AQE_setDebugNav = setDebugNav;

    // ESC to exit debug overlay
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && document.body.classList.contains('debug-nav')){
      setDebugNav(false);
    }
  });
})();

  // 5-tap on Cash label
  const cashEl = document.getElementById('cashLabel');
  if (cashEl){
    let taps = 0, timer = null;
    cashEl.addEventListener('click', () => {
      taps++;
      clearTimeout(timer);
      timer = setTimeout(()=>{ taps = 0; }, 3000);
      if (taps >= 5){ toggleDebugNav(); taps = 0; }
    });
  } else {
    // Fallback chip if Cash isn’t found
    const chip = document.getElementById('debugChip');
    if (chip){
      chip.style.display = 'inline-block';
      chip.addEventListener('click', toggleDebugNav);
}
  }

  const btn = document.getElementById('debugClose');
  if (btn){
    btn.addEventListener('click', () => {
      // Prefer central setter if present, else toggle class
      if (window.__AQE_setDebugNav){
        window.__AQE_setDebugNav(false);
      } else {
        document.body.classList.remove('debug-nav');
      }
    });

    // Show/hide based on debug state
    const obs = new MutationObserver(() => {
      if (document.body.classList.contains('debug-nav')) {
        btn.removeAttribute('hidden');
      } else {
        btn.setAttribute('hidden','');
      }
    });
    obs.observe(document.body, { attributes:true, attributeFilter:['class'] });
  }
})();
