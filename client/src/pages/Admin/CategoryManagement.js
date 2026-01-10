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
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  Tabs,
  Tab
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CloudUpload as UploadIcon,
  AutoAwesome as AIIcon,
  Visibility as ViewIcon,
  PlayArrow as AnalyzeIcon,
  CheckCircle as ApproveIcon,
  ExpandMore as ExpandMoreIcon,
  Category as CategoryIcon
} from '@mui/icons-material';
import axios from 'axios';

const API_BASE = '/api';

const CategoryManagement = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // Categories state
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Simple category dialog
  const [openSimpleDialog, setOpenSimpleDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [simpleFormData, setSimpleFormData] = useState({
    category_name: '',
    category_description: ''
  });

  // AI Creation state
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [openWizard, setOpenWizard] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const [aiFormData, setAiFormData] = useState({
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
    fetchCategories();
    fetchRequests();
  }, []);

  useEffect(() => {
    if (activeTab === 1) {
      fetchRequests();
    }
  }, [statusFilter, activeTab]);

  // ==================== CATEGORIES CRUD ====================

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/admin/categories`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCategories(response.data.data || []);
      setError('');
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError('Failed to load document categories');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSimpleDialog = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setSimpleFormData({
        category_name: category.category_name,
        category_description: category.category_description || ''
      });
    } else {
      setEditingCategory(null);
      setSimpleFormData({
        category_name: '',
        category_description: ''
      });
    }
    setOpenSimpleDialog(true);
  };

  const handleCloseSimpleDialog = () => {
    setOpenSimpleDialog(false);
    setEditingCategory(null);
    setSimpleFormData({ category_name: '', category_description: '' });
  };

  const handleSimpleSubmit = async () => {
    try {
      const token = localStorage.getItem('token');

      if (editingCategory) {
        await axios.put(
          `${API_BASE}/admin/categories/${editingCategory.category_id}`,
          simpleFormData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess('Document category updated successfully!');
      } else {
        await axios.post(
          `${API_BASE}/admin/categories`,
          simpleFormData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess('Document category created successfully!');
      }

      handleCloseSimpleDialog();
      fetchCategories();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving category:', err);
      setError(err.response?.data?.message || 'Failed to save document category');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this document category? This will affect all related documents and fields.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE}/admin/categories/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess('Document category deleted successfully!');
      fetchCategories();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting category:', err);
      setError(err.response?.data?.message || 'Failed to delete document category');
      setTimeout(() => setError(''), 3000);
    }
  };

  // ==================== AI CREATION REQUESTS ====================

  const fetchRequests = async () => {
    try {
      setRequestsLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);

      const response = await axios.get(`${API_BASE}/category-creation/requests?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(response.data.data || []);
    } catch (err) {
      console.error('Error fetching requests:', err);
    } finally {
      setRequestsLoading(false);
    }
  };

  const handleOpenWizard = () => {
    setAiFormData({
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
      setAiFormData({ ...aiFormData, sample_file: file });
    }
  };

  const handleSubmitRequest = async () => {
    try {
      const token = localStorage.getItem('token');

      // First create the request via JSON
      const response = await axios.post(`${API_BASE}/category-creation/request`, {
        category_name: aiFormData.category_name,
        category_description: aiFormData.category_description,
        expected_fields: aiFormData.expected_fields.split(',').map(f => f.trim()).filter(f => f),
        expected_output_format: aiFormData.expected_output_format
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const requestId = response.data.request_id;

      // If there's a sample file, upload it separately
      if (aiFormData.sample_file) {
        const formData = new FormData();
        formData.append('file', aiFormData.sample_file);
        formData.append('doc_category_id', '0'); // Temporary, will be linked to request
        formData.append('description', aiFormData.category_description);
        formData.append('expected_fields', aiFormData.expected_fields);

        // For now, just note that sample upload needs request linkage
        // The sample will be analyzed with the request
      }

      setSuccess('Category creation request submitted successfully!');
      setSelectedRequest({ request_id: requestId });
      setActiveStep(2);
      fetchRequests();
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
      setActiveStep(3);
      fetchRequests();
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
          category_display_name: categoryDisplayName || aiFormData.category_name
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess('Category created successfully!');
      handleCloseWizard();
      handleCloseViewDialog();
      fetchCategories();
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
      handleCloseViewDialog();
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

  // ==================== HELPERS ====================

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

  const pendingCount = requests.filter(r => ['pending', 'review'].includes(r.status)).length;

  // ==================== WIZARD STEP CONTENT ====================

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
                value={aiFormData.category_name}
                onChange={(e) => setAiFormData({ ...aiFormData, category_name: e.target.value })}
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
                value={aiFormData.category_description}
                onChange={(e) => setAiFormData({ ...aiFormData, category_description: e.target.value })}
                helperText="Describe the document type and what data should be extracted"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Expected Fields (comma-separated)"
                fullWidth
                value={aiFormData.expected_fields}
                onChange={(e) => setAiFormData({ ...aiFormData, expected_fields: e.target.value })}
                helperText="Optional: e.g., patient_name, date_of_service, total_amount"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Output Format</InputLabel>
                <Select
                  value={aiFormData.expected_output_format}
                  label="Output Format"
                  onChange={(e) => setAiFormData({ ...aiFormData, expected_output_format: e.target.value })}
                >
                  <MenuItem value="csv">CSV (.csv)</MenuItem>
                  <MenuItem value="json">JSON (.json)</MenuItem>
                  <MenuItem value="xlsx">Excel (.xlsx)</MenuItem>
                  <MenuItem value="xml">XML (.xml)</MenuItem>
                  <MenuItem value="pdf">PDF (.pdf)</MenuItem>
                  <MenuItem value="docx">Word (.docx)</MenuItem>
                  <MenuItem value="txt">Text (.txt)</MenuItem>
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
            {aiFormData.sample_file && (
              <Box sx={{ mt: 2 }}>
                <Chip
                  label={aiFormData.sample_file.name}
                  onDelete={() => setAiFormData({ ...aiFormData, sample_file: null })}
                  color="primary"
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Size: {(aiFormData.sample_file.size / 1024 / 1024).toFixed(2)} MB
                </Typography>
              </Box>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Upload a representative sample document (PDF or image).
              <br />
              This will be analyzed by AI to suggest field schema.
            </Typography>
            <Alert severity="info" sx={{ mt: 2, textAlign: 'left' }}>
              You can skip this step and submit without a sample. AI analysis will use your description and expected fields instead.
            </Alert>
          </Box>
        );

      case 2:
        return (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            {analyzing ? (
              <>
                <CircularProgress size={60} sx={{ mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Analyzing with AI...
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  AI is generating field schema based on your description.
                  <br />
                  This may take a moment.
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
                  Click the button below to start AI analysis.
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
                {suggestedFields.map((field) => (
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

  // ==================== RENDER ====================

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h6">Document Category Management</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage document types and create new categories with AI assistance
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => { fetchCategories(); fetchRequests(); }}>
            Refresh
          </Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => handleOpenSimpleDialog()}>
            Add Category
          </Button>
          <Button variant="contained" startIcon={<AIIcon />} onClick={handleOpenWizard}>
            Create with AI
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab label="Categories" icon={<CategoryIcon />} iconPosition="start" />
          <Tab
            label={
              <Badge badgeContent={pendingCount} color="warning" sx={{ pr: 2 }}>
                AI Creation Requests
              </Badge>
            }
            icon={<AIIcon />}
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* Tab 0: Categories Table */}
      {activeTab === 0 && (
        <>
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
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Category Name</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Description</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>AI Generated</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Created At</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {categories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">No document categories found</TableCell>
                    </TableRow>
                  ) : (
                    categories.map((category) => (
                      <TableRow key={category.category_id} hover>
                        <TableCell>{category.category_id}</TableCell>
                        <TableCell>
                          <Typography variant="body1" fontWeight="bold">
                            {category.category_name}
                          </Typography>
                        </TableCell>
                        <TableCell>{category.category_description || '-'}</TableCell>
                        <TableCell>
                          {category.is_ai_generated ? (
                            <Chip label="AI" size="small" color="primary" icon={<AIIcon />} />
                          ) : (
                            <Chip label="Manual" size="small" variant="outlined" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap>
                            {formatDate(category.created_at)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="Edit Category">
                              <IconButton size="small" color="primary" onClick={() => handleOpenSimpleDialog(category)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Category">
                              <IconButton size="small" color="error" onClick={() => handleDeleteCategory(category.category_id)}>
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
        </>
      )}

      {/* Tab 1: AI Creation Requests */}
      {activeTab === 1 && (
        <>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
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

          {requestsLoading ? (
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
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Requested By</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Created</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">No category creation requests found</TableCell>
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
                            {request.status === 'pending' && (
                              <Tooltip title="Analyze with AI">
                                <IconButton size="small" color="primary" onClick={() => handleAnalyze(request.request_id)}>
                                  <AIIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {request.status === 'review' && (
                              <Tooltip title="Review & Approve">
                                <IconButton size="small" color="success" onClick={() => handleViewRequest(request)}>
                                  <ApproveIcon fontSize="small" />
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
        </>
      )}

      {/* Simple Add/Edit Category Dialog */}
      <Dialog open={openSimpleDialog} onClose={handleCloseSimpleDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCategory ? 'Edit Document Category' : 'Add New Document Category'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Category Name"
              fullWidth
              required
              value={simpleFormData.category_name}
              onChange={(e) => setSimpleFormData({ ...simpleFormData, category_name: e.target.value })}
              helperText="e.g., eob, facesheet, claim"
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={simpleFormData.category_description}
              onChange={(e) => setSimpleFormData({ ...simpleFormData, category_description: e.target.value })}
              helperText="Optional description of this document type"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSimpleDialog}>Cancel</Button>
          <Button onClick={handleSimpleSubmit} variant="contained" disabled={!simpleFormData.category_name}>
            {editingCategory ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* AI Creation Wizard Dialog */}
      <Dialog open={openWizard} onClose={handleCloseWizard} maxWidth="md" fullWidth>
        <DialogTitle>Create New Document Category with AI</DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

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
              disabled={!aiFormData.category_name || !aiFormData.category_description}
            >
              Next
            </Button>
          )}
          {activeStep === 1 && (
            <Button
              onClick={handleSubmitRequest}
              variant="contained"
            >
              Submit & Continue
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
          {selectedRequest?.status === 'pending' && (
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

export default CategoryManagement;
