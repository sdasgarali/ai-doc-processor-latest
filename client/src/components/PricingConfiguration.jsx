import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Button,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Grid,
  Divider
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Settings as SettingsIcon,
  AttachMoney as MoneyIcon
} from '@mui/icons-material';

const PricingConfiguration = () => {
  const [models, setModels] = useState([]);
  const [docAiCost, setDocAiCost] = useState(0.015);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editingModel, setEditingModel] = useState(null);
  const [editValues, setEditValues] = useState({ input: 0, output: 0 });
  const [editingDocAi, setEditingDocAi] = useState(false);
  const [docAiEditValue, setDocAiEditValue] = useState(0.015);

  useEffect(() => {
    fetchPricingData();
  }, []);

  const fetchPricingData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch OpenAI models
      const modelsResponse = await axios.get('/api/admin/openai-models', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      // Fetch Document AI cost
      const docAiResponse = await axios.get('/api/admin/config/docai_cost_per_page', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      setModels(modelsResponse.data.data || []);
      setDocAiCost(parseFloat(docAiResponse.data.data.value));
      setDocAiEditValue(parseFloat(docAiResponse.data.data.value));
    } catch (err) {
      console.error('Error fetching pricing data:', err);
      setError('Failed to load pricing configuration. ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleEditModel = (model) => {
    setEditingModel(model.model_id);
    setEditValues({
      input: model.input_cost_per_1k,
      output: model.output_cost_per_1k
    });
    setSuccess(null);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingModel(null);
    setEditValues({ input: 0, output: 0 });
  };

  const handleSaveModel = async (modelId) => {
    try {
      setError(null);

      await axios.put(
        `/api/admin/openai-models/${modelId}/pricing`,
        {
          input_cost_per_1k: parseFloat(editValues.input),
          output_cost_per_1k: parseFloat(editValues.output)
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      setSuccess('Model pricing updated successfully!');
      setEditingModel(null);
      fetchPricingData();
    } catch (err) {
      console.error('Error updating model pricing:', err);
      setError('Failed to update model pricing. ' + (err.response?.data?.message || err.message));
    }
  };

  const handleEditDocAi = () => {
    setEditingDocAi(true);
    setSuccess(null);
    setError(null);
  };

  const handleCancelDocAiEdit = () => {
    setEditingDocAi(false);
    setDocAiEditValue(docAiCost);
  };

  const handleSaveDocAi = async () => {
    try {
      setError(null);

      await axios.put(
        '/api/admin/config/docai_cost_per_page',
        { value: parseFloat(docAiEditValue) },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      setSuccess('Document AI cost updated successfully!');
      setEditingDocAi(false);
      setDocAiCost(parseFloat(docAiEditValue));
    } catch (err) {
      console.error('Error updating Document AI cost:', err);
      setError('Failed to update Document AI cost. ' + (err.response?.data?.message || err.message));
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 6
    }).format(value);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" alignItems="center" mb={3}>
        <SettingsIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
        <Typography variant="h4" component="h1">
          Pricing Configuration
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Document AI Pricing */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <MoneyIcon sx={{ mr: 1, color: 'success.main' }} />
            <Typography variant="h6">Document AI Pricing</Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />

          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Cost per page processed by Google Document AI
              </Typography>
              {editingDocAi ? (
                <TextField
                  label="Cost per Page (USD)"
                  type="number"
                  value={docAiEditValue}
                  onChange={(e) => setDocAiEditValue(e.target.value)}
                  inputProps={{ step: '0.001', min: '0' }}
                  fullWidth
                  size="small"
                />
              ) : (
                <Typography variant="h5" color="primary">
                  {formatCurrency(docAiCost)} per page
                </Typography>
              )}
            </Grid>
            <Grid item xs={12} md={6}>
              <Box display="flex" justifyContent="flex-end" gap={1}>
                {editingDocAi ? (
                  <>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<SaveIcon />}
                      onClick={handleSaveDocAi}
                    >
                      Save
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<CancelIcon />}
                      onClick={handleCancelDocAiEdit}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={handleEditDocAi}
                  >
                    Edit
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* OpenAI Models Pricing */}
      <Paper sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" mb={2}>
          <MoneyIcon sx={{ mr: 1, color: 'info.main' }} />
          <Typography variant="h6">OpenAI Model Pricing</Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />

        <Typography variant="body2" color="text.secondary" mb={2}>
          Configure costs per 1000 tokens for each OpenAI model. These values are used for accurate cost tracking.
        </Typography>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Model Name</strong></TableCell>
                <TableCell><strong>Model Code</strong></TableCell>
                <TableCell align="right"><strong>Input Cost (per 1k tokens)</strong></TableCell>
                <TableCell align="right"><strong>Output Cost (per 1k tokens)</strong></TableCell>
                <TableCell align="center"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {models.map((model) => (
                <TableRow key={model.model_id} hover>
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium">
                      {model.model_name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" fontFamily="monospace">
                      {model.model_code}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {editingModel === model.model_id ? (
                      <TextField
                        type="number"
                        value={editValues.input}
                        onChange={(e) => setEditValues({ ...editValues, input: e.target.value })}
                        inputProps={{ step: '0.00001', min: '0' }}
                        size="small"
                        sx={{ width: '150px' }}
                      />
                    ) : (
                      <Typography variant="body1">
                        {formatCurrency(model.input_cost_per_1k)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {editingModel === model.model_id ? (
                      <TextField
                        type="number"
                        value={editValues.output}
                        onChange={(e) => setEditValues({ ...editValues, output: e.target.value })}
                        inputProps={{ step: '0.00001', min: '0' }}
                        size="small"
                        sx={{ width: '150px' }}
                      />
                    ) : (
                      <Typography variant="body1">
                        {formatCurrency(model.output_cost_per_1k)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {editingModel === model.model_id ? (
                      <Box display="flex" justifyContent="center" gap={1}>
                        <Tooltip title="Save changes">
                          <IconButton
                            color="primary"
                            size="small"
                            onClick={() => handleSaveModel(model.model_id)}
                          >
                            <SaveIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Cancel">
                          <IconButton
                            size="small"
                            onClick={handleCancelEdit}
                          >
                            <CancelIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ) : (
                      <Tooltip title="Edit pricing">
                        <IconButton
                          color="primary"
                          size="small"
                          onClick={() => handleEditModel(model)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {models.length === 0 && (
          <Box textAlign="center" py={4}>
            <Typography color="text.secondary">
              No OpenAI models configured yet.
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Pricing Information */}
      <Box mt={3}>
        <Alert severity="info">
          <Typography variant="body2">
            <strong>Note:</strong> Pricing changes take effect immediately and will be used for all new document processing requests.
            Historical costs are not recalculated. Default model is GPT-4o-mini for cost efficiency.
          </Typography>
        </Alert>
      </Box>
    </Box>
  );
};

export default PricingConfiguration;
