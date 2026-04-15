# AgriGEN ERP — Fleet & Fixed Asset Management
# Backend REST API Contract

**Backend:** .NET Core 6 Web API  
**Database:** MSSQL  
**Consumer:** ReactAgriGen SPA (React 19 / Vite 5)  
**Last Updated:** 2026-04-15

---

## 1. Global Conventions

### Base URL
```
https://{host}/api
```
All routes are prefixed with `/api`.

### JSON Naming
- The .NET API **must** configure `JsonNamingPolicy.CamelCase` so that C# PascalCase properties serialize to camelCase JSON.
- Primary key property → named **`Id`** in C# → serialized as **`id`** in JSON.
- Foreign key properties → named **`{Entity}ID`** in C# (e.g., `VehicleID`, `GroupID`) → serialized as **`vehicleID`**, **`groupID`** in JSON.
- This matches the existing React frontend field names exactly — no client-side remapping needed.

### Authentication
All protected endpoints require a Bearer JWT token in the `Authorization` header:
```
Authorization: Bearer {token}
```
Endpoints that only return lookup/reference data may be marked `[AllowAnonymous]` if the app has no guest-access requirement.

### Response Envelope
All endpoints return this wrapper:

```json
{
  "success": true,
  "data": { } | [ ],
  "message": null,
  "errors": null
}
```

For list endpoints, add pagination metadata at the top level:
```json
{
  "success": true,
  "data": [ ],
  "total": 150,
  "page": 1,
  "pageSize": 50,
  "message": null,
  "errors": null
}
```

### Pagination
All list endpoints accept optional query parameters:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | 1 | Page number (1-based) |
| `pageSize` | int | 100 | Records per page |
| `search` | string | — | Free-text search on name/code fields |

### Soft Delete
- All DELETE endpoints perform a **soft delete**: set `IsActive = 0` in the DB row.
- All GET list endpoints automatically filter `WHERE IsActive = 1`.
- Hard deletes are never exposed via the API.

### Error Format
HTTP status codes: `200`, `201`, `400`, `401`, `403`, `404`, `409` (conflict on unique violations), `500`.

```json
{
  "success": false,
  "data": null,
  "message": "Validation failed",
  "errors": ["Numbers field is required", "VehicleTypeID is invalid"]
}
```

---

## 2. Shared Foundation

### Groups
> Read-only — managed by core ERP configuration.

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/groups` | Get all active groups |
| GET | `/api/groups/{id}` | Get single group |

**Response item:**
```json
{ "id": 1, "name": "Hatton Plantations PLC" }
```

---

### Estates
> Read-only — managed by core ERP configuration.

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/estates` | Get all active estates |
| GET | `/api/estates/{id}` | Get single estate |
| GET | `/api/estates?groupId={id}` | Filter by group |

**Response item:**
```json
{ "id": 1, "name": "Hatton Estate", "groupID": 1 }
```

---

### Employees (HR Module proxy — read-only)
> Source of truth in HR module. This module exposes a read-only proxy for dropdowns.

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/hr/employees` | Get active employees |
| GET | `/api/hr/employees?designation=Driver` | Filter by designation |
| GET | `/api/hr/employees?designation=Technician` | Filter technicians |

**Response item:**
```json
{ "id": 101, "employeeNo": "EMP-0101", "name": "Sunil Perera", "nic": "831234567V", "designation": "Driver", "estateID": 1, "groupID": 1, "mobile": "0771234567", "status": "Active" }
```

---

## 3. Shared Classification

### Fixed Asset Types ★
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/fixed-asset-types` | List all |
| GET | `/api/fixed-asset-types/{id}` | Get single |
| POST | `/api/fixed-asset-types` | Create |
| PUT | `/api/fixed-asset-types/{id}` | Update |
| DELETE | `/api/fixed-asset-types/{id}` | Soft delete |

**Request/Response DTO:**
```json
{
  "id": 1,
  "code": "FA001",
  "name": "Motor Vehicle",
  "desc": "Registered motor vehicle",
  "groupID": 1,
  "estateID": 1
}
```
> `code` maps to `AssetTypeCode`, `name` maps to `AssetTypeName` in the DB.

---

### Fixed Asset Categories
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/fixed-asset-categories` | List all |
| GET | `/api/fixed-asset-categories?fixedAssetTypeId={id}` | Filter by type |
| GET | `/api/fixed-asset-categories/{id}` | Get single |
| POST | `/api/fixed-asset-categories` | Create |
| PUT | `/api/fixed-asset-categories/{id}` | Update |
| DELETE | `/api/fixed-asset-categories/{id}` | Soft delete |

**DTO:**
```json
{ "id": 1, "fixedAssetTypeID": 1, "code": "FA-CAT-001", "name": "Light Motor Vehicle", "groupID": 1 }
```

---

### Workshop Categories
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/workshop-categories` | List all |
| GET | `/api/workshop-categories/{id}` | Get single |
| POST | `/api/workshop-categories` | Create |
| PUT | `/api/workshop-categories/{id}` | Update |
| DELETE | `/api/workshop-categories/{id}` | Soft delete |

**DTO:**
```json
{ "id": 1, "code": "WSC001", "name": "Vehicle Workshop", "groupID": 1 }
```

---

## 4. Fleet Management

### Vehicle Types
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/vehicle-types` | List all |
| GET | `/api/vehicle-types/{id}` | Get single |
| POST | `/api/vehicle-types` | Create |
| PUT | `/api/vehicle-types/{id}` | Update |
| DELETE | `/api/vehicle-types/{id}` | Soft delete |

**DTO:** `{ "id": 1, "code": "VT001", "name": "Heavy Truck", "desc": "Large cargo vehicle", "groupID": 1 }`

---

### Fuel Types
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/fuel-types` | List all |
| GET | `/api/fuel-types/{id}` | Get single |
| POST | `/api/fuel-types` | Create |
| PUT | `/api/fuel-types/{id}` | Update |
| DELETE | `/api/fuel-types/{id}` | Soft delete |

**DTO:** `{ "id": 1, "name": "Diesel", "code": "DSL", "isSecondary": false, "groupID": 1, "skuMasterID": 1 }`

---

### Document Types
**DTO:** `{ "id": 1, "name": "Revenue Licence", "code": "RL", "expirationEnabled": true, "groupID": 1 }`  
CRUD pattern same as Vehicle Types.  Route: `/api/document-types`

---

### Purpose Categories
**DTO:** `{ "id": 1, "code": "PC001", "name": "Field Transport", "module": "Field", "groupID": 1 }`  
Route: `/api/purpose-categories`

---

### License Categories
**DTO:** `{ "id": 1, "code": "LC001", "name": "Class B", "groupID": 1 }`  
Route: `/api/license-categories`

---

### Tech Categories
**DTO:** `{ "id": 1, "code": "TC001", "name": "Engine Specialist" }`  
Route: `/api/tech-categories`

---

### Vehicles
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/vehicles` | List with optional filters |
| GET | `/api/vehicles/{id}` | Get single vehicle |
| GET | `/api/vehicles/{id}/history` | Vehicle change history |
| POST | `/api/vehicles` | Create vehicle |
| PUT | `/api/vehicles/{id}` | Update vehicle |
| DELETE | `/api/vehicles/{id}` | Soft delete |

**Query filters:** `?estateId=1`, `?vehicleTypeId=2`, `?status=Active`, `?search=toyota`

**Vehicle DTO:**
```json
{
  "id": 1,
  "numbers": "WP-CAB-2341",
  "brand": "Toyota",
  "model": "Dyna",
  "groupID": 1,
  "estateID": 1,
  "vehicleTypeID": 1,
  "fixedAssetTypeID": 1,
  "fixedAssetID": 1,
  "fuelTypeID": 1,
  "secondaryFuelTypeID": null,
  "registerYear": "2018-01-15",
  "capacity": "3.5T",
  "status": "Active",
  "costOfAsset": 4200000,
  "usefulLifeYears": 10,
  "residualValue": 500000,
  "depreciationValue": 370000
}
```
> **Status values:** `Active` | `In Service` | `Maintenance` | `Disposed`

**Vehicle History entry:**
```json
{
  "id": 1,
  "vehicleID": 1,
  "action": "Created",
  "timestamp": "2018-01-15T08:00:00Z",
  "snapshot": { /* full vehicle DTO at that point in time */ }
}
```

**Business rule on create/update:** Automatically insert a `VehicleHistory` row with the snapshot of the vehicle state.

---

### Vehicle Documents
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/vehicle-documents` | List all, optionally filtered |
| GET | `/api/vehicle-documents/{id}` | Get single |
| GET | `/api/vehicle-documents?vehicleId={id}` | By vehicle |
| POST | `/api/vehicle-documents` | Create |
| PUT | `/api/vehicle-documents/{id}` | Update |
| DELETE | `/api/vehicle-documents/{id}` | Soft delete |

**DTO:**
```json
{
  "id": 1,
  "vehicleID": 1,
  "documentTypeID": 1,
  "docNumber": "RL-2026-001",
  "startDate": "2026-01-01",
  "expireDate": "2027-01-01",
  "notes": ""
}
```

---

### Vehicle Purpose Mappings
Route: `/api/vehicle-purposes`  
**DTO:** `{ "id": 1, "vehicleID": 1, "purposeCategoryID": 1, "effectiveDate": "2024-01-01", "notes": "" }`

---

### Drivers
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/drivers` | List all |
| GET | `/api/drivers/{id}` | Get single |
| POST | `/api/drivers` | Create |
| PUT | `/api/drivers/{id}` | Update |
| DELETE | `/api/drivers/{id}` | Soft delete |

**DTO:**
```json
{
  "id": 1,
  "code": "DRV-001",
  "employeeID": 101,
  "name": "Sunil Perera",
  "licenseNo": "B1234567",
  "licenseCategoryID": 1,
  "licenseExpiry": "2027-06-30",
  "status": "Active",
  "notes": ""
}
```

---

### Driver Assignments
Route: `/api/driver-assignments`  
**Filters:** `?vehicleId=1`, `?driverId=1`, `?activeOnly=true`

**DTO:**
```json
{
  "id": 1,
  "vehicleID": 1,
  "driverID": 1,
  "startDate": "2024-01-01",
  "endDate": null,
  "notes": ""
}
```
> `endDate: null` = Active assignment. Set `endDate` on PUT to close.

---

### Daily Running
Route: `/api/daily-running`  
**Filters:** `?vehicleId=1`, `?driverId=1`, `?from=2024-01-01`, `?to=2024-12-31`

**DTO:**
```json
{
  "id": 1,
  "refCode": "DR-0001",
  "vehicleID": 1,
  "driverID": 1,
  "startDateTime": "2024-01-15T07:00:00",
  "endDateTime": "2024-01-15T17:30:00",
  "startOdo": 12500,
  "endOdo": 12850,
  "notes": ""
}
```

---

### Workshops
Route: `/api/workshops`  
**DTO:** `{ "id": 1, "code": "WS001", "name": "Main Vehicle Workshop", "workshopCategoryID": 1, "fixedAssetTypeID": 1, "groupID": 1, "estateID": 1, "status": "Active" }`

---

### Workshop History
Route: `/api/workshop-history`  
**Filters:** `?workshopId=1`  
**DTO:** `{ "id": 1, "workshopID": 1, "eventType": "Created", "eventDate": "2024-01-01", "description": "Workshop setup", "notes": "" }`

---

### Workshop Tech Rates
Route: `/api/workshop-tech-rates`  
**DTO:** `{ "id": 1, "code": "WTR-001", "workshopID": 1, "techCategoryID": 1, "rateType": "Hourly", "rateAmount": 450.00 }`

---

### Tech Assignments
Route: `/api/tech-assignments`  
**DTO:** `{ "id": 1, "employeeID": 201, "techCategoryID": 1, "notes": "" }`

---

### Maintenance Tasks
Route: `/api/maintenance-tasks`  
**Filters:** `?vehicleId=1`, `?workshopId=1`, `?taskType=Maintenance`

**DTO:**
```json
{
  "id": 1,
  "refCode": "MT-0001",
  "date": "2024-03-15",
  "vehicleID": 1,
  "workshopID": 1,
  "mode": "Scheduled",
  "taskType": "Maintenance",
  "costTotal": 25000.00,
  "notes": ""
}
```
> `taskType` values: `Vehicle Service` | `Maintenance`

---

### Job Cards
Route: `/api/job-cards`  
**Filters:** `?maintenanceTaskId=1`

**DTO:**
```json
{
  "id": 1,
  "maintenanceTaskID": 1,
  "vehicleID": 1,
  "workshopID": 1,
  "employeeID": 201,
  "startTime": "2024-03-15T08:00:00",
  "endTime": "2024-03-15T14:00:00",
  "description": "Engine oil change and filter replacement",
  "costOfService": 8500.00
}
```

---

### Maintenance Records
Route: `/api/maintenance-records`  
**Filters:** `?maintenanceTaskId=1`, `?vehicleId=1`

**DTO (header + items):**
```json
{
  "id": 1,
  "maintenanceTaskID": 1,
  "vehicleID": 1,
  "workshopID": 1,
  "date": "2024-03-15",
  "costOfService": 12000.00,
  "description": "Full service",
  "items": [
    {
      "id": 1,
      "skuID": 10,
      "quantity": 4,
      "unitCost": 1200.00,
      "source": "Workshop Stock",
      "itemIssueRef": "IIR-0021",
      "hasRemovedItem": false,
      "removedSkuID": null,
      "removedQuantity": null,
      "removedUnitCost": null
    }
  ]
}
```

---

### Vehicle Service
Route: `/api/vehicle-service`  
**Filters:** `?vehicleId=1`, `?overdue=true`

**DTO (header + items):**
```json
{
  "id": 1,
  "maintenanceTaskID": 1,
  "vehicleID": 1,
  "workshopID": 1,
  "serviceDate": "2024-03-15",
  "odometer": 45200,
  "nextServiceDate": "2024-09-15",
  "nextServiceOdo": 50200,
  "costAmount": 15000.00,
  "notes": "",
  "items": [ /* same shape as MaintenanceRecordItem */ ]
}
```

---

### Item Issues
Route: `/api/item-issues`

**DTO (header + items):**
```json
{
  "id": 1,
  "refCode": "II-0001",
  "issueDate": "2024-03-15",
  "issueType": "Service",
  "targetID": 1,
  "notes": "",
  "items": [
    { "id": 1, "skuID": 10, "quantity": 4, "unitCost": 1200.00 }
  ]
}
```

---

### Workshop Inventory
Route: `/api/workshop-inventory`  
**Filters:** `?workshopId=1`

**DTO:**
```json
{
  "id": 1,
  "workshopID": 1,
  "skuID": 10,
  "measuringUnitID": 1,
  "warehouseSkuMappingID": 5,
  "reorderLevel": 10,
  "availableBalance": 45,
  "minLevel": 5,
  "maxLevel": 100,
  "unitCost": 1200.00,
  "groupID": 1,
  "estateID": 1
}
```

**Special:** `GET /api/workshop-inventory/{id}/batches` returns `WorkshopInventoryDetail` rows (FIFO batches).

---

## 5. Fixed Asset Management

### Fixed Assets
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/fixed-assets` | List all |
| GET | `/api/fixed-assets/{id}` | Get single |
| GET | `/api/fixed-assets/{id}/history` | Asset history snapshots |
| POST | `/api/fixed-assets` | Create (auto-inserts FixedAssetHistory row) |
| PUT | `/api/fixed-assets/{id}` | Update (auto-inserts FixedAssetHistory row) |
| DELETE | `/api/fixed-assets/{id}` | Soft delete |

**Filters:** `?estateId=1`, `?fixedAssetTypeId=1`, `?status=Active`, `?search=tractor`

**DTO:**
```json
{
  "id": 1,
  "fixedAssetTypeID": 1,
  "fixedAssetCategoryID": 2,
  "code": "FA-0001",
  "name": "Toyota Dyna Truck",
  "groupID": 1,
  "estateID": 1,
  "totalCostOfAsset": 4200000.00,
  "residualValue": 500000.00,
  "implementationCost": 0.00,
  "implementationDate": null,
  "startDate": "2018-01-15",
  "usefulLifeYears": 10,
  "isFuelNeeded": true,
  "fuelTypeID": 1,
  "isWarrantyEnabled": false,
  "warrantyStartDate": null,
  "warrantyEndDate": null,
  "registrationNumber": "WP-CAB-2341",
  "depreciationValue": 370000.00,
  "ledgerTransactionRef": "",
  "status": "Active"
}
```
> **Status values:** `Active` | `In Service` | `Under Maintenance` | `Disposed`

**Business rules:**
- On POST: auto-create a `FixedAssetHistory` row with `EventType = 'Created'`.
- On PUT: auto-create a `FixedAssetHistory` row with `EventType = 'Updated'`.

**GET `/api/fixed-assets/next-code`** — Returns next auto-generated code string: `{ "code": "FA-0006" }`

**GET `/api/fixed-assets/summary`** — Dashboard aggregate:
```json
{ "totalValue": 18500000, "totalDepreciation": 1450000, "activeCount": 5 }
```

---

### Depreciation
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/depreciation` | List all schedules |
| GET | `/api/depreciation/{id}` | Get single schedule |
| GET | `/api/depreciation?fixedAssetId={id}` | Schedules for an asset |
| POST | `/api/depreciation` | Create schedule |
| PUT | `/api/depreciation/{id}` | Update schedule |
| DELETE | `/api/depreciation/{id}` | Soft delete |

**DTO:**
```json
{
  "id": 1,
  "fixedAssetID": 1,
  "assetValueDate": "2018-01-15",
  "assetValue": 4200000.00,
  "usefulYears": 10,
  "residualValue": 500000.00,
  "depreciationValue": 370000.00,
  "groupID": 1,
  "estateID": 1,
  "status": "Active"
}
```
> `depreciationValue` = annual straight-line = `(assetValue - residualValue) / usefulYears`  
> **Status values:** `Active` | `Closed`

**GET `/api/depreciation/calculate?assetValue=4200000&residualValue=500000&usefulYears=10`**  
Returns: `{ "annualDepreciation": 370000.00 }`

---

### Depreciation History
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/depreciation-history` | List all postings |
| GET | `/api/depreciation-history?fixedAssetId={id}` | All postings for an asset |
| GET | `/api/depreciation-history?depreciationId={id}` | Postings for a schedule |
| POST | `/api/depreciation-history/post` | Post a new period entry |
| DELETE | `/api/depreciation-history/{id}` | Soft delete |

**DTO:**
```json
{
  "id": 1,
  "depreciationID": 1,
  "fixedAssetID": 1,
  "date": "2024-03-31",
  "value": 370000.00,
  "ledgerTransactionRef": "JNL-2024-0045",
  "groupID": 1,
  "estateID": 1
}
```

**GET `/api/depreciation-history/total-posted/{fixedAssetId}`**  
Returns: `{ "fixedAssetID": 1, "totalPosted": 1480000.00 }`

---

### Asset Maintenance
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/asset-maintenance` | List all |
| GET | `/api/asset-maintenance/{id}` | Get with details + costs |
| GET | `/api/asset-maintenance?fixedAssetId={id}` | By asset |
| POST | `/api/asset-maintenance` | Create (with details + costs) |
| PUT | `/api/asset-maintenance/{id}` | Update (replaces details + costs) |
| DELETE | `/api/asset-maintenance/{id}` | Soft delete |

**Filters:** `?estateId=1`, `?status=Open`, `?from=2024-01-01`, `?to=2024-12-31`

**DTO (header + children):**
```json
{
  "id": 1,
  "fixedAssetID": 1,
  "fixedAssetHistoryID": null,
  "fleetMaintenanceTaskID": null,
  "maintenanceCode": "AM-0001",
  "maintenanceDate": "2024-06-15",
  "totalMaintenanceCost": 45000.00,
  "workshopID": 1,
  "groupID": 1,
  "estateID": 1,
  "status": "Open",
  "details": [
    {
      "id": 1,
      "isEmployeeEnabled": true,
      "employeeID": 201,
      "workshopID": 1,
      "groupID": 1,
      "estateID": 1
    }
  ],
  "costs": [
    {
      "id": 1,
      "estimateCode": "EST-0001",
      "totalMaintenanceCost": 45000.00,
      "maintenanceDate": "2024-06-15",
      "workshopID": 1,
      "groupID": 1,
      "estateID": 1
    }
  ]
}
```

**GET `/api/asset-maintenance/next-code`** → `{ "code": "AM-0005" }`

---

### Estimations
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/estimations` | List all |
| GET | `/api/estimations/{id}` | Get with detail lines |
| GET | `/api/estimations?fixedAssetId={id}` | By asset |
| POST | `/api/estimations` | Create (with detail lines) |
| PUT | `/api/estimations/{id}` | Update |
| DELETE | `/api/estimations/{id}` | Soft delete |

**DTO:**
```json
{
  "id": 1,
  "fixedAssetID": 1,
  "estimateCode": "EST-0001",
  "totalEstimatedCost": 45000.00,
  "estimationDate": "2024-05-01",
  "workshopID": 1,
  "groupID": 1,
  "estateID": 1,
  "status": "Pending",
  "details": [
    {
      "id": 1,
      "skuID": 10,
      "quantity": 2,
      "unitCost": 12000.00,
      "estimatedCost": 24000.00,
      "workshopID": 1,
      "groupID": 1,
      "estateID": 1
    }
  ]
}
```

---

### Asset Disposal

#### Disposal Status Types (lookup)
Route: `/api/disposal-status-types` — GET only (seed data: Draft, Approved, Completed).

**DTO:** `{ "id": 1, "code": "DST-DRAFT", "name": "Draft" }`

#### Disposals
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/disposals` | List all |
| GET | `/api/disposals/{id}` | Get single |
| GET | `/api/disposals?fixedAssetId={id}` | By asset |
| POST | `/api/disposals` | Create (triggers side effects — see below) |
| PUT | `/api/disposals/{id}` | Update (status/notes only after creation) |
| DELETE | `/api/disposals/{id}` | Soft delete |

**Filters:** `?estateId=1`, `?disposalType=Sale`, `?from=2024-01-01`, `?to=2024-12-31`

**DTO:**
```json
{
  "id": 1,
  "disposalCode": "AD-0001",
  "fixedAssetID": 1,
  "groupID": 1,
  "estateID": 1,
  "disposalDate": "2024-12-31",
  "disposalType": "Sale",
  "bookValueAtDisposal": 2600000.00,
  "saleProceeds": 2800000.00,
  "gainLossOnDisposal": 200000.00,
  "disposalReason": "Asset upgrade — replaced with newer model",
  "approvedBy": "S. Rathnayake",
  "notes": "",
  "disposalStatusTypeID": 2
}
```
> `disposalType` values: `Sale` | `Write-Off` | `Donation` | `Scrap`

**Business rules on POST (atomic transaction):**
1. Insert `Disposal` row.
2. Set `FixedAsset.Status = 'Disposed'`.
3. Set `IsActive = 0` on all `Depreciation` rows for this asset (close open schedules).
4. Insert a `FixedAssetHistory` row with `EventType = 'Disposal'`, `PresentValue = bookValueAtDisposal`.
5. If asset is linked to a `Vehicle`, clear `Vehicle.FixedAssetID = NULL` (or flag via a separate status field).

**GET `/api/disposals/next-code`** → `{ "code": "AD-0003" }`

**GET `/api/disposals/summary`**
```json
{ "totalSaleProceeds": 2800000.00, "totalGainLoss": 200000.00, "disposalCount": 1 }
```

---

## 6. Report / Aggregate Endpoints

These endpoints are consumed by the React Report views. They should return pre-joined, pre-computed data sets to avoid N+1 calls from the frontend.

| Endpoint | Description | Consumed By |
|----------|-------------|-------------|
| `GET /api/reports/fleet-register` | All vehicles with type/estate names resolved | ReportFleetRegister |
| `GET /api/reports/vehicle-documents` | Vehicle docs with expiry status | ReportVehicleDocuments |
| `GET /api/reports/driver-assignments` | Assignments with vehicle + driver names resolved | ReportDriverAssignments |
| `GET /api/reports/daily-running` | Daily running log with vehicle/driver names | ReportDailyRunning |
| `GET /api/reports/depreciation-schedule` | Depreciation schedules with asset names + type | ReportDepreciationSchedule |
| `GET /api/reports/asset-nbv` | NBV per asset = max(residual, cost - totalPosted) | ReportAssetNBV |
| `GET /api/reports/asset-maintenance` | Asset maintenance summary with totals | ReportAssetMaintenance |

All report endpoints support common filters: `?estateId=1`, `?groupId=1`, `?from=YYYY-MM-DD`, `?to=YYYY-MM-DD`.

---

## 7. Alerts / Notifications

`GET /api/alerts` — Returns all active alert objects grouped by type.

```json
{
  "success": true,
  "data": {
    "documentExpiry": [
      { "type": "documentExpiry", "severity": "danger", "title": "...", "vehicleID": 1, "vehicleNumbers": "WP-CAB-2341", "docType": "Insurance", "expireDate": "2026-04-25", "daysUntil": 10, "message": "..." }
    ],
    "serviceDue": [ ... ],
    "depreciationEnd": [ ... ],
    "warrantyExpiry": [ ... ],
    "assetMaintenanceOverdue": [ ... ],
    "driverLicenceExpiry": [ ... ]
  }
}
```

**Thresholds:**
| Alert Type | Source Table | Threshold |
|-----------|--------------|-----------|
| Document Expiry | `VehicleDocument` | `ExpireDate` within 30 days |
| Service Due | `VehicleService` | `NextServiceDate` ≤ today |
| Depreciation End | `Depreciation` | Schedule end within 60 days |
| Warranty Expiry | `FixedAsset` | `WarrantyEndDate` within 30 days |
| Asset Maintenance Overdue | `AssetMaintenance` | `Status = 'Open'` AND `MaintenanceDate` past today |
| Driver Licence Expiry | `Driver` | `LicExpireDate` within 30 days |

---

## 8. Frontend Field Name Reference

> Use this table when writing C# DTO properties. The JSON column shows the exact key the React frontend expects.

| C# Property Name | JSON Key | DB Column | Notes |
|------------------|----------|-----------|-------|
| `Id` | `id` | `{Table}ID` PK | Must alias PK as `id` in SELECT or use DTO |
| `GroupID` | `groupID` | `GroupID` | |
| `EstateID` | `estateID` | `EstateID` | |
| `VehicleID` | `vehicleID` | `VehicleID` | |
| `FixedAssetID` | `fixedAssetID` | `FixedAssetID` | |
| `VehicleTypeID` | `vehicleTypeID` | `VehicleTypeID` | |
| `FixedAssetTypeID` | `fixedAssetTypeID` | `FixedAssetTypeID` | |
| `FuelTypeID` | `fuelTypeID` | `FuelTypeID` | |
| `DocumentTypeID` | `documentTypeID` | `DocumentTypeID` | |
| `WorkshopID` | `workshopID` | `WorkshopID` | |
| `EmployeeID` | `employeeID` | `EmployeeID` | |
| `DriverID` | `driverID` | `DriverID` | |
| `SkuID` | `skuID` | `SKUID` | |
| `Numbers` | `numbers` | `Numbers` | Vehicle plate |
| `RegisterYear` | `registerYear` | `RegisterYear` | |
| `CostOfAsset` | `costOfAsset` | `CostOfAsset` | Vehicle legacy field |
| `TotalCostOfAsset` | `totalCostOfAsset` | `TotalCostOfAsset` | FixedAsset |
| `UsefulLifeYears` | `usefulLifeYears` | `UsefulLifeYears` | |
| `ResidualValue` | `residualValue` | `ResidualValue` | |
| `DepreciationValue` | `depreciationValue` | `DepreciationValue` | |
| `AssetValueDate` | `assetValueDate` | `AssetValueDate` | |
| `LedgerTransactionRef` | `ledgerTransactionRef` | `LedgerTransactionRef` | |
| `MaintenanceCode` | `maintenanceCode` | `MaintenanceCode` | |
| `DisposalCode` | `disposalCode` | `DisposalCode` | |
| `BookValueAtDisposal` | `bookValueAtDisposal` | `BookValueAtDisposal` | |
| `SaleProceeds` | `saleProceeds` | `SaleProceeds` | |
| `GainLossOnDisposal` | `gainLossOnDisposal` | `GainLossOnDisposal` | |
| `IsActive` | `isActive` | `IsActive` | Soft delete flag |
| `CreatedBy` | `createdBy` | `CreatedBy` | Audit |
| `CreatedDate` | `createdDate` | `CreatedDate` | Audit |
| `ModifiedBy` | `modifiedBy` | `ModifiedBy` | Audit |
| `ModifiedDate` | `modifiedDate` | `ModifiedDate` | Audit |
