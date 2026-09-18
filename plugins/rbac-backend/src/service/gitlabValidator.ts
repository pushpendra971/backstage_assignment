/**
 * Utility to safely validate GitLab repository status and sanitize errors
 * without exposing sensitive tokens or credentials in logs or responses.
 */

export interface GitLabValidationResult {
  success: boolean;
  status: number;
  project: string;
  error?: string;
  message: string;
  sanitized: boolean;
  repoDetails?: {
    name: string;
    description: string;
    webUrl: string;
    defaultBranch: string;
    visibility: string;
  };
}

/**
 * Utility to redact sensitive tokens from strings, headers, or error messages.
 */
export function redactSensitiveData(input: string, tokenToRedact?: string): string {
  if (!input) return input;
  let sanitized = input;

  // Redact explicit token if provided
  if (tokenToRedact && tokenToRedact.length > 3) {
    sanitized = sanitized.split(tokenToRedact).join('[REDACTED_TOKEN]');
  }

  // Redact GitLab PAT patterns (glpat-...)
  sanitized = sanitized.replace(/glpat-[a-zA-Z0-9_\-]{15,}/g, '[REDACTED_GITLAB_TOKEN]');

  // Redact Bearer tokens
  sanitized = sanitized.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]');

  // Redact authorization headers
  sanitized = sanitized.replace(/(token|password|secret|key)["']?\s*:\s*["'][^"']+["']/gi, '$1: "[REDACTED]"');

  return sanitized;
}

/**
 * Safely validate GitLab repository accessibility and handle errors
 * without exposing secrets or credentials.
 */
export async function validateGitLabRepository(options: {
  projectSlug: string;
  token?: string;
  apiBaseUrl?: string;
  simulateStatus?: 401 | 404;
}): Promise<GitLabValidationResult> {
  const { projectSlug, token, apiBaseUrl = 'https://gitlab.com/api/v4', simulateStatus } = options;

  // 1. Handle explicit simulation for testing/demonstration
  if (simulateStatus === 401) {
    return {
      success: false,
      status: 401,
      project: projectSlug,
      error: 'GitLabAuthenticationError',
      message: 'GitLab authentication failed: Personal Access Token is invalid or expired. Token credentials have been securely redacted.',
      sanitized: true,
    };
  }

  if (simulateStatus === 404) {
    return {
      success: false,
      status: 404,
      project: projectSlug,
      error: 'GitLabRepositoryNotFoundError',
      message: `GitLab repository '${projectSlug}' was not found or is private and inaccessible. No internal credentials were exposed.`,
      sanitized: true,
    };
  }

  // 2. Perform safe HTTP query to GitLab API
  try {
    const encodedProject = encodeURIComponent(projectSlug);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Backstage-GitLab-Integration',
    };

    if (token) {
      headers['PRIVATE-TOKEN'] = token;
    }

    const response = await fetch(`${apiBaseUrl}/projects/${encodedProject}`, {
      method: 'GET',
      headers,
    });

    if (response.status === 401) {
      return {
        success: false,
        status: 401,
        project: projectSlug,
        error: 'GitLabAuthenticationError',
        message: 'GitLab authentication failed: Personal Access Token is invalid, revoked, or expired. Credentials redacted.',
        sanitized: true,
      };
    }

    if (response.status === 404) {
      return {
        success: false,
        status: 404,
        project: projectSlug,
        error: 'GitLabRepositoryNotFoundError',
        message: `GitLab repository '${projectSlug}' does not exist or requires higher access privileges.`,
        sanitized: true,
      };
    }

    if (!response.ok) {
      const rawErr = await response.text();
      const sanitizedErr = redactSensitiveData(rawErr, token);
      return {
        success: false,
        status: response.status,
        project: projectSlug,
        error: 'GitLabApiError',
        message: `GitLab API responded with status ${response.status}: ${sanitizedErr}`,
        sanitized: true,
      };
    }

    const data = await response.json();
    return {
      success: true,
      status: 200,
      project: projectSlug,
      message: 'GitLab repository successfully validated and accessible.',
      sanitized: true,
      repoDetails: {
        name: data.name || projectSlug,
        description: data.description || 'GitLab repository',
        webUrl: data.web_url || `https://gitlab.com/${projectSlug}`,
        defaultBranch: data.default_branch || 'main',
        visibility: data.visibility || 'public',
      },
    };
  } catch (error: any) {
    const safeMessage = redactSensitiveData(error.message || 'Unknown network error', token);
    return {
      success: false,
      status: 500,
      project: projectSlug,
      error: 'GitLabNetworkError',
      message: `Failed to contact GitLab: ${safeMessage}`,
      sanitized: true,
    };
  }
}
