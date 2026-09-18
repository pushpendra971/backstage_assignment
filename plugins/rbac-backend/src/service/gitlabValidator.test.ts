import express from 'express';
import request from 'supertest';
import { ConfigReader } from '@backstage/config';
import { createRouter } from './router';
import { validateGitLabRepository, redactSensitiveData } from './gitlabValidator';

const mockLogger: any = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: () => mockLogger,
};

describe('GitLab Integration - Safe Error Handling & Token Protection', () => {
  describe('Token Redaction & Sanitization Utility', () => {
    it('redacts GitLab Personal Access Tokens (glpat-...)', () => {
      const secretToken = 'glpat-1234567890abcdefghijklmnopqrstuvwxyz';
      const logMessage = `Error contacting GitLab with token ${secretToken}: Request failed`;
      const sanitized = redactSensitiveData(logMessage, secretToken);

      expect(sanitized).not.toContain(secretToken);
      expect(sanitized).toContain('[REDACTED_TOKEN]');
    });

    it('redacts Bearer authorization header values', () => {
      const rawHeader = 'Authorization: Bearer secret_gitlab_pat_value_987654';
      const sanitized = redactSensitiveData(rawHeader);

      expect(sanitized).not.toContain('secret_gitlab_pat_value_987654');
      expect(sanitized).toContain('Bearer [REDACTED_TOKEN]');
    });
  });

  describe('GitLab Repository Validator Logic', () => {
    it('handles invalid-token scenario (HTTP 401) without exposing sensitive credentials', async () => {
      const dummyToken = 'glpat-secret-invalid-test-token-123456';
      const result = await validateGitLabRepository({
        projectSlug: 'my-org/my-private-repo',
        token: dummyToken,
        simulateStatus: 401,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(401);
      expect(result.error).toBe('GitLabAuthenticationError');
      expect(result.sanitized).toBe(true);
      // Critical check: token must NEVER appear in message or result
      expect(result.message).not.toContain(dummyToken);
    });

    it('handles repository-not-found scenario (HTTP 404) gracefully', async () => {
      const result = await validateGitLabRepository({
        projectSlug: 'nonexistent-org/missing-repo-xyz',
        simulateStatus: 404,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
      expect(result.error).toBe('GitLabRepositoryNotFoundError');
      expect(result.sanitized).toBe(true);
      expect(result.message).toContain('was not found or is private');
    });
  });

  describe('GitLab Verification Backend Endpoint', () => {
    let app: express.Express;

    beforeAll(async () => {
      const config = new ConfigReader({
        integrations: {
          gitlab: [
            {
              host: 'gitlab.com',
              token: 'glpat-configured-secret-token',
            },
          ],
        },
      });

      const router = await createRouter({
        logger: mockLogger,
        config,
      });

      app = express();
      app.use('/api/rbac', router);
    });

    it('returns HTTP 401 on simulated invalid GitLab token without leaking configured token', async () => {
      const res = await request(app).get('/api/rbac/gitlab-verify?simulate=401');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('GitLabAuthenticationError');
      expect(res.body.sanitized).toBe(true);
      // Asserts that configured token string is never leaked
      expect(JSON.stringify(res.body)).not.toContain('glpat-configured-secret-token');
    });

    it('returns HTTP 404 on simulated missing GitLab repository', async () => {
      const res = await request(app).get(
        '/api/rbac/gitlab-verify?project=unknown/missing-project&simulate=404',
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('GitLabRepositoryNotFoundError');
      expect(res.body.project).toBe('unknown/missing-project');
    });
  });
});
