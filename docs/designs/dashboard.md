## Frontend Design Spec: Live Show Experiment Dashboard

### Product goals

1. Let a producer run repeatable marketing cycles without spreadsheet chaos.
2. Keep the human in control (approve segments/frames/creative before anything is “live”).
3. Make it obvious what to do next: **Create → Generate → Approve → Run Ads → Enter Results → Decide → Memo**.
4. Preserve evidence/constraints so the agent outputs don’t drift.

### Primary user

* Solo producer, smart, non-technical, time constrained.
* Cares about: ticket sales, CPA/ROAS, what to try next, and not wasting money.

### Core objects (UI mental model)

* **Show**: one event.
* **Cycle**: one experiment iteration for a show (usually weekly or per campaign).
* **Segment**: audience target.
* **Frame**: hypothesis + promise + channel (and evidence constraints).
* **Creative Variant**: specific ad copy for a frame/platform.
* **Experiment**: a runnable unit (Frame + Creative + targeting + UTM bundle).
* **Observation**: performance metrics the producer enters.
* **Decision**: Scale/Hold/Kill with reasons.
* **Memo**: one-page summary of the cycle.

---

## IA: Navigation & Pages

### Global navigation

* Left rail:

  * Shows
  * Experiments (optional global view)
  * Knowledge Base (optional)
  * Settings

### Show-centric navigation (inside a Show)

Tabs:

1. **Overview**
2. **Plan (Strategy)**
3. **Create (Creative)**
4. **Run (Experiments)**
5. **Results**
6. **Memo**

This mirrors the loop and reduces “where am I?” confusion.

---

## Page specs

### 1) Shows List

**Purpose:** pick a show or create a new one.

**UI**

* Table/cards with:

  * Artist / Show name
  * City, Venue
  * Date (and “days until”)
  * Capacity
  * Sales (current / target)
  * Status badge: Draft / Active / Past
* Primary CTA: **Create show**

**Interactions**

* Search/filter by artist, date range, status.

---

### 2) Show Overview

**Purpose:** “dashboard-at-a-glance” + the next action.

**Sections**

* Hero summary card:

  * Show details + “days until”
  * Sales progress bar (tickets sold / capacity)
  * Phase badge (early/mid/late)
* “Next action” panel:

  * If no cycle: **Start Cycle**
  * If cycle exists and no strategy: **Run Strategy Agent**
  * If strategy complete and creative pending: **Generate Creative**
  * If experiments approved but no results: **Enter Results**
  * If results exist: **Run Decision Engine**
  * If decisions exist: **Generate Memo**
* Recent activity timeline (events emitted by backend)

**KPIs (minimal set)**

* Tickets sold
* Spend (this cycle)
* CPA (or cost per ticket)
* ROAS (if revenue tracked)
* CTR (optional)

---

### 3) Plan (Strategy) Tab

**Purpose:** generate, review, edit, approve segments + frames.

#### 3.1 Strategy Run Screen

* Button: **Run Strategy Agent**
* Shows:

  * last run timestamp
  * “reasoning summary” (short)
  * token usage (collapsed/advanced)
  * status: idle/running/failed

#### 3.2 Segments Panel

* List of proposed segments (cards)

  * name
  * definition (geo/interests/behaviors/demos)
  * estimated size (if available)
  * confidence/risk notes
* Actions per segment:

  * Approve / Reject
  * Edit segment definition (inline modal)

#### 3.3 Frames Panel (depends on approved segments)

* For each segment: frames list
* Frame card fields:

  * hypothesis
  * promise
  * channel(s)
  * evidence refs
  * risk notes
* Actions:

  * Approve frame
  * Edit frame text
  * “Lock evidence” toggle (enforces evidence-bounded copy)

**UX requirement**

* The producer must be able to approve only some segments/frames.

---

### 4) Create (Creative) Tab

**Purpose:** run Creative Agent on selected frames; review and approve variants.

#### 4.1 Frame Picker

* Filters:

  * Segment
  * Channel (FB/IG/YT/Reddit/TikTok/Snap)
  * Status (approved/unapproved)
* Multi-select frames → CTA: **Generate Creative**

#### 4.2 Creative Generation Queue

* Shows batch jobs:

  * frame name
  * platform
  * status
  * retry button on failure

#### 4.3 Creative Review

For each frame → per platform → list variants (2–3)
Variant card:

* Hook
* Body
* CTA
* Notes: “constraints satisfied” checklist:

  * Mentions promise?
  * Avoids forbidden claims?
  * Uses evidence refs (if required)?
* Actions:

  * Approve variant
  * Edit variant (and mark “human edited”)
  * Reject variant

**Important product constraint**

* Separate “agent output” from “final approved copy”.
* Keep both in history.

---

### 5) Run (Experiments) Tab

**Purpose:** turn approved creative into runnable experiments with UTMs and targeting guidance.

#### 5.1 Experiment Builder

Inputs (mostly derived, but editable):

* Segment (approved)
* Frame (approved)
* Creative variant (approved)
* Platform (FB/IG etc.)
* Budget (suggested + editable)
* Duration (suggested + editable)
* Targeting notes (from segment definition)
* **UTM bundle** (auto-generated)

  * source / medium / campaign / content / term

Outputs:

* “Copy pack” (one-click copy)
* UTM URL(s)
* Naming convention for ad set / ad name (copyable)

Actions:

* Mark as “Launched” (manual toggle, since the user runs ads outside)
* Add notes + link to platform campaign (optional)

#### 5.2 Experiments List

Table columns:

* Status: Draft / Approved / Launched / Completed
* Platform
* Segment
* Frame promise
* Variant ID
* Budget
* Launch date
* Latest metrics (if any)

---

### 6) Results Tab

**Purpose:** enter observation data, see computed performance, and trigger decisions.

#### 6.1 Results Entry (per experiment)

A simple form with optional import later:

* Spend
* Impressions
* Clicks
* Purchases (tickets)
* Revenue (optional)
* Notes (qualitative)

Computed on the client:

* CTR
* CPC
* CPA (spend / purchases)
* ROAS (revenue / spend)

#### 6.2 Results Overview

* Rank experiments by:

  * best CPA
  * most purchases
  * highest CTR
* Highlight “statistically flimsy” flags:

  * too few clicks
  * too short duration
  * very low spend

Actions:

* **Run Decision Engine**
* Manual override per experiment (Scale/Hold/Kill + reason)

---

### 7) Memo Tab

**Purpose:** generate a one-page memo summarizing what happened and what to do next.

**Memo view**

* Header: show + cycle + date range
* Sections:

  * What we tested (segments, frames)
  * What worked (top experiments + why)
  * What failed (bottom experiments + why)
  * Decisions (Scale/Hold/Kill)
  * Next cycle recommendations
* Button: **Generate Memo**
* Export: copy-to-clipboard, PDF later (optional)

---

## Component inventory (buildable set)

### Layout

* AppShell (sidebar + topbar)
* ShowHeader (show summary + phase badge)
* CycleStepper (Plan → Create → Run → Results → Memo)

### Data display

* Cards (SegmentCard, FrameCard, VariantCard, ExperimentCard)
* StatusBadge (Draft/Approved/Running/Failed/Launched/etc.)
* KPIStat (value + delta)
* ActivityFeed (event list)

### Forms

* SegmentEditorModal
* FrameEditorModal
* VariantEditorModal
* ExperimentBuilderForm
* ResultsEntryForm

### Utilities

* CopyBlock (copyable text pack)
* UTMPreview (URL + params)
* EvidenceRefsList (citations / refs shown clearly)

---

## Key UX rules

1. **Every agent run is explicit** (no surprise automatic generation).
2. **Approvals gate progress** (cannot generate creative from unapproved frames; cannot build experiments from unapproved variants).
3. **History is preserved** (you can see what the agent said vs what you edited).
4. **Next action is always visible** (Overview + CycleStepper).

---

## API integration (frontend contract)

You already described:

* `POST /api/creative/{frame_id}/run`

You’ll want consistent patterns for all agent runs.

### Recommended endpoints (minimal)

**Show**

* `GET /api/shows`
* `POST /api/shows`
* `GET /api/shows/{show_id}`

**Cycles**

* `POST /api/shows/{show_id}/cycles`
* `GET /api/shows/{show_id}/cycles/{cycle_id}`

**Strategy**

* `POST /api/strategy/{show_id}/run` → returns segments + frames + summary
* `PATCH /api/segments/{segment_id}` / `PATCH /api/frames/{frame_id}`
* `POST /api/segments/{segment_id}/approve`
* `POST /api/frames/{frame_id}/approve`

**Creative**

* `POST /api/creative/{frame_id}/run` → returns creativeVariant IDs + reasoning summary
* `POST /api/creative_variants/{variant_id}/approve`
* `PATCH /api/creative_variants/{variant_id}` (edits)

**Experiments**

* `POST /api/experiments` (create from approved selections)
* `POST /api/experiments/{experiment_id}/mark_launched`
* `GET /api/experiments?show_id=&cycle_id=`

**Results**

* `POST /api/observations` (by experiment)
* `GET /api/results?show_id=&cycle_id=`

**Decision + Memo**

* `POST /api/decisions/{cycle_id}/run`
* `POST /api/memo/{cycle_id}/run`
* `GET /api/memo/{cycle_id}`

### Frontend state expectations

* Agent runs are async: return `job_id`, poll `GET /api/jobs/{job_id}` or use SSE/websocket later.
* Every object has:

  * `status`
  * `created_at`, `updated_at`
  * `source`: `agent|human|system`
  * `version` (optional but nice)

---

## Non-functional requirements

* **Mobile:** not required; tablet-friendly is enough.
* **Latency:** don’t block UI; show “running” states with progress.
* **Error handling:** agent failures should show a readable message + retry.
* **Auditability:** show what data the agent used (frame context, show details, platform rules) in a collapsible “Inputs” panel.

---

## Suggested UI “look”

* Clean ops-dashboard aesthetic.
* Stepper is the backbone; avoid too many nested tabs.
* Use strong status colors sparingly; rely on labels + layout first.

---

## Build order (fastest path to something usable)

1. Shows List + Show Overview shell
2. Strategy tab (run → approve segments/frames)
3. Creative tab (run per frame → approve variants)
4. Experiments builder + UTM copy packs
5. Results entry + simple computed KPIs
6. Decision run + memo generation

