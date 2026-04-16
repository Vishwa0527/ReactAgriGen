# AgriGEN ERP — Stored Procedures: Reports & Alerts

> All report SPs return pre-joined, pre-computed data sets — no N+1 fetching on the frontend.  
> All support common filters: `@EstateID`, `@GroupID`, `@From`, `@To`.

---

## 1. Fleet Register Report

```sql
-- ─── usp_Report_FleetRegister_Get ────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Report_FleetRegister_Get
    @EstateID INT = NULL,
    @GroupID  INT = NULL,
    @Status   VARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        v.VehicleID                 AS Id,
        v.Numbers                   AS RegistrationNo,
        v.Brand,
        v.Model,
        vt.Name                     AS VehicleType,
        ft.Name                     AS FuelType,
        fat.AssetTypeName           AS FixedAssetType,
        g.Name                      AS [Group],
        e.Name                      AS Estate,
        v.RegisterYear,
        v.Capacity,
        v.Status,
        fa.FixedAssetCode,
        fa.TotalCostOfAsset         AS Cost,
        fa.UsefulLifeYears,
        fa.ResidualValue,
        fa.DepreciationValue        AS AnnualDepreciation,
        fa.StartDate                AS AssetStartDate,
        -- Computed NBV
        fa.TotalCostOfAsset - ISNULL(
            (SELECT SUM(dh.Value) FROM DepreciationHistory dh
             WHERE dh.FixedAssetID = fa.FixedAssetID AND dh.IsActive = 1), 0
        )                           AS NetBookValue
    FROM Vehicle v
    INNER JOIN VehicleType    vt  ON vt.VehicleTypeID    = v.VehicleTypeID
    INNER JOIN FuelType       ft  ON ft.FuelTypeID       = v.FuelTypeID
    INNER JOIN FixedAssetType fat ON fat.FixedAssetTypeID= v.FixedAssetTypeID
    INNER JOIN [Group]        g   ON g.GroupID           = v.GroupID
    INNER JOIN Estate         e   ON e.EstateID          = v.EstateID
    LEFT  JOIN FixedAsset     fa  ON fa.FixedAssetID     = v.FixedAssetID AND fa.IsActive = 1
    WHERE
        v.IsActive = 1
        AND (@EstateID IS NULL OR v.EstateID = @EstateID)
        AND (@GroupID  IS NULL OR v.GroupID  = @GroupID)
        AND (@Status   IS NULL OR v.Status   = @Status)
    ORDER BY v.Numbers;
END;
GO
```

---

## 2. Vehicle Documents Report

```sql
-- ─── usp_Report_VehicleDocuments_Get ─────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Report_VehicleDocuments_Get
    @EstateID INT = NULL,
    @GroupID  INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        vd.VehicleDocumentID  AS Id,
        v.Numbers             AS RegistrationNo,
        v.Brand,
        v.Model,
        e.Name                AS Estate,
        dt.Name               AS DocumentType,
        vd.DocNumber,
        vd.StartDate,
        vd.ExpireDate,
        DATEDIFF(DAY, GETDATE(), vd.ExpireDate) AS DaysUntilExpiry,
        CASE
            WHEN vd.ExpireDate IS NULL                          THEN 'N/A'
            WHEN vd.ExpireDate < CAST(GETDATE() AS DATE)        THEN 'Expired'
            WHEN DATEDIFF(DAY, GETDATE(), vd.ExpireDate) <= 30  THEN 'Expiring Soon'
            ELSE 'Valid'
        END                   AS ExpiryStatus,
        v.Status              AS VehicleStatus
    FROM VehicleDocument vd
    INNER JOIN Vehicle      v  ON v.VehicleID      = vd.VehicleID
    INNER JOIN DocumentType dt ON dt.DocumentTypeID = vd.DocumentTypeID
    INNER JOIN Estate       e  ON e.EstateID        = v.EstateID
    WHERE
        vd.IsActive = 1
        AND v.IsActive  = 1
        AND (@EstateID IS NULL OR v.EstateID = @EstateID)
        AND (@GroupID  IS NULL OR v.GroupID  = @GroupID)
    ORDER BY vd.ExpireDate ASC;
END;
GO
```

---

## 3. Driver Assignments Report

```sql
-- ─── usp_Report_DriverAssignments_Get ────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Report_DriverAssignments_Get
    @EstateID   INT  = NULL,
    @GroupID    INT  = NULL,
    @ActiveOnly BIT  = 0
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        da.AssignmentID     AS Id,
        v.Numbers           AS RegistrationNo,
        v.Brand,
        v.Model,
        e.Name              AS Estate,
        d.Code              AS DriverCode,
        d.Name              AS DriverName,
        d.LicenseNo,
        lc.Name             AS LicenseCategory,
        da.StartDate,
        da.EndDate,
        CASE WHEN da.EndDate IS NULL THEN 'Active' ELSE 'Closed' END AS AssignmentStatus,
        DATEDIFF(DAY, da.StartDate, ISNULL(da.EndDate, GETDATE())) AS DurationDays
    FROM DriverAssignment da
    INNER JOIN Vehicle          v  ON v.VehicleID          = da.VehicleID
    INNER JOIN Driver           d  ON d.DriverID           = da.DriverID
    INNER JOIN LicenseCategory  lc ON lc.LicenseCategoryID = d.LicenseCategoryID
    INNER JOIN Estate           e  ON e.EstateID           = v.EstateID
    WHERE
        da.IsActive = 1
        AND (@EstateID IS NULL OR v.EstateID = @EstateID)
        AND (@GroupID  IS NULL OR v.GroupID  = @GroupID)
        AND (@ActiveOnly = 0 OR da.EndDate IS NULL)
    ORDER BY da.StartDate DESC;
END;
GO
```

---

## 4. Daily Running Report

```sql
-- ─── usp_Report_DailyRunning_Get ─────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Report_DailyRunning_Get
    @EstateID INT  = NULL,
    @GroupID  INT  = NULL,
    @From     DATE = NULL,
    @To       DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        dr.DailyRunningID   AS Id,
        dr.RefCode,
        v.Numbers           AS RegistrationNo,
        v.Brand,
        v.Model,
        e.Name              AS Estate,
        d.Name              AS DriverName,
        d.Code              AS DriverCode,
        dr.StartDateTime,
        dr.EndDateTime,
        dr.StartOdo,
        dr.EndOdo,
        CASE WHEN dr.EndOdo IS NOT NULL AND dr.StartOdo IS NOT NULL
             THEN dr.EndOdo - dr.StartOdo ELSE NULL END AS KmTravelled,
        dr.Notes
    FROM DailyRunning dr
    INNER JOIN Vehicle  v ON v.VehicleID = dr.VehicleID
    INNER JOIN Driver   d ON d.DriverID  = dr.DriverID
    INNER JOIN Estate   e ON e.EstateID  = v.EstateID
    WHERE
        dr.IsActive = 1
        AND (@EstateID IS NULL OR v.EstateID = @EstateID)
        AND (@GroupID  IS NULL OR v.GroupID  = @GroupID)
        AND (@From IS NULL OR CAST(dr.StartDateTime AS DATE) >= @From)
        AND (@To   IS NULL OR CAST(dr.StartDateTime AS DATE) <= @To)
    ORDER BY dr.StartDateTime DESC;
END;
GO
```

---

## 5. Depreciation Schedule Report

```sql
-- ─── usp_Report_DepreciationSchedule_Get ─────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Report_DepreciationSchedule_Get
    @EstateID INT = NULL,
    @GroupID  INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        dep.DepreciationID      AS Id,
        fa.FixedAssetCode       AS Code,
        fa.FixedAssetName       AS Name,
        fat.AssetTypeName       AS AssetType,
        fac.AssetCategoryName   AS Category,
        e.Name                  AS Estate,
        dep.AssetValueDate,
        dep.AssetValue,
        dep.UsefulYears,
        dep.ResidualValue,
        dep.DepreciationValue   AS AnnualDepreciation,
        dep.Status,
        ISNULL(
            (SELECT SUM(dh.Value) FROM DepreciationHistory dh
             WHERE dh.DepreciationID = dep.DepreciationID AND dh.IsActive = 1), 0
        )                       AS TotalPosted,
        dep.AssetValue - ISNULL(
            (SELECT SUM(dh.Value) FROM DepreciationHistory dh
             WHERE dh.DepreciationID = dep.DepreciationID AND dh.IsActive = 1), 0
        )                       AS NetBookValue,
        DATEADD(YEAR, dep.UsefulYears, dep.AssetValueDate) AS ScheduleEndDate
    FROM Depreciation dep
    INNER JOIN FixedAsset         fa  ON fa.FixedAssetID         = dep.FixedAssetID
    INNER JOIN FixedAssetType     fat ON fat.FixedAssetTypeID    = fa.FixedAssetTypeID
    INNER JOIN FixedAssetCategory fac ON fac.FixedAssetCategoryID = fa.FixedAssetCategoryID
    INNER JOIN Estate             e   ON e.EstateID              = fa.EstateID
    WHERE
        dep.IsActive = 1
        AND (@EstateID IS NULL OR fa.EstateID = @EstateID)
        AND (@GroupID  IS NULL OR fa.GroupID  = @GroupID)
    ORDER BY fa.FixedAssetCode, dep.AssetValueDate;
END;
GO
```

---

## 6. Asset NBV Report

```sql
-- ─── usp_Report_AssetNBV_Get ─────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Report_AssetNBV_Get
    @EstateID INT = NULL,
    @GroupID  INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        fa.FixedAssetID         AS Id,
        fa.FixedAssetCode       AS Code,
        fa.FixedAssetName       AS Name,
        fat.AssetTypeName       AS AssetType,
        fac.AssetCategoryName   AS Category,
        e.Name                  AS Estate,
        fa.TotalCostOfAsset,
        fa.StartDate,
        fa.UsefulLifeYears,
        fa.ResidualValue,
        fa.DepreciationValue    AS AnnualDepreciation,
        ISNULL(
            (SELECT SUM(dh.Value) FROM DepreciationHistory dh
             WHERE dh.FixedAssetID = fa.FixedAssetID AND dh.IsActive = 1), 0
        )                       AS TotalDepreciationPosted,
        -- NBV = max(residual, cost - total posted)
        CASE
            WHEN fa.TotalCostOfAsset - ISNULL(
                (SELECT SUM(dh.Value) FROM DepreciationHistory dh
                 WHERE dh.FixedAssetID = fa.FixedAssetID AND dh.IsActive = 1), 0)
                < fa.ResidualValue
            THEN fa.ResidualValue
            ELSE fa.TotalCostOfAsset - ISNULL(
                (SELECT SUM(dh.Value) FROM DepreciationHistory dh
                 WHERE dh.FixedAssetID = fa.FixedAssetID AND dh.IsActive = 1), 0)
        END                     AS NetBookValue,
        fa.Status
    FROM FixedAsset fa
    INNER JOIN FixedAssetType     fat ON fat.FixedAssetTypeID     = fa.FixedAssetTypeID
    INNER JOIN FixedAssetCategory fac ON fac.FixedAssetCategoryID = fa.FixedAssetCategoryID
    INNER JOIN Estate             e   ON e.EstateID               = fa.EstateID
    WHERE
        fa.IsActive = 1
        AND (@EstateID IS NULL OR fa.EstateID = @EstateID)
        AND (@GroupID  IS NULL OR fa.GroupID  = @GroupID)
    ORDER BY fa.FixedAssetCode;
END;
GO
```

---

## 7. Asset Maintenance Report

```sql
-- ─── usp_Report_AssetMaintenance_Get ─────────────────────────────────────────
CREATE OR ALTER PROCEDURE usp_Report_AssetMaintenance_Get
    @EstateID INT  = NULL,
    @GroupID  INT  = NULL,
    @From     DATE = NULL,
    @To       DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        am.AssetMaintenanceID   AS Id,
        am.MaintenanceCode,
        fa.FixedAssetCode       AS Code,
        fa.FixedAssetName       AS Name,
        fat.AssetTypeName       AS AssetType,
        e.Name                  AS Estate,
        w.WorkshopName,
        am.MaintenanceDate,
        am.TotalMaintenanceCost AS ActualCost,
        am.Status,
        -- Sum of cost children
        ISNULL(
            (SELECT SUM(amc.TotalMaintenanceCost)
             FROM AssetMaintenanceCost amc
             WHERE amc.AssetMaintenanceID = am.AssetMaintenanceID AND amc.IsActive = 1), 0
        )                       AS TotalCostFromChildren
    FROM AssetMaintenance am
    INNER JOIN FixedAsset     fa  ON fa.FixedAssetID     = am.FixedAssetID
    INNER JOIN FixedAssetType fat ON fat.FixedAssetTypeID= fa.FixedAssetTypeID
    INNER JOIN Workshop       w   ON w.WorkshopID        = am.WorkshopID
    INNER JOIN Estate         e   ON e.EstateID          = fa.EstateID
    WHERE
        am.IsActive = 1
        AND (@EstateID IS NULL OR fa.EstateID = @EstateID)
        AND (@GroupID  IS NULL OR fa.GroupID  = @GroupID)
        AND (@From IS NULL OR am.MaintenanceDate >= @From)
        AND (@To   IS NULL OR am.MaintenanceDate <= @To)
    ORDER BY am.MaintenanceDate DESC;
END;
GO
```

---

## 8. Alerts Engine SP

```sql
-- ─── usp_Alerts_GetAll ────────────────────────────────────────────────────────
-- Returns all active alert objects across all alert categories.
-- The API layer maps these into the grouped JSON structure the frontend expects.
CREATE OR ALTER PROCEDURE usp_Alerts_GetAll
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Document Expiry (ExpireDate within 30 days)
    SELECT
        'documentExpiry'                                  AS AlertType,
        CASE
            WHEN vd.ExpireDate < CAST(GETDATE() AS DATE)  THEN 'danger'
            WHEN DATEDIFF(DAY, GETDATE(), vd.ExpireDate) <= 10 THEN 'danger'
            ELSE 'warning'
        END                                               AS Severity,
        'Document Expiring: ' + dt.Name                  AS Title,
        v.VehicleID,
        v.Numbers                                         AS VehicleNumbers,
        dt.Name                                           AS DocType,
        vd.ExpireDate,
        DATEDIFF(DAY, GETDATE(), vd.ExpireDate)           AS DaysUntil,
        CASE
            WHEN vd.ExpireDate < CAST(GETDATE() AS DATE) THEN dt.Name + ' has expired'
            ELSE dt.Name + ' expires in ' + CAST(DATEDIFF(DAY, GETDATE(), vd.ExpireDate) AS VARCHAR) + ' days'
        END                                               AS [Message]
    FROM VehicleDocument vd
    INNER JOIN Vehicle      v  ON v.VehicleID      = vd.VehicleID
    INNER JOIN DocumentType dt ON dt.DocumentTypeID = vd.DocumentTypeID
    WHERE
        vd.IsActive = 1 AND v.IsActive = 1
        AND vd.ExpireDate IS NOT NULL
        AND DATEDIFF(DAY, GETDATE(), vd.ExpireDate) <= 30

    UNION ALL

    -- 2. Vehicle Service Due (NextServiceDate <= today)
    SELECT
        'serviceDue', 'warning',
        'Service Due: ' + v.Numbers,
        v.VehicleID, v.Numbers, 'Vehicle Service', vs.NextServiceDate,
        DATEDIFF(DAY, GETDATE(), vs.NextServiceDate),
        'Next service due ' +
            CASE WHEN vs.NextServiceDate <= CAST(GETDATE() AS DATE) THEN 'TODAY or overdue'
                 ELSE 'on ' + CONVERT(VARCHAR, vs.NextServiceDate, 23) END
    FROM (
        -- Latest service per vehicle
        SELECT VehicleID, MAX(NextServiceDate) AS NextServiceDate
        FROM VehicleService WHERE IsActive=1 AND NextServiceDate IS NOT NULL
        GROUP BY VehicleID
    ) vs
    INNER JOIN Vehicle v ON v.VehicleID=vs.VehicleID AND v.IsActive=1
    WHERE vs.NextServiceDate <= DATEADD(DAY, 7, CAST(GETDATE() AS DATE))

    UNION ALL

    -- 3. Depreciation Schedule End (end date within 60 days)
    SELECT
        'depreciationEnd', 'info',
        'Depreciation Ending: ' + fa.FixedAssetCode,
        NULL, NULL, 'Depreciation', DATEADD(YEAR, dep.UsefulYears, dep.AssetValueDate),
        DATEDIFF(DAY, GETDATE(), DATEADD(YEAR, dep.UsefulYears, dep.AssetValueDate)),
        'Depreciation schedule for ' + fa.FixedAssetName + ' ends in ' +
            CAST(DATEDIFF(DAY, GETDATE(), DATEADD(YEAR, dep.UsefulYears, dep.AssetValueDate)) AS VARCHAR) + ' days'
    FROM Depreciation dep
    INNER JOIN FixedAsset fa ON fa.FixedAssetID=dep.FixedAssetID AND fa.IsActive=1
    WHERE dep.IsActive=1 AND dep.Status='Active'
        AND DATEDIFF(DAY, GETDATE(), DATEADD(YEAR, dep.UsefulYears, dep.AssetValueDate)) BETWEEN 0 AND 60

    UNION ALL

    -- 4. Warranty Expiry (WarrantyEndDate within 30 days)
    SELECT
        'warrantyExpiry', 'warning',
        'Warranty Expiring: ' + fa.FixedAssetCode,
        NULL, NULL, 'Asset Warranty', fa.WarrantyEndDate,
        DATEDIFF(DAY, GETDATE(), fa.WarrantyEndDate),
        'Warranty for ' + fa.FixedAssetName + ' expires in ' +
            CAST(DATEDIFF(DAY, GETDATE(), fa.WarrantyEndDate) AS VARCHAR) + ' days'
    FROM FixedAsset fa
    WHERE fa.IsActive=1 AND fa.IsWarrantyEnabled=1 AND fa.WarrantyEndDate IS NOT NULL
        AND DATEDIFF(DAY, GETDATE(), fa.WarrantyEndDate) BETWEEN 0 AND 30

    UNION ALL

    -- 5. Asset Maintenance Overdue (Status=Open AND MaintenanceDate < today)
    SELECT
        'assetMaintenanceOverdue', 'danger',
        'Maintenance Overdue: ' + fa.FixedAssetCode,
        NULL, NULL, 'Asset Maintenance', am.MaintenanceDate,
        DATEDIFF(DAY, am.MaintenanceDate, GETDATE()) * -1,
        'Asset maintenance ' + am.MaintenanceCode + ' is overdue by ' +
            CAST(DATEDIFF(DAY, am.MaintenanceDate, GETDATE()) AS VARCHAR) + ' days'
    FROM AssetMaintenance am
    INNER JOIN FixedAsset fa ON fa.FixedAssetID=am.FixedAssetID AND fa.IsActive=1
    WHERE am.IsActive=1 AND am.Status='Open' AND am.MaintenanceDate < CAST(GETDATE() AS DATE)

    UNION ALL

    -- 6. Driver Licence Expiry (LicExpireDate within 30 days)
    SELECT
        'driverLicenceExpiry',
        CASE WHEN d.LicExpireDate < CAST(GETDATE() AS DATE) THEN 'danger' ELSE 'warning' END,
        'Licence Expiring: ' + d.Name,
        NULL, NULL, 'Driver Licence', d.LicExpireDate,
        DATEDIFF(DAY, GETDATE(), d.LicExpireDate),
        'Driver licence for ' + d.Name + ' ' +
            CASE WHEN d.LicExpireDate < CAST(GETDATE() AS DATE) THEN 'has expired'
                 ELSE 'expires in ' + CAST(DATEDIFF(DAY, GETDATE(), d.LicExpireDate) AS VARCHAR) + ' days' END
    FROM Driver d
    WHERE d.IsActive=1 AND DATEDIFF(DAY, GETDATE(), d.LicExpireDate) <= 30;
END;
GO
```
