# ReactAgriGen — Fleet & Fixed Asset Management ERP
## Development Plan

**Project:** Vehicle Workshop / Fleet Management Module (React SPA)  
**Client:** Lankem / Agrithmics  
**Product Owner:** Vishwa Rathnayake  
**Last Updated:** 2026-04-15 — Phase 8 complete

---

## Overview

A React 19 single-page application that covers two functional modules for agri-estate vehicle and asset management:

- **Fleet Management** — Vehicles, drivers, maintenance, workshops, daily operations
- **Fixed Asset Management** — Asset register, depreciation, maintenance estimations, disposal

The app is a pure frontend SPA with no backend; data lives in module-level closure stores and mock seed data. The architecture is intentionally designed for a future API integration layer.

---

## Technology Stack

| Layer | Choice |
|---|---|
| Framework | React 19 + Vite 5 |
| Routing | React Router DOM v7 |
| State | Module-level closure stores (no Redux) |
| Styling | Custom CSS design system — AgriGEN Teal (`#0d9488`) |
| Icons | Custom `<Icon>` component (SVG-based) |
| Build | Vite (`npm run build`) |
| QA IDs | Convention: `{screen-prefix}-{element-type}-{field}` |

**Reusable components:** `ListingPage`, `FormModal`, `GroupEstateFields`, `Sidebar`, `TopHeader`, `Icon`

---

## DB Schema Groups (22 Tables)

| Group | Tables |
|---|---|
| Lookups | VehicleTypes, FixedAssetTypes, FuelTypes, DocumentTypes, PurposeCategories, LicenseCategories |
| Vehicles | Vehicles, VehicleDocuments, VehiclePurposeMappings, VehicleHistory |
| Drivers & Ops | Drivers, DriverAssignments, DailyRunning |
| Technicians | TechCategories, TechAssignments, WorkshopTechRates |
| Workshop | Workshops, WorkshopCategories, WorkshopHistory |
| Fixed Assets | FixedAssets, FixedAssetHistory, Depreciation, DepreciationHistory, AssetMaintenance, Estimations |

---

## QA Element ID Convention

All interactive elements must carry an `id` attribute:

```
{screen-prefix}-{element-type}-{field}
```

Examples: `vf-input-brand`, `faf-select-fixedAssetTypeID`, `amf-btn-removeDetail-0`

Reusable components accept an `idPrefix` prop and auto-generate:
- `ListingPage` → `{idPrefix}-btn-add`, `{idPrefix}-table`, `{idPrefix}-btn-edit-{id}`, `{idPrefix}-btn-delete-{id}`
- `FormModal` → `{idPrefix}-btn-modal-close`, `{idPrefix}-btn-modal-cancel`, `{idPrefix}-btn-modal-save`

---

## Phase History

### Phase 1 — Master / Lookup Tables ✅
Core lookup data used by all other screens.

| Screen | Route | ID Prefix | Status |
|---|---|---|---|
| Vehicle Types | `/vehicle-types` | `vt` | Done |
| Fixed Asset Types | `/fixed-asset-types` | `fat` | Done |
| Fuel Types | `/fuel-types` | `ft` | Done |
| Document Types | `/document-types` | `dt` | Done |
| Purpose Categories | `/purpose-categories` | `pc` | Done |
| License Categories | `/license-categories` | `lc` | Done |

---

### Phase 2 — Vehicle Core ✅
Full vehicle register with documents, purposes, history, and Fixed Asset linkage.

| Screen | Route | ID Prefix | Status |
|---|---|---|---|
| Vehicles (list) | `/vehicles` | `vehicles` | Done |
| Vehicle Form (add/edit) | `/vehicles/add`, `/vehicles/edit/:id` | `vf` | Done |
| Vehicle Documents | `/vehicle-documents` | `vdm` | Done |
| Vehicle Purposes | `/vehicle-purposes` | `vpm` | Done |
| Vehicle History | `/vehicle-history` | `vh` | Done |

**Key feature:** `fixedAssetID` optional link on vehicle → shows financial summary panel (cost, depreciation, warranty) in form and Fixed Asset badge in listing.

---

### Phase 3 — Drivers & Operations ✅
Driver profiles, license management, daily assignments, mileage tracking.

| Screen | Route | ID Prefix | Status |
|---|---|---|---|
| Drivers (list) | `/drivers` | `drivers` | Done |
| Driver Form (add/edit) | `/drivers/add`, `/drivers/edit/:id` | `df` | Done |
| License Categories | `/license-categories` | `lc` | Done |
| Driver Assignments | `/driver-assignments` | `da` | Done |
| Daily Running | `/daily-running` | `dr` | Done |

---

### Phase 4 — Workshop, Technicians & Maintenance ✅
Full workshop operations including job cards, maintenance records, service scheduling, technician management.

| Screen | Route | ID Prefix | Status |
|---|---|---|---|
| Workshop Dashboard | `/workshop-dashboard` | `wd` | Done |
| Workshops | `/workshops` | `ws` | Done |
| Workshop Categories | `/workshop-categories` | `wsc` | Done |
| Workshop Tech. Rates | `/tech-workshop` | `wtr` | Done |
| Workshop History | `/workshop-history` | `wsh` | Done |
| Tech. Categories | `/tech-categories` | `tc` | Done |
| Tech. Assignments | `/tech-assignments` | `ta` | Done |
| Maintenance Tasks | `/maintenance` | `mt` | Done |
| Job Cards | `/job-cards` | `jc` | Done |
| Maintenance Records | `/maintenance-records` | `mr` | Done |
| Vehicle Service | `/vehicle-service` | `vs` | Done |

---

### Phase 5 — Fixed Asset Management ✅
Full fixed asset lifecycle: register, depreciation scheduling, maintenance, estimation costing, dashboard.

| Screen | Route | ID Prefix | Status |
|---|---|---|---|
| FA Dashboard | `/fa-dashboard` | `fad` | Done |
| Fixed Asset Types | `/fixed-asset-types` | `fat` | Done |
| FA Categories | `/fixed-asset-categories` | `fac` | Done |
| Assets Register (list) | `/assets-register` | `fa` | Done |
| Fixed Asset Form (add/edit) | `/assets-register/add`, `/assets-register/edit/:id` | `faf` | Done |
| Asset History | `/asset-history` | `ah` | Done |
| Depreciation | `/depreciation` | `dep` | Done |
| Dep. History | `/depreciation-history` | `dh` | Done |
| Asset Maintenance (list) | `/asset-maintenance` | `am` | Done |
| Asset Maintenance Form | `/asset-maintenance/add`, `/asset-maintenance/edit/:id` | `amf` | Done |
| Estimations | `/estimations` | `est` | Done |

**Key features built in Phase 5:**
- Straight-line depreciation calculation (cost − residual) / useful life
- Depreciation history auto-snapshot on create and maintenance events (immutable audit trail)
- Asset Maintenance multi-task, multi-cost form with dynamic line items
- Estimation costing with labour + material line items
- FA Dashboard with 8 KPI StatCards + 4 breakdown cards + recent activity table
- Vehicle ↔ Fixed Asset optional link (`fixedAssetID` FK)

---

## Current Application State (as of 2026-04-15)

### Screen Inventory

| Module | Total Screens | Done | Remaining |
|---|---|---|---|
| Fleet Management | 21 | 21 | 0 |
| Fixed Asset Management | 13 | 13 | 0 |
| Master / Lookup | 6 | 6 | 0 |
| Reports | 8 | 8 | 0 |
| Alerts | 1 | 1 | 0 |
| **Total** | **49** | **49** | **0** |

### No `comingSoon` Placeholders Remaining

All screens are fully implemented.

### Build Status
- `npm run build` → `✓ built in ~4.3s` (zero errors)
- Non-blocking warning: single chunk 680 kB (pre-existing, not a blocker)
- Dev server: `npm run dev` → `http://localhost:5173`

---

## Phase 6 — Asset Disposal

**Scope:** Complete the last remaining `ComingSoon` screen. Asset Disposal handles the write-off or sale of a fixed asset, recording the disposal reason, date, proceeds (if sold), and closing the asset's depreciation schedule.

### Proposed Screen: Asset Disposal Form

**Route:** `/asset-disposal`  
**ID Prefix:** `ad`  
**Nav:** Already wired in `nav.js` (line 79), route at `App.jsx` line 142

#### Data fields to capture

| Field | Type | Notes |
|---|---|---|
| Fixed Asset | Select | FK → Assets Register |
| Disposal Date | Date | Required |
| Disposal Type | Select | Sale / Write-Off / Donation / Scrap |
| Disposal Reason | Textarea | Free text |
| Sale Proceeds (Rs.) | Number | Only if type = Sale |
| Book Value at Disposal | Read-only | Computed from depreciation history |
| Gain / Loss on Disposal | Read-only | Sale Proceeds − Book Value |
| Approved By | Text / Select | Employee reference |
| Notes | Textarea | Optional |

#### Business rules
- Once disposed, asset status should update to `Disposed` in Assets Register
- If asset has an open depreciation schedule, mark it as closed
- Auto-create a final Fixed Asset History snapshot with event type `Disposed`
- Vehicle linked to this asset should have its `fixedAssetID` cleared or flagged

#### Screens needed
1. **Asset Disposal List** (`/asset-disposal`) — listing of all disposal records with filters (date range, type, estate). ID prefix: `ad`
2. **Asset Disposal Form** (`/asset-disposal/add`, `/asset-disposal/edit/:id`) — full form per above fields. ID prefix: `adf`

#### Stores needed
- `assetDisposalStore.js` — new store following the existing closure pattern

---

## Phase 7 — Alerts & Notifications ✅

Surface time-sensitive data that requires action. All alerts would be read from existing stores — no new data model needed.

| Alert Type | Source | Threshold |
|---|---|---|
| Document Expiry | `vehicleDocuments` | Expiring within 30 days |
| Service Due | `vehicleService` | Next service date ≤ today |
| Depreciation Schedule End | `depreciationStore` | End date within 60 days |
| Warranty Expiry | `fixedAssets.warrantyExpiry` | Expiring within 30 days |
| Asset Maintenance Overdue | `assetMaintenanceStore` | Status = Open & scheduled date past |
| Driver Licence Expiry | `drivers.licenseExpiry` | Expiring within 30 days |

**Delivery options:**
- Alert banner in `TopHeader`
- Dedicated `/alerts` screen with grouped list
- Badge counts in sidebar nav items

---

## Phase 8 — Reporting & Export ✅

Printable / exportable views for management reporting.

| Report | Route | ID Prefix | Data Source |
|---|---|---|---|
| Reports Hub | `/reports` | `rpt-hub` | — |
| Fleet Register | `/reports/fleet-register` | `rpt-fr` | `vehicleStore` + lookups |
| Vehicle Document Status | `/reports/vehicle-documents` | `rpt-vd` | `MOCK.vehicleDocuments` + expiry logic |
| Depreciation Schedule | `/reports/depreciation-schedule` | `rpt-ds` | `depreciationStore` |
| Asset Net Book Value | `/reports/asset-nbv` | `rpt-nbv` | `fixedAssetStore` + `depreciationHistoryStore` |
| Asset Maintenance Summary | `/reports/asset-maintenance` | `rpt-am` | `assetMaintenanceStore` |
| Daily Running Log | `/reports/daily-running` | `rpt-dr` | `dailyRunningStore` |
| Driver Assignment History | `/reports/driver-assignments` | `rpt-da` | `driverAssignmentStore` |

**Format targets:** Print-friendly CSS (`@media print`), CSV export via `Blob` + anchor download.

**New files:**
- `src/utils/csvExport.js` — shared CSV download utility (BOM-prefixed, RFC-4180 escaping)
- `src/components/ReportShell.jsx` — shared report wrapper (Print button, Export CSV button, print-only header)
- `src/index.css` — `@media print` rules added (hides sidebar/header, flattens cards)

---

## Phase 9 — API Integration Readiness (Future)

Replace in-memory stores with real API calls. The store interface is already abstracted — each store exposes `getAll()`, `getById()`, `add()`, `update()`, `remove()` methods. Swapping the body of these methods for `fetch`/`axios` calls is the only change required per store.

**Preparation tasks:**
- Add loading/error states to `ListingPage` and form components
- Add optimistic UI or spinner patterns
- Define API contract (REST endpoint naming, payload shapes) based on the 22-table DB schema
- Authentication layer (JWT header injection)

---

## File Structure Reference

```
src/
├── App.jsx                    # Routes + AppShell
├── nav.js                     # Sidebar nav config
├── index.css                  # Design system (CSS custom properties)
├── components/
│   ├── ListingPage.jsx         # Reusable table shell (accepts idPrefix)
│   ├── FormModal.jsx           # Reusable modal (accepts idPrefix)
│   ├── GroupEstateFields.jsx   # Group/Estate dropdowns pair
│   ├── Sidebar.jsx
│   ├── TopHeader.jsx
│   └── Icon.jsx
├── data/
│   ├── mockData.js             # Seed data (MOCK object + nameOf helpers)
│   ├── vehicleStore.js
│   ├── fixedAssetStore.js
│   ├── depreciationStore.js
│   ├── depreciationHistoryStore.js
│   ├── assetMaintenanceStore.js
│   ├── estimationStore.js
│   ├── fixedAssetHistoryStore.js
│   └── ...                    # 25 stores total
└── views/
    ├── Dashboard.jsx           # Fleet Management main dashboard
    ├── FixedAssetDashboard.jsx # Fixed Asset Management dashboard
    ├── Vehicles.jsx / VehicleForm.jsx
    ├── Drivers.jsx / DriverForm.jsx
    ├── FixedAssets.jsx / FixedAssetForm.jsx
    ├── AssetMaintenanceForm.jsx
    ├── Estimations.jsx
    └── ...                    # 37 views total
```

---

## Decision Log

| Decision | Rationale |
|---|---|
| No Redux / no Context API | Module-level closure stores are sufficient for a single-user SPA; avoids boilerplate overhead |
| `ComingSoon` component for incomplete screens | Routes stay wired so nav/breadcrumb work; unblocks UI testing of surrounding screens |
| `fixedAssetID` optional on Vehicle | Vehicles may predate the fixed asset register; null is valid and rendered as `—` |
| Immutable Fixed Asset History snapshots | Audit trail requirement — history records are never edited, only appended |
| Straight-line depreciation only | Matches client accounting policy; formula: `(cost − residual) / usefulLifeYears` |
| `idPrefix` prop on reusable components | QA automation requires stable element IDs; centralising generation in the component prevents mismatches |
