import { ConfigReader } from '@backstage/config';
import express from 'express';
import request from 'supertest';
import { createRouter } from './router';

// Simple mock logger for tests
const mockLogger: any = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: () => mockLogger,
};

describe('RBAC Backend Router Tests', () => {
  let app: express.Express;

  beforeAll(async () => {
    const config = new ConfigReader({
      rbac: {
        users: {
          'user:default/admin': 'platform-admin',
          'user:default/developer': 'developer',
          'user:default/viewer': 'viewer',
        },
      },
    });

    const router = await createRouter({
      logger: mockLogger,
      config,
    });

    app = express();
    app.use('/api/rbac', router);
  });

  describe('Permission Matrix & Role Enforcement', () => {
    // 1. One allowed Administrator action (Admin can delete / manage)
    it('allows Platform Administrator to perform delete/manage action', async () => {
      const response = await request(app)
        .delete('/api/rbac/data')
        .set('x-user-ref', 'user:default/admin');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.action).toBe('delete-manage');
      expect(response.body.executedBy).toBe('user:default/admin');
    });

    // 2. One Developer action that is allowed (Developer can create/update)
    it('allows Developer to perform create/update action', async () => {
      const postResponse = await request(app)
        .post('/api/rbac/data')
        .set('x-user-ref', 'user:default/developer')
        .send({ name: 'Backend microservice component' });

      expect(postResponse.status).toBe(201);
      expect(postResponse.body.success).toBe(true);
      expect(postResponse.body.action).toBe('create-update');
      expect(postResponse.body.executedBy).toBe('user:default/developer');

      const putResponse = await request(app)
        .put('/api/rbac/data')
        .set('x-user-ref', 'user:default/developer')
        .send({ name: 'Updated microservice component' });

      expect(putResponse.status).toBe(200);
      expect(putResponse.body.success).toBe(true);
      expect(putResponse.body.action).toBe('create-update');
    });

    // 3. One Developer administrative action that is denied (Developer cannot delete / manage)
    it('denies Developer from performing administrative delete/manage action with 403', async () => {
      const response = await request(app)
        .delete('/api/rbac/data')
        .set('x-user-ref', 'user:default/developer');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
      expect(response.body.name).toBe('NotAllowedError');
      expect(response.body.requiredPermission).toBe('rbac.delete-manage');
      expect(response.body.userRole).toBe('developer');
    });

    // 4. One Viewer write action that is denied (Viewer cannot create/update)
    it('denies Viewer from performing create/update write action with 403', async () => {
      const response = await request(app)
        .post('/api/rbac/data')
        .set('x-user-ref', 'user:default/viewer')
        .send({ name: 'Unauthorized component attempt' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
      expect(response.body.name).toBe('NotAllowedError');
      expect(response.body.requiredPermission).toBe('rbac.create-update');
      expect(response.body.userRole).toBe('viewer');
    });

    // 5. One direct unauthorized backend request that is rejected
    it('rejects direct unauthorized backend request without valid role credentials with 403', async () => {
      // Calling delete without any credentials header
      const response = await request(app)
        .delete('/api/rbac/data');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
      expect(response.body.name).toBe('NotAllowedError');
      expect(response.body.requiredPermission).toBe('rbac.delete-manage');
      expect(response.body.userRole).toBe('no-access');

      // Calling GET without any credentials header is also rejected
      const getResponse = await request(app)
        .get('/api/rbac/data');

      expect(getResponse.status).toBe(403);
      expect(getResponse.body.error).toBe('Forbidden');
      expect(getResponse.body.userRole).toBe('no-access');
    });

    // Viewer read access verification
    it('allows Viewer to perform read action', async () => {
      const response = await request(app)
        .get('/api/rbac/data')
        .set('x-user-ref', 'user:default/viewer');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.action).toBe('view');
    });
  });
});
