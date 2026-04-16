# AgriGEN ERP — Stored Procedures: Fixed Asset Module

---

## 1. Fixed Assets

The most complex entity in the module. Every INSERT and UPDATE automatically writes an immutable `FixedAssetHistory` snapshot row.

```sql
-- ─── usp_FA_FixedAsset_GetNextCode ───────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_FA_FixedAsset_GetNextCode
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @LastNum INT;
    SELECT @LastNum = MAX(CAST(SUBSTRING(FixedAssetCode, 4, 10) AS INT))
    FROM FixedAsset
    WHERE FixedAssetCode LIKE 'FA-%' AND ISNUMERIC(SUBSTRING(FixedAssetCode, 4, 10)) = 1;
    SELECT 'FA-' + RIGHT('0000' + CAST(ISNULL(@LastNum, 0) + 1 AS VARCHAR), 4) AS Code;
END;
GO

-- ─── usp_FA_FixedAsset_GetSummary ────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_FA_FixedAsset_GetSummary
    @GroupID  INT = NULL,
    @EstateID INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        COUNT(1)                AS ActiveCount,
        SUM(TotalCostOfAsset)   AS TotalValue,
        SUM(DepreciationValue)  AS TotalDepreciation
    FROM FixedAsset
    WHERE IsActive = 1
        AND Status <> 'Disposed'
        AND (@GroupID  IS NULL OR GroupID  = @GroupID)
        AND (@EstateID IS NULL OR EstateID = @EstateID);
END;
GO

-- ─── usp_FA_FixedAsset_GetAll ─────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_FA_FixedAsset_GetAll
    @EstateID           INT           = NULL,
    @FixedAssetTypeID   INT           = NULL,
    @Status             VARCHAR(20)   = NULL,
    @Search             NVARCHAR(100) = NULL,
    @Page               INT           = 1,
    @PageSize           INT           = 100
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@Page - 1) * @PageSize;

    SELECT
        fa.FixedAssetID AS Id,
        fa.FixedAssetTypeID,
        fat.AssetTypeName   AS FixedAssetTypeName,
        fa.FixedAssetCategoryID,
        fac.AssetCategoryName AS FixedAssetCategoryName,
        fa.FixedAssetCode   AS Code,
        fa.FixedAssetName   AS Name,
        fa.GroupID,
        fa.EstateID,
        e.Name              AS EstateName,
        fa.TotalCostOfAsset,
        fa.ResidualValue,
        fa.ImplementationCost,
        fa.ImplementationDate,
        fa.StartDate,
        fa.UsefulLifeYears,
        fa.IsFuelNeeded,
        fa.FuelTypeID,
        fa.IsWarrantyEnabled,
        fa.WarrantyStartDate,
        fa.WarrantyEndDate,
        fa.RegistrationNumber,
        fa.DepreciationValue,
        fa.LedgerTransactionRef,
        fa.Status
    FROM FixedAsset fa
    INNER JOIN FixedAssetType     fat ON fat.FixedAssetTypeID     = fa.FixedAssetTypeID
    INNER JOIN FixedAssetCategory fac ON fac.FixedAssetCategoryID = fa.FixedAssetCategoryID
    INNER JOIN Estate             e   ON e.EstateID               = fa.EstateID
    WHERE
        fa.IsActive = 1
        AND (@EstateID         IS NULL OR fa.EstateID         = @EstateID)
        AND (@FixedAssetTypeID IS NULL OR fa.FixedAssetTypeID = @FixedAssetTypeID)
        AND (@Status           IS NULL OR fa.Status           = @Status)
        AND (@Search           IS NULL OR fa.FixedAssetCode LIKE '%' + @Search + '%'
                                       OR fa.FixedAssetName LIKE '%' + @Search + '%'
                                       OR fa.RegistrationNumber LIKE '%' + @Search + '%')
    ORDER BY fa.FixedAssetCode
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;

    SELECT COUNT(1) AS Total FROM FixedAsset fa
    WHERE fa.IsActive=1
        AND (@EstateID         IS NULL OR fa.EstateID         = @EstateID)
        AND (@FixedAssetTypeID IS NULL OR fa.FixedAssetTypeID = @FixedAssetTypeID)
        AND (@Status           IS NULL OR fa.Status           = @Status)
        AND (@Search           IS NULL OR fa.FixedAssetCode LIKE '%'+@Search+'%' OR fa.FixedAssetName LIKE '%'+@Search+'%');
END;
GO

-- ─── usp_FA_FixedAsset_GetByID ───────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_FA_FixedAsset_GetByID
    @FixedAssetID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        fa.FixedAssetID AS Id, fa.FixedAssetTypeID, fa.FixedAssetCategoryID,
        fa.FixedAssetCode AS Code, fa.FixedAssetName AS Name,
        fa.GroupID, fa.EstateID, fa.TotalCostOfAsset, fa.ResidualValue,
        fa.ImplementationCost, fa.ImplementationDate, fa.StartDate, fa.UsefulLifeYears,
        fa.IsFuelNeeded, fa.FuelTypeID, fa.IsWarrantyEnabled, fa.WarrantyStartDate,
        fa.WarrantyEndDate, fa.RegistrationNumber, fa.DepreciationValue,
        fa.LedgerTransactionRef, fa.Status
    FROM FixedAsset fa
    WHERE fa.FixedAssetID = @FixedAssetID AND fa.IsActive = 1;
END;
GO

-- ─── usp_FA_FixedAsset_GetHistory ────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_FA_FixedAsset_GetHistory
    @FixedAssetID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        fah.FixedAssetHistoryID AS Id,
        fah.FixedAssetID,
        fah.EventType,
        fah.CreatedDate         AS EventDate,
        fah.FixedAssetCode,
        fah.FixedAssetName,
        fah.TotalCostOfAsset,
        fah.ResidualValue,
        fah.DepreciationValue,
        fah.UsefulLifeYears,
        fah.PresentValue,
        fah.LedgerTransactionRef,
        fah.NewUsefulLifeYears,
        fah.NewResidualValue,
        fah.WarrantyClaimDate
    FROM FixedAssetHistory fah
    WHERE fah.FixedAssetID = @FixedAssetID
    ORDER BY fah.CreatedDate DESC;
END;
GO

-- ─── usp_FA_FixedAsset_Insert ─────────────────────────────────────────────────
-- Auto-inserts a FixedAssetHistory row with EventType = 'Created'
CREATE OR ALTER PROCEDURE usp_FA_FixedAsset_Insert
    @FixedAssetTypeID      INT,
    @FixedAssetCategoryID  INT,
    @FixedAssetCode        VARCHAR(20),
    @FixedAssetName        NVARCHAR(150),
    @GroupID               INT,
    @EstateID              INT,
    @TotalCostOfAsset      DECIMAL(15,2),
    @ResidualValue         DECIMAL(15,2),
    @ImplementationCost    DECIMAL(15,2)  = NULL,
    @ImplementationDate    DATE           = NULL,
    @StartDate             DATE,
    @UsefulLifeYears       INT,
    @IsFuelNeeded          BIT            = 0,
    @FuelTypeID            INT            = NULL,
    @IsWarrantyEnabled     BIT            = 0,
    @WarrantyStartDate     DATE           = NULL,
    @WarrantyEndDate       DATE           = NULL,
    @RegistrationNumber    VARCHAR(50)    = NULL,
    @DepreciationValue     DECIMAL(15,2),
    @LedgerTransactionRef  VARCHAR(100)   = NULL,
    @CreatedBy             INT,
    @NewID                 INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS(SELECT 1 FROM FixedAsset WHERE FixedAssetCode=@FixedAssetCode AND IsActive=1)
    BEGIN
        RAISERROR('Fixed asset code already exists.',16,1);
        RETURN;
    END

    BEGIN TRANSACTION;
    BEGIN TRY
        INSERT INTO FixedAsset(
            FixedAssetTypeID, FixedAssetCategoryID, FixedAssetCode, FixedAssetName,
            GroupID, EstateID, TotalCostOfAsset, ResidualValue, ImplementationCost,
            ImplementationDate, StartDate, UsefulLifeYears, IsFuelNeeded, FuelTypeID,
            IsWarrantyEnabled, WarrantyStartDate, WarrantyEndDate, RegistrationNumber,
            DepreciationValue, LedgerTransactionRef, Status, CreatedBy)
        VALUES(
            @FixedAssetTypeID, @FixedAssetCategoryID, @FixedAssetCode, @FixedAssetName,
            @GroupID, @EstateID, @TotalCostOfAsset, @ResidualValue, @ImplementationCost,
            @ImplementationDate, @StartDate, @UsefulLifeYears, @IsFuelNeeded, @FuelTypeID,
            @IsWarrantyEnabled, @WarrantyStartDate, @WarrantyEndDate, @RegistrationNumber,
            @DepreciationValue, @LedgerTransactionRef, 'Active', @CreatedBy);

        SET @NewID = SCOPE_IDENTITY();

        -- Auto-insert immutable history snapshot
        INSERT INTO FixedAssetHistory(
            FixedAssetID, FixedAssetTypeID, FixedAssetCategoryID, FixedAssetCode, FixedAssetName,
            GroupID, EstateID, TotalCostOfAsset, ResidualValue, ImplementationCost,
            ImplementationDate, StartDate, UsefulLifeYears, DepreciationValue, LedgerTransactionRef,
            PresentValue, EventType, CreatedBy)
        VALUES(
            @NewID, @FixedAssetTypeID, @FixedAssetCategoryID, @FixedAssetCode, @FixedAssetName,
            @GroupID, @EstateID, @TotalCostOfAsset, @ResidualValue, @ImplementationCost,
            @ImplementationDate, @StartDate, @UsefulLifeYears, @DepreciationValue, @LedgerTransactionRef,
            @TotalCostOfAsset,   -- PresentValue = cost at creation
            'Created', @CreatedBy);

        COMMIT;
    END TRY
    BEGIN CATCH
        ROLLBACK;
        THROW;
    END CATCH
END;
GO

-- ─── usp_FA_FixedAsset_Update ─────────────────────────────────────────────────
-- Auto-inserts a FixedAssetHistory row with EventType = 'Updated'
CREATE OR ALTER PROCEDURE usp_FA_FixedAsset_Update
    @FixedAssetID          INT,
    @FixedAssetTypeID      INT,
    @FixedAssetCategoryID  INT,
    @FixedAssetCode        VARCHAR(20),
    @FixedAssetName        NVARCHAR(150),
    @GroupID               INT,
    @EstateID              INT,
    @TotalCostOfAsset      DECIMAL(15,2),
    @ResidualValue         DECIMAL(15,2),
    @ImplementationCost    DECIMAL(15,2)  = NULL,
    @ImplementationDate    DATE           = NULL,
    @StartDate             DATE,
    @UsefulLifeYears       INT,
    @IsFuelNeeded          BIT,
    @FuelTypeID            INT            = NULL,
    @IsWarrantyEnabled     BIT,
    @WarrantyStartDate     DATE           = NULL,
    @WarrantyEndDate       DATE           = NULL,
    @RegistrationNumber    VARCHAR(50)    = NULL,
    @DepreciationValue     DECIMAL(15,2),
    @LedgerTransactionRef  VARCHAR(100)   = NULL,
    @Status                VARCHAR(20),
    @ModifiedBy            INT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS(SELECT 1 FROM FixedAsset WHERE FixedAssetCode=@FixedAssetCode AND FixedAssetID<>@FixedAssetID AND IsActive=1)
    BEGIN
        RAISERROR('Fixed asset code in use by another record.',16,1);
        RETURN;
    END

    -- Compute current NBV = TotalCostOfAsset - total depreciation posted
    DECLARE @TotalPosted DECIMAL(15,2);
    SELECT @TotalPosted = ISNULL(SUM(Value), 0)
    FROM DepreciationHistory
    WHERE FixedAssetID = @FixedAssetID AND IsActive = 1;

    DECLARE @PresentValue DECIMAL(15,2) = @TotalCostOfAsset - @TotalPosted;

    BEGIN TRANSACTION;
    BEGIN TRY
        UPDATE FixedAsset SET
            FixedAssetTypeID=@FixedAssetTypeID, FixedAssetCategoryID=@FixedAssetCategoryID,
            FixedAssetCode=@FixedAssetCode, FixedAssetName=@FixedAssetName,
            GroupID=@GroupID, EstateID=@EstateID, TotalCostOfAsset=@TotalCostOfAsset,
            ResidualValue=@ResidualValue, ImplementationCost=@ImplementationCost,
            ImplementationDate=@ImplementationDate, StartDate=@StartDate,
            UsefulLifeYears=@UsefulLifeYears, IsFuelNeeded=@IsFuelNeeded,
            FuelTypeID=@FuelTypeID, IsWarrantyEnabled=@IsWarrantyEnabled,
            WarrantyStartDate=@WarrantyStartDate, WarrantyEndDate=@WarrantyEndDate,
            RegistrationNumber=@RegistrationNumber, DepreciationValue=@DepreciationValue,
            LedgerTransactionRef=@LedgerTransactionRef, Status=@Status,
            ModifiedBy=@ModifiedBy, ModifiedDate=GETDATE()
        WHERE FixedAssetID=@FixedAssetID AND IsActive=1;

        -- Auto-insert immutable history snapshot
        INSERT INTO FixedAssetHistory(
            FixedAssetID, FixedAssetTypeID, FixedAssetCategoryID, FixedAssetCode, FixedAssetName,
            GroupID, EstateID, TotalCostOfAsset, ResidualValue, ImplementationCost,
            ImplementationDate, StartDate, UsefulLifeYears, DepreciationValue, LedgerTransactionRef,
            PresentValue, EventType, CreatedBy)
        VALUES(
            @FixedAssetID, @FixedAssetTypeID, @FixedAssetCategoryID, @FixedAssetCode, @FixedAssetName,
            @GroupID, @EstateID, @TotalCostOfAsset, @ResidualValue, @ImplementationCost,
            @ImplementationDate, @StartDate, @UsefulLifeYears, @DepreciationValue, @LedgerTransactionRef,
            @PresentValue, 'Updated', @ModifiedBy);

        COMMIT;
    END TRY
    BEGIN CATCH
        ROLLBACK;
        THROW;
    END CATCH
END;
GO

-- ─── usp_FA_FixedAsset_Delete ─────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_FA_FixedAsset_Delete
    @FixedAssetID INT, @ModifiedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        -- Cascade soft-delete all children
        UPDATE DepreciationHistory SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE FixedAssetID=@FixedAssetID AND IsActive=1;
        UPDATE Depreciation        SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE FixedAssetID=@FixedAssetID AND IsActive=1;
        UPDATE EstimationDetail    SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE FixedAssetID=@FixedAssetID AND IsActive=1;
        UPDATE Estimation          SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE FixedAssetID=@FixedAssetID AND IsActive=1;
        UPDATE AssetMaintenanceDetail SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
            WHERE AssetMaintenanceID IN (SELECT AssetMaintenanceID FROM AssetMaintenance WHERE FixedAssetID=@FixedAssetID);
        UPDATE AssetMaintenanceCost   SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
            WHERE AssetMaintenanceID IN (SELECT AssetMaintenanceID FROM AssetMaintenance WHERE FixedAssetID=@FixedAssetID);
        UPDATE AssetMaintenance    SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE FixedAssetID=@FixedAssetID AND IsActive=1;
        UPDATE Disposal            SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE FixedAssetID=@FixedAssetID AND IsActive=1;
        UPDATE FixedAssetHistory   SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE FixedAssetID=@FixedAssetID AND IsActive=1;
        UPDATE FixedAsset          SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE FixedAssetID=@FixedAssetID AND IsActive=1;

        -- Unlink from Vehicle
        UPDATE Vehicle SET FixedAssetID=NULL,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE FixedAssetID=@FixedAssetID AND IsActive=1;

        COMMIT;
    END TRY
    BEGIN CATCH ROLLBACK; THROW; END CATCH
END;
GO
```

---

## 2. Depreciation

```sql
-- ─── usp_FA_Depreciation_Calculate ───────────────────────────────────────────
-- Helper: returns straight-line annual depreciation amount.
CREATE OR ALTER PROCEDURE usp_FA_Depreciation_Calculate
    @AssetValue    DECIMAL(15,2),
    @ResidualValue DECIMAL(15,2),
    @UsefulYears   INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Annual DECIMAL(15,2) =
        CASE WHEN @UsefulYears > 0
             THEN (@AssetValue - @ResidualValue) / @UsefulYears
             ELSE 0
        END;
    SELECT @Annual AS AnnualDepreciation;
END;
GO

-- ─── usp_FA_Depreciation_GetAll ──────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_FA_Depreciation_GetAll
    @FixedAssetID INT = NULL, @Page INT = 1, @PageSize INT = 100
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@Page-1)*@PageSize;
    SELECT
        d.DepreciationID AS Id,
        d.FixedAssetID,
        fa.FixedAssetCode, fa.FixedAssetName,
        d.AssetValueDate, d.AssetValue, d.UsefulYears, d.ResidualValue,
        d.DepreciationValue, d.GroupID, d.EstateID, d.Status
    FROM Depreciation d
    INNER JOIN FixedAsset fa ON fa.FixedAssetID = d.FixedAssetID
    WHERE d.IsActive=1 AND (@FixedAssetID IS NULL OR d.FixedAssetID=@FixedAssetID)
    ORDER BY d.AssetValueDate DESC OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
    SELECT COUNT(1) AS Total FROM Depreciation WHERE IsActive=1 AND (@FixedAssetID IS NULL OR FixedAssetID=@FixedAssetID);
END; GO

CREATE OR ALTER PROCEDURE usp_FA_Depreciation_GetByID @DepreciationID INT
AS BEGIN SET NOCOUNT ON;
    SELECT DepreciationID AS Id, FixedAssetID, AssetValueDate, AssetValue, UsefulYears,
        ResidualValue, DepreciationValue, GroupID, EstateID, Status
    FROM Depreciation WHERE DepreciationID=@DepreciationID AND IsActive=1;
END; GO

CREATE OR ALTER PROCEDURE usp_FA_Depreciation_Insert
    @FixedAssetID INT, @AssetValueDate DATE, @AssetValue DECIMAL(15,2),
    @UsefulYears INT, @ResidualValue DECIMAL(15,2), @DepreciationValue DECIMAL(15,2),
    @GroupID INT, @EstateID INT, @CreatedBy INT, @NewID INT OUTPUT
AS BEGIN SET NOCOUNT ON;
    INSERT INTO Depreciation(FixedAssetID,AssetValueDate,AssetValue,UsefulYears,ResidualValue,DepreciationValue,GroupID,EstateID,Status,CreatedBy)
    VALUES(@FixedAssetID,@AssetValueDate,@AssetValue,@UsefulYears,@ResidualValue,@DepreciationValue,@GroupID,@EstateID,'Active',@CreatedBy);
    SET @NewID=SCOPE_IDENTITY();
END; GO

CREATE OR ALTER PROCEDURE usp_FA_Depreciation_Update
    @DepreciationID INT, @AssetValueDate DATE, @AssetValue DECIMAL(15,2),
    @UsefulYears INT, @ResidualValue DECIMAL(15,2), @DepreciationValue DECIMAL(15,2),
    @Status VARCHAR(10), @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    UPDATE Depreciation SET AssetValueDate=@AssetValueDate,AssetValue=@AssetValue,
        UsefulYears=@UsefulYears,ResidualValue=@ResidualValue,DepreciationValue=@DepreciationValue,
        Status=@Status,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
    WHERE DepreciationID=@DepreciationID AND IsActive=1;
END; GO

CREATE OR ALTER PROCEDURE usp_FA_Depreciation_Delete @DepreciationID INT, @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    BEGIN TRANSACTION;
    UPDATE DepreciationHistory SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE DepreciationID=@DepreciationID AND IsActive=1;
    UPDATE Depreciation        SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE DepreciationID=@DepreciationID AND IsActive=1;
    COMMIT;
END; GO
```

---

## 3. Depreciation History

```sql
-- ─── usp_FA_DepreciationHistory_GetTotalPosted ───────────────────────────────
CREATE OR ALTER PROCEDURE usp_FA_DepreciationHistory_GetTotalPosted
    @FixedAssetID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT @FixedAssetID AS FixedAssetID, ISNULL(SUM(Value), 0) AS TotalPosted
    FROM DepreciationHistory
    WHERE FixedAssetID = @FixedAssetID AND IsActive = 1;
END;
GO

CREATE OR ALTER PROCEDURE usp_FA_DepreciationHistory_GetAll
    @FixedAssetID INT=NULL, @DepreciationID INT=NULL, @Page INT=1, @PageSize INT=100
AS BEGIN SET NOCOUNT ON;
    DECLARE @Offset INT=(@Page-1)*@PageSize;
    SELECT dh.DepreciationHistoryID AS Id, dh.DepreciationID, dh.FixedAssetID,
        fa.FixedAssetCode, fa.FixedAssetName, dh.[Date], dh.Value, dh.LedgerTransactionRef, dh.GroupID, dh.EstateID
    FROM DepreciationHistory dh
    INNER JOIN FixedAsset fa ON fa.FixedAssetID=dh.FixedAssetID
    WHERE dh.IsActive=1
        AND (@FixedAssetID  IS NULL OR dh.FixedAssetID  = @FixedAssetID)
        AND (@DepreciationID IS NULL OR dh.DepreciationID = @DepreciationID)
    ORDER BY dh.[Date] DESC OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
    SELECT COUNT(1) AS Total FROM DepreciationHistory WHERE IsActive=1
        AND (@FixedAssetID IS NULL OR FixedAssetID=@FixedAssetID)
        AND (@DepreciationID IS NULL OR DepreciationID=@DepreciationID);
END; GO

-- ─── usp_FA_DepreciationHistory_Post ─────────────────────────────────────────
-- Posts one depreciation period entry.
CREATE OR ALTER PROCEDURE usp_FA_DepreciationHistory_Post
    @DepreciationID INT, @FixedAssetID INT, @Date DATE, @Value DECIMAL(15,2),
    @LedgerTransactionRef VARCHAR(100)=NULL, @GroupID INT, @EstateID INT,
    @CreatedBy INT, @NewID INT OUTPUT
AS BEGIN SET NOCOUNT ON;
    INSERT INTO DepreciationHistory(DepreciationID,FixedAssetID,[Date],Value,LedgerTransactionRef,GroupID,EstateID,CreatedBy)
    VALUES(@DepreciationID,@FixedAssetID,@Date,@Value,@LedgerTransactionRef,@GroupID,@EstateID,@CreatedBy);
    SET @NewID=SCOPE_IDENTITY();
END; GO

CREATE OR ALTER PROCEDURE usp_FA_DepreciationHistory_Delete @DepreciationHistoryID INT, @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    UPDATE DepreciationHistory SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
    WHERE DepreciationHistoryID=@DepreciationHistoryID AND IsActive=1;
END; GO
```

---

## 4. Asset Maintenance (with Details & Costs)

```sql
-- ─── usp_FA_AssetMaintenance_GetNextCode ─────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_FA_AssetMaintenance_GetNextCode
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @LastNum INT;
    SELECT @LastNum = MAX(CAST(SUBSTRING(MaintenanceCode, 4, 10) AS INT))
    FROM AssetMaintenance WHERE MaintenanceCode LIKE 'AM-%' AND ISNUMERIC(SUBSTRING(MaintenanceCode, 4, 10))=1;
    SELECT 'AM-' + RIGHT('0000' + CAST(ISNULL(@LastNum, 0) + 1 AS VARCHAR), 4) AS Code;
END;
GO

-- ─── usp_FA_AssetMaintenance_GetAll ──────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_FA_AssetMaintenance_GetAll
    @FixedAssetID INT=NULL, @EstateID INT=NULL, @Status VARCHAR(20)=NULL,
    @From DATE=NULL, @To DATE=NULL, @Page INT=1, @PageSize INT=100
AS BEGIN SET NOCOUNT ON;
    DECLARE @Offset INT=(@Page-1)*@PageSize;
    SELECT
        am.AssetMaintenanceID AS Id, am.FixedAssetID, fa.FixedAssetCode, fa.FixedAssetName,
        am.MaintenanceCode, am.MaintenanceDate, am.TotalMaintenanceCost,
        am.WorkshopID, w.WorkshopName, am.GroupID, am.EstateID, am.Status
    FROM AssetMaintenance am
    INNER JOIN FixedAsset fa ON fa.FixedAssetID=am.FixedAssetID
    INNER JOIN Workshop   w  ON w.WorkshopID   =am.WorkshopID
    WHERE am.IsActive=1
        AND (@FixedAssetID IS NULL OR am.FixedAssetID=@FixedAssetID)
        AND (@EstateID     IS NULL OR am.EstateID    =@EstateID)
        AND (@Status       IS NULL OR am.Status      =@Status)
        AND (@From IS NULL OR am.MaintenanceDate >= @From)
        AND (@To   IS NULL OR am.MaintenanceDate <= @To)
    ORDER BY am.MaintenanceDate DESC OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
    SELECT COUNT(1) AS Total FROM AssetMaintenance WHERE IsActive=1;
END; GO

-- ─── usp_FA_AssetMaintenance_GetByID (header + details + costs) ──────────────
CREATE OR ALTER PROCEDURE usp_FA_AssetMaintenance_GetByID
    @AssetMaintenanceID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT AssetMaintenanceID AS Id, FixedAssetID, FixedAssetHistoryID, FleetMaintenanceTaskID,
        MaintenanceCode, MaintenanceDate, TotalMaintenanceCost, WorkshopID, GroupID, EstateID, Status
    FROM AssetMaintenance WHERE AssetMaintenanceID=@AssetMaintenanceID AND IsActive=1;

    SELECT AssetMaintenanceDetailID AS Id, AssetMaintenanceID, IsEmployeeEnabled, EmployeeID, WorkshopID, GroupID, EstateID
    FROM AssetMaintenanceDetail WHERE AssetMaintenanceID=@AssetMaintenanceID AND IsActive=1;

    SELECT AssetMaintenanceCostID AS Id, AssetMaintenanceID, FixedAssetID, EstimateCode, TotalMaintenanceCost, MaintenanceDate, WorkshopID, GroupID, EstateID
    FROM AssetMaintenanceCost WHERE AssetMaintenanceID=@AssetMaintenanceID AND IsActive=1;
END; GO

-- ─── usp_FA_AssetMaintenance_Insert ──────────────────────────────────────────
-- Details and Costs passed as JSON arrays.
CREATE OR ALTER PROCEDURE usp_FA_AssetMaintenance_Insert
    @FixedAssetID          INT,
    @FixedAssetHistoryID   INT           = NULL,
    @FleetMaintenanceTaskID INT          = NULL,
    @MaintenanceCode       VARCHAR(20),
    @MaintenanceDate       DATE,
    @TotalMaintenanceCost  DECIMAL(12,2),
    @WorkshopID            INT,
    @GroupID               INT,
    @EstateID              INT,
    @Status                VARCHAR(20)   = 'Open',
    @DetailsJson           NVARCHAR(MAX),  -- [{isEmployeeEnabled,employeeID,workshopID,groupID,estateID}]
    @CostsJson             NVARCHAR(MAX),  -- [{estimateCode,totalMaintenanceCost,maintenanceDate,workshopID,groupID,estateID}]
    @CreatedBy             INT,
    @NewID                 INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS(SELECT 1 FROM AssetMaintenance WHERE MaintenanceCode=@MaintenanceCode AND IsActive=1)
    BEGIN RAISERROR('Maintenance code exists.',16,1); RETURN; END

    BEGIN TRANSACTION;
    BEGIN TRY
        INSERT INTO AssetMaintenance(FixedAssetID,FixedAssetHistoryID,FleetMaintenanceTaskID,
            MaintenanceCode,MaintenanceDate,TotalMaintenanceCost,WorkshopID,GroupID,EstateID,Status,CreatedBy)
        VALUES(@FixedAssetID,@FixedAssetHistoryID,@FleetMaintenanceTaskID,
            @MaintenanceCode,@MaintenanceDate,@TotalMaintenanceCost,@WorkshopID,@GroupID,@EstateID,@Status,@CreatedBy);
        SET @NewID=SCOPE_IDENTITY();

        -- Insert detail rows
        INSERT INTO AssetMaintenanceDetail(AssetMaintenanceID,IsEmployeeEnabled,EmployeeID,WorkshopID,GroupID,EstateID,CreatedBy)
        SELECT @NewID,
            CAST(ISNULL(j.IsEmployeeEnabled,0) AS BIT),
            CAST(j.EmployeeID AS INT),
            CAST(j.WorkshopID AS INT),
            CAST(j.GroupID    AS INT),
            CAST(j.EstateID   AS INT),
            @CreatedBy
        FROM OPENJSON(@DetailsJson) WITH(IsEmployeeEnabled BIT, EmployeeID INT, WorkshopID INT, GroupID INT, EstateID INT) j;

        -- Insert cost rows
        INSERT INTO AssetMaintenanceCost(AssetMaintenanceID,FixedAssetID,EstimateCode,TotalMaintenanceCost,MaintenanceDate,WorkshopID,GroupID,EstateID,CreatedBy)
        SELECT @NewID, @FixedAssetID,
            j.EstimateCode,
            CAST(j.TotalMaintenanceCost AS DECIMAL(12,2)),
            CAST(j.MaintenanceDate AS DATE),
            CAST(j.WorkshopID AS INT),
            CAST(j.GroupID    AS INT),
            CAST(j.EstateID   AS INT),
            @CreatedBy
        FROM OPENJSON(@CostsJson) WITH(EstimateCode VARCHAR(20), TotalMaintenanceCost DECIMAL(12,2), MaintenanceDate DATE, WorkshopID INT, GroupID INT, EstateID INT) j;

        -- Auto-insert FixedAssetHistory snapshot
        INSERT INTO FixedAssetHistory(
            FixedAssetID, FixedAssetTypeID, FixedAssetCategoryID, FixedAssetCode, FixedAssetName,
            GroupID, EstateID, TotalCostOfAsset, ResidualValue, ImplementationCost,
            ImplementationDate, StartDate, UsefulLifeYears, DepreciationValue, LedgerTransactionRef,
            PresentValue, AssetMaintenanceID, EventType, CreatedBy)
        SELECT
            fa.FixedAssetID, fa.FixedAssetTypeID, fa.FixedAssetCategoryID, fa.FixedAssetCode,
            fa.FixedAssetName, fa.GroupID, fa.EstateID, fa.TotalCostOfAsset, fa.ResidualValue,
            fa.ImplementationCost, fa.ImplementationDate, fa.StartDate, fa.UsefulLifeYears,
            fa.DepreciationValue, fa.LedgerTransactionRef,
            fa.TotalCostOfAsset - ISNULL((SELECT SUM(Value) FROM DepreciationHistory WHERE FixedAssetID=fa.FixedAssetID AND IsActive=1),0),
            @NewID, 'Maintenance', @CreatedBy
        FROM FixedAsset fa WHERE fa.FixedAssetID=@FixedAssetID;

        COMMIT;
    END TRY
    BEGIN CATCH ROLLBACK; THROW; END CATCH
END;
GO

-- ─── usp_FA_AssetMaintenance_Update ──────────────────────────────────────────
-- Replace-all pattern: soft-delete old details/costs, re-insert from JSON
CREATE OR ALTER PROCEDURE usp_FA_AssetMaintenance_Update
    @AssetMaintenanceID    INT,
    @MaintenanceDate       DATE,
    @TotalMaintenanceCost  DECIMAL(12,2),
    @WorkshopID            INT,
    @Status                VARCHAR(20),
    @DetailsJson           NVARCHAR(MAX),
    @CostsJson             NVARCHAR(MAX),
    @ModifiedBy            INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        UPDATE AssetMaintenance SET MaintenanceDate=@MaintenanceDate,
            TotalMaintenanceCost=@TotalMaintenanceCost, WorkshopID=@WorkshopID, Status=@Status,
            ModifiedBy=@ModifiedBy, ModifiedDate=GETDATE()
        WHERE AssetMaintenanceID=@AssetMaintenanceID AND IsActive=1;

        -- Replace details
        UPDATE AssetMaintenanceDetail SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE AssetMaintenanceID=@AssetMaintenanceID AND IsActive=1;
        INSERT INTO AssetMaintenanceDetail(AssetMaintenanceID,IsEmployeeEnabled,EmployeeID,WorkshopID,GroupID,EstateID,CreatedBy)
        SELECT @AssetMaintenanceID,CAST(ISNULL(j.IsEmployeeEnabled,0) AS BIT),CAST(j.EmployeeID AS INT),CAST(j.WorkshopID AS INT),CAST(j.GroupID AS INT),CAST(j.EstateID AS INT),@ModifiedBy
        FROM OPENJSON(@DetailsJson) WITH(IsEmployeeEnabled BIT,EmployeeID INT,WorkshopID INT,GroupID INT,EstateID INT) j;

        -- Replace costs
        UPDATE AssetMaintenanceCost SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE AssetMaintenanceID=@AssetMaintenanceID AND IsActive=1;
        INSERT INTO AssetMaintenanceCost(AssetMaintenanceID,FixedAssetID,EstimateCode,TotalMaintenanceCost,MaintenanceDate,WorkshopID,GroupID,EstateID,CreatedBy)
        SELECT @AssetMaintenanceID,(SELECT FixedAssetID FROM AssetMaintenance WHERE AssetMaintenanceID=@AssetMaintenanceID),
            j.EstimateCode,CAST(j.TotalMaintenanceCost AS DECIMAL(12,2)),CAST(j.MaintenanceDate AS DATE),CAST(j.WorkshopID AS INT),CAST(j.GroupID AS INT),CAST(j.EstateID AS INT),@ModifiedBy
        FROM OPENJSON(@CostsJson) WITH(EstimateCode VARCHAR(20),TotalMaintenanceCost DECIMAL(12,2),MaintenanceDate DATE,WorkshopID INT,GroupID INT,EstateID INT) j;

        COMMIT;
    END TRY
    BEGIN CATCH ROLLBACK; THROW; END CATCH
END;
GO

CREATE OR ALTER PROCEDURE usp_FA_AssetMaintenance_Delete @AssetMaintenanceID INT, @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    BEGIN TRANSACTION;
    UPDATE AssetMaintenanceDetail SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE AssetMaintenanceID=@AssetMaintenanceID AND IsActive=1;
    UPDATE AssetMaintenanceCost   SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE AssetMaintenanceID=@AssetMaintenanceID AND IsActive=1;
    UPDATE AssetMaintenance       SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE AssetMaintenanceID=@AssetMaintenanceID AND IsActive=1;
    COMMIT;
END; GO
```

---

## 5. Estimations (with Detail Lines)

```sql
CREATE OR ALTER PROCEDURE usp_FA_Estimation_GetNextCode
AS BEGIN SET NOCOUNT ON;
    DECLARE @LastNum INT;
    SELECT @LastNum=MAX(CAST(SUBSTRING(EstimateCode,5,10) AS INT)) FROM Estimation WHERE EstimateCode LIKE 'EST-%' AND ISNUMERIC(SUBSTRING(EstimateCode,5,10))=1;
    SELECT 'EST-'+RIGHT('0000'+CAST(ISNULL(@LastNum,0)+1 AS VARCHAR),4) AS Code;
END; GO

CREATE OR ALTER PROCEDURE usp_FA_Estimation_GetAll
    @FixedAssetID INT=NULL, @Page INT=1, @PageSize INT=100
AS BEGIN SET NOCOUNT ON;
    DECLARE @Offset INT=(@Page-1)*@PageSize;
    SELECT e.EstimationID AS Id, e.FixedAssetID, fa.FixedAssetCode, fa.FixedAssetName,
        e.EstimateCode, e.TotalEstimatedCost, e.EstimationDate, e.WorkshopID, w.WorkshopName,
        e.GroupID, e.EstateID, e.Status
    FROM Estimation e
    INNER JOIN FixedAsset fa ON fa.FixedAssetID=e.FixedAssetID
    INNER JOIN Workshop   w  ON w.WorkshopID   =e.WorkshopID
    WHERE e.IsActive=1 AND (@FixedAssetID IS NULL OR e.FixedAssetID=@FixedAssetID)
    ORDER BY e.EstimationDate DESC OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
    SELECT COUNT(1) AS Total FROM Estimation WHERE IsActive=1 AND (@FixedAssetID IS NULL OR FixedAssetID=@FixedAssetID);
END; GO

CREATE OR ALTER PROCEDURE usp_FA_Estimation_GetByID @EstimationID INT
AS BEGIN SET NOCOUNT ON;
    SELECT EstimationID AS Id, FixedAssetID, EstimateCode, TotalEstimatedCost, EstimationDate, WorkshopID, GroupID, EstateID, Status
    FROM Estimation WHERE EstimationID=@EstimationID AND IsActive=1;
    SELECT EstimationDetailID AS Id, EstimationID, FixedAssetID, SKUID, Quantity, UnitCost, EstimatedCost, WorkshopID, GroupID, EstateID
    FROM EstimationDetail WHERE EstimationID=@EstimationID AND IsActive=1;
END; GO

-- Insert with OPENJSON detail lines
CREATE OR ALTER PROCEDURE usp_FA_Estimation_Insert
    @FixedAssetID INT, @EstimateCode VARCHAR(20), @TotalEstimatedCost DECIMAL(12,2),
    @EstimationDate DATE, @WorkshopID INT, @GroupID INT, @EstateID INT, @Status VARCHAR(20)='Pending',
    @DetailsJson NVARCHAR(MAX),
    @CreatedBy INT, @NewID INT OUTPUT
AS BEGIN SET NOCOUNT ON;
    IF EXISTS(SELECT 1 FROM Estimation WHERE EstimateCode=@EstimateCode AND IsActive=1) RAISERROR('EstimateCode exists.',16,1);
    BEGIN TRANSACTION;
    BEGIN TRY
        INSERT INTO Estimation(FixedAssetID,EstimateCode,TotalEstimatedCost,EstimationDate,WorkshopID,GroupID,EstateID,Status,CreatedBy)
        VALUES(@FixedAssetID,@EstimateCode,@TotalEstimatedCost,@EstimationDate,@WorkshopID,@GroupID,@EstateID,@Status,@CreatedBy);
        SET @NewID=SCOPE_IDENTITY();
        INSERT INTO EstimationDetail(EstimationID,FixedAssetID,SKUID,Quantity,UnitCost,EstimatedCost,WorkshopID,GroupID,EstateID,CreatedBy)
        SELECT @NewID,@FixedAssetID,CAST(j.SKUID AS INT),CAST(j.Quantity AS DECIMAL(10,3)),CAST(j.UnitCost AS DECIMAL(12,2)),
            CAST(j.EstimatedCost AS DECIMAL(12,2)),CAST(j.WorkshopID AS INT),CAST(j.GroupID AS INT),CAST(j.EstateID AS INT),@CreatedBy
        FROM OPENJSON(@DetailsJson) WITH(SKUID INT,Quantity DECIMAL(10,3),UnitCost DECIMAL(12,2),EstimatedCost DECIMAL(12,2),WorkshopID INT,GroupID INT,EstateID INT) j;
        COMMIT;
    END TRY BEGIN CATCH ROLLBACK; THROW; END CATCH
END; GO

CREATE OR ALTER PROCEDURE usp_FA_Estimation_Delete @EstimationID INT, @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    BEGIN TRANSACTION;
    UPDATE EstimationDetail SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE EstimationID=@EstimationID AND IsActive=1;
    UPDATE Estimation       SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE EstimationID=@EstimationID AND IsActive=1;
    COMMIT;
END; GO
```

---

## 6. Asset Disposal — Atomic Transaction SP

This is the most important SP in the Fixed Asset module. It runs as a single atomic transaction covering 5 business rules.

```sql
-- ─── usp_FA_Disposal_GetNextCode ─────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_FA_Disposal_GetNextCode
AS BEGIN SET NOCOUNT ON;
    DECLARE @LastNum INT;
    SELECT @LastNum=MAX(CAST(SUBSTRING(DisposalCode,4,10) AS INT)) FROM Disposal WHERE DisposalCode LIKE 'AD-%' AND ISNUMERIC(SUBSTRING(DisposalCode,4,10))=1;
    SELECT 'AD-'+RIGHT('0000'+CAST(ISNULL(@LastNum,0)+1 AS VARCHAR),4) AS Code;
END; GO

-- ─── usp_FA_Disposal_GetSummary ──────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_FA_Disposal_GetSummary
    @EstateID INT=NULL
AS BEGIN SET NOCOUNT ON;
    SELECT
        COUNT(1)                 AS DisposalCount,
        ISNULL(SUM(SaleProceeds),0)       AS TotalSaleProceeds,
        ISNULL(SUM(GainLossOnDisposal),0) AS TotalGainLoss
    FROM Disposal
    WHERE IsActive=1 AND (@EstateID IS NULL OR EstateID=@EstateID);
END; GO

-- ─── usp_FA_Disposal_GetAll ───────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_FA_Disposal_GetAll
    @FixedAssetID INT=NULL, @EstateID INT=NULL, @DisposalType VARCHAR(20)=NULL,
    @From DATE=NULL, @To DATE=NULL, @Page INT=1, @PageSize INT=100
AS BEGIN SET NOCOUNT ON;
    DECLARE @Offset INT=(@Page-1)*@PageSize;
    SELECT
        d.DisposalID AS Id, d.DisposalCode, d.FixedAssetID, fa.FixedAssetCode, fa.FixedAssetName,
        d.GroupID, d.EstateID, e.Name AS EstateName, d.DisposalDate, d.DisposalType,
        d.BookValueAtDisposal, d.SaleProceeds, d.GainLossOnDisposal,
        d.DisposalReason, d.ApprovedBy, d.Notes, d.DisposalStatusTypeID, dst.Name AS StatusName
    FROM Disposal d
    INNER JOIN FixedAsset         fa  ON fa.FixedAssetID        = d.FixedAssetID
    INNER JOIN Estate             e   ON e.EstateID             = d.EstateID
    INNER JOIN DisposalStatusType dst ON dst.DisposalStatusTypeID = d.DisposalStatusTypeID
    WHERE d.IsActive=1
        AND (@FixedAssetID  IS NULL OR d.FixedAssetID  = @FixedAssetID)
        AND (@EstateID      IS NULL OR d.EstateID      = @EstateID)
        AND (@DisposalType  IS NULL OR d.DisposalType  = @DisposalType)
        AND (@From IS NULL OR d.DisposalDate >= @From)
        AND (@To   IS NULL OR d.DisposalDate <= @To)
    ORDER BY d.DisposalDate DESC OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
    SELECT COUNT(1) AS Total FROM Disposal WHERE IsActive=1;
END; GO

-- ─── usp_FA_Disposal_Insert ────────────────────────────────────────────────────
-- ATOMIC — 5 business rules in one transaction:
--   1. INSERT Disposal row
--   2. SET FixedAsset.Status = 'Disposed'
--   3. Close all open Depreciation schedules (Status = 'Closed')
--   4. INSERT FixedAssetHistory snapshot (EventType = 'Disposal')
--   5. Unlink Vehicle.FixedAssetID if asset is linked to a vehicle
CREATE OR ALTER PROCEDURE usp_FA_Disposal_Insert
    @DisposalCode          VARCHAR(20),
    @FixedAssetID          INT,
    @GroupID               INT,
    @EstateID              INT,
    @DisposalDate          DATE,
    @DisposalType          VARCHAR(20),
    @BookValueAtDisposal   DECIMAL(15,2),
    @SaleProceeds          DECIMAL(15,2)  = NULL,
    @GainLossOnDisposal    DECIMAL(15,2)  = NULL,
    @DisposalReason        NVARCHAR(1000),
    @ApprovedBy            NVARCHAR(150)  = NULL,
    @Notes                 NVARCHAR(1000) = NULL,
    @DisposalStatusTypeID  INT,
    @CreatedBy             INT,
    @NewID                 INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS(SELECT 1 FROM Disposal WHERE DisposalCode=@DisposalCode AND IsActive=1)
    BEGIN RAISERROR('Disposal code already exists.',16,1); RETURN; END

    IF NOT EXISTS(SELECT 1 FROM FixedAsset WHERE FixedAssetID=@FixedAssetID AND IsActive=1 AND Status<>'Disposed')
    BEGIN RAISERROR('Fixed asset not found or already disposed.',16,1); RETURN; END

    BEGIN TRANSACTION;
    BEGIN TRY

        -- Rule 1: Insert Disposal record
        INSERT INTO Disposal(DisposalCode,FixedAssetID,GroupID,EstateID,DisposalDate,DisposalType,
            BookValueAtDisposal,SaleProceeds,GainLossOnDisposal,DisposalReason,ApprovedBy,Notes,
            DisposalStatusTypeID,CreatedBy)
        VALUES(@DisposalCode,@FixedAssetID,@GroupID,@EstateID,@DisposalDate,@DisposalType,
            @BookValueAtDisposal,@SaleProceeds,@GainLossOnDisposal,@DisposalReason,@ApprovedBy,@Notes,
            @DisposalStatusTypeID,@CreatedBy);
        SET @NewID=SCOPE_IDENTITY();

        -- Rule 2: Mark Fixed Asset as Disposed
        UPDATE FixedAsset
        SET Status='Disposed', ModifiedBy=@CreatedBy, ModifiedDate=GETDATE()
        WHERE FixedAssetID=@FixedAssetID AND IsActive=1;

        -- Rule 3: Close all open Depreciation schedules for this asset
        UPDATE Depreciation
        SET Status='Closed', ModifiedBy=@CreatedBy, ModifiedDate=GETDATE()
        WHERE FixedAssetID=@FixedAssetID AND Status='Active' AND IsActive=1;

        -- Rule 4: Insert immutable FixedAssetHistory snapshot with EventType = 'Disposal'
        INSERT INTO FixedAssetHistory(
            FixedAssetID, FixedAssetTypeID, FixedAssetCategoryID, FixedAssetCode, FixedAssetName,
            GroupID, EstateID, TotalCostOfAsset, ResidualValue, ImplementationCost,
            ImplementationDate, StartDate, UsefulLifeYears, DepreciationValue, LedgerTransactionRef,
            PresentValue, EventType, CreatedBy)
        SELECT
            fa.FixedAssetID, fa.FixedAssetTypeID, fa.FixedAssetCategoryID, fa.FixedAssetCode,
            fa.FixedAssetName, fa.GroupID, fa.EstateID, fa.TotalCostOfAsset, fa.ResidualValue,
            fa.ImplementationCost, fa.ImplementationDate, fa.StartDate, fa.UsefulLifeYears,
            fa.DepreciationValue, fa.LedgerTransactionRef,
            @BookValueAtDisposal,  -- PresentValue = book value at disposal date
            'Disposal', @CreatedBy
        FROM FixedAsset fa WHERE fa.FixedAssetID=@FixedAssetID;

        -- Rule 5: Unlink any Vehicle that references this FixedAsset
        UPDATE Vehicle
        SET FixedAssetID=NULL, ModifiedBy=@CreatedBy, ModifiedDate=GETDATE()
        WHERE FixedAssetID=@FixedAssetID AND IsActive=1;

        COMMIT;
    END TRY
    BEGIN CATCH
        ROLLBACK;
        THROW;
    END CATCH
END;
GO

-- ─── usp_FA_Disposal_Update ───────────────────────────────────────────────────
-- Only status/notes/approvedBy are editable after creation.
CREATE OR ALTER PROCEDURE usp_FA_Disposal_Update
    @DisposalID           INT,
    @DisposalStatusTypeID INT,
    @ApprovedBy           NVARCHAR(150) = NULL,
    @Notes                NVARCHAR(1000) = NULL,
    @ModifiedBy           INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Disposal SET DisposalStatusTypeID=@DisposalStatusTypeID,
        ApprovedBy=@ApprovedBy,Notes=@Notes,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
    WHERE DisposalID=@DisposalID AND IsActive=1;
END;
GO

-- ─── usp_FA_Disposal_Delete ───────────────────────────────────────────────────
-- NOTE: Does NOT reverse FixedAsset.Status — a separate workflow is needed.
CREATE OR ALTER PROCEDURE usp_FA_Disposal_Delete @DisposalID INT, @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    UPDATE Disposal SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE DisposalID=@DisposalID AND IsActive=1;
END; GO
```
