import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Grid,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip
} from '@mui/material';
import {
  Save as SaveIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import axios from 'axios';

const PricingConfig = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Document AI pricing
  const [docAiCost, setDocAiCost] = useState('0.015');

  // AI model pricing
  const [models, setModels] = useState([]);

  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [formData, setFormData] = useState({
    model_name: '',
    model_code: '',
    input_cost_per_1k: '0.000150',
    output_cost_per_1k: '0.000600',
    doc_category: 1,
    is_active: true
  });

  useEffect(() => {
    fetchPricingConfig();
  }, []);

  const fetchPricingConfig = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Fetch Document AI cost
      const docAiResponse = await axios.get(
        'http://localhost:5000/api/admin/config/docai_cost_per_page',
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (docAiResponse.data.success) {
        setDocAiCost(docAiResponse.data.data.value);
      }

      // Fetch models
      const modelsResponse = await axios.get(
        'http://localhost:5000/api/admin/models',
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (modelsResponse.data.success) {
        setModels(modelsResponse.data.data);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching pricing config:', err);
      setError('Failed to load pricing configuration');
      setLoading(false);
    }
  };

  const handleDocAiCostSave = async () => {
    try {
      setError('');
      setSuccess('');
      const token = localStorage.getItem('token');

      const response = await axios.put(
        'http://localhost:5000/api/admin/config/docai_cost_per_page',
        { value: docAiCost },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setSuccess('Document AI pricing updated successfully');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Error updating Document AI cost:', err);
      setError('Failed to update Document AI pricing');
    }
  };

  const handleOpenDialog = (model = null) => {
    if (model) {
      setEditingModel(model);
      setFormData({
        model_name: model.model_name,
        model_code: model.model_code || '',
        input_cost_per_1k: model.input_cost_per_1k,
        output_cost_per_1k: model.output_cost_per_1k,
        doc_category: model.doc_category || 1,
        is_active: model.is_active !== undefined ? model.is_active : true
      });
    } else {
      setEditingModel(null);
      setFormData({
        model_name: '',
        model_code: '',
        input_cost_per_1k: '0.000150',
        output_cost_per_1k: '0.000600',
        doc_category: 1,
        is_active: true
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingModel(null);
    setFormData({
      model_name: '',
      model_code: '',
      input_cost_per_1k: '0.000150',
      output_cost_per_1k: '0.000600',
      doc_category: 1,
      is_active: true
    });
  };

  const handleSubmit = async () => {
    try {
      setError('');
      setSuccess('');
      const token = localStorage.getItem('token');

      const payload = {
        model_name: formData.model_name,
        model_code: formData.model_code,
        input_cost_per_1k: parseFloat(formData.input_cost_per_1k),
        output_cost_per_1k: parseFloat(formData.output_cost_per_1k),
        doc_category: formData.doc_category,
        is_active: formData.is_active
      };

      if (editingModel) {
        // Update existing model
        await axios.put(
          `http://localhost:5000/api/admin/models/${editingModel.model_id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess('AI Model updated successfully');
      } else {
        // Create new model
        await axios.post(
          'http://localhost:5000/api/admin/models',
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess('AI Model created successfully');
      }

      handleCloseDialog();
      await fetchPricingConfig();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving model:', err);
      setError(err.response?.data?.message || 'Failed to save AI Model');
    }
  };

  const handleDeleteModel = async (modelId) => {
    if (!window.confirm('Are you sure you want to delete this AI model?')) {
      return;
    }

    try {
      setError('');
      setSuccess('');
      const token = localStorage.getItem('token');

      await axios.delete(
        `http://localhost:5000/api/admin/models/${modelId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess('AI Model deleted successfully');
      await fetchPricingConfig();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting model:', err);
      setError(err.response?.data?.message || 'Failed to delete AI Model');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Pricing Configuration
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* Document AI Pricing */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Document AI Pricing
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label="Cost per Page (USD)"
              type="number"
              value={docAiCost}
              onChange={(e) => setDocAiCost(e.target.value)}
              inputProps={{ step: '0.001', min: '0' }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleDocAiCostSave}
            >
              Save Document AI Cost
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* AI Model Pricing */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            AI Model Pricing (per 1K tokens)
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add AI Model
          </Button>
        </Box>
        <Divider sx={{ mb: 2 }} />

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Model Name</strong></TableCell>
                <TableCell><strong>Model Code</strong></TableCell>
                <TableCell><strong>Input Cost (USD)</strong></TableCell>
                <TableCell><strong>Output Cost (USD)</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {models.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No AI models found. Click "Add AI Model" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                models.map((model) => (
                  <TableRow key={model.model_id}>
                    <TableCell>{model.model_name}</TableCell>
                    <TableCell>{model.model_code || '-'}</TableCell>
                    <TableCell>${model.input_cost_per_1k}</TableCell>
                    <TableCell>${model.output_cost_per_1k}</TableCell>
                    <TableCell>
                      {model.is_active ? (
                        <Typography color="success.main">Active</Typography>
                      ) : (
                        <Typography color="text.secondary">Inactive</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Edit Model">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleOpenDialog(model)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Model">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteModel(model.model_id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add/Edit Model Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingModel ? 'Edit AI Model' : 'Add New AI Model'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Model Name"
              fullWidth
              required
              value={formData.model_name}
              onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
              helperText="e.g., GPT-4o, Claude 3.5 Sonnet"
            />
            <TextField
              label="Model Code"
              fullWidth
              value={formData.model_code}
              onChange={(e) => setFormData({ ...formData, model_code: e.target.value })}
              helperText="e.g., gpt-4o, claude-3-5-sonnet"
            />
            <TextField
              label="Input Cost per 1K tokens (USD)"
              fullWidth
              required
              type="number"
              value={formData.input_cost_per_1k}
              onChange={(e) => setFormData({ ...formData, input_cost_per_1k: e.target.value })}
              inputProps={{ step: '0.000001', min: '0' }}
            />
            <TextField
              label="Output Cost per 1K tokens (USD)"
              fullWidth
              required
              type="number"
              value={formData.output_cost_per_1k}
              onChange={(e) => setFormData({ ...formData, output_cost_per_1k: e.target.value })}
              inputProps={{ step: '0.000001', min: '0' }}
            />
            <TextField
              select
              label="Status"
              fullWidth
              value={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
              SelectProps={{ native: true }}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!formData.model_name || !formData.input_cost_per_1k || !formData.output_cost_per_1k}
          >
            {editingModel ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PricingConfig;
