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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useLocation } from 'react-router-dom';

const ModelManagement = () => {
  const location = useLocation();
  const [models, setModels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [aiModels, setAiModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [openDialog, setOpenDialog] = useState(false);
  const [editingModel, setEditingModel] = useState(null);

  const [formData, setFormData] = useState({
    model_name: '',
    version: '',
    doc_category_id: '',
    ai_model_id: '',
    purpose: '',
    ocr_type: '',
    use_document_ai: false
  });

  // Field management state
  const [openFieldsDialog, setOpenFieldsDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [fields, setFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  
  const [openFieldFormDialog, setOpenFieldFormDialog] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [fieldFormData, setFieldFormData] = useState({
    field_name: '',
    keywords: '',
    doc_category: ''
  });

  useEffect(() => {
    fetchModels();
    fetchCategories();
    fetchAiModels();
  }, []);

  // Auto-open model dialog if selectedModelId is passed via router state
  useEffect(() => {
    if (location.state?.selectedModelId && models.length > 0) {
      const modelToOpen = models.find(m => m.id === location.state.selectedModelId);
      if (modelToOpen) {
        handleOpenDialog(modelToOpen);
        // Clear the state so it doesn't reopen on subsequent renders
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, models]);

  const fetchModels = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/admin/model-versions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setModels(response.data.data || []);
      setError('');
    } catch (err) {
      console.error('Error fetching models:', err);
      setError('Failed to load models');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/admin/categories', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCategories(response.data.data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchAiModels = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/admin/models', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAiModels(response.data.data || []);
    } catch (err) {
      console.error('Error fetching AI models:', err);
    }
  };

  const handleOpenDialog = (model = null) => {
    if (model) {
      setEditingModel(model);
      setFormData({
        model_name: model.model_name,
        version: model.version,
        doc_category_id: model.doc_category_id || '',
        ai_model_id: model.ai_model_id || '',
        purpose: model.purpose || '',
        ocr_type: model.ocr_type || '',
        use_document_ai: model.use_document_ai || false
      });
    } else {
      setEditingModel(null);
      setFormData({
        model_name: '',
        version: '',
        doc_category_id: '',
        ai_model_id: '',
        purpose: '',
        ocr_type: '',
        use_document_ai: false
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingModel(null);
    setFormData({
      model_name: '',
      version: '',
      doc_category_id: '',
      ai_model_id: '',
      purpose: '',
      ocr_type: '',
      use_document_ai: false
    });
  };

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (editingModel) {
        await axios.put(
          `http://localhost:5000/api/admin/model-versions/${editingModel.id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess('Model updated successfully!');
      } else {
        await axios.post(
          'http://localhost:5000/api/admin/model-versions',
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess('Model created successfully!');
      }
      
      handleCloseDialog();
      fetchModels();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving model:', err);
      setError(err.response?.data?.message || 'Failed to save model');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDeleteModel = async (id) => {
    if (!window.confirm('Are you sure you want to delete this model?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/admin/model-versions/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess('Model deleted successfully!');
      fetchModels();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting model:', err);
      setError(err.response?.data?.message || 'Failed to delete model');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Field management functions
  const handleOpenFieldsDialog = async (model) => {
    if (!model.doc_category_id) {
      setError('This model has no document category assigned');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setSelectedCategory({
      id: model.doc_category_id,
      name: model.category_name
    });
    setOpenFieldsDialog(true);
    await fetchFields(model.doc_category_id);
  };

  const fetchFields = async (categoryId) => {
    try {
      setLoadingFields(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `http://localhost:5000/api/admin/fields?doc_category=${categoryId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFields(response.data.data || []);
    } catch (err) {
      console.error('Error fetching fields:', err);
      setError('Failed to load fields');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoadingFields(false);
    }
  };

  const handleOpenFieldForm = (field = null) => {
    if (field) {
      setEditingField(field);
      // Parse keywords from JSON if it's a string
      let keywordsStr = '';
      if (field.keywords) {
        try {
          const keywordsArray = typeof field.keywords === 'string' 
            ? JSON.parse(field.keywords) 
            : field.keywords;
          keywordsStr = Array.isArray(keywordsArray) ? keywordsArray.join(', ') : '';
        } catch (e) {
          keywordsStr = field.keywords;
        }
      }
      
      setFieldFormData({
        field_name: field.field_name,
        keywords: keywordsStr,
        doc_category: field.doc_category
      });
    } else {
      setEditingField(null);
      setFieldFormData({
        field_name: '',
        keywords: '',
        doc_category: selectedCategory.id
      });
    }
    setOpenFieldFormDialog(true);
  };

  const handleCloseFieldForm = () => {
    setOpenFieldFormDialog(false);
    setEditingField(null);
    setFieldFormData({
      field_name: '',
      keywords: '',
      doc_category: ''
    });
  };

  const handleSubmitField = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Convert comma-separated keywords to array
      const keywordsArray = fieldFormData.keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      const payload = {
        field_name: fieldFormData.field_name,
        field_display_name: fieldFormData.field_name, // Using same as field_name
        field_type: 'string', // Default type (ENUM: string, number, date, boolean)
        doc_category: fieldFormData.doc_category,
        is_required: false,
        default_value: null,
        validation_regex: null,
        keywords: keywordsArray
      };

      if (editingField) {
        await axios.put(
          `http://localhost:5000/api/admin/fields/${editingField.field_id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess('Field updated successfully!');
      } else {
        await axios.post(
          'http://localhost:5000/api/admin/fields',
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess('Field created successfully!');
      }

      handleCloseFieldForm();
      await fetchFields(selectedCategory.id);
      await fetchModels(); // Refresh models to update field count
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving field:', err);
      setError(err.response?.data?.message || 'Failed to save field');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDeleteField = async (fieldId) => {
    if (!window.confirm('Are you sure you want to delete this field?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/admin/fields/${fieldId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess('Field deleted successfully!');
      await fetchFields(selectedCategory.id);
      await fetchModels(); // Refresh models to update field count
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting field:', err);
      setError(err.response?.data?.message || 'Failed to delete field');
      setTimeout(() => setError(''), 3000);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const formatKeywords = (keywords) => {
    if (!keywords) return '-';
    try {
      const keywordsArray = typeof keywords === 'string' ? JSON.parse(keywords) : keywords;
      return Array.isArray(keywordsArray) ? keywordsArray.join(', ') : keywords;
    } catch (e) {
      return keywords;
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">Model Management</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchModels}>
            Refresh
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Add Model
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
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Model Name</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Version</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Doc Category</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>AI Model</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>No. of Fields</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Purpose</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Created At</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Last Updated</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {models.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">No models found</TableCell>
                </TableRow>
              ) : (
                models.map((model) => (
                  <TableRow key={model.id} hover>
                    <TableCell>{model.id}</TableCell>
                    <TableCell>{model.model_name}</TableCell>
                    <TableCell>
                      <Chip label={model.version} color="primary" size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      {model.category_name ? (
                        <Chip label={model.category_name} size="small" />
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {model.ai_model_name ? (
                        <Chip label={model.ai_model_name} color="secondary" size="small" />
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip 
                        title={model.doc_category_id ? "Click to manage fields" : "Assign a category first"}
                        arrow
                      >
                        <Chip 
                          label={model.no_of_fields || 0} 
                          color={model.no_of_fields > 0 ? "secondary" : "default"}
                          size="small" 
                          sx={{ 
                            fontWeight: 'bold',
                            cursor: model.doc_category_id ? 'pointer' : 'not-allowed',
                            '&:hover': model.doc_category_id ? {
                              backgroundColor: model.no_of_fields > 0 ? 'secondary.dark' : 'action.hover',
                              transform: 'scale(1.05)'
                            } : {
                              opacity: 0.6
                            }
                          }}
                          onClick={() => model.doc_category_id && handleOpenFieldsDialog(model)}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {model.purpose ? (
                        <Tooltip title={model.purpose}>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                            {model.purpose}
                          </Typography>
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap>
                        {formatDate(model.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap>
                        {formatDate(model.last_updated_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Edit Model">
                          <IconButton size="small" color="primary" onClick={() => handleOpenDialog(model)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Model">
                          <IconButton size="small" color="error" onClick={() => handleDeleteModel(model.id)}>
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

      {/* Add/Edit Model Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingModel ? 'Edit Model' : 'Add New Model'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Model Name"
              fullWidth
              required
              value={formData.model_name}
              onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
              helperText="e.g., Document AI EOB Processor"
            />
            <TextField
              label="Version"
              fullWidth
              required
              value={formData.version}
              onChange={(e) => setFormData({ ...formData, version: e.target.value })}
              helperText="e.g., 1.0.0, 2.1.3"
            />
            <TextField
              select
              label="Doc Category"
              fullWidth
              value={formData.doc_category_id}
              onChange={(e) => setFormData({ ...formData, doc_category_id: e.target.value })}
              helperText="Select document type this model processes"
            >
              <MenuItem value="">None</MenuItem>
              {categories.map((category) => (
                <MenuItem key={category.category_id} value={category.category_id}>
                  {category.category_name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="AI Model"
              fullWidth
              value={formData.ai_model_id}
              onChange={(e) => setFormData({ ...formData, ai_model_id: e.target.value })}
              helperText="Select the AI model used for extraction (GPT-4o, etc.)"
            >
              <MenuItem value="">None</MenuItem>
              {aiModels.map((aiModel) => (
                <MenuItem key={aiModel.model_id} value={aiModel.model_id}>
                  {aiModel.model_name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="OCR Type"
              fullWidth
              value={formData.ocr_type}
              onChange={(e) => setFormData({ ...formData, ocr_type: e.target.value })}
              helperText="Select OCR engine for text extraction"
            >
              <MenuItem value="">None</MenuItem>
              <MenuItem value="tesseract">Tesseract OCR</MenuItem>
              <MenuItem value="google_vision">Google Vision OCR</MenuItem>
              <MenuItem value="aws_textract">AWS Textract</MenuItem>
              <MenuItem value="azure_ocr">Azure OCR</MenuItem>
            </TextField>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                id="use_document_ai"
                checked={formData.use_document_ai}
                onChange={(e) => setFormData({ ...formData, use_document_ai: e.target.checked })}
                style={{ marginRight: '8px', width: '20px', height: '20px', cursor: 'pointer' }}
              />
              <label htmlFor="use_document_ai" style={{ cursor: 'pointer', userSelect: 'none' }}>
                <Typography variant="body1">
                  Use Document AI
                </Typography>
              </label>
            </Box>
            <TextField
              label="Purpose"
              fullWidth
              multiline
              rows={3}
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              helperText="Optional description of model's intended use"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={!formData.model_name || !formData.version}>
            {editingModel ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Fields Management Dialog */}
      <Dialog 
        open={openFieldsDialog} 
        onClose={() => setOpenFieldsDialog(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Fields for "{selectedCategory?.name}" Category
            </Typography>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />} 
              onClick={() => handleOpenFieldForm()}
              size="small"
            >
              Add Field
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          {loadingFields ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
              <CircularProgress />
            </Box>
          ) : fields.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <Typography variant="body1" color="text.secondary">
                No fields found for this category
              </Typography>
              <Button 
                variant="outlined" 
                startIcon={<AddIcon />} 
                onClick={() => handleOpenFieldForm()}
                sx={{ mt: 2 }}
              >
                Add First Field
              </Button>
            </Box>
          ) : (
            <List>
              {fields.map((field, index) => (
                <React.Fragment key={field.field_id}>
                  <ListItem>
                    <ListItemText
                      primary={<Typography variant="subtitle1" fontWeight="bold">{field.field_name}</Typography>}
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Keywords: {formatKeywords(field.keywords)}
                          </Typography>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title="Edit Field">
                        <IconButton edge="end" onClick={() => handleOpenFieldForm(field)} sx={{ mr: 1 }}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Field">
                        <IconButton edge="end" color="error" onClick={() => handleDeleteField(field.field_id)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < fields.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenFieldsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Add/Edit Field Dialog */}
      <Dialog open={openFieldFormDialog} onClose={handleCloseFieldForm} maxWidth="sm" fullWidth>
        <DialogTitle>{editingField ? 'Edit Field' : 'Add New Field'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Field Name"
              fullWidth
              required
              value={fieldFormData.field_name}
              onChange={(e) => setFieldFormData({ ...fieldFormData, field_name: e.target.value })}
              helperText="e.g., patient_name, claim_number"
            />
            <TextField
              label="Matching Keywords"
              fullWidth
              value={fieldFormData.keywords}
              onChange={(e) => setFieldFormData({ ...fieldFormData, keywords: e.target.value })}
              helperText="Comma-separated keywords: patient, name, full name"
              multiline
              rows={2}
            />
            <TextField
              select
              label="Doc Category"
              fullWidth
              required
              value={fieldFormData.doc_category}
              onChange={(e) => setFieldFormData({ ...fieldFormData, doc_category: e.target.value })}
              disabled={!!editingField}
            >
              {categories.map((category) => (
                <MenuItem key={category.category_id} value={category.category_id}>
                  {category.category_name}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFieldForm}>Cancel</Button>
          <Button 
            onClick={handleSubmitField} 
            variant="contained" 
            disabled={!fieldFormData.field_name || !fieldFormData.doc_category}
          >
            {editingField ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default ModelManagement;
