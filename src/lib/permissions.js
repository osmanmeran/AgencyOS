// Full catalog of all permissions, grouped by category
// Each permission has a key, label, and description
// Used by PermissionContext, AppSettings' Permissions tab, and UserManagement

export const PERMISSION_GROUPS = [
  {
    key: 'trips',
    label: 'Trips & Bookings',
    permissions: [
      { key: 'create_trips', label: 'Create Trips', description: 'Create new trip/reservation records' },
      { key: 'modify_trips', label: 'Modify Trips', description: 'Edit existing trip details' },
      { key: 'delete_trips', label: 'Delete Trips', description: 'Remove trip records from the system' },
      { key: 'cancel_trips', label: 'Cancel Trips', description: 'Cancel/rescind confirmed trips' },
      { key: 'view_all_trips', label: 'View All Trips', description: 'Access trips created by other users' },
      { key: 'manage_tour_contracts', label: 'Manage Tour Contracts', description: 'Create and edit recurring serial tour contracts and their pricing tiers' },
    ],
  },
  {
    key: 'invoices',
    label: 'Invoices & Payments',
    permissions: [
      { key: 'create_invoices', label: 'Create Invoices', description: 'Generate new invoices' },
      { key: 'modify_invoices', label: 'Modify Invoices', description: 'Edit existing invoices' },
      { key: 'delete_invoices', label: 'Delete Invoices', description: 'Remove invoice records' },
      { key: 'cancel_invoices', label: 'Cancel Invoices', description: 'Void or cancel issued invoices' },
      { key: 'view_invoices', label: 'View Invoices', description: 'View invoice details and history' },
    ],
  },
  {
    key: 'suppliers',
    label: 'Suppliers',
    permissions: [
      { key: 'create_suppliers', label: 'Create Suppliers', description: 'Add new suppliers to the database' },
      { key: 'modify_suppliers', label: 'Modify Suppliers', description: 'Edit supplier details' },
      { key: 'modify_suppliers_basic', label: 'Modify Basic Info', description: 'Edit basic supplier info only' },
      { key: 'delete_suppliers', label: 'Delete Suppliers', description: 'Remove supplier records' },
      { key: 'manage_categories', label: 'Manage Categories', description: 'Create and edit supplier categories' },
      { key: 'manage_pricing', label: 'Manage Pricing', description: 'Edit supplier pricing information' },
    ],
  },
  {
    key: 'clients',
    label: 'Clients & CRM',
    permissions: [
      { key: 'create_clients', label: 'Create Clients', description: 'Add new client records' },
      { key: 'modify_clients', label: 'Modify Clients', description: 'Edit client details' },
      { key: 'delete_clients', label: 'Delete Clients', description: 'Remove client records' },
      { key: 'send_booking_requests', label: 'Send Booking Requests', description: 'Send booking requests to suppliers' },
    ],
  },
  {
    key: 'proposals',
    label: 'Proposals',
    permissions: [
      { key: 'create_proposals', label: 'Create Proposals', description: 'Create new travel proposals' },
      { key: 'modify_proposals', label: 'Modify Proposals', description: 'Edit existing proposals' },
      { key: 'delete_proposals', label: 'Delete Proposals', description: 'Remove proposal records' },
    ],
  },
  {
    key: 'services',
    label: 'Services & Templates',
    permissions: [
      { key: 'create_services', label: 'Create Services', description: 'Add new service records' },
      { key: 'modify_services', label: 'Modify Services', description: 'Edit service details' },
      { key: 'delete_services', label: 'Delete Services', description: 'Remove service records' },
      { key: 'manage_service_categories', label: 'Manage Service Categories', description: 'Organize services into categories' },
      { key: 'manage_booking_templates', label: 'Manage Booking Templates', description: 'Create and edit booking templates' },
    ],
  },
  {
    key: 'system',
    label: 'System & Administration',
    permissions: [
      { key: 'manage_users', label: 'Manage Users', description: 'Create, edit, and delete users' },
      { key: 'manage_roles', label: 'Manage Roles & Permissions', description: 'Change user tiers and configure permissions' },
      { key: 'manage_app_settings', label: 'Manage App Settings', description: 'Edit global application settings' },
      { key: 'change_app_branding', label: 'Manage Branding', description: 'Edit app name, logo, and brand settings' },
      { key: 'manage_integrations', label: 'Manage Integrations', description: 'Configure API keys, email, SMS, LLM' },
      { key: 'manage_billing', label: 'Manage Billing', description: 'Modify invoices, payments, and financial data' },
      { key: 'delete_data', label: 'Delete Data', description: 'Delete any entity in the system' },
    ],
  },
  {
    key: 'data',
    label: 'Data Access & Reports',
    permissions: [
      { key: 'view_all_data', label: 'View All Data', description: 'Access data across the entire system' },
      { key: 'view_own_data', label: 'View Own Data', description: 'Access only data you created' },
      { key: 'export_data', label: 'Export Data', description: 'Export reports and download files' },
      { key: 'view_reports', label: 'View Reports', description: 'Access reporting and analytics' },
      { key: 'search_references', label: 'Search References', description: 'Search by reference number across all entities' },
    ],
  },
];

// Flat list of all permission keys
export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key));

// Build a lookup from key -> { label, description }
export const PERMISSION_MAP = {};
for (const group of PERMISSION_GROUPS) {
  for (const perm of group.permissions) {
    PERMISSION_MAP[perm.key] = perm;
  }
}

// Default tier permissions (fallback when nothing is saved in DB)
export const DEFAULT_TIER_PERMISSIONS = {
  admin: [
    'manage_users', 'manage_roles', 'manage_app_settings', 'change_app_branding',
    'create_trips', 'modify_trips', 'delete_trips', 'cancel_trips', 'view_all_trips', 'manage_tour_contracts',
    'create_invoices', 'modify_invoices', 'delete_invoices', 'cancel_invoices', 'view_invoices',
    'create_suppliers', 'modify_suppliers', 'delete_suppliers',
    'manage_categories', 'manage_pricing', 'manage_service_categories',
    'create_clients', 'modify_clients', 'delete_clients',
    'create_proposals', 'modify_proposals', 'delete_proposals',
    'create_services', 'modify_services', 'delete_services',
    'manage_booking_templates', 'manage_integrations', 'manage_billing',
    'delete_data', 'view_all_data', 'export_data', 'view_reports',
    'send_booking_requests', 'search_references',
  ],
  manager: [
    'create_trips', 'modify_trips', 'cancel_trips', 'view_all_trips', 'manage_tour_contracts',
    'create_invoices', 'modify_invoices', 'cancel_invoices', 'view_invoices',
    'create_suppliers', 'modify_suppliers',
    'manage_categories', 'manage_pricing', 'manage_service_categories',
    'create_clients', 'modify_clients',
    'create_proposals', 'modify_proposals',
    'create_services', 'modify_services',
    'manage_booking_templates',
    'view_all_data', 'export_data', 'view_reports',
    'send_booking_requests', 'search_references',
  ],
  agent: [
    'create_trips', 'view_all_trips',
    'create_invoices', 'view_invoices',
    'modify_suppliers_basic', 'manage_pricing',
    'create_proposals', 'modify_proposals',
    'create_services',
    'view_own_data', 'search_references',
    'send_booking_requests',
  ],
  accounting: [
    'view_all_trips', 'view_invoices',
    'search_references', 'export_data', 'view_reports',
  ],
};
