import { TIERS, TIER_LABELS, PASSWORD_HINT } from './helpers';
import { PERMISSION_GROUPS } from '@/lib/permissions';
import ClientLinkPicker from '@/components/passengers/ClientLinkPicker';

export default function AddUserForm({
  showAddForm,
  addForm,
  setAddForm,
  onSubmit,
  addPermissions,
  toggleAddPermission,
  addDepartments,
  toggleAddDepartment,
  departmentsList,
}) {
  if (!showAddForm) return null;

  return (
    <form onSubmit={onSubmit} className="p-5 bg-card border border-border rounded-xl">
      <h3 className="font-semibold text-foreground mb-3">Add New User</h3>
      <div className="grid grid-cols-4 gap-3">
        <input
          type="text"
          placeholder="Full name"
          value={addForm.name}
          onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
          required
          className="px-3 py-2 border border-border rounded-lg text-sm"
        />
        <input
          type="email"
          placeholder="Email"
          value={addForm.email}
          onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
          required
          className="px-3 py-2 border border-border rounded-lg text-sm"
        />
        <input
          type="password"
          placeholder="Password"
          value={addForm.password}
          onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
          required
          className="px-3 py-2 border border-border rounded-lg text-sm"
        />
        <select
          value={addForm.user_tier}
          onChange={(e) => setAddForm({ ...addForm, user_tier: e.target.value, client_id: '', client_name: '' })}
          className="px-3 py-2 border border-border rounded-lg text-sm"
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {TIER_LABELS[t]?.label || t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">Password: {PASSWORD_HINT}</p>
      {addForm.user_tier === 'client' && (
        <div className="mt-3 max-w-sm">
          <label className="block text-sm font-medium text-foreground mb-1">Linked Client *</label>
          <ClientLinkPicker
            clientId={addForm.client_id}
            clientName={addForm.client_name}
            onSelect={(c) => setAddForm({ ...addForm, client_id: c.id, client_name: c.name })}
            onClear={() => setAddForm({ ...addForm, client_id: '', client_name: '' })}
          />
          <p className="text-xs text-muted-foreground mt-1">
            This account will only see this client's data in the B2B portal.
          </p>
        </div>
      )}
      <div className="mt-3">
        <p className="text-sm font-medium text-foreground mb-2">
          Custom Permissions <span className="text-xs text-muted-foreground font-normal">(optional additions)</span>
        </p>
        <div className="max-h-48 overflow-y-auto space-y-2">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.key}>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{group.label}</p>
              <div className="flex flex-wrap gap-1">
                {group.permissions.map((p) => (
                  <label
                    key={p.key}
                    className={`flex items-center gap-1 px-2 py-1 rounded border text-xs cursor-pointer select-none ${
                      addPermissions.includes(p.key)
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                        : 'bg-muted border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={addPermissions.includes(p.key)}
                      onChange={() => toggleAddPermission(p.key)}
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
      <div className="mt-3">
        <p className="text-sm font-medium text-foreground mb-2">Departments</p>
        <div className="flex flex-wrap gap-2">
          {departmentsList.map((d) => (
            <label
              key={d}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none ${
                addDepartments.includes(d)
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                  : 'bg-muted border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <input
                type="checkbox"
                checked={addDepartments.includes(d)}
                onChange={() => toggleAddDepartment(d)}
                className="sr-only"
              />
              {d}
            </label>
          ))}
        </div>
      </div>
      <button type="submit" className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
        Create User
      </button>
    </form>
  );
}
