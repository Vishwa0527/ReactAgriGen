# AgriGEN ERP — Repository Pattern (Dapper)

> **Architecture decision:** Business logic lives in stored procedures. Repositories are thin wrappers that execute SPs via Dapper and map results to DTOs. No LINQ-to-SQL, no EF Core.

---

## 1. DapperContext (already defined in 01-solution-structure.md)

```csharp
// Creates a new IDbConnection per repository method call.
// All connections are disposed after use (using statement).
public class DapperContext
{
    private readonly string _connectionString;
    public DapperContext(IConfiguration config)
        => _connectionString = config.GetConnectionString("Default")!;
    public IDbConnection CreateConnection() => new SqlConnection(_connectionString);
}
```

---

## 2. Base Repository Interface

```csharp
// AgriGEN.Core/Interfaces/Repositories/IRepository.cs
namespace AgriGEN.Core.Interfaces.Repositories;

public interface IRepository<TDto, TRequest>
{
    Task<(IEnumerable<TDto> Items, int Total)> GetAllAsync(int page, int pageSize, string? search = null);
    Task<TDto?> GetByIdAsync(int id);
    Task<int>   CreateAsync(TRequest request, int userId);
    Task        UpdateAsync(int id, TRequest request, int userId);
    Task        DeleteAsync(int id, int userId);
}
```

---

## 3. Helper: Dapper Parameter Conventions

```csharp
// AgriGEN.Infrastructure/Repositories/DapperExtensions.cs
using Dapper;
using System.Data;

namespace AgriGEN.Infrastructure.Repositories;

public static class DapperExtensions
{
    /// <summary>
    /// Execute a SP that returns two result sets: items + total count.
    /// </summary>
    public static async Task<(IEnumerable<T> Items, int Total)> QueryPagedAsync<T>(
        this IDbConnection conn,
        string spName,
        DynamicParameters parameters)
    {
        using var multi = await conn.QueryMultipleAsync(spName, parameters, commandType: CommandType.StoredProcedure);
        var items = await multi.ReadAsync<T>();
        var total = await multi.ReadFirstOrDefaultAsync<int>();
        return (items, total);
    }

    /// <summary>
    /// Execute a SP with an OUTPUT @NewID parameter and return the new identity.
    /// </summary>
    public static async Task<int> ExecuteInsertAsync(
        this IDbConnection conn,
        string spName,
        DynamicParameters parameters)
    {
        parameters.Add("@NewID", dbType: DbType.Int32, direction: ParameterDirection.Output);
        await conn.ExecuteAsync(spName, parameters, commandType: CommandType.StoredProcedure);
        return parameters.Get<int>("@NewID");
    }
}
```

---

## 4. Vehicle Repository (full example)

```csharp
// AgriGEN.Core/Interfaces/Repositories/IVehicleRepository.cs
using AgriGEN.Core.DTOs.Fleet;

public interface IVehicleRepository
{
    Task<(IEnumerable<VehicleDto> Items, int Total)> GetAllAsync(
        int? estateId, int? vehicleTypeId, string? status, string? search, int page, int pageSize);
    Task<VehicleDto?>  GetByIdAsync(int id);
    Task<IEnumerable<object>> GetHistoryAsync(int vehicleId);
    Task<int>   CreateAsync(VehicleRequest request, int userId);
    Task        UpdateAsync(int id, VehicleRequest request, int userId);
    Task        DeleteAsync(int id, int userId);
}

// ─────────────────────────────────────────────────────────────────────────────
// AgriGEN.Infrastructure/Repositories/Fleet/VehicleRepository.cs
using Dapper;
using AgriGEN.Core.DTOs.Fleet;
using AgriGEN.Core.Interfaces.Repositories;
using AgriGEN.Infrastructure.Data;
using System.Data;

namespace AgriGEN.Infrastructure.Repositories.Fleet;

public class VehicleRepository : IVehicleRepository
{
    private readonly DapperContext _ctx;
    public VehicleRepository(DapperContext ctx) => _ctx = ctx;

    public async Task<(IEnumerable<VehicleDto> Items, int Total)> GetAllAsync(
        int? estateId, int? vehicleTypeId, string? status, string? search, int page, int pageSize)
    {
        using var conn = _ctx.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@EstateID",      estateId);
        p.Add("@VehicleTypeID", vehicleTypeId);
        p.Add("@Status",        status);
        p.Add("@Search",        search);
        p.Add("@Page",          page);
        p.Add("@PageSize",      pageSize);
        return await conn.QueryPagedAsync<VehicleDto>("usp_Fleet_Vehicle_GetAll", p);
    }

    public async Task<VehicleDto?> GetByIdAsync(int id)
    {
        using var conn = _ctx.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@VehicleID", id);
        return await conn.QueryFirstOrDefaultAsync<VehicleDto>(
            "usp_Fleet_Vehicle_GetByID", p, commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<object>> GetHistoryAsync(int vehicleId)
    {
        using var conn = _ctx.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@VehicleID", vehicleId);
        return await conn.QueryAsync<object>(
            "usp_Fleet_Vehicle_GetHistory", p, commandType: CommandType.StoredProcedure);
    }

    public async Task<int> CreateAsync(VehicleRequest req, int userId)
    {
        using var conn = _ctx.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@Numbers",          req.Numbers);
        p.Add("@Brand",            req.Brand);
        p.Add("@Model",            req.Model);
        p.Add("@GroupID",          req.GroupID);
        p.Add("@EstateID",         req.EstateID);
        p.Add("@VehicleTypeID",    req.VehicleTypeID);
        p.Add("@FixedAssetTypeID", req.FixedAssetTypeID);
        p.Add("@FuelTypeID",       req.FuelTypeID);
        p.Add("@FixedAssetID",     req.FixedAssetID);
        p.Add("@RegisterYear",     req.RegisterYear is null ? null : DateOnly.Parse(req.RegisterYear));
        p.Add("@Capacity",         req.Capacity);
        p.Add("@Status",           req.Status);
        p.Add("@CreatedBy",        userId);
        return await conn.ExecuteInsertAsync("usp_Fleet_Vehicle_Insert", p);
    }

    public async Task UpdateAsync(int id, VehicleRequest req, int userId)
    {
        using var conn = _ctx.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@VehicleID",        id);
        p.Add("@Numbers",          req.Numbers);
        p.Add("@Brand",            req.Brand);
        p.Add("@Model",            req.Model);
        p.Add("@GroupID",          req.GroupID);
        p.Add("@EstateID",         req.EstateID);
        p.Add("@VehicleTypeID",    req.VehicleTypeID);
        p.Add("@FixedAssetTypeID", req.FixedAssetTypeID);
        p.Add("@FuelTypeID",       req.FuelTypeID);
        p.Add("@FixedAssetID",     req.FixedAssetID);
        p.Add("@RegisterYear",     req.RegisterYear is null ? null : DateOnly.Parse(req.RegisterYear));
        p.Add("@Capacity",         req.Capacity);
        p.Add("@Status",           req.Status);
        p.Add("@ModifiedBy",       userId);
        await conn.ExecuteAsync("usp_Fleet_Vehicle_Update", p, commandType: CommandType.StoredProcedure);
    }

    public async Task DeleteAsync(int id, int userId)
    {
        using var conn = _ctx.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@VehicleID",  id);
        p.Add("@ModifiedBy", userId);
        await conn.ExecuteAsync("usp_Fleet_Vehicle_Delete", p, commandType: CommandType.StoredProcedure);
    }
}
```

---

## 5. FixedAsset Repository (full example)

```csharp
public interface IFixedAssetRepository
{
    Task<(IEnumerable<FixedAssetDto> Items, int Total)> GetAllAsync(
        int? estateId, int? fixedAssetTypeId, string? status, string? search, int page, int pageSize);
    Task<FixedAssetDto?> GetByIdAsync(int id);
    Task<IEnumerable<object>> GetHistoryAsync(int assetId);
    Task<string>  GetNextCodeAsync();
    Task<object>  GetSummaryAsync(int? groupId, int? estateId);
    Task<int>     CreateAsync(FixedAssetRequest request, int userId);
    Task          UpdateAsync(int id, FixedAssetRequest request, int userId);
    Task          DeleteAsync(int id, int userId);
}

public class FixedAssetRepository : IFixedAssetRepository
{
    private readonly DapperContext _ctx;
    public FixedAssetRepository(DapperContext ctx) => _ctx = ctx;

    public async Task<(IEnumerable<FixedAssetDto> Items, int Total)> GetAllAsync(
        int? estateId, int? fixedAssetTypeId, string? status, string? search, int page, int pageSize)
    {
        using var conn = _ctx.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@EstateID",         estateId);
        p.Add("@FixedAssetTypeID", fixedAssetTypeId);
        p.Add("@Status",           status);
        p.Add("@Search",           search);
        p.Add("@Page",             page);
        p.Add("@PageSize",         pageSize);
        return await conn.QueryPagedAsync<FixedAssetDto>("usp_FA_FixedAsset_GetAll", p);
    }

    public async Task<FixedAssetDto?> GetByIdAsync(int id)
    {
        using var conn = _ctx.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@FixedAssetID", id);
        return await conn.QueryFirstOrDefaultAsync<FixedAssetDto>(
            "usp_FA_FixedAsset_GetByID", p, commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<object>> GetHistoryAsync(int assetId)
    {
        using var conn = _ctx.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@FixedAssetID", assetId);
        return await conn.QueryAsync<object>(
            "usp_FA_FixedAsset_GetHistory", p, commandType: CommandType.StoredProcedure);
    }

    public async Task<string> GetNextCodeAsync()
    {
        using var conn = _ctx.CreateConnection();
        return await conn.ExecuteScalarAsync<string>(
            "usp_FA_FixedAsset_GetNextCode", commandType: CommandType.StoredProcedure) ?? "FA-0001";
    }

    public async Task<object> GetSummaryAsync(int? groupId, int? estateId)
    {
        using var conn = _ctx.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@GroupID",  groupId);
        p.Add("@EstateID", estateId);
        return await conn.QueryFirstOrDefaultAsync<object>(
            "usp_FA_FixedAsset_GetSummary", p, commandType: CommandType.StoredProcedure) ?? new { };
    }

    public async Task<int> CreateAsync(FixedAssetRequest req, int userId)
    {
        using var conn = _ctx.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@FixedAssetTypeID",     req.FixedAssetTypeID);
        p.Add("@FixedAssetCategoryID", req.FixedAssetCategoryID);
        p.Add("@FixedAssetCode",       req.Code);
        p.Add("@FixedAssetName",       req.Name);
        p.Add("@GroupID",              req.GroupID);
        p.Add("@EstateID",             req.EstateID);
        p.Add("@TotalCostOfAsset",     req.TotalCostOfAsset);
        p.Add("@ResidualValue",        req.ResidualValue);
        p.Add("@ImplementationCost",   req.ImplementationCost);
        p.Add("@ImplementationDate",   req.ImplementationDate is null ? null : DateOnly.Parse(req.ImplementationDate));
        p.Add("@StartDate",            DateOnly.Parse(req.StartDate));
        p.Add("@UsefulLifeYears",      req.UsefulLifeYears);
        p.Add("@IsFuelNeeded",         req.IsFuelNeeded);
        p.Add("@FuelTypeID",           req.FuelTypeID);
        p.Add("@IsWarrantyEnabled",    req.IsWarrantyEnabled);
        p.Add("@WarrantyStartDate",    req.WarrantyStartDate is null ? null : DateOnly.Parse(req.WarrantyStartDate));
        p.Add("@WarrantyEndDate",      req.WarrantyEndDate   is null ? null : DateOnly.Parse(req.WarrantyEndDate));
        p.Add("@RegistrationNumber",   req.RegistrationNumber);
        p.Add("@DepreciationValue",    req.DepreciationValue);
        p.Add("@LedgerTransactionRef", req.LedgerTransactionRef);
        p.Add("@CreatedBy",            userId);
        return await conn.ExecuteInsertAsync("usp_FA_FixedAsset_Insert", p);
    }

    public async Task UpdateAsync(int id, FixedAssetRequest req, int userId)
    {
        using var conn = _ctx.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@FixedAssetID",         id);
        // ... same params as CreateAsync but with @ModifiedBy instead of @CreatedBy and @Status
        p.Add("@FixedAssetTypeID",     req.FixedAssetTypeID);
        p.Add("@FixedAssetCategoryID", req.FixedAssetCategoryID);
        p.Add("@FixedAssetCode",       req.Code);
        p.Add("@FixedAssetName",       req.Name);
        p.Add("@GroupID",              req.GroupID);
        p.Add("@EstateID",             req.EstateID);
        p.Add("@TotalCostOfAsset",     req.TotalCostOfAsset);
        p.Add("@ResidualValue",        req.ResidualValue);
        p.Add("@ImplementationCost",   req.ImplementationCost);
        p.Add("@ImplementationDate",   req.ImplementationDate is null ? null : DateOnly.Parse(req.ImplementationDate));
        p.Add("@StartDate",            DateOnly.Parse(req.StartDate));
        p.Add("@UsefulLifeYears",      req.UsefulLifeYears);
        p.Add("@IsFuelNeeded",         req.IsFuelNeeded);
        p.Add("@FuelTypeID",           req.FuelTypeID);
        p.Add("@IsWarrantyEnabled",    req.IsWarrantyEnabled);
        p.Add("@WarrantyStartDate",    req.WarrantyStartDate is null ? null : DateOnly.Parse(req.WarrantyStartDate));
        p.Add("@WarrantyEndDate",      req.WarrantyEndDate   is null ? null : DateOnly.Parse(req.WarrantyEndDate));
        p.Add("@RegistrationNumber",   req.RegistrationNumber);
        p.Add("@DepreciationValue",    req.DepreciationValue);
        p.Add("@LedgerTransactionRef", req.LedgerTransactionRef);
        p.Add("@Status",               req.Status);
        p.Add("@ModifiedBy",           userId);
        await conn.ExecuteAsync("usp_FA_FixedAsset_Update", p, commandType: CommandType.StoredProcedure);
    }

    public async Task DeleteAsync(int id, int userId)
    {
        using var conn = _ctx.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@FixedAssetID", id);
        p.Add("@ModifiedBy",   userId);
        await conn.ExecuteAsync("usp_FA_FixedAsset_Delete", p, commandType: CommandType.StoredProcedure);
    }
}
```

---

## 6. Disposal Repository (atomic SP)

```csharp
public interface IDisposalRepository
{
    Task<(IEnumerable<DisposalDto> Items, int Total)> GetAllAsync(int? fixedAssetId, int? estateId, string? disposalType, string? from, string? to, int page, int pageSize);
    Task<DisposalDto?> GetByIdAsync(int id);
    Task<string>  GetNextCodeAsync();
    Task<object>  GetSummaryAsync(int? estateId);
    Task<int>     CreateAsync(DisposalRequest request, int userId);    // calls atomic SP
    Task          UpdateAsync(int id, DisposalUpdateRequest request, int userId);
    Task          DeleteAsync(int id, int userId);
}

public class DisposalRepository : IDisposalRepository
{
    private readonly DapperContext _ctx;
    public DisposalRepository(DapperContext ctx) => _ctx = ctx;

    public async Task<int> CreateAsync(DisposalRequest req, int userId)
    {
        using var conn = _ctx.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@DisposalCode",         req.DisposalCode);
        p.Add("@FixedAssetID",         req.FixedAssetID);
        p.Add("@GroupID",              req.GroupID);
        p.Add("@EstateID",             req.EstateID);
        p.Add("@DisposalDate",         DateOnly.Parse(req.DisposalDate));
        p.Add("@DisposalType",         req.DisposalType);
        p.Add("@BookValueAtDisposal",  req.BookValueAtDisposal);
        p.Add("@SaleProceeds",         req.SaleProceeds);
        p.Add("@GainLossOnDisposal",   req.GainLossOnDisposal);
        p.Add("@DisposalReason",       req.DisposalReason);
        p.Add("@ApprovedBy",           req.ApprovedBy);
        p.Add("@Notes",                req.Notes);
        p.Add("@DisposalStatusTypeID", req.DisposalStatusTypeID);
        p.Add("@CreatedBy",            userId);
        return await conn.ExecuteInsertAsync("usp_FA_Disposal_Insert", p);
        // This SP runs 5 business rules atomically — see 05-stored-procedures-assets.md
    }

    // ... other methods follow the same pattern
}
```

---

## 7. Report Repository

```csharp
public interface IReportRepository
{
    Task<IEnumerable<object>> GetFleetRegisterAsync(int? estateId, int? groupId, string? status);
    Task<IEnumerable<object>> GetVehicleDocumentsAsync(int? estateId, int? groupId);
    Task<IEnumerable<object>> GetDriverAssignmentsAsync(int? estateId, int? groupId, bool activeOnly);
    Task<IEnumerable<object>> GetDailyRunningAsync(int? estateId, int? groupId, string? from, string? to);
    Task<IEnumerable<object>> GetDepreciationScheduleAsync(int? estateId, int? groupId);
    Task<IEnumerable<object>> GetAssetNBVAsync(int? estateId, int? groupId);
    Task<IEnumerable<object>> GetAssetMaintenanceAsync(int? estateId, int? groupId, string? from, string? to);
}

public class ReportRepository : IReportRepository
{
    private readonly DapperContext _ctx;
    public ReportRepository(DapperContext ctx) => _ctx = ctx;

    public async Task<IEnumerable<object>> GetFleetRegisterAsync(int? estateId, int? groupId, string? status)
    {
        using var conn = _ctx.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@EstateID", estateId);
        p.Add("@GroupID",  groupId);
        p.Add("@Status",   status);
        return await conn.QueryAsync<object>(
            "usp_Report_FleetRegister_Get", p, commandType: CommandType.StoredProcedure);
    }

    // ... other report methods follow the same pattern
}
```

---

## 8. Alerts Repository

```csharp
public interface IAlertsRepository
{
    Task<AlertsGroupedDto> GetAllAsync();
}

public class AlertsRepository : IAlertsRepository
{
    private readonly DapperContext _ctx;
    public AlertsRepository(DapperContext ctx) => _ctx = ctx;

    public async Task<AlertsGroupedDto> GetAllAsync()
    {
        using var conn = _ctx.CreateConnection();
        var rows = await conn.QueryAsync<AlertItemDto>(
            "usp_Alerts_GetAll", commandType: CommandType.StoredProcedure);

        var result = new AlertsGroupedDto();
        foreach (var row in rows)
        {
            switch (row.AlertType)
            {
                case "documentExpiry":          result.DocumentExpiry.Add(row);          break;
                case "serviceDue":              result.ServiceDue.Add(row);              break;
                case "depreciationEnd":         result.DepreciationEnd.Add(row);         break;
                case "warrantyExpiry":          result.WarrantyExpiry.Add(row);          break;
                case "assetMaintenanceOverdue": result.AssetMaintenanceOverdue.Add(row); break;
                case "driverLicenceExpiry":     result.DriverLicenceExpiry.Add(row);     break;
            }
        }
        return result;
    }
}
```

---

## 9. Repository Interface Summary

| Interface | Implementation | SP Prefix |
|-----------|---------------|-----------|
| IGroupRepository | GroupRepository | `usp_Shared_Group_*` |
| IEstateRepository | EstateRepository | `usp_Shared_Estate_*` |
| IFixedAssetTypeRepository | FixedAssetTypeRepository | `usp_Shared_FixedAssetType_*` |
| IFixedAssetCategoryRepository | FixedAssetCategoryRepository | `usp_Shared_FixedAssetCategory_*` |
| IWorkshopCategoryRepository | WorkshopCategoryRepository | `usp_Shared_WorkshopCategory_*` |
| IWorkshopRepository | WorkshopRepository | `usp_Shared_Workshop_*` |
| IWorkshopInventoryRepository | WorkshopInventoryRepository | `usp_Shared_WorkshopInventory_*` |
| IVehicleTypeRepository | VehicleTypeRepository | `usp_Fleet_VehicleType_*` |
| IFuelTypeRepository | FuelTypeRepository | `usp_Fleet_FuelType_*` |
| IDocumentTypeRepository | DocumentTypeRepository | `usp_Fleet_DocumentType_*` |
| IPurposeCategoryRepository | PurposeCategoryRepository | `usp_Fleet_PurposeCategory_*` |
| ILicenseCategoryRepository | LicenseCategoryRepository | `usp_Fleet_LicenseCategory_*` |
| ITechCategoryRepository | TechCategoryRepository | `usp_Fleet_TechCategory_*` |
| IVehicleRepository | VehicleRepository | `usp_Fleet_Vehicle_*` |
| IVehicleDocumentRepository | VehicleDocumentRepository | `usp_Fleet_VehicleDocument_*` |
| IVehiclePurposeRepository | VehiclePurposeRepository | `usp_Fleet_VehiclePurpose_*` |
| IDriverRepository | DriverRepository | `usp_Fleet_Driver_*` |
| IDriverAssignmentRepository | DriverAssignmentRepository | `usp_Fleet_DriverAssignment_*` |
| IDailyRunningRepository | DailyRunningRepository | `usp_Fleet_DailyRunning_*` |
| ITechAssignmentRepository | TechAssignmentRepository | `usp_Fleet_TechAssignment_*` |
| IWorkshopTechRateRepository | WorkshopTechRateRepository | `usp_Fleet_WorkshopTechRate_*` |
| IMaintenanceTaskRepository | MaintenanceTaskRepository | `usp_Fleet_MaintenanceTask_*` |
| IJobCardRepository | JobCardRepository | `usp_Fleet_JobCard_*` |
| IMaintenanceRecordRepository | MaintenanceRecordRepository | `usp_Fleet_MaintenanceRecord_*` |
| IVehicleServiceRepository | VehicleServiceRepository | `usp_Fleet_VehicleService_*` |
| IItemIssueRepository | ItemIssueRepository | `usp_Fleet_ItemIssue_*` |
| IFixedAssetRepository | FixedAssetRepository | `usp_FA_FixedAsset_*` |
| IDepreciationRepository | DepreciationRepository | `usp_FA_Depreciation_*` |
| IDepreciationHistoryRepository | DepreciationHistoryRepository | `usp_FA_DepreciationHistory_*` |
| IAssetMaintenanceRepository | AssetMaintenanceRepository | `usp_FA_AssetMaintenance_*` |
| IEstimationRepository | EstimationRepository | `usp_FA_Estimation_*` |
| IDisposalRepository | DisposalRepository | `usp_FA_Disposal_*` |
| IReportRepository | ReportRepository | `usp_Report_*` |
| IAlertsRepository | AlertsRepository | `usp_Alerts_*` |
