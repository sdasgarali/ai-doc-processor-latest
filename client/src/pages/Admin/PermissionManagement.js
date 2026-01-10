import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Checkbox,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Security as SecurityIcon,
  Check as CheckIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import axios from 'axios';

const PermissionManagement = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Permissions data
  const [permissions, setPermissions] = useState([]);
  const [groupedPermissions, setGroupedPermissions] = useState({});
  const [categories, setCategories] = useState([]);

  // Role permissions
  const [selectedRole, setSelectedRole] = useState('user');
  const [rolePermissions, setRolePermissions] = useState([]);
  const [rolePermissionIds, setRolePermissionIds] = useState(new Set());

  // User permissions
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState(null);
  const [userSpecificPerms, setUserSpecificPerms] = useState(new Map());

  // Search and filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const roles = ['user', 'client', 'admin', 'superadmin'];

  useEffect(() => {
    fetchPermissions();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (permissions.length > 0 && selectedRole) {
      fetchRolePermissions(selectedRole);
    }
  }, [selectedRole, permissions]);

  useEffect(() => {
    if (selectedUser) {
      fetchUserPermissions(selectedUser.userid);
    }
  }, [selectedUser]);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/permissions/permissions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setPermissions(response.data.data);
      setGroupedPermissions(response.data.grouped);
      setCategories(Object.keys(response.data.grouped));
      setError('');
    } catch (err) {
      console.error('Error fetching permissions:', err);
      setError('Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data.data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchRolePermissions = async (role) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/permissions/roles/${role}/permissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setRolePermissions(response.data.data);
      const permIds = new Set(response.data.data.map(p => p.permission_id));
      setRolePermissionIds(permIds);
    } catch (err) {
      console.error('Error fetching role permissions:', err);
    }
  };

  const fetchUserPermissions = async (userid) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/permissions/users/${userid}/permissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setUserPermissions(response.data.data);
      
      // Build map of user-specific permissions
      const permMap = new Map();
      response.data.data.userSpecificPermissions.forEach(perm => {
        permMap.set(perm.permission_id, perm.permission_type);
      });
      setUserSpecificPerms(permMap);
    } catch (err) {
      console.error('Error fetching user permissions:', err);
    }
  };

  const handleRolePermissionToggle = (permissionId) => {
    const newPermIds = new Set(rolePermissionIds);
    if (newPermIds.has(permissionId)) {
      newPermIds.delete(permissionId);
    } else {
      newPermIds.add(permissionId);
    }
    setRolePermissionIds(newPermIds);
  };

  const handleSaveRolePermissions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      await axios.post(
        `/api/permissions/roles/${selectedRole}/permissions`,
        { permissionIds: Array.from(rolePermissionIds) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess(`Permissions for ${selectedRole} role updated successfully!`);
      setTimeout(() => setSuccess(''), 3000);
      await fetchRolePermissions(selectedRole);
    } catch (err) {
      console.error('Error saving role permissions:', err);
      setError('Failed to save role permissions');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleUserPermissionToggle = (permissionId) => {
    const newMap = new Map(userSpecificPerms);
    
    if (newMap.has(permissionId)) {
      const current = newMap.get(permissionId);
      if (current === 'allow') {
        newMap.set(permissionId, 'deny');
      } else {
        newMap.delete(permissionId);
      }
    } else {
      newMap.set(permissionId, 'allow');
    }
    
    setUserSpecificPerms(newMap);
  };

  const handleSaveUserPermissions = async () => {
    if (!selectedUser) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const permissionsArray = Array.from(userSpecificPerms.entries()).map(([permissionId, permissionType]) => ({
        permissionId,
        permissionType
      }));
      
      await axios.post(
        `/api/permissions/users/${selectedUser.userid}/permissions/bulk`,
        { permissions: permissionsArray },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess(`Permissions for ${selectedUser.email} updated successfully!`);
      setTimeout(() => setSuccess(''), 3000);
      await fetchUserPermissions(selectedUser.userid);
    } catch (err) {
      console.error('Error saving user permissions:', err);
      setError('Failed to save user permissions');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const filteredPermissions = permissions.filter(perm => {
    const matchesSearch = searchTerm === '' || 
      perm.permission_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perm.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === '' || perm.permission_category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const getUserPermissionStatus = (permissionId) => {
    if (!userPermissions) return null;
    
    // Check user-specific permission first
    if (userSpecificPerms.has(permissionId)) {
      return userSpecificPerms.get(permissionId);
    }
    
    // Check if inherited from role
    const hasRolePerm = userPermissions.rolePermissions.some(p => p.permission_id === permissionId);
    return hasRolePerm ? 'role' : null;
  };

  const renderRolePermissionsTab = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <TextField
          select
          label="Select Role"
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          sx={{ width: 200 }}
        >
          {roles.map(role => (
            <MenuItem key={role} value={role}>
              {role.toUpperCase()}
            </MenuItem>
          ))}
        </TextField>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip 
            label={`${rolePermissionIds.size} of ${permissions.length} selected`} 
            color="primary" 
          />
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSaveRolePermissions}
            disabled={loading}
          >
            Save Changes
          </Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            placeholder="Search permissions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
            size="small"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            select
            fullWidth
            label="Filter by Category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            size="small"
          >
            <MenuItem value="">All Categories</MenuItem>
            {categories.map(cat => (
              <MenuItem key={cat} value={cat}>
                {cat.replace('_', ' ').toUpperCase()}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>

      {categories.map(category => {
        const categoryPerms = groupedPermissions[category].filter(perm =>
          filteredPermissions.some(fp => fp.permission_id === perm.permission_id)
        );
        
        if (categoryPerms.length === 0) return null;
        
        const allSelected = categoryPerms.every(p => rolePermissionIds.has(p.permission_id));
        const someSelected = categoryPerms.some(p => rolePermissionIds.has(p.permission_id));
        
        return (
          <Accordion key={category} defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                <Checkbox
                  checked={allSelected}
                  indeterminate={!allSelected && someSelected}
                  onChange={() => {
                    const newPermIds = new Set(rolePermissionIds);
                    categoryPerms.forEach(perm => {
                      if (allSelected) {
                        newPermIds.delete(perm.permission_id);
                      } else {
                        newPermIds.add(perm.permission_id);
                      }
                    });
                    setRolePermissionIds(newPermIds);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <Typography variant="h6">
                  {category.replace('_', ' ').toUpperCase()}
                </Typography>
                <Chip 
                  label={`${categoryPerms.filter(p => rolePermissionIds.has(p.permission_id)).length}/${categoryPerms.length}`}
                  size="small"
                  color={allSelected ? "success" : someSelected ? "warning" : "default"}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width="50px">Enabled</TableCell>
                      <TableCell>Permission</TableCell>
                      <TableCell>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {categoryPerms.map(perm => (
                      <TableRow key={perm.permission_id} hover>
                        <TableCell>
                          <Checkbox
                            checked={rolePermissionIds.has(perm.permission_id)}
                            onChange={() => handleRolePermissionToggle(perm.permission_id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {perm.permission_name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {perm.description}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );

  const renderUserPermissionsTab = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <TextField
          select
          label="Select User"
          value={selectedUser?.userid || ''}
          onChange={(e) => {
            const user = users.find(u => u.userid === e.target.value);
            setSelectedUser(user);
          }}
          sx={{ width: 400 }}
        >
          {users.map(user => (
            <MenuItem key={user.userid} value={user.userid}>
              {user.email} ({user.first_name} {user.last_name}) - {user.user_role}
            </MenuItem>
          ))}
        </TextField>
        
        {selectedUser && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip 
              label={`Role: ${userPermissions?.userRole?.toUpperCase() || 'N/A'}`}
              color="secondary"
            />
            <Chip 
              label={`${userSpecificPerms.size} custom permissions`}
              color="primary"
            />
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSaveUserPermissions}
              disabled={loading || !selectedUser}
            >
              Save Changes
            </Button>
          </Box>
        )}
      </Box>

      {selectedUser && userPermissions && (
        <>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Legend:</strong> ✓ = Allowed, ✗ = Denied, (Role) = Inherited from role
            </Typography>
          </Alert>

          {categories.map(category => {
            const categoryPerms = groupedPermissions[category];
            
            return (
              <Accordion key={category} defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">
                    {category.replace('_', ' ').toUpperCase()}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Permission</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell width="150px">Status</TableCell>
                          <TableCell width="150px">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {categoryPerms.map(perm => {
                          const status = getUserPermissionStatus(perm.permission_id);
                          
                          return (
                            <TableRow key={perm.permission_id} hover>
                              <TableCell>
                                <Typography variant="body2" fontWeight="medium">
                                  {perm.permission_name}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color="text.secondary">
                                  {perm.description}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                {status === 'allow' && (
                                  <Chip label="Allowed" color="success" size="small" icon={<CheckIcon />} />
                                )}
                                {status === 'deny' && (
                                  <Chip label="Denied" color="error" size="small" icon={<CloseIcon />} />
                                )}
                                {status === 'role' && (
                                  <Chip label="From Role" color="default" size="small" />
                                )}
                                {!status && (
                                  <Chip label="Not Set" color="default" size="small" variant="outlined" />
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="small"
                                  onClick={() => handleUserPermissionToggle(perm.permission_id)}
                                  variant={status === 'allow' || status === 'deny' ? 'contained' : 'outlined'}
                                  color={status === 'allow' ? 'success' : status === 'deny' ? 'error' : 'primary'}
                                >
                                  {!status || status === 'role' ? 'Override' : status === 'allow' ? 'Deny' : 'Clear'}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </>
      )}

      {!selectedUser && (
        <Box sx={{ textAlign: 'center', py: 5 }}>
          <PersonIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            Select a user to manage their permissions
          </Typography>
        </Box>
      )}
    </Box>
  );

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SecurityIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h5" fontWeight="bold">
            Permission Management
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => {
            fetchPermissions();
            if (selectedRole) fetchRolePermissions(selectedRole);
            if (selectedUser) fetchUserPermissions(selectedUser.userid);
          }}
        >
          Refresh
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {loading && !permissions.length ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
            <Tab label="Role Permissions" />
            <Tab label="User Permissions" />
          </Tabs>

          {activeTab === 0 && renderRolePermissionsTab()}
          {activeTab === 1 && renderUserPermissionsTab()}
        </>
      )}
    </Paper>
  );
};

export default PermissionManagement;
