# Aquaculture Empire — Feature Backlog (v0.2 planning)

Status: living backlog for planning.  
Tags: [v0.2] = target this version, [future] = not this version.

---

## Core Loop & Systems

- [v0.2] Harvest modal clamps & integer-fish conversion — DONE
- [v0.2] Pen lock during harvest; skip growth/feed — DONE
- [v0.2] Restock quantity with pricing; block mixing — DONE
- [v0.2] Growth helper extraction (no behavior change) — DONE
- [v0.2] Vessel holds scaffold + selector; keep scalars in sync — PARTIAL
- [v0.2] Empty-pen safety: sanitize to avoid NaN (display & dev tools) — TODO
- [v0.2] Shared ETA helper used everywhere (harvest/travel/offload) — TODO
- [v0.2] Save/load backfill for holds[]; write saveVersion — TODO
- [future] Make holds[] the single source of truth; remove legacy scalars — TODO

## Onboarding & Guidance

- [v0.2] First-run tooltips (stock pen, harvest, sell, upgrade) — TODO
- [v0.2] Soft gating: greyed-out buttons with “why” message until first harvest/sale — TODO
- [v0.2] Milestone checklist: 5 steps for first session — TODO
- [v0.3] New Game “Choose Starter Species” modal (warm vs cold water) — PLAN
- [v0.3] Region tags on sites; starter choice sets initial region — PLAN
- [future] Licenses to expand into new regions/species — PLAN

## Economy & Markets

- [v0.3] Basic market drift/volatility; occasional events — PLAN
- [future] Seasonal patterns per region — PLAN
- [future] Operating costs (fuel/maintenance/staff wages) — PLAN
- [future] Contracts with distances & travel times — EXPAND

## Vessels & Holds

- [v0.2] Hold selector UI polish (hide when single; label with species + free kg) — TODO
- [v0.3] Multi-hold vessels available in shipyard; per-hold species enforcement — PLAN
- [future] Vessel upgrades: speed, capacity, crew, add-hold modules — PLAN
- [future] Sell vessels; rename with small fee — PLAN

## Pens, Biology & Growth

- [v0.3] Mortality stub (disabled by default, dev-toggle) — PLAN
- [future] Growth efficacy curve vs size; FCR worsens at high weight — PLAN
- [future] Environment effects (temperature/storms) by region/site — PLAN
- [future] Disease events impacting mortality/growth — PLAN

## Automation & Staffing

- [future] Staff roles (feeders/harvesters/manager) with simple perks — PLAN
- [future] Auto-sell when docked; auto-restock by plan — PLAN

## UI/UX

- [v0.2] Hold selector polish (see above) — TODO
- [v0.2] Top-bar tooltips/labels for icons; font size passes — TODO
- [v0.2] Hauler inline status + ETA everywhere — TODO
- [v0.3] Tutorial overlay (toggleable); help button — PLAN
- [future] Shipyard redesign; market panel revamp — PLAN

## Dev / Tech Debt

- [v0.2] Centralize time/ETA formatting helper — TODO
- [v0.2] Minimal browser-playtest checklist & console scan before each merge — TODO
- [future] Split monolithic JS into modules (Pens, Vessels, Markets, UI) — PLAN
- [future] Simple in-browser tests or headless DOM harness for core math — PLAN

## Notes from Brainstorm (preserved)

- Starter species choice at new game; ties to region & licensing later.  
- Region-locked species/sites; licenses to expand.  
- Price trends, events; contracts with distance & travel.  
- Multi-hold, multi-species logistics with per-hold rules.  
- Mortality and environment depth later.  
- Keep icon style: 128px, white silhouette, transparent, flat.
