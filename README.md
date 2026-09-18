# Backstage Technical Assignment: Custom RBAC Plugin & GitLab Integration

This repository contains a complete working solution for the Backstage Technical Assignment. It features:
1. **Custom Role-Based Access Control (RBAC) System**: A dedicated backend authorization plugin with independent server-side enforcement, an interactive frontend dashboard (`/rbac`) with live role simulation, and automated Jest/Supertest tests.
2. **GitLab Catalog & CI/CD Integration**: Seamless ingestion of live catalog components from private GitLab repositories via Personal Access Tokens (PAT), specialized CI/CD visualization, and token-redacting safe error handling.
3. **Streamlined Developer Experience**: Zero-dependency environment variable auto-loading, clean navigation sidebar, and focused entity views.

---

## Architecture Overview

```mermaid
graph TD
    subgraph Frontend ["Backstage App (:3000)"]
        Sidebar["Sidebar Navigation (/catalog, /rbac)"]
        CatalogUI["Software Catalog & CI/CD Dashboard"]
        RbacUI["RBAC Simulation & Enforcement Dashboard (/rbac)"]
    end

    subgraph Backend ["Backstage Backend (:7007)"]
        CatalogPlugin["@backstage/plugin-catalog-backend"]
        RbacBackend["@internal/plugin-rbac-backend"]
        UrlReader["GitLab UrlReader (Token Authed)"]
        GitLabValidator["Safe GitLab Validator & Sanitizer"]
    end

    subgraph External ["External Infrastructure"]
        GitLabRepo["GitLab Repository (4rtyuikl-group/demo)"]
        GitLabAPI["GitLab REST API v4"]
    end

    Sidebar --> CatalogUI
    Sidebar --> RbacUI
    CatalogUI --> CatalogPlugin
    CatalogPlugin --> UrlReader --> GitLabAPI
    RbacUI --> RbacBackend
    RbacBackend --> GitLabValidator --> GitLabAPI
    GitLabAPI --> GitLabRepo
```

### Modular Plugin Structure
- **`@internal/plugin-rbac-common` (`plugins/rbac-common`)**:
  - Defines system permissions (`rbac.view`, `rbac.create-update`, `rbac.delete-manage`).
  - Strict TypeScript contracts for user roles (`platform-admin`, `developer`, `viewer`), permission maps, and API responses.
- **`@internal/plugin-rbac-backend` (`plugins/rbac-backend`)**:
  - Independent authorization middleware using Backstage's New Backend System (`createBackendPlugin`).
  - Protected REST endpoints enforcing permissions on every request.
  - Safe GitLab repository status and token validation endpoint (`/api/rbac/gitlab-verify`).
- **`@internal/plugin-rbac` (`plugins/rbac-frontend`)**:
  - Interactive dashboard mounted at `/rbac`.
  - Persona switcher to simulate different roles in real time.
  - Client-side button disablement and a **Backend Bypass Verification Panel** proving direct API tampering is blocked with HTTP 403 Forbidden.
- **GitLab CI/CD Component Page (`packages/app/src/components/catalog/GitLabPipelines.tsx`)**:
  - Dedicated CI/CD tab for components hosted on GitLab.
  - Displays pipeline status, execution duration, commit details, repository file previews (`.gitlab-ci.yml`, `catalog-info.yaml`, `README.md`), and interactive error diagnostic runner.

---

## Role & Permission Matrix

| Role | View Data (`rbac.view`) | Create / Update Data (`rbac.create-update`) | Delete / Manage Data (`rbac.delete-manage`) |
| :--- | :---: | :---: | :---: |
| **Platform Administrator** | Allowed (HTTP 200) | Allowed (HTTP 201) | Allowed (HTTP 200) |
| **Developer** | Allowed (HTTP 200) | Allowed (HTTP 201) | **Denied (HTTP 403)** |
| **Viewer** | Allowed (HTTP 200) | **Denied (HTTP 403)** | **Denied (HTTP 403)** |
| **Unauthenticated / Guest** | Evaluated per role | Evaluated per role | **Denied (HTTP 403)** |

---

## Quick Start Guide

### Prerequisites
- **Node.js**: `v18.x` or `v20.x` (tested on Node v20.10.0)
- **Yarn**: `v1.22.x` (Classic)
- **Git**

### 1. Installation
Clone the repository and install all dependencies:
```bash
yarn install
```

### 2. Environment & Credential Configuration
Credentials are automatically loaded from either `.env` or `app-config.local.yaml` (both ignored by git):

1. **Create/Verify `.env`** in the repository root:
   ```env
   GITLAB_TOKEN=glpat-4tkUQzgcZjEQ2DwzDP1FV2M6MQpvOjEKdTpwYzh6bA8.01.1708m32iy
   ```
2. **Local Config Override** (`app-config.local.yaml`):
   ```yaml
   integrations:
     gitlab:
       - host: gitlab.com
         token: glpat-4tkUQzgcZjEQ2DwzDP1FV2M6MQpvOjEKdTpwYzh6bA8.01.1708m32iy
         apiBaseUrl: https://gitlab.com/api/v4
   ```
> **Note**: The backend automatically parses root `.env` at boot and injects it into `process.env`.

### 3. Running the Application
Launch both the frontend (port 3000) and backend (port 7007) concurrently:
```bash
yarn dev
```
- **Frontend App**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:7007](http://localhost:7007)

---

## Docker Deployment (Production Container)

The project is fully containerized with a production-grade, multi-stage `Dockerfile` and `docker-compose.yml`. In containerized mode, Backstage runs as a unified single service on port `7007`, where the backend serves both API routes and the precompiled frontend bundle.

### 1. One-Command Startup (Docker Compose)

Ensure your `.env` file contains your `GITLAB_TOKEN`, then run:

```bash
docker compose up --build
```
*(Or via yarn script)*:
```bash
yarn docker:compose
```

- **Unified Backstage App & Backend**: [http://localhost:7007](http://localhost:7007)
- **RBAC Dashboard**: [http://localhost:7007/rbac](http://localhost:7007/rbac)
- **GitLab Demo Service CI/CD**: [http://localhost:7007/catalog/default/component/gitlab-demo-service/ci-cd](http://localhost:7007/catalog/default/component/gitlab-demo-service/ci-cd)

To run in the background (detached):
```bash
docker compose up -d
```
To stop the container:
```bash
docker compose down
```

### 2. Manual Docker CLI Commands

You can also build and run the image directly:

**On Linux / macOS / Git Bash**:
```bash
# 1. Build the production Docker image
docker build -t backstage-app:latest .
# (or: yarn docker:build)

# 2. Run the container with environment variables
docker run -it --rm \
  -p 7007:7007 \
  -e GITLAB_TOKEN=glpat-4tkUQzgcZjEQ2DwzDP1FV2M6MQpvOjEKdTpwYzh6bA8.01.1708m32iy \
  --name backstage-app \
  backstage-app:latest
# (or: yarn docker:run)
```

**On Windows PowerShell** (PowerShell uses single-line or backtick continuation `` ` `` instead of `\`):
```powershell
# 1. Build the production Docker image
docker build -t backstage-app:latest .

# 2. Run the container
docker run -it --rm -p 7007:7007 -e GITLAB_TOKEN="glpat-4tkUQzgcZjEQ2DwzDP1FV2M6MQpvOjEKdTpwYzh6bA8.01.1708m32iy" --name backstage-app backstage-app:latest
```

> **Note for Windows users**: If you see `docker : The term 'docker' is not recognized`, make sure [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) is installed and running.

### 3. Container Architecture Highlights
- **Multi-Stage Build**:
  - `builder` stage: Uses `node:20-bookworm` with `python3`, `g++`, and `make` to compile TypeScript packages, frontend web bundles (`packages/app/dist`), backend bundles, and internal plugins.
  - `runner` stage: Minimal `node:20-bookworm-slim` with `dumb-init` for proper Linux signal forwarding and zombie process reaping.
- **Security & Permissions**: Runs as unprivileged `node` user (`USER node`) instead of root.
- **Optimized Image Size**: Strips development toolchains, git history, and dev dependencies, copying only release artifacts and production dependencies into `/app`.
- **Runtime Configuration**: Uses `app-config.docker.yaml` specifying `baseUrl: http://localhost:7007`, in-memory SQLite database, and guest authentication provider.

---

## Application Verification & Testing Flow

### Flow 1: Testing the Custom RBAC Plugin (Task 1)

1. Open **[http://localhost:3000/rbac](http://localhost:3000/rbac)** in your browser (or click **RBAC** in the sidebar).
2. **Switch Roles using the Role Selector**:
   - **Platform Administrator**:
     - Status shows `All permissions granted`.
     - Click **Create Resource** -> Succeeds (`HTTP 201 Created`).
     - Click **Delete Resource** -> Succeeds (`HTTP 200 OK`).
   - **Developer**:
     - Status shows `View and Create/Update permissions`.
     - Click **Create Resource** -> Succeeds (`HTTP 201 Created`).
     - "Delete Resource" button is automatically **disabled** in the UI.
   - **Viewer**:
     - Status shows `Read-only permission`.
     - Both "Create Resource" and "Delete Resource" buttons are **disabled** in the UI.
3. **Verify Backend Authorization Enforcement (Bypass Test)**:
   - In the **Backend Authorization Bypass Verification** card, select `DELETE /api/rbac/data` while logged in as **Developer** or **Viewer**.
   - Click **Send Direct Backend API Request**.
   - Observe that the backend intercepts the request and responds with **HTTP 403 Forbidden**:
     ```json
     {
       "error": "Forbidden",
       "message": "Access denied: Missing required permission 'rbac.delete-manage' for role 'developer'."
     }
     ```
   - This proves authorization is strictly enforced on the server and cannot be bypassed by client-side inspection.

---

### Flow 2: Testing GitLab Catalog & CI/CD Integration (Task 2)

1. Open **[http://localhost:3000/catalog](http://localhost:3000/catalog)** (or click **Catalog** in the sidebar).
2. **Verify Component Ingestion**:
   - Locate the component **`gitlab-demo-service`** with title **"GitLab Demo Microservice"**.
   - Notice that it is loaded live from the private GitLab repository:
     `url:https://gitlab.com/4rtyuikl-group/demo/-/blob/main/catalog-info.yaml`
3. Click into **`gitlab-demo-service`**:
   - **Overview Tab**: Displays service metadata, description, tags, repository links, and clean ownership linked to `pushpendra971`.
   - **CI/CD Tab** ([Direct Link](http://localhost:3000/catalog/default/component/gitlab-demo-service/ci-cd)):
     - **Live Pipeline History**: Displays past pipeline runs with commit SHAs, authors, durations, and direct links to GitLab CI.
     - **Repository File Explorer**: View real repository configuration files (`.gitlab-ci.yml`, `catalog-info.yaml`, `README.md`) with syntax highlighting.
     - **Dispatch Pipeline**: Click **"Rerun Pipeline"** to simulate triggering an automated CI job.
4. **Safe Error Handling & Token Sanitization Diagnostic**:
   - On the CI/CD page, locate the **Safe Error Handling & Token Protection Diagnostic** panel.
   - Click **Simulate 401 (Invalid Token)**:
     - Verifies that authentication errors are caught gracefully.
     - Confirms sensitive tokens (patterns like `glpat-...` or `Bearer ...`) are redacted (`[REDACTED_GITLAB_TOKEN]`).
   - Click **Simulate 404 (Missing Project)**:
     - Verifies that private or nonexistent repositories do not leak internal stack traces or secrets.
   - Click **Validate Live GitLab Repository**:
     - Confirms real-time connectivity to GitLab API v4, returning HTTP 200 with repository details.

---

### Flow 3: Running Automated Test Suites

Execute all automated unit and integration tests across the workspace:

#### 1. RBAC & GitLab Validator Tests (Backend)
Runs all authorization policy and GitLab safe error handling tests:
```bash
yarn workspace @internal/plugin-rbac-backend test
```
**Expected Output**:
```
PASS src/service/router.test.ts
PASS src/service/gitlabValidator.test.ts

Test Suites: 2 passed, 2 total
Tests:       10 passed, 10 total
Snapshots:   0 total
```

#### 2. Frontend Application Tests
Runs frontend component smoke and rendering tests:
```bash
yarn workspace app test --watchAll=false
```
**Expected Output**:
```
PASS src/App.test.tsx
  App
    √ renders without crashing
```

#### 3. Run All Tests Across Entire Workspace
```bash
yarn test
```

---

### Flow 4: Command-Line API Verification (cURL / PowerShell)

You can verify the backend endpoints directly from your terminal using PowerShell or cURL:

#### 1. Test GitLab Verification Endpoint
```powershell
Invoke-RestMethod -Uri "http://localhost:7007/api/rbac/gitlab-verify?project=4rtyuikl-group%2Fdemo" | ConvertTo-Json -Depth 5
```
**Expected Output**:
```json
{
  "success": true,
  "status": 200,
  "project": "4rtyuikl-group/demo",
  "message": "GitLab repository successfully validated and accessible.",
  "sanitized": true,
  "repoDetails": {
    "name": "demo",
    "description": "GitLab repository",
    "webUrl": "https://gitlab.com/4rtyuikl-group/demo",
    "defaultBranch": "main",
    "visibility": "private"
  }
}
```

#### 2. Test Catalog Entities API (Using Guest Auth Token)
```powershell
$auth = Invoke-RestMethod -Uri "http://localhost:7007/api/auth/guest/refresh"
$token = $auth.backstageIdentity.token

# Fetch gitlab-demo-service component
Invoke-RestMethod -Uri "http://localhost:7007/api/catalog/entities/by-name/component/default/gitlab-demo-service" -Headers @{ Authorization = "Bearer $token" } | Select-Object -ExpandProperty metadata | Select-Object name, title, annotations
```

#### 3. Test RBAC Endpoints with Simulated Roles
```powershell
# Admin can delete (200 OK)
Invoke-RestMethod -Uri "http://localhost:7007/api/rbac/data" -Method DELETE -Headers @{ "x-user-role" = "platform-admin" }

# Developer cannot delete (403 Forbidden)
try {
  Invoke-RestMethod -Uri "http://localhost:7007/api/rbac/data" -Method DELETE -Headers @{ "x-user-role" = "developer" }
} catch {
  Write-Host "Caught expected 403: $($_.Exception.Message)"
}
```

---

## Multi-Organization Architecture Extension (Design Discussion)

*How this solution scales for an enterprise parent organization with multiple autonomous business units, each maintaining its own SSO provider and dedicated GitLab instance:*

```mermaid
graph LR
    User([User Request with JWT]) --> AuthInterceptor[Tenant Auth Interceptor]
    AuthInterceptor --> Resolver{Tenant Resolver}
    
    Resolver -->|Tenant BU-Alpha| VaultAlpha[Vault / KMS Scoped Token A]
    Resolver -->|Tenant BU-Beta| VaultBeta[Vault / KMS Scoped Token B]
    
    VaultAlpha --> GitLabInstA[GitLab Instance Alpha]
    VaultBeta --> GitLabInstB[GitLab Instance Beta]
```

1. **Trusted Multi-Tenant Identity Partitioning**:
   - Extract verified tenant claims (`tenant_id`, `organization_id`) directly from cryptographically signed OIDC tokens issued by each business unit's IdP (e.g., Okta, Azure AD, Keycloak).
   - The Backstage backend authentication pipeline embeds `tenant_id` into the execution context of every request.

2. **Per-Tenant Dynamic Secret Resolution**:
   - Rather than storing static tokens in configuration files, integrate with a centralized secrets manager (HashiCorp Vault or AWS Secrets Manager).
   - When a catalog or CI/CD query is performed, the GitLab UrlReader dynamically requests a short-lived token scoped exclusively to the target business unit's GitLab instance.

3. **Catalog & Database Isolation**:
   - Enforce namespace isolation within the Backstage Software Catalog: entities are indexed under `component:<tenant_id>/<service_name>`.
   - Prevent cross-tenant data leakage by evaluating tenant constraints in the Backstage Permission Framework policy rules (`tenant_id === entity.metadata.namespace`).

4. **Zero-Trust Backend Enforcement**:
   - All backend routes inspect incoming credentials against tenant boundaries. Any attempt by a user from Business Unit A to query or mutate resources belonging to Business Unit B is rejected with `HTTP 403 Forbidden` / `HTTP 404 Not Found`.

---

## Troubleshooting

### Port Collision (`EADDRINUSE: :::7007` or `:::3000`)
If you encounter port errors when running `yarn dev`, an existing instance is already running:
- **Stop existing processes**: Press `Ctrl + C` in the running terminal.
- **On Windows PowerShell**:
  ```powershell
  Stop-Process -Name node -Force
  yarn dev
  ```

### GitLab 404 on Private Repository
If the GitLab entity fails to ingest, ensure your Personal Access Token in `.env` or `app-config.local.yaml` has the `read_api` and `read_repository` scopes.
