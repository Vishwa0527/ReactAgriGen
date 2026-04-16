# AgriGEN ERP — C# Models & DTOs

> **Convention:**  
> - Entity models mirror DB columns 1:1, using C# PascalCase properties.  
> - DTO class properties use PascalCase; JSON serialization emits camelCase (configured globally in `Program.cs`).  
> - The primary key property is named `Id` in C# so it serializes to `id` in JSON — this matches what the React frontend expects.  
> - FK properties keep the `ID` suffix: `VehicleID`, `GroupID`, etc. → JSON: `vehicleID`, `groupID`.
> - Audit properties (`IsActive`, `CreatedBy`, `CreatedDate`, `ModifiedBy`, `ModifiedDate`) live on entity models only — never exposed in DTOs.

---

## 1. Common Base Classes

```csharp
// AgriGEN.Core/Entities/EntityBase.cs
namespace AgriGEN.Core.Entities;

public abstract class EntityBase
{
    public bool      IsActive     { get; set; } = true;
    public int       CreatedBy    { get; set; }
    public DateTime  CreatedDate  { get; set; }
    public int?      ModifiedBy   { get; set; }
    public DateTime? ModifiedDate { get; set; }
}

// AgriGEN.Core/DTOs/PaginationParams.cs
public record PaginationParams(int Page = 1, int PageSize = 100, string? Search = null);
```

---

## 2. Shared Foundation

```csharp
// ── Entities ────────────────────────────────────────────────────────────────

public class Group : EntityBase
{
    public int    GroupID { get; set; }
    public string Name    { get; set; } = string.Empty;
}

public class Estate : EntityBase
{
    public int    EstateID { get; set; }
    public int    GroupID  { get; set; }
    public string Name     { get; set; } = string.Empty;
}

// ── DTOs ────────────────────────────────────────────────────────────────────

public class GroupDto
{
    public int    Id   { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class EstateDto
{
    public int    Id      { get; set; }
    public string Name    { get; set; } = string.Empty;
    public int    GroupID { get; set; }
}
```

---

## 3. Shared Classification

```csharp
// ── FixedAssetType ───────────────────────────────────────────────────────────

public class FixedAssetType : EntityBase
{
    public int     FixedAssetTypeID { get; set; }
    public string  AssetTypeCode    { get; set; } = string.Empty;
    public string  AssetTypeName    { get; set; } = string.Empty;
    public string? Desc             { get; set; }
    public int     GroupID          { get; set; }
    public int?    EstateID         { get; set; }
}

public class FixedAssetTypeDto
{
    public int     Id       { get; set; }
    public string  Code     { get; set; } = string.Empty;   // maps AssetTypeCode
    public string  Name     { get; set; } = string.Empty;   // maps AssetTypeName
    public string? Desc     { get; set; }
    public int     GroupID  { get; set; }
    public int?    EstateID { get; set; }
}

public class FixedAssetTypeRequest
{
    public string  Code     { get; set; } = string.Empty;
    public string  Name     { get; set; } = string.Empty;
    public string? Desc     { get; set; }
    public int     GroupID  { get; set; }
    public int?    EstateID { get; set; }
}

// ── FixedAssetCategory ───────────────────────────────────────────────────────

public class FixedAssetCategory : EntityBase
{
    public int    FixedAssetCategoryID { get; set; }
    public int    FixedAssetTypeID     { get; set; }
    public string AssetCategoryCode    { get; set; } = string.Empty;
    public string AssetCategoryName    { get; set; } = string.Empty;
    public int    GroupID              { get; set; }
}

public class FixedAssetCategoryDto
{
    public int    Id               { get; set; }
    public int    FixedAssetTypeID { get; set; }
    public string Code             { get; set; } = string.Empty;
    public string Name             { get; set; } = string.Empty;
    public int    GroupID          { get; set; }
}

// ── WorkshopCategory ─────────────────────────────────────────────────────────

public class WorkshopCategory : EntityBase
{
    public int    WorkshopCategoryID   { get; set; }
    public string WorkshopCategoryCode { get; set; } = string.Empty;
    public string WorkshopCategoryName { get; set; } = string.Empty;
    public int    GroupID              { get; set; }
}

public class WorkshopCategoryDto
{
    public int    Id      { get; set; }
    public string Code    { get; set; } = string.Empty;
    public string Name    { get; set; } = string.Empty;
    public int    GroupID { get; set; }
}
```

---

## 4. Fleet Lookup DTOs

> All Fleet lookup entities (VehicleType, FuelType, DocumentType, PurposeCategory, LicenseCategory, TechCategory) follow the same pattern. Only variations are shown.

```csharp
// Standard lookup DTO shared shape — each lookup has its own class with this shape
public class VehicleTypeDto
{
    public int     Id      { get; set; }
    public string  Code    { get; set; } = string.Empty;
    public string  Name    { get; set; } = string.Empty;
    public string? Desc    { get; set; }
    public int     GroupID { get; set; }
}

public class FuelTypeDto
{
    public int    Id          { get; set; }
    public string Code        { get; set; } = string.Empty;
    public string Name        { get; set; } = string.Empty;
    public bool   IsSecondary { get; set; }
    public int    GroupID     { get; set; }
    public int?   SkuID       { get; set; }   // note: skuID in JSON
}

public class DocumentTypeDto
{
    public int    Id                { get; set; }
    public string Code              { get; set; } = string.Empty;
    public string Name              { get; set; } = string.Empty;
    public bool   ExpirationEnabled { get; set; }
    public int    GroupID           { get; set; }
}

public class PurposeCategoryDto
{
    public int     Id      { get; set; }
    public string  Code    { get; set; } = string.Empty;
    public string  Name    { get; set; } = string.Empty;
    public string? Module  { get; set; }
    public int     GroupID { get; set; }
}

public class LicenseCategoryDto
{
    public int    Id      { get; set; }
    public string Code    { get; set; } = string.Empty;
    public string Name    { get; set; } = string.Empty;
    public int    GroupID { get; set; }
}

public class TechCategoryDto
{
    public int    Id   { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}
```

---

## 5. Vehicle

```csharp
// ── Entity ───────────────────────────────────────────────────────────────────

public class Vehicle : EntityBase
{
    public int      VehicleID        { get; set; }
    public int?     FixedAssetID     { get; set; }
    public string   Numbers          { get; set; } = string.Empty;
    public string   Brand            { get; set; } = string.Empty;
    public string   Model            { get; set; } = string.Empty;
    public int      GroupID          { get; set; }
    public int      EstateID         { get; set; }
    public int      VehicleTypeID    { get; set; }
    public int      FixedAssetTypeID { get; set; }
    public int      FuelTypeID       { get; set; }
    public DateOnly? RegisterYear    { get; set; }
    public string?  Capacity         { get; set; }
    public string   Status           { get; set; } = "Active";
}

// ── Response DTO ─────────────────────────────────────────────────────────────

public class VehicleDto
{
    public int      Id               { get; set; }
    public int?     FixedAssetID     { get; set; }
    public string?  FixedAssetCode   { get; set; }
    public string   Numbers          { get; set; } = string.Empty;
    public string   Brand            { get; set; } = string.Empty;
    public string   Model            { get; set; } = string.Empty;
    public int      GroupID          { get; set; }
    public int      EstateID         { get; set; }
    public string?  EstateName       { get; set; }
    public int      VehicleTypeID    { get; set; }
    public string?  VehicleTypeName  { get; set; }
    public int      FixedAssetTypeID { get; set; }
    public int      FuelTypeID       { get; set; }
    public string?  FuelTypeName     { get; set; }
    public string?  RegisterYear     { get; set; }
    public string?  Capacity         { get; set; }
    public string   Status           { get; set; } = string.Empty;
    // Financial — from linked FixedAsset (nullable when not linked)
    public decimal? CostOfAsset      { get; set; }
    public int?     UsefulLifeYears  { get; set; }
    public decimal? ResidualValue    { get; set; }
    public decimal? DepreciationValue { get; set; }
}

// ── Request DTO (Create / Update) ────────────────────────────────────────────

public class VehicleRequest
{
    public int?     FixedAssetID     { get; set; }
    public string   Numbers          { get; set; } = string.Empty;
    public string   Brand            { get; set; } = string.Empty;
    public string   Model            { get; set; } = string.Empty;
    public int      GroupID          { get; set; }
    public int      EstateID         { get; set; }
    public int      VehicleTypeID    { get; set; }
    public int      FixedAssetTypeID { get; set; }
    public int      FuelTypeID       { get; set; }
    public string?  RegisterYear     { get; set; }
    public string?  Capacity         { get; set; }
    public string   Status           { get; set; } = "Active";
}
```

---

## 6. Driver

```csharp
public class Driver : EntityBase
{
    public int    DriverID          { get; set; }
    public string Code              { get; set; } = string.Empty;
    public int    EmployeeID        { get; set; }
    public string Name              { get; set; } = string.Empty;
    public string LicenseNo         { get; set; } = string.Empty;
    public int    LicenseCategoryID { get; set; }
    public DateOnly LicExpireDate   { get; set; }
    public string Status            { get; set; } = string.Empty;
    public string? Notes            { get; set; }
}

public class DriverDto
{
    public int    Id                  { get; set; }
    public string Code                { get; set; } = string.Empty;
    public int    EmployeeID          { get; set; }
    public string Name                { get; set; } = string.Empty;
    public string LicenseNo           { get; set; } = string.Empty;
    public int    LicenseCategoryID   { get; set; }
    public string? LicenseCategoryName { get; set; }
    public string LicenseExpiry       { get; set; } = string.Empty;   // ISO date string
    public string Status              { get; set; } = string.Empty;
    public string? Notes              { get; set; }
}

public class DriverRequest
{
    public string Code              { get; set; } = string.Empty;
    public int    EmployeeID        { get; set; }
    public string Name              { get; set; } = string.Empty;
    public string LicenseNo         { get; set; } = string.Empty;
    public int    LicenseCategoryID { get; set; }
    public string LicenseExpiry     { get; set; } = string.Empty;
    public string Status            { get; set; } = "Active";
    public string? Notes            { get; set; }
}
```

---

## 7. Maintenance Record (with items)

```csharp
public class MaintenanceRecordItemDto
{
    public int      Id              { get; set; }
    public int      SkuID           { get; set; }
    public decimal  Quantity        { get; set; }
    public decimal  UnitCost        { get; set; }
    public string   Source          { get; set; } = string.Empty;
    public string?  ItemIssueRef    { get; set; }
    public bool     HasRemovedItem  { get; set; }
    public int?     RemovedSkuID    { get; set; }
    public decimal? RemovedQuantity { get; set; }
    public decimal? RemovedUnitCost { get; set; }
}

public class MaintenanceRecordDto
{
    public int      Id                { get; set; }
    public int      MaintenanceTaskID { get; set; }
    public int      VehicleID         { get; set; }
    public int      WorkshopID        { get; set; }
    public string   Date              { get; set; } = string.Empty;
    public decimal  CostOfService     { get; set; }
    public string?  Description       { get; set; }
    public List<MaintenanceRecordItemDto> Items { get; set; } = new();
}

public class MaintenanceRecordRequest
{
    public int    MaintenanceTaskID { get; set; }
    public int    VehicleID         { get; set; }
    public int    WorkshopID        { get; set; }
    public string Date              { get; set; } = string.Empty;
    public decimal CostOfService    { get; set; }
    public string? Description      { get; set; }
    public List<MaintenanceRecordItemDto> Items { get; set; } = new();
}
```

---

## 8. Fixed Asset

```csharp
public class FixedAsset : EntityBase
{
    public int      FixedAssetID          { get; set; }
    public int      FixedAssetTypeID      { get; set; }
    public int      FixedAssetCategoryID  { get; set; }
    public string   FixedAssetCode        { get; set; } = string.Empty;
    public string   FixedAssetName        { get; set; } = string.Empty;
    public int      GroupID               { get; set; }
    public int      EstateID              { get; set; }
    public decimal  TotalCostOfAsset      { get; set; }
    public decimal  ResidualValue         { get; set; }
    public decimal? ImplementationCost    { get; set; }
    public DateOnly? ImplementationDate   { get; set; }
    public DateOnly StartDate             { get; set; }
    public int      UsefulLifeYears       { get; set; }
    public bool     IsFuelNeeded          { get; set; }
    public int?     FuelTypeID            { get; set; }
    public bool     IsWarrantyEnabled     { get; set; }
    public DateOnly? WarrantyStartDate    { get; set; }
    public DateOnly? WarrantyEndDate      { get; set; }
    public string?  RegistrationNumber   { get; set; }
    public decimal  DepreciationValue     { get; set; }
    public string?  LedgerTransactionRef  { get; set; }
    public string   Status                { get; set; } = "Active";
}

public class FixedAssetDto
{
    public int      Id                    { get; set; }
    public int      FixedAssetTypeID      { get; set; }
    public string?  FixedAssetTypeName    { get; set; }
    public int      FixedAssetCategoryID  { get; set; }
    public string?  FixedAssetCategoryName { get; set; }
    public string   Code                  { get; set; } = string.Empty;
    public string   Name                  { get; set; } = string.Empty;
    public int      GroupID               { get; set; }
    public int      EstateID              { get; set; }
    public string?  EstateName            { get; set; }
    public decimal  TotalCostOfAsset      { get; set; }
    public decimal  ResidualValue         { get; set; }
    public decimal? ImplementationCost    { get; set; }
    public string?  ImplementationDate    { get; set; }
    public string   StartDate             { get; set; } = string.Empty;
    public int      UsefulLifeYears       { get; set; }
    public bool     IsFuelNeeded          { get; set; }
    public int?     FuelTypeID            { get; set; }
    public bool     IsWarrantyEnabled     { get; set; }
    public string?  WarrantyStartDate     { get; set; }
    public string?  WarrantyEndDate       { get; set; }
    public string?  RegistrationNumber    { get; set; }
    public decimal  DepreciationValue     { get; set; }
    public string?  LedgerTransactionRef  { get; set; }
    public string   Status                { get; set; } = string.Empty;
}

public class FixedAssetRequest
{
    public int      FixedAssetTypeID     { get; set; }
    public int      FixedAssetCategoryID { get; set; }
    public string   Code                 { get; set; } = string.Empty;
    public string   Name                 { get; set; } = string.Empty;
    public int      GroupID              { get; set; }
    public int      EstateID             { get; set; }
    public decimal  TotalCostOfAsset     { get; set; }
    public decimal  ResidualValue        { get; set; }
    public decimal? ImplementationCost   { get; set; }
    public string?  ImplementationDate   { get; set; }
    public string   StartDate            { get; set; } = string.Empty;
    public int      UsefulLifeYears      { get; set; }
    public bool     IsFuelNeeded         { get; set; }
    public int?     FuelTypeID           { get; set; }
    public bool     IsWarrantyEnabled    { get; set; }
    public string?  WarrantyStartDate    { get; set; }
    public string?  WarrantyEndDate      { get; set; }
    public string?  RegistrationNumber   { get; set; }
    public decimal  DepreciationValue    { get; set; }
    public string?  LedgerTransactionRef { get; set; }
    public string   Status               { get; set; } = "Active";
}
```

---

## 9. Disposal

```csharp
public class DisposalDto
{
    public int      Id                   { get; set; }
    public string   DisposalCode         { get; set; } = string.Empty;
    public int      FixedAssetID         { get; set; }
    public string?  FixedAssetCode       { get; set; }
    public string?  FixedAssetName       { get; set; }
    public int      GroupID              { get; set; }
    public int      EstateID             { get; set; }
    public string?  EstateName           { get; set; }
    public string   DisposalDate         { get; set; } = string.Empty;
    public string   DisposalType         { get; set; } = string.Empty;
    public decimal  BookValueAtDisposal  { get; set; }
    public decimal? SaleProceeds         { get; set; }
    public decimal? GainLossOnDisposal   { get; set; }
    public string   DisposalReason       { get; set; } = string.Empty;
    public string?  ApprovedBy           { get; set; }
    public string?  Notes                { get; set; }
    public int      DisposalStatusTypeID { get; set; }
    public string?  StatusName           { get; set; }
}

public class DisposalRequest
{
    public string   DisposalCode         { get; set; } = string.Empty;
    public int      FixedAssetID         { get; set; }
    public int      GroupID              { get; set; }
    public int      EstateID             { get; set; }
    public string   DisposalDate         { get; set; } = string.Empty;
    public string   DisposalType         { get; set; } = string.Empty;
    public decimal  BookValueAtDisposal  { get; set; }
    public decimal? SaleProceeds         { get; set; }
    public decimal? GainLossOnDisposal   { get; set; }
    public string   DisposalReason       { get; set; } = string.Empty;
    public string?  ApprovedBy           { get; set; }
    public string?  Notes                { get; set; }
    public int      DisposalStatusTypeID { get; set; }
}

public class DisposalUpdateRequest
{
    public int     DisposalStatusTypeID { get; set; }
    public string? ApprovedBy          { get; set; }
    public string? Notes               { get; set; }
}
```

---

## 10. Auth DTOs

```csharp
public class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginResponse
{
    public string Token        { get; set; } = string.Empty;
    public string Username     { get; set; } = string.Empty;
    public string EmployeeName { get; set; } = string.Empty;
    public string RoleCode     { get; set; } = string.Empty;
    public int    GroupID      { get; set; }
    public int    EstateID     { get; set; }
    public DateTime ExpiresAt  { get; set; }
}
```

---

## 11. Alert DTO

```csharp
public class AlertItemDto
{
    public string  AlertType   { get; set; } = string.Empty;
    public string  Severity    { get; set; } = string.Empty;
    public string  Title       { get; set; } = string.Empty;
    public int?    VehicleID   { get; set; }
    public string? VehicleNumbers { get; set; }
    public string? DocType     { get; set; }
    public string? ExpireDate  { get; set; }
    public int?    DaysUntil   { get; set; }
    public string  Message     { get; set; } = string.Empty;
}

public class AlertsGroupedDto
{
    public List<AlertItemDto> DocumentExpiry          { get; set; } = new();
    public List<AlertItemDto> ServiceDue              { get; set; } = new();
    public List<AlertItemDto> DepreciationEnd         { get; set; } = new();
    public List<AlertItemDto> WarrantyExpiry          { get; set; } = new();
    public List<AlertItemDto> AssetMaintenanceOverdue { get; set; } = new();
    public List<AlertItemDto> DriverLicenceExpiry     { get; set; } = new();
}
```
