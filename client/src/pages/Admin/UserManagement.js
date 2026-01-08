import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Tooltip,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LockReset as ResetPasswordIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from 'axios';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [openPasswordDialog, setOpenPasswordDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    user_role: 'user',
    client_id: '',
    timezone: 'UTC',
    is_active: true
  });
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchClients();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data.data || []);
      setError('');
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/admin/clients', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClients(response.data.data || []);
    } catch (err) {
      console.error('Error fetching clients:', err);
    }
  };

  const handleOpenDialog = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email,
        password: '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        user_role: user.user_role,
        client_id: user.client_id || '',
        timezone: user.timezone || 'UTC',
        is_active: user.is_active
      });
    } else {
      setEditingUser(null);
      setFormData({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        user_role: 'user',
        client_id: '',
        timezone: 'UTC',
        is_active: true
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      user_role: 'user',
      client_id: '',
      timezone: 'UTC',
      is_active: true
    });
  };

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (editingUser) {
        // Update user
        await axios.put(
          `http://localhost:5000/api/admin/users/${editingUser.userid}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess('User updated successfully!');
      } else {
        // Create user
        await axios.post(
          'http://localhost:5000/api/admin/users',
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess('User created successfully!');
      }
      
      handleCloseDialog();
      fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving user:', err);
      setError(err.response?.data?.message || 'Failed to save user');
    }
  };

  const handleOpenPasswordDialog = (user) => {
    setResetPasswordUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setOpenPasswordDialog(true);
  };

  const handleClosePasswordDialog = () => {
    setOpenPasswordDialog(false);
    setResetPasswordUser(null);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleResetPassword = async () => {
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:5000/api/admin/users/${resetPasswordUser.userid}/reset-password`,
        { newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess(`Password reset successfully for ${resetPasswordUser.email}!`);
      handleClosePasswordDialog();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error resetting password:', err);
      setError(err.response?.data?.message || 'Failed to reset password');
    }
  };

  const handleDeleteUser = async (userid) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/admin/users/${userid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess('User deleted successfully!');
      fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting user:', err);
      setError(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'superadmin': return 'error';
      case 'admin': return 'warning';
      case 'client': return 'info';
      default: return 'default';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">User Management</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchUsers}>
            Refresh
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Add User
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>ID</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Name</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Email</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Role</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Client</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Last Login</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Timezone</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">No users found</TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.userid} hover>
                    <TableCell>{user.userid}</TableCell>
                    <TableCell>
                      {user.first_name} {user.last_name}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Chip label={user.user_role} color={getRoleColor(user.user_role)} size="small" />
                    </TableCell>
                    <TableCell>{user.client_name || '-'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={user.is_active ? 'Active' : 'Inactive'} 
                        color={user.is_active ? 'success' : 'default'} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap>
                        {formatDate(user.last_login)}
                      </Typography>
                    </TableCell>
                    <TableCell>{user.timezone}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Edit User">
                          <IconButton size="small" color="primary" onClick={() => handleOpenDialog(user)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reset Password">
                          <IconButton size="small" color="warning" onClick={() => handleOpenPasswordDialog(user)}>
                            <ResetPasswordIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete User">
                          <IconButton size="small" color="error" onClick={() => handleDeleteUser(user.userid)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add/Edit User Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Email"
              type="email"
              fullWidth
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            {!editingUser && (
              <TextField
                label="Password"
                type="password"
                fullWidth
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                helperText="Minimum 6 characters"
              />
            )}
            <TextField
              label="First Name"
              fullWidth
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            />
            <TextField
              label="Last Name"
              fullWidth
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            />
            <TextField
              select
              label="Role"
              fullWidth
              required
              value={formData.user_role}
              onChange={(e) => setFormData({ ...formData, user_role: e.target.value })}
            >
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="client">Client</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="superadmin">Super Admin</MenuItem>
            </TextField>
            <TextField
              select
              label="Client"
              fullWidth
              value={formData.client_id}
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              helperText="Optional - assign user to a client"
            >
              <MenuItem value="">None</MenuItem>
              {clients.map((client) => (
                <MenuItem key={client.client_id} value={client.client_id}>
                  {client.client_name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Timezone"
              fullWidth
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
              }
              label="Active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingUser ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={openPasswordDialog} onClose={handleClosePasswordDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Reset Password</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Reset password for: <strong>{resetPasswordUser?.email}</strong>
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="New Password"
              type="password"
              fullWidth
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              helperText="Minimum 6 characters"
            />
            <TextField
              label="Confirm Password"
              type="password"
              fullWidth
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePasswordDialog}>Cancel</Button>
          <Button onClick={handleResetPassword} variant="contained" color="warning">
            Reset Password
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default UserManagement;
