export const TIERS = ['admin', 'manager', 'accounting', 'agent', 'client'];

export const TIER_LABELS = {
  admin: {
    label: 'Tier 1 - Administrator',
    color: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
    description: 'Full control: manage users, permissions, app branding, all data',
  },
  manager: {
    label: 'Tier 2 - Manager',
    color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300',
    description: 'Modify/cancel trips & invoices, create suppliers/clients, manage categories',
  },
  agent: {
    label: 'Tier 3 - Agent',
    color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
    description: 'Create trips/invoices/proposals, add pricing, modify basic supplier info',
  },
  accounting: {
    label: 'Tier 4 - Accounting',
    color: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
    description: 'Search by reference, review invoices, view reports',
  },
  client: {
    label: 'Client Portal',
    color: 'bg-muted text-foreground',
    description: 'B2B client portal login — no staff access, scoped to one linked Client (CRM) record',
  },
};

export const PERMISSION_TIERS = [
  {
    key: 'admin',
    label: 'Administrator',
    color: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
    desc: 'Full system control',
  },
  {
    key: 'manager',
    label: 'Manager',
    color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300',
    desc: 'Manage operations',
  },
  {
    key: 'agent',
    label: 'Agent',
    color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
    desc: 'Daily operations',
  },
  {
    key: 'accounting',
    label: 'Accounting',
    color: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
    desc: 'Finance & reports',
  },
];

export const PASSWORD_HINT = 'At least 8 characters, with an uppercase letter, a lowercase letter, and a number.';

export function passwordError(pw) {
  if (pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(pw)) return 'Password must contain an uppercase letter';
  if (!/[a-z]/.test(pw)) return 'Password must contain a lowercase letter';
  if (!/[0-9]/.test(pw)) return 'Password must contain a number';
  return null;
}

export const DEPARTMENT_COLORS = [
  'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300',
  'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300',
  'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300',
  'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-300',
  'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300',
  'bg-violet-100 text-violet-800',
  'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300',
  'bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300',
  'bg-pink-100 dark:bg-pink-900/40 text-pink-800 dark:text-pink-300',
  'bg-lime-100 text-lime-800',
];
