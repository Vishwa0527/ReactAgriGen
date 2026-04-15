import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Sidebar }   from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { Icon }      from './components/Icon';
import { NAV }       from './nav';

import Dashboard         from './views/Dashboard';
import VehicleTypes      from './views/VehicleTypes';
import FixedAssetTypes   from './views/FixedAssetTypes';
import FuelTypes         from './views/FuelTypes';
import DocumentTypes     from './views/DocumentTypes';
import PurposeCategories from './views/PurposeCategories';
import LicenseCategories from './views/LicenseCategories';
import Vehicles                from './views/Vehicles';
import VehicleForm            from './views/VehicleForm';
import VehicleDocumentMapping from './views/VehicleDocumentMapping';
import VehiclePurposeMapping  from './views/VehiclePurposeMapping';
import VehicleHistory         from './views/VehicleHistory';
import Drivers                from './views/Drivers';
import DriverForm             from './views/DriverForm';
import DriverAssignments      from './views/DriverAssignments';
import DailyRunning           from './views/DailyRunning';
import TechCategories         from './views/TechCategories';
import TechAssignments        from './views/TechAssignments';
import Workshops              from './views/Workshops';
import WorkshopTechRates      from './views/WorkshopTechRates';
import MaintenanceTasks       from './views/MaintenanceTasks';
import JobCards               from './views/JobCards';
import MaintenanceRecords     from './views/MaintenanceRecords';
import VehicleService         from './views/VehicleService';
import WorkshopDashboard      from './views/WorkshopDashboard';
import WorkshopHistory        from './views/WorkshopHistory';
import WorkshopCategories     from './views/WorkshopCategories';
import FixedAssetCategories   from './views/FixedAssetCategories';
import FixedAssets            from './views/FixedAssets';
import FixedAssetForm         from './views/FixedAssetForm';
import FixedAssetHistoryView  from './views/FixedAssetHistory';
import DepreciationView       from './views/Depreciation';
import DepreciationHistoryView from './views/DepreciationHistory';
import AssetMaintenanceView   from './views/AssetMaintenance';
import AssetMaintenanceForm   from './views/AssetMaintenanceForm';
import EstimationsView        from './views/Estimations';
import FixedAssetDashboard    from './views/FixedAssetDashboard';
import AssetDisposal         from './views/AssetDisposal';
import AssetDisposalForm     from './views/AssetDisposalForm';
import AlertsView            from './views/Alerts';
import ReportsHub                 from './views/ReportsHub';
import ReportFleetRegister        from './views/ReportFleetRegister';
import ReportVehicleDocuments     from './views/ReportVehicleDocuments';
import ReportDepreciationSchedule from './views/ReportDepreciationSchedule';
import ReportAssetNBV             from './views/ReportAssetNBV';
import ReportAssetMaintenance     from './views/ReportAssetMaintenance';
import ReportDailyRunning         from './views/ReportDailyRunning';
import ReportDriverAssignments    from './views/ReportDriverAssignments';

import './index.css';

/* ── Placeholder for screens not yet built ── */
function ComingSoon({ title }) {
  return (
    <div className="fade-up" style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: 360, textAlign: 'center', gap: 12,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 'var(--radius-lg)',
        background: 'var(--primary-light)', color: 'var(--primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 4,
      }}>
        <Icon name="settings" style={{ width: 30, height: 30 }} />
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>This screen is under development.</p>
    </div>
  );
}

/* ── Main layout shell (needs to be inside BrowserRouter for useLocation) ── */
function AppShell() {
  const location = useLocation();

  // Derive breadcrumb from current path using NAV config (skip module-header groups)
  let breadcrumb = ['Dashboard'];
  for (const group of NAV) {
    if (group.isModuleHeader) continue;
    const match = group.items.find(item => item.path === location.pathname);
    if (match) { breadcrumb = [group.section, match.label]; break; }
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <TopHeader breadcrumb={breadcrumb} />
        <main className="page-body">
          <Routes>
            <Route path="/alerts"             element={<AlertsView />} />

            {/* Master / Lookup */}
            <Route path="/"                   element={<Dashboard />} />
            <Route path="/vehicle-types"      element={<VehicleTypes />} />
            <Route path="/fixed-asset-types"  element={<FixedAssetTypes />} />
            <Route path="/fuel-types"         element={<FuelTypes />} />
            <Route path="/document-types"     element={<DocumentTypes />} />
            <Route path="/purpose-categories" element={<PurposeCategories />} />

            {/* Vehicle Core */}
            <Route path="/vehicles"           element={<Vehicles />} />
            <Route path="/vehicles/add"       element={<VehicleForm />} />
            <Route path="/vehicles/edit/:id"  element={<VehicleForm />} />
            <Route path="/vehicle-documents"  element={<VehicleDocumentMapping />} />
            <Route path="/vehicle-purposes"   element={<VehiclePurposeMapping />} />
            <Route path="/vehicle-history"    element={<VehicleHistory />} />

            {/* Driver & Daily Ops */}
            <Route path="/drivers"            element={<Drivers />} />
            <Route path="/drivers/add"        element={<DriverForm />} />
            <Route path="/drivers/edit/:id"   element={<DriverForm />} />
            <Route path="/license-categories" element={<LicenseCategories />} />
            <Route path="/driver-assignments" element={<DriverAssignments />} />
            <Route path="/daily-running"      element={<DailyRunning />} />

            {/* Technician Mgmt */}
            <Route path="/tech-categories"    element={<TechCategories />} />
            <Route path="/tech-assignments"   element={<TechAssignments />} />
            <Route path="/tech-workshop"      element={<WorkshopTechRates />} />

            {/* Maintenance & Service */}
            <Route path="/maintenance"         element={<MaintenanceTasks />} />
            <Route path="/job-cards"           element={<JobCards />} />
            <Route path="/maintenance-records" element={<MaintenanceRecords />} />
            <Route path="/vehicle-service"     element={<VehicleService />} />

            {/* Workshop */}
            <Route path="/workshop-dashboard"   element={<WorkshopDashboard />} />
            <Route path="/workshops"             element={<Workshops />} />
            <Route path="/workshop-categories"   element={<WorkshopCategories />} />
            <Route path="/workshop-history"      element={<WorkshopHistory />} />

            {/* Fixed Asset Management */}
            <Route path="/fa-dashboard"            element={<FixedAssetDashboard />} />
            <Route path="/fixed-asset-categories" element={<FixedAssetCategories />} />
            <Route path="/assets-register"        element={<FixedAssets />} />
            <Route path="/assets-register/add"    element={<FixedAssetForm />} />
            <Route path="/assets-register/edit/:id" element={<FixedAssetForm />} />
            <Route path="/asset-history"          element={<FixedAssetHistoryView />} />
            <Route path="/depreciation"            element={<DepreciationView />} />
            <Route path="/depreciation-history"    element={<DepreciationHistoryView />} />
            <Route path="/asset-maintenance"       element={<AssetMaintenanceView />} />
            <Route path="/asset-maintenance/add"   element={<AssetMaintenanceForm />} />
            <Route path="/asset-maintenance/edit/:id" element={<AssetMaintenanceForm />} />
            <Route path="/estimations"             element={<EstimationsView />} />
            <Route path="/asset-disposal"           element={<AssetDisposal />} />
            <Route path="/asset-disposal/add"       element={<AssetDisposalForm />} />
            <Route path="/asset-disposal/edit/:id"  element={<AssetDisposalForm />} />

            {/* Reports */}
            <Route path="/reports"                        element={<ReportsHub />} />
            <Route path="/reports/fleet-register"         element={<ReportFleetRegister />} />
            <Route path="/reports/vehicle-documents"      element={<ReportVehicleDocuments />} />
            <Route path="/reports/depreciation-schedule"  element={<ReportDepreciationSchedule />} />
            <Route path="/reports/asset-nbv"              element={<ReportAssetNBV />} />
            <Route path="/reports/asset-maintenance"      element={<ReportAssetMaintenance />} />
            <Route path="/reports/daily-running"          element={<ReportDailyRunning />} />
            <Route path="/reports/driver-assignments"     element={<ReportDriverAssignments />} />

            {/* 404 fallback */}
            <Route path="*" element={<ComingSoon title="Page Not Found" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
