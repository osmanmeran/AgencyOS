import { db } from '@/lib/DbContext';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { PERMISSION_GROUPS, DEFAULT_TIER_PERMISSIONS } from '@/lib/permissions';
import { showSuccess, showError } from '@/lib/toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Shield, Save, RotateCcw, CheckCircle2, Loader2, ChevronDown, ChevronRight, Users, KeyRound, MailPlus } from 'lucide-react';
import ClientLinkPicker from '@/components/passengers/ClientLinkPicker';

const TIERS = ['admin', 'manager', 'accounting', 'agent', 'client'];
const TIER_LABELS = {
  admin: { label: 'Tier 1 - Administrator', color: 'bg-red-100 text-red-800', description: 'Full control: manage users, permissions, app branding, all data' },
  manager: { label: 'Tier 2 - Manager', color: 'bg-purple-100 text-purple-800', description: 'Modify/cancel trips & invoices, create suppliers/clients, manage categories' },
  agent: { label: 'Tier 3 - Agent', color: 'bg-blue-100 text-blue-800', description: 'Create trips/invoices/proposals, add pricing, modify basic supplier info' },
  accounting: { label: 'Tier 4 - Accounting', color: 'bg-green-100 text-green-800', description: 'Search by reference, review invoices, view reports' },
  client: { label: 'Client Portal', color: 'bg-slate-100 text-slate-700', description: 'B2B client portal login — no staff access, scoped to one linked Client (CRM) record' }
};

const PERMISSION_TIERS = [
  { key: 'admin', label: 'Administrator', color: 'bg-red-100 text-red-800', desc: 'Full system control' },
  { key: 'manager', label: 'Manager', color: 'bg-purple-100 text-purple-800', desc: 'Manage operations' },
  { key: 'agent', label: 'Agent', color: 'bg-blue-100 text-blue-800', desc: 'Daily operations' },
  { key: 'accounting', label: 'Accounting', color: 'bg-green-100 text-green-800', desc: 'Finance & reports' },
];

// const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.permissions);

const DEPARTMENT_COLORS = [
  'bg-amber-100 text-amber-800',
  'bg-emerald-100 text-emerald-800',
  'bg-indigo-100 text-indigo-800',
  'bg-cyan-100 text-cyan-800',
  'bg-rose-100 text-rose-800',
  'bg-violet-100 text-violet-800',
  'bg-orange-100 text-orange-800',
  'bg-teal-100 text-teal-800',
  'bg-pink-100 text-pink-800',
  'bg-lime-100 text-lime-800',
];

export default function UserManagement() {
  const { user: currentUser } = useAuth();
//   const { hasPermission } = usePermissions();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editTier, setEditTier] = useState('');
  const [editName, setEditName] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editClientId, setEditClientId] = useState('');
  const [editClientName, setEditClientName] = useState('');
  const [editPermissions, setEditPermissions] = useState([]);
  const [editDepartments, setEditDepartments] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', user_tier: 'agent', client_id: '', client_name: '' });
  const [addPermissions, setAddPermissions] = useState([]);
  const [addDepartments, setAddDepartments] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', user_tier: 'agent', client_id: '', client_name: '' });
  const [inviteResult, setInviteResult] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [departmentsList, setDepartmentsList] = useState([]);
  const queryClient = useQueryClient();
  const [tierPerms, setTierPerms] = useState(/** @type {any} */ ({}));
  const [expandedGroups, setExpandedGroups] = useState(new Set(PERMISSION_GROUPS.map(g => g.key)));
  const [dirty, setDirty] = useState(false);
  const [selectedTier, setSelectedTier] = useState('agent');

  const { data: allClients = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['clients'],
    queryFn: () => db.entities.Client.list(),
  }));

  const deptColor = (name) => {
    const idx = departmentsList.indexOf(name);
    return idx >= 0 ? DEPARTMENT_COLORS[idx % DEPARTMENT_COLORS.length] : 'bg-slate-100 text-slate-600';
  };

  const loadDepartments = useCallback(async () => {
    try {
      const all = await db.entities.AppSettings.list();
      const settings = all[0];
      if (settings && settings.departments) {
        setDepartmentsList(settings.departments);
      }
    } catch {
      // fallback to default list
      setDepartmentsList(['Luxury', 'Adventure', 'Corporate', 'Cruise']);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await db.auth.users();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); loadDepartments(); }, [loadUsers, loadDepartments]);

  const clearMsg = () => { setError(''); setSuccess(''); };

  const openEditModal = (u) => {
    setSelectedUser(u);
    setEditTier(u.user_tier);
    setEditName(u.name);
    setEditActive(u.is_active);
    setEditPermissions(u.custom_permissions || []);
    setEditDepartments(u.departments || []);
    setEditClientId(u.client_id || '');
    setEditClientName(allClients.find(c => c.id === u.client_id)?.name || '');
  };

  const toggleEditPermission = (key) => {
    setEditPermissions(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const toggleEditDepartment = (key) => {
    setEditDepartments(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    clearMsg();
    if (editTier === 'client' && !editClientId) { setError('Select a client to link this portal account to'); return; }
    try {
      const updated = await db.auth.updateUser(selectedUser.id, {
        name: editName, user_tier: editTier, is_active: editActive,
        custom_permissions: editPermissions, departments: editDepartments,
        client_id: editTier === 'client' ? editClientId : null,
      });
      setUsers(users.map(u => u.id === selectedUser.id ? { ...u, ...updated } : u));
      setSelectedUser(null);
      setSuccess('User updated');
    } catch (err) { setError(err.message); }
  };

  const handleApprove = async (u) => {
    clearMsg();
    try {
      const updated = await db.auth.updateUser(u.id, { is_active: true });
      setUsers(users.map(x => x.id === u.id ? { ...x, ...updated } : x));
      setSuccess(`"${u.name}" approved`);
    } catch (err) { setError(err.message); }
  };

  const handleDeny = async (u) => {
    clearMsg();
    try {
      await db.auth.deleteUser(u.id);
      setUsers(users.filter(x => x.id !== u.id));
      setSuccess(`"${u.name}" denied and removed`);
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async (id) => {
    clearMsg();
    try {
      await db.auth.deleteUser(id);
      setUsers(users.filter(u => u.id !== id));
      setConfirmDelete(null);
      setSuccess('User deleted');
    } catch (err) { setError(err.message); }
  };

  const toggleAddPermission = (key) => {
    setAddPermissions(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const toggleAddDepartment = (key) => {
    setAddDepartments(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    clearMsg();
    if (!addForm.name || !addForm.email || !addForm.password) { setError('All fields required'); return; }
    if (addForm.user_tier === 'client' && !addForm.client_id) { setError('Select a client to link this portal account to'); return; }
    try {
      const { client_name: _client_name, ...payload } = addForm;
      const created = await db.auth.createUser({ ...payload, custom_permissions: addPermissions, departments: addDepartments });
      setUsers([...users, created]);
      setShowAddForm(false);
      setAddForm({ name: '', email: '', password: '', user_tier: 'agent', client_id: '', client_name: '' });
      setAddPermissions([]);
      setAddDepartments([]);
      setSuccess(`User "${created.name}" created`);
    } catch (err) { setError(err.message); }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    clearMsg();
    setInviteResult(null);
    if (!inviteForm.email) { setError('Email is required'); return; }
    if (inviteForm.user_tier === 'client' && !inviteForm.client_id) { setError('Select a client to link this portal account to'); return; }
    setInviteLoading(true);
    try {
      const { client_name: _client_name, ...payload } = inviteForm;
      const result = await db.auth.invite(payload);
      setInviteResult(result);
      setInviteForm({ email: '', name: '', user_tier: 'agent', client_id: '', client_name: '' });
      setSuccess(`Invitation sent to ${result.email}`);
      setShowInvite(false);
      loadUsers();
    } catch (err) { setError(err.message); }
    setInviteLoading(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    clearMsg();
    if (passwordForm.new_password !== passwordForm.confirm) { setError('Passwords do not match'); return; }
    if (passwordForm.new_password.length < 6) { setError('Password must be at least 6 characters'); return; }
    try {
      await db.auth.updateMe({ current_password: passwordForm.current_password, new_password: passwordForm.new_password });
      setPasswordForm({ current_password: '', new_password: '', confirm: '' });
      setShowPassword(false);
      setSuccess('Password changed');
    } catch (err) { setError(err.message); }
  };

  const { data: settingsData } = /** @type {any} */ (useQuery({
    queryKey: ['appSettings'],
    queryFn: async () => {
      const all = await db.entities.AppSettings.list();
      return all[0] || {};
    },
    enabled: tab === 'permissions',
  }));

  useEffect(() => {
    if (tab !== 'permissions') return;
    if (settingsData?.tier_permissions) {
      setTierPerms(settingsData.tier_permissions);
    } else {
      setTierPerms(JSON.parse(JSON.stringify(DEFAULT_TIER_PERMISSIONS)));
    }
  }, [settingsData, tab]);

  const saveMutation = /** @type {any} */ (useMutation({
    mutationFn: async (/** @type {any} */ data) => {
      const cleanData = { ...settingsData, tier_permissions: data };
      if (settingsData?.id) {
        return db.entities.AppSettings.update(settingsData.id, cleanData);
      } else {
        return db.entities.AppSettings.create(cleanData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      setDirty(false);
      showSuccess('Permissions saved', 'Tier permissions have been updated');
    },
    onError: (err) => {
      showError('Failed to save', err.message);
    },
  }));

  const toggleGroup = (key) => {
    const next = new Set(expandedGroups);
    if (next.has(key)) next.delete(key); else next.add(key);
    setExpandedGroups(next);
  };

  const toggleTierPermission = (tier, permKey) => {
    setTierPerms(prev => {
      const current = prev[tier] || [];
      const updated = current.includes(permKey)
        ? current.filter(k => k !== permKey)
        : [...current, permKey];
      return { ...prev, [tier]: updated };
    });
    setDirty(true);
  };

  const setAllForTier = (tier, value) => {
    setTierPerms(prev => {
      const allKeys = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key));
      return { ...prev, [tier]: value ? [...allKeys] : [] };
    });
    setDirty(true);
  };

  const resetToDefaults = () => {
    setTierPerms(JSON.parse(JSON.stringify(DEFAULT_TIER_PERMISSIONS)));
    setDirty(true);
  };

  const hasAllInGroup = (tier, group) => {
    const tierList = tierPerms[tier] || [];
    return group.permissions.every(p => tierList.includes(p.key));
  };

  const toggleGroupForTier = (tier, group) => {
    const allInGroup = hasAllInGroup(tier, group);
    setTierPerms(prev => {
      const current = prev[tier] || [];
      const without = current.filter(k => !group.permissions.find(p => p.key === k));
      const updated = allInGroup ? without : [...without, ...group.permissions.map(p => p.key)];
      return { ...prev, [tier]: updated };
    });
    setDirty(true);
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 gap-0">
        <button
          onClick={() => setTab('users')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'users'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          Users
        </button>
        <button
          onClick={() => setTab('permissions')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'permissions'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          Permissions
        </button>
      </div>

      {tab === 'users' && (
      <>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">User Management</h1>
          <p className="text-slate-600">Manage user roles, permissions, and credentials</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowPassword(!showPassword)} className="px-4 py-2 text-sm bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
            {showPassword ? 'Cancel' : 'Change My Password'}
          </button>
          <button onClick={() => setShowInvite(true)} className={`px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${showInvite ? 'bg-slate-100 text-slate-600 border border-slate-300' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
            <MailPlus className="w-4 h-4" />
            Invite User
          </button>
          <button onClick={() => setShowAddForm(!showAddForm)} className={`px-4 py-2 text-sm rounded-lg ${showAddForm ? 'bg-slate-100 text-slate-600 border border-slate-300' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            {showAddForm ? 'Cancel' : '+ Add User'}
          </button>
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}
      {success && <div className="p-4 bg-green-50 text-green-600 text-sm rounded-lg">{success}</div>}

      {/* Change password */}
      {showPassword && (
        <form onSubmit={handleChangePassword} className="p-5 bg-white border border-slate-200 rounded-xl">
          <h3 className="font-semibold text-slate-700 mb-3">Change Your Password</h3>
          <div className="grid grid-cols-3 gap-3">
            <input type="password" placeholder="Current password" value={passwordForm.current_password} onChange={e => setPasswordForm({ ...passwordForm, current_password: e.target.value })} required className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <input type="password" placeholder="New password (6+ chars)" value={passwordForm.new_password} onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })} required className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <input type="password" placeholder="Confirm new password" value={passwordForm.confirm} onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })} required className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <button type="submit" className="mt-3 px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700">Update Password</button>
        </form>
      )}

      {/* Invite user modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => { setShowInvite(false); setInviteResult(null); }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Invite User</h3>
            {inviteResult ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-green-700 font-medium">Invitation sent!</p>
                <p className="text-sm text-slate-500 mt-1">{inviteResult.email} will receive an email to set up their account.</p>
                <p className="text-xs text-slate-400 mt-3">Invite link: <span className="font-mono text-blue-600">{window.location.origin}/accept-invite?token={inviteResult.token}</span></p>
                <button onClick={() => { setShowInvite(false); setInviteResult(null); }} className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Close</button>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                  <input type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="colleague@company.com" required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name <span className="text-xs text-slate-400 font-normal">(optional — user can set it later)</span></label>
                  <input type="text" value={inviteForm.name} onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })} placeholder="Jane Smith" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">User Tier</label>
                  <select
                    value={inviteForm.user_tier}
                    onChange={e => setInviteForm({ ...inviteForm, user_tier: e.target.value, client_id: '', client_name: '' })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    {TIERS.map(t => <option key={t} value={t}>{TIER_LABELS[t]?.label || (t.charAt(0).toUpperCase() + t.slice(1))}</option>)}
                  </select>
                </div>
                {inviteForm.user_tier === 'client' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Linked Client *</label>
                    <ClientLinkPicker
                      clientId={inviteForm.client_id}
                      clientName={inviteForm.client_name}
                      onSelect={(c) => setInviteForm({ ...inviteForm, client_id: c.id, client_name: c.name })}
                      onClear={() => setInviteForm({ ...inviteForm, client_id: '', client_name: '' })}
                    />
                    <p className="text-xs text-slate-400 mt-1">The invited user will only see this client's data in the B2B portal.</p>
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => { setShowInvite(false); setInviteResult(null); }} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                  <button type="submit" disabled={inviteLoading} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-emerald-400">
                    {inviteLoading ? 'Sending...' : 'Send Invitation'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Add user */}
      {showAddForm && (
        <form onSubmit={handleAddUser} className="p-5 bg-white border border-slate-200 rounded-xl">
          <h3 className="font-semibold text-slate-700 mb-3">Add New User</h3>
          <div className="grid grid-cols-4 gap-3">
            <input type="text" placeholder="Full name" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} required className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <input type="email" placeholder="Email" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} required className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <input type="password" placeholder="Password" value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })} required className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            <select
              value={addForm.user_tier}
              onChange={e => setAddForm({ ...addForm, user_tier: e.target.value, client_id: '', client_name: '' })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              {TIERS.map(t => <option key={t} value={t}>{TIER_LABELS[t]?.label || (t.charAt(0).toUpperCase() + t.slice(1))}</option>)}
            </select>
          </div>
          {addForm.user_tier === 'client' && (
            <div className="mt-3 max-w-sm">
              <label className="block text-sm font-medium text-slate-700 mb-1">Linked Client *</label>
              <ClientLinkPicker
                clientId={addForm.client_id}
                clientName={addForm.client_name}
                onSelect={(c) => setAddForm({ ...addForm, client_id: c.id, client_name: c.name })}
                onClear={() => setAddForm({ ...addForm, client_id: '', client_name: '' })}
              />
              <p className="text-xs text-slate-400 mt-1">This account will only see this client's data in the B2B portal.</p>
            </div>
          )}
          <div className="mt-3">
            <p className="text-sm font-medium text-slate-700 mb-2">Custom Permissions <span className="text-xs text-slate-400 font-normal">(optional additions)</span></p>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {PERMISSION_GROUPS.map(group => (
                <div key={group.key}>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{group.label}</p>
                  <div className="flex flex-wrap gap-1">
                    {group.permissions.map(p => (
                      <label key={p.key} className={`flex items-center gap-1 px-2 py-1 rounded border text-xs cursor-pointer select-none ${addPermissions.includes(p.key) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                        <input type="checkbox" checked={addPermissions.includes(p.key)} onChange={() => toggleAddPermission(p.key)} className="sr-only" />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <p className="text-sm font-medium text-slate-700 mb-2">Departments</p>
            <div className="flex flex-wrap gap-2">
              {departmentsList.map(d => (
                <label key={d} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none ${addDepartments.includes(d) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                  <input type="checkbox" checked={addDepartments.includes(d)} onChange={() => toggleAddDepartment(d)} className="sr-only" />
                  {d}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Create User</button>
        </form>
      )}

      {/* Tier cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.entries(TIER_LABELS).map(([tier, { label, color, description }]) => (
          <div key={tier} className="p-4 bg-white rounded-xl border border-slate-200">
            <div className="flex justify-between items-center mb-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>{label}</span>
              <span className="text-2xl font-bold">{users.filter(u => u.user_tier === tier).length}</span>
            </div>
            <p className="text-xs text-slate-400">{description}</p>
          </div>
        ))}
      </div>

      {/* Pending users */}
      {users.filter(u => !u.is_active).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-200 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
            <h3 className="font-semibold text-amber-800 text-sm">Pending Approval</h3>
            <span className="text-xs text-amber-600">({users.filter(u => !u.is_active).length} users)</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-amber-100/50">
                <th className="text-left px-4 py-2 font-medium text-amber-700">Name</th>
                <th className="text-left px-4 py-2 font-medium text-amber-700">Email</th>
                <th className="text-left px-4 py-2 font-medium text-amber-700">Signed up</th>
                <th className="text-right px-4 py-2 font-medium text-amber-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.filter(u => !u.is_active).map(u => (
                <tr key={u.id} className="border-b border-amber-100 hover:bg-amber-50/50">
                  <td className="px-4 py-2.5 font-medium text-amber-900">{u.name}</td>
                  <td className="px-4 py-2.5 text-amber-700">{u.email}</td>
                  <td className="px-4 py-2.5 text-amber-600 text-xs">{u.created_date ? new Date(u.created_date).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => handleApprove(u)} className="px-3 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 mr-1">Approve</button>
                    <button onClick={() => handleDeny(u)} className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600">Deny</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Users table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Tier</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Departments</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.filter(u => u.is_active || u.id === currentUser?.id).map(u => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <span className="font-medium text-slate-800">{u.name}</span>
                  {u.id === currentUser?.id && <span className="ml-2 text-xs text-blue-600">(you)</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIER_LABELS[u.user_tier]?.color || 'bg-slate-100 text-slate-600'}`}>
                    {u.user_tier}
                  </span>
                  {u.user_tier === 'client' && (
                    <div className="text-xs text-slate-400 mt-1">
                      {allClients.find(c => c.id === u.client_id)?.name || 'unlinked'}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(u.departments || []).map(d => {
                      return <span key={d} className={`text-xs px-1.5 py-0.5 rounded ${deptColor(d)}`}>{d}</span>;
                    })}
                    {(!u.departments || u.departments.length === 0) && <span className="text-xs text-slate-400">—</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${u.is_active ? 'text-green-600' : 'text-red-500'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEditModal(u)} className="px-3 py-1 bg-white border border-slate-300 text-slate-600 text-xs rounded hover:bg-slate-50 mr-1">Edit</button>
                  {u.id !== currentUser?.id && u.user_tier !== 'admin' && (
                    <button onClick={() => setConfirmDelete(u)} className="px-3 py-1 bg-white border border-red-200 text-red-500 text-xs rounded hover:bg-red-50">Delete</button>
                  )}
                </td>
              </tr>
            ))}
            {users.filter(u => u.is_active || u.id === currentUser?.id).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setSelectedUser(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Edit User: {selectedUser.name}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">User Tier / Role</label>
                <select
                  value={editTier}
                  onChange={e => { setEditTier(e.target.value); setEditClientId(''); setEditClientName(''); }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  disabled={selectedUser.user_tier === 'admin' && selectedUser.id !== currentUser?.id}
                >
                  {TIERS.map(t => (
                    <option key={t} value={t}>{TIER_LABELS[t]?.label || t}</option>
                  ))}
                </select>
                {selectedUser.user_tier === 'admin' && selectedUser.id !== currentUser?.id && (
                  <p className="text-xs text-amber-600 mt-1">Cannot change another admin's tier</p>
                )}
              </div>
              {editTier === 'client' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Linked Client *</label>
                  <ClientLinkPicker
                    clientId={editClientId}
                    clientName={editClientName}
                    onSelect={(c) => { setEditClientId(c.id); setEditClientName(c.name); }}
                    onClear={() => { setEditClientId(''); setEditClientName(''); }}
                  />
                  <p className="text-xs text-slate-400 mt-1">This account only sees this client's data in the B2B portal.</p>
                </div>
              )}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editActive} onChange={e => setEditActive(e.target.checked)} className="rounded" />
                  <span className="text-sm text-slate-700">Account active</span>
                </label>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">
                  Custom Permissions
                  <span className="text-xs text-slate-400 ml-2 font-normal">(additional capabilities beyond tier defaults)</span>
                </p>
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {PERMISSION_GROUPS.map(group => (
                    <div key={group.key}>
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{group.label}</p>
                      <div className="flex flex-wrap gap-1">
                        {group.permissions.map(p => (
                          <label
                            key={p.key}
                            className={`flex items-center gap-1 px-2 py-1 rounded border text-xs cursor-pointer select-none ${editPermissions.includes(p.key) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                            title={p.description}
                          >
                            <input type="checkbox" checked={editPermissions.includes(p.key)} onChange={() => toggleEditPermission(p.key)} className="sr-only" />
                            {p.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Departments</p>
                <div className="flex flex-wrap gap-1.5">
                  {departmentsList.map(d => (
                    <label key={d} className={`flex items-center gap-1 px-2 py-1 rounded border text-xs cursor-pointer select-none ${editDepartments.includes(d) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                      <input type="checkbox" checked={editDepartments.includes(d)} onChange={() => toggleEditDepartment(d)} className="sr-only" />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setSelectedUser(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                <button onClick={handleSaveUser} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete User</h3>
            <p className="text-sm text-slate-600 mb-4">Are you sure you want to delete <strong>{confirmDelete.name}</strong> ({confirmDelete.email})? This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete.id)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
      </>)}
      {tab === 'permissions' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Permission Manager</h1>
                <p className="text-sm text-slate-500">Configure what each user tier can do</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={resetToDefaults}>
                <RotateCcw className="w-4 h-4 mr-1" /> Reset Defaults
              </Button>
              <Button size="sm" onClick={() => saveMutation.mutate(tierPerms)} disabled={!dirty || saveMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Save Changes
              </Button>
            </div>
          </div>

          {dirty && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <span className="w-2 h-2 bg-amber-500 rounded-full" />
              Unsaved changes — click "Save Changes" to apply
            </div>
          )}

          {/* Tier selector */}
          <div className="flex gap-2 flex-wrap">
            {PERMISSION_TIERS.map(t => (
              <button
                key={t.key}
                onClick={() => setSelectedTier(t.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  selectedTier === t.key
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>{t.label}</span>
                <Badge variant="secondary" className="ml-1 text-xs">{tierPerms[selectedTier]?.length || 0}</Badge>
              </button>
            ))}
          </div>

          {/* Permission groups for selected tier */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-slate-800">
                {PERMISSION_TIERS.find(t => t.key === selectedTier)?.label || selectedTier}
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setAllForTier(selectedTier, true)}>Select All</Button>
                <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setAllForTier(selectedTier, false)}>Deselect All</Button>
              </div>
            </div>

            {PERMISSION_GROUPS.map(group => {
              const isExpanded = expandedGroups.has(group.key);
              const allChecked = hasAllInGroup(selectedTier, group);
//               const someChecked = group.permissions.some(p => (tierPerms[selectedTier] || []).includes(p.key));

              return (
                <Card key={group.key} className="overflow-hidden">
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                      <span className="font-semibold text-slate-800 text-sm">{group.label}</span>
                      <Badge variant="outline" className="text-xs">
                        {(tierPerms[selectedTier] || []).filter(k => group.permissions.some(p => p.key === k)).length}/{group.permissions.length}
                      </Badge>
                      {allChecked && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    </div>
                    <Switch
                      checked={allChecked}
                      onCheckedChange={() => toggleGroupForTier(selectedTier, group)}
                      onClick={e => e.stopPropagation()}
                    />
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 px-5 py-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {group.permissions.map(perm => {
                          const checked = (tierPerms[selectedTier] || []).includes(perm.key);
                          return (
                            <label
                              key={perm.key}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                                checked
                                  ? 'bg-blue-50 border-blue-200'
                                  : 'bg-white border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <Switch checked={checked} onCheckedChange={() => toggleTierPermission(selectedTier, perm.key)} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800">{perm.label}</p>
                                <p className="text-xs text-slate-400 truncate">{perm.description}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
