# AgriGEN ERP — API Controllers

> All controllers inherit `ApiControllerBase` (defined in `01-solution-structure.md`).  
> All are decorated `[Authorize]` by default — override individual actions with `[AllowAnonymous]` for lookup-only endpoints if needed.  
> Response format is always `ApiResponse<T>` (the envelope).

---

## 1. Auth Controller

```csharp
// Route: api/auth
[Route("api/auth")]
[AllowAnonymous]
public class AuthController : ApiControllerBase
{
    private readonly IAuthRepository _auth;
    private readonly IConfiguration  _config;

    public AuthController(IAuthRepository auth, IConfiguration config)
    { _auth = auth; _config = config; }

    // POST api/auth/login
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var user = await _auth.ValidateAsync(req.Username, req.Password);
        if (user is null)
            return Unauthorized(ApiResponse.Fail("Invalid credentials."));

        var token   = JwtHelper.GenerateToken(user, _config);
        var expiry  = DateTime.UtcNow.AddHours(
            _config.GetValue<int>("JwtSettings:ExpiryHours"));

        return Success(new LoginResponse
        {
            Token        = token,
            Username     = user.Username,
            EmployeeName = user.EmployeeName,
            RoleCode     = user.RoleCode,
            GroupID      = user.GroupID,
            EstateID     = user.EstateID,
            ExpiresAt    = expiry,
        });
    }
}
```

---

## 2. Groups Controller (read-only)

```csharp
// Route: api/groups
public class GroupsController : ApiControllerBase
{
    private readonly IGroupRepository _repo;
    public GroupsController(IGroupRepository repo) => _repo = repo;

    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Success(await _repo.GetAllAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var item = await _repo.GetByIdAsync(id);
        return item is null ? NotFound("Group not found.") : Success(item);
    }
}
```

---

## 3. Estates Controller (read-only + filter)

```csharp
// Route: api/estates
public class EstatesController : ApiControllerBase
{
    private readonly IEstateRepository _repo;
    public EstatesController(IEstateRepository repo) => _repo = repo;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? groupId, [FromQuery] string? search)
        => Success(await _repo.GetAllAsync(groupId, search));

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var item = await _repo.GetByIdAsync(id);
        return item is null ? NotFound("Estate not found.") : Success(item);
    }
}
```

---

## 4. FixedAssetTypes Controller (full CRUD — template for all lookup controllers)

```csharp
// Route: api/fixed-asset-types
public class FixedAssetTypesController : ApiControllerBase
{
    private readonly IFixedAssetTypeRepository _repo;
    public FixedAssetTypesController(IFixedAssetTypeRepository repo) => _repo = repo;

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? groupId, [FromQuery] string? search,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 100)
    {
        var (items, total) = await _repo.GetAllAsync(groupId, search, page, pageSize);
        return SuccessList(items, total, page, pageSize);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var item = await _repo.GetByIdAsync(id);
        return item is null ? NotFound("Fixed asset type not found.") : Success(item);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] FixedAssetTypeRequest req)
    {
        var newId = await _repo.CreateAsync(req, CurrentUserId);
        var item  = await _repo.GetByIdAsync(newId);
        return Created(item!);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] FixedAssetTypeRequest req)
    {
        await _repo.UpdateAsync(id, req, CurrentUserId);
        return Success(await _repo.GetByIdAsync(id));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        await _repo.DeleteAsync(id, CurrentUserId);
        return Success<object?>(null);
    }
}
```

> **This pattern is identical for:**  
> `FixedAssetCategoriesController`, `WorkshopCategoriesController`, `VehicleTypesController`,  
> `FuelTypesController`, `DocumentTypesController`, `PurposeCategoriesController`,  
> `LicenseCategoriesController`, `TechCategoriesController`
>
> Just swap the repository interface and request/DTO types.

---

## 5. Vehicles Controller

```csharp
// Route: api/vehicles
public class VehiclesController : ApiControllerBase
{
    private readonly IVehicleRepository _repo;
    public VehiclesController(IVehicleRepository repo) => _repo = repo;

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? estateId, [FromQuery] int? vehicleTypeId,
        [FromQuery] string? status, [FromQuery] string? search,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 100)
    {
        var (items, total) = await _repo.GetAllAsync(estateId, vehicleTypeId, status, search, page, pageSize);
        return SuccessList(items, total, page, pageSize);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var item = await _repo.GetByIdAsync(id);
        return item is null ? NotFound("Vehicle not found.") : Success(item);
    }

    [HttpGet("{id}/history")]
    public async Task<IActionResult> GetHistory(int id)
        => Success(await _repo.GetHistoryAsync(id));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] VehicleRequest req)
    {
        var newId = await _repo.CreateAsync(req, CurrentUserId);
        return Created(await _repo.GetByIdAsync(newId));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] VehicleRequest req)
    {
        await _repo.UpdateAsync(id, req, CurrentUserId);
        return Success(await _repo.GetByIdAsync(id));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        await _repo.DeleteAsync(id, CurrentUserId);
        return Success<object?>(null);
    }
}
```

---

## 6. Fixed Assets Controller

```csharp
// Route: api/fixed-assets
public class FixedAssetsController : ApiControllerBase
{
    private readonly IFixedAssetRepository _repo;
    public FixedAssetsController(IFixedAssetRepository repo) => _repo = repo;

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? estateId, [FromQuery] int? fixedAssetTypeId,
        [FromQuery] string? status, [FromQuery] string? search,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 100)
    {
        var (items, total) = await _repo.GetAllAsync(estateId, fixedAssetTypeId, status, search, page, pageSize);
        return SuccessList(items, total, page, pageSize);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var item = await _repo.GetByIdAsync(id);
        return item is null ? NotFound("Fixed asset not found.") : Success(item);
    }

    [HttpGet("{id}/history")]
    public async Task<IActionResult> GetHistory(int id)
        => Success(await _repo.GetHistoryAsync(id));

    [HttpGet("next-code")]
    public async Task<IActionResult> GetNextCode()
        => Success(new { code = await _repo.GetNextCodeAsync() });

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] int? groupId, [FromQuery] int? estateId)
        => Success(await _repo.GetSummaryAsync(groupId, estateId));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] FixedAssetRequest req)
    {
        var newId = await _repo.CreateAsync(req, CurrentUserId);
        return Created(await _repo.GetByIdAsync(newId));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] FixedAssetRequest req)
    {
        await _repo.UpdateAsync(id, req, CurrentUserId);
        return Success(await _repo.GetByIdAsync(id));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        await _repo.DeleteAsync(id, CurrentUserId);
        return Success<object?>(null);
    }
}
```

---

## 7. Disposals Controller

```csharp
// Route: api/disposals
public class DisposalsController : ApiControllerBase
{
    private readonly IDisposalRepository _repo;
    public DisposalsController(IDisposalRepository repo) => _repo = repo;

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? fixedAssetId, [FromQuery] int? estateId,
        [FromQuery] string? disposalType, [FromQuery] string? from, [FromQuery] string? to,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 100)
    {
        var (items, total) = await _repo.GetAllAsync(fixedAssetId, estateId, disposalType, from, to, page, pageSize);
        return SuccessList(items, total, page, pageSize);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var item = await _repo.GetByIdAsync(id);
        return item is null ? NotFound("Disposal not found.") : Success(item);
    }

    [HttpGet("next-code")]
    public async Task<IActionResult> GetNextCode()
        => Success(new { code = await _repo.GetNextCodeAsync() });

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] int? estateId)
        => Success(await _repo.GetSummaryAsync(estateId));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] DisposalRequest req)
    {
        var newId = await _repo.CreateAsync(req, CurrentUserId);
        return Created(await _repo.GetByIdAsync(newId));
        // Note: this SP atomically: inserts disposal, marks asset Disposed,
        // closes depreciation schedules, creates history snapshot, unlinks vehicle.
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] DisposalUpdateRequest req)
    {
        await _repo.UpdateAsync(id, req, CurrentUserId);
        return Success(await _repo.GetByIdAsync(id));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        await _repo.DeleteAsync(id, CurrentUserId);
        return Success<object?>(null);
    }
}
```

---

## 8. Reports Controller

```csharp
// Route: api/reports
public class ReportsController : ApiControllerBase
{
    private readonly IReportRepository _repo;
    public ReportsController(IReportRepository repo) => _repo = repo;

    // GET api/reports/fleet-register?estateId=1&status=Active
    [HttpGet("fleet-register")]
    public async Task<IActionResult> FleetRegister(
        [FromQuery] int? estateId, [FromQuery] int? groupId, [FromQuery] string? status)
        => Success(await _repo.GetFleetRegisterAsync(estateId, groupId, status));

    // GET api/reports/vehicle-documents?estateId=1
    [HttpGet("vehicle-documents")]
    public async Task<IActionResult> VehicleDocuments(
        [FromQuery] int? estateId, [FromQuery] int? groupId)
        => Success(await _repo.GetVehicleDocumentsAsync(estateId, groupId));

    // GET api/reports/driver-assignments?activeOnly=true
    [HttpGet("driver-assignments")]
    public async Task<IActionResult> DriverAssignments(
        [FromQuery] int? estateId, [FromQuery] int? groupId, [FromQuery] bool activeOnly = false)
        => Success(await _repo.GetDriverAssignmentsAsync(estateId, groupId, activeOnly));

    // GET api/reports/daily-running?from=2024-01-01&to=2024-12-31
    [HttpGet("daily-running")]
    public async Task<IActionResult> DailyRunning(
        [FromQuery] int? estateId, [FromQuery] int? groupId,
        [FromQuery] string? from, [FromQuery] string? to)
        => Success(await _repo.GetDailyRunningAsync(estateId, groupId, from, to));

    // GET api/reports/depreciation-schedule
    [HttpGet("depreciation-schedule")]
    public async Task<IActionResult> DepreciationSchedule(
        [FromQuery] int? estateId, [FromQuery] int? groupId)
        => Success(await _repo.GetDepreciationScheduleAsync(estateId, groupId));

    // GET api/reports/asset-nbv
    [HttpGet("asset-nbv")]
    public async Task<IActionResult> AssetNBV(
        [FromQuery] int? estateId, [FromQuery] int? groupId)
        => Success(await _repo.GetAssetNBVAsync(estateId, groupId));

    // GET api/reports/asset-maintenance?from=2024-01-01&to=2024-12-31
    [HttpGet("asset-maintenance")]
    public async Task<IActionResult> AssetMaintenance(
        [FromQuery] int? estateId, [FromQuery] int? groupId,
        [FromQuery] string? from, [FromQuery] string? to)
        => Success(await _repo.GetAssetMaintenanceAsync(estateId, groupId, from, to));
}
```

---

## 9. Alerts Controller

```csharp
// Route: api/alerts
public class AlertsController : ApiControllerBase
{
    private readonly IAlertsRepository _repo;
    public AlertsController(IAlertsRepository repo) => _repo = repo;

    // GET api/alerts
    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Success(await _repo.GetAllAsync());
}
```

---

## 10. Controller Route Summary

| Controller | Route | Key Actions |
|------------|-------|-------------|
| AuthController | `api/auth` | POST login |
| GroupsController | `api/groups` | GET list, GET by id |
| EstatesController | `api/estates` | GET list (?groupId), GET by id |
| EmployeesController | `api/hr/employees` | GET list (?designation) |
| FixedAssetTypesController | `api/fixed-asset-types` | CRUD |
| FixedAssetCategoriesController | `api/fixed-asset-categories` | CRUD, ?fixedAssetTypeId |
| WorkshopCategoriesController | `api/workshop-categories` | CRUD |
| VehicleTypesController | `api/vehicle-types` | CRUD |
| FuelTypesController | `api/fuel-types` | CRUD |
| DocumentTypesController | `api/document-types` | CRUD |
| PurposeCategoriesController | `api/purpose-categories` | CRUD |
| LicenseCategoriesController | `api/license-categories` | CRUD |
| TechCategoriesController | `api/tech-categories` | CRUD |
| VehiclesController | `api/vehicles` | CRUD, `/{id}/history` |
| VehicleDocumentsController | `api/vehicle-documents` | CRUD, ?vehicleId |
| VehiclePurposesController | `api/vehicle-purposes` | CRUD, ?vehicleId |
| DriversController | `api/drivers` | CRUD |
| DriverAssignmentsController | `api/driver-assignments` | CRUD, ?vehicleId, ?driverId, ?activeOnly |
| DailyRunningController | `api/daily-running` | CRUD, ?vehicleId, ?from, ?to, `next-code` |
| TechAssignmentsController | `api/tech-assignments` | CRUD |
| WorkshopsController | `api/workshops` | CRUD |
| WorkshopHistoryController | `api/workshop-history` | CRUD, ?workshopId |
| WorkshopTechRatesController | `api/workshop-tech-rates` | CRUD, ?workshopId |
| WorkshopInventoryController | `api/workshop-inventory` | CRUD, ?workshopId, `/{id}/batches` |
| MaintenanceTasksController | `api/maintenance-tasks` | CRUD, ?vehicleId, ?taskType, `next-code` |
| JobCardsController | `api/job-cards` | CRUD, ?maintenanceTaskId |
| MaintenanceRecordsController | `api/maintenance-records` | CRUD, ?maintenanceTaskId, ?vehicleId |
| VehicleServiceController | `api/vehicle-service` | CRUD, ?vehicleId, ?overdue |
| ItemIssuesController | `api/item-issues` | CRUD, `next-code` |
| FixedAssetsController | `api/fixed-assets` | CRUD, `/{id}/history`, `next-code`, `summary` |
| DepreciationController | `api/depreciation` | CRUD, ?fixedAssetId, `calculate` |
| DepreciationHistoryController | `api/depreciation-history` | CRUD, ?fixedAssetId, `total-posted/{assetId}`, `post` |
| AssetMaintenanceController | `api/asset-maintenance` | CRUD, ?fixedAssetId, `next-code` |
| EstimationsController | `api/estimations` | CRUD, ?fixedAssetId, `next-code` |
| DisposalStatusTypesController | `api/disposal-status-types` | GET only |
| DisposalsController | `api/disposals` | CRUD, ?fixedAssetId, `next-code`, `summary` |
| ReportsController | `api/reports` | 7 report GET endpoints |
| AlertsController | `api/alerts` | GET all |
