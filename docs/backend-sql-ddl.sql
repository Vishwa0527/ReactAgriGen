-- ============================================================
-- AgriGEN ERP — Fleet & Fixed Asset Management
-- MSSQL DDL Script — Full Schema v4
-- Database: MSSQL (SQL Server 2019+)
-- Last Updated: 2026-04-15
-- ============================================================
-- NOTE: Every table includes these 5 audit columns (defined once here):
--   IsActive      BIT           NOT NULL DEFAULT 1
--   CreatedBy     NVARCHAR(100) NOT NULL DEFAULT ''
--   CreatedDate   DATETIME2     NOT NULL DEFAULT GETUTCDATE()
--   ModifiedBy    NVARCHAR(100) NULL
--   ModifiedDate  DATETIME2     NULL
-- ============================================================

USE [AgriGENERP];
GO

-- ============================================================
-- SHARED FOUNDATION
-- ============================================================

CREATE TABLE [dbo].[Group] (
    GroupID      INT           IDENTITY(1,1) PRIMARY KEY,
    Name         NVARCHAR(150) NOT NULL,
    CONSTRAINT UQ_Group_Name UNIQUE (Name),
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL
);
GO

CREATE TABLE [dbo].[Estate] (
    EstateID     INT           IDENTITY(1,1) PRIMARY KEY,
    Name         NVARCHAR(150) NOT NULL,
    GroupID      INT           NOT NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_Estate_Group FOREIGN KEY (GroupID) REFERENCES [Group](GroupID)
);
GO

-- ============================================================
-- SHARED CLASSIFICATION
-- ============================================================

CREATE TABLE [dbo].[FixedAssetType] (
    FixedAssetTypeID  INT           IDENTITY(1,1) PRIMARY KEY,
    AssetTypeCode     VARCHAR(10)   NOT NULL,
    AssetTypeName     NVARCHAR(100) NOT NULL,
    [Desc]            NVARCHAR(255) NULL,
    GroupID           INT           NOT NULL,
    EstateID          INT           NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT UQ_FixedAssetType_Code UNIQUE (AssetTypeCode),
    CONSTRAINT FK_FixedAssetType_Group  FOREIGN KEY (GroupID)  REFERENCES [Group](GroupID),
    CONSTRAINT FK_FixedAssetType_Estate FOREIGN KEY (EstateID) REFERENCES [Estate](EstateID)
);
GO

CREATE TABLE [dbo].[FixedAssetCategory] (
    FixedAssetCategoryID  INT           IDENTITY(1,1) PRIMARY KEY,
    FixedAssetTypeID      INT           NOT NULL,
    AssetCategoryCode     VARCHAR(10)   NOT NULL,
    AssetCategoryName     NVARCHAR(150) NOT NULL,
    GroupID               INT           NOT NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_FixedAssetCategory_Type  FOREIGN KEY (FixedAssetTypeID)  REFERENCES [FixedAssetType](FixedAssetTypeID),
    CONSTRAINT FK_FixedAssetCategory_Group FOREIGN KEY (GroupID)            REFERENCES [Group](GroupID)
);
GO

CREATE TABLE [dbo].[WorkshopCategory] (
    WorkshopCategoryID    INT           IDENTITY(1,1) PRIMARY KEY,
    WorkshopCategoryCode  VARCHAR(10)   NOT NULL,
    WorkshopCategoryName  NVARCHAR(150) NOT NULL,
    GroupID               INT           NOT NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_WorkshopCategory_Group FOREIGN KEY (GroupID) REFERENCES [Group](GroupID)
);
GO

-- ============================================================
-- SHARED WORKSHOP & INVENTORY
-- ============================================================

CREATE TABLE [dbo].[Workshop] (
    WorkshopID            INT           IDENTITY(1,1) PRIMARY KEY,
    WorkshopCode          VARCHAR(20)   NOT NULL,
    WorkshopName          NVARCHAR(150) NOT NULL,
    WorkshopCategoryID    INT           NOT NULL,
    FixedAssetTypeID      INT           NULL,
    GroupID               INT           NOT NULL,
    EstateID              INT           NOT NULL,
    [Status]              NVARCHAR(50)  NOT NULL DEFAULT 'Active',
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT UQ_Workshop_Code UNIQUE (WorkshopCode),
    CONSTRAINT FK_Workshop_Category      FOREIGN KEY (WorkshopCategoryID) REFERENCES [WorkshopCategory](WorkshopCategoryID),
    CONSTRAINT FK_Workshop_AssetType     FOREIGN KEY (FixedAssetTypeID)   REFERENCES [FixedAssetType](FixedAssetTypeID),
    CONSTRAINT FK_Workshop_Group         FOREIGN KEY (GroupID)             REFERENCES [Group](GroupID),
    CONSTRAINT FK_Workshop_Estate        FOREIGN KEY (EstateID)            REFERENCES [Estate](EstateID)
);
GO

CREATE TABLE [dbo].[WorkshopInventory] (
    WorkshopInventoryID    INT           IDENTITY(1,1) PRIMARY KEY,
    WorkshopID             INT           NOT NULL,
    SKUID                  INT           NOT NULL,  -- FK → Inventory.SKUMaster
    MeasuringUnitID        INT           NULL,
    WarehouseSKUMappingID  INT           NULL,
    ReorderLevel           INT           NOT NULL DEFAULT 0,
    AvailableBalance       INT           NOT NULL DEFAULT 0,
    MinLevel               INT           NOT NULL DEFAULT 0,
    MaxLevel               INT           NOT NULL DEFAULT 0,
    UnitCost               DECIMAL(18,4) NOT NULL DEFAULT 0,
    GroupID                INT           NOT NULL,
    EstateID               INT           NOT NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_WorkshopInventory_Workshop FOREIGN KEY (WorkshopID) REFERENCES [Workshop](WorkshopID)
);
GO

CREATE TABLE [dbo].[WorkshopInventoryDetail] (
    WorkshopInventoryDetailID  INT           IDENTITY(1,1) PRIMARY KEY,
    WorkshopInventoryID        INT           NOT NULL,
    WorkshopID                 INT           NOT NULL,
    SKUID                      INT           NOT NULL,
    WarehouseSKUMappingID      INT           NULL,
    ItemIssueID                INT           NULL,
    ItemIssueReference         NVARCHAR(50)  NULL,
    Quantity                   DECIMAL(18,4) NOT NULL DEFAULT 0,
    UnitCost                   DECIMAL(18,4) NOT NULL DEFAULT 0,
    GroupID                    INT           NOT NULL,
    EstateID                   INT           NOT NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_WorkshopInventoryDetail_Inventory FOREIGN KEY (WorkshopInventoryID) REFERENCES [WorkshopInventory](WorkshopInventoryID),
    CONSTRAINT FK_WorkshopInventoryDetail_Workshop  FOREIGN KEY (WorkshopID)          REFERENCES [Workshop](WorkshopID)
);
GO

-- ============================================================
-- FLEET — LOOKUP TABLES
-- ============================================================

CREATE TABLE [dbo].[VehicleType] (
    VehicleTypeID  INT           IDENTITY(1,1) PRIMARY KEY,
    Code           VARCHAR(10)   NOT NULL,
    Name           NVARCHAR(100) NOT NULL,
    GroupID        INT           NOT NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_VehicleType_Group FOREIGN KEY (GroupID) REFERENCES [Group](GroupID)
);
GO

CREATE TABLE [dbo].[FuelType] (
    FuelTypeID   INT           IDENTITY(1,1) PRIMARY KEY,
    Code         VARCHAR(10)   NOT NULL,
    Name         NVARCHAR(100) NOT NULL,
    IsSecondary  BIT           NOT NULL DEFAULT 0,
    GroupID      INT           NOT NULL,
    SKUID        INT           NULL,  -- FK → Inventory.SKUMaster
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_FuelType_Group FOREIGN KEY (GroupID) REFERENCES [Group](GroupID)
);
GO

CREATE TABLE [dbo].[DocumentType] (
    DocumentTypeID      INT           IDENTITY(1,1) PRIMARY KEY,
    Code                VARCHAR(10)   NOT NULL,
    Name                NVARCHAR(100) NOT NULL,
    ExpirationEnabled   BIT           NOT NULL DEFAULT 1,
    GroupID             INT           NOT NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_DocumentType_Group FOREIGN KEY (GroupID) REFERENCES [Group](GroupID)
);
GO

CREATE TABLE [dbo].[PurposeCategory] (
    PurposeCategoryID  INT           IDENTITY(1,1) PRIMARY KEY,
    Code               VARCHAR(10)   NOT NULL,
    Name               NVARCHAR(100) NOT NULL,
    Module             NVARCHAR(50)  NULL,
    GroupID            INT           NOT NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_PurposeCategory_Group FOREIGN KEY (GroupID) REFERENCES [Group](GroupID)
);
GO

CREATE TABLE [dbo].[LicenseCategory] (
    LicenseCategoryID  INT           IDENTITY(1,1) PRIMARY KEY,
    Code               VARCHAR(10)   NOT NULL,
    Name               NVARCHAR(100) NOT NULL,
    GroupID            INT           NOT NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_LicenseCategory_Group FOREIGN KEY (GroupID) REFERENCES [Group](GroupID)
);
GO

CREATE TABLE [dbo].[TechCategory] (
    TechCategoryID  INT           IDENTITY(1,1) PRIMARY KEY,
    Code            VARCHAR(10)   NOT NULL,
    Name            NVARCHAR(100) NOT NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL
);
GO

-- ============================================================
-- FLEET — VEHICLE CORE
-- ============================================================

CREATE TABLE [dbo].[Vehicle] (
    VehicleID          INT           IDENTITY(1,1) PRIMARY KEY,
    FixedAssetID       INT           NULL,          -- FK → FixedAsset (added after FixedAsset table)
    Numbers            NVARCHAR(30)  NOT NULL,      -- Plate / registration number
    Brand              NVARCHAR(100) NOT NULL,
    Model              NVARCHAR(100) NOT NULL,
    GroupID            INT           NOT NULL,
    EstateID           INT           NOT NULL,
    VehicleTypeID      INT           NOT NULL,
    FixedAssetTypeID   INT           NOT NULL,
    FuelTypeID         INT           NOT NULL,
    SecondaryFuelTypeID INT          NULL,
    RegisterYear       DATE          NULL,
    Capacity           NVARCHAR(50)  NULL,
    [Status]           NVARCHAR(50)  NOT NULL DEFAULT 'Active',
    CostOfAsset        DECIMAL(18,2) NOT NULL DEFAULT 0,
    UsefulLifeYears    INT           NOT NULL DEFAULT 0,
    ResidualValue      DECIMAL(18,2) NOT NULL DEFAULT 0,
    DepreciationValue  DECIMAL(18,2) NOT NULL DEFAULT 0,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_Vehicle_Group       FOREIGN KEY (GroupID)             REFERENCES [Group](GroupID),
    CONSTRAINT FK_Vehicle_Estate      FOREIGN KEY (EstateID)            REFERENCES [Estate](EstateID),
    CONSTRAINT FK_Vehicle_VehicleType FOREIGN KEY (VehicleTypeID)       REFERENCES [VehicleType](VehicleTypeID),
    CONSTRAINT FK_Vehicle_AssetType   FOREIGN KEY (FixedAssetTypeID)    REFERENCES [FixedAssetType](FixedAssetTypeID),
    CONSTRAINT FK_Vehicle_FuelType    FOREIGN KEY (FuelTypeID)          REFERENCES [FuelType](FuelTypeID),
    CONSTRAINT FK_Vehicle_FuelType2   FOREIGN KEY (SecondaryFuelTypeID) REFERENCES [FuelType](FuelTypeID)
);
GO

CREATE TABLE [dbo].[VehicleHistory] (
    VehicleHistoryID  INT            IDENTITY(1,1) PRIMARY KEY,
    VehicleID         INT            NOT NULL,
    Action            NVARCHAR(50)   NOT NULL,   -- 'Created' | 'Updated'
    [Timestamp]       DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    Snapshot          NVARCHAR(MAX)  NOT NULL,   -- JSON blob of the Vehicle at time of change
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_VehicleHistory_Vehicle FOREIGN KEY (VehicleID) REFERENCES [Vehicle](VehicleID)
);
GO

CREATE TABLE [dbo].[VehicleDocument] (
    VehicleDocumentID  INT           IDENTITY(1,1) PRIMARY KEY,
    VehicleID          INT           NOT NULL,
    DocumentTypeID     INT           NOT NULL,
    DocNumber          NVARCHAR(100) NOT NULL,
    StartDate          DATE          NULL,
    ExpireDate         DATE          NULL,
    Notes              NVARCHAR(500) NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_VehicleDocument_Vehicle      FOREIGN KEY (VehicleID)      REFERENCES [Vehicle](VehicleID),
    CONSTRAINT FK_VehicleDocument_DocumentType FOREIGN KEY (DocumentTypeID) REFERENCES [DocumentType](DocumentTypeID)
);
GO

CREATE TABLE [dbo].[VehiclePurposeMapping] (
    MappingID          INT           IDENTITY(1,1) PRIMARY KEY,
    VehicleID          INT           NOT NULL,
    PurposeCategoryID  INT           NOT NULL,
    EffectiveDate      DATE          NOT NULL,
    Notes              NVARCHAR(500) NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_VehiclePurpose_Vehicle  FOREIGN KEY (VehicleID)         REFERENCES [Vehicle](VehicleID),
    CONSTRAINT FK_VehiclePurpose_Category FOREIGN KEY (PurposeCategoryID) REFERENCES [PurposeCategory](PurposeCategoryID)
);
GO

-- ============================================================
-- FLEET — DRIVER & OPERATIONS
-- ============================================================

CREATE TABLE [dbo].[Driver] (
    DriverID            INT           IDENTITY(1,1) PRIMARY KEY,
    Code                VARCHAR(20)   NOT NULL,
    EmployeeID          INT           NOT NULL,   -- FK → HR.Employee
    Name                NVARCHAR(150) NOT NULL,
    LicenseNo           NVARCHAR(50)  NOT NULL,
    LicenseCategoryID   INT           NOT NULL,
    LicExpireDate       DATE          NULL,
    [Status]            NVARCHAR(50)  NOT NULL DEFAULT 'Active',
    Notes               NVARCHAR(500) NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_Driver_LicenseCategory FOREIGN KEY (LicenseCategoryID) REFERENCES [LicenseCategory](LicenseCategoryID)
);
GO

CREATE TABLE [dbo].[DriverAssignment] (
    AssignmentID  INT           IDENTITY(1,1) PRIMARY KEY,
    VehicleID     INT           NOT NULL,
    DriverID      INT           NOT NULL,
    StartDate     DATE          NOT NULL,
    EndDate       DATE          NULL,
    Notes         NVARCHAR(500) NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_DriverAssignment_Vehicle FOREIGN KEY (VehicleID) REFERENCES [Vehicle](VehicleID),
    CONSTRAINT FK_DriverAssignment_Driver  FOREIGN KEY (DriverID)  REFERENCES [Driver](DriverID)
);
GO

CREATE TABLE [dbo].[DailyRunning] (
    DailyRunningID  INT           IDENTITY(1,1) PRIMARY KEY,
    RefCode         NVARCHAR(30)  NOT NULL,
    VehicleID       INT           NOT NULL,
    DriverID        INT           NOT NULL,
    StartDateTime   DATETIME2     NOT NULL,
    EndDateTime     DATETIME2     NULL,
    StartOdo        INT           NOT NULL DEFAULT 0,
    EndOdo          INT           NULL,
    Notes           NVARCHAR(500) NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_DailyRunning_Vehicle FOREIGN KEY (VehicleID) REFERENCES [Vehicle](VehicleID),
    CONSTRAINT FK_DailyRunning_Driver  FOREIGN KEY (DriverID)  REFERENCES [Driver](DriverID)
);
GO

-- ============================================================
-- FLEET — TECHNICIANS
-- ============================================================

CREATE TABLE [dbo].[TechAssignment] (
    TechAssignmentID  INT           IDENTITY(1,1) PRIMARY KEY,
    EmployeeID        INT           NOT NULL,   -- FK → HR.Employee
    TechCategoryID    INT           NOT NULL,
    Notes             NVARCHAR(500) NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_TechAssignment_Category FOREIGN KEY (TechCategoryID) REFERENCES [TechCategory](TechCategoryID)
);
GO

CREATE TABLE [dbo].[WorkshopTechRate] (
    WorkshopTechRateID  INT           IDENTITY(1,1) PRIMARY KEY,
    Code                VARCHAR(20)   NOT NULL,
    WorkshopID          INT           NOT NULL,
    TechCategoryID      INT           NOT NULL,
    RateType            NVARCHAR(50)  NOT NULL,   -- 'Hourly' | 'Daily' | 'Fixed'
    RateAmount          DECIMAL(18,2) NOT NULL DEFAULT 0,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_WorkshopTechRate_Workshop  FOREIGN KEY (WorkshopID)     REFERENCES [Workshop](WorkshopID),
    CONSTRAINT FK_WorkshopTechRate_Category  FOREIGN KEY (TechCategoryID) REFERENCES [TechCategory](TechCategoryID)
);
GO

-- ============================================================
-- FLEET — MAINTENANCE & SERVICE
-- ============================================================

CREATE TABLE [dbo].[MaintenanceTask] (
    MaintenanceTaskID  INT           IDENTITY(1,1) PRIMARY KEY,
    RefCode            NVARCHAR(30)  NOT NULL,
    [Date]             DATE          NOT NULL,
    VehicleID          INT           NOT NULL,
    WorkshopID         INT           NOT NULL,
    Mode               NVARCHAR(50)  NULL,        -- 'Scheduled' | 'Emergency'
    TaskType           VARCHAR(20)   NOT NULL,    -- 'Vehicle Service' | 'Maintenance'
    CostTotal          DECIMAL(18,2) NOT NULL DEFAULT 0,
    Notes              NVARCHAR(MAX) NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_MaintenanceTask_Vehicle  FOREIGN KEY (VehicleID)  REFERENCES [Vehicle](VehicleID),
    CONSTRAINT FK_MaintenanceTask_Workshop FOREIGN KEY (WorkshopID) REFERENCES [Workshop](WorkshopID)
);
GO

CREATE TABLE [dbo].[JobCard] (
    JobCardID          INT           IDENTITY(1,1) PRIMARY KEY,
    MaintenanceTaskID  INT           NOT NULL,
    VehicleID          INT           NOT NULL,
    WorkshopID         INT           NOT NULL,
    EmployeeID         INT           NOT NULL,   -- FK → HR.Employee (Technician)
    StartTime          DATETIME2     NULL,
    EndTime            DATETIME2     NULL,
    [Description]      NVARCHAR(MAX) NULL,
    CostOfService      DECIMAL(18,2) NOT NULL DEFAULT 0,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_JobCard_Task     FOREIGN KEY (MaintenanceTaskID) REFERENCES [MaintenanceTask](MaintenanceTaskID),
    CONSTRAINT FK_JobCard_Vehicle  FOREIGN KEY (VehicleID)         REFERENCES [Vehicle](VehicleID),
    CONSTRAINT FK_JobCard_Workshop FOREIGN KEY (WorkshopID)        REFERENCES [Workshop](WorkshopID)
);
GO

CREATE TABLE [dbo].[MaintenanceRecord] (
    MaintenanceRecordID  INT           IDENTITY(1,1) PRIMARY KEY,
    MaintenanceTaskID    INT           NOT NULL,
    VehicleID            INT           NOT NULL,
    WorkshopID           INT           NOT NULL,
    [Date]               DATE          NOT NULL,
    CostOfService        DECIMAL(18,2) NOT NULL DEFAULT 0,
    [Description]        NVARCHAR(MAX) NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_MaintenanceRecord_Task     FOREIGN KEY (MaintenanceTaskID) REFERENCES [MaintenanceTask](MaintenanceTaskID),
    CONSTRAINT FK_MaintenanceRecord_Vehicle  FOREIGN KEY (VehicleID)         REFERENCES [Vehicle](VehicleID),
    CONSTRAINT FK_MaintenanceRecord_Workshop FOREIGN KEY (WorkshopID)        REFERENCES [Workshop](WorkshopID)
);
GO

CREATE TABLE [dbo].[MaintenanceRecordItem] (
    ItemID                INT           IDENTITY(1,1) PRIMARY KEY,
    MaintenanceRecordID   INT           NOT NULL,
    SKUID                 INT           NOT NULL,  -- FK → Inventory.SKUMaster
    Quantity              DECIMAL(18,4) NOT NULL DEFAULT 0,
    UnitCost              DECIMAL(18,4) NOT NULL DEFAULT 0,
    Source                NVARCHAR(100) NULL,
    ItemIssueRef          NVARCHAR(50)  NULL,
    HasRemovedItem        BIT           NOT NULL DEFAULT 0,
    RemovedSKUID          INT           NULL,
    RemovedQuantity       DECIMAL(18,4) NULL,
    RemovedUnitCost       DECIMAL(18,4) NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_MaintenanceRecordItem_Record FOREIGN KEY (MaintenanceRecordID) REFERENCES [MaintenanceRecord](MaintenanceRecordID)
);
GO

CREATE TABLE [dbo].[VehicleService] (
    VehicleServiceID   INT           IDENTITY(1,1) PRIMARY KEY,
    MaintenanceTaskID  INT           NOT NULL,
    VehicleID          INT           NOT NULL,
    WorkshopID         INT           NOT NULL,
    ServiceDate        DATE          NOT NULL,
    Odometer           INT           NOT NULL DEFAULT 0,
    NextServiceDate    DATE          NULL,
    NextServiceOdo     INT           NULL,
    CostAmount         DECIMAL(18,2) NOT NULL DEFAULT 0,
    Notes              NVARCHAR(MAX) NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_VehicleService_Task     FOREIGN KEY (MaintenanceTaskID) REFERENCES [MaintenanceTask](MaintenanceTaskID),
    CONSTRAINT FK_VehicleService_Vehicle  FOREIGN KEY (VehicleID)         REFERENCES [Vehicle](VehicleID),
    CONSTRAINT FK_VehicleService_Workshop FOREIGN KEY (WorkshopID)        REFERENCES [Workshop](WorkshopID)
);
GO

CREATE TABLE [dbo].[VehicleServiceItem] (
    ItemID             INT           IDENTITY(1,1) PRIMARY KEY,
    VehicleServiceID   INT           NOT NULL,
    SKUID              INT           NOT NULL,
    Quantity           DECIMAL(18,4) NOT NULL DEFAULT 0,
    UnitCost           DECIMAL(18,4) NOT NULL DEFAULT 0,
    Source             NVARCHAR(100) NULL,
    ItemIssueRef       NVARCHAR(50)  NULL,
    HasRemovedItem     BIT           NOT NULL DEFAULT 0,
    RemovedSKUID       INT           NULL,
    RemovedQuantity    DECIMAL(18,4) NULL,
    RemovedUnitCost    DECIMAL(18,4) NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_VehicleServiceItem_Service FOREIGN KEY (VehicleServiceID) REFERENCES [VehicleService](VehicleServiceID)
);
GO

CREATE TABLE [dbo].[WorkshopHistory] (
    WorkshopHistoryID  INT           IDENTITY(1,1) PRIMARY KEY,
    WorkshopID         INT           NOT NULL,
    EventType          NVARCHAR(50)  NOT NULL,   -- 'Created' | 'Updated' | 'Status Change'
    EventDate          DATE          NOT NULL,
    [Description]      NVARCHAR(MAX) NULL,
    Notes              NVARCHAR(500) NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_WorkshopHistory_Workshop FOREIGN KEY (WorkshopID) REFERENCES [Workshop](WorkshopID)
);
GO

-- ============================================================
-- FLEET — INVENTORY ISSUANCE
-- ============================================================

CREATE TABLE [dbo].[ItemIssue] (
    ItemIssueID  INT           IDENTITY(1,1) PRIMARY KEY,
    RefCode      NVARCHAR(30)  NOT NULL,
    IssueDate    DATE          NOT NULL,
    IssueType    NVARCHAR(50)  NULL,   -- 'Service' | 'Maintenance'
    TargetID     INT           NULL,   -- ID of the MaintenanceTask or VehicleService
    Notes        NVARCHAR(500) NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL
);
GO

CREATE TABLE [dbo].[ItemIssueItem] (
    ItemID       INT           IDENTITY(1,1) PRIMARY KEY,
    ItemIssueID  INT           NOT NULL,
    SKUID        INT           NOT NULL,
    Quantity     DECIMAL(18,4) NOT NULL DEFAULT 0,
    UnitCost     DECIMAL(18,4) NOT NULL DEFAULT 0,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_ItemIssueItem_Issue FOREIGN KEY (ItemIssueID) REFERENCES [ItemIssue](ItemIssueID)
);
GO

-- ============================================================
-- FIXED ASSET — CORE
-- ============================================================

CREATE TABLE [dbo].[FixedAsset] (
    FixedAssetID          INT           IDENTITY(1,1) PRIMARY KEY,
    FixedAssetTypeID      INT           NOT NULL,
    FixedAssetCategoryID  INT           NULL,
    FixedAssetCode        VARCHAR(20)   NOT NULL,
    FixedAssetName        NVARCHAR(200) NOT NULL,
    GroupID               INT           NOT NULL,
    EstateID              INT           NOT NULL,
    TotalCostOfAsset      DECIMAL(18,2) NOT NULL DEFAULT 0,
    ResidualValue         DECIMAL(18,2) NOT NULL DEFAULT 0,
    ImplementationCost    DECIMAL(18,2) NOT NULL DEFAULT 0,
    ImplementationDate    DATE          NULL,
    StartDate             DATE          NULL,
    UsefulLifeYears       INT           NOT NULL DEFAULT 0,
    IsFuelNeeded          BIT           NOT NULL DEFAULT 0,
    FuelTypeID            INT           NULL,
    IsWarrantyEnabled     BIT           NOT NULL DEFAULT 0,
    WarrantyStartDate     DATE          NULL,
    WarrantyEndDate       DATE          NULL,
    RegistrationNumber    NVARCHAR(50)  NULL,
    DepreciationValue     DECIMAL(18,2) NOT NULL DEFAULT 0,
    LedgerTransactionRef  NVARCHAR(100) NULL,
    [Status]              NVARCHAR(50)  NOT NULL DEFAULT 'Active',
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT UQ_FixedAsset_Code  UNIQUE (FixedAssetCode),
    CONSTRAINT FK_FixedAsset_Type     FOREIGN KEY (FixedAssetTypeID)     REFERENCES [FixedAssetType](FixedAssetTypeID),
    CONSTRAINT FK_FixedAsset_Category FOREIGN KEY (FixedAssetCategoryID) REFERENCES [FixedAssetCategory](FixedAssetCategoryID),
    CONSTRAINT FK_FixedAsset_Group    FOREIGN KEY (GroupID)               REFERENCES [Group](GroupID),
    CONSTRAINT FK_FixedAsset_Estate   FOREIGN KEY (EstateID)              REFERENCES [Estate](EstateID),
    CONSTRAINT FK_FixedAsset_Fuel     FOREIGN KEY (FuelTypeID)            REFERENCES [FuelType](FuelTypeID)
);
GO

-- Now add the FK from Vehicle → FixedAsset (deferred because FixedAsset was created after Vehicle)
ALTER TABLE [dbo].[Vehicle]
    ADD CONSTRAINT FK_Vehicle_FixedAsset FOREIGN KEY (FixedAssetID) REFERENCES [FixedAsset](FixedAssetID);
GO

CREATE TABLE [dbo].[FixedAssetHistory] (
    FixedAssetHistoryID       INT           IDENTITY(1,1) PRIMARY KEY,
    FixedAssetID              INT           NOT NULL,
    FixedAssetTypeID          INT           NULL,
    FixedAssetCategoryID      INT           NULL,
    FixedAssetCode            VARCHAR(20)   NULL,
    FixedAssetName            NVARCHAR(200) NULL,
    GroupID                   INT           NULL,
    EstateID                  INT           NULL,
    TotalCostOfAsset          DECIMAL(18,2) NULL,
    ResidualValue             DECIMAL(18,2) NULL,
    ImplementationCost        DECIMAL(18,2) NULL,
    ImplementationDate        DATE          NULL,
    StartDate                 DATE          NULL,
    UsefulLifeYears           INT           NULL,
    DepreciationValue         DECIMAL(18,2) NULL,
    LedgerTransactionRef      NVARCHAR(100) NULL,
    NewUsefulLifeYears        INT           NULL,
    NewResidualValue          DECIMAL(18,2) NULL,
    PresentValue              DECIMAL(18,2) NULL,
    NewDepreciationRegisterNo NVARCHAR(100) NULL,
    NewDepreciationClaimDate  DATE          NULL,
    AssetMaintenanceID        INT           NULL,
    WarrantyClaimDate         DATE          NULL,
    EventType                 NVARCHAR(50)  NOT NULL,   -- 'Created' | 'Updated' | 'Disposal' | 'Maintenance'
    EventDate                 DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_FixedAssetHistory_Asset FOREIGN KEY (FixedAssetID) REFERENCES [FixedAsset](FixedAssetID)
);
GO

-- ============================================================
-- FIXED ASSET — DEPRECIATION
-- ============================================================

CREATE TABLE [dbo].[Depreciation] (
    DepreciationID    INT           IDENTITY(1,1) PRIMARY KEY,
    FixedAssetID      INT           NOT NULL,
    AssetValueDate    DATE          NOT NULL,
    AssetValue        DECIMAL(18,2) NOT NULL DEFAULT 0,
    UsefulYears       INT           NOT NULL DEFAULT 0,
    ResidualValue     DECIMAL(18,2) NOT NULL DEFAULT 0,
    DepreciationValue DECIMAL(18,2) NOT NULL DEFAULT 0,  -- annual amount
    GroupID           INT           NOT NULL,
    EstateID          INT           NOT NULL,
    [Status]          NVARCHAR(20)  NOT NULL DEFAULT 'Active',   -- 'Active' | 'Closed'
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_Depreciation_Asset  FOREIGN KEY (FixedAssetID) REFERENCES [FixedAsset](FixedAssetID),
    CONSTRAINT FK_Depreciation_Group  FOREIGN KEY (GroupID)      REFERENCES [Group](GroupID),
    CONSTRAINT FK_Depreciation_Estate FOREIGN KEY (EstateID)     REFERENCES [Estate](EstateID)
);
GO

CREATE TABLE [dbo].[DepreciationHistory] (
    DepreciationHistoryID  INT           IDENTITY(1,1) PRIMARY KEY,
    DepreciationID         INT           NOT NULL,
    FixedAssetID           INT           NOT NULL,
    [Date]                 DATE          NOT NULL,
    Value                  DECIMAL(18,2) NOT NULL DEFAULT 0,
    LedgerTransactionRef   NVARCHAR(100) NULL,
    GroupID                INT           NOT NULL,
    EstateID               INT           NOT NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_DepreciationHistory_Schedule FOREIGN KEY (DepreciationID) REFERENCES [Depreciation](DepreciationID),
    CONSTRAINT FK_DepreciationHistory_Asset    FOREIGN KEY (FixedAssetID)   REFERENCES [FixedAsset](FixedAssetID)
);
GO

-- ============================================================
-- FIXED ASSET — MAINTENANCE & ESTIMATION
-- ============================================================

CREATE TABLE [dbo].[AssetMaintenance] (
    AssetMaintenanceID      INT           IDENTITY(1,1) PRIMARY KEY,
    FixedAssetID            INT           NOT NULL,
    FixedAssetHistoryID     INT           NULL,
    FleetMaintenanceTaskID  INT           NULL,
    MaintenanceCode         NVARCHAR(20)  NOT NULL,
    MaintenanceDate         DATE          NOT NULL,
    TotalMaintenanceCost    DECIMAL(18,2) NOT NULL DEFAULT 0,
    WorkshopID              INT           NOT NULL,
    GroupID                 INT           NOT NULL,
    EstateID                INT           NOT NULL,
    [Status]                NVARCHAR(50)  NOT NULL DEFAULT 'Open',   -- 'Open' | 'Closed'
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT UQ_AssetMaintenance_Code UNIQUE (MaintenanceCode),
    CONSTRAINT FK_AssetMaintenance_Asset    FOREIGN KEY (FixedAssetID)           REFERENCES [FixedAsset](FixedAssetID),
    CONSTRAINT FK_AssetMaintenance_History  FOREIGN KEY (FixedAssetHistoryID)    REFERENCES [FixedAssetHistory](FixedAssetHistoryID),
    CONSTRAINT FK_AssetMaintenance_Fleet    FOREIGN KEY (FleetMaintenanceTaskID) REFERENCES [MaintenanceTask](MaintenanceTaskID),
    CONSTRAINT FK_AssetMaintenance_Workshop FOREIGN KEY (WorkshopID)             REFERENCES [Workshop](WorkshopID)
);
GO

CREATE TABLE [dbo].[AssetMaintenanceDetail] (
    AssetMaintenanceDetailID  INT  IDENTITY(1,1) PRIMARY KEY,
    AssetMaintenanceID        INT  NOT NULL,
    IsEmployeeEnabled         BIT  NOT NULL DEFAULT 0,
    EmployeeID                INT  NULL,    -- FK → HR.Employee
    WorkshopID                INT  NOT NULL,
    GroupID                   INT  NOT NULL,
    EstateID                  INT  NOT NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_AssetMaintenanceDetail_Maintenance FOREIGN KEY (AssetMaintenanceID) REFERENCES [AssetMaintenance](AssetMaintenanceID),
    CONSTRAINT FK_AssetMaintenanceDetail_Workshop    FOREIGN KEY (WorkshopID)         REFERENCES [Workshop](WorkshopID)
);
GO

CREATE TABLE [dbo].[AssetMaintenanceCost] (
    AssetMaintenanceCostID  INT           IDENTITY(1,1) PRIMARY KEY,
    AssetMaintenanceID      INT           NOT NULL,
    FixedAssetID            INT           NOT NULL,
    EstimateCode            NVARCHAR(20)  NULL,
    TotalMaintenanceCost    DECIMAL(18,2) NOT NULL DEFAULT 0,
    MaintenanceDate         DATE          NULL,
    WorkshopID              INT           NOT NULL,
    GroupID                 INT           NOT NULL,
    EstateID                INT           NOT NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_AssetMaintenanceCost_Maintenance FOREIGN KEY (AssetMaintenanceID) REFERENCES [AssetMaintenance](AssetMaintenanceID),
    CONSTRAINT FK_AssetMaintenanceCost_Asset       FOREIGN KEY (FixedAssetID)       REFERENCES [FixedAsset](FixedAssetID)
);
GO

CREATE TABLE [dbo].[Estimation] (
    EstimationID         INT           IDENTITY(1,1) PRIMARY KEY,
    FixedAssetID         INT           NOT NULL,
    EstimateCode         NVARCHAR(20)  NOT NULL,
    TotalEstimatedCost   DECIMAL(18,2) NOT NULL DEFAULT 0,
    EstimationDate       DATE          NOT NULL,
    WorkshopID           INT           NOT NULL,
    GroupID              INT           NOT NULL,
    EstateID             INT           NOT NULL,
    [Status]             NVARCHAR(50)  NOT NULL DEFAULT 'Pending',   -- 'Pending' | 'Approved' | 'Rejected'
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT UQ_Estimation_Code UNIQUE (EstimateCode),
    CONSTRAINT FK_Estimation_Asset    FOREIGN KEY (FixedAssetID) REFERENCES [FixedAsset](FixedAssetID),
    CONSTRAINT FK_Estimation_Workshop FOREIGN KEY (WorkshopID)   REFERENCES [Workshop](WorkshopID)
);
GO

CREATE TABLE [dbo].[EstimationDetail] (
    EstimationDetailID   INT           IDENTITY(1,1) PRIMARY KEY,
    EstimationID         INT           NOT NULL,
    FixedAssetID         INT           NOT NULL,
    SKUID                INT           NOT NULL,
    Quantity             DECIMAL(18,4) NOT NULL DEFAULT 0,
    UnitCost             DECIMAL(18,4) NOT NULL DEFAULT 0,
    EstimatedCost        DECIMAL(18,2) NOT NULL DEFAULT 0,
    WorkshopID           INT           NOT NULL,
    GroupID              INT           NOT NULL,
    EstateID             INT           NOT NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT FK_EstimationDetail_Estimation FOREIGN KEY (EstimationID) REFERENCES [Estimation](EstimationID),
    CONSTRAINT FK_EstimationDetail_Asset      FOREIGN KEY (FixedAssetID) REFERENCES [FixedAsset](FixedAssetID)
);
GO

-- ============================================================
-- FIXED ASSET — DISPOSAL
-- ============================================================

CREATE TABLE [dbo].[DisposalStatusType] (
    DisposalStatusTypeID  INT           IDENTITY(1,1) PRIMARY KEY,
    Code                  VARCHAR(20)   NOT NULL,
    Name                  NVARCHAR(100) NOT NULL,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL
);
GO

-- Seed disposal status types
INSERT INTO [dbo].[DisposalStatusType] (Code, Name, CreatedBy)
VALUES ('DST-DRAFT',     'Draft',     'system'),
       ('DST-APPROVED',  'Approved',  'system'),
       ('DST-COMPLETED', 'Completed', 'system');
GO

CREATE TABLE [dbo].[Disposal] (
    DisposalID             INT           IDENTITY(1,1) PRIMARY KEY,
    DisposalCode           NVARCHAR(20)  NOT NULL,
    FixedAssetID           INT           NOT NULL,
    GroupID                INT           NOT NULL,
    EstateID               INT           NOT NULL,
    DisposalDate           DATE          NOT NULL,
    DisposalType           NVARCHAR(50)  NOT NULL,   -- 'Sale' | 'Write-Off' | 'Donation' | 'Scrap'
    BookValueAtDisposal    DECIMAL(18,2) NOT NULL DEFAULT 0,
    SaleProceeds           DECIMAL(18,2) NOT NULL DEFAULT 0,
    GainLossOnDisposal     DECIMAL(18,2) NOT NULL DEFAULT 0,
    DisposalReason         NVARCHAR(MAX) NULL,
    ApprovedBy             NVARCHAR(200) NULL,
    Notes                  NVARCHAR(MAX) NULL,
    DisposalStatusTypeID   INT           NOT NULL DEFAULT 1,
    -- Audit
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(100) NOT NULL DEFAULT '',
    CreatedDate  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    ModifiedBy   NVARCHAR(100) NULL,
    ModifiedDate DATETIME2     NULL,
    CONSTRAINT UQ_Disposal_Code UNIQUE (DisposalCode),
    CONSTRAINT FK_Disposal_Asset        FOREIGN KEY (FixedAssetID)           REFERENCES [FixedAsset](FixedAssetID),
    CONSTRAINT FK_Disposal_Group        FOREIGN KEY (GroupID)                REFERENCES [Group](GroupID),
    CONSTRAINT FK_Disposal_Estate       FOREIGN KEY (EstateID)               REFERENCES [Estate](EstateID),
    CONSTRAINT FK_Disposal_StatusType   FOREIGN KEY (DisposalStatusTypeID)   REFERENCES [DisposalStatusType](DisposalStatusTypeID)
);
GO

-- ============================================================
-- INDEXES (high-frequency FK columns)
-- ============================================================

CREATE INDEX IX_Vehicle_Estate          ON [dbo].[Vehicle]         (EstateID)         WHERE IsActive = 1;
CREATE INDEX IX_Vehicle_Status          ON [dbo].[Vehicle]         ([Status])         WHERE IsActive = 1;
CREATE INDEX IX_VehicleDocument_Vehicle ON [dbo].[VehicleDocument] (VehicleID)        WHERE IsActive = 1;
CREATE INDEX IX_VehicleDocument_Expiry  ON [dbo].[VehicleDocument] (ExpireDate)       WHERE IsActive = 1;
CREATE INDEX IX_Driver_Status           ON [dbo].[Driver]          ([Status])         WHERE IsActive = 1;
CREATE INDEX IX_DriverAssignment_Active ON [dbo].[DriverAssignment](EndDate)          WHERE IsActive = 1;
CREATE INDEX IX_DailyRunning_Vehicle    ON [dbo].[DailyRunning]    (VehicleID)        WHERE IsActive = 1;
CREATE INDEX IX_FixedAsset_Estate       ON [dbo].[FixedAsset]      (EstateID)         WHERE IsActive = 1;
CREATE INDEX IX_FixedAsset_Status       ON [dbo].[FixedAsset]      ([Status])         WHERE IsActive = 1;
CREATE INDEX IX_Depreciation_Asset      ON [dbo].[Depreciation]    (FixedAssetID)     WHERE IsActive = 1;
CREATE INDEX IX_DepHistory_Asset        ON [dbo].[DepreciationHistory](FixedAssetID)  WHERE IsActive = 1;
CREATE INDEX IX_AssetMaint_Asset        ON [dbo].[AssetMaintenance](FixedAssetID)     WHERE IsActive = 1;
CREATE INDEX IX_AssetMaint_Status       ON [dbo].[AssetMaintenance]([Status])         WHERE IsActive = 1;
CREATE INDEX IX_Disposal_Asset          ON [dbo].[Disposal]        (FixedAssetID)     WHERE IsActive = 1;
GO
