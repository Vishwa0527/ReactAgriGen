# AgriGEN ERP — Stored Procedures: Fleet Module

> All SPs follow the conventions defined in `03-stored-procedures-shared.md`.  
> Complex SPs (Vehicles, Disposal, etc.) are written in full. Simple CRUD SPs that follow the standard pattern are noted with a compact definition.

---

## 1. Vehicles

Vehicles are the most complex Fleet entity: they auto-insert a `VehicleHistory` row on every CREATE and UPDATE, and they link to `FixedAsset`.

```sql
-- ─── usp_Fleet_Vehicle_GetAll ─────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Fleet_Vehicle_GetAll
    @EstateID      INT           = NULL,
    @VehicleTypeID INT           = NULL,
    @Status        VARCHAR(20)   = NULL,
    @Search        NVARCHAR(100) = NULL,
    @Page          INT           = 1,
    @PageSize      INT           = 100
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@Page-1)*@PageSize;

    SELECT
        v.VehicleID          AS Id,
        v.FixedAssetID,
        v.Numbers,
        v.Brand,
        v.Model,
        v.GroupID,
        v.EstateID,
        est.Name             AS EstateName,
        v.VehicleTypeID,
        vt.Name              AS VehicleTypeName,
        v.FixedAssetTypeID,
        fat.AssetTypeName    AS FixedAssetTypeName,
        v.FuelTypeID,
        ft.Name              AS FuelTypeName,
        v.RegisterYear,
        v.Capacity,
        v.Status,
        -- Financial fields from linked FixedAsset (NULL when not linked)
        fa.TotalCostOfAsset  AS CostOfAsset,
        fa.UsefulLifeYears,
        fa.ResidualValue,
        fa.DepreciationValue,
        fa.FixedAssetCode
    FROM Vehicle v
    INNER JOIN Estate           est ON est.EstateID        = v.EstateID
    INNER JOIN VehicleType      vt  ON vt.VehicleTypeID    = v.VehicleTypeID
    INNER JOIN FixedAssetType   fat ON fat.FixedAssetTypeID= v.FixedAssetTypeID
    INNER JOIN FuelType         ft  ON ft.FuelTypeID       = v.FuelTypeID
    LEFT  JOIN FixedAsset       fa  ON fa.FixedAssetID     = v.FixedAssetID AND fa.IsActive=1
    WHERE
        v.IsActive = 1
        AND (@EstateID      IS NULL OR v.EstateID      = @EstateID)
        AND (@VehicleTypeID IS NULL OR v.VehicleTypeID = @VehicleTypeID)
        AND (@Status        IS NULL OR v.Status        = @Status)
        AND (@Search        IS NULL OR v.Numbers LIKE '%'+@Search+'%'
                                    OR v.Brand   LIKE '%'+@Search+'%'
                                    OR v.Model   LIKE '%'+@Search+'%')
    ORDER BY v.Numbers
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;

    SELECT COUNT(1) AS Total FROM Vehicle v
    WHERE v.IsActive=1
        AND (@EstateID      IS NULL OR v.EstateID      = @EstateID)
        AND (@VehicleTypeID IS NULL OR v.VehicleTypeID = @VehicleTypeID)
        AND (@Status        IS NULL OR v.Status        = @Status)
        AND (@Search        IS NULL OR v.Numbers LIKE '%'+@Search+'%'
                                    OR v.Brand   LIKE '%'+@Search+'%'
                                    OR v.Model   LIKE '%'+@Search+'%');
END;
GO

-- ─── usp_Fleet_Vehicle_GetByID ────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Fleet_Vehicle_GetByID
    @VehicleID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        v.VehicleID AS Id, v.FixedAssetID, v.Numbers, v.Brand, v.Model,
        v.GroupID, v.EstateID, v.VehicleTypeID, v.FixedAssetTypeID, v.FuelTypeID,
        v.RegisterYear, v.Capacity, v.Status,
        fa.TotalCostOfAsset AS CostOfAsset, fa.UsefulLifeYears, fa.ResidualValue,
        fa.DepreciationValue, fa.FixedAssetCode, fa.SecondaryFuelTypeID
    FROM Vehicle v
    LEFT JOIN FixedAsset fa ON fa.FixedAssetID = v.FixedAssetID AND fa.IsActive = 1
    WHERE v.VehicleID = @VehicleID AND v.IsActive = 1;
END;
GO

-- ─── usp_Fleet_Vehicle_GetHistory ─────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Fleet_Vehicle_GetHistory
    @VehicleID INT
AS
BEGIN
    SET NOCOUNT ON;
    -- VehicleHistory is stored in FixedAssetHistory for vehicles.
    -- This SP returns the audit trail for the linked FixedAsset.
    SELECT
        fah.FixedAssetHistoryID AS Id,
        fah.FixedAssetID,
        fah.EventType           AS Action,
        fah.CreatedDate         AS [Timestamp],
        fah.FixedAssetCode, fah.FixedAssetName, fah.TotalCostOfAsset,
        fah.ResidualValue, fah.DepreciationValue, fah.UsefulLifeYears,
        fah.PresentValue, fah.LedgerTransactionRef
    FROM Vehicle v
    INNER JOIN FixedAssetHistory fah ON fah.FixedAssetID = v.FixedAssetID
    WHERE v.VehicleID = @VehicleID AND v.IsActive = 1
    ORDER BY fah.CreatedDate DESC;
END;
GO

-- ─── usp_Fleet_Vehicle_Insert ─────────────────────────────────────────────────
-- Business rule: auto-insert a VehicleHistory row (via FixedAssetHistory if linked,
-- or a separate VehicleHistory table if your schema uses one).
-- Here we use FixedAssetHistory to record creation for linked vehicles.
CREATE OR ALTER PROCEDURE usp_Fleet_Vehicle_Insert
    @Numbers         VARCHAR(20),
    @Brand           NVARCHAR(50),
    @Model           NVARCHAR(50),
    @GroupID         INT,
    @EstateID        INT,
    @VehicleTypeID   INT,
    @FixedAssetTypeID INT,
    @FuelTypeID      INT,
    @FixedAssetID    INT          = NULL,
    @RegisterYear    DATE         = NULL,
    @Capacity        VARCHAR(20)  = NULL,
    @Status          VARCHAR(20)  = 'Active',
    @CreatedBy       INT,
    @NewID           INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS(SELECT 1 FROM Vehicle WHERE Numbers=@Numbers AND IsActive=1)
    BEGIN
        RAISERROR('Registration number already exists.',16,1);
        RETURN;
    END

    BEGIN TRANSACTION;
    BEGIN TRY
        INSERT INTO Vehicle(
            Numbers, Brand, Model, GroupID, EstateID, VehicleTypeID, FixedAssetTypeID,
            FuelTypeID, FixedAssetID, RegisterYear, Capacity, Status, CreatedBy)
        VALUES(
            @Numbers, @Brand, @Model, @GroupID, @EstateID, @VehicleTypeID, @FixedAssetTypeID,
            @FuelTypeID, @FixedAssetID, @RegisterYear, @Capacity, @Status, @CreatedBy);

        SET @NewID = SCOPE_IDENTITY();

        -- Record creation in FixedAssetHistory if linked to a FixedAsset
        IF @FixedAssetID IS NOT NULL
        BEGIN
            INSERT INTO FixedAssetHistory(
                FixedAssetID, FixedAssetTypeID, FixedAssetCategoryID, FixedAssetCode, FixedAssetName,
                GroupID, EstateID, TotalCostOfAsset, ResidualValue, ImplementationCost,
                ImplementationDate, StartDate, UsefulLifeYears, DepreciationValue, LedgerTransactionRef,
                PresentValue, EventType, CreatedBy)
            SELECT
                fa.FixedAssetID, fa.FixedAssetTypeID, fa.FixedAssetCategoryID, fa.FixedAssetCode,
                fa.FixedAssetName, fa.GroupID, fa.EstateID, fa.TotalCostOfAsset, fa.ResidualValue,
                fa.ImplementationCost, fa.ImplementationDate, fa.StartDate, fa.UsefulLifeYears,
                fa.DepreciationValue, fa.LedgerTransactionRef, fa.TotalCostOfAsset,
                'Vehicle Created', @CreatedBy
            FROM FixedAsset fa WHERE fa.FixedAssetID = @FixedAssetID;
        END

        COMMIT;
    END TRY
    BEGIN CATCH
        ROLLBACK;
        THROW;
    END CATCH
END;
GO

-- ─── usp_Fleet_Vehicle_Update ─────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Fleet_Vehicle_Update
    @VehicleID        INT,
    @Numbers          VARCHAR(20),
    @Brand            NVARCHAR(50),
    @Model            NVARCHAR(50),
    @GroupID          INT,
    @EstateID         INT,
    @VehicleTypeID    INT,
    @FixedAssetTypeID INT,
    @FuelTypeID       INT,
    @FixedAssetID     INT         = NULL,
    @RegisterYear     DATE        = NULL,
    @Capacity         VARCHAR(20) = NULL,
    @Status           VARCHAR(20),
    @ModifiedBy       INT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS(SELECT 1 FROM Vehicle WHERE Numbers=@Numbers AND VehicleID<>@VehicleID AND IsActive=1)
    BEGIN
        RAISERROR('Registration number in use.',16,1);
        RETURN;
    END

    BEGIN TRANSACTION;
    BEGIN TRY
        UPDATE Vehicle SET
            Numbers=@Numbers, Brand=@Brand, Model=@Model,
            GroupID=@GroupID, EstateID=@EstateID, VehicleTypeID=@VehicleTypeID,
            FixedAssetTypeID=@FixedAssetTypeID, FuelTypeID=@FuelTypeID,
            FixedAssetID=@FixedAssetID, RegisterYear=@RegisterYear,
            Capacity=@Capacity, Status=@Status,
            ModifiedBy=@ModifiedBy, ModifiedDate=GETDATE()
        WHERE VehicleID=@VehicleID AND IsActive=1;

        -- Auto-insert FixedAssetHistory snapshot if linked
        IF @FixedAssetID IS NOT NULL
        BEGIN
            INSERT INTO FixedAssetHistory(
                FixedAssetID, FixedAssetTypeID, FixedAssetCategoryID, FixedAssetCode, FixedAssetName,
                GroupID, EstateID, TotalCostOfAsset, ResidualValue, ImplementationCost,
                ImplementationDate, StartDate, UsefulLifeYears, DepreciationValue,
                LedgerTransactionRef, PresentValue, EventType, CreatedBy)
            SELECT
                fa.FixedAssetID, fa.FixedAssetTypeID, fa.FixedAssetCategoryID, fa.FixedAssetCode,
                fa.FixedAssetName, fa.GroupID, fa.EstateID, fa.TotalCostOfAsset, fa.ResidualValue,
                fa.ImplementationCost, fa.ImplementationDate, fa.StartDate, fa.UsefulLifeYears,
                fa.DepreciationValue, fa.LedgerTransactionRef, fa.TotalCostOfAsset - (
                    SELECT ISNULL(SUM(dh.Value),0) FROM DepreciationHistory dh WHERE dh.FixedAssetID=fa.FixedAssetID AND dh.IsActive=1
                ),
                'Vehicle Updated', @ModifiedBy
            FROM FixedAsset fa WHERE fa.FixedAssetID = @FixedAssetID;
        END

        COMMIT;
    END TRY
    BEGIN CATCH
        ROLLBACK;
        THROW;
    END CATCH
END;
GO

-- ─── usp_Fleet_Vehicle_Delete ─────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Fleet_Vehicle_Delete
    @VehicleID INT, @ModifiedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        -- Soft-delete all children
        UPDATE VehicleDocument       SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE VehicleID=@VehicleID AND IsActive=1;
        UPDATE VehiclePurposeMapping SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE VehicleID=@VehicleID AND IsActive=1;
        UPDATE DriverAssignment      SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE VehicleID=@VehicleID AND IsActive=1;
        UPDATE DailyRunning          SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE VehicleID=@VehicleID AND IsActive=1;

        -- Soft-delete job cards + maintenance records
        UPDATE JobCard SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
            WHERE MaintenanceTaskID IN (SELECT MaintenanceTaskID FROM MaintenanceTask WHERE VehicleID=@VehicleID);
        UPDATE MaintenanceRecordItem SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
            WHERE MaintenanceRecordID IN (SELECT MaintenanceRecordID FROM MaintenanceRecord WHERE VehicleID=@VehicleID);
        UPDATE MaintenanceRecord SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE VehicleID=@VehicleID AND IsActive=1;
        UPDATE VehicleServiceItem SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
            WHERE VehicleServiceID IN (SELECT VehicleServiceID FROM VehicleService WHERE VehicleID=@VehicleID);
        UPDATE VehicleService   SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE VehicleID=@VehicleID AND IsActive=1;
        UPDATE MaintenanceTask  SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE VehicleID=@VehicleID AND IsActive=1;

        -- Soft-delete vehicle
        UPDATE Vehicle SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE VehicleID=@VehicleID AND IsActive=1;
        COMMIT;
    END TRY
    BEGIN CATCH
        ROLLBACK;
        THROW;
    END CATCH
END;
GO
```

---

## 2. Vehicle Documents

```sql
-- ─── usp_Fleet_VehicleDocument_GetAll ─────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Fleet_VehicleDocument_GetAll
    @VehicleID INT = NULL, @Page INT = 1, @PageSize INT = 100
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@Page-1)*@PageSize;
    SELECT
        vd.VehicleDocumentID AS Id,
        vd.VehicleID,
        v.Numbers            AS VehicleNumbers,
        vd.DocumentTypeID,
        dt.Name              AS DocumentTypeName,
        vd.DocNumber,
        vd.StartDate,
        vd.ExpireDate,
        vd.Notes,
        CASE
            WHEN vd.ExpireDate IS NULL THEN NULL
            WHEN vd.ExpireDate < CAST(GETDATE() AS DATE) THEN 'Expired'
            WHEN DATEDIFF(DAY, GETDATE(), vd.ExpireDate) <= 30 THEN 'Expiring Soon'
            ELSE 'Valid'
        END AS ExpiryStatus
    FROM VehicleDocument vd
    INNER JOIN Vehicle      v  ON v.VehicleID     = vd.VehicleID
    INNER JOIN DocumentType dt ON dt.DocumentTypeID = vd.DocumentTypeID
    WHERE vd.IsActive=1 AND (@VehicleID IS NULL OR vd.VehicleID=@VehicleID)
    ORDER BY vd.ExpireDate
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;

    SELECT COUNT(1) AS Total FROM VehicleDocument WHERE IsActive=1 AND (@VehicleID IS NULL OR VehicleID=@VehicleID);
END;
GO

-- ─── usp_Fleet_VehicleDocument_GetByID ───────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Fleet_VehicleDocument_GetByID @VehicleDocumentID INT
AS BEGIN SET NOCOUNT ON;
    SELECT VehicleDocumentID AS Id, VehicleID, DocumentTypeID, DocNumber, StartDate, ExpireDate, Notes
    FROM VehicleDocument WHERE VehicleDocumentID=@VehicleDocumentID AND IsActive=1;
END; GO

-- ─── usp_Fleet_VehicleDocument_Insert ────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Fleet_VehicleDocument_Insert
    @VehicleID INT, @DocumentTypeID INT, @DocNumber VARCHAR(50),
    @StartDate DATE = NULL, @ExpireDate DATE = NULL, @Notes NVARCHAR(500) = NULL,
    @CreatedBy INT, @NewID INT OUTPUT
AS BEGIN SET NOCOUNT ON;
    INSERT INTO VehicleDocument(VehicleID,DocumentTypeID,DocNumber,StartDate,ExpireDate,Notes,CreatedBy)
    VALUES(@VehicleID,@DocumentTypeID,@DocNumber,@StartDate,@ExpireDate,@Notes,@CreatedBy);
    SET @NewID=SCOPE_IDENTITY();
END; GO

-- ─── usp_Fleet_VehicleDocument_Update ────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Fleet_VehicleDocument_Update
    @VehicleDocumentID INT, @VehicleID INT, @DocumentTypeID INT, @DocNumber VARCHAR(50),
    @StartDate DATE = NULL, @ExpireDate DATE = NULL, @Notes NVARCHAR(500) = NULL, @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    UPDATE VehicleDocument SET VehicleID=@VehicleID, DocumentTypeID=@DocumentTypeID,
        DocNumber=@DocNumber, StartDate=@StartDate, ExpireDate=@ExpireDate, Notes=@Notes,
        ModifiedBy=@ModifiedBy, ModifiedDate=GETDATE()
    WHERE VehicleDocumentID=@VehicleDocumentID AND IsActive=1;
END; GO

-- ─── usp_Fleet_VehicleDocument_Delete ────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Fleet_VehicleDocument_Delete @VehicleDocumentID INT, @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    UPDATE VehicleDocument SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
    WHERE VehicleDocumentID=@VehicleDocumentID AND IsActive=1;
END; GO
```

---

## 3. Vehicle Purpose Mappings

```sql
CREATE OR ALTER PROCEDURE usp_Fleet_VehiclePurpose_GetAll
    @VehicleID INT = NULL, @Page INT = 1, @PageSize INT = 100
AS BEGIN SET NOCOUNT ON;
    DECLARE @Offset INT = (@Page-1)*@PageSize;
    SELECT
        vpm.MappingID AS Id, vpm.VehicleID, v.Numbers AS VehicleNumbers,
        vpm.PurposeCategoryID, pc.Name AS PurposeName, vpm.EffectiveDate, vpm.Notes
    FROM VehiclePurposeMapping vpm
    INNER JOIN Vehicle v ON v.VehicleID=vpm.VehicleID
    INNER JOIN PurposeCategory pc ON pc.PurposeCategoryID=vpm.PurposeCategoryID
    WHERE vpm.IsActive=1 AND (@VehicleID IS NULL OR vpm.VehicleID=@VehicleID)
    ORDER BY vpm.EffectiveDate DESC OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
    SELECT COUNT(1) AS Total FROM VehiclePurposeMapping WHERE IsActive=1 AND (@VehicleID IS NULL OR VehicleID=@VehicleID);
END; GO

CREATE OR ALTER PROCEDURE usp_Fleet_VehiclePurpose_Insert
    @VehicleID INT, @PurposeCategoryID INT, @EffectiveDate DATE, @Notes NVARCHAR(500)=NULL,
    @CreatedBy INT, @NewID INT OUTPUT
AS BEGIN SET NOCOUNT ON;
    INSERT INTO VehiclePurposeMapping(VehicleID,PurposeCategoryID,EffectiveDate,Notes,CreatedBy)
    VALUES(@VehicleID,@PurposeCategoryID,@EffectiveDate,@Notes,@CreatedBy);
    SET @NewID=SCOPE_IDENTITY();
END; GO

CREATE OR ALTER PROCEDURE usp_Fleet_VehiclePurpose_Update
    @MappingID INT, @VehicleID INT, @PurposeCategoryID INT, @EffectiveDate DATE,
    @Notes NVARCHAR(500)=NULL, @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    UPDATE VehiclePurposeMapping SET VehicleID=@VehicleID,PurposeCategoryID=@PurposeCategoryID,
        EffectiveDate=@EffectiveDate,Notes=@Notes,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
    WHERE MappingID=@MappingID AND IsActive=1;
END; GO

CREATE OR ALTER PROCEDURE usp_Fleet_VehiclePurpose_Delete @MappingID INT, @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    UPDATE VehiclePurposeMapping SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
    WHERE MappingID=@MappingID AND IsActive=1;
END; GO
```

---

## 4. Drivers

```sql
-- ─── usp_Fleet_Driver_GetAll ──────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Fleet_Driver_GetAll
    @Search NVARCHAR(100) = NULL, @Page INT = 1, @PageSize INT = 100
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@Page-1)*@PageSize;
    SELECT
        d.DriverID AS Id, d.Code, d.EmployeeID, d.Name, d.LicenseNo,
        d.LicenseCategoryID, lc.Name AS LicenseCategoryName,
        d.LicExpireDate AS LicenseExpiry, d.Status, d.Notes
    FROM Driver d
    INNER JOIN LicenseCategory lc ON lc.LicenseCategoryID=d.LicenseCategoryID
    WHERE d.IsActive=1
        AND (@Search IS NULL OR d.Code LIKE '%'+@Search+'%' OR d.Name LIKE '%'+@Search+'%' OR d.LicenseNo LIKE '%'+@Search+'%')
    ORDER BY d.Name
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
    SELECT COUNT(1) AS Total FROM Driver WHERE IsActive=1;
END; GO

CREATE OR ALTER PROCEDURE usp_Fleet_Driver_GetByID @DriverID INT
AS BEGIN SET NOCOUNT ON;
    SELECT DriverID AS Id, Code, EmployeeID, Name, LicenseNo, LicenseCategoryID, LicExpireDate AS LicenseExpiry, Status, Notes
    FROM Driver WHERE DriverID=@DriverID AND IsActive=1;
END; GO

CREATE OR ALTER PROCEDURE usp_Fleet_Driver_Insert
    @Code VARCHAR(10), @EmployeeID INT, @Name NVARCHAR(150), @LicenseNo VARCHAR(30),
    @LicenseCategoryID INT, @LicExpireDate DATE, @Status VARCHAR(20), @Notes NVARCHAR(500)=NULL,
    @CreatedBy INT, @NewID INT OUTPUT
AS BEGIN SET NOCOUNT ON;
    IF EXISTS(SELECT 1 FROM Driver WHERE Code=@Code AND IsActive=1) RAISERROR('Driver code exists.',16,1);
    INSERT INTO Driver(Code,EmployeeID,Name,LicenseNo,LicenseCategoryID,LicExpireDate,Status,Notes,CreatedBy)
    VALUES(@Code,@EmployeeID,@Name,@LicenseNo,@LicenseCategoryID,@LicExpireDate,@Status,@Notes,@CreatedBy);
    SET @NewID=SCOPE_IDENTITY();
END; GO

CREATE OR ALTER PROCEDURE usp_Fleet_Driver_Update
    @DriverID INT, @Code VARCHAR(10), @EmployeeID INT, @Name NVARCHAR(150), @LicenseNo VARCHAR(30),
    @LicenseCategoryID INT, @LicExpireDate DATE, @Status VARCHAR(20), @Notes NVARCHAR(500)=NULL, @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    IF EXISTS(SELECT 1 FROM Driver WHERE Code=@Code AND DriverID<>@DriverID AND IsActive=1) RAISERROR('Code in use.',16,1);
    UPDATE Driver SET Code=@Code,EmployeeID=@EmployeeID,Name=@Name,LicenseNo=@LicenseNo,
        LicenseCategoryID=@LicenseCategoryID,LicExpireDate=@LicExpireDate,Status=@Status,Notes=@Notes,
        ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
    WHERE DriverID=@DriverID AND IsActive=1;
END; GO

CREATE OR ALTER PROCEDURE usp_Fleet_Driver_Delete @DriverID INT, @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    BEGIN TRANSACTION;
    UPDATE DriverAssignment SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE DriverID=@DriverID AND IsActive=1;
    UPDATE Driver           SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE DriverID=@DriverID AND IsActive=1;
    COMMIT;
END; GO
```

---

## 5. Driver Assignments

```sql
CREATE OR ALTER PROCEDURE usp_Fleet_DriverAssignment_GetAll
    @VehicleID INT=NULL, @DriverID INT=NULL, @ActiveOnly BIT=0, @Page INT=1, @PageSize INT=100
AS BEGIN SET NOCOUNT ON;
    DECLARE @Offset INT=(@Page-1)*@PageSize;
    SELECT
        da.AssignmentID AS Id, da.VehicleID, v.Numbers AS VehicleNumbers,
        da.DriverID, d.Name AS DriverName, d.Code AS DriverCode,
        da.StartDate, da.EndDate, da.Notes
    FROM DriverAssignment da
    INNER JOIN Vehicle v ON v.VehicleID=da.VehicleID
    INNER JOIN Driver  d ON d.DriverID =da.DriverID
    WHERE da.IsActive=1
        AND (@VehicleID IS NULL OR da.VehicleID=@VehicleID)
        AND (@DriverID  IS NULL OR da.DriverID =@DriverID)
        AND (@ActiveOnly=0 OR da.EndDate IS NULL)
    ORDER BY da.StartDate DESC OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
    SELECT COUNT(1) AS Total FROM DriverAssignment da
    WHERE da.IsActive=1 AND (@VehicleID IS NULL OR da.VehicleID=@VehicleID)
        AND (@DriverID IS NULL OR da.DriverID=@DriverID) AND (@ActiveOnly=0 OR da.EndDate IS NULL);
END; GO

CREATE OR ALTER PROCEDURE usp_Fleet_DriverAssignment_Insert
    @VehicleID INT, @DriverID INT, @StartDate DATE, @EndDate DATE=NULL, @Notes NVARCHAR(500)=NULL,
    @CreatedBy INT, @NewID INT OUTPUT
AS BEGIN SET NOCOUNT ON;
    INSERT INTO DriverAssignment(VehicleID,DriverID,StartDate,EndDate,Notes,CreatedBy)
    VALUES(@VehicleID,@DriverID,@StartDate,@EndDate,@Notes,@CreatedBy);
    SET @NewID=SCOPE_IDENTITY();
END; GO

CREATE OR ALTER PROCEDURE usp_Fleet_DriverAssignment_Update
    @AssignmentID INT, @VehicleID INT, @DriverID INT, @StartDate DATE,
    @EndDate DATE=NULL, @Notes NVARCHAR(500)=NULL, @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    UPDATE DriverAssignment SET VehicleID=@VehicleID,DriverID=@DriverID,StartDate=@StartDate,
        EndDate=@EndDate,Notes=@Notes,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
    WHERE AssignmentID=@AssignmentID AND IsActive=1;
END; GO

CREATE OR ALTER PROCEDURE usp_Fleet_DriverAssignment_Delete @AssignmentID INT, @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    UPDATE DriverAssignment SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE AssignmentID=@AssignmentID AND IsActive=1;
END; GO
```

---

## 6. Daily Running

```sql
-- ─── usp_Fleet_DailyRunning_GetNextCode ──────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Fleet_DailyRunning_GetNextCode
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Year    CHAR(4) = CAST(YEAR(GETDATE()) AS CHAR(4));
    DECLARE @LastNum INT;

    SELECT @LastNum = MAX(CAST(SUBSTRING(RefCode, LEN('DR-'+@Year+'-')+1, 4) AS INT))
    FROM DailyRunning
    WHERE RefCode LIKE 'DR-'+@Year+'-%' AND ISNUMERIC(SUBSTRING(RefCode, LEN('DR-'+@Year+'-')+1, 4))=1;

    SELECT 'DR-'+@Year+'-'+RIGHT('0000'+CAST(ISNULL(@LastNum,0)+1 AS VARCHAR),4) AS Code;
END;
GO

CREATE OR ALTER PROCEDURE usp_Fleet_DailyRunning_GetAll
    @VehicleID INT=NULL, @DriverID INT=NULL,
    @From DATE=NULL, @To DATE=NULL,
    @Page INT=1, @PageSize INT=100
AS BEGIN SET NOCOUNT ON;
    DECLARE @Offset INT=(@Page-1)*@PageSize;
    SELECT
        dr.DailyRunningID AS Id, dr.RefCode, dr.VehicleID, v.Numbers AS VehicleNumbers,
        dr.DriverID, d.Name AS DriverName, dr.StartDateTime, dr.EndDateTime,
        dr.StartOdo, dr.EndOdo, dr.Notes,
        CASE WHEN dr.EndOdo IS NOT NULL AND dr.StartOdo IS NOT NULL THEN dr.EndOdo - dr.StartOdo ELSE NULL END AS KmTravelled
    FROM DailyRunning dr
    INNER JOIN Vehicle v ON v.VehicleID=dr.VehicleID
    INNER JOIN Driver  d ON d.DriverID =dr.DriverID
    WHERE dr.IsActive=1
        AND (@VehicleID IS NULL OR dr.VehicleID=@VehicleID)
        AND (@DriverID  IS NULL OR dr.DriverID =@DriverID)
        AND (@From IS NULL OR CAST(dr.StartDateTime AS DATE) >= @From)
        AND (@To   IS NULL OR CAST(dr.StartDateTime AS DATE) <= @To)
    ORDER BY dr.StartDateTime DESC OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
    SELECT COUNT(1) AS Total FROM DailyRunning WHERE IsActive=1;
END; GO

CREATE OR ALTER PROCEDURE usp_Fleet_DailyRunning_Insert
    @RefCode VARCHAR(20), @VehicleID INT, @DriverID INT, @StartDateTime DATETIME,
    @EndDateTime DATETIME=NULL, @StartOdo INT, @EndOdo INT=NULL, @Notes NVARCHAR(500)=NULL,
    @CreatedBy INT, @NewID INT OUTPUT
AS BEGIN SET NOCOUNT ON;
    IF EXISTS(SELECT 1 FROM DailyRunning WHERE RefCode=@RefCode AND IsActive=1) RAISERROR('RefCode exists.',16,1);
    INSERT INTO DailyRunning(RefCode,VehicleID,DriverID,StartDateTime,EndDateTime,StartOdo,EndOdo,Notes,CreatedBy)
    VALUES(@RefCode,@VehicleID,@DriverID,@StartDateTime,@EndDateTime,@StartOdo,@EndOdo,@Notes,@CreatedBy);
    SET @NewID=SCOPE_IDENTITY();
END; GO

CREATE OR ALTER PROCEDURE usp_Fleet_DailyRunning_Update
    @DailyRunningID INT, @VehicleID INT, @DriverID INT, @StartDateTime DATETIME,
    @EndDateTime DATETIME=NULL, @StartOdo INT, @EndOdo INT=NULL, @Notes NVARCHAR(500)=NULL, @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    UPDATE DailyRunning SET VehicleID=@VehicleID,DriverID=@DriverID,
        StartDateTime=@StartDateTime,EndDateTime=@EndDateTime,
        StartOdo=@StartOdo,EndOdo=@EndOdo,Notes=@Notes,
        ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
    WHERE DailyRunningID=@DailyRunningID AND IsActive=1;
END; GO

CREATE OR ALTER PROCEDURE usp_Fleet_DailyRunning_Delete @DailyRunningID INT, @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    UPDATE DailyRunning SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE DailyRunningID=@DailyRunningID AND IsActive=1;
END; GO
```

---

## 7. Maintenance Tasks

```sql
-- ─── usp_Fleet_MaintenanceTask_GetNextCode ────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Fleet_MaintenanceTask_GetNextCode
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @LastNum INT;
    SELECT @LastNum = MAX(CAST(SUBSTRING(RefCode, 4, 10) AS INT)) FROM MaintenanceTask WHERE RefCode LIKE 'MT-%' AND ISNUMERIC(SUBSTRING(RefCode, 4, 10))=1;
    SELECT 'MT-'+RIGHT('0000'+CAST(ISNULL(@LastNum,0)+1 AS VARCHAR),4) AS Code;
END; GO

-- ─── usp_Fleet_MaintenanceTask_GetAll ────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Fleet_MaintenanceTask_GetAll
    @VehicleID INT=NULL, @WorkshopID INT=NULL, @TaskType VARCHAR(20)=NULL,
    @Page INT=1, @PageSize INT=100
AS BEGIN SET NOCOUNT ON;
    DECLARE @Offset INT=(@Page-1)*@PageSize;
    SELECT
        mt.MaintenanceTaskID AS Id, mt.RefCode, mt.[Date], mt.VehicleID, v.Numbers AS VehicleNumbers,
        mt.WorkshopID, w.WorkshopName, mt.Mode, mt.TaskType, mt.CostTotal, mt.Notes
    FROM MaintenanceTask mt
    INNER JOIN Vehicle  v ON v.VehicleID =mt.VehicleID
    INNER JOIN Workshop w ON w.WorkshopID=mt.WorkshopID
    WHERE mt.IsActive=1
        AND (@VehicleID  IS NULL OR mt.VehicleID =@VehicleID)
        AND (@WorkshopID IS NULL OR mt.WorkshopID=@WorkshopID)
        AND (@TaskType   IS NULL OR mt.TaskType  =@TaskType)
    ORDER BY mt.[Date] DESC OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
    SELECT COUNT(1) AS Total FROM MaintenanceTask WHERE IsActive=1;
END; GO

CREATE OR ALTER PROCEDURE usp_Fleet_MaintenanceTask_GetByID @MaintenanceTaskID INT
AS BEGIN SET NOCOUNT ON;
    SELECT MaintenanceTaskID AS Id, RefCode, [Date], VehicleID, WorkshopID, Mode, TaskType, CostTotal, Notes
    FROM MaintenanceTask WHERE MaintenanceTaskID=@MaintenanceTaskID AND IsActive=1;
END; GO

CREATE OR ALTER PROCEDURE usp_Fleet_MaintenanceTask_Insert
    @RefCode VARCHAR(20), @Date DATE, @VehicleID INT, @WorkshopID INT,
    @Mode VARCHAR(20), @TaskType VARCHAR(20), @CostTotal DECIMAL(12,2), @Notes NVARCHAR(1000)=NULL,
    @CreatedBy INT, @NewID INT OUTPUT
AS BEGIN SET NOCOUNT ON;
    IF EXISTS(SELECT 1 FROM MaintenanceTask WHERE RefCode=@RefCode AND IsActive=1) RAISERROR('RefCode exists.',16,1);
    INSERT INTO MaintenanceTask(RefCode,[Date],VehicleID,WorkshopID,Mode,TaskType,CostTotal,Notes,CreatedBy)
    VALUES(@RefCode,@Date,@VehicleID,@WorkshopID,@Mode,@TaskType,@CostTotal,@Notes,@CreatedBy);
    SET @NewID=SCOPE_IDENTITY();
END; GO

CREATE OR ALTER PROCEDURE usp_Fleet_MaintenanceTask_Update
    @MaintenanceTaskID INT, @RefCode VARCHAR(20), @Date DATE, @VehicleID INT,
    @WorkshopID INT, @Mode VARCHAR(20), @TaskType VARCHAR(20), @CostTotal DECIMAL(12,2),
    @Notes NVARCHAR(1000)=NULL, @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    IF EXISTS(SELECT 1 FROM MaintenanceTask WHERE RefCode=@RefCode AND MaintenanceTaskID<>@MaintenanceTaskID AND IsActive=1) RAISERROR('RefCode in use.',16,1);
    UPDATE MaintenanceTask SET RefCode=@RefCode,[Date]=@Date,VehicleID=@VehicleID,WorkshopID=@WorkshopID,
        Mode=@Mode,TaskType=@TaskType,CostTotal=@CostTotal,Notes=@Notes,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
    WHERE MaintenanceTaskID=@MaintenanceTaskID AND IsActive=1;
END; GO

CREATE OR ALTER PROCEDURE usp_Fleet_MaintenanceTask_Delete @MaintenanceTaskID INT, @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    BEGIN TRANSACTION;
    UPDATE JobCard              SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE MaintenanceTaskID=@MaintenanceTaskID AND IsActive=1;
    UPDATE MaintenanceRecordItem SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
        WHERE MaintenanceRecordID IN (SELECT MaintenanceRecordID FROM MaintenanceRecord WHERE MaintenanceTaskID=@MaintenanceTaskID);
    UPDATE MaintenanceRecord    SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE MaintenanceTaskID=@MaintenanceTaskID AND IsActive=1;
    UPDATE VehicleServiceItem   SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
        WHERE VehicleServiceID IN (SELECT VehicleServiceID FROM VehicleService WHERE MaintenanceTaskID=@MaintenanceTaskID);
    UPDATE VehicleService       SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE MaintenanceTaskID=@MaintenanceTaskID AND IsActive=1;
    UPDATE MaintenanceTask      SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE MaintenanceTaskID=@MaintenanceTaskID AND IsActive=1;
    COMMIT;
END; GO
```

---

## 8. Job Cards

```sql
CREATE OR ALTER PROCEDURE usp_Fleet_JobCard_GetAll
    @MaintenanceTaskID INT=NULL, @Page INT=1, @PageSize INT=100
AS BEGIN SET NOCOUNT ON;
    DECLARE @Offset INT=(@Page-1)*@PageSize;
    SELECT jc.JobCardID AS Id, jc.MaintenanceTaskID, mt.RefCode AS TaskRefCode,
        jc.VehicleID, v.Numbers, jc.WorkshopID, w.WorkshopName,
        jc.EmployeeID, jc.StartTime, jc.EndTime, jc.Description, jc.CostOfService
    FROM JobCard jc
    INNER JOIN MaintenanceTask mt ON mt.MaintenanceTaskID=jc.MaintenanceTaskID
    INNER JOIN Vehicle v ON v.VehicleID=jc.VehicleID
    INNER JOIN Workshop w ON w.WorkshopID=jc.WorkshopID
    WHERE jc.IsActive=1 AND (@MaintenanceTaskID IS NULL OR jc.MaintenanceTaskID=@MaintenanceTaskID)
    ORDER BY jc.StartTime DESC OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
    SELECT COUNT(1) AS Total FROM JobCard WHERE IsActive=1 AND (@MaintenanceTaskID IS NULL OR MaintenanceTaskID=@MaintenanceTaskID);
END; GO

CREATE OR ALTER PROCEDURE usp_Fleet_JobCard_Insert
    @MaintenanceTaskID INT, @VehicleID INT, @WorkshopID INT, @EmployeeID INT,
    @StartTime DATETIME, @EndTime DATETIME=NULL, @Description NVARCHAR(1000)=NULL,
    @CostOfService DECIMAL(12,2), @CreatedBy INT, @NewID INT OUTPUT
AS BEGIN SET NOCOUNT ON;
    INSERT INTO JobCard(MaintenanceTaskID,VehicleID,WorkshopID,EmployeeID,StartTime,EndTime,Description,CostOfService,CreatedBy)
    VALUES(@MaintenanceTaskID,@VehicleID,@WorkshopID,@EmployeeID,@StartTime,@EndTime,@Description,@CostOfService,@CreatedBy);
    SET @NewID=SCOPE_IDENTITY();
END; GO

CREATE OR ALTER PROCEDURE usp_Fleet_JobCard_Update
    @JobCardID INT, @EmployeeID INT, @StartTime DATETIME, @EndTime DATETIME=NULL,
    @Description NVARCHAR(1000)=NULL, @CostOfService DECIMAL(12,2), @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    UPDATE JobCard SET EmployeeID=@EmployeeID,StartTime=@StartTime,EndTime=@EndTime,
        Description=@Description,CostOfService=@CostOfService,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
    WHERE JobCardID=@JobCardID AND IsActive=1;
END; GO

CREATE OR ALTER PROCEDURE usp_Fleet_JobCard_Delete @JobCardID INT, @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    UPDATE JobCard SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE JobCardID=@JobCardID AND IsActive=1;
END; GO
```

---

## 9. Maintenance Records (with line items)

```sql
-- ─── usp_Fleet_MaintenanceRecord_GetByID (header + items) ─────────────────────
CREATE OR ALTER PROCEDURE usp_Fleet_MaintenanceRecord_GetByID @MaintenanceRecordID INT
AS BEGIN SET NOCOUNT ON;
    -- Header
    SELECT MaintenanceRecordID AS Id, MaintenanceTaskID, VehicleID, WorkshopID, [Date], CostOfService, Description
    FROM MaintenanceRecord WHERE MaintenanceRecordID=@MaintenanceRecordID AND IsActive=1;
    -- Items
    SELECT ItemID AS Id, MaintenanceRecordID, SKUID, Quantity, UnitCost,
        Source, ItemIssueRef, HasRemovedItem, RemovedSKUID, RemovedQuantity, RemovedUnitCost
    FROM MaintenanceRecordItem WHERE MaintenanceRecordID=@MaintenanceRecordID AND IsActive=1;
END; GO

-- ─── usp_Fleet_MaintenanceRecord_Insert ──────────────────────────────────────
-- Items are passed as a JSON array string and parsed with OPENJSON
CREATE OR ALTER PROCEDURE usp_Fleet_MaintenanceRecord_Insert
    @MaintenanceTaskID INT,
    @VehicleID         INT,
    @WorkshopID        INT,
    @Date              DATE,
    @CostOfService     DECIMAL(12,2),
    @Description       NVARCHAR(1000) = NULL,
    @ItemsJson         NVARCHAR(MAX),    -- JSON array of items
    @CreatedBy         INT,
    @NewID             INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        INSERT INTO MaintenanceRecord(MaintenanceTaskID,VehicleID,WorkshopID,[Date],CostOfService,Description,CreatedBy)
        VALUES(@MaintenanceTaskID,@VehicleID,@WorkshopID,@Date,@CostOfService,@Description,@CreatedBy);

        SET @NewID = SCOPE_IDENTITY();

        INSERT INTO MaintenanceRecordItem(MaintenanceRecordID,SKUID,Quantity,UnitCost,Source,ItemIssueRef,
            HasRemovedItem,RemovedSKUID,RemovedQuantity,RemovedUnitCost,CreatedBy)
        SELECT
            @NewID,
            CAST(j.SKUID             AS INT),
            CAST(j.Quantity          AS DECIMAL(10,3)),
            CAST(j.UnitCost          AS DECIMAL(12,2)),
            j.Source,
            j.ItemIssueRef,
            CAST(ISNULL(j.HasRemovedItem,0) AS BIT),
            CAST(j.RemovedSKUID      AS INT),
            CAST(j.RemovedQuantity   AS DECIMAL(10,3)),
            CAST(j.RemovedUnitCost   AS DECIMAL(12,2)),
            @CreatedBy
        FROM OPENJSON(@ItemsJson) WITH (
            SKUID          INT,
            Quantity       DECIMAL(10,3),
            UnitCost       DECIMAL(12,2),
            Source         VARCHAR(20),
            ItemIssueRef   VARCHAR(50),
            HasRemovedItem BIT,
            RemovedSKUID   INT,
            RemovedQuantity DECIMAL(10,3),
            RemovedUnitCost DECIMAL(12,2)
        ) j;

        COMMIT;
    END TRY
    BEGIN CATCH
        ROLLBACK;
        THROW;
    END CATCH
END;
GO

-- ─── usp_Fleet_MaintenanceRecord_Update ──────────────────────────────────────
-- Strategy: soft-delete existing items, re-insert from new JSON
CREATE OR ALTER PROCEDURE usp_Fleet_MaintenanceRecord_Update
    @MaintenanceRecordID INT,
    @Date                DATE,
    @CostOfService       DECIMAL(12,2),
    @Description         NVARCHAR(1000) = NULL,
    @ItemsJson           NVARCHAR(MAX),
    @ModifiedBy          INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        UPDATE MaintenanceRecord SET [Date]=@Date,CostOfService=@CostOfService,Description=@Description,
            ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
        WHERE MaintenanceRecordID=@MaintenanceRecordID AND IsActive=1;

        -- Soft-delete old items
        UPDATE MaintenanceRecordItem SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
        WHERE MaintenanceRecordID=@MaintenanceRecordID AND IsActive=1;

        -- Insert fresh items
        INSERT INTO MaintenanceRecordItem(MaintenanceRecordID,SKUID,Quantity,UnitCost,Source,ItemIssueRef,
            HasRemovedItem,RemovedSKUID,RemovedQuantity,RemovedUnitCost,CreatedBy)
        SELECT @MaintenanceRecordID,
            CAST(j.SKUID AS INT),CAST(j.Quantity AS DECIMAL(10,3)),CAST(j.UnitCost AS DECIMAL(12,2)),
            j.Source,j.ItemIssueRef,CAST(ISNULL(j.HasRemovedItem,0) AS BIT),
            CAST(j.RemovedSKUID AS INT),CAST(j.RemovedQuantity AS DECIMAL(10,3)),CAST(j.RemovedUnitCost AS DECIMAL(12,2)),
            @ModifiedBy
        FROM OPENJSON(@ItemsJson) WITH (
            SKUID INT, Quantity DECIMAL(10,3), UnitCost DECIMAL(12,2), Source VARCHAR(20),
            ItemIssueRef VARCHAR(50), HasRemovedItem BIT, RemovedSKUID INT,
            RemovedQuantity DECIMAL(10,3), RemovedUnitCost DECIMAL(12,2)
        ) j;

        COMMIT;
    END TRY
    BEGIN CATCH ROLLBACK; THROW; END CATCH
END;
GO
```

---

## 10. Vehicle Service (with line items)

> Same OPENJSON pattern as MaintenanceRecord. Items table: `VehicleServiceItem`. Key difference: includes `Odometer`, `NextServiceDate`, `NextServiceOdo`.

```sql
CREATE OR ALTER PROCEDURE usp_Fleet_VehicleService_Insert
    @MaintenanceTaskID INT, @VehicleID INT, @WorkshopID INT,
    @ServiceDate DATE, @Odometer INT, @NextServiceDate DATE=NULL, @NextServiceOdo INT=NULL,
    @CostAmount DECIMAL(12,2), @Notes NVARCHAR(1000)=NULL,
    @ItemsJson NVARCHAR(MAX),
    @CreatedBy INT, @NewID INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        INSERT INTO VehicleService(MaintenanceTaskID,VehicleID,WorkshopID,ServiceDate,Odometer,
            NextServiceDate,NextServiceOdo,CostAmount,Notes,CreatedBy)
        VALUES(@MaintenanceTaskID,@VehicleID,@WorkshopID,@ServiceDate,@Odometer,
            @NextServiceDate,@NextServiceOdo,@CostAmount,@Notes,@CreatedBy);
        SET @NewID=SCOPE_IDENTITY();

        INSERT INTO VehicleServiceItem(VehicleServiceID,SKUID,Quantity,UnitCost,Source,ItemIssueRef,
            HasRemovedItem,RemovedSKUID,RemovedQuantity,RemovedUnitCost,CreatedBy)
        SELECT @NewID,
            CAST(j.SKUID AS INT),CAST(j.Quantity AS DECIMAL(10,3)),CAST(j.UnitCost AS DECIMAL(12,2)),
            j.Source,j.ItemIssueRef,CAST(ISNULL(j.HasRemovedItem,0) AS BIT),
            CAST(j.RemovedSKUID AS INT),CAST(j.RemovedQuantity AS DECIMAL(10,3)),CAST(j.RemovedUnitCost AS DECIMAL(12,2)),
            @CreatedBy
        FROM OPENJSON(@ItemsJson) WITH (
            SKUID INT, Quantity DECIMAL(10,3), UnitCost DECIMAL(12,2), Source VARCHAR(20),
            ItemIssueRef VARCHAR(50), HasRemovedItem BIT, RemovedSKUID INT,
            RemovedQuantity DECIMAL(10,3), RemovedUnitCost DECIMAL(12,2)
        ) j;

        COMMIT;
    END TRY
    BEGIN CATCH ROLLBACK; THROW; END CATCH
END;
GO

-- Update: same soft-delete + re-insert pattern as MaintenanceRecord
-- Delete: soft-delete VehicleServiceItem then VehicleService
```

---

## 11. Item Issues (with line items)

```sql
-- ─── usp_Fleet_ItemIssue_GetNextCode ─────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Fleet_ItemIssue_GetNextCode
AS BEGIN SET NOCOUNT ON;
    DECLARE @Year CHAR(4)=CAST(YEAR(GETDATE()) AS CHAR(4)); DECLARE @LastNum INT;
    SELECT @LastNum=MAX(CAST(SUBSTRING(RefCode,LEN('II-'+@Year+'-')+1,4) AS INT))
    FROM ItemIssue WHERE RefCode LIKE 'II-'+@Year+'-%' AND ISNUMERIC(SUBSTRING(RefCode,LEN('II-'+@Year+'-')+1,4))=1;
    SELECT 'II-'+@Year+'-'+RIGHT('0000'+CAST(ISNULL(@LastNum,0)+1 AS VARCHAR),4) AS Code;
END; GO

-- Insert: OPENJSON pattern — header + items array
-- After insert, also update WorkshopInventory.AvailableBalance += quantity if IssueType='Workshop'
CREATE OR ALTER PROCEDURE usp_Fleet_ItemIssue_Insert
    @RefCode    VARCHAR(20),
    @IssueDate  DATE,
    @IssueType  VARCHAR(20),
    @TargetID   INT,
    @Notes      NVARCHAR(500) = NULL,
    @ItemsJson  NVARCHAR(MAX),
    @CreatedBy  INT,
    @NewID      INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS(SELECT 1 FROM ItemIssue WHERE RefCode=@RefCode AND IsActive=1) RAISERROR('RefCode exists.',16,1);
    BEGIN TRANSACTION;
    BEGIN TRY
        INSERT INTO ItemIssue(RefCode,IssueDate,IssueType,TargetID,Notes,CreatedBy)
        VALUES(@RefCode,@IssueDate,@IssueType,@TargetID,@Notes,@CreatedBy);
        SET @NewID=SCOPE_IDENTITY();

        -- Insert line items
        INSERT INTO ItemIssueItem(ItemIssueID,SKUID,Quantity,UnitCost,CreatedBy)
        SELECT @NewID,CAST(j.SKUID AS INT),CAST(j.Quantity AS DECIMAL(10,3)),CAST(j.UnitCost AS DECIMAL(12,2)),@CreatedBy
        FROM OPENJSON(@ItemsJson) WITH(SKUID INT,Quantity DECIMAL(10,3),UnitCost DECIMAL(12,2)) j;

        -- If Workshop issue: bump available balance on WorkshopInventory
        IF @IssueType='Workshop'
        BEGIN
            UPDATE wi SET
                wi.AvailableBalance = wi.AvailableBalance + j.Quantity,
                wi.UnitCost         = j.UnitCost,
                wi.ModifiedBy       = @CreatedBy,
                wi.ModifiedDate     = GETDATE()
            FROM WorkshopInventory wi
            INNER JOIN (
                SELECT CAST(j.SKUID AS INT) SKUID, CAST(j.Quantity AS DECIMAL(10,3)) Quantity,
                       CAST(j.UnitCost AS DECIMAL(12,2)) UnitCost
                FROM OPENJSON(@ItemsJson) WITH(SKUID INT, Quantity DECIMAL(10,3), UnitCost DECIMAL(12,2)) j
            ) j ON j.SKUID=wi.SKUID AND wi.WorkshopID=@TargetID AND wi.IsActive=1;

            -- Also insert FIFO batch rows in WorkshopInventoryDetail
            INSERT INTO WorkshopInventoryDetail(WorkshopInventoryID,WorkshopID,SKUID,WarehouseSKUMappingID,
                ItemIssueID,ItemIssueReference,Quantity,UnitCost,GroupID,EstateID,CreatedBy)
            SELECT wi.WorkshopInventoryID,wi.WorkshopID,j.SKUID,wi.WarehouseSKUMappingID,
                @NewID,@RefCode,j.Quantity,j.UnitCost,wi.GroupID,wi.EstateID,@CreatedBy
            FROM WorkshopInventory wi
            INNER JOIN (
                SELECT CAST(j.SKUID AS INT) SKUID,CAST(j.Quantity AS DECIMAL(10,3)) Quantity,
                       CAST(j.UnitCost AS DECIMAL(12,2)) UnitCost
                FROM OPENJSON(@ItemsJson) WITH(SKUID INT,Quantity DECIMAL(10,3),UnitCost DECIMAL(12,2)) j
            ) j ON j.SKUID=wi.SKUID AND wi.WorkshopID=@TargetID AND wi.IsActive=1;
        END

        COMMIT;
    END TRY
    BEGIN CATCH ROLLBACK; THROW; END CATCH
END;
GO
```
