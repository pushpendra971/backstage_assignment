import { Config } from '@backstage/config';
import express, { Request, Response, NextFunction } from 'express';
import Router from 'express-promise-router';
import { Logger } from 'winston';
import {
  UserRole,
  UserRoleInfo,
  RbacActionResponse,
  RBAC_ROLE_PERMISSIONS,
  ROLE_DISPLAY_NAMES,
} from '@internal/plugin-rbac-common';
import { validateGitLabRepository } from './gitlabValidator';

export interface RouterOptions {
  logger: Logger;
  config: Config;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger, config } = options;
  const router = Router();
  router.use(express.json());

  // Default configurable user-to-role mapping
  const defaultMapping: Record<string, UserRole> = {
    'user:default/admin': 'platform-admin',
    'user:default/developer': 'developer',
    'user:default/viewer': 'viewer',
    'user:default/guest': 'viewer',
  };

  const configuredUsers =
    config.getOptional<Record<string, string>>('rbac.users');
  const userRoleMapping: Record<string, UserRole> = { ...defaultMapping };
  if (configuredUsers) {
    for (const [key, role] of Object.entries(configuredUsers)) {
      userRoleMapping[key] = role as UserRole;
    }
  }

  // Resolve user identity from request and determine role
  const resolveUserRole = (req: Request): UserRoleInfo => {
    const rawUserRef =
      (req.headers['x-user-ref'] as string) ||
      (req.query.userRef as string);

    // If no user ref is provided at all, treat as unauthenticated anonymous caller
    const userEntityRef = rawUserRef || 'user:default/anonymous';

    // Mapped users receive their configured role; unmapped or no-credential callers receive 'no-access'
    const role: UserRole =
      userRoleMapping[userEntityRef] ||
      (userEntityRef === 'user:default/guest' ? 'viewer' : 'no-access');

    const permissions = RBAC_ROLE_PERMISSIONS[role] || [];
    const roleDisplayName = ROLE_DISPLAY_NAMES[role] || 'Unauthorized (No Access)';

    return {
      userEntityRef,
      role,
      roleDisplayName,
      permissions,
    };
  };

  // Middleware to enforce authorization independently on the backend
  const requirePermission = (permission: string) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const userInfo = resolveUserRole(req);
      if (!userInfo.permissions.includes(permission)) {
        logger.warn(
          `Unauthorized access attempt by user "${userInfo.userEntityRef}" with role "${userInfo.role}" for permission "${permission}"`
        );
        res.status(403).json({
          error: 'Forbidden',
          name: 'NotAllowedError',
          statusCode: 403,
          message: `User '${userInfo.userEntityRef}' with role '${userInfo.roleDisplayName}' does not have the '${permission}' permission.`,
          requiredPermission: permission,
          userRole: userInfo.role,
        });
        return;
      }
      next();
    };
  };

  // 1. Get current user's role and permissions
  router.get('/user-role', async (req, res) => {
    const userInfo = resolveUserRole(req);
    res.json(userInfo);
  });

  // 2. View protected endpoint (Allowed: Platform Admin, Developer, Viewer)
  router.get('/data', requirePermission('rbac.view'), async (req, res) => {
    const userInfo = resolveUserRole(req);
    const response: RbacActionResponse = {
      success: true,
      action: 'view',
      message: 'Sensitive catalog and system metrics data successfully retrieved.',
      executedBy: userInfo.userEntityRef,
      timestamp: new Date().toISOString(),
      data: {
        services: [
          { id: 'service-auth', status: 'Healthy', version: '1.2.0' },
          { id: 'service-catalog', status: 'Healthy', version: '2.0.1' },
          { id: 'service-scaffolder', status: 'Healthy', version: '0.9.4' },
        ],
        platformHealth: '99.99% Operational',
      },
    };
    res.json(response);
  });

  // 3. Create/Update protected endpoint (Allowed: Platform Admin, Developer. Denied: Viewer)
  router.post('/data', requirePermission('rbac.create-update'), async (req, res) => {
    const userInfo = resolveUserRole(req);
    const payload = req.body || {};
    const response: RbacActionResponse = {
      success: true,
      action: 'create-update',
      message: `Resource '${payload.name || 'Sample Component'}' successfully created.`,
      executedBy: userInfo.userEntityRef,
      timestamp: new Date().toISOString(),
      data: payload,
    };
    res.status(201).json(response);
  });

  router.put('/data', requirePermission('rbac.create-update'), async (req, res) => {
    const userInfo = resolveUserRole(req);
    const payload = req.body || {};
    const response: RbacActionResponse = {
      success: true,
      action: 'create-update',
      message: `Resource '${payload.name || 'Sample Component'}' successfully updated.`,
      executedBy: userInfo.userEntityRef,
      timestamp: new Date().toISOString(),
      data: payload,
    };
    res.status(200).json(response);
  });

  // 4. Delete/Manage Roles protected endpoint (Allowed: Platform Admin. Denied: Developer, Viewer)
  router.delete('/data', requirePermission('rbac.delete-manage'), async (req, res) => {
    const userInfo = resolveUserRole(req);
    const response: RbacActionResponse = {
      success: true,
      action: 'delete-manage',
      message: 'Administrative delete operation completed successfully.',
      executedBy: userInfo.userEntityRef,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  });

  // 5. Query all roles and user-role mappings
  router.get('/roles', async (_req, res) => {
    res.json({
      roles: ROLE_DISPLAY_NAMES,
      permissions: RBAC_ROLE_PERMISSIONS,
      mappings: userRoleMapping,
    });
  });

  // 6. GitLab Repository & Token validation endpoint (demonstrates safe sanitized error handling)
  router.get('/gitlab-verify', async (req, res) => {
    const projectSlug = (req.query.project as string) || 'gitlab-org/gitlab';
    const simulateStatus = req.query.simulate
      ? (Number(req.query.simulate) as 401 | 404)
      : undefined;

    const gitlabConfigs = config.getOptionalConfigArray('integrations.gitlab');
    const configuredToken = gitlabConfigs?.[0]?.getOptionalString('token');

    const result = await validateGitLabRepository({
      projectSlug,
      token: configuredToken,
      simulateStatus,
    });

    res.status(result.status).json(result);
  });

  return router;
}
