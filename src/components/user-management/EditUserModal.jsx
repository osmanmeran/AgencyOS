import { TIERS, TIER_LABELS } from './helpers';
import { PERMISSION_GROUPS } from '@/lib/permissions';
import { KeyRound } from 'lucide-react';
import ClientLinkPicker from '@/components/passengers/ClientLinkPicker';

export default function EditUserModal({
  selectedUser,
  setSelectedUser,
  editName,
  setEditName,
  editTier,
  setEditTier,
  editClientId,
  setEditClientId,
  editClientName,
  setEditClientName,
  editActive,
  setEditActive,
  editPermissions,
  toggleEditPermission,
  editDepartments,
  toggleEditDepartment,
  onSave,
  onResetPassword,
  currentUser,
  departmentsList,
}) {
  if (!selectedUser) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={() => setSelectedUser(null)}
    >
      <div className="bg-card rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-foreground mb-4">Edit User: {selectedUser.name}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">User Tier / Role</label>
            <select
              value={editTier}
              onChange={(e) => {
                setEditTier(e.target.value);
                setEditClientId('');
                setEditClientName('');
              }}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              disabled={selectedUser.user_tier === 'admin' && selectedUser.id !== currentUser?.id}
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {TIER_LABELS[t]?.label || t}
                </option>
              ))}
            </select>
            {selectedUser.user_tier === 'admin' && selectedUser.id !== currentUser?.id && (
              <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">Cannot change another admin's tier</p>
            )}
          </div>
          {editTier === 'client' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Linked Client *</label>
              <ClientLinkPicker
                clientId={editClientId}
                clientName={editClientName}
                onSelect={(c) => {
                  setEditClientId(c.id);
                  setEditClientName(c.name);
                }}
                onClear={() => {
                  setEditClientId('');
                  setEditClientName('');
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                This account only sees this client's data in the B2B portal.
              </p>
            </div>
          )}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-foreground">Account active</span>
            </label>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-2">
              Custom Permissions
              <span className="text-xs text-muted-foreground ml-2 font-normal">
                (additional capabilities beyond tier defaults)
              </span>
            </p>
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.key}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{group.label}</p>
                  <div className="flex flex-wrap gap-1">
                    {group.permissions.map((p) => (
                      <label
                        key={p.key}
                        className={`flex items-center gap-1 px-2 py-1 rounded border text-xs cursor-pointer select-none ${
                          editPermissions.includes(p.key)
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                            : 'bg-muted border-border text-muted-foreground hover:bg-muted'
                        }`}
                        title={p.description}
                      >
                        <input
                          type="checkbox"
                          checked={editPermissions.includes(p.key)}
                          onChange={() => toggleEditPermission(p.key)}
                          className="sr-only"
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Departments</p>
            <div className="flex flex-wrap gap-1.5">
              {departmentsList.map((d) => (
                <label
                  key={d}
                  className={`flex items-center gap-1 px-2 py-1 rounded border text-xs cursor-pointer select-none ${
                    editDepartments.includes(d)
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                      : 'bg-muted border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={editDepartments.includes(d)}
                    onChange={() => toggleEditDepartment(d)}
                    className="sr-only"
                  />
                  {d}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => onResetPassword(selectedUser)}
              className="px-3 py-2 text-sm border border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-950/40 flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Reset Password
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
