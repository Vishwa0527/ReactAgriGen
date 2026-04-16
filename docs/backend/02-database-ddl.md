# AgriGEN ERP — Database DDL (CREATE TABLE Scripts)

**Database:** MSSQL (SQL Server 2019+)  
**Collation:** `SQL_Latin1_General_CP1_CI_AS` (default)  
**Schema:** `dbo`

> Run scripts in the order listed. External tables (`Employee`, `SKUMaster`, `MeasuringUnit`, `WarehouseSKUMapping`) are owned by other ERP modules — they must exist before this module's FK references can be created.

---

## Audit Column Macro

Every table (except external references) ends with these 5 columns. They are shown inline in each CREATE TABLE below.

```sql
IsActive      BIT           NOT NULL CONSTRAINT DF_{Table}_IsActive     DEFAULT(1),
CreatedBy     INT           NOT NULL,                                    -- FK → Employee (not enforced to avoid cross-module FK)
CreatedDate   DATETIME      NOT NULL CONSTRAINT DF_{Table}_CreatedDate   DEFAULT(GETDATE()),
ModifiedBy    INT           NULL,
ModifiedDate  DATETIME      NULL
```

---

## 1. Shared Foundation

```sql
-- ─────────────────────────────────────────────────────────────
-- [Group]  (read-only, managed by core ERP config)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE [dbo].[Group]
(
    GroupID      INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_Group PRIMARY KEY,
    Name         NVARCHAR(150) NOT NULL CONSTRAINT UQ_Group_Name UNIQUE,
    IsActive     BIT           NOT NULL CONSTRAINT DF_Group_IsActive    DEFAULT(1),
    CreatedBy    INT           NOT NULL,
    CreatedDate  DATETIME      NOT NULL CONSTRAINT DF_Group_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy   INT           NULL,
    ModifiedDate DATETIME      NULL
);

-- ─────────────────────────────────────────────────────────────
-- Estate
-- ─────────────────────────────────────────────────────────────
CREATE TABLE [dbo].[Estate]
(
    EstateID     INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_Estate PRIMARY KEY,
    Name         NVARCHAR(150) NOT NULL,
    GroupID      INT           NOT NULL CONSTRAINT FK_Estate_Group REFERENCES [Group](GroupID),
    IsActive     BIT           NOT NULL CONSTRAINT DF_Estate_IsActive    DEFAULT(1),
    CreatedBy    INT           NOT NULL,
    CreatedDate  DATETIME      NOT NULL CONSTRAINT DF_Estate_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy   INT           NULL,
    ModifiedDate DATETIME      NULL
);
```

---

## 2. Shared Classification

```sql
-- ─────────────────────────────────────────────────────────────
-- FixedAssetType  ★ shared by Fleet + Fixed Asset modules
-- ─────────────────────────────────────────────────────────────
CREATE TABLE [dbo].[FixedAssetType]
(
    FixedAssetTypeID INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_FixedAssetType PRIMARY KEY,
    AssetTypeCode    VARCHAR(10)   NOT NULL CONSTRAINT UQ_FixedAssetType_Code UNIQUE,
    AssetTypeName    NVARCHAR(100) NOT NULL,
    [Desc]           NVARCHAR(255) NULL,
    GroupID          INT           NOT NULL CONSTRAINT FK_FixedAssetType_Group  REFERENCES [Group](GroupID),
    EstateID         INT           NULL     CONSTRAINT FK_FixedAssetType_Estate REFERENCES Estate(EstateID),
    IsActive         BIT           NOT NULL CONSTRAINT DF_FixedAssetType_IsActive    DEFAULT(1),
    CreatedBy        INT           NOT NULL,
    CreatedDate      DATETIME      NOT NULL CONSTRAINT DF_FixedAssetType_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy       INT           NULL,
    ModifiedDate     DATETIME      NULL
);

-- ─────────────────────────────────────────────────────────────
-- FixedAssetCategory
-- ─────────────────────────────────────────────────────────────
CREATE TABLE [dbo].[FixedAssetCategory]
(
    FixedAssetCategoryID INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_FixedAssetCategory PRIMARY KEY,
    FixedAssetTypeID     INT           NOT NULL CONSTRAINT FK_FixedAssetCategory_Type  REFERENCES FixedAssetType(FixedAssetTypeID),
    AssetCategoryCode    VARCHAR(10)   NOT NULL,
    AssetCategoryName    NVARCHAR(100) NOT NULL,
    GroupID              INT           NOT NULL CONSTRAINT FK_FixedAssetCategory_Group REFERENCES [Group](GroupID),
    IsActive             BIT           NOT NULL CONSTRAINT DF_FixedAssetCategory_IsActive    DEFAULT(1),
    CreatedBy            INT           NOT NULL,
    CreatedDate          DATETIME      NOT NULL CONSTRAINT DF_FixedAssetCategory_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy           INT           NULL,
    ModifiedDate         DATETIME      NULL
);

-- ─────────────────────────────────────────────────────────────
-- WorkshopCategory
-- ─────────────────────────────────────────────────────────────
CREATE TABLE [dbo].[WorkshopCategory]
(
    WorkshopCategoryID   INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_WorkshopCategory PRIMARY KEY,
    WorkshopCategoryCode VARCHAR(10)   NOT NULL CONSTRAINT UQ_WorkshopCategory_Code UNIQUE,
    WorkshopCategoryName NVARCHAR(100) NOT NULL,
    GroupID              INT           NOT NULL CONSTRAINT FK_WorkshopCategory_Group REFERENCES [Group](GroupID),
    IsActive             BIT           NOT NULL CONSTRAINT DF_WorkshopCategory_IsActive    DEFAULT(1),
    CreatedBy            INT           NOT NULL,
    CreatedDate          DATETIME      NOT NULL CONSTRAINT DF_WorkshopCategory_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy           INT           NULL,
    ModifiedDate         DATETIME      NULL
);
```

---

## 3. Shared Workshop & Inventory

```sql
-- ─────────────────────────────────────────────────────────────
-- Workshop  ★ shared
-- ─────────────────────────────────────────────────────────────
CREATE TABLE [dbo].[Workshop]
(
    WorkshopID          INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_Workshop PRIMARY KEY,
    WorkshopCode        VARCHAR(10)   NOT NULL CONSTRAINT UQ_Workshop_Code UNIQUE,
    WorkshopName        NVARCHAR(100) NOT NULL,
    WorkshopCategoryID  INT           NOT NULL CONSTRAINT FK_Workshop_Category    REFERENCES WorkshopCategory(WorkshopCategoryID),
    FixedAssetTypeID    INT           NOT NULL CONSTRAINT FK_Workshop_AssetType   REFERENCES FixedAssetType(FixedAssetTypeID),
    GroupID             INT           NOT NULL CONSTRAINT FK_Workshop_Group        REFERENCES [Group](GroupID),
    EstateID            INT           NOT NULL CONSTRAINT FK_Workshop_Estate       REFERENCES Estate(EstateID),
    Status              VARCHAR(20)   NOT NULL CONSTRAINT CK_Workshop_Status      CHECK (Status IN ('Active','Inactive')),
    IsActive            BIT           NOT NULL CONSTRAINT DF_Workshop_IsActive    DEFAULT(1),
    CreatedBy           INT           NOT NULL,
    CreatedDate         DATETIME      NOT NULL CONSTRAINT DF_Workshop_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy          INT           NULL,
    ModifiedDate        DATETIME      NULL
);

-- ─────────────────────────────────────────────────────────────
-- WorkshopInventory  (replaces WorkshopStock)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE [dbo].[WorkshopInventory]
(
    WorkshopInventoryID    INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_WorkshopInventory PRIMARY KEY,
    WorkshopID             INT            NOT NULL CONSTRAINT FK_WorkshopInventory_Workshop REFERENCES Workshop(WorkshopID),
    SKUID                  INT            NOT NULL,   -- FK → SKUMaster (external module)
    MeasuringUnitID        INT            NOT NULL,   -- FK → MeasuringUnit (external)
    WarehouseSKUMappingID  INT            NOT NULL,   -- FK → WarehouseSKUMapping (external)
    ReorderLevel           INT            NOT NULL CONSTRAINT DF_WI_ReorderLevel DEFAULT(0),
    AvailableBalance       INT            NOT NULL CONSTRAINT DF_WI_Balance      DEFAULT(0),
    MinLevel               INT            NOT NULL CONSTRAINT DF_WI_MinLevel     DEFAULT(0),
    MaxLevel               INT            NOT NULL CONSTRAINT DF_WI_MaxLevel     DEFAULT(0),
    UnitCost               DECIMAL(12,2)  NOT NULL,
    GroupID                INT            NOT NULL CONSTRAINT FK_WorkshopInventory_Group  REFERENCES [Group](GroupID),
    EstateID               INT            NOT NULL CONSTRAINT FK_WorkshopInventory_Estate REFERENCES Estate(EstateID),
    IsActive               BIT            NOT NULL CONSTRAINT DF_WorkshopInventory_IsActive    DEFAULT(1),
    CreatedBy              INT            NOT NULL,
    CreatedDate            DATETIME       NOT NULL CONSTRAINT DF_WorkshopInventory_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy             INT            NULL,
    ModifiedDate           DATETIME       NULL,
    CONSTRAINT UQ_WorkshopInventory_WorkshopSKU UNIQUE (WorkshopID, SKUID)
);

-- ─────────────────────────────────────────────────────────────
-- WorkshopInventoryDetail  (FIFO batches)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE [dbo].[WorkshopInventoryDetail]
(
    WorkshopInventoryDetailID INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_WorkshopInventoryDetail PRIMARY KEY,
    WorkshopInventoryID       INT           NOT NULL CONSTRAINT FK_WID_Inventory   REFERENCES WorkshopInventory(WorkshopInventoryID),
    WorkshopID                INT           NOT NULL CONSTRAINT FK_WID_Workshop    REFERENCES Workshop(WorkshopID),
    SKUID                     INT           NOT NULL,
    WarehouseSKUMappingID     INT           NOT NULL,
    ItemIssueID               INT           NULL,     -- FK → ItemIssue (set after ItemIssue table exists)
    ItemIssueReference        VARCHAR(50)   NULL,
    Quantity                  DECIMAL(10,3) NOT NULL,
    UnitCost                  DECIMAL(12,2) NOT NULL,
    GroupID                   INT           NOT NULL CONSTRAINT FK_WID_Group  REFERENCES [Group](GroupID),
    EstateID                  INT           NOT NULL CONSTRAINT FK_WID_Estate REFERENCES Estate(EstateID),
    IsActive                  BIT           NOT NULL CONSTRAINT DF_WID_IsActive    DEFAULT(1),
    CreatedBy                 INT           NOT NULL,
    CreatedDate               DATETIME      NOT NULL CONSTRAINT DF_WID_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy                INT           NULL,
    ModifiedDate              DATETIME      NULL
);
```

---

## 4. Fleet Lookup Tables

```sql
-- VehicleType
CREATE TABLE [dbo].[VehicleType]
(
    VehicleTypeID INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_VehicleType PRIMARY KEY,
    Code          VARCHAR(10)   NOT NULL CONSTRAINT UQ_VehicleType_Code UNIQUE,
    Name          NVARCHAR(100) NOT NULL,
    [Desc]        NVARCHAR(255) NULL,
    GroupID       INT           NOT NULL CONSTRAINT FK_VehicleType_Group REFERENCES [Group](GroupID),
    IsActive      BIT           NOT NULL CONSTRAINT DF_VehicleType_IsActive    DEFAULT(1),
    CreatedBy     INT           NOT NULL,
    CreatedDate   DATETIME      NOT NULL CONSTRAINT DF_VehicleType_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy    INT           NULL,
    ModifiedDate  DATETIME      NULL
);

-- FuelType
CREATE TABLE [dbo].[FuelType]
(
    FuelTypeID   INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_FuelType PRIMARY KEY,
    Code         VARCHAR(10)   NOT NULL CONSTRAINT UQ_FuelType_Code UNIQUE,
    Name         NVARCHAR(100) NOT NULL,
    IsSecondary  BIT           NOT NULL CONSTRAINT DF_FuelType_IsSecondary DEFAULT(0),
    GroupID      INT           NOT NULL CONSTRAINT FK_FuelType_Group REFERENCES [Group](GroupID),
    SKUID        INT           NULL,   -- FK → SKUMaster (external)
    IsActive     BIT           NOT NULL CONSTRAINT DF_FuelType_IsActive    DEFAULT(1),
    CreatedBy    INT           NOT NULL,
    CreatedDate  DATETIME      NOT NULL CONSTRAINT DF_FuelType_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy   INT           NULL,
    ModifiedDate DATETIME      NULL
);

-- DocumentType
CREATE TABLE [dbo].[DocumentType]
(
    DocumentTypeID    INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_DocumentType PRIMARY KEY,
    Code              VARCHAR(10)   NOT NULL CONSTRAINT UQ_DocumentType_Code UNIQUE,
    Name              NVARCHAR(100) NOT NULL,
    ExpirationEnabled BIT           NOT NULL CONSTRAINT DF_DocumentType_Expiry DEFAULT(1),
    GroupID           INT           NOT NULL CONSTRAINT FK_DocumentType_Group REFERENCES [Group](GroupID),
    IsActive          BIT           NOT NULL CONSTRAINT DF_DocumentType_IsActive    DEFAULT(1),
    CreatedBy         INT           NOT NULL,
    CreatedDate       DATETIME      NOT NULL CONSTRAINT DF_DocumentType_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy        INT           NULL,
    ModifiedDate      DATETIME      NULL
);

-- PurposeCategory
CREATE TABLE [dbo].[PurposeCategory]
(
    PurposeCategoryID INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_PurposeCategory PRIMARY KEY,
    Code              VARCHAR(10)   NOT NULL CONSTRAINT UQ_PurposeCategory_Code UNIQUE,
    Name              NVARCHAR(100) NOT NULL,
    Module            NVARCHAR(50)  NULL,
    GroupID           INT           NOT NULL CONSTRAINT FK_PurposeCategory_Group REFERENCES [Group](GroupID),
    IsActive          BIT           NOT NULL CONSTRAINT DF_PurposeCategory_IsActive    DEFAULT(1),
    CreatedBy         INT           NOT NULL,
    CreatedDate       DATETIME      NOT NULL CONSTRAINT DF_PurposeCategory_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy        INT           NULL,
    ModifiedDate      DATETIME      NULL
);

-- LicenseCategory
CREATE TABLE [dbo].[LicenseCategory]
(
    LicenseCategoryID INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_LicenseCategory PRIMARY KEY,
    Code              VARCHAR(10)   NOT NULL CONSTRAINT UQ_LicenseCategory_Code UNIQUE,
    Name              NVARCHAR(100) NOT NULL,
    GroupID           INT           NOT NULL CONSTRAINT FK_LicenseCategory_Group REFERENCES [Group](GroupID),
    IsActive          BIT           NOT NULL CONSTRAINT DF_LicenseCategory_IsActive    DEFAULT(1),
    CreatedBy         INT           NOT NULL,
    CreatedDate       DATETIME      NOT NULL CONSTRAINT DF_LicenseCategory_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy        INT           NULL,
    ModifiedDate      DATETIME      NULL
);

-- TechCategory
CREATE TABLE [dbo].[TechCategory]
(
    TechCategoryID INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_TechCategory PRIMARY KEY,
    Code           VARCHAR(10)   NOT NULL CONSTRAINT UQ_TechCategory_Code UNIQUE,
    Name           NVARCHAR(100) NOT NULL,
    IsActive       BIT           NOT NULL CONSTRAINT DF_TechCategory_IsActive    DEFAULT(1),
    CreatedBy      INT           NOT NULL,
    CreatedDate    DATETIME      NOT NULL CONSTRAINT DF_TechCategory_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy     INT           NULL,
    ModifiedDate   DATETIME      NULL
);
```

---

## 5. Fleet — Vehicle Core

```sql
-- ─────────────────────────────────────────────────────────────
-- FixedAsset  (must exist before Vehicle — Vehicle.FixedAssetID FK)
-- ─────────────────────────────────────────────────────────────
-- See §8 Fixed Asset Core below — create FixedAsset first, then Vehicle.

-- Vehicle
CREATE TABLE [dbo].[Vehicle]
(
    VehicleID       INT          NOT NULL IDENTITY(1,1) CONSTRAINT PK_Vehicle PRIMARY KEY,
    FixedAssetID    INT          NULL CONSTRAINT FK_Vehicle_FixedAsset REFERENCES FixedAsset(FixedAssetID),
    Numbers         VARCHAR(20)  NOT NULL CONSTRAINT UQ_Vehicle_Numbers UNIQUE,
    Brand           NVARCHAR(50) NOT NULL,
    Model           NVARCHAR(50) NOT NULL,
    GroupID         INT          NOT NULL CONSTRAINT FK_Vehicle_Group         REFERENCES [Group](GroupID),
    EstateID        INT          NOT NULL CONSTRAINT FK_Vehicle_Estate        REFERENCES Estate(EstateID),
    VehicleTypeID   INT          NOT NULL CONSTRAINT FK_Vehicle_VehicleType   REFERENCES VehicleType(VehicleTypeID),
    FixedAssetTypeID INT         NOT NULL CONSTRAINT FK_Vehicle_AssetType     REFERENCES FixedAssetType(FixedAssetTypeID),
    FuelTypeID      INT          NOT NULL CONSTRAINT FK_Vehicle_FuelType      REFERENCES FuelType(FuelTypeID),
    RegisterYear    DATE         NULL,
    Capacity        VARCHAR(20)  NULL,
    Status          VARCHAR(20)  NOT NULL CONSTRAINT CK_Vehicle_Status CHECK (Status IN ('Active','In Service','Maintenance','Disposed')),
    IsActive        BIT          NOT NULL CONSTRAINT DF_Vehicle_IsActive    DEFAULT(1),
    CreatedBy       INT          NOT NULL,
    CreatedDate     DATETIME     NOT NULL CONSTRAINT DF_Vehicle_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy      INT          NULL,
    ModifiedDate    DATETIME     NULL
);

-- VehicleDocument
CREATE TABLE [dbo].[VehicleDocument]
(
    VehicleDocumentID INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_VehicleDocument PRIMARY KEY,
    VehicleID         INT           NOT NULL CONSTRAINT FK_VehicleDocument_Vehicle      REFERENCES Vehicle(VehicleID),
    DocumentTypeID    INT           NOT NULL CONSTRAINT FK_VehicleDocument_DocumentType REFERENCES DocumentType(DocumentTypeID),
    DocNumber         VARCHAR(50)   NOT NULL,
    StartDate         DATE          NULL,
    ExpireDate        DATE          NULL,
    Notes             NVARCHAR(500) NULL,
    IsActive          BIT           NOT NULL CONSTRAINT DF_VehicleDocument_IsActive    DEFAULT(1),
    CreatedBy         INT           NOT NULL,
    CreatedDate       DATETIME      NOT NULL CONSTRAINT DF_VehicleDocument_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy        INT           NULL,
    ModifiedDate      DATETIME      NULL
);

-- VehiclePurposeMapping
CREATE TABLE [dbo].[VehiclePurposeMapping]
(
    MappingID         INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_VehiclePurposeMapping PRIMARY KEY,
    VehicleID         INT           NOT NULL CONSTRAINT FK_VPM_Vehicle  REFERENCES Vehicle(VehicleID),
    PurposeCategoryID INT           NOT NULL CONSTRAINT FK_VPM_Purpose  REFERENCES PurposeCategory(PurposeCategoryID),
    EffectiveDate     DATE          NOT NULL,
    Notes             NVARCHAR(500) NULL,
    IsActive          BIT           NOT NULL CONSTRAINT DF_VPM_IsActive    DEFAULT(1),
    CreatedBy         INT           NOT NULL,
    CreatedDate       DATETIME      NOT NULL CONSTRAINT DF_VPM_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy        INT           NULL,
    ModifiedDate      DATETIME      NULL
);
```

---

## 6. Fleet — Driver & Operations

```sql
-- Driver
CREATE TABLE [dbo].[Driver]
(
    DriverID          INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_Driver PRIMARY KEY,
    Code              VARCHAR(10)   NOT NULL CONSTRAINT UQ_Driver_Code UNIQUE,
    EmployeeID        INT           NOT NULL,   -- FK → Employee (external)
    Name              NVARCHAR(150) NOT NULL,   -- Denormalized from HR
    LicenseNo         VARCHAR(30)   NOT NULL,
    LicenseCategoryID INT           NOT NULL CONSTRAINT FK_Driver_LicenseCategory REFERENCES LicenseCategory(LicenseCategoryID),
    LicExpireDate     DATE          NOT NULL,
    Status            VARCHAR(20)   NOT NULL CONSTRAINT CK_Driver_Status CHECK (Status IN ('Active','Inactive','Suspended')),
    Notes             NVARCHAR(500) NULL,
    IsActive          BIT           NOT NULL CONSTRAINT DF_Driver_IsActive    DEFAULT(1),
    CreatedBy         INT           NOT NULL,
    CreatedDate       DATETIME      NOT NULL CONSTRAINT DF_Driver_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy        INT           NULL,
    ModifiedDate      DATETIME      NULL
);

-- DriverAssignment
CREATE TABLE [dbo].[DriverAssignment]
(
    AssignmentID INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_DriverAssignment PRIMARY KEY,
    VehicleID    INT           NOT NULL CONSTRAINT FK_DA_Vehicle REFERENCES Vehicle(VehicleID),
    DriverID     INT           NOT NULL CONSTRAINT FK_DA_Driver  REFERENCES Driver(DriverID),
    StartDate    DATE          NOT NULL,
    EndDate      DATE          NULL,   -- NULL = currently active
    Notes        NVARCHAR(500) NULL,
    IsActive     BIT           NOT NULL CONSTRAINT DF_DriverAssignment_IsActive    DEFAULT(1),
    CreatedBy    INT           NOT NULL,
    CreatedDate  DATETIME      NOT NULL CONSTRAINT DF_DriverAssignment_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy   INT           NULL,
    ModifiedDate DATETIME      NULL
);

-- DailyRunning
CREATE TABLE [dbo].[DailyRunning]
(
    DailyRunningID INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_DailyRunning PRIMARY KEY,
    RefCode        VARCHAR(20)   NOT NULL CONSTRAINT UQ_DailyRunning_RefCode UNIQUE,
    VehicleID      INT           NOT NULL CONSTRAINT FK_DR_Vehicle REFERENCES Vehicle(VehicleID),
    DriverID       INT           NOT NULL CONSTRAINT FK_DR_Driver  REFERENCES Driver(DriverID),
    StartDateTime  DATETIME      NOT NULL,
    EndDateTime    DATETIME      NULL,
    StartOdo       INT           NOT NULL,
    EndOdo         INT           NULL,
    Notes          NVARCHAR(500) NULL,
    IsActive       BIT           NOT NULL CONSTRAINT DF_DailyRunning_IsActive    DEFAULT(1),
    CreatedBy      INT           NOT NULL,
    CreatedDate    DATETIME      NOT NULL CONSTRAINT DF_DailyRunning_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy     INT           NULL,
    ModifiedDate   DATETIME      NULL
);
```

---

## 7. Fleet — Technicians & Maintenance

```sql
-- TechAssignment
CREATE TABLE [dbo].[TechAssignment]
(
    TechAssignmentID INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_TechAssignment PRIMARY KEY,
    EmployeeID       INT           NOT NULL,   -- FK → Employee (external)
    TechCategoryID   INT           NOT NULL CONSTRAINT FK_TA_TechCategory REFERENCES TechCategory(TechCategoryID),
    Notes            NVARCHAR(500) NULL,
    IsActive         BIT           NOT NULL CONSTRAINT DF_TechAssignment_IsActive    DEFAULT(1),
    CreatedBy        INT           NOT NULL,
    CreatedDate      DATETIME      NOT NULL CONSTRAINT DF_TechAssignment_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy       INT           NULL,
    ModifiedDate     DATETIME      NULL
);

-- WorkshopTechRate
CREATE TABLE [dbo].[WorkshopTechRate]
(
    WorkshopTechRateID INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_WorkshopTechRate PRIMARY KEY,
    Code               VARCHAR(10)   NOT NULL CONSTRAINT UQ_WTR_Code UNIQUE,
    WorkshopID         INT           NOT NULL CONSTRAINT FK_WTR_Workshop     REFERENCES Workshop(WorkshopID),
    TechCategoryID     INT           NOT NULL CONSTRAINT FK_WTR_TechCategory REFERENCES TechCategory(TechCategoryID),
    RateType           VARCHAR(20)   NOT NULL CONSTRAINT CK_WTR_RateType CHECK (RateType IN ('Per Task','Per Hour','Per Day')),
    RateAmount         DECIMAL(12,2) NOT NULL,
    IsActive           BIT           NOT NULL CONSTRAINT DF_WTR_IsActive    DEFAULT(1),
    CreatedBy          INT           NOT NULL,
    CreatedDate        DATETIME      NOT NULL CONSTRAINT DF_WTR_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy         INT           NULL,
    ModifiedDate       DATETIME      NULL
);

-- MaintenanceTask
CREATE TABLE [dbo].[MaintenanceTask]
(
    MaintenanceTaskID INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_MaintenanceTask PRIMARY KEY,
    RefCode           VARCHAR(20)    NOT NULL CONSTRAINT UQ_MaintenanceTask_RefCode UNIQUE,
    [Date]            DATE           NOT NULL,
    VehicleID         INT            NOT NULL CONSTRAINT FK_MT_Vehicle  REFERENCES Vehicle(VehicleID),
    WorkshopID        INT            NOT NULL CONSTRAINT FK_MT_Workshop REFERENCES Workshop(WorkshopID),
    Mode              VARCHAR(20)    NOT NULL CONSTRAINT CK_MT_Mode CHECK (Mode IN ('Scheduled','Preventive','Breakdown','Inspection')),
    TaskType          VARCHAR(20)    NOT NULL CONSTRAINT CK_MT_TaskType CHECK (TaskType IN ('Vehicle Service','Maintenance')),
    CostTotal         DECIMAL(12,2)  NOT NULL,
    Notes             NVARCHAR(1000) NULL,
    IsActive          BIT            NOT NULL CONSTRAINT DF_MT_IsActive    DEFAULT(1),
    CreatedBy         INT            NOT NULL,
    CreatedDate       DATETIME       NOT NULL CONSTRAINT DF_MT_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy        INT            NULL,
    ModifiedDate      DATETIME       NULL
);

-- JobCard
CREATE TABLE [dbo].[JobCard]
(
    JobCardID         INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_JobCard PRIMARY KEY,
    MaintenanceTaskID INT            NOT NULL CONSTRAINT FK_JC_Task     REFERENCES MaintenanceTask(MaintenanceTaskID),
    VehicleID         INT            NOT NULL CONSTRAINT FK_JC_Vehicle  REFERENCES Vehicle(VehicleID),
    WorkshopID        INT            NOT NULL CONSTRAINT FK_JC_Workshop REFERENCES Workshop(WorkshopID),
    EmployeeID        INT            NOT NULL,   -- FK → Employee (external)
    StartTime         DATETIME       NOT NULL,
    EndTime           DATETIME       NULL,
    Description       NVARCHAR(1000) NULL,
    CostOfService     DECIMAL(12,2)  NOT NULL,
    IsActive          BIT            NOT NULL CONSTRAINT DF_JobCard_IsActive    DEFAULT(1),
    CreatedBy         INT            NOT NULL,
    CreatedDate       DATETIME       NOT NULL CONSTRAINT DF_JobCard_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy        INT            NULL,
    ModifiedDate      DATETIME       NULL
);

-- MaintenanceRecord
CREATE TABLE [dbo].[MaintenanceRecord]
(
    MaintenanceRecordID INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_MaintenanceRecord PRIMARY KEY,
    MaintenanceTaskID   INT            NOT NULL CONSTRAINT FK_MR_Task     REFERENCES MaintenanceTask(MaintenanceTaskID),
    VehicleID           INT            NOT NULL CONSTRAINT FK_MR_Vehicle  REFERENCES Vehicle(VehicleID),
    WorkshopID          INT            NOT NULL CONSTRAINT FK_MR_Workshop REFERENCES Workshop(WorkshopID),
    [Date]              DATE           NOT NULL,
    CostOfService       DECIMAL(12,2)  NOT NULL,
    Description         NVARCHAR(1000) NULL,
    IsActive            BIT            NOT NULL CONSTRAINT DF_MR_IsActive    DEFAULT(1),
    CreatedBy           INT            NOT NULL,
    CreatedDate         DATETIME       NOT NULL CONSTRAINT DF_MR_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy          INT            NULL,
    ModifiedDate        DATETIME       NULL
);

-- MaintenanceRecordItem
CREATE TABLE [dbo].[MaintenanceRecordItem]
(
    ItemID              INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_MaintenanceRecordItem PRIMARY KEY,
    MaintenanceRecordID INT           NOT NULL CONSTRAINT FK_MRI_Record REFERENCES MaintenanceRecord(MaintenanceRecordID),
    SKUID               INT           NOT NULL,
    Quantity            DECIMAL(10,3) NOT NULL,
    UnitCost            DECIMAL(12,2) NOT NULL,
    Source              VARCHAR(20)   NOT NULL CONSTRAINT CK_MRI_Source CHECK (Source IN ('Workshop','Direct')),
    ItemIssueRef        VARCHAR(50)   NULL,
    HasRemovedItem      BIT           NOT NULL CONSTRAINT DF_MRI_HasRemovedItem DEFAULT(0),
    RemovedSKUID        INT           NULL,
    RemovedQuantity     DECIMAL(10,3) NULL,
    RemovedUnitCost     DECIMAL(12,2) NULL,
    IsActive            BIT           NOT NULL CONSTRAINT DF_MRI_IsActive    DEFAULT(1),
    CreatedBy           INT           NOT NULL,
    CreatedDate         DATETIME      NOT NULL CONSTRAINT DF_MRI_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy          INT           NULL,
    ModifiedDate        DATETIME      NULL
);

-- VehicleService
CREATE TABLE [dbo].[VehicleService]
(
    VehicleServiceID  INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_VehicleService PRIMARY KEY,
    MaintenanceTaskID INT            NOT NULL CONSTRAINT FK_VS_Task     REFERENCES MaintenanceTask(MaintenanceTaskID),
    VehicleID         INT            NOT NULL CONSTRAINT FK_VS_Vehicle  REFERENCES Vehicle(VehicleID),
    WorkshopID        INT            NOT NULL CONSTRAINT FK_VS_Workshop REFERENCES Workshop(WorkshopID),
    ServiceDate       DATE           NOT NULL,
    Odometer          INT            NOT NULL,
    NextServiceDate   DATE           NULL,
    NextServiceOdo    INT            NULL,
    CostAmount        DECIMAL(12,2)  NOT NULL,
    Notes             NVARCHAR(1000) NULL,
    IsActive          BIT            NOT NULL CONSTRAINT DF_VS_IsActive    DEFAULT(1),
    CreatedBy         INT            NOT NULL,
    CreatedDate       DATETIME       NOT NULL CONSTRAINT DF_VS_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy        INT            NULL,
    ModifiedDate      DATETIME       NULL
);

-- VehicleServiceItem
CREATE TABLE [dbo].[VehicleServiceItem]
(
    ItemID           INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_VehicleServiceItem PRIMARY KEY,
    VehicleServiceID INT           NOT NULL CONSTRAINT FK_VSI_Service REFERENCES VehicleService(VehicleServiceID),
    SKUID            INT           NOT NULL,
    Quantity         DECIMAL(10,3) NOT NULL,
    UnitCost         DECIMAL(12,2) NOT NULL,
    Source           VARCHAR(20)   NOT NULL CONSTRAINT CK_VSI_Source CHECK (Source IN ('Workshop','Direct')),
    ItemIssueRef     VARCHAR(50)   NULL,
    HasRemovedItem   BIT           NOT NULL CONSTRAINT DF_VSI_HasRemovedItem DEFAULT(0),
    RemovedSKUID     INT           NULL,
    RemovedQuantity  DECIMAL(10,3) NULL,
    RemovedUnitCost  DECIMAL(12,2) NULL,
    IsActive         BIT           NOT NULL CONSTRAINT DF_VSI_IsActive    DEFAULT(1),
    CreatedBy        INT           NOT NULL,
    CreatedDate      DATETIME      NOT NULL CONSTRAINT DF_VSI_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy       INT           NULL,
    ModifiedDate     DATETIME      NULL
);

-- ItemIssue
CREATE TABLE [dbo].[ItemIssue]
(
    ItemIssueID  INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_ItemIssue PRIMARY KEY,
    RefCode      VARCHAR(20)   NOT NULL CONSTRAINT UQ_ItemIssue_RefCode UNIQUE,
    IssueDate    DATE          NOT NULL,
    IssueType    VARCHAR(20)   NOT NULL CONSTRAINT CK_ItemIssue_Type CHECK (IssueType IN ('Workshop','Vehicle')),
    TargetID     INT           NOT NULL,
    Notes        NVARCHAR(500) NULL,
    IsActive     BIT           NOT NULL CONSTRAINT DF_ItemIssue_IsActive    DEFAULT(1),
    CreatedBy    INT           NOT NULL,
    CreatedDate  DATETIME      NOT NULL CONSTRAINT DF_ItemIssue_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy   INT           NULL,
    ModifiedDate DATETIME      NULL
);

-- ItemIssueItem
CREATE TABLE [dbo].[ItemIssueItem]
(
    ItemID      INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_ItemIssueItem PRIMARY KEY,
    ItemIssueID INT           NOT NULL CONSTRAINT FK_III_Issue REFERENCES ItemIssue(ItemIssueID),
    SKUID       INT           NOT NULL,
    Quantity    DECIMAL(10,3) NOT NULL,
    UnitCost    DECIMAL(12,2) NOT NULL,
    IsActive    BIT           NOT NULL CONSTRAINT DF_III_IsActive    DEFAULT(1),
    CreatedBy   INT           NOT NULL,
    CreatedDate DATETIME      NOT NULL CONSTRAINT DF_III_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy  INT           NULL,
    ModifiedDate DATETIME     NULL
);

-- Add deferred FK from WorkshopInventoryDetail → ItemIssue
ALTER TABLE [dbo].[WorkshopInventoryDetail]
    ADD CONSTRAINT FK_WID_ItemIssue FOREIGN KEY (ItemIssueID) REFERENCES ItemIssue(ItemIssueID);
```

---

## 8. Fixed Asset — Core

```sql
-- FixedAsset  (create BEFORE Vehicle so FK can be established)
CREATE TABLE [dbo].[FixedAsset]
(
    FixedAssetID          INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_FixedAsset PRIMARY KEY,
    FixedAssetTypeID      INT            NOT NULL CONSTRAINT FK_FA_Type     REFERENCES FixedAssetType(FixedAssetTypeID),
    FixedAssetCategoryID  INT            NOT NULL CONSTRAINT FK_FA_Category REFERENCES FixedAssetCategory(FixedAssetCategoryID),
    FixedAssetCode        VARCHAR(20)    NOT NULL CONSTRAINT UQ_FixedAsset_Code UNIQUE,
    FixedAssetName        NVARCHAR(150)  NOT NULL,
    GroupID               INT            NOT NULL CONSTRAINT FK_FA_Group    REFERENCES [Group](GroupID),
    EstateID              INT            NOT NULL CONSTRAINT FK_FA_Estate   REFERENCES Estate(EstateID),
    TotalCostOfAsset      DECIMAL(15,2)  NOT NULL,
    ResidualValue         DECIMAL(15,2)  NOT NULL,
    ImplementationCost    DECIMAL(15,2)  NULL,
    ImplementationDate    DATE           NULL,
    StartDate             DATE           NOT NULL,
    UsefulLifeYears       INT            NOT NULL,
    IsFuelNeeded          BIT            NOT NULL CONSTRAINT DF_FA_IsFuelNeeded DEFAULT(0),
    FuelTypeID            INT            NULL CONSTRAINT FK_FA_FuelType REFERENCES FuelType(FuelTypeID),
    IsWarrantyEnabled     BIT            NOT NULL CONSTRAINT DF_FA_IsWarrantyEnabled DEFAULT(0),
    WarrantyStartDate     DATE           NULL,
    WarrantyEndDate       DATE           NULL,
    RegistrationNumber    VARCHAR(50)    NULL,
    DepreciationValue     DECIMAL(15,2)  NOT NULL,
    LedgerTransactionRef  VARCHAR(100)   NULL,
    Status                VARCHAR(20)    NOT NULL CONSTRAINT DF_FA_Status DEFAULT('Active')
                                         CONSTRAINT CK_FA_Status CHECK (Status IN ('Active','In Service','Under Maintenance','Disposed')),
    IsActive              BIT            NOT NULL CONSTRAINT DF_FA_IsActive    DEFAULT(1),
    CreatedBy             INT            NOT NULL,
    CreatedDate           DATETIME       NOT NULL CONSTRAINT DF_FA_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy            INT            NULL,
    ModifiedDate          DATETIME       NULL
);

-- FixedAssetHistory  (immutable snapshots)
CREATE TABLE [dbo].[FixedAssetHistory]
(
    FixedAssetHistoryID      INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_FixedAssetHistory PRIMARY KEY,
    FixedAssetID             INT            NOT NULL CONSTRAINT FK_FAH_Asset     REFERENCES FixedAsset(FixedAssetID),
    FixedAssetTypeID         INT            NOT NULL CONSTRAINT FK_FAH_Type      REFERENCES FixedAssetType(FixedAssetTypeID),
    FixedAssetCategoryID     INT            NOT NULL CONSTRAINT FK_FAH_Category  REFERENCES FixedAssetCategory(FixedAssetCategoryID),
    FixedAssetCode           VARCHAR(20)    NOT NULL,
    FixedAssetName           NVARCHAR(150)  NOT NULL,
    GroupID                  INT            NOT NULL CONSTRAINT FK_FAH_Group  REFERENCES [Group](GroupID),
    EstateID                 INT            NOT NULL CONSTRAINT FK_FAH_Estate REFERENCES Estate(EstateID),
    TotalCostOfAsset         DECIMAL(15,2)  NOT NULL,
    ResidualValue            DECIMAL(15,2)  NOT NULL,
    ImplementationCost       DECIMAL(15,2)  NULL,
    ImplementationDate       DATE           NULL,
    StartDate                DATE           NOT NULL,
    UsefulLifeYears          INT            NOT NULL,
    DepreciationValue        DECIMAL(15,2)  NOT NULL,
    LedgerTransactionRef     VARCHAR(100)   NULL,
    NewUsefulLifeYears       INT            NULL,
    NewResidualValue         DECIMAL(15,2)  NULL,
    PresentValue             DECIMAL(15,2)  NULL,
    NewDepreciationRegisterNo VARCHAR(50)   NULL,
    NewDepreciationClaimDate DATE           NULL,
    AssetMaintenanceID       INT            NULL,   -- FK added after AssetMaintenance table
    WarrantyClaimDate        DATE           NULL,
    EventType                VARCHAR(30)    NOT NULL,  -- 'Created' | 'Updated' | 'Disposal' | 'Maintenance'
    IsActive                 BIT            NOT NULL CONSTRAINT DF_FAH_IsActive    DEFAULT(1),
    CreatedBy                INT            NOT NULL,
    CreatedDate              DATETIME       NOT NULL CONSTRAINT DF_FAH_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy               INT            NULL,
    ModifiedDate             DATETIME       NULL
);
```

---

## 9. Fixed Asset — Depreciation

```sql
-- Depreciation
CREATE TABLE [dbo].[Depreciation]
(
    DepreciationID   INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_Depreciation PRIMARY KEY,
    FixedAssetID     INT            NOT NULL CONSTRAINT FK_Dep_Asset   REFERENCES FixedAsset(FixedAssetID),
    AssetValueDate   DATE           NOT NULL,
    AssetValue       DECIMAL(15,2)  NOT NULL,
    UsefulYears      INT            NOT NULL,
    ResidualValue    DECIMAL(15,2)  NOT NULL,
    DepreciationValue DECIMAL(15,2) NOT NULL,
    GroupID          INT            NOT NULL CONSTRAINT FK_Dep_Group  REFERENCES [Group](GroupID),
    EstateID         INT            NOT NULL CONSTRAINT FK_Dep_Estate REFERENCES Estate(EstateID),
    Status           VARCHAR(10)    NOT NULL CONSTRAINT DF_Dep_Status DEFAULT('Active')
                                    CONSTRAINT CK_Dep_Status CHECK (Status IN ('Active','Closed')),
    IsActive         BIT            NOT NULL CONSTRAINT DF_Dep_IsActive    DEFAULT(1),
    CreatedBy        INT            NOT NULL,
    CreatedDate      DATETIME       NOT NULL CONSTRAINT DF_Dep_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy       INT            NULL,
    ModifiedDate     DATETIME       NULL
);

-- DepreciationHistory
CREATE TABLE [dbo].[DepreciationHistory]
(
    DepreciationHistoryID INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_DepreciationHistory PRIMARY KEY,
    DepreciationID        INT            NOT NULL CONSTRAINT FK_DH_Depreciation REFERENCES Depreciation(DepreciationID),
    FixedAssetID          INT            NOT NULL CONSTRAINT FK_DH_Asset        REFERENCES FixedAsset(FixedAssetID),
    [Date]                DATE           NOT NULL,
    Value                 DECIMAL(15,2)  NOT NULL,
    LedgerTransactionRef  VARCHAR(100)   NULL,
    GroupID               INT            NOT NULL CONSTRAINT FK_DH_Group  REFERENCES [Group](GroupID),
    EstateID              INT            NOT NULL CONSTRAINT FK_DH_Estate REFERENCES Estate(EstateID),
    IsActive              BIT            NOT NULL CONSTRAINT DF_DH_IsActive    DEFAULT(1),
    CreatedBy             INT            NOT NULL,
    CreatedDate           DATETIME       NOT NULL CONSTRAINT DF_DH_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy            INT            NULL,
    ModifiedDate          DATETIME       NULL
);
```

---

## 10. Fixed Asset — Maintenance & Estimation

```sql
-- AssetMaintenance
CREATE TABLE [dbo].[AssetMaintenance]
(
    AssetMaintenanceID     INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_AssetMaintenance PRIMARY KEY,
    FixedAssetID           INT            NOT NULL CONSTRAINT FK_AM_Asset    REFERENCES FixedAsset(FixedAssetID),
    FixedAssetHistoryID    INT            NULL,   -- FK added after FixedAssetHistory exists
    FleetMaintenanceTaskID INT            NULL CONSTRAINT FK_AM_FleetTask REFERENCES MaintenanceTask(MaintenanceTaskID),
    MaintenanceCode        VARCHAR(20)    NOT NULL CONSTRAINT UQ_AM_Code UNIQUE,
    MaintenanceDate        DATE           NOT NULL,
    TotalMaintenanceCost   DECIMAL(12,2)  NOT NULL,
    WorkshopID             INT            NOT NULL CONSTRAINT FK_AM_Workshop REFERENCES Workshop(WorkshopID),
    GroupID                INT            NOT NULL CONSTRAINT FK_AM_Group    REFERENCES [Group](GroupID),
    EstateID               INT            NOT NULL CONSTRAINT FK_AM_Estate   REFERENCES Estate(EstateID),
    Status                 VARCHAR(20)    NOT NULL CONSTRAINT DF_AM_Status   DEFAULT('Open')
                                          CONSTRAINT CK_AM_Status CHECK (Status IN ('Open','Closed')),
    IsActive               BIT            NOT NULL CONSTRAINT DF_AM_IsActive    DEFAULT(1),
    CreatedBy              INT            NOT NULL,
    CreatedDate            DATETIME       NOT NULL CONSTRAINT DF_AM_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy             INT            NULL,
    ModifiedDate           DATETIME       NULL
);

-- Add deferred FKs
ALTER TABLE [dbo].[AssetMaintenance]
    ADD CONSTRAINT FK_AM_FAHistory FOREIGN KEY (FixedAssetHistoryID) REFERENCES FixedAssetHistory(FixedAssetHistoryID);

ALTER TABLE [dbo].[FixedAssetHistory]
    ADD CONSTRAINT FK_FAH_Maintenance FOREIGN KEY (AssetMaintenanceID) REFERENCES AssetMaintenance(AssetMaintenanceID);

-- AssetMaintenanceDetail
CREATE TABLE [dbo].[AssetMaintenanceDetail]
(
    AssetMaintenanceDetailID INT  NOT NULL IDENTITY(1,1) CONSTRAINT PK_AssetMaintenanceDetail PRIMARY KEY,
    AssetMaintenanceID       INT  NOT NULL CONSTRAINT FK_AMD_Maintenance REFERENCES AssetMaintenance(AssetMaintenanceID),
    IsEmployeeEnabled        BIT  NOT NULL CONSTRAINT DF_AMD_IsEmp DEFAULT(0),
    EmployeeID               INT  NULL,
    WorkshopID               INT  NOT NULL CONSTRAINT FK_AMD_Workshop REFERENCES Workshop(WorkshopID),
    GroupID                  INT  NOT NULL CONSTRAINT FK_AMD_Group    REFERENCES [Group](GroupID),
    EstateID                 INT  NOT NULL CONSTRAINT FK_AMD_Estate   REFERENCES Estate(EstateID),
    IsActive                 BIT  NOT NULL CONSTRAINT DF_AMD_IsActive    DEFAULT(1),
    CreatedBy                INT  NOT NULL,
    CreatedDate              DATETIME NOT NULL CONSTRAINT DF_AMD_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy               INT  NULL,
    ModifiedDate             DATETIME NULL
);

-- AssetMaintenanceCost
CREATE TABLE [dbo].[AssetMaintenanceCost]
(
    AssetMaintenanceCostID INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_AssetMaintenanceCost PRIMARY KEY,
    AssetMaintenanceID     INT            NOT NULL CONSTRAINT FK_AMC_Maintenance REFERENCES AssetMaintenance(AssetMaintenanceID),
    FixedAssetID           INT            NOT NULL CONSTRAINT FK_AMC_Asset       REFERENCES FixedAsset(FixedAssetID),
    EstimateCode           VARCHAR(20)    NULL,
    TotalMaintenanceCost   DECIMAL(12,2)  NOT NULL,
    MaintenanceDate        DATE           NOT NULL,
    WorkshopID             INT            NOT NULL CONSTRAINT FK_AMC_Workshop REFERENCES Workshop(WorkshopID),
    GroupID                INT            NOT NULL CONSTRAINT FK_AMC_Group    REFERENCES [Group](GroupID),
    EstateID               INT            NOT NULL CONSTRAINT FK_AMC_Estate   REFERENCES Estate(EstateID),
    IsActive               BIT            NOT NULL CONSTRAINT DF_AMC_IsActive    DEFAULT(1),
    CreatedBy              INT            NOT NULL,
    CreatedDate            DATETIME       NOT NULL CONSTRAINT DF_AMC_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy             INT            NULL,
    ModifiedDate           DATETIME       NULL
);

-- Estimation
CREATE TABLE [dbo].[Estimation]
(
    EstimationID        INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_Estimation PRIMARY KEY,
    FixedAssetID        INT            NOT NULL CONSTRAINT FK_Est_Asset    REFERENCES FixedAsset(FixedAssetID),
    EstimateCode        VARCHAR(20)    NOT NULL CONSTRAINT UQ_Estimation_Code UNIQUE,
    TotalEstimatedCost  DECIMAL(12,2)  NOT NULL,
    EstimationDate      DATE           NOT NULL,
    WorkshopID          INT            NOT NULL CONSTRAINT FK_Est_Workshop REFERENCES Workshop(WorkshopID),
    GroupID             INT            NOT NULL CONSTRAINT FK_Est_Group    REFERENCES [Group](GroupID),
    EstateID            INT            NOT NULL CONSTRAINT FK_Est_Estate   REFERENCES Estate(EstateID),
    Status              VARCHAR(20)    NOT NULL CONSTRAINT DF_Est_Status DEFAULT('Pending')
                                       CONSTRAINT CK_Est_Status CHECK (Status IN ('Pending','Approved','Rejected')),
    IsActive            BIT            NOT NULL CONSTRAINT DF_Est_IsActive    DEFAULT(1),
    CreatedBy           INT            NOT NULL,
    CreatedDate         DATETIME       NOT NULL CONSTRAINT DF_Est_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy          INT            NULL,
    ModifiedDate        DATETIME       NULL
);

-- EstimationDetail
CREATE TABLE [dbo].[EstimationDetail]
(
    EstimationDetailID INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_EstimationDetail PRIMARY KEY,
    EstimationID       INT            NOT NULL CONSTRAINT FK_ED_Estimation REFERENCES Estimation(EstimationID),
    FixedAssetID       INT            NOT NULL CONSTRAINT FK_ED_Asset      REFERENCES FixedAsset(FixedAssetID),
    SKUID              INT            NOT NULL,
    Quantity           DECIMAL(10,3)  NOT NULL,
    UnitCost           DECIMAL(12,2)  NOT NULL,
    EstimatedCost      DECIMAL(12,2)  NOT NULL,
    WorkshopID         INT            NOT NULL CONSTRAINT FK_ED_Workshop REFERENCES Workshop(WorkshopID),
    GroupID            INT            NOT NULL CONSTRAINT FK_ED_Group    REFERENCES [Group](GroupID),
    EstateID           INT            NOT NULL CONSTRAINT FK_ED_Estate   REFERENCES Estate(EstateID),
    IsActive           BIT            NOT NULL CONSTRAINT DF_ED_IsActive    DEFAULT(1),
    CreatedBy          INT            NOT NULL,
    CreatedDate        DATETIME       NOT NULL CONSTRAINT DF_ED_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy         INT            NULL,
    ModifiedDate       DATETIME       NULL
);
```

---

## 11. Fixed Asset — Disposal

```sql
-- DisposalStatusType (seed data: Draft, Approved, Completed)
CREATE TABLE [dbo].[DisposalStatusType]
(
    DisposalStatusTypeID INT          NOT NULL IDENTITY(1,1) CONSTRAINT PK_DisposalStatusType PRIMARY KEY,
    Code                 VARCHAR(10)  NOT NULL CONSTRAINT UQ_DST_Code UNIQUE,
    Name                 NVARCHAR(50) NOT NULL,
    IsActive             BIT          NOT NULL CONSTRAINT DF_DST_IsActive    DEFAULT(1),
    CreatedBy            INT          NOT NULL,
    CreatedDate          DATETIME     NOT NULL CONSTRAINT DF_DST_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy           INT          NULL,
    ModifiedDate         DATETIME     NULL
);

-- Seed data
INSERT INTO DisposalStatusType (Code, Name, CreatedBy) VALUES
    ('DST-001', 'Draft',     1),
    ('DST-002', 'Approved',  1),
    ('DST-003', 'Completed', 1);

-- Disposal
CREATE TABLE [dbo].[Disposal]
(
    DisposalID           INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_Disposal PRIMARY KEY,
    DisposalCode         VARCHAR(20)    NOT NULL CONSTRAINT UQ_Disposal_Code UNIQUE,
    FixedAssetID         INT            NOT NULL CONSTRAINT FK_Disposal_Asset   REFERENCES FixedAsset(FixedAssetID),
    GroupID              INT            NOT NULL CONSTRAINT FK_Disposal_Group   REFERENCES [Group](GroupID),
    EstateID             INT            NOT NULL CONSTRAINT FK_Disposal_Estate  REFERENCES Estate(EstateID),
    DisposalDate         DATE           NOT NULL,
    DisposalType         VARCHAR(20)    NOT NULL CONSTRAINT CK_Disposal_Type CHECK (DisposalType IN ('Sale','Write-Off','Donation','Scrap')),
    BookValueAtDisposal  DECIMAL(15,2)  NOT NULL,
    SaleProceeds         DECIMAL(15,2)  NULL,
    GainLossOnDisposal   DECIMAL(15,2)  NULL,
    DisposalReason       NVARCHAR(1000) NOT NULL,
    ApprovedBy           NVARCHAR(150)  NULL,
    Notes                NVARCHAR(1000) NULL,
    DisposalStatusTypeID INT            NOT NULL CONSTRAINT FK_Disposal_StatusType REFERENCES DisposalStatusType(DisposalStatusTypeID),
    IsActive             BIT            NOT NULL CONSTRAINT DF_Disposal_IsActive    DEFAULT(1),
    CreatedBy            INT            NOT NULL,
    CreatedDate          DATETIME       NOT NULL CONSTRAINT DF_Disposal_CreatedDate DEFAULT(GETDATE()),
    ModifiedBy           INT            NULL,
    ModifiedDate         DATETIME       NULL
);
```

---

## 12. Indexes

```sql
-- High-traffic lookup indexes
CREATE INDEX IX_Vehicle_EstateID       ON Vehicle(EstateID)       WHERE IsActive = 1;
CREATE INDEX IX_Vehicle_Status         ON Vehicle(Status)          WHERE IsActive = 1;
CREATE INDEX IX_Vehicle_FixedAssetID   ON Vehicle(FixedAssetID)    WHERE IsActive = 1;

CREATE INDEX IX_DriverAssignment_VehicleID  ON DriverAssignment(VehicleID) WHERE IsActive = 1 AND EndDate IS NULL;
CREATE INDEX IX_DriverAssignment_DriverID   ON DriverAssignment(DriverID)  WHERE IsActive = 1;

CREATE INDEX IX_VehicleDocument_VehicleID   ON VehicleDocument(VehicleID)  WHERE IsActive = 1;
CREATE INDEX IX_VehicleDocument_ExpireDate  ON VehicleDocument(ExpireDate)  WHERE IsActive = 1;

CREATE INDEX IX_FixedAsset_EstateID         ON FixedAsset(EstateID)         WHERE IsActive = 1;
CREATE INDEX IX_FixedAsset_Status           ON FixedAsset(Status)            WHERE IsActive = 1;
CREATE INDEX IX_FixedAssetHistory_AssetID   ON FixedAssetHistory(FixedAssetID);

CREATE INDEX IX_Depreciation_AssetID        ON Depreciation(FixedAssetID)   WHERE IsActive = 1;
CREATE INDEX IX_DepreciationHistory_AssetID ON DepreciationHistory(FixedAssetID);

CREATE INDEX IX_AssetMaintenance_AssetID    ON AssetMaintenance(FixedAssetID) WHERE IsActive = 1;
CREATE INDEX IX_Disposal_AssetID            ON Disposal(FixedAssetID)          WHERE IsActive = 1;

CREATE INDEX IX_MaintenanceTask_VehicleID   ON MaintenanceTask(VehicleID)    WHERE IsActive = 1;
CREATE INDEX IX_DailyRunning_VehicleID      ON DailyRunning(VehicleID)       WHERE IsActive = 1;
CREATE INDEX IX_DailyRunning_DriverID       ON DailyRunning(DriverID)        WHERE IsActive = 1;
```
