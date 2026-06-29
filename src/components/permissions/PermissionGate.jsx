import React from 'react';
import { usePermissions } from './PermissionContext';

export default function PermissionGate({ permission, permissions, requireAll = false, children, fallback = null }) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = usePermissions();

  if (loading) return null;

  let hasAccess = false;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions) {
    hasAccess = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);
  }

  return hasAccess ? children : fallback;
}