import { createPermission } from '@backstage/plugin-permission-common';

export type UserRole = 'platform-admin' | 'developer' | 'viewer' | 'no-access';

export interface UserRoleInfo {
  userEntityRef: string;
  role: UserRole;
  roleDisplayName: string;
  permissions: string[];
}

export interface RbacActionResponse {
  success: boolean;
  message: string;
  action: 'view' | 'create-update' | 'delete-manage';
  executedBy: string;
  timestamp: string;
  data?: any;
}

export const rbacViewPermission = createPermission({
  name: 'rbac.view',
  attributes: { action: 'read' },
});

export const rbacCreateUpdatePermission = createPermission({
  name: 'rbac.create-update',
  attributes: { action: 'create' },
});

export const rbacDeleteManagePermission = createPermission({
  name: 'rbac.delete-manage',
  attributes: { action: 'delete' },
});

export const RBAC_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  'platform-admin': ['rbac.view', 'rbac.create-update', 'rbac.delete-manage'],
  'developer': ['rbac.view', 'rbac.create-update'],
  'viewer': ['rbac.view'],
  'no-access': [],
};

export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  'platform-admin': 'Platform Administrator',
  'developer': 'Developer',
  'viewer': 'Viewer',
  'no-access': 'Unauthorized (No Access)',
};
