# AgriGEN ERP — Middleware & Authentication

---

## 1. Global Exception Handler Middleware

Catches any unhandled exception and returns it as a standard `ApiResponse` envelope. This is the first middleware registered in `Program.cs`.

```csharp
// AgriGEN.Api/Middleware/ExceptionHandlingMiddleware.cs
using AgriGEN.Api.Models;
using System.Net;
using System.Text.Json;

namespace AgriGEN.Api.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next   = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await _next(ctx);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception on {Path}", ctx.Request.Path);
            await HandleExceptionAsync(ctx, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext ctx, Exception ex)
    {
        ctx.Response.ContentType = "application/json";

        var (statusCode, message, errors) = ex switch
        {
            // SQL Server duplicate key / unique constraint violation (error 2601, 2627)
            Microsoft.Data.SqlClient.SqlException sqlEx
                when sqlEx.Number is 2601 or 2627
                => (HttpStatusCode.Conflict, "A record with that value already exists.", Array.Empty<string>()),

            // SP explicitly RAISERRORed (severity 16)
            Microsoft.Data.SqlClient.SqlException sqlEx
                when sqlEx.Class == 16
                => (HttpStatusCode.BadRequest, sqlEx.Message, Array.Empty<string>()),

            // Validation / bad request
            ArgumentException argEx
                => (HttpStatusCode.BadRequest, argEx.Message, Array.Empty<string>()),

            // Not found
            KeyNotFoundException
                => (HttpStatusCode.NotFound, ex.Message, Array.Empty<string>()),

            // Everything else is a 500
            _   => (HttpStatusCode.InternalServerError, "An unexpected error occurred.", Array.Empty<string>()),
        };

        ctx.Response.StatusCode = (int)statusCode;

        var response = ApiResponse<object?>.Fail(message, errors);
        var json     = JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        });

        return ctx.Response.WriteAsync(json);
    }
}
```

---

## 2. JWT Helper

```csharp
// AgriGEN.Api/Helpers/JwtHelper.cs
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace AgriGEN.Api.Helpers;

public static class JwtHelper
{
    public static string GenerateToken(UserInfo user, IConfiguration config)
    {
        var jwt = config.GetSection("JwtSettings");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["SecretKey"]!));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub,  user.Username),
            new Claim(JwtRegisteredClaimNames.Jti,  Guid.NewGuid().ToString()),
            new Claim("uid",      user.UserId.ToString()),   // used by ApiControllerBase.CurrentUserId
            new Claim("empId",    user.EmployeeID.ToString()),
            new Claim("role",     user.RoleCode),
            new Claim("groupId",  user.GroupID.ToString()),
            new Claim("estateId", user.EstateID.ToString()),
        };

        var token = new JwtSecurityToken(
            issuer:             jwt["Issuer"],
            audience:           jwt["Audience"],
            claims:             claims,
            expires:            DateTime.UtcNow.AddHours(config.GetValue<int>("JwtSettings:ExpiryHours")),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

// Simple DTO returned from the auth SP
public class UserInfo
{
    public int    UserId       { get; set; }
    public string Username     { get; set; } = string.Empty;
    public int    EmployeeID   { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string RoleCode     { get; set; } = string.Empty;
    public int    GroupID      { get; set; }
    public int    EstateID     { get; set; }
}
```

---

## 3. Auth Repository

```csharp
// AgriGEN.Core/Interfaces/Repositories/IAuthRepository.cs
public interface IAuthRepository
{
    Task<UserInfo?> ValidateAsync(string username, string password);
}

// AgriGEN.Infrastructure/Repositories/Shared/AuthRepository.cs
public class AuthRepository : IAuthRepository
{
    private readonly DapperContext _ctx;
    public AuthRepository(DapperContext ctx) => _ctx = ctx;

    public async Task<UserInfo?> ValidateAsync(string username, string password)
    {
        // Hash the incoming password to match the storage format used by Core ERP.
        // Common choice: SHA-256 hex string. Adjust if Core ERP uses bcrypt.
        var hash = ComputeSha256(password);

        using var conn = _ctx.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@Username", username);
        p.Add("@Password", hash);

        return await conn.QueryFirstOrDefaultAsync<UserInfo>(
            "usp_Auth_Login", p, commandType: System.Data.CommandType.StoredProcedure);
    }

    private static string ComputeSha256(string input)
    {
        using var sha = System.Security.Cryptography.SHA256.Create();
        var bytes = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLower();
    }
}
```

---

## 4. Model Validation (Fluent / Data Annotations)

> Prefer Data Annotations on Request DTOs for simple rules. For complex cross-field rules, add validation logic in the controller before calling the repository.

```csharp
// Example: VehicleRequest with annotations
using System.ComponentModel.DataAnnotations;

public class VehicleRequest
{
    [Required]
    [StringLength(20)]
    public string Numbers { get; set; } = string.Empty;

    [Required]
    [StringLength(50)]
    public string Brand   { get; set; } = string.Empty;

    [Required]
    [StringLength(50)]
    public string Model   { get; set; } = string.Empty;

    [Required]
    [Range(1, int.MaxValue)]
    public int GroupID { get; set; }

    [Required]
    [Range(1, int.MaxValue)]
    public int EstateID { get; set; }

    [Required]
    [Range(1, int.MaxValue)]
    public int VehicleTypeID { get; set; }

    [Required]
    [Range(1, int.MaxValue)]
    public int FixedAssetTypeID { get; set; }

    [Required]
    [Range(1, int.MaxValue)]
    public int FuelTypeID { get; set; }

    public int?    FixedAssetID { get; set; }
    public string? RegisterYear { get; set; }
    public string? Capacity     { get; set; }

    [Required]
    [RegularExpression("^(Active|In Service|Maintenance|Disposed)$")]
    public string Status { get; set; } = "Active";
}
```

When model state is invalid, ASP.NET Core returns 400 automatically. To wrap it in the standard envelope, add this filter in `Program.cs`:

```csharp
builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(o =>
    {
        o.InvalidModelStateResponseFactory = ctx =>
        {
            var errors = ctx.ModelState
                .Where(e => e.Value?.Errors.Count > 0)
                .SelectMany(e => e.Value!.Errors.Select(x => x.ErrorMessage))
                .ToArray();

            return new BadRequestObjectResult(
                ApiResponse<object?>.Fail("Validation failed.", errors));
        };
    })
    .AddJsonOptions(/* camelCase config as before */);
```

---

## 5. CORS Configuration

```csharp
// In Program.cs (already in 01-solution-structure.md)
builder.Services.AddCors(o => o.AddPolicy("SpaPolicy", p =>
    p.WithOrigins(origins)   // from appsettings: ["http://localhost:5173", "https://agrithmics.lk"]
     .AllowAnyHeader()
     .AllowAnyMethod()));

// ...
app.UseCors("SpaPolicy");   // before UseAuthentication
```

---

## 6. Middleware Pipeline Order (critical)

```
Request →
  ExceptionHandlingMiddleware   ← first, catches all
  UseCors("SpaPolicy")
  UseHttpsRedirection
  UseAuthentication              ← validates JWT
  UseAuthorization               ← checks [Authorize]
  MapControllers
← Response
```

> **Never** put CORS after Authentication — preflight OPTIONS requests don't carry tokens.

---

## 7. Swagger JWT Integration

Already configured in `Program.cs`. Once the API is running, use Swagger UI:

1. Navigate to `https://localhost:{port}/swagger`
2. Click **Authorize** (lock icon)
3. Enter: `Bearer eyJhbGciOiJIUzI1NiIs...` (your JWT)
4. All subsequent requests will include the `Authorization` header

---

## 8. Health Check Endpoint (recommended)

```csharp
// Program.cs
builder.Services.AddHealthChecks()
    .AddSqlServer(builder.Configuration.GetConnectionString("Default")!);

// ...
app.MapHealthChecks("/health");
```

```
GET /health → 200 OK  { "status": "Healthy" }
```

---

## 9. Security Checklist

| Item | Status |
|------|--------|
| JWT expiry set to 8 hours | ✅ Configured |
| SecretKey in appsettings — move to environment variable in prod | ⚠️ Required |
| HTTPS redirect enabled | ✅ |
| CORS locked to specific origins | ✅ |
| All endpoints require `[Authorize]` by default | ✅ |
| Soft delete only — no hard delete exposed | ✅ |
| SQL injection prevented via parameterized Dapper calls | ✅ |
| RAISERROR from SPs mapped to 400/409 by ExceptionHandlingMiddleware | ✅ |
| Audit columns (`CreatedBy`, `ModifiedBy`) populated from JWT claim `uid` | ✅ |
| Password hashing matches Core ERP algorithm | ⚠️ Verify with Core ERP team |

---

## 10. Environment Variable Setup (Production)

```bash
# Never commit secrets to source control.
# Set these as environment variables or use Azure Key Vault / AWS Secrets Manager.

ConnectionStrings__Default="Server=prod-sql;Database=AgriGEN_ERP;User Id=agrigenapp;Password=****;TrustServerCertificate=True;"
JwtSettings__SecretKey="your-256-bit-random-secret-key-here"
```

Or use `appsettings.Production.json` (excluded from git via `.gitignore`):

```json
{
  "ConnectionStrings": {
    "Default": "Server=prod-sql;Database=AgriGEN_ERP;..."
  },
  "JwtSettings": {
    "SecretKey": "your-production-secret-key"
  }
}
```
