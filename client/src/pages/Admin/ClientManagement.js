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
  Alert,
  CircularProgress,
  Tooltip,
  Chip,
  InputAdornment
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Block as DeactivateIcon,
  CheckCircle as ActivateIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import axios from 'axios';

const ClientManagement = () => {
  const [clients, setClients] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [openDialog, setOpenDialog] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    client_name: '',
    contact_name: '',
    email: '',
    phone_no: '',
    date_started: '',
    end_date: '',
    status: 'active',
    active_model: ''
  });

  useEffect(() => {
    fetchClients();
    fetchModels();
  }, [filterStatus]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      let url = 'http://localhost:5000/api/admin/clients';
      
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (params.toString()) url += `?${params.toString()}`;
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClients(response.data.data || []);
      setError('');
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/admin/model-versions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setModels(response.data.data || []);
    } catch (err) {
      console.error('Error fetching models:', err);
    }
  };

  const handleOpenDialog = (client = null) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        client_name: client.client_name || '',
        contact_name: client.contact_name || '',
        email: client.email || '',
        phone_no: client.phone_no || '',
        date_started: client.date_started ? client.date_started.split('T')[0] : '',
        end_date: client.end_date ? client.end_date.split('T')[0] : '',
        status: client.status || 'active',
        active_model: client.active_model || ''
      });
    } else {
      setEditingClient(null);
      setFormData({
        client_name: '',
        contact_name: '',
        email: '',
        phone_no: '',
        date_started: '',
        end_date: '',
        status: 'active',
        active_model: ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingClient(null);
    setFormData({
      client_name: '',
      contact_name: '',
      email: '',
      phone_no: '',
      date_started: '',
      end_date: '',
      status: 'active',
      active_model: ''
    });
  };

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Validate required fields
      if (!formData.client_name) {
        setError('Client name is required');
        setTimeout(() => setError(''), 3000);
        return;
      }
      
      const payload = {
        ...formData,
        active_model: formData.active_model || null
      };
      
      if (editingClient) {
        await axios.put(
          `http://localhost:5000/api/admin/clients/${editingClient.client_id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess('Client updated successfully!');
      } else {
        await axios.post(
          'http://localhost:5000/api/admin/clients',
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess('Client created successfully!');
      }
      
      handleCloseDialog();
      fetchClients();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving client:', err);
      setError(err.response?.data?.message || 'Failed to save client');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleToggleStatus = async (client) => {
    const newStatus = client.status === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'inactive' ? 'deactivate' : 'reactivate';

    if (!window.confirm(`Are you sure you want to ${action} "${client.client_name}"? ${newStatus === 'inactive' ? 'All features will be disabled for this client.' : 'This will restore access to all features.'}`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const updateData = {
        status: newStatus
      };

      // Set end_date when deactivating, clear it when reactivating
      if (newStatus === 'inactive') {
        updateData.end_date = new Date().toISOString().split('T')[0];
      } else {
        updateData.end_date = null;
      }

      await axios.put(`http://localhost:5000/api/admin/clients/${client.client_id}`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess(`Client ${action}d successfully!`);
      fetchClients();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating client status:', err);
      setError(err.response?.data?.message || `Failed to ${action} client`);
      setTimeout(() => setError(''), 3000);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  // Filter clients based on search term
  const filteredClients = clients.filter(client =>
    client.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.contact_name && client.contact_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">Client Management</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchClients}>
            Refresh
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Add Client
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          placeholder="Search clients..."
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ flexGrow: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          select
          label="Status"
          size="small"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="inactive">Inactive</MenuItem>
        </TextField>
      </Box>

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
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Client Name</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Contact</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Email</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Start Date</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>End Date</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    {searchTerm ? 'No clients match your search' : 'No clients found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients.map((client) => (
                  <TableRow
                    key={client.client_id}
                    hover
                    sx={{
                      opacity: client.status === 'inactive' ? 0.6 : 1,
                      bgcolor: client.status === 'inactive' ? 'action.hover' : 'inherit'
                    }}
                  >
                    <TableCell>{client.client_id}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {client.client_name}
                      </Typography>
                      {client.phone_no && (
                        <Typography variant="caption" color="text.secondary">
                          {client.phone_no}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{client.contact_name || '-'}</TableCell>
                    <TableCell>{client.email || '-'}</TableCell>
                    <TableCell>{formatDate(client.date_started)}</TableCell>
                    <TableCell>
                      {client.end_date ? (
                        <Typography variant="body2" color="error">
                          {formatDate(client.end_date)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={client.status === 'active' ? 'Active' : 'Inactive'}
                        color={client.status === 'active' ? 'success' : 'error'}
                        size="small"
                        variant={client.status === 'active' ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Edit Client">
                          <IconButton size="small" color="primary" onClick={() => handleOpenDialog(client)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={client.status === 'active' ? 'Deactivate Client' : 'Reactivate Client'}>
                          <IconButton
                            size="small"
                            color={client.status === 'active' ? 'error' : 'success'}
                            onClick={() => handleToggleStatus(client)}
                          >
                            {client.status === 'active' ? <DeactivateIcon fontSize="small" /> : <ActivateIcon fontSize="small" />}
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

      {/* Add/Edit Client Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingClient ? 'Edit Client' : 'Add New Client'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Client Name"
              fullWidth
              required
              value={formData.client_name}
              onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
              helperText="Required - Company or organization name"
            />
            <TextField
              label="Contact Name"
              fullWidth
              value={formData.contact_name}
              onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
              helperText="Primary contact person"
            />
            <TextField
              label="Email"
              fullWidth
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              helperText="Contact email address"
            />
            <TextField
              label="Phone Number"
              fullWidth
              value={formData.phone_no}
              onChange={(e) => setFormData({ ...formData, phone_no: e.target.value })}
              helperText="Contact phone number"
            />
            <TextField
              label="Start Date"
              fullWidth
              type="date"
              value={formData.date_started}
              onChange={(e) => setFormData({ ...formData, date_started: e.target.value })}
              InputLabelProps={{ shrink: true }}
              helperText="When the client started using the service"
            />
            <TextField
              label="End Date"
              fullWidth
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              helperText="Leave empty for active clients"
            />
            <TextField
              select
              label="Status"
              fullWidth
              required
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              helperText="Inactive clients cannot use any features"
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
            <TextField
              select
              label="Active Model"
              fullWidth
              value={formData.active_model}
              onChange={(e) => setFormData({ ...formData, active_model: e.target.value })}
              helperText="Select the model this client uses"
            >
              <MenuItem value="">None</MenuItem>
              {models.map((model) => (
                <MenuItem key={model.id} value={model.id}>
                  {model.model_name} (v{model.version})
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={!formData.client_name}>
            {editingClient ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default ClientManagement;
