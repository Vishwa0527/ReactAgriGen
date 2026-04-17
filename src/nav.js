/**
 * Sidebar navigation — two top-level modules:
 *   Fleet Management  |  Fixed Asset Management
 *
 * isModuleHeader: true  → rendered as a visual module divider (no nav items)
 * comingSoon: true      → rendered greyed-out, non-navigable
 */
export const NAV = [

  /* ══════════════════════ FLEET MANAGEMENT ══════════════════════ */
  { section: 'Fleet Management', isModuleHeader: true, items: [] },

  {
    section: 'Dashboard',
    items: [
      { label: 'Dashboard',              path: '/',                     icon: 'dashboard' },
      { label: 'Alerts',                 path: '/alerts',               icon: 'bell' },
    ],
  },
  {
    section: 'Workshop',
    items: [
      { label: 'Workshop Dashboard',     path: '/workshop-dashboard',    icon: 'dashboard' },
      { label: 'Workshops',              path: '/workshops',             icon: 'building' },
      { label: 'Workshop Categories',    path: '/workshop-categories',   icon: 'tag' },
      { label: 'Workshop Tech. Rates',   path: '/tech-workshop',         icon: 'tool' },
      { label: 'Workshop History',       path: '/workshop-history',      icon: 'history' },
    ],
  },
  {
    section: 'Maintenance & Service',
    items: [
      { label: 'Service Schedule',        path: '/maintenance',          icon: 'settings' },
      { label: 'Work Orders',            path: '/job-cards',            icon: 'clipboard' },
      { label: 'Maintenance Records',    path: '/maintenance-records',  icon: 'check' },
      { label: 'Vehicle Service',        path: '/vehicle-service',      icon: 'service' },
    ],
  },
  {
    section: 'Technicians',
    items: [
      { label: 'Tech. Categories',       path: '/tech-categories',      icon: 'wrench' },
      { label: 'Tech. Assignments',      path: '/tech-assignments',     icon: 'people' },
    ],
  },
  {
    section: 'Vehicles',
    items: [
      { label: 'Vehicles',               path: '/vehicles',             icon: 'car' },
      { label: 'Vehicle Documents',      path: '/vehicle-documents',    icon: 'file' },
      { label: 'Vehicle Purposes',       path: '/vehicle-purposes',     icon: 'grid' },
      { label: 'Vehicle History',        path: '/vehicle-history',      icon: 'history' },
    ],
  },
  {
    section: 'Drivers & Operations',
    items: [
      { label: 'Drivers',                path: '/drivers',              icon: 'user' },
      { label: 'License Categories',     path: '/license-categories',   icon: 'id' },
      { label: 'Driver Assignments',     path: '/driver-assignments',   icon: 'link' },
      { label: 'Daily Running',          path: '/daily-running',        icon: 'route' },
    ],
  },

  /* ═══════════════════ FIXED ASSET MANAGEMENT ═══════════════════ */
  { section: 'Fixed Asset Management', isModuleHeader: true, items: [] },

  {
    section: 'Fixed Assets',
    items: [
      { label: 'FA Dashboard',           path: '/fa-dashboard',            icon: 'grid' },
      { label: 'Fixed Asset Types',      path: '/fixed-asset-types',       icon: 'box' },
      { label: 'FA Categories',          path: '/fixed-asset-categories',  icon: 'grid' },
      { label: 'Assets Register',        path: '/assets-register',         icon: 'building' },
      { label: 'Asset History',          path: '/asset-history',           icon: 'history' },
      { label: 'Depreciation',           path: '/depreciation',            icon: 'chart' },
      { label: 'Post Depreciation',      path: '/depreciation/post',       icon: 'check' },
      { label: 'Dep. History',           path: '/depreciation-history',    icon: 'dollar' },
      { label: 'Asset Maintenance',     path: '/asset-maintenance',       icon: 'wrench' },
      { label: 'Estimations',           path: '/estimations',             icon: 'clipboard' },
      { label: 'Asset Disposal',           path: '/asset-disposal',          icon: 'trash' },
    ],
  },

  /* ══════════════════════ GL CONFIGURATION ══════════════════════ */
  { section: 'GL Configuration', isModuleHeader: true, items: [] },

  {
    section: 'GL Setup',
    items: [
      { label: 'GL Account Mapping',    path: '/gl-mapping',           icon: 'link'      },
      { label: 'GL Approval Queue',     path: '/gl-approval-queue',    icon: 'check'     },
      { label: 'Journal Entries',       path: '/journal-entries',      icon: 'dollar'    },
    ],
  },

  /* ═══════════════════════════ REPORTS ══════════════════════════ */
  { section: 'Reports', isModuleHeader: true, items: [] },

  {
    section: 'Reports',
    items: [
      { label: 'Reports Hub',              path: '/reports',                       icon: 'clipboard' },
      { label: 'Fleet Register',           path: '/reports/fleet-register',        icon: 'car' },
      { label: 'Vehicle Documents',        path: '/reports/vehicle-documents',     icon: 'file' },
      { label: 'Driver Assignments',       path: '/reports/driver-assignments',    icon: 'link' },
      { label: 'Daily Running Log',        path: '/reports/daily-running',         icon: 'route' },
      { label: 'Depreciation Schedule',    path: '/reports/depreciation-schedule', icon: 'chart' },
      { label: 'Asset Net Book Value',     path: '/reports/asset-nbv',             icon: 'dollar' },
      { label: 'Asset Maintenance',        path: '/reports/asset-maintenance',     icon: 'wrench' },
    ],
  },

  /* ══════════════════════ MASTER / LOOKUP ══════════════════════ */
  { section: 'Master / Lookup', isModuleHeader: true, items: [] },

  {
    section: 'Lookup',
    items: [
      { label: 'Vehicle Types',          path: '/vehicle-types',        icon: 'tag' },
      { label: 'Fuel Types',             path: '/fuel-types',           icon: 'fuel' },
      { label: 'Document Types',         path: '/document-types',       icon: 'doc' },
      { label: 'Purpose Categories',     path: '/purpose-categories',   icon: 'grid' },
    ],
  },
];
