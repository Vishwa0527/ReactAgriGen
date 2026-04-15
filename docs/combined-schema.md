# AgriGEN ERP — Fleet & Fixed Asset Management
# Combined Database Schema

**System:** AgriGEN ERP  
**Modules:** Fleet Management · Fixed Asset Management  
**Last Updated:** 2026-04-15  
**Version:** v4 — Asset Disposal tables added

---

## Table of Contents

1. [Schema Change Log](#schema-change-log)
2. [Architecture Overview](#architecture-overview)
3. [Integration Points](#integration-points)
4. [External Dependencies](#external-dependencies)
5. [ER Diagram](#er-diagram)
6. [Table Definitions](#table-definitions)
   - [Shared Foundation](#shared-foundation)
   - [Shared Classification](#shared-classification)
   - [Shared Workshop & Inventory](#shared-workshop--inventory)
   - [Fleet — Lookup](#fleet--lookup)
   - [Fleet — Vehicle Core](#fleet--vehicle-core)
   - [Fleet — Driver & Operations](#fleet--driver--operations)
   - [Fleet — Technicians](#fleet--technicians)
   - [Fleet — Maintenance & Service](#fleet--maintenance--service)
   - [Fleet — Inventory Issuance](#fleet--inventory-issuance)
   - [Fixed Asset — Core](#fixed-asset--core)
   - [Fixed Asset — Depreciation](#fixed-asset--depreciation)
   - [Fixed Asset — Maintenance & Estimation](#fixed-asset--maintenance--estimation)
   - [Fixed Asset — Disposal](#fixed-asset--disposal)
7. [Audit Columns (All Tables)](#audit-columns-all-tables)
8. [Soft Delete Policy](#soft-delete-policy)

---

## Schema Change Log

### From Fleet v1 → Fleet v2 (Workshop integration, previous session)

| # | Table | Change | Detail |
|---|-------|--------|--------|
| F1 | `MaintenanceTask` | Added column | `TaskType VARCHAR(20)` — `'Vehicle Service'` \| `'Maintenance'` |
| F2 | `MaintenanceRecord` | Added columns | `MaintenanceTaskID INT NOT NULL FK`, `WorkshopID INT NOT NULL FK` |
| F3 | `MaintenanceRecordItem` | **New table** | SKU line items for maintenance records |
| F4 | `VehicleService` | Constraint change | `MaintenanceTaskID` changed from NULL to NOT NULL |
| F5 | `VehicleServiceItem` | Added columns | `Source`, `ItemIssueRef`, `HasRemovedItem`, `RemovedSKUID`, `RemovedQuantity`, `RemovedUnitCost` |
| F6 | All tables | Added columns ×5 | `IsActive`, `CreatedBy`, `CreatedDate`, `ModifiedBy`, `ModifiedDate` |

### From Combined v3 → v4 (Asset Disposal added, 2026-04-15)

| # | Table | Change | Detail |
|---|-------|--------|--------|
| C16 | `DisposalStatusType` | **New table** | Lookup for disposal workflow statuses: Draft, Approved, Completed. |
| C17 | `Disposal` | **New table** | Records the write-off, sale, donation, or scrap of a fixed asset. Triggers status change on `FixedAsset` and closure of open `Depreciation` schedules. |

### From Fleet v2 → Combined v3 (Fixed Asset module merged, this session)

| # | Table | Change | Detail |
|---|-------|--------|--------|
| C1 | `FixedAssetType` | **Enhanced** | Added `AssetTypeCode VARCHAR(10)` (was only `Code`); `AssetTypeName` replaces `Name`; retains `Desc`, `GroupID`, `EstateID` from Fleet. Now shared by both modules. |
| C2 | `FixedAssetCategory` | **New table** | Sub-classification within a FixedAssetType. Scoped to Group. |
| C3 | `WorkshopCategory` | **New table** | Classification for Workshops (e.g. Vehicle Workshop, Plant Workshop). |
| C4 | `Workshop` | **Enhanced** | Added `WorkshopCategoryID INT FK`, `FixedAssetTypeID INT FK`. Shared by both modules. |
| C5 | `WorkshopStock` | **Replaced** | Superseded by `WorkshopInventory` + `WorkshopInventoryDetail`. Adds reorder/min/max levels, warehouse SKU mapping, and FIFO batch tracking. |
| C6 | `Vehicle` | **Enhanced** | Added `FixedAssetID INT NULL FK → FixedAsset`. Removed `CostOfAsset`, `UsefulLifeYears`, `ResidualValue`, `DepreciationValue` (now sourced from the linked `FixedAsset` record). |
| C7 | `FixedAsset` | **New table** | Core Fixed Asset entity. Vehicles are one type of FixedAsset. |
| C8 | `FixedAssetHistory` | **New table** | Immutable snapshot of a FixedAsset at each significant change event. |
| C9 | `Depreciation` | **New table** | Depreciation schedule per asset. |
| C10 | `DepreciationHistory` | **New table** | Period-by-period depreciation posting ledger. |
| C11 | `AssetMaintenance` | **New table** | FA-module maintenance record for asset valuation (distinct from Fleet's `MaintenanceTask`). |
| C12 | `AssetMaintenanceDetail` | **New table** | Employee / task breakdown within an asset maintenance event. |
| C13 | `AssetMaintenanceCost` | **New table** | Cost estimation vs actual cost per asset maintenance event. |
| C14 | `Estimation` | **New table** | Pre-maintenance cost estimate. |
| C15 | `EstimationDetail` | **New table** | SKU-level breakdown of an estimation. |

---

## Architecture Overview

```
AgriGEN ERP
│
├── External Modules (read-only reference in Fleet/FA)
│   ├── HR Module          → Employee
│   └── Inventory Module   → SKUMaster · MeasuringUnit · WarehouseSKUMapping
│
├── ── SHARED FOUNDATION ──────────────────────────────────────────────────
│   ├── Group              (plantation holding company)
│   └── Estate             (estate within a group)
│
├── ── SHARED CLASSIFICATION ──────────────────────────────────────────────
│   ├── FixedAssetType     ★ used by both Fleet and Fixed Asset modules
│   ├── FixedAssetCategory ★ sub-type classification (NEW — FA module)
│   └── WorkshopCategory   ★ workshop type classification (NEW — FA module)
│
├── ── SHARED WORKSHOP & INVENTORY ────────────────────────────────────────
│   ├── Workshop            ★ enhanced — used by both modules
│   ├── WorkshopInventory   ★ replaces WorkshopStock — richer structure
│   └── WorkshopInventoryDetail
│
├── ── FLEET MANAGEMENT ────────────────────────────────────────────────────
│   ├── Lookup
│   │   ├── VehicleType · FuelType · DocumentType
│   │   ├── PurposeCategory · LicenseCategory · TechCategory
│   │
│   ├── Vehicle Core
│   │   ├── Vehicle           (← links to FixedAsset via FixedAssetID FK)
│   │   ├── VehicleDocument
│   │   └── VehiclePurposeMapping
│   │
│   ├── Driver & Operations
│   │   ├── Driver · DriverAssignment · DailyRunning
│   │
│   ├── Technicians
│   │   ├── TechAssignment · WorkshopTechRate
│   │
│   ├── Maintenance & Service  [operational — scheduling, jobs, parts]
│   │   ├── MaintenanceTask
│   │   ├── JobCard
│   │   ├── MaintenanceRecord + MaintenanceRecordItem
│   │   └── VehicleService    + VehicleServiceItem
│   │
│   └── Inventory Issuance
│       ├── ItemIssue + ItemIssueItem
│
└── ── FIXED ASSET MANAGEMENT ──────────────────────────────────────────────
    ├── Core
    │   ├── FixedAsset
    │   └── FixedAssetHistory
    │
    ├── Depreciation
    │   ├── Depreciation
    │   └── DepreciationHistory
    │
    ├── Maintenance  [financial/accounting — asset valuation impact]
    │   ├── AssetMaintenance
    │   ├── AssetMaintenanceDetail
    │   └── AssetMaintenanceCost
    │
    ├── Estimation
    │   ├── Estimation
    │   └── EstimationDetail
    │
    └── Disposal
        ├── DisposalStatusType  (lookup)
        └── Disposal
        
```

---

## Integration Points

| # | Point | How Modules Connect |
|---|-------|---------------------|
| 1 | **Vehicle → FixedAsset** | `Vehicle.FixedAssetID FK → FixedAsset`. A registered vehicle IS a fixed asset. Financial fields (cost, depreciation, useful life) live in `FixedAsset`; operational fields (plate, brand, status) live in `Vehicle`. |
| 2 | **Fleet Maintenance → FA Maintenance** | `AssetMaintenance` can optionally reference a Fleet `MaintenanceTask` (via `FleetMaintenanceTaskID INT NULL FK`). When a vehicle maintenance task is completed, an `AssetMaintenance` record may be created to record the impact on asset value/history. |
| 3 | **Workshop** | The same `Workshop` table serves both modules. Fleet uses it for task routing; FA uses it to record maintenance and inventory. |
| 4 | **WorkshopInventory** | Replaces Fleet's `WorkshopStock`. Fleet's item deduction/addition logic (Service/Maintenance Record items) will reference `WorkshopInventory` instead of the old `WorkshopStock`. |
| 5 | **FixedAssetType** | The same table classifies both Fleet vehicles (`Motor Vehicle` type) and other fixed assets (`Agricultural Machine`, `Heavy Equipment`). |
| 6 | **SKUMaster** | Referenced by Fleet (service parts) and FA (estimation and maintenance cost details). Single source of truth in the Inventory module. |

---

## External Dependencies

| External Table | Owned By | Used In |
|----------------|----------|---------|
| `Employee` | AgriGEN HR | Driver, TechAssignment, JobCard, AssetMaintenanceDetail |
| `SKUMaster` | AgriGEN Inventory | FuelType, service items, WorkshopInventory, EstimationDetail |
| `MeasuringUnit` | AgriGEN Inventory | WorkshopInventory |
| `WarehouseSKUMapping` | AgriGEN Inventory | WorkshopInventory, WorkshopInventoryDetail |

---

## ER Diagram

```mermaid
erDiagram

    %% ═══════════════════════════════════════════════════════════
    %% EXTERNAL REFERENCES (read-only)
    %% ═══════════════════════════════════════════════════════════
    Employee {
        int     EmployeeID PK
        string  EmployeeNo
        string  Name
        int     EstateID
        int     GroupID
    }
    SKUMaster {
        int     SKUID PK
        string  Code
        string  Name
        string  Unit
    }

    %% ═══════════════════════════════════════════════════════════
    %% SHARED FOUNDATION
    %% ═══════════════════════════════════════════════════════════
    Group {
        int     GroupID PK
        string  Name
    }
    Estate {
        int     EstateID PK
        string  Name
        int     GroupID FK
    }

    %% ═══════════════════════════════════════════════════════════
    %% SHARED CLASSIFICATION  [used by BOTH modules]
    %% ═══════════════════════════════════════════════════════════
    FixedAssetType {
        int     FixedAssetTypeID PK
        string  AssetTypeCode
        string  AssetTypeName
        string  Desc
        int     GroupID FK
        int     EstateID FK
    }
    FixedAssetCategory {
        int     FixedAssetCategoryID PK
        int     FixedAssetTypeID FK
        string  AssetCategoryCode
        string  AssetCategoryName
        int     GroupID FK
    }
    WorkshopCategory {
        int     WorkshopCategoryID PK
        string  WorkshopCategoryCode
        string  WorkshopCategoryName
        int     GroupID FK
    }

    %% ═══════════════════════════════════════════════════════════
    %% SHARED WORKSHOP & INVENTORY  [used by BOTH modules]
    %% ═══════════════════════════════════════════════════════════
    Workshop {
        int     WorkshopID PK
        string  WorkshopCode
        string  WorkshopName
        int     WorkshopCategoryID FK
        int     FixedAssetTypeID FK
        int     GroupID FK
        int     EstateID FK
        string  Status
    }
    WorkshopInventory {
        int     WorkshopInventoryID PK
        int     WorkshopID FK
        int     SKUID FK
        int     MeasuringUnitID FK
        int     WarehouseSKUMappingID FK
        int     ReorderLevel
        int     AvailableBalance
        int     MinLevel
        int     MaxLevel
        decimal UnitCost
        int     GroupID FK
        int     EstateID FK
    }
    WorkshopInventoryDetail {
        int     WorkshopInventoryDetailID PK
        int     WorkshopInventoryID FK
        int     WorkshopID FK
        int     SKUID FK
        int     WarehouseSKUMappingID FK
        int     ItemIssueID FK
        string  ItemIssueReference
        decimal Quantity
        decimal UnitCost
        int     GroupID FK
        int     EstateID FK
    }

    %% ═══════════════════════════════════════════════════════════
    %% FLEET — LOOKUP
    %% ═══════════════════════════════════════════════════════════
    VehicleType {
        int     VehicleTypeID PK
        string  Code
        string  Name
        int     GroupID FK
    }
    FuelType {
        int     FuelTypeID PK
        string  Code
        string  Name
        bool    IsSecondary
        int     GroupID FK
        int     SKUID FK
    }
    DocumentType {
        int     DocumentTypeID PK
        string  Code
        string  Name
        bool    ExpirationEnabled
        int     GroupID FK
    }
    PurposeCategory {
        int     PurposeCategoryID PK
        string  Code
        string  Name
        string  Module
        int     GroupID FK
    }
    LicenseCategory {
        int     LicenseCategoryID PK
        string  Code
        string  Name
        int     GroupID FK
    }
    TechCategory {
        int     TechCategoryID PK
        string  Code
        string  Name
    }

    %% ═══════════════════════════════════════════════════════════
    %% FLEET — VEHICLE CORE
    %% ═══════════════════════════════════════════════════════════
    Vehicle {
        int     VehicleID PK
        int     FixedAssetID FK
        string  Numbers
        string  Brand
        string  Model
        int     GroupID FK
        int     EstateID FK
        int     VehicleTypeID FK
        int     FixedAssetTypeID FK
        int     FuelTypeID FK
        string  RegisterYear
        string  Capacity
        string  Status
    }
    VehicleDocument {
        int     VehicleDocumentID PK
        int     VehicleID FK
        int     DocumentTypeID FK
        string  DocNumber
        date    StartDate
        date    ExpireDate
        string  Notes
    }
    VehiclePurposeMapping {
        int     MappingID PK
        int     VehicleID FK
        int     PurposeCategoryID FK
        date    EffectiveDate
        string  Notes
    }

    %% ═══════════════════════════════════════════════════════════
    %% FLEET — DRIVER & OPERATIONS
    %% ═══════════════════════════════════════════════════════════
    Driver {
        int     DriverID PK
        string  Code
        int     EmployeeID FK
        string  Name
        string  LicenseNo
        int     LicenseCategoryID FK
        date    LicExpireDate
        string  Status
        string  Notes
    }
    DriverAssignment {
        int     AssignmentID PK
        int     VehicleID FK
        int     DriverID FK
        date    StartDate
        date    EndDate
        string  Notes
    }
    DailyRunning {
        int     DailyRunningID PK
        string  RefCode
        int     VehicleID FK
        int     DriverID FK
        datetime StartDateTime
        datetime EndDateTime
        int     StartOdo
        int     EndOdo
        string  Notes
    }

    %% ═══════════════════════════════════════════════════════════
    %% FLEET — TECHNICIANS
    %% ═══════════════════════════════════════════════════════════
    TechAssignment {
        int     TechAssignmentID PK
        int     EmployeeID FK
        int     TechCategoryID FK
        string  Notes
    }
    WorkshopTechRate {
        int     WorkshopTechRateID PK
        string  Code
        int     WorkshopID FK
        int     TechCategoryID FK
        string  RateType
        decimal RateAmount
    }

    %% ═══════════════════════════════════════════════════════════
    %% FLEET — MAINTENANCE & SERVICE  (operational)
    %% ═══════════════════════════════════════════════════════════
    MaintenanceTask {
        int     MaintenanceTaskID PK
        string  RefCode
        date    Date
        int     VehicleID FK
        int     WorkshopID FK
        string  Mode
        string  TaskType
        decimal CostTotal
        string  Notes
    }
    JobCard {
        int     JobCardID PK
        int     MaintenanceTaskID FK
        int     VehicleID FK
        int     WorkshopID FK
        int     EmployeeID FK
        datetime StartTime
        datetime EndTime
        string  Description
        decimal CostOfService
    }
    MaintenanceRecord {
        int     MaintenanceRecordID PK
        int     MaintenanceTaskID FK
        int     VehicleID FK
        int     WorkshopID FK
        date    Date
        decimal CostOfService
        string  Description
    }
    MaintenanceRecordItem {
        int     ItemID PK
        int     MaintenanceRecordID FK
        int     SKUID FK
        decimal Quantity
        decimal UnitCost
        string  Source
        string  ItemIssueRef
        bool    HasRemovedItem
        int     RemovedSKUID FK
        decimal RemovedQuantity
        decimal RemovedUnitCost
    }
    VehicleService {
        int     VehicleServiceID PK
        int     MaintenanceTaskID FK
        int     VehicleID FK
        int     WorkshopID FK
        date    ServiceDate
        int     Odometer
        date    NextServiceDate
        int     NextServiceOdo
        decimal CostAmount
        string  Notes
    }
    VehicleServiceItem {
        int     ItemID PK
        int     VehicleServiceID FK
        int     SKUID FK
        decimal Quantity
        decimal UnitCost
        string  Source
        string  ItemIssueRef
        bool    HasRemovedItem
        int     RemovedSKUID FK
        decimal RemovedQuantity
        decimal RemovedUnitCost
    }

    %% ═══════════════════════════════════════════════════════════
    %% FLEET — INVENTORY ISSUANCE
    %% ═══════════════════════════════════════════════════════════
    ItemIssue {
        int     ItemIssueID PK
        string  RefCode
        date    IssueDate
        string  IssueType
        int     TargetID
        string  Notes
    }
    ItemIssueItem {
        int     ItemID PK
        int     ItemIssueID FK
        int     SKUID FK
        decimal Quantity
        decimal UnitCost
    }

    %% ═══════════════════════════════════════════════════════════
    %% FIXED ASSET — CORE
    %% ═══════════════════════════════════════════════════════════
    FixedAsset {
        int     FixedAssetID PK
        int     FixedAssetTypeID FK
        int     FixedAssetCategoryID FK
        string  FixedAssetCode
        string  FixedAssetName
        int     GroupID FK
        int     EstateID FK
        decimal TotalCostOfAsset
        decimal ResidualValue
        decimal ImplementationCost
        date    ImplementationDate
        date    StartDate
        int     UsefulLifeYears
        bool    IsFuelNeeded
        int     FuelTypeID FK
        bool    IsWarrantyEnabled
        date    WarrantyStartDate
        date    WarrantyEndDate
        string  RegistrationNumber
        decimal DepreciationValue
        string  LedgerTransactionRef
    }
    FixedAssetHistory {
        int     FixedAssetHistoryID PK
        int     FixedAssetID FK
        int     FixedAssetTypeID FK
        int     FixedAssetCategoryID FK
        string  FixedAssetCode
        string  FixedAssetName
        int     GroupID FK
        int     EstateID FK
        decimal TotalCostOfAsset
        decimal ResidualValue
        decimal ImplementationCost
        date    ImplementationDate
        date    StartDate
        int     UsefulLifeYears
        decimal DepreciationValue
        string  LedgerTransactionRef
        int     NewUsefulLifeYears
        decimal NewResidualValue
        decimal PresentValue
        string  NewDepreciationRegisterNo
        date    NewDepreciationClaimDate
        int     AssetMaintenanceID FK
        date    WarrantyClaimDate
    }

    %% ═══════════════════════════════════════════════════════════
    %% FIXED ASSET — DEPRECIATION
    %% ═══════════════════════════════════════════════════════════
    Depreciation {
        int     DepreciationID PK
        int     FixedAssetID FK
        date    AssetValueDate
        decimal AssetValue
        int     UsefulYears
        decimal ResidualValue
        decimal DepreciationValue
        int     GroupID FK
        int     EstateID FK
    }
    DepreciationHistory {
        int     DepreciationHistoryID PK
        int     DepreciationID FK
        int     FixedAssetID FK
        date    Date
        decimal Value
        string  LedgerTransactionRef
        int     GroupID FK
        int     EstateID FK
    }

    %% ═══════════════════════════════════════════════════════════
    %% FIXED ASSET — MAINTENANCE (financial/accounting)
    %% ═══════════════════════════════════════════════════════════
    AssetMaintenance {
        int     AssetMaintenanceID PK
        int     FixedAssetID FK
        int     FixedAssetHistoryID FK
        int     FleetMaintenanceTaskID FK
        string  MaintenanceCode
        date    MaintenanceDate
        decimal TotalMaintenanceCost
        int     WorkshopID FK
        int     GroupID FK
        int     EstateID FK
    }
    AssetMaintenanceDetail {
        int     AssetMaintenanceDetailID PK
        int     AssetMaintenanceID FK
        bool    IsEmployeeEnabled
        int     EmployeeID FK
        int     WorkshopID FK
        int     GroupID FK
        int     EstateID FK
    }
    AssetMaintenanceCost {
        int     AssetMaintenanceCostID PK
        int     AssetMaintenanceID FK
        int     FixedAssetID FK
        string  EstimateCode
        decimal TotalMaintenanceCost
        date    MaintenanceDate
        int     WorkshopID FK
        int     GroupID FK
        int     EstateID FK
    }

    %% ═══════════════════════════════════════════════════════════
    %% FIXED ASSET — DISPOSAL
    %% ═══════════════════════════════════════════════════════════
    DisposalStatusType {
        int     DisposalStatusTypeID PK
        string  Code
        string  Name
    }
    Disposal {
        int     DisposalID PK
        string  DisposalCode
        int     FixedAssetID FK
        int     GroupID FK
        int     EstateID FK
        date    DisposalDate
        string  DisposalType
        decimal BookValueAtDisposal
        decimal SaleProceeds
        decimal GainLossOnDisposal
        string  DisposalReason
        string  ApprovedBy
        string  Notes
        int     DisposalStatusTypeID FK
    }

    %% ═══════════════════════════════════════════════════════════
    %% FIXED ASSET — ESTIMATION
    %% ═══════════════════════════════════════════════════════════
    Estimation {
        int     EstimationID PK
        int     FixedAssetID FK
        string  EstimateCode
        decimal TotalEstimatedCost
        date    EstimationDate
        int     WorkshopID FK
        int     GroupID FK
        int     EstateID FK
    }
    EstimationDetail {
        int     EstimationDetailID PK
        int     EstimationID FK
        int     FixedAssetID FK
        int     SKUID FK
        decimal Quantity
        decimal UnitCost
        decimal EstimatedCost
        int     WorkshopID FK
        int     GroupID FK
        int     EstateID FK
    }

    %% ═══════════════════════════════════════════════════════════
    %% RELATIONSHIPS
    %% ═══════════════════════════════════════════════════════════

    %% Foundation
    Group         ||--o{ Estate                   : "has"
    Group         ||--o{ FixedAssetType            : "scoped to"
    Group         ||--o{ FixedAssetCategory        : "scoped to"
    Group         ||--o{ WorkshopCategory          : "scoped to"
    Group         ||--o{ Workshop                  : "owns"
    Estate        ||--o{ Workshop                  : "hosts"
    Estate        ||--o{ FixedAssetType            : "scoped to"

    %% Shared classification
    FixedAssetType     ||--o{ FixedAssetCategory   : "has categories"
    FixedAssetType     ||--o{ Workshop             : "services type"
    FixedAssetType     ||--o{ FixedAsset           : "types"
    FixedAssetType     ||--o{ Vehicle              : "classifies"
    FixedAssetCategory ||--o{ FixedAsset           : "categorises"
    WorkshopCategory   ||--o{ Workshop             : "categorises"

    %% Workshop & Inventory
    Workshop      ||--o{ WorkshopInventory         : "holds"
    Workshop      ||--o{ WorkshopTechRate          : "rates"
    WorkshopInventory ||--o{ WorkshopInventoryDetail : "FIFO batches"
    SKUMaster     ||--o{ WorkshopInventory         : "stocked as"
    SKUMaster     ||--o{ WorkshopInventoryDetail   : "batch ref"

    %% Fleet lookup
    Group         ||--o{ VehicleType               : "scoped to"
    Group         ||--o{ FuelType                  : "scoped to"
    Group         ||--o{ DocumentType              : "scoped to"
    Group         ||--o{ PurposeCategory           : "scoped to"
    Group         ||--o{ LicenseCategory           : "scoped to"
    SKUMaster     ||--o{ FuelType                  : "links to"

    %% Vehicle Core
    FixedAsset    ||--o| Vehicle                   : "is realised as"
    VehicleType   ||--o{ Vehicle                   : "classifies"
    FuelType      ||--o{ Vehicle                   : "fuelled by"
    Estate        ||--o{ Vehicle                   : "hosts"
    Group         ||--o{ Vehicle                   : "owns"
    Vehicle       ||--o{ VehicleDocument           : "has"
    DocumentType  ||--o{ VehicleDocument           : "typed as"
    Vehicle       ||--o{ VehiclePurposeMapping     : "mapped to"
    PurposeCategory ||--o{ VehiclePurposeMapping   : "purpose"

    %% Driver & Operations
    Employee      ||--o{ Driver                    : "registered as"
    LicenseCategory ||--o{ Driver                  : "licence type"
    Driver        ||--o{ DriverAssignment          : "assigned via"
    Vehicle       ||--o{ DriverAssignment          : "has driver"
    Vehicle       ||--o{ DailyRunning              : "logged in"
    Driver        ||--o{ DailyRunning              : "drives"

    %% Technicians
    Employee      ||--o{ TechAssignment            : "assigned as tech"
    TechCategory  ||--o{ TechAssignment            : "category"
    TechCategory  ||--o{ WorkshopTechRate          : "rated under"

    %% Fleet Maintenance
    Vehicle       ||--o{ MaintenanceTask           : "undergoes"
    Workshop      ||--o{ MaintenanceTask           : "handles"
    MaintenanceTask ||--o{ JobCard                 : "has cards"
    Employee      ||--o{ JobCard                   : "assigned to"
    MaintenanceTask ||--o{ MaintenanceRecord       : "parent of"
    MaintenanceRecord ||--o{ MaintenanceRecordItem : "uses parts"
    SKUMaster     ||--o{ MaintenanceRecordItem     : "part used"
    MaintenanceTask ||--o{ VehicleService          : "parent of"
    VehicleService ||--o{ VehicleServiceItem       : "uses parts"
    SKUMaster     ||--o{ VehicleServiceItem        : "part used"

    %% Item Issues
    Workshop      ||--o{ WorkshopInventoryDetail   : "received via"
    ItemIssue     ||--o{ ItemIssueItem             : "contains"
    SKUMaster     ||--o{ ItemIssueItem             : "item ref"

    %% Fixed Asset Core
    FixedAsset    ||--o{ FixedAssetHistory         : "tracked in"
    FuelType      ||--o{ FixedAsset                : "fuel type"
    Estate        ||--o{ FixedAsset                : "hosts"
    Group         ||--o{ FixedAsset                : "owns"

    %% Depreciation
    FixedAsset    ||--o{ Depreciation              : "depreciated via"
    Depreciation  ||--o{ DepreciationHistory       : "posted in"
    FixedAsset    ||--o{ DepreciationHistory       : "referenced in"

    %% Asset Maintenance
    FixedAsset    ||--o{ AssetMaintenance          : "maintained via"
    FixedAssetHistory ||--o{ AssetMaintenance      : "linked to"
    MaintenanceTask ||--o| AssetMaintenance        : "triggers"
    Workshop      ||--o{ AssetMaintenance          : "at"
    AssetMaintenance ||--o{ AssetMaintenanceDetail : "detailed by"
    AssetMaintenance ||--o{ AssetMaintenanceCost   : "costed in"
    Employee      ||--o{ AssetMaintenanceDetail    : "employee"
    AssetMaintenance ||--o{ FixedAssetHistory      : "recorded in"

    %% Estimation
    FixedAsset    ||--o{ Estimation                : "estimated for"
    Workshop      ||--o{ Estimation                : "by"
    Estimation    ||--o{ EstimationDetail          : "detailed by"
    SKUMaster     ||--o{ EstimationDetail          : "part ref"

    %% Disposal
    FixedAsset         ||--o{ Disposal             : "disposed via"
    DisposalStatusType ||--o{ Disposal             : "status"
    Group              ||--o{ Disposal             : "owns"
    Estate             ||--o{ Disposal             : "at"
```

---

## Table Definitions

> **Audit columns** (`IsActive`, `CreatedBy`, `CreatedDate`, `ModifiedBy`, `ModifiedDate`) are present on **every table** except external references. Defined once in [§ Audit Columns](#audit-columns-all-tables) — omitted from grids below for brevity.
>
> **Legend:** `★ Shared` = used by both modules · `🆕 New (FA)` = added by FA merge · `🔄 Changed` = modified by FA merge

---

### Shared Foundation

#### `Group`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| GroupID | INT | PK, AUTO | Plantation holding company |
| Name | NVARCHAR(150) | NOT NULL, UNIQUE | e.g. Hatton Plantations PLC |

#### `Estate`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| EstateID | INT | PK, AUTO | |
| Name | NVARCHAR(150) | NOT NULL | |
| GroupID | INT | FK → Group | |

---

### Shared Classification

#### `FixedAssetType` ★ `🔄 Changed`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| FixedAssetTypeID | INT | PK, AUTO | |
| AssetTypeCode | VARCHAR(10) | NOT NULL, UNIQUE | e.g. FA001 — was `Code` in Fleet v2 |
| AssetTypeName | NVARCHAR(100) | NOT NULL | e.g. Motor Vehicle — was `Name` in Fleet v2 |
| Desc | NVARCHAR(255) | NULL | |
| GroupID | INT | FK → Group | |
| EstateID | INT | FK → Estate, NULL | Optional estate scoping |

#### `FixedAssetCategory` ★ `🆕 New (FA)`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| FixedAssetCategoryID | INT | PK, AUTO | |
| FixedAssetTypeID | INT | FK → FixedAssetType | |
| AssetCategoryCode | VARCHAR(10) | NOT NULL | e.g. FA-CAT-001 |
| AssetCategoryName | NVARCHAR(100) | NOT NULL | e.g. Light Vehicles, Tractors |
| GroupID | INT | FK → Group | |

#### `WorkshopCategory` ★ `🆕 New (FA)`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| WorkshopCategoryID | INT | PK, AUTO | |
| WorkshopCategoryCode | VARCHAR(10) | NOT NULL, UNIQUE | e.g. WC001 |
| WorkshopCategoryName | NVARCHAR(100) | NOT NULL | e.g. Vehicle Workshop, Plant Workshop |
| GroupID | INT | FK → Group | |

---

### Shared Workshop & Inventory

#### `Workshop` ★ `🔄 Changed`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| WorkshopID | INT | PK, AUTO | |
| WorkshopCode | VARCHAR(10) | NOT NULL, UNIQUE | e.g. WS001 |
| WorkshopName | NVARCHAR(100) | NOT NULL | |
| WorkshopCategoryID | INT | FK → WorkshopCategory | 🆕 Workshop type classification |
| FixedAssetTypeID | INT | FK → FixedAssetType | 🆕 Type of assets this workshop services |
| GroupID | INT | FK → Group | |
| EstateID | INT | FK → Estate | |
| Status | VARCHAR(20) | NOT NULL | Active / Inactive |

#### `WorkshopInventory` ★ `🆕 New (FA)` *(replaces `WorkshopStock`)*
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| WorkshopInventoryID | INT | PK, AUTO | |
| WorkshopID | INT | FK → Workshop | |
| SKUID | INT | FK → SKUMaster (Ext) | |
| MeasuringUnitID | INT | FK → MeasuringUnit (Ext) | Unit of measure |
| WarehouseSKUMappingID | INT | FK → WarehouseSKUMapping (Ext) | Warehouse source mapping |
| ReorderLevel | INT | NOT NULL, DEFAULT 0 | |
| AvailableBalance | INT | NOT NULL, DEFAULT 0 | Current total balance |
| MinLevel | INT | NOT NULL, DEFAULT 0 | Alert threshold |
| MaxLevel | INT | NOT NULL, DEFAULT 0 | Maximum stocking level |
| UnitCost | DECIMAL(12,2) | NOT NULL | Last received unit cost |
| GroupID | INT | FK → Group | |
| EstateID | INT | FK → Estate | |

> **Unique constraint:** `(WorkshopID, SKUID)` — one inventory header per SKU per workshop.

#### `WorkshopInventoryDetail` ★ `🆕 New (FA)` *(FIFO batch tracking)*
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| WorkshopInventoryDetailID | INT | PK, AUTO | |
| WorkshopInventoryID | INT | FK → WorkshopInventory | |
| WorkshopID | INT | FK → Workshop | Denormalized |
| SKUID | INT | FK → SKUMaster (Ext) | Denormalized |
| WarehouseSKUMappingID | INT | FK → WarehouseSKUMapping (Ext) | |
| ItemIssueID | INT | FK → ItemIssue | Source issue record |
| ItemIssueReference | VARCHAR(50) | NULL | Denormalized ref code |
| Quantity | DECIMAL(10,3) | NOT NULL | Quantity in this batch |
| UnitCost | DECIMAL(12,2) | NOT NULL | Cost for this batch |
| GroupID | INT | FK → Group | |
| EstateID | INT | FK → Estate | |

---

### Fleet — Lookup

#### `VehicleType`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| VehicleTypeID | INT | PK, AUTO | |
| Code | VARCHAR(10) | NOT NULL, UNIQUE | e.g. VT001 |
| Name | NVARCHAR(100) | NOT NULL | e.g. Heavy Truck |
| Desc | NVARCHAR(255) | NULL | |
| GroupID | INT | FK → Group | |

#### `FuelType`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| FuelTypeID | INT | PK, AUTO | |
| Code | VARCHAR(10) | NOT NULL, UNIQUE | e.g. DSL |
| Name | NVARCHAR(100) | NOT NULL | |
| IsSecondary | BIT | NOT NULL, DEFAULT 0 | |
| GroupID | INT | FK → Group | |
| SKUID | INT | FK → SKUMaster (Ext) | Links to Inventory SKU |

#### `DocumentType`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| DocumentTypeID | INT | PK, AUTO | |
| Code | VARCHAR(10) | NOT NULL, UNIQUE | |
| Name | NVARCHAR(100) | NOT NULL | |
| ExpirationEnabled | BIT | NOT NULL, DEFAULT 1 | |
| GroupID | INT | FK → Group | |

#### `PurposeCategory`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| PurposeCategoryID | INT | PK, AUTO | |
| Code | VARCHAR(10) | NOT NULL, UNIQUE | |
| Name | NVARCHAR(100) | NOT NULL | |
| Module | NVARCHAR(50) | NULL | ERP module context |
| GroupID | INT | FK → Group | |

#### `LicenseCategory`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| LicenseCategoryID | INT | PK, AUTO | |
| Code | VARCHAR(10) | NOT NULL, UNIQUE | e.g. B, CE |
| Name | NVARCHAR(100) | NOT NULL | |
| GroupID | INT | FK → Group | |

#### `TechCategory`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| TechCategoryID | INT | PK, AUTO | |
| Code | VARCHAR(10) | NOT NULL, UNIQUE | |
| Name | NVARCHAR(100) | NOT NULL | e.g. Mechanic |

---

### Fleet — Vehicle Core

#### `Vehicle` `🔄 Changed`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| VehicleID | INT | PK, AUTO | |
| FixedAssetID | INT | FK → FixedAsset, NULL | 🆕 Links to FA module. NULL until FA record is created. |
| Numbers | VARCHAR(20) | NOT NULL, UNIQUE | Registration plate |
| Brand | NVARCHAR(50) | NOT NULL | |
| Model | NVARCHAR(50) | NOT NULL | |
| GroupID | INT | FK → Group | |
| EstateID | INT | FK → Estate | |
| VehicleTypeID | INT | FK → VehicleType | |
| FixedAssetTypeID | INT | FK → FixedAssetType | |
| FuelTypeID | INT | FK → FuelType | |
| RegisterYear | DATE | NULL | |
| Capacity | VARCHAR(20) | NULL | |
| Status | VARCHAR(20) | NOT NULL | Active / In Service / Maintenance |

> **Removed columns (now in `FixedAsset`):** `CostOfAsset`, `UsefulLifeYears`, `ResidualValue`, `DepreciationValue`.

#### `VehicleDocument`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| VehicleDocumentID | INT | PK, AUTO | |
| VehicleID | INT | FK → Vehicle | |
| DocumentTypeID | INT | FK → DocumentType | |
| DocNumber | VARCHAR(50) | NOT NULL | |
| StartDate | DATE | NULL | |
| ExpireDate | DATE | NULL | |
| Notes | NVARCHAR(500) | NULL | |

#### `VehiclePurposeMapping`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| MappingID | INT | PK, AUTO | |
| VehicleID | INT | FK → Vehicle | |
| PurposeCategoryID | INT | FK → PurposeCategory | |
| EffectiveDate | DATE | NOT NULL | |
| Notes | NVARCHAR(500) | NULL | |

---

### Fleet — Driver & Operations

#### `Driver`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| DriverID | INT | PK, AUTO | |
| Code | VARCHAR(10) | NOT NULL, UNIQUE | |
| EmployeeID | INT | FK → Employee (Ext) | |
| Name | NVARCHAR(150) | NOT NULL | Denormalized |
| LicenseNo | VARCHAR(30) | NOT NULL | |
| LicenseCategoryID | INT | FK → LicenseCategory | |
| LicExpireDate | DATE | NOT NULL | |
| Status | VARCHAR(20) | NOT NULL | |
| Notes | NVARCHAR(500) | NULL | |

#### `DriverAssignment`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| AssignmentID | INT | PK, AUTO | |
| VehicleID | INT | FK → Vehicle | |
| DriverID | INT | FK → Driver | |
| StartDate | DATE | NOT NULL | |
| EndDate | DATE | NULL | NULL = currently active |
| Notes | NVARCHAR(500) | NULL | |

#### `DailyRunning`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| DailyRunningID | INT | PK, AUTO | |
| RefCode | VARCHAR(20) | NOT NULL, UNIQUE | e.g. DR-2024-001 |
| VehicleID | INT | FK → Vehicle | |
| DriverID | INT | FK → Driver | |
| StartDateTime | DATETIME | NOT NULL | |
| EndDateTime | DATETIME | NULL | |
| StartOdo | INT | NOT NULL | km |
| EndOdo | INT | NULL | km |
| Notes | NVARCHAR(500) | NULL | |

---

### Fleet — Technicians

#### `TechAssignment`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| TechAssignmentID | INT | PK, AUTO | |
| EmployeeID | INT | FK → Employee (Ext) | |
| TechCategoryID | INT | FK → TechCategory | |
| Notes | NVARCHAR(500) | NULL | |

#### `WorkshopTechRate`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| WorkshopTechRateID | INT | PK, AUTO | |
| Code | VARCHAR(10) | NOT NULL, UNIQUE | |
| WorkshopID | INT | FK → Workshop | |
| TechCategoryID | INT | FK → TechCategory | |
| RateType | VARCHAR(20) | NOT NULL | Per Task / Per Hour / Per Day |
| RateAmount | DECIMAL(12,2) | NOT NULL | |

---

### Fleet — Maintenance & Service

#### `MaintenanceTask`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| MaintenanceTaskID | INT | PK, AUTO | |
| RefCode | VARCHAR(20) | NOT NULL, UNIQUE | e.g. MT-001 |
| Date | DATE | NOT NULL | |
| VehicleID | INT | FK → Vehicle | |
| WorkshopID | INT | FK → Workshop | |
| Mode | VARCHAR(20) | NOT NULL | Scheduled / Preventive / Breakdown / Inspection |
| TaskType | VARCHAR(20) | NOT NULL | `'Vehicle Service'` \| `'Maintenance'` |
| CostTotal | DECIMAL(12,2) | NOT NULL | |
| Notes | NVARCHAR(1000) | NULL | |

#### `JobCard`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| JobCardID | INT | PK, AUTO | |
| MaintenanceTaskID | INT | FK → MaintenanceTask | |
| VehicleID | INT | FK → Vehicle | Denormalized |
| WorkshopID | INT | FK → Workshop | Denormalized |
| EmployeeID | INT | FK → Employee (Ext) | Assigned technician |
| StartTime | DATETIME | NOT NULL | |
| EndTime | DATETIME | NULL | |
| Description | NVARCHAR(1000) | NULL | |
| CostOfService | DECIMAL(12,2) | NOT NULL | |

#### `MaintenanceRecord`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| MaintenanceRecordID | INT | PK, AUTO | |
| MaintenanceTaskID | INT | FK → MaintenanceTask | Task must have `TaskType = 'Maintenance'` |
| VehicleID | INT | FK → Vehicle | Derived from task |
| WorkshopID | INT | FK → Workshop | Derived from task |
| Date | DATE | NOT NULL | |
| CostOfService | DECIMAL(12,2) | NOT NULL | |
| Description | NVARCHAR(1000) | NULL | |

#### `MaintenanceRecordItem`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| ItemID | INT | PK, AUTO | |
| MaintenanceRecordID | INT | FK → MaintenanceRecord | |
| SKUID | INT | FK → SKUMaster (Ext) | |
| Quantity | DECIMAL(10,3) | NOT NULL | |
| UnitCost | DECIMAL(12,2) | NOT NULL | |
| Source | VARCHAR(20) | NOT NULL | `'Workshop'` \| `'Direct'` |
| ItemIssueRef | VARCHAR(50) | NULL | When Source = 'Direct' |
| HasRemovedItem | BIT | NOT NULL, DEFAULT 0 | |
| RemovedSKUID | INT | FK → SKUMaster (Ext), NULL | |
| RemovedQuantity | DECIMAL(10,3) | NULL | |
| RemovedUnitCost | DECIMAL(12,2) | NULL | 0 = scrapped |

#### `VehicleService`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| VehicleServiceID | INT | PK, AUTO | |
| MaintenanceTaskID | INT | FK → MaintenanceTask, NOT NULL | Task must have `TaskType = 'Vehicle Service'` |
| VehicleID | INT | FK → Vehicle | Derived from task |
| WorkshopID | INT | FK → Workshop | Derived from task |
| ServiceDate | DATE | NOT NULL | |
| Odometer | INT | NOT NULL | km at service |
| NextServiceDate | DATE | NULL | |
| NextServiceOdo | INT | NULL | |
| CostAmount | DECIMAL(12,2) | NOT NULL | |
| Notes | NVARCHAR(1000) | NULL | |

#### `VehicleServiceItem`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| ItemID | INT | PK, AUTO | |
| VehicleServiceID | INT | FK → VehicleService | |
| SKUID | INT | FK → SKUMaster (Ext) | |
| Quantity | DECIMAL(10,3) | NOT NULL | |
| UnitCost | DECIMAL(12,2) | NOT NULL | |
| Source | VARCHAR(20) | NOT NULL | `'Workshop'` \| `'Direct'` |
| ItemIssueRef | VARCHAR(50) | NULL | |
| HasRemovedItem | BIT | NOT NULL, DEFAULT 0 | |
| RemovedSKUID | INT | FK → SKUMaster (Ext), NULL | |
| RemovedQuantity | DECIMAL(10,3) | NULL | |
| RemovedUnitCost | DECIMAL(12,2) | NULL | |

---

### Fleet — Inventory Issuance

#### `ItemIssue`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| ItemIssueID | INT | PK, AUTO | |
| RefCode | VARCHAR(20) | NOT NULL, UNIQUE | e.g. II-2024-001 |
| IssueDate | DATE | NOT NULL | |
| IssueType | VARCHAR(20) | NOT NULL | `'Workshop'` \| `'Vehicle'` |
| TargetID | INT | NOT NULL | WorkshopID or VehicleID |
| Notes | NVARCHAR(500) | NULL | |

#### `ItemIssueItem`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| ItemID | INT | PK, AUTO | |
| ItemIssueID | INT | FK → ItemIssue | |
| SKUID | INT | FK → SKUMaster (Ext) | |
| Quantity | DECIMAL(10,3) | NOT NULL | |
| UnitCost | DECIMAL(12,2) | NOT NULL | |

---

### Fixed Asset — Core

#### `FixedAsset` `🆕 New (FA)`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| FixedAssetID | INT | PK, AUTO | |
| FixedAssetTypeID | INT | FK → FixedAssetType | |
| FixedAssetCategoryID | INT | FK → FixedAssetCategory | |
| FixedAssetCode | VARCHAR(20) | NOT NULL, UNIQUE | |
| FixedAssetName | NVARCHAR(150) | NOT NULL | |
| GroupID | INT | FK → Group | |
| EstateID | INT | FK → Estate | |
| TotalCostOfAsset | DECIMAL(15,2) | NOT NULL | |
| ResidualValue | DECIMAL(15,2) | NOT NULL | |
| ImplementationCost | DECIMAL(15,2) | NULL | Installation / commissioning cost |
| ImplementationDate | DATE | NULL | |
| StartDate | DATE | NOT NULL | Date asset placed in service |
| UsefulLifeYears | INT | NOT NULL | |
| IsFuelNeeded | BIT | NOT NULL, DEFAULT 0 | |
| FuelTypeID | INT | FK → FuelType, NULL | |
| IsWarrantyEnabled | BIT | NOT NULL, DEFAULT 0 | |
| WarrantyStartDate | DATE | NULL | |
| WarrantyEndDate | DATE | NULL | |
| RegistrationNumber | VARCHAR(50) | NULL | e.g. vehicle plate, serial number |
| DepreciationValue | DECIMAL(15,2) | NOT NULL | Annual depreciation amount |
| LedgerTransactionRef | VARCHAR(100) | NULL | ERP ledger reference |

#### `FixedAssetHistory` `🆕 New (FA)`
*Immutable audit snapshot — written on every significant change to a FixedAsset.*

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| FixedAssetHistoryID | INT | PK, AUTO | |
| FixedAssetID | INT | FK → FixedAsset | |
| FixedAssetTypeID | INT | FK → FixedAssetType | Snapshot |
| FixedAssetCategoryID | INT | FK → FixedAssetCategory | Snapshot |
| FixedAssetCode | VARCHAR(20) | NOT NULL | Snapshot |
| FixedAssetName | NVARCHAR(150) | NOT NULL | Snapshot |
| GroupID | INT | FK → Group | |
| EstateID | INT | FK → Estate | |
| TotalCostOfAsset | DECIMAL(15,2) | NOT NULL | Snapshot |
| ResidualValue | DECIMAL(15,2) | NOT NULL | Snapshot |
| ImplementationCost | DECIMAL(15,2) | NULL | Snapshot |
| ImplementationDate | DATE | NULL | |
| StartDate | DATE | NOT NULL | |
| UsefulLifeYears | INT | NOT NULL | Snapshot |
| DepreciationValue | DECIMAL(15,2) | NOT NULL | Snapshot |
| LedgerTransactionRef | VARCHAR(100) | NULL | |
| NewUsefulLifeYears | INT | NULL | Set when life is extended |
| NewResidualValue | DECIMAL(15,2) | NULL | Set when residual changes |
| PresentValue | DECIMAL(15,2) | NULL | Book value at this point |
| NewDepreciationRegisterNo | VARCHAR(50) | NULL | |
| NewDepreciationClaimDate | DATE | NULL | |
| AssetMaintenanceID | INT | FK → AssetMaintenance, NULL | Triggering maintenance event |
| WarrantyClaimDate | DATE | NULL | |

---

### Fixed Asset — Depreciation

#### `Depreciation` `🆕 New (FA)`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| DepreciationID | INT | PK, AUTO | |
| FixedAssetID | INT | FK → FixedAsset | |
| AssetValueDate | DATE | NOT NULL | Starting asset value date |
| AssetValue | DECIMAL(15,2) | NOT NULL | Opening book value |
| UsefulYears | INT | NOT NULL | Remaining useful life |
| ResidualValue | DECIMAL(15,2) | NOT NULL | |
| DepreciationValue | DECIMAL(15,2) | NOT NULL | Annual depreciation |
| GroupID | INT | FK → Group | |
| EstateID | INT | FK → Estate | |

#### `DepreciationHistory` `🆕 New (FA)`
*One row per period (monthly/yearly) depreciation posting.*

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| DepreciationHistoryID | INT | PK, AUTO | |
| DepreciationID | INT | FK → Depreciation | |
| FixedAssetID | INT | FK → FixedAsset | Denormalized |
| Date | DATE | NOT NULL | Posting date |
| Value | DECIMAL(15,2) | NOT NULL | Depreciation amount for period |
| LedgerTransactionRef | VARCHAR(100) | NULL | |
| GroupID | INT | FK → Group | |
| EstateID | INT | FK → Estate | |

---

### Fixed Asset — Maintenance & Estimation

#### `AssetMaintenance` `🆕 New (FA)`
*Financial/accounting record of maintenance — distinct from Fleet's operational `MaintenanceTask`.*

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| AssetMaintenanceID | INT | PK, AUTO | |
| FixedAssetID | INT | FK → FixedAsset | |
| FixedAssetHistoryID | INT | FK → FixedAssetHistory, NULL | Snapshot linked to this event |
| FleetMaintenanceTaskID | INT | FK → MaintenanceTask, NULL | Optional link to Fleet operational task |
| MaintenanceCode | VARCHAR(20) | NOT NULL, UNIQUE | |
| MaintenanceDate | DATE | NOT NULL | |
| TotalMaintenanceCost | DECIMAL(12,2) | NOT NULL | |
| WorkshopID | INT | FK → Workshop | |
| GroupID | INT | FK → Group | |
| EstateID | INT | FK → Estate | |

#### `AssetMaintenanceDetail` `🆕 New (FA)`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| AssetMaintenanceDetailID | INT | PK, AUTO | |
| AssetMaintenanceID | INT | FK → AssetMaintenance | |
| IsEmployeeEnabled | BIT | NOT NULL, DEFAULT 0 | |
| EmployeeID | INT | FK → Employee (Ext), NULL | |
| WorkshopID | INT | FK → Workshop | |
| GroupID | INT | FK → Group | |
| EstateID | INT | FK → Estate | |

#### `AssetMaintenanceCost` `🆕 New (FA)`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| AssetMaintenanceCostID | INT | PK, AUTO | |
| AssetMaintenanceID | INT | FK → AssetMaintenance | |
| FixedAssetID | INT | FK → FixedAsset | Denormalized |
| EstimateCode | VARCHAR(20) | NULL | Links to pre-event Estimation |
| TotalMaintenanceCost | DECIMAL(12,2) | NOT NULL | Actual cost |
| MaintenanceDate | DATE | NOT NULL | |
| WorkshopID | INT | FK → Workshop | |
| GroupID | INT | FK → Group | |
| EstateID | INT | FK → Estate | |

#### `Estimation` `🆕 New (FA)`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| EstimationID | INT | PK, AUTO | |
| FixedAssetID | INT | FK → FixedAsset | |
| EstimateCode | VARCHAR(20) | NOT NULL, UNIQUE | e.g. EST-2024-001 |
| TotalEstimatedCost | DECIMAL(12,2) | NOT NULL | |
| EstimationDate | DATE | NOT NULL | |
| WorkshopID | INT | FK → Workshop | |
| GroupID | INT | FK → Group | |
| EstateID | INT | FK → Estate | |

#### `EstimationDetail` `🆕 New (FA)`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| EstimationDetailID | INT | PK, AUTO | |
| EstimationID | INT | FK → Estimation | |
| FixedAssetID | INT | FK → FixedAsset | Denormalized |
| SKUID | INT | FK → SKUMaster (Ext) | Part / material |
| Quantity | DECIMAL(10,3) | NOT NULL | |
| UnitCost | DECIMAL(12,2) | NOT NULL | |
| EstimatedCost | DECIMAL(12,2) | NOT NULL | Quantity × UnitCost |
| WorkshopID | INT | FK → Workshop | |
| GroupID | INT | FK → Group | |
| EstateID | INT | FK → Estate | |

---

### Fixed Asset — Disposal

#### `DisposalStatusType` `🆕 New (v4)`
*Lookup for disposal workflow statuses. Seeded: Draft, Approved, Completed.*

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| DisposalStatusTypeID | INT | PK, AUTO | |
| Code | VARCHAR(10) | NOT NULL, UNIQUE | e.g. DST001 |
| Name | NVARCHAR(50) | NOT NULL | Draft / Approved / Completed |

#### `Disposal` `🆕 New (v4)`
*Records the end-of-life event for a fixed asset. On save: asset status → `Disposed`; open depreciation schedules → `Closed`; immutable `FixedAssetHistory` snapshot auto-created.*

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| DisposalID | INT | PK, AUTO | |
| DisposalCode | VARCHAR(20) | NOT NULL, UNIQUE | e.g. AD-0001 |
| FixedAssetID | INT | FK → FixedAsset | |
| GroupID | INT | FK → Group | |
| EstateID | INT | FK → Estate | |
| DisposalDate | DATE | NOT NULL | Date the asset was disposed |
| DisposalType | VARCHAR(20) | NOT NULL | `'Sale'` \| `'Write-Off'` \| `'Donation'` \| `'Scrap'` |
| BookValueAtDisposal | DECIMAL(15,2) | NOT NULL | Net book value computed from depreciation at disposal date |
| SaleProceeds | DECIMAL(15,2) | NULL | Populated only when `DisposalType = 'Sale'` |
| GainLossOnDisposal | DECIMAL(15,2) | NULL | `SaleProceeds − BookValueAtDisposal`; NULL for non-sale types |
| DisposalReason | NVARCHAR(1000) | NOT NULL | Mandatory reason / justification |
| ApprovedBy | NVARCHAR(150) | NULL | Approving officer name or employee reference |
| Notes | NVARCHAR(1000) | NULL | |
| DisposalStatusTypeID | INT | FK → DisposalStatusType | Workflow state |

> **Business rules:**
> - `SaleProceeds` and `GainLossOnDisposal` are only meaningful when `DisposalType = 'Sale'`; store `NULL` otherwise.
> - Deleting a `Disposal` record does **not** automatically reverse the `FixedAsset.Status` — a separate status correction workflow is required.

---

## Audit Columns (All Tables)

Every table in both modules carries these five columns. Not present on external tables (`Employee`, `SKUMaster`, `MeasuringUnit`, `WarehouseSKUMapping`).

| Column | Type | Constraints | Behaviour |
|--------|------|-------------|-----------|
| IsActive | BIT | NOT NULL, DEFAULT 1 | Soft-delete flag. `0` = logically deleted. All queries filter `WHERE IsActive = 1`. |
| CreatedBy | INT | NOT NULL, FK → Employee | UserID on INSERT. Never updated. |
| CreatedDate | DATETIME | NOT NULL, DEFAULT GETDATE() | Timestamp on INSERT. Never updated. |
| ModifiedBy | INT | NULL, FK → Employee | UserID on UPDATE or soft-delete. |
| ModifiedDate | DATETIME | NULL | Timestamp on UPDATE or soft-delete. |

| Action | IsActive | ModifiedBy | ModifiedDate |
|--------|----------|------------|--------------|
| Create | `1` | NULL | NULL |
| Edit | `1` | current user | now() |
| Delete (soft) | `0` | current user | now() |

---

## Soft Delete Policy

| Table | Cascades soft-delete to |
|-------|-------------------------|
| `FixedAsset` | FixedAssetHistory, Depreciation, DepreciationHistory, AssetMaintenance → (its children), Estimation → (its children), Disposal |
| `Vehicle` | VehicleDocument, VehiclePurposeMapping, DriverAssignment, DailyRunning, MaintenanceTask → (all children) |
| `MaintenanceTask` | JobCard, MaintenanceRecord + items, VehicleService + items |
| `MaintenanceRecord` | MaintenanceRecordItem |
| `VehicleService` | VehicleServiceItem |
| `AssetMaintenance` | AssetMaintenanceDetail, AssetMaintenanceCost, FixedAssetHistory (linked row) |
| `Estimation` | EstimationDetail |
| `ItemIssue` | ItemIssueItem |
| `WorkshopInventory` | WorkshopInventoryDetail |
| `Driver` | DriverAssignment |
| `Workshop` | WorkshopTechRate, WorkshopInventory → (its details) |
| `Disposal` | No child tables — standalone record. |

---

*Combined from: Fleet Management Schema v2 + Fixed Assets Management ER Diagram (provided) + Fixed Assets Table Structure (provided). Supersedes `fleet-management-schema.md`.*
