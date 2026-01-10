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
  Alert,
  CircularProgress,
  Tooltip,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Stepper,
  Step,
  StepLabel,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Divider,
  Card,
  CardContent,
  LinearProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  CloudUpload as UploadIcon,
  AutoAwesome as AIIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Visibility as ViewIcon,
  PlayArrow as AnalyzeIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon
} from '@mui/icons-material';
import axios from 'axios';

const API_BASE = '/api';

const CategoryCreationManagement = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [openWizard, setOpenWizard] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const [formData, setFormData] = useState({
    category_name: '',
    category_description: '',
    expected_fields: '',
    expected_output_format: 'csv',
    sample_file: null
  });

  const [suggestedFields, setSuggestedFields] = useState([]);
  const [selectedFields, setSelectedFields] = useState([]);
  const [reviewNotes, setReviewNotes] = useState('');
  const [categoryDisplayName, setCategoryDisplayName] = useState('');

  const steps = ['Basic Info', 'Upload Sample', 'AI Analysis', 'Review Fields'];

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);

      const response = await axios.get(`${API_BASE}/category-creation/requests?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(response.data.data || []);
      setError('');
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError('Failed to load category creation requests');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenWizard = () => {
    setFormData({
      category_name: '',
      category_description: '',
      expected_fields: '',
      expected_output_format: 'csv',
      sample_file: null
    });
    setSuggestedFields([]);
    setSelectedFields([]);
    setActiveStep(0);
    setOpenWizard(true);
  };

  const handleCloseWizard = () => {
    setOpenWizard(false);
    setActiveStep(0);
    setSuggestedFields([]);
    setSelectedFields([]);
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFormData({ ...formData, sample_file: file });
    }
  };

  const handleSubmitRequest = async () => {
    try {
      const token = localStorage.getItem('token');
      const submitData = new FormData();
      submitData.append('category_name', formData.category_name);
      submitData.append('category_description', formData.category_description);
      submitData.append('expected_fields', formData.expected_fields);
      submitData.append('expected_output_format', formData.expected_output_format);
      if (formData.sample_file) {
        submitData.append('sample_file', formData.sample_file);
      }

      const response = await axios.post(`${API_BASE}/category-creation/request`, submitData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setSuccess('Category creation request submitted successfully!');
      setSelectedRequest({ request_id: response.data.request_id });
      setActiveStep(2); // Move to analysis step
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error submitting request:', err);
      setError(err.response?.data?.message || 'Failed to submit request');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleAnalyze = async (requestId) => {
    try {
      setAnalyzing(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE}/category-creation/request/${requestId}/analyze`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuggestedFields(response.data.data?.suggestedFields || []);
      setSelectedFields(response.data.data?.suggestedFields || []);
      setSuccess('AI analysis completed!');
      setActiveStep(3); // Move to review step
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error analyzing document:', err);
      setError(err.response?.data?.message || 'Failed to analyze document');
      setTimeout(() => setError(''), 3000);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApprove = async (requestId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE}/category-creation/request/${requestId}/approve`,
        {
          final_fields: selectedFields,
          review_notes: reviewNotes,
          category_display_name: categoryDisplayName || formData.category_name
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess('Category created successfully!');
      handleCloseWizard();
      fetchRequests();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error approving request:', err);
      setError(err.response?.data?.message || 'Failed to approve request');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleReject = async (requestId) => {
    if (!window.confirm('Are you sure you want to reject this request?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE}/category-creation/request/${requestId}/reject`,
        { review_notes: reviewNotes || 'Request rejected' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess('Request rejected');
      handleCloseWizard();
      fetchRequests();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error rejecting request:', err);
      setError(err.response?.data?.message || 'Failed to reject request');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleViewRequest = async (request) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/category-creation/request/${request.request_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSelectedRequest(response.data.data);
      setSuggestedFields(response.data.data?.ai_suggested_fields || response.data.data?.suggested_fields || []);
      setSelectedFields(response.data.data?.ai_suggested_fields || response.data.data?.suggested_fields || []);
      setCategoryDisplayName(response.data.data?.category_name);
      setOpenViewDialog(true);
    } catch (err) {
      console.error('Error fetching request:', err);
      setError('Failed to load request details');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleCloseViewDialog = () => {
    setOpenViewDialog(false);
    setSelectedRequest(null);
    setSuggestedFields([]);
    setSelectedFields([]);
  };

  const toggleFieldSelection = (field) => {
    const isSelected = selectedFields.find(f => f.field_name === field.field_name);
    if (isSelected) {
      setSelectedFields(selectedFields.filter(f => f.field_name !== field.field_name));
    } else {
      setSelectedFields([...selectedFields, field]);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'processing': return 'info';
      case 'review': return 'primary';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Category Name"
                fullWidth
                required
                value={formData.category_name}
                onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
                helperText="e.g., Medical Invoice, Insurance Claim, Lab Report"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                fullWidth
                required
                multiline
                rows={3}
                value={formData.category_description}
                onChange={(e) => setFormData({ ...formData, category_description: e.target.value })}
                helperText="Describe the document type and what data should be extracted"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Expected Fields (comma-separated)"
                fullWidth
                value={formData.expected_fields}
                onChange={(e) => setFormData({ ...formData, expected_fields: e.target.value })}
                helperText="Optional: e.g., patient_name, date_of_service, total_amount"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Output Format</InputLabel>
                <Select
                  value={formData.expected_output_format}
                  label="Output Format"
                  onChange={(e) => setFormData({ ...formData, expected_output_format: e.target.value })}
                >
                  <MenuItem value="csv">CSV</MenuItem>
                  <MenuItem value="json">JSON</MenuItem>
                  <MenuItem value="excel">Excel</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        );

      case 1:
        return (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <input
              accept=".pdf,.png,.jpg,.jpeg,.tiff"
              style={{ display: 'none' }}
              id="sample-file-upload"
              type="file"
              onChange={handleFileChange}
            />
            <label htmlFor="sample-file-upload">
              <Button
                variant="outlined"
                component="span"
                size="large"
                startIcon={<UploadIcon />}
                sx={{ mb: 2 }}
              >
                Upload Sample Document
              </Button>
            </label>
            {formData.sample_file && (
              <Box sx={{ mt: 2 }}>
                <Chip
                  label={formData.sample_file.name}
                  onDelete={() => setFormData({ ...formData, sample_file: null })}
                  color="primary"
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Size: {(formData.sample_file.size / 1024 / 1024).toFixed(2)} MB
                </Typography>
              </Box>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Upload a representative sample document (PDF or image).
              <br />
              This will be analyzed by AI to suggest field schema.
            </Typography>
          </Box>
        );

      case 2:
        return (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            {analyzing ? (
              <>
                <CircularProgress size={60} sx={{ mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Analyzing Document...
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  AI is analyzing your document to suggest field schema.
                  <br />
                  This may take a minute.
                </Typography>
                <LinearProgress sx={{ mt: 3, maxWidth: 400, mx: 'auto' }} />
              </>
            ) : (
              <>
                <AIIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Ready for AI Analysis
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Click the button below to start AI analysis of your sample document.
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<AnalyzeIcon />}
                  onClick={() => handleAnalyze(selectedRequest?.request_id)}
                  disabled={!selectedRequest?.request_id}
                >
                  Start AI Analysis
                </Button>
              </>
            )}
          </Box>
        );

      case 3:
        return (
          <Box>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              Suggested Fields ({selectedFields.length} selected)
            </Typography>
            <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto', mb: 2 }}>
              <List dense>
                {suggestedFields.map((field, index) => (
                  <ListItem
                    key={field.field_name}
                    button
                    onClick={() => toggleFieldSelection(field)}
                  >
                    <ListItemIcon>
                      <Checkbox
                        checked={selectedFields.some(f => f.field_name === field.field_name)}
                        edge="start"
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight="bold">
                            {field.field_display_name || field.field_name}
                          </Typography>
                          <Chip label={field.field_type} size="small" variant="outlined" />
                          {field.is_required && <Chip label="Required" size="small" color="error" />}
                        </Box>
                      }
                      secondary={field.description}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Display Name"
                  fullWidth
                  value={categoryDisplayName}
                  onChange={(e) => setCategoryDisplayName(e.target.value)}
                  helperText="Human-readable category name"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Review Notes (Optional)"
                  fullWidth
                  multiline
                  rows={2}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </Grid>
            </Grid>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h6">AI-Powered Category Creation</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Create new document categories with AI-generated field schemas
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchRequests}>
            Refresh
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenWizard}>
            New Category
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="">All Status</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="processing">Processing</MenuItem>
            <MenuItem value="review">Review</MenuItem>
            <MenuItem value="approved">Approved</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
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
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Category Name</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Description</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Sample File</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Requested By</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Created</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">No category creation requests found</TableCell>
                </TableRow>
              ) : (
                requests.map((request) => (
                  <TableRow key={request.request_id} hover>
                    <TableCell>
                      <Typography variant="body1" fontWeight="bold">
                        {request.category_name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {request.category_description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {request.sample_original_name ? (
                        <Chip label={request.sample_original_name} size="small" variant="outlined" />
                      ) : (
                        <Typography variant="body2" color="text.secondary">None</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={request.status?.toUpperCase()}
                        size="small"
                        color={getStatusColor(request.status)}
                      />
                    </TableCell>
                    <TableCell>
                      {request.requested_by_name} {request.requested_by_lastname}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap>
                        {formatDate(request.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="View Details">
                          <IconButton size="small" color="info" onClick={() => handleViewRequest(request)}>
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {request.status === 'pending' && request.sample_original_name && (
                          <Tooltip title="Analyze with AI">
                            <IconButton size="small" color="primary" onClick={() => handleAnalyze(request.request_id)}>
                              <AIIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {request.status === 'review' && (
                          <>
                            <Tooltip title="Approve">
                              <IconButton size="small" color="success" onClick={() => handleViewRequest(request)}>
                                <ApproveIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
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

      {/* Creation Wizard Dialog */}
      <Dialog open={openWizard} onClose={handleCloseWizard} maxWidth="md" fullWidth>
        <DialogTitle>Create New Document Category</DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          {renderStepContent(activeStep)}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseWizard}>Cancel</Button>
          {activeStep > 0 && activeStep < 3 && (
            <Button onClick={() => setActiveStep(activeStep - 1)}>
              Back
            </Button>
          )}
          {activeStep === 0 && (
            <Button
              onClick={() => setActiveStep(1)}
              variant="contained"
              disabled={!formData.category_name || !formData.category_description}
            >
              Next
            </Button>
          )}
          {activeStep === 1 && (
            <Button
              onClick={handleSubmitRequest}
              variant="contained"
              disabled={!formData.sample_file}
            >
              Submit & Analyze
            </Button>
          )}
          {activeStep === 3 && (
            <>
              <Button onClick={() => handleReject(selectedRequest?.request_id)} color="error">
                Reject
              </Button>
              <Button
                onClick={() => handleApprove(selectedRequest?.request_id)}
                variant="contained"
                color="success"
                disabled={selectedFields.length === 0}
              >
                Create Category
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* View Request Dialog */}
      <Dialog open={openViewDialog} onClose={handleCloseViewDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          Category Request Details
          <Chip
            label={selectedRequest?.status?.toUpperCase()}
            size="small"
            color={getStatusColor(selectedRequest?.status)}
            sx={{ ml: 2 }}
          />
        </DialogTitle>
        <DialogContent>
          {selectedRequest && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Category Name</Typography>
                <Typography variant="body1" fontWeight="bold">{selectedRequest.category_name}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Output Format</Typography>
                <Typography variant="body1">{selectedRequest.expected_output_format?.toUpperCase()}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                <Typography variant="body1">{selectedRequest.category_description}</Typography>
              </Grid>

              {suggestedFields.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 2, mb: 1 }}>
                    {selectedRequest.status === 'review' ? 'Select Fields to Include' : 'Suggested Fields'}
                  </Typography>
                  <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
                    <List dense>
                      {suggestedFields.map((field) => (
                        <ListItem
                          key={field.field_name}
                          button={selectedRequest.status === 'review'}
                          onClick={() => selectedRequest.status === 'review' && toggleFieldSelection(field)}
                        >
                          {selectedRequest.status === 'review' && (
                            <ListItemIcon>
                              <Checkbox
                                checked={selectedFields.some(f => f.field_name === field.field_name)}
                                edge="start"
                              />
                            </ListItemIcon>
                          )}
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" fontWeight="bold">
                                  {field.field_display_name || field.field_name}
                                </Typography>
                                <Chip label={field.field_type} size="small" variant="outlined" />
                                {field.is_required && <Chip label="Required" size="small" color="error" />}
                              </Box>
                            }
                            secondary={field.description}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                </Grid>
              )}

              {selectedRequest.status === 'review' && (
                <Grid item xs={12}>
                  <TextField
                    label="Review Notes"
                    fullWidth
                    multiline
                    rows={2}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    sx={{ mt: 2 }}
                  />
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseViewDialog}>Close</Button>
          {selectedRequest?.status === 'pending' && selectedRequest?.sample_original_name && (
            <Button
              variant="contained"
              startIcon={<AIIcon />}
              onClick={() => {
                handleCloseViewDialog();
                handleAnalyze(selectedRequest.request_id);
              }}
            >
              Analyze with AI
            </Button>
          )}
          {selectedRequest?.status === 'review' && (
            <>
              <Button
                onClick={() => handleReject(selectedRequest.request_id)}
                color="error"
              >
                Reject
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={() => handleApprove(selectedRequest.request_id)}
                disabled={selectedFields.length === 0}
              >
                Approve & Create
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default CategoryCreationManagement;
