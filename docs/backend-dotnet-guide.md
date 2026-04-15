# AgriGEN ERP — Fleet & Fixed Asset Management
# .NET Core 6 Web API — Architecture Guide

**Framework:** .NET Core 6 Web API  
**ORM:** Entity Framework Core 6  
**Database:** MSSQL (SQL Server 2019+)  
**Consumer:** ReactAgriGen SPA (React 19)  
**Last Updated:** 2026-04-15

---

## 1. Project Structure

```
AgriGEN.FleetFA.API/
│
├── Program.cs                     # Startup — services, middleware, EF, CORS, JWT
│
├── Controllers/
│   ├── Base/
│   │   └── ApiBaseController.cs   # Returns ApiResponse<T>, inherits ControllerBase
│   ├── GroupsController.cs
│   ├── EstatesController.cs
│   ├── VehiclesController.cs
│   ├── VehicleDocumentsController.cs
│   ├── VehiclePurposesController.cs
│   ├── DriversController.cs
│   ├── DriverAssignmentsController.cs
│   ├── DailyRunningController.cs
│   ├── WorkshopsController.cs
│   ├── WorkshopHistoryController.cs
│   ├── WorkshopTechRatesController.cs
│   ├── TechCategoriesController.cs
│   ├── TechAssignmentsController.cs
│   ├── MaintenanceTasksController.cs
│   ├── JobCardsController.cs
│   ├── MaintenanceRecordsController.cs
│   ├── VehicleServiceController.cs
│   ├── VehicleTypesController.cs
│   ├── FuelTypesController.cs
│   ├── DocumentTypesController.cs
│   ├── PurposeCategoriesController.cs
│   ├── LicenseCategoriesController.cs
│   ├── FixedAssetTypesController.cs
│   ├── FixedAssetCategoriesController.cs
│   ├── WorkshopCategoriesController.cs
│   ├── FixedAssetsController.cs
│   ├── DepreciationController.cs
│   ├── DepreciationHistoryController.cs
│   ├── AssetMaintenanceController.cs
│   ├── EstimationsController.cs
│   ├── DisposalsController.cs
│   ├── AlertsController.cs
│   └── ReportsController.cs
│
├── Services/
│   ├── Interfaces/
│   │   ├── IVehicleService.cs
│   │   ├── IFixedAssetService.cs
│   │   ├── IDisposalService.cs
│   │   ├── IDepreciationService.cs
│   │   └── IAlertService.cs
│   └── Implementations/
│       ├── VehicleService.cs
│       ├── FixedAssetService.cs
│       ├── DisposalService.cs      # Handles disposal transaction (4 side effects)
│       ├── DepreciationService.cs
│       └── AlertService.cs
│
├── Models/
│   ├── Entities/                  # EF Core entity classes (map to DB tables)
│   │   ├── Vehicle.cs
│   │   ├── FixedAsset.cs
│   │   └── ...
│   └── DTOs/                      # Request/Response transfer objects
│       ├── VehicleDto.cs
│       ├── FixedAssetDto.cs
│       ├── DisposalDto.cs
│       └── ...
│
├── Data/
│   ├── AppDbContext.cs            # EF Core DbContext with soft-delete global filter
│   └── Configurations/            # IEntityTypeConfiguration<T> per entity
│       ├── VehicleConfiguration.cs
│       └── ...
│
├── Common/
│   ├── ApiResponse.cs             # Generic response wrapper
│   ├── PagedResult.cs             # Pagination wrapper
│   └── SoftDeletableEntity.cs     # Base class with IsActive + audit columns
│
└── Middleware/
    └── ExceptionMiddleware.cs     # Global exception → ApiResponse(success:false)
```

---

## 2. Generic Response Wrapper

```csharp
// Common/ApiResponse.cs
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public string? Message { get; set; }
    public List<string>? Errors { get; set; }
    public int? Total { get; set; }       // for list responses
    public int? Page { get; set; }
    public int? PageSize { get; set; }

    public static ApiResponse<T> Ok(T data, int? total = null, int? page = null, int? pageSize = null)
        => new() { Success = true, Data = data, Total = total, Page = page, PageSize = pageSize };

    public static ApiResponse<T> Fail(string message, List<string>? errors = null)
        => new() { Success = false, Message = message, Errors = errors };
}
```

---

## 3. Base Controller

```csharp
// Controllers/Base/ApiBaseController.cs
[ApiController]
[Route("api/[controller]")]
[Authorize]
public abstract class ApiBaseController : ControllerBase
{
    protected IActionResult Ok<T>(T data) =>
        base.Ok(ApiResponse<T>.Ok(data));

    protected IActionResult OkList<T>(IEnumerable<T> items, int total, int page, int pageSize) =>
        base.Ok(ApiResponse<IEnumerable<T>>.Ok(items, total, page, pageSize));

    protected IActionResult Created<T>(T data) =>
        base.StatusCode(201, ApiResponse<T>.Ok(data));

    protected IActionResult Fail(string message, int statusCode = 400) =>
        base.StatusCode(statusCode, ApiResponse<object>.Fail(message));

    protected IActionResult NotFound(string entity, int id) =>
        base.NotFound(ApiResponse<object>.Fail($"{entity} with id {id} not found."));
}
```

---

## 4. Soft-Delete Base Entity

```csharp
// Common/SoftDeletableEntity.cs
public abstract class SoftDeletableEntity
{
    public bool IsActive { get; set; } = true;
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    public string? ModifiedBy { get; set; }
    public DateTime? ModifiedDate { get; set; }
}
```

---

## 5. EF Core DbContext with Soft-Delete Global Filter

```csharp
// Data/AppDbContext.cs
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // Fleet
    public DbSet<Vehicle> Vehicles { get; set; }
    public DbSet<VehicleHistory> VehicleHistory { get; set; }
    public DbSet<VehicleDocument> VehicleDocuments { get; set; }
    public DbSet<Driver> Drivers { get; set; }
    public DbSet<DriverAssignment> DriverAssignments { get; set; }
    public DbSet<DailyRunning> DailyRunning { get; set; }
    public DbSet<Workshop> Workshops { get; set; }
    public DbSet<MaintenanceTask> MaintenanceTasks { get; set; }
    public DbSet<VehicleService> VehicleServices { get; set; }
    // ...add all other DbSets...

    // Fixed Asset
    public DbSet<FixedAsset> FixedAssets { get; set; }
    public DbSet<FixedAssetHistory> FixedAssetHistory { get; set; }
    public DbSet<Depreciation> Depreciation { get; set; }
    public DbSet<DepreciationHistory> DepreciationHistory { get; set; }
    public DbSet<AssetMaintenance> AssetMaintenances { get; set; }
    public DbSet<Estimation> Estimations { get; set; }
    public DbSet<Disposal> Disposals { get; set; }
    public DbSet<DisposalStatusType> DisposalStatusTypes { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Apply all IEntityTypeConfiguration<T> classes in this assembly
        modelBuilder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());

        // Global soft-delete filter — applied to all entities inheriting SoftDeletableEntity
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(SoftDeletableEntity).IsAssignableFrom(entityType.ClrType))
            {
                var parameter = Expression.Parameter(entityType.ClrType, "e");
                var filter    = Expression.Lambda(
                    Expression.Equal(
                        Expression.Property(parameter, nameof(SoftDeletableEntity.IsActive)),
                        Expression.Constant(true)
                    ),
                    parameter
                );
                modelBuilder.Entity(entityType.ClrType).HasQueryFilter(filter);
            }
        }
    }
}
```

---

## 6. JSON CamelCase + Naming Convention

```csharp
// Program.cs
builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        // First char lowercased, rest preserved:
        // GroupID → groupID, EstateID → estateID, Id → id
        opts.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        opts.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });
```

**DTO property naming rules (must match React frontend exactly):**
- Primary key: `public int Id { get; set; }` → JSON: `"id"`
- Foreign keys: `public int GroupID { get; set; }` → JSON: `"groupID"`
- Foreign keys: `public int EstateID { get; set; }` → JSON: `"estateID"`
- Booleans: `public bool IsActive { get; set; }` → JSON: `"isActive"`
- Regular fields: `public string Numbers { get; set; }` → JSON: `"numbers"`

> ⚠️ Do NOT name FKs as `GroupId` (lowercase 'd') — the React frontend uses `groupID` (uppercase D).

---

## 7. CORS Configuration

```csharp
// Program.cs
builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactDev", policy =>
    {
        policy.WithOrigins(
                "http://localhost:5173",    // Vite dev server
                "https://agrithmics.com"   // Production domain
              )
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// ...
app.UseCors("ReactDev");
```

---

## 8. JWT Authentication

```csharp
// Program.cs
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts =>
    {
        opts.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidIssuer              = builder.Configuration["Jwt:Issuer"],
            ValidateAudience         = true,
            ValidAudience            = builder.Configuration["Jwt:Audience"],
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey         = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
        };
    });
```

**Frontend sends token in all API calls:**
```js
fetch('/api/vehicles', {
    headers: { 'Authorization': `Bearer ${token}` }
})
```

---

## 9. Disposal Service (Transaction with Side Effects)

The Disposal creation must be atomic. Wrap all 4 operations in a single EF transaction:

```csharp
// Services/Implementations/DisposalService.cs
public async Task<Disposal> CreateDisposalAsync(DisposalCreateDto dto, string createdBy)
{
    using var transaction = await _context.Database.BeginTransactionAsync();
    try
    {
        // 1. Insert Disposal row
        var disposal = _mapper.Map<Disposal>(dto);
        disposal.CreatedBy = createdBy;
        _context.Disposals.Add(disposal);

        // 2. Mark FixedAsset as Disposed
        var asset = await _context.FixedAssets.FindAsync(dto.FixedAssetID)
            ?? throw new KeyNotFoundException($"FixedAsset {dto.FixedAssetID} not found.");
        asset.Status = "Disposed";
        asset.ModifiedBy = createdBy;
        asset.ModifiedDate = DateTime.UtcNow;

        // 3. Close all open Depreciation schedules for this asset
        var schedules = await _context.Depreciation
            .Where(d => d.FixedAssetID == dto.FixedAssetID && d.Status == "Active")
            .ToListAsync();
        foreach (var s in schedules)
        {
            s.Status = "Closed";
            s.ModifiedBy = createdBy;
            s.ModifiedDate = DateTime.UtcNow;
        }

        // 4. Auto-create FixedAssetHistory snapshot with EventType = 'Disposal'
        var snapshot = new FixedAssetHistory
        {
            FixedAssetID    = asset.FixedAssetID,
            FixedAssetCode  = asset.FixedAssetCode,
            FixedAssetName  = asset.FixedAssetName,
            TotalCostOfAsset = asset.TotalCostOfAsset,
            PresentValue    = dto.BookValueAtDisposal,
            EventType       = "Disposal",
            EventDate       = DateTime.UtcNow,
            CreatedBy       = createdBy,
        };
        _context.FixedAssetHistory.Add(snapshot);

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        return disposal;
    }
    catch
    {
        await transaction.RollbackAsync();
        throw;
    }
}
```

---

## 10. Depreciation Calculation Helper

```csharp
// Services/Implementations/DepreciationService.cs
/// <summary>
/// Straight-line annual depreciation:
/// (assetValue - residualValue) / usefulYears
/// </summary>
public static decimal CalculateAnnual(decimal assetValue, decimal residualValue, int usefulYears)
{
    if (usefulYears <= 0) return 0;
    return (assetValue - residualValue) / usefulYears;
}

/// <summary>
/// Total depreciation posted for an asset (for NBV calculation).
/// NBV = max(residualValue, assetValue - totalPosted)
/// </summary>
public async Task<decimal> GetTotalPostedAsync(int fixedAssetID)
{
    return await _context.DepreciationHistory
        .Where(h => h.FixedAssetID == fixedAssetID)
        .SumAsync(h => h.Value);
}
```

---

## 11. Alert Service

Alerts are computed on-demand from the existing data — no separate alert table needed.

```csharp
// Services/Implementations/AlertService.cs
public async Task<AlertsDto> GetAllAlertsAsync()
{
    var today = DateOnly.FromDateTime(DateTime.Today);

    var docExpiry = await _context.VehicleDocuments
        .Include(d => d.Vehicle)
        .Include(d => d.DocumentType)
        .Where(d => d.ExpireDate.HasValue &&
                    d.ExpireDate.Value <= today.AddDays(30))
        .Select(d => new AlertItemDto {
            Type       = "documentExpiry",
            Severity   = d.ExpireDate.Value <= today ? "danger" : "warning",
            VehicleID  = d.VehicleID,
            Title      = $"{d.Vehicle.Numbers} — {d.DocumentType.Name} expires",
            DaysUntil  = (d.ExpireDate.Value.ToDateTime(TimeOnly.MinValue) - DateTime.Today).Days,
            ExpireDate = d.ExpireDate.Value.ToString("yyyy-MM-dd"),
            Message    = $"Document expires in {(d.ExpireDate.Value.ToDateTime(TimeOnly.MinValue) - DateTime.Today).Days} day(s)",
        })
        .ToListAsync();

    // Repeat similar queries for serviceDue, depreciationEnd, warrantyExpiry,
    // assetMaintenanceOverdue, driverLicenceExpiry ...

    return new AlertsDto {
        DocumentExpiry           = docExpiry,
        ServiceDue               = serviceDue,
        DepreciationEnd          = depreciationEnd,
        WarrantyExpiry           = warrantyExpiry,
        AssetMaintenanceOverdue  = assetMaintenanceOverdue,
        DriverLicenceExpiry      = driverLicenceExpiry,
    };
}
```

---

## 12. Global Exception Middleware

```csharp
// Middleware/ExceptionMiddleware.cs
public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try { await _next(context); }
        catch (KeyNotFoundException ex)
        {
            context.Response.StatusCode = 404;
            await WriteResponse(context, false, ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            context.Response.StatusCode = 409;
            await WriteResponse(context, false, ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception");
            context.Response.StatusCode = 500;
            await WriteResponse(context, false, "Internal server error.");
        }
    }

    private static async Task WriteResponse(HttpContext ctx, bool success, string message)
    {
        ctx.Response.ContentType = "application/json";
        var payload = new { success, data = (object?)null, message };
        await ctx.Response.WriteAsync(JsonSerializer.Serialize(payload,
            new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }));
    }
}
```

---

## 13. Complete Program.cs

```csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(opts =>
    opts.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        opts.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        opts.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(opts =>
    opts.AddPolicy("ReactDev", policy =>
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyMethod().AllowAnyHeader().AllowCredentials()));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts => {
        opts.TokenValidationParameters = new TokenValidationParameters {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)),
            ValidateIssuer   = false,
            ValidateAudience = false,
        };
    });

// Register services
builder.Services.AddScoped<IVehicleService, VehicleService>();
builder.Services.AddScoped<IFixedAssetService, FixedAssetService>();
builder.Services.AddScoped<IDisposalService, DisposalService>();
builder.Services.AddScoped<IDepreciationService, DepreciationService>();
builder.Services.AddScoped<IAlertService, AlertService>();
// ...register remaining services

builder.Services.AddAutoMapper(Assembly.GetExecutingAssembly());

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<ExceptionMiddleware>();
app.UseHttpsRedirection();
app.UseCors("ReactDev");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
```

---

## 14. appsettings.json

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server={SERVER};Database=AgriGENERP;Trusted_Connection=True;TrustServerCertificate=True;"
  },
  "Jwt": {
    "Key": "{SECRET_KEY_MIN_32_CHARS}",
    "Issuer": "agrithmics.com",
    "Audience": "agrithmics-erp"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  }
}
```

---

## 15. Vehicle Controller Example

```csharp
[Route("api/vehicles")]
public class VehiclesController : ApiBaseController
{
    private readonly IVehicleService _svc;
    public VehiclesController(IVehicleService svc) => _svc = svc;

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? estateId,
        [FromQuery] int? vehicleTypeId,
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100)
    {
        var (items, total) = await _svc.GetAllAsync(estateId, vehicleTypeId, status, search, page, pageSize);
        return OkList(items, total, page, pageSize);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var item = await _svc.GetByIdAsync(id);
        return item is null ? NotFound("Vehicle", id) : Ok(item);
    }

    [HttpGet("{id:int}/history")]
    public async Task<IActionResult> GetHistory(int id)
    {
        var history = await _svc.GetHistoryAsync(id);
        return Ok(history);
    }

    [HttpGet("next-code")]
    [AllowAnonymous]
    public async Task<IActionResult> NextCode()
    {
        var code = await _svc.NextCodeAsync();
        return Ok(new { code });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] VehicleCreateDto dto)
    {
        if (!ModelState.IsValid) return Fail("Validation failed.");
        var created = await _svc.CreateAsync(dto, User.Identity!.Name!);
        return Created(created);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] VehicleUpdateDto dto)
    {
        var updated = await _svc.UpdateAsync(id, dto, User.Identity!.Name!);
        return Ok(updated);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        await _svc.DeleteAsync(id, User.Identity!.Name!);
        return Ok(new { message = "Vehicle deleted." });
    }
}
```

---

## 16. Report Endpoints (Optimised Queries)

Report endpoints should use EF projections to JOIN and compute in a single query rather than loading all entities and joining in memory.

```csharp
// ReportsController.cs — example: Fleet Register
[HttpGet("fleet-register")]
public async Task<IActionResult> FleetRegister([FromQuery] int? estateId, [FromQuery] string? status)
{
    var query = _context.Vehicles
        .Include(v => v.VehicleType)
        .Include(v => v.Estate)
        .ThenInclude(e => e.Group)
        .Where(v => v.IsActive);

    if (estateId.HasValue)  query = query.Where(v => v.EstateID == estateId.Value);
    if (status is not null) query = query.Where(v => v.Status == status);

    var rows = await query.Select(v => new {
        id           = v.VehicleID,
        numbers      = v.Numbers,
        brand        = v.Brand,
        model        = v.Model,
        vehicleType  = v.VehicleType!.Name,
        group        = v.Estate.Group.Name,
        estate       = v.Estate.Name,
        status       = v.Status,
        registerYear = v.RegisterYear,
        costOfAsset  = v.CostOfAsset,
    }).ToListAsync();

    return Ok(rows);
}
```

---

## 17. NuGet Packages Required

```xml
<PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer"   Version="6.*" />
<PackageReference Include="Microsoft.EntityFrameworkCore.Tools"       Version="6.*" />
<PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="6.*" />
<PackageReference Include="AutoMapper.Extensions.Microsoft.DependencyInjection" Version="12.*" />
<PackageReference Include="Swashbuckle.AspNetCore"                    Version="6.*" />
```

---

## 18. EF Migrations

```bash
# Initial migration after setting up DbContext
dotnet ef migrations add InitialCreate --output-dir Data/Migrations
dotnet ef database update

# After schema changes
dotnet ef migrations add {MigrationName}
dotnet ef database update
```

> Alternatively, use the `backend-sql-ddl.sql` script to create the schema directly (especially for the initial release where the DB is created from scratch on the ERP server).
