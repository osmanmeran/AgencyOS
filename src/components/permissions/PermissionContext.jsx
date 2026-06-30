const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_TIER_PERMISSIONS } from '@/lib/permissions';

const PermissionContext = createContext(null);

async function fetchTierPermissions() {
  try {
    const all = await db.entities.AppSettings.list();
    const settings = all[0];
    if (settings?.tier_permissions) return settings.tier_permissions;
  } catch { /* fallback */ }
  return null;
}

export function PermissionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [tierPermissions, setTierPermissions] = useState(DEFAULT_TIER_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const computePermissions = useCallback(async () => {
    setLoading(true);
    try {
      const [currentUser, tierPermsFromDb] = await Promise.all([
        db.auth.me(),
        fetchTierPermissions(),
      ]);
      if (!mountedRef.current) return;

      const effectiveTierPerms = tierPermsFromDb || DEFAULT_TIER_PERMISSIONS;
      setTierPermissions(effectiveTierPerms);
      setUser(currentUser);

      const tier = currentUser.user_tier || currentUser.role || 'agent';
      const basePermissions = effectiveTierPerms[tier] || DEFAULT_TIER_PERMISSIONS[tier] || [];
      const customPermissions = currentUser.custom_permissions || [];
      setPermissions([...new Set([...basePermissions, ...customPermissions])]);
    } catch {
      if (mountedRef.current) {
        setUser(null);
        setPermissions([]);
      }
    }
    if (mountedRef.current) setLoading(false);
  }, []);

  useEffect(() => {
    computePermissions();
    return () => { mountedRef.current = false; };
  }, [computePermissions]);

  const refreshUser = useCallback(() => {
    computePermissions();
  }, [computePermissions]);

  const hasPermission = (permission) => permissions.includes(permission);
  const hasAnyPermission = (perms) => perms.some(p => permissions.includes(p));
  const hasAllPermissions = (perms) => perms.every(p => permissions.includes(p));

  return (
    <PermissionContext.Provider value={{
      user, permissions, loading,
      hasPermission, hasAnyPermission, hasAllPermissions,
      refreshUser, tierPermissions,
    }}>
      {children}
    </PermissionContext.Provider>
  );
}

export const usePermissions = () => useContext(PermissionContext);
