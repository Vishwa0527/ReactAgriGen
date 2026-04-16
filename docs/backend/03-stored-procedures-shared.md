# AgriGEN ERP — Stored Procedures: Shared & Auth

> **Convention for all SPs:**
> - Parameters prefixed `@`
> - `@CreatedBy` / `@ModifiedBy` = authenticated user's `EmployeeID` passed from the API layer
> - Every list SP uses `WHERE IsActive = 1` and supports optional `@Search`, `@Page`, `@PageSize`
> - Every delete SP is a **soft delete** (`IsActive = 0`, `ModifiedBy`, `ModifiedDate`)
> - Output parameter `@NewID INT OUTPUT` returns the new identity on INSERT

---

## SP Naming Convention

```
usp_{Module}_{Entity}_{Action}

Examples:
  usp_Shared_VehicleType_GetAll
  usp_Fleet_Vehicle_Insert
  usp_FA_FixedAsset_Dispose       ← complex transaction SP
  usp_Report_FleetRegister_Get
```

---

## 1. Authentication SPs

> The `UserAccount` table is owned by the AgriGEN Core ERP module. These SPs query it for login validation. If Core ERP owns a dedicated auth SP, proxy to that instead of duplicating logic here.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- usp_Auth_Login
-- Called by AuthController.Login()
-- Returns the user row if credentials are valid; empty result if not.
-- Password comparison must happen in the SP using the same hashing algo as Core ERP.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Auth_Login
    @Username   NVARCHAR(100),
    @Password   NVARCHAR(255)    -- pre-hashed SHA-256 or bcrypt depending on Core ERP
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        ua.UserID        AS Id,
        ua.Username,
        ua.EmployeeID,
        e.Name           AS EmployeeName,
        ua.RoleCode,
        ua.GroupID,
        ua.EstateID
    FROM UserAccount ua
    INNER JOIN Employee e ON e.EmployeeID = ua.EmployeeID
    WHERE
        ua.Username  = @Username
        AND ua.PasswordHash = @Password   -- hash comparison
        AND ua.IsActive = 1;
END;
GO
```

---

## 2. Groups

```sql
-- ─── usp_Shared_Group_GetAll ──────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Shared_Group_GetAll
AS
BEGIN
    SET NOCOUNT ON;
    SELECT GroupID AS Id, Name FROM [Group] WHERE IsActive = 1 ORDER BY Name;
END;
GO

-- ─── usp_Shared_Group_GetByID ─────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Shared_Group_GetByID
    @GroupID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT GroupID AS Id, Name FROM [Group] WHERE GroupID = @GroupID AND IsActive = 1;
END;
GO
```

---

## 3. Estates

```sql
-- ─── usp_Shared_Estate_GetAll ─────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Shared_Estate_GetAll
    @GroupID INT = NULL,
    @Search  NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        EstateID AS Id,
        Name,
        GroupID
    FROM Estate
    WHERE
        IsActive = 1
        AND (@GroupID IS NULL OR GroupID = @GroupID)
        AND (@Search  IS NULL OR Name LIKE '%' + @Search + '%')
    ORDER BY Name;
END;
GO

-- ─── usp_Shared_Estate_GetByID ────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Shared_Estate_GetByID
    @EstateID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT EstateID AS Id, Name, GroupID FROM Estate WHERE EstateID = @EstateID AND IsActive = 1;
END;
GO
```

---

## 4. Fixed Asset Types ★ (shared)

```sql
-- ─── usp_Shared_FixedAssetType_GetAll ────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Shared_FixedAssetType_GetAll
    @GroupID   INT           = NULL,
    @Search    NVARCHAR(100) = NULL,
    @Page      INT           = 1,
    @PageSize  INT           = 100
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Offset INT = (@Page - 1) * @PageSize;

    SELECT
        FixedAssetTypeID AS Id,
        AssetTypeCode    AS Code,
        AssetTypeName    AS Name,
        [Desc],
        GroupID,
        EstateID
    FROM FixedAssetType
    WHERE
        IsActive = 1
        AND (@GroupID IS NULL OR GroupID = @GroupID)
        AND (@Search  IS NULL OR AssetTypeCode LIKE '%' + @Search + '%'
                              OR AssetTypeName LIKE '%' + @Search + '%')
    ORDER BY AssetTypeName
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;

    -- Total count for pagination
    SELECT COUNT(1) AS Total
    FROM FixedAssetType
    WHERE
        IsActive = 1
        AND (@GroupID IS NULL OR GroupID = @GroupID)
        AND (@Search  IS NULL OR AssetTypeCode LIKE '%' + @Search + '%'
                              OR AssetTypeName LIKE '%' + @Search + '%');
END;
GO

-- ─── usp_Shared_FixedAssetType_GetByID ───────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Shared_FixedAssetType_GetByID
    @FixedAssetTypeID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        FixedAssetTypeID AS Id,
        AssetTypeCode    AS Code,
        AssetTypeName    AS Name,
        [Desc],
        GroupID,
        EstateID
    FROM FixedAssetType
    WHERE FixedAssetTypeID = @FixedAssetTypeID AND IsActive = 1;
END;
GO

-- ─── usp_Shared_FixedAssetType_Insert ────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Shared_FixedAssetType_Insert
    @AssetTypeCode  VARCHAR(10),
    @AssetTypeName  NVARCHAR(100),
    @Desc           NVARCHAR(255) = NULL,
    @GroupID        INT,
    @EstateID       INT           = NULL,
    @CreatedBy      INT,
    @NewID          INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    -- Unique code check
    IF EXISTS (SELECT 1 FROM FixedAssetType WHERE AssetTypeCode = @AssetTypeCode AND IsActive = 1)
    BEGIN
        RAISERROR('Asset type code already exists.', 16, 1);
        RETURN;
    END

    INSERT INTO FixedAssetType (AssetTypeCode, AssetTypeName, [Desc], GroupID, EstateID, CreatedBy)
    VALUES (@AssetTypeCode, @AssetTypeName, @Desc, @GroupID, @EstateID, @CreatedBy);

    SET @NewID = SCOPE_IDENTITY();
END;
GO

-- ─── usp_Shared_FixedAssetType_Update ────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Shared_FixedAssetType_Update
    @FixedAssetTypeID INT,
    @AssetTypeCode    VARCHAR(10),
    @AssetTypeName    NVARCHAR(100),
    @Desc             NVARCHAR(255) = NULL,
    @GroupID          INT,
    @EstateID         INT           = NULL,
    @ModifiedBy       INT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1 FROM FixedAssetType
        WHERE AssetTypeCode = @AssetTypeCode AND FixedAssetTypeID <> @FixedAssetTypeID AND IsActive = 1
    )
    BEGIN
        RAISERROR('Asset type code already used by another record.', 16, 1);
        RETURN;
    END

    UPDATE FixedAssetType
    SET
        AssetTypeCode = @AssetTypeCode,
        AssetTypeName = @AssetTypeName,
        [Desc]        = @Desc,
        GroupID       = @GroupID,
        EstateID      = @EstateID,
        ModifiedBy    = @ModifiedBy,
        ModifiedDate  = GETDATE()
    WHERE FixedAssetTypeID = @FixedAssetTypeID AND IsActive = 1;
END;
GO

-- ─── usp_Shared_FixedAssetType_Delete ────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Shared_FixedAssetType_Delete
    @FixedAssetTypeID INT,
    @ModifiedBy       INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE FixedAssetType
    SET IsActive = 0, ModifiedBy = @ModifiedBy, ModifiedDate = GETDATE()
    WHERE FixedAssetTypeID = @FixedAssetTypeID AND IsActive = 1;
END;
GO
```

---

## 5. Fixed Asset Categories

```sql
-- ─── usp_Shared_FixedAssetCategory_GetAll ────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Shared_FixedAssetCategory_GetAll
    @FixedAssetTypeID INT           = NULL,
    @GroupID          INT           = NULL,
    @Search           NVARCHAR(100) = NULL,
    @Page             INT           = 1,
    @PageSize         INT           = 100
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@Page - 1) * @PageSize;

    SELECT
        FixedAssetCategoryID AS Id,
        FixedAssetTypeID,
        AssetCategoryCode    AS Code,
        AssetCategoryName    AS Name,
        GroupID
    FROM FixedAssetCategory
    WHERE
        IsActive = 1
        AND (@FixedAssetTypeID IS NULL OR FixedAssetTypeID = @FixedAssetTypeID)
        AND (@GroupID          IS NULL OR GroupID          = @GroupID)
        AND (@Search           IS NULL OR AssetCategoryCode LIKE '%' + @Search + '%'
                                       OR AssetCategoryName LIKE '%' + @Search + '%')
    ORDER BY AssetCategoryName
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;

    SELECT COUNT(1) AS Total FROM FixedAssetCategory
    WHERE IsActive = 1
        AND (@FixedAssetTypeID IS NULL OR FixedAssetTypeID = @FixedAssetTypeID)
        AND (@GroupID          IS NULL OR GroupID          = @GroupID);
END;
GO

-- ─── usp_Shared_FixedAssetCategory_GetByID ───────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Shared_FixedAssetCategory_GetByID
    @FixedAssetCategoryID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT FixedAssetCategoryID AS Id, FixedAssetTypeID, AssetCategoryCode AS Code, AssetCategoryName AS Name, GroupID
    FROM FixedAssetCategory WHERE FixedAssetCategoryID = @FixedAssetCategoryID AND IsActive = 1;
END;
GO

-- ─── usp_Shared_FixedAssetCategory_Insert ────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Shared_FixedAssetCategory_Insert
    @FixedAssetTypeID  INT,
    @AssetCategoryCode VARCHAR(10),
    @AssetCategoryName NVARCHAR(100),
    @GroupID           INT,
    @CreatedBy         INT,
    @NewID             INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO FixedAssetCategory (FixedAssetTypeID, AssetCategoryCode, AssetCategoryName, GroupID, CreatedBy)
    VALUES (@FixedAssetTypeID, @AssetCategoryCode, @AssetCategoryName, @GroupID, @CreatedBy);
    SET @NewID = SCOPE_IDENTITY();
END;
GO

-- ─── usp_Shared_FixedAssetCategory_Update ────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Shared_FixedAssetCategory_Update
    @FixedAssetCategoryID INT,
    @FixedAssetTypeID     INT,
    @AssetCategoryCode    VARCHAR(10),
    @AssetCategoryName    NVARCHAR(100),
    @GroupID              INT,
    @ModifiedBy           INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE FixedAssetCategory
    SET FixedAssetTypeID  = @FixedAssetTypeID,
        AssetCategoryCode = @AssetCategoryCode,
        AssetCategoryName = @AssetCategoryName,
        GroupID           = @GroupID,
        ModifiedBy        = @ModifiedBy,
        ModifiedDate      = GETDATE()
    WHERE FixedAssetCategoryID = @FixedAssetCategoryID AND IsActive = 1;
END;
GO

-- ─── usp_Shared_FixedAssetCategory_Delete ────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Shared_FixedAssetCategory_Delete
    @FixedAssetCategoryID INT, @ModifiedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE FixedAssetCategory SET IsActive=0, ModifiedBy=@ModifiedBy, ModifiedDate=GETDATE()
    WHERE FixedAssetCategoryID=@FixedAssetCategoryID AND IsActive=1;
END;
GO
```

---

## 6. Workshop Categories

> Same CRUD pattern as FixedAssetCategory. Replace table/column names accordingly.

```sql
CREATE OR ALTER PROCEDURE usp_Shared_WorkshopCategory_GetAll
    @GroupID INT = NULL, @Search NVARCHAR(100) = NULL, @Page INT = 1, @PageSize INT = 100
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@Page-1)*@PageSize;
    SELECT WorkshopCategoryID AS Id, WorkshopCategoryCode AS Code, WorkshopCategoryName AS Name, GroupID
    FROM WorkshopCategory
    WHERE IsActive=1
        AND (@GroupID IS NULL OR GroupID=@GroupID)
        AND (@Search  IS NULL OR WorkshopCategoryCode LIKE '%'+@Search+'%' OR WorkshopCategoryName LIKE '%'+@Search+'%')
    ORDER BY WorkshopCategoryName
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
    SELECT COUNT(1) AS Total FROM WorkshopCategory WHERE IsActive=1 AND (@GroupID IS NULL OR GroupID=@GroupID);
END;
GO

CREATE OR ALTER PROCEDURE usp_Shared_WorkshopCategory_GetByID  @WorkshopCategoryID INT
AS BEGIN SET NOCOUNT ON;
    SELECT WorkshopCategoryID AS Id, WorkshopCategoryCode AS Code, WorkshopCategoryName AS Name, GroupID
    FROM WorkshopCategory WHERE WorkshopCategoryID=@WorkshopCategoryID AND IsActive=1;
END; GO

CREATE OR ALTER PROCEDURE usp_Shared_WorkshopCategory_Insert
    @WorkshopCategoryCode VARCHAR(10), @WorkshopCategoryName NVARCHAR(100), @GroupID INT, @CreatedBy INT, @NewID INT OUTPUT
AS BEGIN SET NOCOUNT ON;
    IF EXISTS(SELECT 1 FROM WorkshopCategory WHERE WorkshopCategoryCode=@WorkshopCategoryCode AND IsActive=1)
        RAISERROR('Category code already exists.',16,1);
    INSERT INTO WorkshopCategory(WorkshopCategoryCode,WorkshopCategoryName,GroupID,CreatedBy)
    VALUES(@WorkshopCategoryCode,@WorkshopCategoryName,@GroupID,@CreatedBy);
    SET @NewID=SCOPE_IDENTITY();
END; GO

CREATE OR ALTER PROCEDURE usp_Shared_WorkshopCategory_Update
    @WorkshopCategoryID INT, @WorkshopCategoryCode VARCHAR(10), @WorkshopCategoryName NVARCHAR(100), @GroupID INT, @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    UPDATE WorkshopCategory SET WorkshopCategoryCode=@WorkshopCategoryCode, WorkshopCategoryName=@WorkshopCategoryName,
        GroupID=@GroupID, ModifiedBy=@ModifiedBy, ModifiedDate=GETDATE()
    WHERE WorkshopCategoryID=@WorkshopCategoryID AND IsActive=1;
END; GO

CREATE OR ALTER PROCEDURE usp_Shared_WorkshopCategory_Delete  @WorkshopCategoryID INT, @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    UPDATE WorkshopCategory SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
    WHERE WorkshopCategoryID=@WorkshopCategoryID AND IsActive=1;
END; GO
```

---

## 7. Workshops ★ (shared)

```sql
-- ─── usp_Shared_Workshop_GetAll ───────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Shared_Workshop_GetAll
    @GroupID   INT           = NULL,
    @EstateID  INT           = NULL,
    @Search    NVARCHAR(100) = NULL,
    @Page      INT           = 1,
    @PageSize  INT           = 100
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@Page-1)*@PageSize;

    SELECT
        w.WorkshopID         AS Id,
        w.WorkshopCode       AS Code,
        w.WorkshopName       AS Name,
        w.WorkshopCategoryID,
        wc.WorkshopCategoryName,
        w.FixedAssetTypeID,
        fat.AssetTypeName    AS FixedAssetTypeName,
        w.GroupID,
        w.EstateID,
        e.Name               AS EstateName,
        w.Status
    FROM Workshop w
    INNER JOIN WorkshopCategory wc  ON wc.WorkshopCategoryID = w.WorkshopCategoryID
    INNER JOIN FixedAssetType   fat ON fat.FixedAssetTypeID  = w.FixedAssetTypeID
    INNER JOIN Estate           e   ON e.EstateID            = w.EstateID
    WHERE
        w.IsActive = 1
        AND (@GroupID  IS NULL OR w.GroupID  = @GroupID)
        AND (@EstateID IS NULL OR w.EstateID = @EstateID)
        AND (@Search   IS NULL OR w.WorkshopCode LIKE '%'+@Search+'%'
                                OR w.WorkshopName LIKE '%'+@Search+'%')
    ORDER BY w.WorkshopName
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;

    SELECT COUNT(1) AS Total FROM Workshop w
    WHERE w.IsActive=1 AND (@GroupID IS NULL OR w.GroupID=@GroupID) AND (@EstateID IS NULL OR w.EstateID=@EstateID);
END;
GO

-- ─── usp_Shared_Workshop_GetByID ─────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Shared_Workshop_GetByID
    @WorkshopID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        w.WorkshopID AS Id, w.WorkshopCode AS Code, w.WorkshopName AS Name,
        w.WorkshopCategoryID, w.FixedAssetTypeID, w.GroupID, w.EstateID, w.Status
    FROM Workshop w
    WHERE w.WorkshopID = @WorkshopID AND w.IsActive = 1;
END;
GO

-- ─── usp_Shared_Workshop_Insert ──────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Shared_Workshop_Insert
    @WorkshopCode       VARCHAR(10),
    @WorkshopName       NVARCHAR(100),
    @WorkshopCategoryID INT,
    @FixedAssetTypeID   INT,
    @GroupID            INT,
    @EstateID           INT,
    @Status             VARCHAR(20),
    @CreatedBy          INT,
    @NewID              INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS(SELECT 1 FROM Workshop WHERE WorkshopCode=@WorkshopCode AND IsActive=1)
        RAISERROR('Workshop code already exists.',16,1);

    INSERT INTO Workshop(WorkshopCode,WorkshopName,WorkshopCategoryID,FixedAssetTypeID,GroupID,EstateID,Status,CreatedBy)
    VALUES(@WorkshopCode,@WorkshopName,@WorkshopCategoryID,@FixedAssetTypeID,@GroupID,@EstateID,@Status,@CreatedBy);
    SET @NewID=SCOPE_IDENTITY();
END;
GO

-- ─── usp_Shared_Workshop_Update ──────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Shared_Workshop_Update
    @WorkshopID         INT,
    @WorkshopCode       VARCHAR(10),
    @WorkshopName       NVARCHAR(100),
    @WorkshopCategoryID INT,
    @FixedAssetTypeID   INT,
    @GroupID            INT,
    @EstateID           INT,
    @Status             VARCHAR(20),
    @ModifiedBy         INT
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS(SELECT 1 FROM Workshop WHERE WorkshopCode=@WorkshopCode AND WorkshopID<>@WorkshopID AND IsActive=1)
        RAISERROR('Workshop code already used.',16,1);

    UPDATE Workshop SET
        WorkshopCode=@WorkshopCode, WorkshopName=@WorkshopName,
        WorkshopCategoryID=@WorkshopCategoryID, FixedAssetTypeID=@FixedAssetTypeID,
        GroupID=@GroupID, EstateID=@EstateID, Status=@Status,
        ModifiedBy=@ModifiedBy, ModifiedDate=GETDATE()
    WHERE WorkshopID=@WorkshopID AND IsActive=1;
END;
GO

-- ─── usp_Shared_Workshop_Delete ──────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Shared_Workshop_Delete
    @WorkshopID INT, @ModifiedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    -- Soft-delete children
    UPDATE WorkshopTechRate  SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE WorkshopID=@WorkshopID AND IsActive=1;
    UPDATE WorkshopInventoryDetail SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
        WHERE WorkshopInventoryID IN (SELECT WorkshopInventoryID FROM WorkshopInventory WHERE WorkshopID=@WorkshopID);
    UPDATE WorkshopInventory SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE WorkshopID=@WorkshopID AND IsActive=1;
    -- Soft-delete parent
    UPDATE Workshop SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE WorkshopID=@WorkshopID AND IsActive=1;
    COMMIT;
END;
GO
```

---

## 8. WorkshopInventory

```sql
-- ─── usp_Shared_WorkshopInventory_GetAll ─────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Shared_WorkshopInventory_GetAll
    @WorkshopID INT = NULL, @GroupID INT = NULL, @EstateID INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        wi.WorkshopInventoryID AS Id,
        wi.WorkshopID,
        wi.SKUID,
        wi.MeasuringUnitID,
        wi.WarehouseSKUMappingID,
        wi.ReorderLevel,
        wi.AvailableBalance,
        wi.MinLevel,
        wi.MaxLevel,
        wi.UnitCost,
        wi.GroupID,
        wi.EstateID
    FROM WorkshopInventory wi
    WHERE
        wi.IsActive = 1
        AND (@WorkshopID IS NULL OR wi.WorkshopID = @WorkshopID)
        AND (@GroupID    IS NULL OR wi.GroupID    = @GroupID)
        AND (@EstateID   IS NULL OR wi.EstateID   = @EstateID)
    ORDER BY wi.WorkshopInventoryID;
END;
GO

-- ─── usp_Shared_WorkshopInventory_GetBatches (FIFO batches) ──────────────────
CREATE OR ALTER PROCEDURE usp_Shared_WorkshopInventory_GetBatches
    @WorkshopInventoryID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        WorkshopInventoryDetailID AS Id,
        WorkshopInventoryID,
        WorkshopID,
        SKUID,
        WarehouseSKUMappingID,
        ItemIssueID,
        ItemIssueReference,
        Quantity,
        UnitCost
    FROM WorkshopInventoryDetail
    WHERE WorkshopInventoryID = @WorkshopInventoryID AND IsActive = 1
    ORDER BY CreatedDate;   -- FIFO = oldest batch first
END;
GO

-- ─── usp_Shared_WorkshopInventory_Insert ─────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Shared_WorkshopInventory_Insert
    @WorkshopID            INT,
    @SKUID                 INT,
    @MeasuringUnitID       INT,
    @WarehouseSKUMappingID INT,
    @ReorderLevel          INT,
    @AvailableBalance      INT,
    @MinLevel              INT,
    @MaxLevel              INT,
    @UnitCost              DECIMAL(12,2),
    @GroupID               INT,
    @EstateID              INT,
    @CreatedBy             INT,
    @NewID                 INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS(SELECT 1 FROM WorkshopInventory WHERE WorkshopID=@WorkshopID AND SKUID=@SKUID AND IsActive=1)
        RAISERROR('This SKU is already registered in this workshop.',16,1);

    INSERT INTO WorkshopInventory(WorkshopID,SKUID,MeasuringUnitID,WarehouseSKUMappingID,
        ReorderLevel,AvailableBalance,MinLevel,MaxLevel,UnitCost,GroupID,EstateID,CreatedBy)
    VALUES(@WorkshopID,@SKUID,@MeasuringUnitID,@WarehouseSKUMappingID,
        @ReorderLevel,@AvailableBalance,@MinLevel,@MaxLevel,@UnitCost,@GroupID,@EstateID,@CreatedBy);
    SET @NewID=SCOPE_IDENTITY();
END;
GO

-- ─── usp_Shared_WorkshopInventory_Update ─────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Shared_WorkshopInventory_Update
    @WorkshopInventoryID   INT,
    @ReorderLevel          INT,
    @MinLevel              INT,
    @MaxLevel              INT,
    @UnitCost              DECIMAL(12,2),
    @ModifiedBy            INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE WorkshopInventory SET
        ReorderLevel=@ReorderLevel, MinLevel=@MinLevel, MaxLevel=@MaxLevel,
        UnitCost=@UnitCost, ModifiedBy=@ModifiedBy, ModifiedDate=GETDATE()
    WHERE WorkshopInventoryID=@WorkshopInventoryID AND IsActive=1;
END;
GO

-- ─── usp_Shared_WorkshopInventory_Delete ─────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Shared_WorkshopInventory_Delete
    @WorkshopInventoryID INT, @ModifiedBy INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    UPDATE WorkshopInventoryDetail SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
        WHERE WorkshopInventoryID=@WorkshopInventoryID AND IsActive=1;
    UPDATE WorkshopInventory SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
        WHERE WorkshopInventoryID=@WorkshopInventoryID AND IsActive=1;
    COMMIT;
END;
GO
```

---

## 9. SP Pattern Reference

All remaining simple CRUD entities follow the exact pattern below. Copy it, substitute table name / columns, done.

```sql
-- ── TEMPLATE — replace {Entity}, {PK}, columns as needed ───────────────────

CREATE OR ALTER PROCEDURE usp_{Module}_{Entity}_GetAll
    @Search NVARCHAR(100) = NULL, @Page INT = 1, @PageSize INT = 100
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@Page-1)*@PageSize;
    SELECT {PK} AS Id, Code, Name, GroupID
    FROM {Table}
    WHERE IsActive=1 AND (@Search IS NULL OR Code LIKE '%'+@Search+'%' OR Name LIKE '%'+@Search+'%')
    ORDER BY Name OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
    SELECT COUNT(1) AS Total FROM {Table} WHERE IsActive=1;
END; GO

CREATE OR ALTER PROCEDURE usp_{Module}_{Entity}_GetByID @ID INT
AS BEGIN SET NOCOUNT ON;
    SELECT {PK} AS Id, Code, Name, GroupID FROM {Table} WHERE {PK}=@ID AND IsActive=1;
END; GO

CREATE OR ALTER PROCEDURE usp_{Module}_{Entity}_Insert
    @Code VARCHAR(10), @Name NVARCHAR(100), @GroupID INT, @CreatedBy INT, @NewID INT OUTPUT
AS BEGIN SET NOCOUNT ON;
    IF EXISTS(SELECT 1 FROM {Table} WHERE Code=@Code AND IsActive=1)
        RAISERROR('Code already exists.',16,1);
    INSERT INTO {Table}(Code,Name,GroupID,CreatedBy) VALUES(@Code,@Name,@GroupID,@CreatedBy);
    SET @NewID=SCOPE_IDENTITY();
END; GO

CREATE OR ALTER PROCEDURE usp_{Module}_{Entity}_Update
    @ID INT, @Code VARCHAR(10), @Name NVARCHAR(100), @GroupID INT, @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    IF EXISTS(SELECT 1 FROM {Table} WHERE Code=@Code AND {PK}<>@ID AND IsActive=1)
        RAISERROR('Code in use by another record.',16,1);
    UPDATE {Table} SET Code=@Code,Name=@Name,GroupID=@GroupID,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE()
    WHERE {PK}=@ID AND IsActive=1;
END; GO

CREATE OR ALTER PROCEDURE usp_{Module}_{Entity}_Delete @ID INT, @ModifiedBy INT
AS BEGIN SET NOCOUNT ON;
    UPDATE {Table} SET IsActive=0,ModifiedBy=@ModifiedBy,ModifiedDate=GETDATE() WHERE {PK}=@ID AND IsActive=1;
END; GO
```

### Entities that use this pattern directly

| Entity | Module prefix | Table | PK |
|--------|--------------|-------|----|
| VehicleType | `Fleet` | VehicleType | VehicleTypeID |
| FuelType | `Fleet` | FuelType | FuelTypeID |
| DocumentType | `Fleet` | DocumentType | DocumentTypeID |
| PurposeCategory | `Fleet` | PurposeCategory | PurposeCategoryID |
| LicenseCategory | `Fleet` | LicenseCategory | LicenseCategoryID |
| TechCategory | `Fleet` | TechCategory | TechCategoryID |
| TechAssignment | `Fleet` | TechAssignment | TechAssignmentID |
| WorkshopTechRate | `Fleet` | WorkshopTechRate | WorkshopTechRateID |
| DisposalStatusType | `FA` | DisposalStatusType | DisposalStatusTypeID |
