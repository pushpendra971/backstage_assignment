import React, { useState, useEffect, useCallback } from 'react';
import {
  Header,
  Page,
  Content,
  ContentHeader,
  SupportButton,
  InfoCard,
} from '@backstage/core-components';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
import {
  Grid,
  Button,
  Typography,
  Chip,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  CardActions,
  Divider,
  TextField,
  RadioGroup,
  Radio,
  FormControlLabel,
  FormLabel,
  Tooltip,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import LockIcon from '@material-ui/icons/Lock';
import BlockIcon from '@material-ui/icons/Block';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import SendIcon from '@material-ui/icons/Send';
import VisibilityIcon from '@material-ui/icons/Visibility';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import DeleteForeverIcon from '@material-ui/icons/DeleteForever';
import BugReportIcon from '@material-ui/icons/BugReport';

import {
  UserRole,
  UserRoleInfo,
  ROLE_DISPLAY_NAMES,
} from '@internal/plugin-rbac-common';

const USER_OPTIONS = [
  { ref: 'user:default/admin', label: 'Platform Administrator (Admin)' },
  { ref: 'user:default/developer', label: 'Developer (Dev)' },
  { ref: 'user:default/viewer', label: 'Viewer (Read-Only)' },
  { ref: 'user:default/unauthorized', label: 'Unauthorized / No Access (No Credentials)' },
];

export const RbacPage = () => {
  const configApi = useApi(configApiRef);
  const backendBaseUrl = configApi.getString('backend.baseUrl');

  const [selectedUserRef, setSelectedUserRef] = useState<string>('user:default/admin');
  const [roleInfo, setRoleInfo] = useState<UserRoleInfo | null>(null);
  const [loadingRole, setLoadingRole] = useState<boolean>(false);
  const [uiMode, setUiMode] = useState<'disabled' | 'hidden'>('disabled');
  const [componentName, setComponentName] = useState<string>('payment-gateway-service');
  const [consoleOutput, setConsoleOutput] = useState<{
    status: number | string;
    endpoint: string;
    method: string;
    caller: string;
    body: any;
    timestamp: string;
    isError: boolean;
  } | null>(null);

  // Fetch resolved role for the selected user identity from the backend
  const fetchUserRole = useCallback(async (userRef: string) => {
    setLoadingRole(true);
    try {
      const response = await fetch(`${backendBaseUrl}/api/rbac/user-role`, {
        headers: {
          'x-user-ref': userRef,
        },
      });
      const data = await response.json();
      setRoleInfo(data);
    } catch (err: any) {
      // Local fallback in case backend is starting
      const roleMap: Record<string, UserRole> = {
        'user:default/admin': 'platform-admin',
        'user:default/developer': 'developer',
        'user:default/viewer': 'viewer',
        'user:default/unauthorized': 'no-access',
      };
      const role = roleMap[userRef] || 'no-access';
      setRoleInfo({
        userEntityRef: userRef,
        role,
        roleDisplayName: ROLE_DISPLAY_NAMES[role] || 'Unauthorized (No Access)',
        permissions: role === 'platform-admin' 
          ? ['rbac.view', 'rbac.create-update', 'rbac.delete-manage']
          : role === 'developer'
          ? ['rbac.view', 'rbac.create-update']
          : role === 'viewer'
          ? ['rbac.view']
          : [],
      });
    } finally {
      setLoadingRole(false);
    }
  }, [backendBaseUrl]);

  useEffect(() => {
    fetchUserRole(selectedUserRef);
  }, [selectedUserRef, fetchUserRole]);

  // Execute API call directly against backend
  const callBackendApi = async (
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    overrideUser?: string | null,
    customPayload?: any,
  ) => {
    const caller = overrideUser !== undefined ? overrideUser : selectedUserRef;
    const endpoint = `${backendBaseUrl}/api/rbac/data`;
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // If caller is 'NONE' or null, do NOT provide any credentials header
      if (caller && caller !== 'NONE') {
        headers['x-user-ref'] = caller;
      }

      const body =
        method === 'POST' || method === 'PUT'
          ? JSON.stringify(customPayload || { name: componentName, timestamp: new Date().toISOString() })
          : undefined;

      const response = await fetch(endpoint, {
        method,
        headers,
        body,
      });

      const responseData = await response.json();
      setConsoleOutput({
        status: `${response.status} ${response.statusText}`,
        endpoint: `/api/rbac/data`,
        method,
        caller: caller === 'NONE' || !caller ? 'NO ACCESS (No Credentials Sent)' : caller,
        body: responseData,
        timestamp: new Date().toLocaleTimeString(),
        isError: !response.ok,
      });
    } catch (err: any) {
      setConsoleOutput({
        status: 'Network Error',
        endpoint: `/api/rbac/data`,
        method,
        caller: caller === 'NONE' || !caller ? 'NO ACCESS' : caller,
        body: { error: err.message },
        timestamp: new Date().toLocaleTimeString(),
        isError: true,
      });
    }
  };

  const hasPermission = (permission: string): boolean => {
    return roleInfo?.permissions?.includes(permission) ?? false;
  };

  const getRoleColor = (role?: UserRole) => {
    switch (role) {
      case 'platform-admin':
        return 'secondary';
      case 'developer':
        return 'primary';
      case 'viewer':
        return 'default';
      case 'no-access':
      default:
        return 'default';
    }
  };

  const canView = hasPermission('rbac.view');
  const canCreateUpdate = hasPermission('rbac.create-update');
  const canDeleteManage = hasPermission('rbac.delete-manage');

  return (
    <Page themeId="tool">
      <Header
        title="Role-Based Access Control (RBAC)"
        subtitle="Independent Authorization & Backend Policy Enforcement Plugin"
      />
      <Content>
        <ContentHeader title="Active Role & Authorization Matrix">
          <SupportButton>
            This plugin demonstrates independent backend authorization and dynamic frontend enforcement.
          </SupportButton>
        </ContentHeader>

        <Grid container spacing={3}>
          {/* User & Role Simulator */}
          <Grid item xs={12} md={6}>
            <InfoCard title="1. User Identity & Configured Role">
              <Box mb={2}>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Select a simulated user identity to test role propagation across Backstage:
                </Typography>
                <FormControl variant="outlined" fullWidth size="small">
                  <InputLabel id="user-select-label">Active User</InputLabel>
                  <Select
                    labelId="user-select-label"
                    value={selectedUserRef}
                    onChange={(e) => setSelectedUserRef(e.target.value as string)}
                    label="Active User"
                  >
                    {USER_OPTIONS.map((opt) => (
                      <MenuItem key={opt.ref} value={opt.ref}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box display="flex" alignItems="center" gridGap={10} mb={2}>
                <Typography variant="subtitle1">Assigned Role:</Typography>
                <Chip
                  icon={roleInfo?.role === 'no-access' ? <BlockIcon /> : <LockIcon />}
                  label={loadingRole ? 'Loading...' : (roleInfo?.roleDisplayName || 'Unknown')}
                  color={getRoleColor(roleInfo?.role) as any}
                  style={
                    roleInfo?.role === 'no-access'
                      ? { backgroundColor: '#f44336', color: 'white', fontWeight: 'bold' }
                      : undefined
                  }
                />
              </Box>

              <Typography variant="subtitle2" gutterBottom>
                Granted Permissions:
              </Typography>
              <Box display="flex" flexWrap="wrap" gridGap={6} mb={2}>
                {roleInfo?.permissions && roleInfo.permissions.length > 0 ? (
                  roleInfo.permissions.map((perm) => (
                    <Chip
                      key={perm}
                      size="small"
                      color="primary"
                      variant="outlined"
                      icon={<CheckCircleIcon />}
                      label={perm}
                    />
                  ))
                ) : (
                  <Chip
                    size="small"
                    variant="outlined"
                    style={{ borderColor: '#f44336', color: '#f44336' }}
                    icon={<BlockIcon style={{ color: '#f44336' }} />}
                    label="None (0 Permissions - Completely Unauthorized)"
                  />
                )}
              </Box>

              <Divider style={{ margin: '16px 0' }} />

              {/* Requirement: Unauthorized actions should be hidden or disabled */}
              <FormControl component="fieldset">
                <FormLabel component="legend"><strong>Frontend Enforcement Mode:</strong></FormLabel>
                <RadioGroup
                  row
                  value={uiMode}
                  onChange={(e) => setUiMode(e.target.value as 'disabled' | 'hidden')}
                >
                  <FormControlLabel
                    value="disabled"
                    control={<Radio color="primary" size="small" />}
                    label="Disable unauthorized actions"
                  />
                  <FormControlLabel
                    value="hidden"
                    control={<Radio color="primary" size="small" />}
                    label="Hide unauthorized actions"
                  />
                </RadioGroup>
              </FormControl>
            </InfoCard>
          </Grid>

          {/* Role & Permission Matrix Table */}
          <Grid item xs={12} md={6}>
            <InfoCard title="2. Role and Permission Matrix">
              <TableContainer component={Paper} elevation={0}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Role</strong></TableCell>
                      <TableCell align="center"><strong>View (rbac.view)</strong></TableCell>
                      <TableCell align="center"><strong>Create/Update (rbac.create-update)</strong></TableCell>
                      <TableCell align="center"><strong>Delete/Manage (rbac.delete-manage)</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow selected={roleInfo?.role === 'platform-admin'}>
                      <TableCell><strong>Platform Administrator</strong></TableCell>
                      <TableCell align="center"><Chip size="small" label="Allowed" style={{ backgroundColor: '#4caf50', color: 'white' }} /></TableCell>
                      <TableCell align="center"><Chip size="small" label="Allowed" style={{ backgroundColor: '#4caf50', color: 'white' }} /></TableCell>
                      <TableCell align="center"><Chip size="small" label="Allowed" style={{ backgroundColor: '#4caf50', color: 'white' }} /></TableCell>
                    </TableRow>
                    <TableRow selected={roleInfo?.role === 'developer'}>
                      <TableCell><strong>Developer</strong></TableCell>
                      <TableCell align="center"><Chip size="small" label="Allowed" style={{ backgroundColor: '#4caf50', color: 'white' }} /></TableCell>
                      <TableCell align="center"><Chip size="small" label="Allowed" style={{ backgroundColor: '#4caf50', color: 'white' }} /></TableCell>
                      <TableCell align="center"><Chip size="small" label="Denied" color="secondary" /></TableCell>
                    </TableRow>
                    <TableRow selected={roleInfo?.role === 'viewer'}>
                      <TableCell><strong>Viewer</strong></TableCell>
                      <TableCell align="center"><Chip size="small" label="Allowed" style={{ backgroundColor: '#4caf50', color: 'white' }} /></TableCell>
                      <TableCell align="center"><Chip size="small" label="Denied" color="secondary" /></TableCell>
                      <TableCell align="center"><Chip size="small" label="Denied" color="secondary" /></TableCell>
                    </TableRow>
                    <TableRow selected={roleInfo?.role === 'no-access'}>
                      <TableCell><strong style={{ color: '#f44336' }}>Unauthorized (No Access)</strong></TableCell>
                      <TableCell align="center"><Chip size="small" label="Denied" style={{ backgroundColor: '#f44336', color: 'white' }} /></TableCell>
                      <TableCell align="center"><Chip size="small" label="Denied" style={{ backgroundColor: '#f44336', color: 'white' }} /></TableCell>
                      <TableCell align="center"><Chip size="small" label="Denied" style={{ backgroundColor: '#f44336', color: 'white' }} /></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              <Box mt={2}>
                <Typography variant="caption" color="textSecondary">
                  * Note: Roles and user mappings are defined in <code>app-config.yaml</code> and enforced by the backend Express router.
                </Typography>
              </Box>
            </InfoCard>
          </Grid>

          {/* Action Execution Console (Frontend UI Enforcement) */}
          <Grid item xs={12}>
            <InfoCard title="3. Available Actions (Frontend Enforcement Demo)">
              <Typography variant="body2" color="textSecondary" paragraph>
                Actions available based on current role (<strong>{roleInfo?.roleDisplayName}</strong>).
                Currently in <strong>{uiMode.toUpperCase()}</strong> mode:
              </Typography>
              <Grid container spacing={2}>
                {/* 1. View Action Card */}
                {(uiMode === 'disabled' || canView) && (
                  <Grid item xs={12} md={4}>
                    <Card variant="outlined" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <CardContent>
                        <Box display="flex" alignItems="center" gridGap={8} mb={1}>
                          <VisibilityIcon color="primary" />
                          <Typography variant="h6">View Resources</Typography>
                        </Box>
                        <Typography variant="body2" color="textSecondary" paragraph>
                          Inspect services catalog, operational status, and health metrics.
                        </Typography>
                        <Chip size="small" label="Permission: rbac.view" />
                      </CardContent>
                      <CardActions>
                        <Tooltip title={!canView ? "Requires rbac.view permission" : ""}>
                          <span>
                            <Button
                              variant="contained"
                              color="primary"
                              startIcon={<SendIcon />}
                              disabled={!canView}
                              onClick={() => callBackendApi('GET')}
                            >
                              Execute View (GET)
                            </Button>
                          </span>
                        </Tooltip>
                      </CardActions>
                    </Card>
                  </Grid>
                )}

                {/* 2. Create / Update Action Card */}
                {(uiMode === 'disabled' || canCreateUpdate) && (
                  <Grid item xs={12} md={4}>
                    <Card variant="outlined" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <CardContent>
                        <Box display="flex" alignItems="center" gridGap={8} mb={1}>
                          <AddCircleOutlineIcon color="primary" />
                          <Typography variant="h6">Create or Update</Typography>
                        </Box>
                        <Typography variant="body2" color="textSecondary" paragraph>
                          Register new catalog components or update existing definitions.
                        </Typography>
                        <Box mb={2}>
                          <TextField
                            size="small"
                            variant="outlined"
                            fullWidth
                            label="Component Name"
                            value={componentName}
                            disabled={!canCreateUpdate}
                            onChange={(e) => setComponentName(e.target.value)}
                          />
                        </Box>
                        <Chip size="small" label="Permission: rbac.create-update" />
                      </CardContent>
                      <CardActions>
                        <Tooltip title={!canCreateUpdate ? "Requires rbac.create-update permission" : ""}>
                          <span>
                            <Button
                              variant="contained"
                              color="primary"
                              size="small"
                              startIcon={<SendIcon />}
                              disabled={!canCreateUpdate}
                              onClick={() => callBackendApi('POST')}
                              style={{ marginRight: 8 }}
                            >
                              Create (POST)
                            </Button>
                          </span>
                        </Tooltip>
                        <Tooltip title={!canCreateUpdate ? "Requires rbac.create-update permission" : ""}>
                          <span>
                            <Button
                              variant="outlined"
                              color="primary"
                              size="small"
                              disabled={!canCreateUpdate}
                              onClick={() => callBackendApi('PUT')}
                            >
                              Update (PUT)
                            </Button>
                          </span>
                        </Tooltip>
                      </CardActions>
                    </Card>
                  </Grid>
                )}

                {/* 3. Delete / Manage Action Card */}
                {(uiMode === 'disabled' || canDeleteManage) && (
                  <Grid item xs={12} md={4}>
                    <Card variant="outlined" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <CardContent>
                        <Box display="flex" alignItems="center" gridGap={8} mb={1}>
                          <DeleteForeverIcon color="secondary" />
                          <Typography variant="h6">Delete / Manage Roles</Typography>
                        </Box>
                        <Typography variant="body2" color="textSecondary" paragraph>
                          Perform administrative resource deletion or manage role policies.
                        </Typography>
                        <Chip size="small" label="Permission: rbac.delete-manage" />
                      </CardContent>
                      <CardActions>
                        <Tooltip title={!canDeleteManage ? "Requires rbac.delete-manage (Admin only)" : ""}>
                          <span>
                            <Button
                              variant="contained"
                              color="secondary"
                              startIcon={<SendIcon />}
                              disabled={!canDeleteManage}
                              onClick={() => callBackendApi('DELETE')}
                            >
                              Execute Delete (DELETE)
                            </Button>
                          </span>
                        </Tooltip>
                      </CardActions>
                    </Card>
                  </Grid>
                )}
              </Grid>
            </InfoCard>
          </Grid>

          {/* Backend Enforcement Proof (Direct Bypass Verification) */}
          <Grid item xs={12} md={6}>
            <InfoCard title="4. Backend Bypass Verification (Direct Unauthorized Rejection)">
              <Typography variant="body2" paragraph>
                <strong>Security Requirement:</strong> Demonstrate that calling the backend directly without permissions or credentials cannot bypass security restrictions.
              </Typography>
              <Alert severity="warning" style={{ marginBottom: 16 }}>
                Even if an attacker bypasses frontend UI controls and directly invokes the REST API with <strong>NO ACCESS CREDENTIALS</strong>, the backend independently enforces authorization and returns <strong>HTTP 403 Forbidden</strong>.
              </Alert>

              <Typography variant="subtitle2" gutterBottom>
                Trigger Direct Rejections (No Access & Bypass Proof):
              </Typography>
              <Box display="flex" flexDirection="column" gridGap={10}>
                {/* Dedicated Test Case: No access provided at all */}
                <Button
                  variant="contained"
                  style={{ backgroundColor: '#d32f2f', color: 'white' }}
                  startIcon={<BlockIcon />}
                  onClick={() => callBackendApi('GET', 'NONE')}
                >
                  Direct Call with NO ACCESS / NO Credentials &rarr; Reject GET (HTTP 403)
                </Button>
                <Button
                  variant="contained"
                  style={{ backgroundColor: '#c2185b', color: 'white' }}
                  startIcon={<BlockIcon />}
                  onClick={() => callBackendApi('DELETE', 'NONE')}
                >
                  Direct Call with NO ACCESS / NO Credentials &rarr; Reject DELETE (HTTP 403)
                </Button>

                <Divider style={{ margin: '8px 0' }} />

                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={<BugReportIcon />}
                  onClick={() => callBackendApi('DELETE')}
                >
                  Force Direct DELETE as Current User ({roleInfo?.roleDisplayName})
                </Button>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<BugReportIcon />}
                  onClick={() => callBackendApi('POST')}
                >
                  Force Direct POST as Current User ({roleInfo?.roleDisplayName})
                </Button>
              </Box>
            </InfoCard>
          </Grid>

          {/* Live Backend Response Inspector */}
          <Grid item xs={12} md={6}>
            <InfoCard title="5. Live Backend Response Inspector">
              {consoleOutput ? (
                <Box>
                  <Box display="flex" alignItems="center" flexWrap="wrap" gridGap={8} mb={1}>
                    <Chip
                      size="small"
                      label={consoleOutput.method}
                      color={consoleOutput.method === 'DELETE' ? 'secondary' : 'primary'}
                    />
                    <Typography variant="body2"><strong>{consoleOutput.endpoint}</strong></Typography>
                    <Chip
                      size="small"
                      label={consoleOutput.status}
                      style={{
                        backgroundColor: consoleOutput.isError ? '#f44336' : '#4caf50',
                        color: 'white',
                        fontWeight: 'bold',
                      }}
                    />
                    <Typography variant="caption" color="textSecondary">
                      Caller: <code>{consoleOutput.caller}</code>
                    </Typography>
                  </Box>
                  <Divider style={{ margin: '8px 0' }} />
                  <Paper
                    variant="outlined"
                    style={{
                      padding: 12,
                      backgroundColor: '#1e1e1e',
                      color: '#d4d4d4',
                      fontFamily: 'Consolas, monospace',
                      fontSize: '0.85rem',
                      maxHeight: 220,
                      overflowY: 'auto',
                    }}
                  >
                    <pre style={{ margin: 0 }}>
                      {JSON.stringify(consoleOutput.body, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  Click any action or bypass button to inspect the real-time HTTP response and authorization status from the backend.
                </Typography>
              )}
            </InfoCard>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
