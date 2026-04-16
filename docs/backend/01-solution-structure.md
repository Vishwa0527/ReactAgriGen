# AgriGEN ERP — Backend Solution Structure

**Stack:** .NET Core 6 Web API · Dapper · MSSQL · Stored Procedures  
**Auth:** JWT Bearer  
**Pattern:** Repository → Controller (no service layer — business logic lives in stored procedures)

---

## 1. Solution Layout

```
AgriGEN.sln
│
├── AgriGEN.Api/                        ← ASP.NET Core 6 Web API (startup project)
│   ├── Controllers/
│   │   ├── Base/
│   │   │   └── ApiControllerBase.cs    ← shared Ok/Created/Fail helpers
│   │   ├── Shared/
│   │   │   ├── GroupsController.cs
│   │   │   ├── EstatesController.cs
│   │   │   ├── EmployeesController.cs
│   │   │   ├── FixedAssetTypesController.cs
│   │   │   ├── FixedAssetCategoriesController.cs
│   │   │   └── WorkshopCategoriesController.cs
│   │   ├── Fleet/
│   │   │   ├── VehicleTypesController.cs
│   │   │   ├── FuelTypesController.cs
│   │   │   ├── DocumentTypesController.cs
│   │   │   ├── PurposeCategoriesController.cs
│   │   │   ├── LicenseCategoriesController.cs
│   │   │   ├── TechCategoriesController.cs
│   │   │   ├── VehiclesController.cs
│   │   │   ├── VehicleDocumentsController.cs
│   │   │   ├── VehiclePurposesController.cs
│   │   │   ├── DriversController.cs
│   │   │   ├── DriverAssignmentsController.cs
│   │   │   ├── DailyRunningController.cs
│   │   │   ├── TechAssignmentsController.cs
│   │   │   ├── WorkshopsController.cs
│   │   │   ├── WorkshopHistoryController.cs
│   │   │   ├── WorkshopTechRatesController.cs
│   │   │   ├── WorkshopInventoryController.cs
│   │   │   ├── MaintenanceTasksController.cs
│   │   │   ├── JobCardsController.cs
│   │   │   ├── MaintenanceRecordsController.cs
│   │   │   ├── VehicleServiceController.cs
│   │   │   └── ItemIssuesController.cs
│   │   ├── FixedAssets/
│   │   │   ├── FixedAssetsController.cs
│   │   │   ├── DepreciationController.cs
│   │   │   ├── DepreciationHistoryController.cs
│   │   │   ├── AssetMaintenanceController.cs
│   │   │   ├── EstimationsController.cs
│   │   │   ├── DisposalStatusTypesController.cs
│   │   │   └── DisposalsController.cs
│   │   ├── Reports/
│   │   │   └── ReportsController.cs
│   │   ├── Alerts/
│   │   │   └── AlertsController.cs
│   │   └── Auth/
│   │       └── AuthController.cs
│   │
│   ├── Middleware/
│   │   ├── ExceptionHandlingMiddleware.cs   ← global 500 catcher → ApiResponse envelope
│   │   └── ApiResponseWrapper.cs            ← (optional) wraps all 2xx in envelope
│   │
│   ├── Models/
│   │   └── ApiResponse.cs                  ← { success, data, message, errors, total, page, pageSize }
│   │
│   ├── appsettings.json
│   ├── appsettings.Development.json
│   └── Program.cs
│
├── AgriGEN.Core/                       ← Domain models + interfaces (no EF, no Dapper)
│   ├── Entities/
│   │   ├── Shared/
│   │   ├── Fleet/
│   │   └── FixedAssets/
│   ├── DTOs/
│   │   ├── Shared/
│   │   ├── Fleet/
│   │   └── FixedAssets/
│   └── Interfaces/
│       └── Repositories/
│
└── AgriGEN.Infrastructure/            ← Dapper repository implementations
    ├── Data/
    │   └── DapperContext.cs            ← IDbConnection factory
    └── Repositories/
        ├── Shared/
        ├── Fleet/
        └── FixedAssets/
```

---

## 2. NuGet Packages

### AgriGEN.Api
```xml
<PackageReference Include="Dapper" Version="2.1.35" />
<PackageReference Include="Microsoft.Data.SqlClient" Version="5.2.2" />
<PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="6.0.36" />
<PackageReference Include="System.IdentityModel.Tokens.Jwt" Version="7.6.0" />
<PackageReference Include="Swashbuckle.AspNetCore" Version="6.9.0" />
<PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="6.0.36" />
```

### AgriGEN.Infrastructure
```xml
<PackageReference Include="Dapper" Version="2.1.35" />
<PackageReference Include="Microsoft.Data.SqlClient" Version="5.2.2" />
```

---

## 3. appsettings.json

```json
{
  "ConnectionStrings": {
    "Default": "Server=.;Database=AgriGEN_ERP;Trusted_Connection=True;TrustServerCertificate=True;"
  },
  "JwtSettings": {
    "SecretKey": "REPLACE_WITH_A_256_BIT_RANDOM_SECRET_KEY_IN_PRODUCTION",
    "Issuer":    "AgriGEN-ERP",
    "Audience":  "AgriGEN-SPA",
    "ExpiryHours": 8
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "CorsOrigins": ["http://localhost:5173", "https://agrithmics.lk"]
}
```

---

## 4. Program.cs

```csharp
using AgriGEN.Api.Middleware;
using AgriGEN.Infrastructure.Data;
using AgriGEN.Infrastructure.Repositories.Fleet;
using AgriGEN.Infrastructure.Repositories.FixedAssets;
using AgriGEN.Infrastructure.Repositories.Shared;
using AgriGEN.Core.Interfaces.Repositories;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

// ── DB Context ──────────────────────────────────────────────────────────────
builder.Services.AddSingleton<DapperContext>();

// ── Repository registrations ────────────────────────────────────────────────
// Shared
builder.Services.AddScoped<IGroupRepository,              GroupRepository>();
builder.Services.AddScoped<IEstateRepository,             EstateRepository>();
builder.Services.AddScoped<IFixedAssetTypeRepository,     FixedAssetTypeRepository>();
builder.Services.AddScoped<IFixedAssetCategoryRepository, FixedAssetCategoryRepository>();
builder.Services.AddScoped<IWorkshopCategoryRepository,   WorkshopCategoryRepository>();

// Fleet
builder.Services.AddScoped<IVehicleTypeRepository,        VehicleTypeRepository>();
builder.Services.AddScoped<IFuelTypeRepository,           FuelTypeRepository>();
builder.Services.AddScoped<IDocumentTypeRepository,       DocumentTypeRepository>();
builder.Services.AddScoped<IPurposeCategoryRepository,    PurposeCategoryRepository>();
builder.Services.AddScoped<ILicenseCategoryRepository,    LicenseCategoryRepository>();
builder.Services.AddScoped<ITechCategoryRepository,       TechCategoryRepository>();
builder.Services.AddScoped<IVehicleRepository,            VehicleRepository>();
builder.Services.AddScoped<IVehicleDocumentRepository,    VehicleDocumentRepository>();
builder.Services.AddScoped<IVehiclePurposeRepository,     VehiclePurposeRepository>();
builder.Services.AddScoped<IDriverRepository,             DriverRepository>();
builder.Services.AddScoped<IDriverAssignmentRepository,   DriverAssignmentRepository>();
builder.Services.AddScoped<IDailyRunningRepository,       DailyRunningRepository>();
builder.Services.AddScoped<ITechAssignmentRepository,     TechAssignmentRepository>();
builder.Services.AddScoped<IWorkshopRepository,           WorkshopRepository>();
builder.Services.AddScoped<IWorkshopTechRateRepository,   WorkshopTechRateRepository>();
builder.Services.AddScoped<IWorkshopInventoryRepository,  WorkshopInventoryRepository>();
builder.Services.AddScoped<IMaintenanceTaskRepository,    MaintenanceTaskRepository>();
builder.Services.AddScoped<IJobCardRepository,            JobCardRepository>();
builder.Services.AddScoped<IMaintenanceRecordRepository,  MaintenanceRecordRepository>();
builder.Services.AddScoped<IVehicleServiceRepository,     VehicleServiceRepository>();
builder.Services.AddScoped<IItemIssueRepository,          ItemIssueRepository>();

// Fixed Assets
builder.Services.AddScoped<IFixedAssetRepository,          FixedAssetRepository>();
builder.Services.AddScoped<IDepreciationRepository,        DepreciationRepository>();
builder.Services.AddScoped<IDepreciationHistoryRepository, DepreciationHistoryRepository>();
builder.Services.AddScoped<IAssetMaintenanceRepository,    AssetMaintenanceRepository>();
builder.Services.AddScoped<IEstimationRepository,          EstimationRepository>();
builder.Services.AddScoped<IDisposalRepository,            DisposalRepository>();

// Reports & Alerts
builder.Services.AddScoped<IReportRepository,  ReportRepository>();
builder.Services.AddScoped<IAlertsRepository,  AlertsRepository>();

// ── JSON ─────────────────────────────────────────────────────────────────────
builder.Services.AddControllers().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.PropertyNamingPolicy        = JsonNamingPolicy.CamelCase;
    o.JsonSerializerOptions.DictionaryKeyPolicy         = JsonNamingPolicy.CamelCase;
    o.JsonSerializerOptions.DefaultIgnoreCondition      = 
        System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
});

// ── JWT Auth ─────────────────────────────────────────────────────────────────
var jwt = builder.Configuration.GetSection("JwtSettings");
var key = Encoding.UTF8.GetBytes(jwt["SecretKey"]!);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = jwt["Issuer"],
            ValidAudience            = jwt["Audience"],
            IssuerSigningKey         = new SymmetricSecurityKey(key),
            ClockSkew                = TimeSpan.Zero,
        };
    });

builder.Services.AddAuthorization();

// ── Swagger ───────────────────────────────────────────────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "AgriGEN ERP API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        In   = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
    });
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id   = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// ── CORS ──────────────────────────────────────────────────────────────────────
var origins = builder.Configuration.GetSection("CorsOrigins").Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(o => o.AddPolicy("SpaPolicy", p =>
    p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()));

// ═════════════════════════════════════════════════════════════════════════════
var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<ExceptionHandlingMiddleware>();   // ← must be first
app.UseCors("SpaPolicy");
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
```

---

## 5. DapperContext

```csharp
// AgriGEN.Infrastructure/Data/DapperContext.cs
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using System.Data;

namespace AgriGEN.Infrastructure.Data;

public class DapperContext
{
    private readonly string _connectionString;

    public DapperContext(IConfiguration config)
    {
        _connectionString = config.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' is missing.");
    }

    public IDbConnection CreateConnection() => new SqlConnection(_connectionString);
}
```

---

## 6. ApiResponse Model

```csharp
// AgriGEN.Api/Models/ApiResponse.cs
namespace AgriGEN.Api.Models;

public class ApiResponse<T>
{
    public bool    Success  { get; init; }
    public T?      Data     { get; init; }
    public string? Message  { get; init; }
    public IEnumerable<string>? Errors { get; init; }

    // Pagination (only on list responses)
    public int? Total    { get; init; }
    public int? Page     { get; init; }
    public int? PageSize { get; init; }

    public static ApiResponse<T> Ok(T data) =>
        new() { Success = true, Data = data };

    public static ApiResponse<T> OkList(T data, int total, int page, int pageSize) =>
        new() { Success = true, Data = data, Total = total, Page = page, PageSize = pageSize };

    public static ApiResponse<T> Fail(string message, IEnumerable<string>? errors = null) =>
        new() { Success = false, Message = message, Errors = errors };
}

// Non-generic shorthand for no-data responses
public static class ApiResponse
{
    public static ApiResponse<object?> Fail(string message, IEnumerable<string>? errors = null) =>
        new() { Success = false, Message = message, Errors = errors };
}
```

---

## 7. ApiControllerBase

```csharp
// AgriGEN.Api/Controllers/Base/ApiControllerBase.cs
using AgriGEN.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AgriGEN.Api.Controllers.Base;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public abstract class ApiControllerBase : ControllerBase
{
    // Helper: extract UserID from JWT claims (set by your auth middleware)
    protected int CurrentUserId =>
        int.TryParse(User.FindFirst("uid")?.Value, out var id) ? id : 0;

    protected IActionResult Success<T>(T data) =>
        Ok(ApiResponse<T>.Ok(data));

    protected IActionResult SuccessList<T>(T data, int total, int page, int pageSize) =>
        Ok(ApiResponse<T>.OkList(data, total, page, pageSize));

    protected IActionResult Created<T>(T data) =>
        StatusCode(201, ApiResponse<T>.Ok(data));

    protected IActionResult Fail(string message, IEnumerable<string>? errors = null) =>
        BadRequest(ApiResponse.Fail(message, errors));

    protected IActionResult NotFound(string message) =>
        StatusCode(404, ApiResponse.Fail(message));

    protected IActionResult Conflict(string message) =>
        StatusCode(409, ApiResponse.Fail(message));
}
```
