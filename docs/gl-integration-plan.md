# AgriGEN ERP — General Ledger Integration Plan
## Fixed Asset & Fleet Management → GL Posting

**Author:** Senior Technical Architect (Finance & ERP)
**Date:** 2026-04-16
**Scope:** GL Mapping setup + Ledger transaction passing for FA Registry, Maintenance & Service, Depreciation, and Asset Disposal
**Updated:** 2026-04-16 — Added GL Effect Preview Panel and Confirm / Approve / Reject workflow

---

## Table of Contents

1. [Overview & Accounting Principle](#1-overview--accounting-principle)
2. [Database Tables Required](#2-database-tables-required)
3. [Journal Entries Per Transaction Type](#3-journal-entries-per-transaction-type)
4. [GL Mapping Screen — Configuration Design](#4-gl-mapping-screen--configuration-design)
5. [GL Effect Preview Panel — UI Component](#5-gl-effect-preview-panel--ui-component)
6. [Confirm / Approve / Reject — Approval Workflow](#6-confirm--approve--reject--approval-workflow)
7. [Implementation Phases](#7-implementation-phases)
8. [Screen-by-Screen Integration Detail](#8-screen-by-screen-integration-detail)
9. [Key Design Decisions](#9-key-design-decisions)
10. [Schema Changes (v5)](#10-schema-changes-v5)

---

## 1. Overview & Accounting Principle

Every business event in this module — registering an asset, recording maintenance, posting depreciation, or disposing of an asset — must be reflected in the General Ledger as a balanced **double-entry journal** (Total Debits = Total Credits, always).

The GL Integration works in two layers:

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1 — GL MAPPING (Configuration, done once by admin)   │
│                                                             │
│  GL Mapping Screen → defines which accounts to use          │
│  for which transaction type and which asset type/category   │
└────────────────────────┬────────────────────────────────────┘
                         │ resolved at posting time
┌────────────────────────▼────────────────────────────────────┐
│  LAYER 2 — GL ENGINE (Automatic, triggered by user action)  │
│                                                             │
│  Operational screen (e.g. Asset Registry) → save/confirm    │
│  → GL Engine reads mapping → creates balanced journal lines  │
│  → writes to LedgerTransaction with document reference      │
└─────────────────────────────────────────────────────────────┘
```

**The Golden Rule:** The GL Engine must **never** create an unbalanced entry. If a mapping is missing or invalid, it blocks posting and alerts the user to configure the mapping first.

---

## 2. Database Tables Required

### 2.1 New Tables (GL Foundation)

#### `LedgerAccountType`
Top-level classification of accounts in the chart of accounts.

```sql
CREATE TABLE LedgerAccountType (
  LedgerAccountTypeID   INT           PRIMARY KEY IDENTITY,
  TypeCode              VARCHAR(10)   NOT NULL UNIQUE,   -- e.g. 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'
  TypeName              VARCHAR(100)  NOT NULL,
  NormalBalance         CHAR(2)       NOT NULL           -- 'DR' or 'CR'  (Assets/Expenses = DR; Liab/Equity/Revenue = CR)
);
```

#### `ParentHeader`
First level of account grouping within a type.

```sql
CREATE TABLE ParentHeader (
  ParentHeaderID        INT           PRIMARY KEY IDENTITY,
  LedgerAccountTypeID   INT           NOT NULL FK → LedgerAccountType,
  ParentHeaderCode      VARCHAR(20)   NOT NULL UNIQUE,
  ParentHeaderName      VARCHAR(150)  NOT NULL,
  GroupID               INT           FK → Group
);
```

#### `ChildHeader`
Second level of account grouping.

```sql
CREATE TABLE ChildHeader (
  ChildHeaderID         INT           PRIMARY KEY IDENTITY,
  ParentHeaderID        INT           NOT NULL FK → ParentHeader,
  ChildHeaderCode       VARCHAR(20)   NOT NULL UNIQUE,
  ChildHeaderName       VARCHAR(150)  NOT NULL
);
```

#### `LedgerAccount`
The actual postable accounts (Chart of Accounts — leaf level).

```sql
CREATE TABLE LedgerAccount (
  LedgerAccountID       INT           PRIMARY KEY IDENTITY,
  ChildHeaderID         INT           NOT NULL FK → ChildHeader,
  AccountCode           VARCHAR(20)   NOT NULL UNIQUE,  -- e.g. '1110-001'
  AccountName           VARCHAR(200)  NOT NULL,
  IsActive              BIT           NOT NULL DEFAULT 1,
  AllowDirectPosting    BIT           NOT NULL DEFAULT 1
);
```

---

#### `GLMappingHeader`
Defines each mappable transaction event in the system.

```sql
CREATE TABLE GLMappingHeader (
  GLMappingHeaderID     INT           PRIMARY KEY IDENTITY,
  ModuleCode            VARCHAR(20)   NOT NULL,          -- 'FA', 'FLEET', 'FA-FLEET'
  TransactionTypeCode   VARCHAR(30)   NOT NULL UNIQUE,   -- e.g. 'FA_CAPITALIZATION'
  TransactionTypeName   VARCHAR(150)  NOT NULL,
  Description           VARCHAR(500)  NULL,
  IsActive              BIT           NOT NULL DEFAULT 1
);
```

#### `GLAccountMapping`
Maps each transaction event to specific Dr and Cr accounts, optionally scoped by asset type or category.

```sql
CREATE TABLE GLAccountMapping (
  GLAccountMappingID    INT           PRIMARY KEY IDENTITY,
  GLMappingHeaderID     INT           NOT NULL FK → GLMappingHeader,
  LineDescription       VARCHAR(200)  NOT NULL,          -- e.g. 'Debit: Fixed Asset - Agricultural Equipment'
  DrCr                  CHAR(2)       NOT NULL,          -- 'DR' or 'CR'
  LedgerAccountID       INT           NOT NULL FK → LedgerAccount,
  FixedAssetTypeID      INT           NULL FK → FixedAssetType,    -- NULL = applies to all types
  FixedAssetCategoryID  INT           NULL FK → FixedAssetCategory, -- NULL = applies to all categories
  IsActive              BIT           NOT NULL DEFAULT 1,
  SortOrder             INT           NOT NULL DEFAULT 0
);
```

---

#### `DocumentReference`
Generates and tracks the latest sequential reference number per document type.

```sql
CREATE TABLE DocumentReference (
  DocumentReferenceID   INT           PRIMARY KEY IDENTITY,
  DocumentTypeCode      VARCHAR(20)   NOT NULL UNIQUE,   -- e.g. 'JV', 'DEP', 'DISP'
  Prefix                VARCHAR(10)   NOT NULL,          -- e.g. 'JV-', 'DEP-', 'DISP-'
  LastNumber            INT           NOT NULL DEFAULT 0,
  LastGeneratedRef      VARCHAR(50)   NULL,
  Description           VARCHAR(200)  NULL
);
```

Seed data:
```sql
INSERT INTO DocumentReference (DocumentTypeCode, Prefix, LastNumber, Description) VALUES
  ('JV',       'JV-',    0, 'General Journal Vouchers'),
  ('FA-CAP',   'CAP-',   0, 'Asset Capitalization Journals'),
  ('FA-DEP',   'DEP-',   0, 'Depreciation Posting Journals'),
  ('FA-DISP',  'DISP-',  0, 'Asset Disposal Journals'),
  ('FA-MAINT', 'MAINT-', 0, 'Maintenance Cost Journals');
```

---

#### `LedgerTransaction`
The actual journal entry lines — one row per Dr or Cr line. Every save creates two or more rows that net to zero.

```sql
CREATE TABLE LedgerTransaction (
  LedgerTransactionID   INT           PRIMARY KEY IDENTITY,
  DocumentReference     VARCHAR(50)   NOT NULL,          -- e.g. 'CAP-0001'
  BatchReference        VARCHAR(50)   NULL,              -- for depreciation: 'DEP-BATCH-2026-04'
  TransactionDate       DATE          NOT NULL,
  ModuleCode            VARCHAR(20)   NOT NULL,          -- 'FA', 'FLEET'
  TransactionTypeCode   VARCHAR(30)   NOT NULL,          -- FK to GLMappingHeader.TransactionTypeCode
  SourceTableName       VARCHAR(100)  NOT NULL,          -- e.g. 'FixedAsset', 'MaintenanceRecord'
  SourceRecordID        INT           NOT NULL,          -- the PK of the source row
  LineDescription       VARCHAR(500)  NOT NULL,
  LedgerAccountID       INT           NOT NULL FK → LedgerAccount,
  DrCr                  CHAR(2)       NOT NULL,          -- 'DR' or 'CR'
  Amount                DECIMAL(18,2) NOT NULL,          -- always positive; DrCr tells direction
  IsReversed            BIT           NOT NULL DEFAULT 0,
  ReversalOf            INT           NULL FK → LedgerTransaction, -- points to original if this is a reversal
  GroupID               INT           FK → Group,
  EstateID              INT           FK → Estate,
  CreatedBy             VARCHAR(100)  NOT NULL,
  CreatedDate           DATETIME      NOT NULL DEFAULT GETDATE()
);
```

---

### 2.2 Columns to Add to Existing Tables (GL Posting Status Tracking)

| Table | New Column | Type | Purpose |
|---|---|---|---|
| `FixedAsset` | `GLPostingRef` | `VARCHAR(50) NULL` | Reference of capitalization journal |
| `FixedAsset` | `IsPostedToGL` | `BIT DEFAULT 0` | Has been posted to GL |
| `MaintenanceRecord` | `GLPostingRef` | `VARCHAR(50) NULL` | |
| `MaintenanceRecord` | `IsPostedToGL` | `BIT DEFAULT 0` | |
| `VehicleService` | `GLPostingRef` | `VARCHAR(50) NULL` | |
| `VehicleService` | `IsPostedToGL` | `BIT DEFAULT 0` | |
| `AssetMaintenance` | `GLPostingRef` | `VARCHAR(50) NULL` | |
| `AssetMaintenance` | `IsPostedToGL` | `BIT DEFAULT 0` | |
| `DepreciationHistory` | `GLPostingRef` | `VARCHAR(50) NULL` | Batch ref (DEP-2026-04) |
| `DepreciationHistory` | `IsPostedToGL` | `BIT DEFAULT 0` | |
| `Disposal` | `GLPostingRef` | `VARCHAR(50) NULL` | |
| `Disposal` | `IsPostedToGL` | `BIT DEFAULT 0` | |

---

## 3. Journal Entries Per Transaction Type

This section defines the exact accounting entries the system must generate for each event. These are the mappings that will be configured in the GL Mapping Screen.

### 3.1 Fixed Asset Capitalization (New Asset Registered)

**Trigger:** New Fixed Asset saved in the Assets Register.

| Line | Dr / Cr | Account (example) | Amount |
|------|---------|-------------------|--------|
| 1 | **Dr** | Fixed Asset — [Type] (e.g., "Agricultural Equipment — Cost") | Purchase Cost |
| 2 | **Cr** | Asset Payables / Creditors Control | Purchase Cost |

> **Why this way:** The asset enters the balance sheet at cost (Dr Asset). The liability to pay for it is recorded (Cr Payable). If already paid, Cr Cash/Bank instead — the mapping should allow this to be configured per asset type.

**Document Reference format:** `CAP-YYYYNNNN` (e.g., `CAP-20260001`)

---

### 3.2 Depreciation Posting

**Trigger:** User confirms "Post Depreciation" for a period. Runs once per asset per period.

| Line | Dr / Cr | Account (example) | Amount |
|------|---------|-------------------|--------|
| 1 | **Dr** | Depreciation Expense — [Type/Category] | Period Depreciation |
| 2 | **Cr** | Accumulated Depreciation — [Type/Category] | Period Depreciation |

> **Why separate accounts per category:** This allows the P&L to show "Depreciation of Vehicles: Rs. X" separately from "Depreciation of Agricultural Equipment: Rs. Y" — critical for estate cost centre reporting.

**Batch posting:** All assets in one depreciation run share one `BatchReference` (e.g., `DEP-BATCH-2026-04`) but each asset gets its own individual `DocumentReference` line group. This allows per-asset reversal without unwinding the entire batch.

**Document Reference format:** `DEP-YYYYMMNNNN` (e.g., `DEP-20260400001`)

---

### 3.3 Asset Maintenance Cost (Asset Maintenance — Completed)

**Trigger:** Asset Maintenance record status changes to "Completed".

| Line | Dr / Cr | Account (example) | Amount |
|------|---------|-------------------|--------|
| 1 | **Dr** | Repairs & Maintenance Expense — [Asset Type] | Total Maintenance Cost |
| 2 | **Cr** | Workshop Payables / Accounts Payable | Total Maintenance Cost |

> **Note:** Maintenance costs are P&L expenses (not capitalised) unless the work extends the asset's useful life — that case is handled separately as a capital addition (same journal as capitalization, different mapping header).

**Document Reference format:** `MAINT-YYYYNNNN`

---

### 3.4 Vehicle / Fleet Maintenance Cost

**Trigger:** Maintenance Record saved (Fleet module — Maintenance-type tasks) or Vehicle Service saved.

| Line | Dr / Cr | Account (example) | Amount |
|------|---------|-------------------|--------|
| 1 | **Dr** | Fleet Maintenance Expense / Vehicle Service Expense | Cost of Service |
| 2 | **Cr** | Workshop Payables / Accounts Payable | Cost of Service |

**Document Reference format:** `MAINT-YYYYNNNN` (same series as asset maintenance)

---

### 3.5 Asset Disposal — Sale with GAIN (Proceeds > Net Book Value)

**Trigger:** Asset Disposal approved and finalised.

| Line | Dr / Cr | Account | Amount |
|------|---------|---------|--------|
| 1 | **Dr** | Accumulated Depreciation — [Type] | Total Accumulated Depreciation |
| 2 | **Dr** | Cash / Disposal Proceeds Receivable | Disposal Proceeds (sale price) |
| 3 | **Cr** | Fixed Asset — [Type] Cost | Original Purchase Cost |
| 4 | **Cr** | Gain on Disposal of Fixed Assets | Proceeds − NBV (the gain) |

> **Proof:** Dr(1) + Dr(2) = AccumDep + Proceeds = AccumDep + Proceeds. Cr(3) + Cr(4) = Cost + Gain. Since NBV = Cost − AccumDep, and Gain = Proceeds − NBV → Proceeds − (Cost − AccumDep) = Proceeds − Cost + AccumDep. So Cr total = Cost + Proceeds − Cost + AccumDep = Proceeds + AccumDep. ✓ Balances.

---

### 3.6 Asset Disposal — Sale with LOSS (Proceeds < Net Book Value)

| Line | Dr / Cr | Account | Amount |
|------|---------|---------|--------|
| 1 | **Dr** | Accumulated Depreciation — [Type] | Total Accumulated Depreciation |
| 2 | **Dr** | Cash / Disposal Proceeds Receivable | Disposal Proceeds |
| 3 | **Dr** | Loss on Disposal of Fixed Assets | NBV − Proceeds (the loss) |
| 4 | **Cr** | Fixed Asset — [Type] Cost | Original Purchase Cost |

> **The system determines at posting time whether to use the Gain or Loss journal** based on: `Gain/Loss = Proceeds − (Cost − AccumulatedDepreciation)`. Positive = Gain mapping. Negative = Loss mapping.

---

### 3.7 Asset Disposal — Write-off / Scrap (Zero or negligible proceeds)

| Line | Dr / Cr | Account | Amount |
|------|---------|---------|--------|
| 1 | **Dr** | Accumulated Depreciation — [Type] | Total Accumulated Depreciation |
| 2 | **Dr** | Loss on Write-off / Disposal | Remaining NBV |
| 3 | **Cr** | Fixed Asset — [Type] Cost | Original Purchase Cost |

**Document Reference format:** `DISP-YYYYNNNN` (e.g., `DISP-20260001`)

---

## 4. GL Mapping Screen — Configuration Design

### 4.1 Transaction Type Headers to Set Up

The following `GLMappingHeader` entries must be configured in the GL Mapping Screen:

| # | TransactionTypeCode | TransactionTypeName | Module | Trigger |
|---|---|---|---|---|
| 1 | `FA_CAPITALIZATION` | Fixed Asset Capitalization | FA | New Asset saved |
| 2 | `FA_DEPRECIATION` | Depreciation Charge | FA | Depreciation posted |
| 3 | `FA_ASSET_MAINT` | Asset Maintenance Cost | FA | Maintenance completed |
| 4 | `FLEET_MAINT_RECORD` | Fleet Maintenance Record | Fleet | Maintenance record saved |
| 5 | `FLEET_VEHICLE_SVC` | Fleet Vehicle Service | Fleet | Vehicle service saved |
| 6 | `FA_DISPOSAL_GAIN` | Asset Disposal — Gain | FA | Disposal approved |
| 7 | `FA_DISPOSAL_LOSS` | Asset Disposal — Loss | FA | Disposal approved |
| 8 | `FA_DISPOSAL_WRITEOFF` | Asset Write-off / Scrap | FA | Disposal approved |

### 4.2 Mapping Line Structure (GLAccountMapping)

Each header has 2 to 4 mapping lines. Lines are scoped by `FixedAssetTypeID` to allow different accounts per asset type:

**Example: FA_CAPITALIZATION mapped for Motor Vehicles (TypeID=1)**

| Line | Dr/Cr | LedgerAccountID | FixedAssetTypeID | FixedAssetCategoryID |
|---|---|---|---|---|
| 1 | DR | [Motor Vehicle — Cost Account] | 1 | NULL |
| 2 | CR | [Asset Creditors / Payables Account] | 1 | NULL |

**Example: FA_DEPRECIATION mapped for Agricultural Machines (TypeID=2) at Category level**

| Line | Dr/Cr | LedgerAccountID | FixedAssetTypeID | FixedAssetCategoryID |
|---|---|---|---|---|
| 1 | DR | [Depreciation Exp — Tractors] | 2 | 5 (Tractors) |
| 2 | CR | [Accum. Dep. — Tractors] | 2 | 5 (Tractors) |
| 1 | DR | [Depreciation Exp — Harvesters] | 2 | 6 (Harvesters) |
| 2 | CR | [Accum. Dep. — Harvesters] | 2 | 6 (Harvesters) |

### 4.3 Account Resolution Logic (GL Engine)

When the engine needs to find the Dr/Cr accounts for a transaction, it resolves in this priority order:

```
Priority 1: Match on TransactionTypeCode + FixedAssetTypeID + FixedAssetCategoryID  (most specific)
Priority 2: Match on TransactionTypeCode + FixedAssetTypeID + CategoryID = NULL      (type-level fallback)
Priority 3: Match on TransactionTypeCode + TypeID = NULL + CategoryID = NULL         (global fallback)
Priority 4: No match → BLOCK posting, show error: "GL mapping not configured for [Type/Category]"
```

---

## 5. GL Effect Preview Panel — UI Component

Every screen that generates a GL transaction must show the user **exactly which accounts will be debited and credited, and for how much**, before they confirm. This is the `GLEffectPanel` reusable component.

### 5.1 What It Shows

```
┌─────────────────────────────────────────────────────────────────┐
│  GL Account Effect                                              │
│                                                                 │
│  Account Code   Account Name                    Debit    Credit │
│  ──────────────────────────────────────────────────────────     │
│  1120-001       Agricultural Equipment — Cost  2,500,000        │
│  2210-001       Asset Creditors / Payables              2,500,000│
│  ──────────────────────────────────────────────────────────     │
│  Total                                         2,500,000 2,500,000│
│                                                  ✓ Entry Balances│
└─────────────────────────────────────────────────────────────────┘
```

- Amounts update **dynamically** as the user types in the cost/amount field
- If the GL mapping is not configured for the selected asset type:
  ```
  ⚠ GL mapping not configured for "Agricultural Machine".
    This transaction will be saved but NOT posted to the ledger.
    Contact Finance to configure the GL Mapping for this asset type.
  ```
- If the entry does not balance (should never happen — engine validation): show red error

### 5.2 Component Props

```js
<GLEffectPanel
  transactionTypeCode="FA_CAPITALIZATION"   // which mapping to resolve
  fixedAssetTypeID={2}                       // scopes account resolution
  fixedAssetCategoryID={5}                   // optional: finer scoping
  amount={2500000}                           // the transaction amount
  date="2026-04-16"                          // for display only
  status="Draft"                             // controls which buttons show (see Section 6)
  onConfirm={handleConfirm}
  onApprove={handleApprove}
  onReject={handleReject}
  glPostingRef="CAP-20260001"               // shown when status = Approved
  rejectionNote="Wrong account selected"    // shown when status = Rejected
/>
```

### 5.3 Rendering Rules

| Condition | Panel Appearance |
|---|---|
| Amount = 0 or blank | Panel hidden |
| Mapping found, entry balances | Green tick, amounts shown, action buttons shown |
| Mapping not found | Yellow warning, no amounts, no action buttons (save still allowed) |
| Status = Approved | GL ref shown in green badge, no buttons |
| Status = Rejected | Rejection note shown in red, [Resubmit] button |

### 5.4 Where It Appears

The `GLEffectPanel` is rendered **below the form divider** inside the FormModal (add mode) and **below the locked task card** (edit mode), just above the Save button:

```
[Form fields]
───── divider ─────
[GL Account Effect Panel]
  [Account table]
  [Confirm] [Approve] [Reject]
───── modal footer ─────
[Cancel]  [Save]
```

---

## 6. Confirm / Approve / Reject — Approval Workflow

### 6.1 The Three-State Lifecycle

Every GL-enabled transaction follows this status lifecycle:

```
                  ┌─────────────────────────────────┐
                  │           DRAFT                 │
                  │  Record saved, not submitted     │
                  │  GL entry NOT posted             │
                  └──────────┬──────────────────────┘
                             │ User clicks [Confirm]
                  ┌──────────▼──────────────────────┐
                  │       PENDING APPROVAL           │
                  │  Submitted to Finance queue      │
                  │  GL entry NOT yet posted         │
                  └──────┬──────────────┬────────────┘
          Finance clicks │              │ Finance clicks
              [Approve]  │              │  [Reject]
          ┌──────────────▼──┐      ┌───▼────────────────┐
          │    APPROVED     │      │     REJECTED        │
          │ GL entry POSTED │      │ GL entry NOT posted │
          │ Ref: CAP-0001   │      │ Note shown to user  │
          └─────────────────┘      └──────────┬──────────┘
                                              │ User clicks [Resubmit]
                                              └──► back to PENDING APPROVAL
```

### 6.2 Who Does What

| Role | Actions Available |
|---|---|
| **Operational staff** (workshop, estate manager) | Fill form → **Confirm** (submit for approval) |
| **Finance officer** | Review GL preview → **Approve** (posts to GL) or **Reject** (with note) |
| **System administrator** | Can approve, reject, or force-post any record |

> **Note on current implementation:** Until role-based access is built (Phase 9 — Auth), all buttons are visible to all users. The workflow discipline is enforced by process, not by code. Role gating is added in Phase 9.

### 6.3 Button States Per Status

| Record Status | Buttons Shown | Available to |
|---|---|---|
| `Draft` | **[Confirm for GL Approval]** | Operational staff |
| `PendingApproval` | **[Approve]** **[Reject]** | Finance officer |
| `Approved` | No buttons. GL Ref badge shown | — |
| `Rejected` | Rejection note shown. **[Resubmit]** | Operational staff |

### 6.4 Button Colours

| Button | Style |
|---|---|
| Confirm | `btn-primary` (teal) |
| Approve | `btn-success` (green) |
| Reject | `btn-danger` (red) |
| Resubmit | `btn-secondary` (grey) |

### 6.5 Reject Flow — Rejection Note

When Finance clicks **Reject**:
1. A small inline input appears: *"Reason for rejection (required)"*
2. Finance enters the reason and clicks **Confirm Rejection**
3. Record status → `Rejected`
4. Rejection note is stored and shown to the operational user on next view

### 6.6 GL Status on the Listing Screen

Add a **GL Status** column to every affected listing table:

| Badge | Colour | Meaning |
|---|---|---|
| `Draft` | Grey | Not yet submitted |
| `Pending` | Orange | Awaiting Finance approval |
| `Approved` | Green | GL entry posted |
| `Rejected` | Red | Rejected — action needed |

Add a **GL Status filter** to the filter bar on each listing:

```
[— All GL Status —▼]   [Pending ▼]   → shows only records awaiting approval
```

Finance can open the screen, filter to **Pending**, and process approvals in bulk.

### 6.7 New Columns Required on Source Tables

Add these columns to each GL-enabled source table:

```sql
GLApprovalStatus   VARCHAR(20)   NOT NULL DEFAULT 'Draft'
                   -- CHECK IN ('Draft','PendingApproval','Approved','Rejected')
GLApprovedBy       VARCHAR(100)  NULL
GLApprovedDate     DATETIME      NULL
GLRejectedBy       VARCHAR(100)  NULL
GLRejectedDate     DATETIME      NULL
GLRejectionNote    VARCHAR(500)  NULL
GLPostingRef       VARCHAR(50)   NULL     -- set when Approved
IsPostedToGL       BIT           NOT NULL DEFAULT 0
```

### 6.8 Special Cases Per Screen

#### Depreciation Posting
- Depreciation already has a "Post Depreciation" confirm step
- The confirm step becomes the **Confirm** action (status → PendingApproval)
- Finance then sees a pending depreciation batch and clicks **Approve** → batch is posted
- The batch-level approval covers all assets in the run

#### Asset Disposal
- Disposal has the highest financial impact — requires both steps strictly
- Draft → Confirm → Finance Approve only
- No bypass option (no "Save and Post" shortcut)
- On Approve: the multi-line disposal journal posts, asset is marked disposed

#### Asset Maintenance
- Confirm available when status = Completed
- Cannot confirm while status = Active (work still in progress)

---

## 7. Implementation Phases

### Phase 1 — GL Foundation (Data Layer & Engine)

**What:** Build the core infrastructure that all subsequent phases depend on.

**Deliverables:**
1. Schema changes — add new tables (LedgerAccountType, ParentHeader, ChildHeader, LedgerAccount, GLMappingHeader, GLAccountMapping, DocumentReference, LedgerTransaction)
2. Add GL approval columns (`GLApprovalStatus`, `GLApprovedBy`, `GLApprovedDate`, `GLRejectedBy`, `GLRejectedDate`, `GLRejectionNote`, `GLPostingRef`, `IsPostedToGL`) to all source tables
3. Mock data — seed Chart of Accounts, DocumentReference rows, GLMappingHeader rows
4. JavaScript stores:
   - `ledgerAccountStore.js` — read chart of accounts
   - `glMappingStore.js` — read GL mapping headers and lines; `resolveAccounts(typeCode, fixedAssetTypeID, fixedAssetCategoryID)` → returns Dr/Cr lines
   - `documentReferenceStore.js` — `getNext(typeCode)` → generates and increments reference
   - `ledgerTransactionStore.js` — `add`, `getBySource`, `getByRef`, `reverse`
5. **`glEngine.js`** — the central posting service:
   ```
   glEngine.preview({
     transactionTypeCode,
     amount,
     fixedAssetTypeID,
     fixedAssetCategoryID,
   }) → { lines: [{account, drCr, amount}], balanced: true, missing: false }

   glEngine.post({
     transactionTypeCode,
     transactionDate,
     sourceTable,
     sourceRecordID,
     amount,
     fixedAssetTypeID,
     fixedAssetCategoryID,
     description,
     groupID, estateID
   }) → { success, documentReference, error }

   glEngine.reverse(originalDocumentReference)
     → { success, reversalRef, error }
   ```
   - `preview()` — used by GLEffectPanel to compute the display table without writing anything
   - `post()` — validates balance, writes LedgerTransaction rows, returns documentReference
   - `reverse()` — creates mirror-image reversal lines

---

### Phase 2 — GL Mapping Screen Extension

**What:** Add the FA module mapping entries to the existing GL Mapping Screen.

**Deliverables:**
1. Add the 8 transaction type headers (GLMappingHeader rows) to the GL Mapping Screen
2. Extend the GL Mapping form to allow:
   - Selecting Module: FA / Fleet
   - Adding mapping lines with Dr/Cr, Account, scoped by Asset Type and/or Category
3. Mapping lines grouped by asset type within each header
4. Validation: each header must have at least one balanced Dr/Cr line pair per asset type configured

**UI pattern:**
```
GL Mapping Screen
└── Header: "Fixed Asset Capitalization" [FA_CAPITALIZATION]
    ├── Asset Type: Motor Vehicle
    │   ├── DR: 1110-001  Motor Vehicles — Cost
    │   └── CR: 2210-001  Asset Creditors
    ├── Asset Type: Agricultural Machine
    │   ├── DR: 1120-001  Agricultural Equipment — Cost
    │   └── CR: 2210-001  Asset Creditors
    └── Asset Type: Heavy Equipment
        ├── DR: 1130-001  Heavy Equipment — Cost
        └── CR: 2210-001  Asset Creditors
```

---

### Phase 3 — GLEffectPanel Component + Approval Workflow UI

**What:** Build the reusable GL preview panel and the Confirm/Approve/Reject button logic. This is built once and dropped into every screen in subsequent phases.

**Deliverables:**
1. `src/components/GLEffectPanel.jsx` — reusable panel component:
   - Takes props: `transactionTypeCode`, `fixedAssetTypeID`, `fixedAssetCategoryID`, `amount`, `date`, `status`, `glPostingRef`, `rejectionNote`
   - Takes callbacks: `onConfirm`, `onApprove`, `onReject`, `onResubmit`
   - Calls `glEngine.preview()` to build the account table
   - Renders the Dr/Cr table with amounts
   - Renders the correct action button set based on `status`
   - Shows GL ref badge when Approved
   - Shows rejection note + [Resubmit] when Rejected
2. `src/components/GLStatusBadge.jsx` — small badge for listing columns:
   - `Draft` / `Pending` / `Approved` / `Rejected` with correct colours
3. Rejection modal — inline text input that appears inside the panel when Reject is clicked
4. The panel handles the "missing mapping" warning state automatically

**Test this phase thoroughly** — every subsequent phase depends on it working correctly.

---

### Phase 4 — Fixed Asset Registry GL Integration

**What:** Post a capitalization journal when a new fixed asset is registered.

**Deliverables:**
1. Add `GLEffectPanel` to `FixedAssetForm.jsx` (add and edit mode)
2. Panel resolves `FA_CAPITALIZATION` mapping with the selected `fixedAssetTypeID` and `fixedAssetCategoryID` and the entered `purchaseCost`
3. **On Save:** record saved with `GLApprovalStatus = 'Draft'`
4. **On Confirm:** `GLApprovalStatus → 'PendingApproval'`, form becomes read-only for cost fields
5. **On Approve:** `glEngine.post()` called → `GLPostingRef` set, `IsPostedToGL = true`, `GLApprovalStatus = 'Approved'`
6. **On Reject:** `GLApprovalStatus = 'Rejected'`, rejection note saved, cost fields unlocked for correction
7. **Lock rule:** Once `Approved`, `PurchaseCost` is permanently locked. Cost corrections require a Revaluation process.
8. Listing: Add `GL Status` column with `GLStatusBadge`. Add GL Status filter dropdown.

**User flow (Asset Registrar):**
```
Fill asset form → purchase cost entered →
  GL Effect Panel shows:
    Dr 1120-001 Agricultural Equipment — Cost    Rs. 2,500,000
    Cr 2210-001 Asset Creditors                              Rs. 2,500,000
  Click [Save] → record saved (Draft)
  Click [Confirm for GL Approval] → status → Pending

Finance Officer opens Assets Register, filters GL Status = Pending:
  Reviews GL preview → Click [Approve] → GL posted, ref: CAP-20260001
  Or Click [Reject] → enters note "Wrong category selected" → status → Rejected
```

---

### Phase 5 — Maintenance & Service GL Integration

**What:** Post expense journals when maintenance/service records are saved.

**Screens affected:**
- Maintenance Records (`/maintenance-records`) → `FLEET_MAINT_RECORD`
- Vehicle Service (`/vehicle-service`) → `FLEET_VEHICLE_SVC`
- Asset Maintenance (`/asset-maintenance`) → `FA_ASSET_MAINT` — triggers on status → Completed

**Deliverables:**
1. On **Maintenance Record save**: post `FLEET_MAINT_RECORD` with `costOfService` as amount
2. On **Vehicle Service save**: post `FLEET_VEHICLE_SVC` with `costAmount`
3. On **Asset Maintenance** status change to "Completed": post `FA_ASSET_MAINT` with `totalMaintenanceCost`
4. Save GLPostingRef to source record
5. **Edit and reversal:** If a posted maintenance record is edited and cost changes, system must:
   - Reverse original journal (Dr↔Cr swap, same amount, `IsReversed = true`, `ReversalOf = originalID`)
   - Create new journal with updated amount
   - New GLPostingRef replaces old on the source record

---

### Phase 6 — Depreciation GL Integration

**What:** Add GL Effect preview + Confirm/Approve workflow to the Post Depreciation screen.

**Screen affected:** Post Depreciation (`/depreciation/post`)

**Deliverables:**
1. Before the existing "Post Depreciation" confirm step, show a **batch GL preview table**:
   ```
   Asset                    Account (Dr)            Account (Cr)            Amount
   ──────────────────────────────────────────────────────────────────────────────
   FA-0001 John Deere 5075  Dep. Exp—Tractors        Accum. Dep.—Tractors    Rs. 41,667
   FA-0002 Massey Ferguson  Dep. Exp—Tractors        Accum. Dep.—Tractors    Rs. 35,417
   FA-0005 CAT 320D Excav.  Dep. Exp—Heavy Equip.   Accum. Dep.—Heavy       Rs. 62,500
   ──────────────────────────────────────────────────────────────────────────────
   Total Debit                                                               Rs. 139,584
   Total Credit                                                              Rs. 139,584
   ```
2. The existing "Post Depreciation" button becomes **[Confirm for GL Approval]** → batch status → `PendingApproval`
3. Finance sees pending batch in Depreciation History → clicks **[Approve]** → `glEngine.post()` called per asset
4. All assets share one `BatchReference` (`DEP-BATCH-2026-04`), each gets own `DocumentReference`
5. **Already-posted guard:** Block re-posting for an already-`Approved` period
6. **Reject:** Returns batch to Draft, all assets in batch revert; user can re-run for the period

---

### Phase 7 — Asset Disposal GL Integration

**What:** Add GL Effect preview + strict two-step approval to the Asset Disposal screen.

**Screen affected:** Asset Disposal (`/asset-disposal`)

**Deliverables:**
1. On the disposal form, dynamically compute and show the GL Effect Panel:
   - System auto-calculates: `NBV = PurchaseCost − AccumulatedDepreciation`
   - System auto-calculates: `GainLoss = DisposalValue − NBV`
   - System selects the correct transaction type (`GAIN` / `LOSS` / `WRITEOFF`)
   - Panel shows the full multi-line journal:
     ```
     Account                          Dr              Cr
     ─────────────────────────────────────────────────────
     Accum. Dep. — Agricultural Eq.   Rs. 1,750,000
     Disposal Proceeds Receivable      Rs.   500,000
     Loss on Disposal                  Rs.   250,000
     Agricultural Equipment — Cost                    Rs. 2,500,000
     ─────────────────────────────────────────────────────
     Total                             Rs. 2,500,000  Rs. 2,500,000
     ```
   - Summary card below the table:
     - Original Cost:              Rs. 2,500,000
     - Accumulated Depreciation:   Rs. 1,750,000
     - **Net Book Value:**         Rs.   750,000
     - Disposal Proceeds:          Rs.   500,000
     - **Loss on Disposal:**      (Rs.   250,000)  ← red
2. **Confirm** → `GLApprovalStatus = 'PendingApproval'`, disposal record locked from editing
3. **Approve** → `glEngine.post()` → `GLPostingRef` set, `IsPostedToGL = true`, asset marked disposed
4. **Reject** → rejection note saved, record unlocked for correction, re-confirm required
5. Lock rule: once `Approved`, disposal is permanently read-only

---

### Phase 8 — Ledger Transactions View (New Screen)

**What:** A new screen to view all journal entries posted by this module.

**Menu position:** Add under Reports → "GL Journal Entries" or under Fixed Asset Management.

**Deliverables:**
1. New screen: `LedgerJournalEntries.jsx` (`/gl-journal-entries`)
2. Columns: Document Ref, Batch Ref, Date, Module, Transaction Type, Source, Account, Dr, Cr
3. Filters: Date range, Module, Transaction Type, Account, Document Reference
4. Grouped view: show Dr and Cr lines grouped under each Document Reference
5. Running totals at bottom: Total Dr, Total Cr, Variance (must always = 0)
6. Print Journal Voucher: printable format per document reference
7. Export CSV for finance team

---

## 8. Screen-by-Screen Integration Detail

The table below shows what changes on each screen, including the new GL Effect Panel placement and which buttons appear in each status.

---

### Fixed Assets Register (`/assets-register`)

**Transaction Type:** `FA_CAPITALIZATION` | **Amount:** `PurchaseCost`

| Event / Status | What Happens | Buttons Shown |
|---|---|---|
| New asset form open | GL Effect Panel shows preview (updates as cost typed) | — |
| Mapping not configured | Yellow warning in panel | — |
| [Save] | Record saved, `GLApprovalStatus = 'Draft'` | **[Confirm for GL Approval]** |
| [Confirm] | Status → `PendingApproval`, cost fields locked | — |
| Finance opens, status = Pending | GL preview visible, balance shown | **[Approve]** **[Reject]** |
| [Approve] | `glEngine.post()` called, `GLPostingRef` set, `IsPostedToGL = true` | GL Ref badge shown |
| [Reject] | Rejection note saved, cost fields unlocked | **[Resubmit]** |
| [Resubmit] | Status → `PendingApproval` again | — |
| Edit (Approved record) | Cost field locked, other fields editable | — |

**Listing additions:** `GL Status` column (Draft/Pending/Approved/Rejected badge). Filter by GL Status.

---

### Maintenance Records (`/maintenance-records`)

**Transaction Type:** `FLEET_MAINT_RECORD` | **Amount:** `costOfService`
**Account resolution:** uses the linked maintenance task's `fixedAssetTypeID`

| Event / Status | What Happens | Buttons Shown |
|---|---|---|
| Record form open | GL Effect Panel shows preview | — |
| [Save] | Record saved, `GLApprovalStatus = 'Draft'` | **[Confirm for GL Approval]** |
| [Confirm] | Status → `PendingApproval` | — |
| Finance: status = Pending | GL preview shown | **[Approve]** **[Reject]** |
| [Approve] | `glEngine.post()` → GL entry created | GL Ref badge |
| [Reject] | Rejection note, cost unlocked | **[Resubmit]** |
| Edit Approved (cost change) | Old GL reversed, new Draft created | **[Confirm for GL Approval]** |

**Listing additions:** `GL Status` column. Filter by GL Status.

---

### Vehicle Service (`/vehicle-service`)

**Transaction Type:** `FLEET_VEHICLE_SVC` | **Amount:** `costAmount`
**Account resolution:** always `FixedAssetTypeID = 1` (Motor Vehicle)

| Event / Status | What Happens | Buttons Shown |
|---|---|---|
| Service form open | GL Effect Panel shows preview | — |
| [Save] | Record saved, `GLApprovalStatus = 'Draft'` | **[Confirm for GL Approval]** |
| [Confirm] | Status → `PendingApproval` | — |
| Finance: status = Pending | GL preview shown | **[Approve]** **[Reject]** |
| [Approve] | GL entry posted | GL Ref badge |
| Edit Approved (cost change) | Old GL reversed, new Draft | **[Confirm for GL Approval]** |

**Listing additions:** `GL Status` column. Service status (On Track/Due Soon/Overdue) badge retained.

---

### Asset Maintenance (`/asset-maintenance`)

**Transaction Type:** `FA_ASSET_MAINT` | **Amount:** `totalMaintenanceCost`
**GL panel appears only when status = Completed** (Active = work in progress, no GL yet)

| Event / Status | What Happens | Buttons Shown |
|---|---|---|
| Status = Active | GL panel hidden | — |
| Status changed to Completed | GL Effect Panel appears | — |
| [Save as Completed] | Record saved, `GLApprovalStatus = 'Draft'` | **[Confirm for GL Approval]** |
| [Confirm] | Status → `PendingApproval` | — |
| Finance: status = Pending | **[Approve]** **[Reject]** | — |
| [Approve] | GL entry posted | GL Ref badge |
| Status reverted Active (Approved) | `glEngine.reverse()` called, GL reversed | New Draft created |

---

### Post Depreciation (`/depreciation/post`)

**Transaction Type:** `FA_DEPRECIATION` | **Amount:** per-asset period depreciation
**This is a batch operation** — all assets in a period are processed together.

| Event / Status | What Happens | Buttons Shown |
|---|---|---|
| Period selected | Batch GL preview table rendered (all assets, all accounts) | — |
| [Confirm for GL Approval] | Batch `GLApprovalStatus = 'PendingApproval'` | — |
| Finance: batch pending | Batch GL preview shown | **[Approve Batch]** **[Reject Batch]** |
| [Approve Batch] | `glEngine.post()` per asset, `BatchReference` assigned | Batch GL Ref badge |
| [Reject Batch] | Rejection note, batch returns to Draft | Re-confirm allowed |
| Already Approved guard | Block re-run: "Period already posted to GL" | — |

**Batch GL preview example (shown before Confirm):**

```
Period: April 2026

Asset Code   Asset Name           Dr Account               Cr Account               Amount
FA-0001      John Deere 5075E     Dep.Exp—Tractors          Accum.Dep.—Tractors     Rs.  41,667
FA-0002      Massey Ferguson 375  Dep.Exp—Tractors          Accum.Dep.—Tractors     Rs.  35,417
FA-0005      CAT 320D Excavator   Dep.Exp—Heavy Equip.      Accum.Dep.—Heavy Eq.    Rs.  62,500
─────────────────────────────────────────────────────────────────────────────────────────────
Total Debit                                                                          Rs. 139,584
Total Credit                                                                         Rs. 139,584
                                                                    ✓ Entry Balances
```

---

### Asset Disposal (`/asset-disposal`)

**Transaction Type:** `FA_DISPOSAL_GAIN` / `FA_DISPOSAL_LOSS` / `FA_DISPOSAL_WRITEOFF`
**This is the most financially significant transaction — two-step approval is mandatory.**

| Event / Status | What Happens | Buttons Shown |
|---|---|---|
| Disposal form open | GL Effect Panel computed from asset's cost + accum. dep. + proceeds | — |
| System detects Gain/Loss/Writeoff | Correct transaction type auto-selected | — |
| [Save] | Record saved, `GLApprovalStatus = 'Draft'` | **[Confirm for GL Approval]** |
| [Confirm] | Status → `PendingApproval`, form fully locked | — |
| Finance: status = Pending | Multi-line GL preview + Gain/Loss summary shown | **[Approve]** **[Reject]** |
| [Approve] | Multi-line journal posted, asset marked disposed | GL Ref badge, locked |
| [Reject] | Rejection note, form unlocked for correction | **[Resubmit]** |

**GL Effect Panel for disposal (example — Loss scenario):**

```
┌────────────────────────────────────────────────────────────────────────────┐
│  GL Account Effect — Asset Disposal                                        │
│                                                                            │
│  Account           Description                          Debit      Credit  │
│  ──────────────────────────────────────────────────────────────────────    │
│  1510-001 (Dr)     Accum. Dep. — Agricultural Equip.  1,750,000            │
│  1110-002 (Dr)     Disposal Proceeds Receivable          500,000            │
│  5420-001 (Dr)     Loss on Disposal of Fixed Assets      250,000            │
│  1120-001 (Cr)     Agricultural Equipment — Cost                  2,500,000 │
│  ──────────────────────────────────────────────────────────────────────    │
│  Total                                                  2,500,000  2,500,000│
│                                                          ✓ Entry Balances   │
│                                                                            │
│  Original Cost:            Rs. 2,500,000                                   │
│  Accumulated Depreciation: Rs. 1,750,000                                   │
│  Net Book Value:           Rs.   750,000                                   │
│  Disposal Proceeds:        Rs.   500,000                                   │
│  LOSS on Disposal:        (Rs.   250,000)  ◄── red                         │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Key Design Decisions

### Decision 1: Draft → Confirm → Approve (not Auto-post)
**Decision:** Every GL transaction follows the three-step workflow. No auto-posting. The operational user Confirms (submits); Finance Approves (posts to GL) or Rejects.

**Rationale:** Auto-posting bypasses financial control. The Confirm/Approve separation ensures Finance reviews every GL entry before it hits the ledger — a fundamental internal control requirement. For high-volume screens (maintenance records), Finance uses the GL Approval Queue screen to batch-approve.

---

### Decision 2: Posting Lock — What Gets Locked?
**Decision:** Once `IsPostedToGL = true`, the **cost/amount fields** of the source record are locked. Status fields (e.g., Active/Inactive) remain editable. Cost corrections require a reversal — not a direct edit.

**Rationale:** Allowing cost edits after GL posting creates silent out-of-balance situations in the ledger. The reversal pattern is the accountant-safe approach.

---

### Decision 3: Depreciation — One Entry or Batch?
**Decision:** One individual `DocumentReference` per asset per period, all sharing a `BatchReference` for the run. Full batch visibility + individual asset reversal capability.

**Rationale:** A single batch entry (one journal for all assets) is simpler but makes individual asset reversal impossible. Given the number of assets and potential corrections, per-asset granularity is essential.

---

### Decision 4: GL Mapping Granularity
**Decision:** Mandatory mapping at Asset Type level. Optional override at Category level. Resolution uses priority-based fallback (Category → Type → Global).

**Rationale:** Most SME plantations use type-level P&L accounts. But large estates with many asset categories (tractors, harvesters, pumps) benefit from category-level depreciation expense tracking for cost centre reporting.

---

### Decision 5: What Happens if GL Mapping is Missing?
**Decision:** For non-financial operational screens (maintenance records): save the record, display a yellow warning: "Record saved. GL mapping not configured for [Asset Type] — no GL entry was posted. Configure in GL Mapping Screen." For Disposal and Depreciation posting: BLOCK the action with a red error — these are formal financial events.

**Rationale:** Blocking a workshop technician from saving a maintenance record because finance hasn't configured GL accounts is bad UX. But blocking a disposal without proper accounts prevents unrecorded asset write-offs.

---

### Decision 6: Reversal Pattern
**Decision:** Reversals are stored as new `LedgerTransaction` rows with `IsReversed = true` and `ReversalOf = originalLedgerTransactionID`. The GL Engine handles this transparently.

**Rationale:** This preserves full audit history. Physically deleting original journal lines would destroy the audit trail — unacceptable in a financial system.

---

## 10. Schema Changes (v5)

Summary of all changes for the next schema version:

| # | Table | Change | Detail |
|---|-------|--------|--------|
| GL1 | `LedgerAccountType` | **New table** | Account type master (Asset, Liability, Equity, Revenue, Expense) |
| GL2 | `ParentHeader` | **New table** | Level 1 account grouping |
| GL3 | `ChildHeader` | **New table** | Level 2 account grouping |
| GL4 | `LedgerAccount` | **New table** | Chart of accounts — postable leaf accounts |
| GL5 | `GLMappingHeader` | **New table** | Defines each mappable transaction event (8 types) |
| GL6 | `GLAccountMapping` | **New table** | Maps events to Dr/Cr accounts by asset type/category |
| GL7 | `DocumentReference` | **New table** | Auto-incrementing reference number generator |
| GL8 | `LedgerTransaction` | **New table** | All posted journal entry lines (approved entries only) |
| GL9 | `FixedAsset` | **Add columns** | `GLApprovalStatus`, `GLApprovedBy`, `GLApprovedDate`, `GLRejectedBy`, `GLRejectedDate`, `GLRejectionNote`, `GLPostingRef`, `IsPostedToGL` |
| GL10 | `MaintenanceRecord` | **Add columns** | Same 8 GL approval columns |
| GL11 | `VehicleService` | **Add columns** | Same 8 GL approval columns |
| GL12 | `AssetMaintenance` | **Add columns** | Same 8 GL approval columns |
| GL13 | `DepreciationHistory` | **Add columns** | Same 8 GL approval columns + `BatchReference VARCHAR(50)` |
| GL14 | `Disposal` | **Add columns** | Same 8 GL approval columns |

---

## Implementation Order Summary

```
Phase 1 — GL Foundation (stores, glEngine, mock data)        ← Start here
Phase 2 — GL Mapping Screen Extension (8 transaction types)  ← Admin configures accounts
Phase 3 — GLEffectPanel component + Approval Workflow UI     ← Build once, reuse everywhere
Phase 4 — Fixed Asset Registry integration                   ← Most impactful, test first
Phase 5 — Maintenance & Service integration (3 screens)      ← High volume, test reversal
Phase 6 — Depreciation GL integration (batch + approval)     ← Batch logic, test guard
Phase 7 — Asset Disposal GL integration                      ← Most complex multi-line journal
Phase 8 — GL Approval Queue + Journal Entries view           ← Finance operations screens
```

**Total new/modified files estimate:**
- 4 new store files: `ledgerAccountStore.js`, `glMappingStore.js`, `documentReferenceStore.js`, `ledgerTransactionStore.js`
- 1 new engine: `src/utils/glEngine.js` (preview + post + reverse)
- 2 new components: `GLEffectPanel.jsx`, `GLStatusBadge.jsx`
- 2 new screens: `GLApprovalQueue.jsx`, `LedgerJournalEntries.jsx`
- 6 modified screens: Assets Register, Maintenance Records, Vehicle Service, Asset Maintenance, Depreciation Post, Asset Disposal
- 1 extended screen: GL Mapping Screen (FA module entries)
- Schema v5 DDL additions (8 new tables, 8 source tables with 8 new columns each)

---

*AgriGEN ERP — GL Integration Plan v1.0*
*Prepared 2026-04-16*
