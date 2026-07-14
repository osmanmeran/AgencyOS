import { db } from '@/lib/DbContext';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/components/permissions/PermissionContext';
import { PERMISSION_GROUPS, DEFAULT_TIER_PERMISSIONS } from '@/lib/permissions';
import { showSuccess, showError } from '@/lib/toast';
import { Card } from '@/components/ui/card';
import { Shield, MailPlus } from 'lucide-react';
import { PERMISSION_TIERS, passwordError, DEPARTMENT_COLORS } from '@/components/user-management/helpers';
import Tabs from '@/components/user-management/Tabs';
import ChangePasswordForm from '@/components/user-management/ChangePasswordForm';
import InviteModal from '@/components/user-management/InviteModal';
import AddUserForm from '@/components/user-management/AddUserForm';
import TierCards from '@/components/user-management/TierCards';
import PendingUsersTable from '@/components/user-management/PendingUsersTable';
import UsersTable from '@/components/user-management/UsersTable';
import EditUserModal from '@/components/user-management/EditUserModal';
import DeleteConfirmModal from '@/components/user-management/DeleteConfirmModal';
import ResetPasswordModal from '@/components/user-management/ResetPasswordModal';
import PermissionManager from '@/components/user-management/PermissionManager';

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { hasPermission } = usePermissions();
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
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    password: '',
    user_tier: 'agent',
    client_id: '',
    client_name: '',
  });
  const [addPermissions, setAddPermissions] = useState([]);
  const [addDepartments, setAddDepartments] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [resetPwdUser, setResetPwdUser] = useState(null);
  const [resetPwdNew, setResetPwdNew] = useState('');
  const [resetPwdConfirm, setResetPwdConfirm] = useState('');
  const [resetPwdResult, setResetPwdResult] = useState('');
  const [resetPwdError, setResetPwdError] = useState('');
  const [resetPwdSaving, setResetPwdSaving] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    user_tier: 'agent',
    client_id: '',
    client_name: '',
  });
  const [inviteResult, setInviteResult] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [departmentsList, setDepartmentsList] = useState([]);
  const queryClient = useQueryClient();
  const [tierPerms, setTierPerms] = useState(/** @type {any} */ ({}));
  const [expandedGroups, setExpandedGroups] = useState(new Set(PERMISSION_GROUPS.map((g) => g.key)));
  const [dirty, setDirty] = useState(false);
  const [selectedTier, setSelectedTier] = useState('agent');

  const { data: allClients = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clients'],
      queryFn: () => db.entities.Client.list(),
    })
  );

  const deptColor = (name) => {
    const idx = departmentsList.indexOf(name);
    return idx >= 0 ? DEPARTMENT_COLORS[idx % DEPARTMENT_COLORS.length] : 'bg-muted text-muted-foreground';
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

  useEffect(() => {
    loadUsers();
    loadDepartments();
  }, [loadUsers, loadDepartments]);

  const clearMsg = () => {
    setError('');
    setSuccess('');
  };

  const openEditModal = (u) => {
    setSelectedUser(u);
    setEditTier(u.user_tier);
    setEditName(u.name);
    setEditActive(u.is_active);
    setEditPermissions(u.custom_permissions || []);
    setEditDepartments(u.departments || []);
    setEditClientId(u.client_id || '');
    setEditClientName(allClients.find((c) => c.id === u.client_id)?.name || '');
  };

  const toggleEditPermission = (key) => {
    setEditPermissions((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const toggleEditDepartment = (key) => {
    setEditDepartments((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    clearMsg();
    if (editTier === 'client' && !editClientId) {
      setError('Select a client to link this portal account to');
      return;
    }
    try {
      const updated = await db.auth.updateUser(selectedUser.id, {
        name: editName,
        user_tier: editTier,
        is_active: editActive,
        custom_permissions: editPermissions,
        departments: editDepartments,
        client_id: editTier === 'client' ? editClientId : null,
      });
      setUsers(users.map((u) => (u.id === selectedUser.id ? { ...u, ...updated } : u)));
      setSelectedUser(null);
      setSuccess('User updated');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResetPassword = async () => {
    setResetPwdError('');
    if (!resetPwdUser) return;
    const pwErr = passwordError(resetPwdNew);
    if (pwErr) {
      setResetPwdError(pwErr);
      return;
    }
    if (resetPwdNew !== resetPwdConfirm) {
      setResetPwdError('Passwords do not match');
      return;
    }
    setResetPwdSaving(true);
    try {
      await db.auth.updateUser(resetPwdUser.id, { password: resetPwdNew });
      setResetPwdResult(resetPwdNew);
      setSuccess(`Password reset for "${resetPwdUser.name}"`);
    } catch (err) {
      setResetPwdError(err.message);
    } finally {
      setResetPwdSaving(false);
    }
  };

  const handleApprove = async (u) => {
    clearMsg();
    try {
      const updated = await db.auth.updateUser(u.id, { is_active: true });
      setUsers(users.map((x) => (x.id === u.id ? { ...x, ...updated } : x)));
      setSuccess(`"${u.name}" approved`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeny = async (u) => {
    clearMsg();
    try {
      await db.auth.deleteUser(u.id);
      setUsers(users.filter((x) => x.id !== u.id));
      setSuccess(`"${u.name}" denied and removed`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    clearMsg();
    try {
      await db.auth.deleteUser(id);
      setUsers(users.filter((u) => u.id !== id));
      setConfirmDelete(null);
      setSuccess('User deleted');
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleAddPermission = (key) => {
    setAddPermissions((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const toggleAddDepartment = (key) => {
    setAddDepartments((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    clearMsg();
    if (!addForm.name || !addForm.email || !addForm.password) {
      setError('All fields required');
      return;
    }
    const pwErr = passwordError(addForm.password);
    if (pwErr) {
      setError(pwErr);
      return;
    }
    if (addForm.user_tier === 'client' && !addForm.client_id) {
      setError('Select a client to link this portal account to');
      return;
    }
    try {
      const { client_name: _client_name, ...payload } = addForm;
      const created = await db.auth.createUser({
        ...payload,
        custom_permissions: addPermissions,
        departments: addDepartments,
      });
      setUsers([...users, created]);
      setShowAddForm(false);
      setAddForm({ name: '', email: '', password: '', user_tier: 'agent', client_id: '', client_name: '' });
      setAddPermissions([]);
      setAddDepartments([]);
      setSuccess(`User "${created.name}" created`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    clearMsg();
    setInviteResult(null);
    if (!inviteForm.email) {
      setError('Email is required');
      return;
    }
    if (inviteForm.user_tier === 'client' && !inviteForm.client_id) {
      setError('Select a client to link this portal account to');
      return;
    }
    setInviteLoading(true);
    try {
      const { client_name: _client_name, ...payload } = inviteForm;
      const result = await db.auth.invite(payload);
      setInviteResult(result);
      setInviteForm({ email: '', name: '', user_tier: 'agent', client_id: '', client_name: '' });
      setSuccess(`Invitation sent to ${result.email}`);
      setShowInvite(false);
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
    setInviteLoading(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    clearMsg();
    if (passwordForm.new_password !== passwordForm.confirm) {
      setError('Passwords do not match');
      return;
    }
    const pwErr = passwordError(passwordForm.new_password);
    if (pwErr) {
      setError(pwErr);
      return;
    }
    try {
      await db.auth.updateMe({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm({ current_password: '', new_password: '', confirm: '' });
      setShowPassword(false);
      setSuccess('Password changed');
    } catch (err) {
      setError(err.message);
    }
  };

  const { data: settingsData } = /** @type {any} */ (
    useQuery({
      queryKey: ['appSettings'],
      queryFn: async () => {
        const all = await db.entities.AppSettings.list();
        return all[0] || {};
      },
      enabled: tab === 'permissions',
    })
  );

  useEffect(() => {
    if (tab !== 'permissions') return;
    if (settingsData?.tier_permissions) {
      setTierPerms(settingsData.tier_permissions);
    } else {
      setTierPerms(JSON.parse(JSON.stringify(DEFAULT_TIER_PERMISSIONS)));
    }
  }, [settingsData, tab]);

  const saveMutation = /** @type {any} */ (
    useMutation({
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
    })
  );

  const toggleGroup = (key) => {
    const next = new Set(expandedGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedGroups(next);
  };

  const toggleTierPermission = (tier, permKey) => {
    setTierPerms((prev) => {
      const current = prev[tier] || [];
      const updated = current.includes(permKey) ? current.filter((k) => k !== permKey) : [...current, permKey];
      return { ...prev, [tier]: updated };
    });
    setDirty(true);
  };

  const setAllForTier = (tier, value) => {
    setTierPerms((prev) => {
      const allKeys = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));
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
    return group.permissions.every((p) => tierList.includes(p.key));
  };

  const toggleGroupForTier = (tier, group) => {
    const allInGroup = hasAllInGroup(tier, group);
    setTierPerms((prev) => {
      const current = prev[tier] || [];
      const without = current.filter((k) => !group.permissions.find((p) => p.key === k));
      const updated = allInGroup ? without : [...without, ...group.permissions.map((p) => p.key)];
      return { ...prev, [tier]: updated };
    });
    setDirty(true);
  };

  if (!hasPermission('manage_users')) {
    return (
      <Card className="p-12 text-center">
        <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-muted-foreground">Access Denied</h3>
        <p className="text-sm text-muted-foreground mt-1">You need the Manage Users permission to access this page.</p>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="w-8 h-8 border-4 border-border border-t-foreground rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Tabs tab={tab} setTab={setTab} />

      {tab === 'users' && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">User Management</h1>
              <p className="text-muted-foreground">Manage user roles, permissions, and credentials</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="px-4 py-2 text-sm bg-card border border-border rounded-lg hover:bg-muted"
              >
                {showPassword ? 'Cancel' : 'Change My Password'}
              </button>
              <button
                onClick={() => setShowInvite(true)}
                className={`px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${showInvite ? 'bg-muted text-muted-foreground border border-border' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
              >
                <MailPlus className="w-4 h-4" />
                Invite User
              </button>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className={`px-4 py-2 text-sm rounded-lg ${showAddForm ? 'bg-muted text-muted-foreground border border-border' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
              >
                {showAddForm ? 'Cancel' : '+ Add User'}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 text-sm rounded-lg">
              {error}
            </div>
          )}
          {success && (
            <div className="p-4 bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-300 text-sm rounded-lg">
              {success}
            </div>
          )}

          {/* Change password */}
          {showPassword && (
            <ChangePasswordForm
              passwordForm={passwordForm}
              setPasswordForm={setPasswordForm}
              onSubmit={handleChangePassword}
            />
          )}

          {/* Invite user modal */}
          <InviteModal
            showInvite={showInvite}
            setShowInvite={setShowInvite}
            inviteForm={inviteForm}
            setInviteForm={setInviteForm}
            onSubmit={handleInvite}
            inviteResult={inviteResult}
            setInviteResult={setInviteResult}
            inviteLoading={inviteLoading}
          />

          {/* Add user */}
          <AddUserForm
            showAddForm={showAddForm}
            addForm={addForm}
            setAddForm={setAddForm}
            onSubmit={handleAddUser}
            addPermissions={addPermissions}
            toggleAddPermission={toggleAddPermission}
            addDepartments={addDepartments}
            toggleAddDepartment={toggleAddDepartment}
            departmentsList={departmentsList}
          />

          {/* Tier cards */}
          <TierCards users={users} />

          {/* Pending users */}
          <PendingUsersTable users={users} onApprove={handleApprove} onDeny={handleDeny} />

          {/* Users table */}
          <UsersTable
            users={users}
            currentUser={currentUser}
            allClients={allClients}
            deptColor={deptColor}
            onEdit={openEditModal}
            onDelete={setConfirmDelete}
          />

          {/* Edit modal */}
          <EditUserModal
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
            editName={editName}
            setEditName={setEditName}
            editTier={editTier}
            setEditTier={setEditTier}
            editClientId={editClientId}
            setEditClientId={setEditClientId}
            editClientName={editClientName}
            setEditClientName={setEditClientName}
            editActive={editActive}
            setEditActive={setEditActive}
            editPermissions={editPermissions}
            toggleEditPermission={toggleEditPermission}
            editDepartments={editDepartments}
            toggleEditDepartment={toggleEditDepartment}
            onSave={handleSaveUser}
            onResetPassword={setResetPwdUser}
            currentUser={currentUser}
            departmentsList={departmentsList}
          />

          {/* Delete confirmation */}
          <DeleteConfirmModal
            confirmDelete={confirmDelete}
            setConfirmDelete={setConfirmDelete}
            onDelete={handleDelete}
          />

          {/* Reset Password Dialog */}
          <ResetPasswordModal
            resetPwdUser={resetPwdUser}
            setResetPwdUser={setResetPwdUser}
            resetPwdResult={resetPwdResult}
            setResetPwdResult={setResetPwdResult}
            resetPwdNew={resetPwdNew}
            setResetPwdNew={setResetPwdNew}
            resetPwdConfirm={resetPwdConfirm}
            setResetPwdConfirm={setResetPwdConfirm}
            resetPwdError={resetPwdError}
            resetPwdSaving={resetPwdSaving}
            onSubmit={handleResetPassword}
          />
        </>
      )}
      {tab === 'permissions' && (
        <PermissionManager
          resetToDefaults={resetToDefaults}
          saveMutation={saveMutation}
          dirty={dirty}
          permissionTiers={PERMISSION_TIERS}
          selectedTier={selectedTier}
          setSelectedTier={setSelectedTier}
          tierPerms={tierPerms}
          expandedGroups={expandedGroups}
          toggleGroup={toggleGroup}
          hasAllInGroup={hasAllInGroup}
          toggleGroupForTier={toggleGroupForTier}
          setAllForTier={setAllForTier}
          toggleTierPermission={toggleTierPermission}
        />
      )}
    </div>
  );
}
