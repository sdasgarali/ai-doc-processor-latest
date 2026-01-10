import React, { useState, useEffect, useCallback } from 'react';
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
  Alert,
  CircularProgress,
  Tooltip,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Tab,
  Tabs,
  Checkbox,
  ListItemIcon,
  OutlinedInput
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
  ExpandMore as ExpandMoreIcon,
  DragIndicator as DragIcon,
  Settings as SettingsIcon,
  ViewList as FieldsIcon
} from '@mui/icons-material';
import axios from 'axios';

const API_BASE = '/api';

const OutputProfileManagement = () => {
  const [profiles, setProfiles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [openDialog, setOpenDialog] = useState(false);
  const [openFieldsDialog, setOpenFieldsDialog] = useState(false);
  const [openCopyDialog, setOpenCopyDialog] = useState(false);
  const [openEditFieldDialog, setOpenEditFieldDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [profileFields, setProfileFields] = useState([]);
  const [availableFields, setAvailableFields] = useState([]);
  const [dialogTab, setDialogTab] = useState(0);

  const [fieldFormData, setFieldFormData] = useState({
    custom_label: '',
    is_required: false,
    is_included: true,
    default_value: '',
    transform_type: 'none',
    transform_config: {}
  });

  const [openNewFieldDialog, setOpenNewFieldDialog] = useState(false);
  const [newFieldData, setNewFieldData] = useState({
    field_name: '',
    field_display_name: '',
    field_type: 'string',
    is_required: false,
    description: ''
  });

  const [filters, setFilters] = useState({
    category_id: '',
    client_id: '',
    is_default: ''
  });

  const [formData, setFormData] = useState({
    profile_name: '',
    client_id: '',
    doc_category_id: '',
    is_default: false,
    output_formats: ['csv'],
    csv_delimiter: ',',
    csv_quote_char: '"',
    include_header: true,
    date_format: 'YYYY-MM-DD',
    number_format: '0.00',
    currency_symbol: '$',
    null_value: '',
    description: '',
    extraction_prompt: ''
  });

  const [copyData, setCopyData] = useState({
    source_profile_id: '',
    target_client_id: '',
    profile_name: ''
  });

  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filters.category_id) params.append('category_id', filters.category_id);
      if (filters.client_id) params.append('client_id', filters.client_id);
      if (filters.is_default !== '') params.append('is_default', filters.is_default);

      const response = await axios.get(`${API_BASE}/output-profiles?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfiles(response.data.data || []);
      setError('');
    } catch (err) {
      console.error('Error fetching profiles:', err);
      setError('Failed to load output profiles');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/admin/categories`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCategories(response.data.data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchClients = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Fetching clients with token:', token ? 'present' : 'missing');
      // Only fetch active clients for dropdown
      const response = await axios.get(`${API_BASE}/admin/clients?status=active`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Clients response:', response.data);
      const clientsData = response.data.data || response.data || [];
      console.log('Setting clients:', clientsData.length, 'items');
      setClients(clientsData);
    } catch (err) {
      console.error('Error fetching clients:', err);
      console.error('Error response:', err.response?.data);
    }
  };

  const fetchProfileFields = async (profileId) => {
    try {
      const token = localStorage.getItem('token');
      const [profileResponse, availableResponse] = await Promise.all([
        axios.get(`${API_BASE}/output-profiles/${profileId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE}/output-profiles/${profileId}/available-fields`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setProfileFields(profileResponse.data.data?.fields || []);
      setAvailableFields(availableResponse.data.data || []);
      setSelectedProfile(profileResponse.data.data);
    } catch (err) {
      console.error('Error fetching profile fields:', err);
      setError('Failed to load profile fields');
    }
  };

  useEffect(() => {
    fetchProfiles();
    fetchCategories();
    fetchClients();
  }, [fetchProfiles]);

  const handleOpenDialog = (profile = null) => {
    if (profile) {
      setEditingProfile(profile);
      // Parse output_formats - support both old single format and new multiple formats
      let formats = ['csv'];
      if (profile.output_formats) {
        formats = Array.isArray(profile.output_formats)
          ? profile.output_formats
          : profile.output_formats.split(',').map(f => f.trim());
      } else if (profile.output_format) {
        formats = [profile.output_format];
      }
      setFormData({
        profile_name: profile.profile_name,
        client_id: profile.client_id || '',
        doc_category_id: profile.doc_category_id,
        is_default: profile.is_default,
        output_formats: formats,
        csv_delimiter: profile.csv_delimiter || ',',
        csv_quote_char: profile.csv_quote_char || '"',
        include_header: profile.include_header !== false,
        date_format: profile.date_format || 'YYYY-MM-DD',
        number_format: profile.number_format || '0.00',
        currency_symbol: profile.currency_symbol || '$',
        null_value: profile.null_value || '',
        description: profile.description || '',
        extraction_prompt: profile.extraction_prompt || ''
      });
    } else {
      setEditingProfile(null);
      setFormData({
        profile_name: '',
        client_id: '',
        doc_category_id: '',
        is_default: false,
        output_formats: ['csv'],
        csv_delimiter: ',',
        csv_quote_char: '"',
        include_header: true,
        date_format: 'YYYY-MM-DD',
        number_format: '0.00',
        currency_symbol: '$',
        null_value: '',
        description: '',
        extraction_prompt: ''
      });
    }
    setDialogTab(0);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingProfile(null);
  };

  const handleOpenFieldsDialog = async (profile) => {
    setSelectedProfile(profile);
    await fetchProfileFields(profile.profile_id);
    setOpenFieldsDialog(true);
  };

  const handleCloseFieldsDialog = () => {
    setOpenFieldsDialog(false);
    setSelectedProfile(null);
    setProfileFields([]);
    setAvailableFields([]);
  };

  const handleOpenCopyDialog = (profile) => {
    setCopyData({
      source_profile_id: profile.profile_id,
      target_client_id: '',
      profile_name: `${profile.profile_name} - Copy`
    });
    setOpenCopyDialog(true);
  };

  const handleCloseCopyDialog = () => {
    setOpenCopyDialog(false);
    setCopyData({
      source_profile_id: '',
      target_client_id: '',
      profile_name: ''
    });
  };

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem('token');
      const submitData = {
        ...formData,
        client_id: formData.client_id || null
      };

      if (editingProfile) {
        await axios.put(
          `${API_BASE}/output-profiles/${editingProfile.profile_id}`,
          submitData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess('Output profile updated successfully!');
      } else {
        await axios.post(
          `${API_BASE}/output-profiles`,
          submitData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess('Output profile created successfully!');
      }

      handleCloseDialog();
      fetchProfiles();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving profile:', err);
      setError(err.response?.data?.message || 'Failed to save output profile');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleCopyProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE}/output-profiles/copy`,
        copyData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess('Profile copied successfully!');
      handleCloseCopyDialog();
      fetchProfiles();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error copying profile:', err);
      setError(err.response?.data?.message || 'Failed to copy profile');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDeleteProfile = async (id) => {
    if (!window.confirm('Are you sure you want to delete this output profile?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE}/output-profiles/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess('Output profile deleted successfully!');
      fetchProfiles();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting profile:', err);
      setError(err.response?.data?.message || 'Failed to delete output profile');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleAddField = async (fieldId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE}/output-profiles/${selectedProfile.profile_id}/fields`,
        { field_id: fieldId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchProfileFields(selectedProfile.profile_id);
      setSuccess('Field added successfully!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Error adding field:', err);
      setError(err.response?.data?.message || 'Failed to add field');
      setTimeout(() => setError(''), 2000);
    }
  };

  const handleRemoveField = async (fieldId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API_BASE}/output-profiles/${selectedProfile.profile_id}/fields/${fieldId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchProfileFields(selectedProfile.profile_id);
      setSuccess('Field removed successfully!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Error removing field:', err);
      setError(err.response?.data?.message || 'Failed to remove field');
      setTimeout(() => setError(''), 2000);
    }
  };

  const handleOpenEditField = (field) => {
    setEditingField(field);
    setFieldFormData({
      custom_label: field.custom_label || '',
      is_required: field.is_required || false,
      is_included: field.is_included !== false,
      default_value: field.default_value || '',
      transform_type: field.transform_type || 'none',
      transform_config: field.transform_config ?
        (typeof field.transform_config === 'string' ? JSON.parse(field.transform_config) : field.transform_config)
        : {}
    });
    setOpenEditFieldDialog(true);
  };

  const handleCloseEditField = () => {
    setOpenEditFieldDialog(false);
    setEditingField(null);
    setFieldFormData({
      custom_label: '',
      is_required: false,
      is_included: true,
      default_value: '',
      transform_type: 'none',
      transform_config: {}
    });
  };

  const handleUpdateField = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE}/output-profiles/${selectedProfile.profile_id}/fields/${editingField.field_id}`,
        fieldFormData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchProfileFields(selectedProfile.profile_id);
      handleCloseEditField();
      setSuccess('Field updated successfully!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Error updating field:', err);
      setError(err.response?.data?.message || 'Failed to update field');
      setTimeout(() => setError(''), 2000);
    }
  };

  const handleOpenNewFieldDialog = () => {
    setNewFieldData({
      field_name: '',
      field_display_name: '',
      field_type: 'string',
      is_required: false,
      description: ''
    });
    setOpenNewFieldDialog(true);
  };

  const handleCloseNewFieldDialog = () => {
    setOpenNewFieldDialog(false);
    setNewFieldData({
      field_name: '',
      field_display_name: '',
      field_type: 'string',
      is_required: false,
      description: ''
    });
  };

  const handleCreateNewField = async () => {
    try {
      const token = localStorage.getItem('token');

      // Create the field in field_table
      const fieldResponse = await axios.post(
        `${API_BASE}/admin/fields`,
        {
          ...newFieldData,
          doc_category: selectedProfile.doc_category_id
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const newFieldId = fieldResponse.data.field_id || fieldResponse.data.data?.field_id;

      // Add field to the profile
      if (newFieldId) {
        await axios.post(
          `${API_BASE}/output-profiles/${selectedProfile.profile_id}/fields`,
          { field_id: newFieldId },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      // Refresh fields
      await fetchProfileFields(selectedProfile.profile_id);
      handleCloseNewFieldDialog();
      setSuccess('New field created and added to profile!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error creating field:', err);
      setError(err.response?.data?.message || 'Failed to create field');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleUpdateFieldOrder = async (newFields) => {
    try {
      const token = localStorage.getItem('token');
      const fieldsData = newFields.map((f, index) => ({
        field_id: f.field_id,
        custom_label: f.custom_label,
        field_order: index + 1,
        is_included: f.is_included,
        is_required: f.is_required,
        default_value: f.default_value,
        transform_type: f.transform_type,
        transform_config: f.transform_config
      }));

      await axios.put(
        `${API_BASE}/output-profiles/${selectedProfile.profile_id}/fields`,
        { fields: fieldsData },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProfileFields(newFields);
      setSuccess('Field order updated!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Error updating field order:', err);
      setError('Failed to update field order');
      setTimeout(() => setError(''), 2000);
    }
  };

  const moveField = (index, direction) => {
    const newFields = [...profileFields];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= newFields.length) return;

    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    handleUpdateFieldOrder(newFields);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h6">Output Profile Management</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Configure output formats and field mappings for different clients and categories
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchProfiles}>
            Refresh
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Add Profile
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={filters.category_id}
            label="Category"
            onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}
          >
            <MenuItem value="">All Categories</MenuItem>
            {categories.map(cat => (
              <MenuItem key={cat.category_id} value={cat.category_id}>
                {cat.category_display_name || cat.category_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Client</InputLabel>
          <Select
            value={filters.client_id}
            label="Client"
            onChange={(e) => setFilters({ ...filters, client_id: e.target.value })}
          >
            <MenuItem value="">All Clients</MenuItem>
            <MenuItem value="default">Default Only</MenuItem>
            {clients.map(client => (
              <MenuItem key={client.client_id} value={client.client_id}>
                {client.client_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={filters.is_default}
            label="Type"
            onChange={(e) => setFilters({ ...filters, is_default: e.target.value })}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="true">Default</MenuItem>
            <MenuItem value="false">Custom</MenuItem>
          </Select>
        </FormControl>
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
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Profile Name</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Category</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Client</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Format</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {profiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">No output profiles found</TableCell>
                </TableRow>
              ) : (
                profiles.map((profile) => (
                  <TableRow key={profile.profile_id} hover>
                    <TableCell>
                      <Typography variant="body1" fontWeight="bold">
                        {profile.profile_name}
                      </Typography>
                      {profile.description && (
                        <Typography variant="caption" color="text.secondary">
                          {profile.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={profile.category_display_name || profile.category_name}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {profile.is_default ? (
                        <Chip label="DEFAULT" size="small" color="success" />
                      ) : (
                        <Typography variant="body2">{profile.client_name || 'N/A'}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(profile.output_formats
                          ? (Array.isArray(profile.output_formats)
                              ? profile.output_formats
                              : profile.output_formats.split(',').map(f => f.trim()))
                          : [profile.output_format || 'csv']
                        ).map((format) => (
                          <Chip key={format} label={format?.toUpperCase()} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={profile.is_active ? 'Active' : 'Inactive'}
                        size="small"
                        color={profile.is_active ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Manage Fields">
                          <IconButton size="small" color="info" onClick={() => handleOpenFieldsDialog(profile)}>
                            <FieldsIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Profile">
                          <IconButton size="small" color="primary" onClick={() => handleOpenDialog(profile)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {profile.is_default ? (
                          <Tooltip title="Copy to Client">
                            <IconButton size="small" color="secondary" onClick={() => handleOpenCopyDialog(profile)}>
                              <CopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Delete Profile">
                            <IconButton size="small" color="error" onClick={() => handleDeleteProfile(profile.profile_id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add/Edit Profile Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingProfile ? 'Edit Output Profile' : 'Create Output Profile'}</DialogTitle>
        <DialogContent>
          <Tabs value={dialogTab} onChange={(e, v) => setDialogTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tab label="Basic Info" />
            <Tab label="Format Settings" />
            <Tab label="Extraction Settings" />
          </Tabs>

          {dialogTab === 0 && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  label="Profile Name"
                  fullWidth
                  required
                  value={formData.profile_name}
                  onChange={(e) => setFormData({ ...formData, profile_name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Document Category</InputLabel>
                  <Select
                    value={formData.doc_category_id}
                    label="Document Category"
                    onChange={(e) => setFormData({ ...formData, doc_category_id: e.target.value })}
                    disabled={editingProfile}
                  >
                    {categories.map(cat => (
                      <MenuItem key={cat.category_id} value={cat.category_id}>
                        {cat.category_display_name || cat.category_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Client (Leave empty for Default)</InputLabel>
                  <Select
                    value={formData.client_id}
                    label="Client (Leave empty for Default)"
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value, is_default: !e.target.value })}
                    disabled={editingProfile}
                  >
                    <MenuItem value="">Default Profile</MenuItem>
                    {clients.map(client => (
                      <MenuItem key={client.client_id} value={client.client_id}>
                        {client.client_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Description"
                  fullWidth
                  multiline
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </Grid>
            </Grid>
          )}

          {dialogTab === 1 && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Output Formats</InputLabel>
                  <Select
                    multiple
                    value={formData.output_formats}
                    label="Output Formats"
                    onChange={(e) => setFormData({ ...formData, output_formats: e.target.value })}
                    input={<OutlinedInput label="Output Formats" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value.toUpperCase()} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {[
                      { value: 'csv', label: 'CSV (.csv)' },
                      { value: 'json', label: 'JSON (.json)' },
                      { value: 'xlsx', label: 'Excel (.xlsx)' },
                      { value: 'xml', label: 'XML (.xml)' },
                      { value: 'pdf', label: 'PDF (.pdf)' },
                      { value: 'docx', label: 'Word (.docx)' },
                      { value: 'txt', label: 'Text (.txt)' }
                    ].map((format) => (
                      <MenuItem key={format.value} value={format.value}>
                        <Checkbox checked={formData.output_formats.indexOf(format.value) > -1} />
                        <ListItemText primary={format.label} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.include_header}
                      onChange={(e) => setFormData({ ...formData, include_header: e.target.checked })}
                    />
                  }
                  label="Include Header Row"
                />
              </Grid>
              {formData.output_formats.includes('csv') && (
                <>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="CSV Delimiter"
                      fullWidth
                      value={formData.csv_delimiter}
                      onChange={(e) => setFormData({ ...formData, csv_delimiter: e.target.value })}
                      helperText="e.g., comma (,) or tab or semicolon (;)"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Quote Character"
                      fullWidth
                      value={formData.csv_quote_char}
                      onChange={(e) => setFormData({ ...formData, csv_quote_char: e.target.value })}
                    />
                  </Grid>
                </>
              )}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Date Format"
                  fullWidth
                  value={formData.date_format}
                  onChange={(e) => setFormData({ ...formData, date_format: e.target.value })}
                  helperText="e.g., YYYY-MM-DD, MM/DD/YYYY"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Number Format"
                  fullWidth
                  value={formData.number_format}
                  onChange={(e) => setFormData({ ...formData, number_format: e.target.value })}
                  helperText="e.g., 0.00, 0,0.00"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Currency Symbol"
                  fullWidth
                  value={formData.currency_symbol}
                  onChange={(e) => setFormData({ ...formData, currency_symbol: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Null Value Representation"
                  fullWidth
                  value={formData.null_value}
                  onChange={(e) => setFormData({ ...formData, null_value: e.target.value })}
                  helperText="What to show for empty values"
                />
              </Grid>
            </Grid>
          )}

          {dialogTab === 2 && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Custom extraction prompt overrides the default prompt for this profile's document category.
                  Leave empty to use the system default.
                </Alert>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Custom Extraction Prompt"
                  fullWidth
                  multiline
                  rows={12}
                  value={formData.extraction_prompt}
                  onChange={(e) => setFormData({ ...formData, extraction_prompt: e.target.value })}
                  placeholder="Enter custom extraction prompt for AI processing...

Example: Extract the following fields from the EOB document:
- Patient Name
- Date of Service
- Claim Number
- Billed Amount
- Allowed Amount
- Paid Amount
..."
                  helperText="Custom prompt for data extraction (leave empty for default)"
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!formData.profile_name || !formData.doc_category_id}
          >
            {editingProfile ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manage Fields Dialog */}
      <Dialog open={openFieldsDialog} onClose={handleCloseFieldsDialog} maxWidth="lg" fullWidth>
        <DialogTitle>
          Manage Fields - {selectedProfile?.profile_name}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            {/* Current Fields */}
            <Grid item xs={12} md={7}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                Included Fields (drag to reorder)
              </Typography>
              <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
                <List dense>
                  {profileFields.length === 0 ? (
                    <ListItem>
                      <ListItemText primary="No fields configured" secondary="Add fields from the available list" />
                    </ListItem>
                  ) : (
                    profileFields.map((field, index) => (
                      <React.Fragment key={field.field_id}>
                        <ListItem>
                          <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                            <IconButton
                              size="small"
                              disabled={index === 0}
                              onClick={() => moveField(index, -1)}
                            >
                              <Typography variant="caption">↑</Typography>
                            </IconButton>
                            <IconButton
                              size="small"
                              disabled={index === profileFields.length - 1}
                              onClick={() => moveField(index, 1)}
                            >
                              <Typography variant="caption">↓</Typography>
                            </IconButton>
                          </Box>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" fontWeight="bold">
                                  {index + 1}. {field.custom_label || field.field_display_name}
                                </Typography>
                                {field.is_required && <Chip label="Required" size="small" color="error" />}
                              </Box>
                            }
                            secondary={
                              <Typography variant="caption" color="text.secondary">
                                {field.field_name} ({field.field_type})
                              </Typography>
                            }
                          />
                          <ListItemSecondaryAction>
                            <Tooltip title="Edit Field">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleOpenEditField(field)}
                                sx={{ mr: 0.5 }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Remove Field">
                              <IconButton
                                edge="end"
                                size="small"
                                color="error"
                                onClick={() => handleRemoveField(field.field_id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </ListItemSecondaryAction>
                        </ListItem>
                        {index < profileFields.length - 1 && <Divider />}
                      </React.Fragment>
                    ))
                  )}
                </List>
              </Paper>
            </Grid>

            {/* Available Fields */}
            <Grid item xs={12} md={5}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Available Fields
                </Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleOpenNewFieldDialog}
                  variant="outlined"
                >
                  Create New Field
                </Button>
              </Box>
              <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
                <List dense>
                  {availableFields.length === 0 ? (
                    <ListItem>
                      <ListItemText primary="All fields are included" secondary="Click 'Create New Field' to add more" />
                    </ListItem>
                  ) : (
                    availableFields.map((field, index) => (
                      <React.Fragment key={field.field_id}>
                        <ListItem>
                          <ListItemText
                            primary={field.field_display_name}
                            secondary={`${field.field_name} (${field.field_type})`}
                          />
                          <ListItemSecondaryAction>
                            <IconButton
                              edge="end"
                              size="small"
                              color="primary"
                              onClick={() => handleAddField(field.field_id)}
                            >
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                        {index < availableFields.length - 1 && <Divider />}
                      </React.Fragment>
                    ))
                  )}
                </List>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFieldsDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Copy Profile Dialog */}
      <Dialog open={openCopyDialog} onClose={handleCloseCopyDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Copy Profile to Client</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <FormControl fullWidth required>
              <InputLabel>Target Client</InputLabel>
              <Select
                value={copyData.target_client_id}
                label="Target Client"
                onChange={(e) => setCopyData({ ...copyData, target_client_id: e.target.value })}
              >
                {clients.map(client => (
                  <MenuItem key={client.client_id} value={client.client_id}>
                    {client.client_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="New Profile Name"
              fullWidth
              value={copyData.profile_name}
              onChange={(e) => setCopyData({ ...copyData, profile_name: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCopyDialog}>Cancel</Button>
          <Button
            onClick={handleCopyProfile}
            variant="contained"
            disabled={!copyData.target_client_id}
          >
            Copy Profile
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Field Dialog */}
      <Dialog open={openEditFieldDialog} onClose={handleCloseEditField} maxWidth="sm" fullWidth>
        <DialogTitle>
          Edit Field - {editingField?.field_display_name || editingField?.field_name}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="Custom Label"
                fullWidth
                value={fieldFormData.custom_label}
                onChange={(e) => setFieldFormData({ ...fieldFormData, custom_label: e.target.value })}
                helperText="Leave empty to use default field name"
                placeholder={editingField?.field_display_name}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={fieldFormData.is_required}
                    onChange={(e) => setFieldFormData({ ...fieldFormData, is_required: e.target.checked })}
                  />
                }
                label="Required Field"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={fieldFormData.is_included}
                    onChange={(e) => setFieldFormData({ ...fieldFormData, is_included: e.target.checked })}
                  />
                }
                label="Include in Output"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Default Value"
                fullWidth
                value={fieldFormData.default_value}
                onChange={(e) => setFieldFormData({ ...fieldFormData, default_value: e.target.value })}
                helperText="Value to use when field is empty"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Transform Type</InputLabel>
                <Select
                  value={fieldFormData.transform_type}
                  label="Transform Type"
                  onChange={(e) => setFieldFormData({ ...fieldFormData, transform_type: e.target.value })}
                >
                  <MenuItem value="none">None</MenuItem>
                  <MenuItem value="uppercase">Uppercase</MenuItem>
                  <MenuItem value="lowercase">Lowercase</MenuItem>
                  <MenuItem value="titlecase">Title Case</MenuItem>
                  <MenuItem value="date_format">Date Format</MenuItem>
                  <MenuItem value="number_format">Number Format</MenuItem>
                  <MenuItem value="currency">Currency</MenuItem>
                  <MenuItem value="prefix">Add Prefix</MenuItem>
                  <MenuItem value="suffix">Add Suffix</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {fieldFormData.transform_type === 'date_format' && (
              <Grid item xs={12}>
                <TextField
                  label="Date Format Pattern"
                  fullWidth
                  value={fieldFormData.transform_config?.format || ''}
                  onChange={(e) => setFieldFormData({
                    ...fieldFormData,
                    transform_config: { ...fieldFormData.transform_config, format: e.target.value }
                  })}
                  helperText="e.g., YYYY-MM-DD, MM/DD/YYYY"
                />
              </Grid>
            )}
            {fieldFormData.transform_type === 'prefix' && (
              <Grid item xs={12}>
                <TextField
                  label="Prefix Text"
                  fullWidth
                  value={fieldFormData.transform_config?.prefix || ''}
                  onChange={(e) => setFieldFormData({
                    ...fieldFormData,
                    transform_config: { ...fieldFormData.transform_config, prefix: e.target.value }
                  })}
                />
              </Grid>
            )}
            {fieldFormData.transform_type === 'suffix' && (
              <Grid item xs={12}>
                <TextField
                  label="Suffix Text"
                  fullWidth
                  value={fieldFormData.transform_config?.suffix || ''}
                  onChange={(e) => setFieldFormData({
                    ...fieldFormData,
                    transform_config: { ...fieldFormData.transform_config, suffix: e.target.value }
                  })}
                />
              </Grid>
            )}
            {fieldFormData.transform_type === 'currency' && (
              <>
                <Grid item xs={6}>
                  <TextField
                    label="Currency Symbol"
                    fullWidth
                    value={fieldFormData.transform_config?.symbol || '$'}
                    onChange={(e) => setFieldFormData({
                      ...fieldFormData,
                      transform_config: { ...fieldFormData.transform_config, symbol: e.target.value }
                    })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Decimal Places"
                    fullWidth
                    type="number"
                    value={fieldFormData.transform_config?.decimals || 2}
                    onChange={(e) => setFieldFormData({
                      ...fieldFormData,
                      transform_config: { ...fieldFormData.transform_config, decimals: parseInt(e.target.value) }
                    })}
                  />
                </Grid>
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditField}>Cancel</Button>
          <Button onClick={handleUpdateField} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create New Field Dialog */}
      <Dialog open={openNewFieldDialog} onClose={handleCloseNewFieldDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Field for {selectedProfile?.category_name}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="Field Name (snake_case)"
                fullWidth
                required
                value={newFieldData.field_name}
                onChange={(e) => setNewFieldData({
                  ...newFieldData,
                  field_name: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
                })}
                helperText="Internal field identifier (e.g., patient_name, claim_id)"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Display Name"
                fullWidth
                required
                value={newFieldData.field_display_name}
                onChange={(e) => setNewFieldData({ ...newFieldData, field_display_name: e.target.value })}
                helperText="Human-readable name shown in outputs"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Field Type</InputLabel>
                <Select
                  value={newFieldData.field_type}
                  label="Field Type"
                  onChange={(e) => setNewFieldData({ ...newFieldData, field_type: e.target.value })}
                >
                  <MenuItem value="string">String (Text)</MenuItem>
                  <MenuItem value="number">Number</MenuItem>
                  <MenuItem value="date">Date</MenuItem>
                  <MenuItem value="boolean">Boolean (Yes/No)</MenuItem>
                  <MenuItem value="currency">Currency</MenuItem>
                  <MenuItem value="array">Array (List)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={newFieldData.is_required}
                    onChange={(e) => setNewFieldData({ ...newFieldData, is_required: e.target.checked })}
                  />
                }
                label="Required Field"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={2}
                value={newFieldData.description}
                onChange={(e) => setNewFieldData({ ...newFieldData, description: e.target.value })}
                helperText="Brief description of what this field captures"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseNewFieldDialog}>Cancel</Button>
          <Button
            onClick={handleCreateNewField}
            variant="contained"
            disabled={!newFieldData.field_name || !newFieldData.field_display_name}
          >
            Create & Add to Profile
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default OutputProfileManagement;
