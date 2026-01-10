import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Divider,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  Save as SaveIcon,
  ExpandMore as ExpandMoreIcon,
  ContentCopy as CopyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import axios from 'axios';

// Configuration sections and their keys
const CONFIG_SECTIONS = {
  provider: {
    title: 'Provider Selection',
    description: 'Choose which providers to use for OCR and LLM processing',
    keys: [
      { key: 'OCR_PROVIDER', label: 'OCR Provider', type: 'select', options: ['google', 'mistral'], description: 'Provider for document OCR' },
      { key: 'LLM_PROVIDER', label: 'LLM Provider', type: 'select', options: ['openai', 'mistral'], description: 'Provider for data extraction' }
    ]
  },
  documentAi: {
    title: 'Google Document AI',
    description: 'Settings for Google Cloud Document AI OCR',
    keys: [
      { key: 'DOCAI_PROJECT_ID', label: 'Project ID', type: 'text', description: 'Google Cloud Project ID' },
      { key: 'DOCAI_LOCATION', label: 'Location', type: 'text', description: 'Processor location (e.g., us, eu)' },
      { key: 'DOCAI_PROCESSOR_ID', label: 'Processor ID', type: 'text', description: 'Document AI Processor ID' },
      { key: 'DOCAI_COST_PER_PAGE', label: 'Cost per Page ($)', type: 'number', description: 'Cost per page for Document AI' }
    ]
  },
  openai: {
    title: 'OpenAI Configuration',
    description: 'Settings for OpenAI GPT models',
    keys: [
      { key: 'OPENAI_API_KEY', label: 'API Key', type: 'password', encrypted: true, description: 'OpenAI API Key' },
      { key: 'OPENAI_MODEL', label: 'Model', type: 'select', options: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4'], description: 'OpenAI model to use' },
      { key: 'OPENAI_MAX_TOKENS', label: 'Max Tokens', type: 'number', description: 'Maximum tokens for response' },
      { key: 'OPENAI_TEMPERATURE', label: 'Temperature', type: 'number', description: 'Temperature (0-1, lower = more focused)' },
      { key: 'OPENAI_INPUT_COST_PER_1K', label: 'Input Cost per 1K tokens ($)', type: 'number', description: 'Cost per 1K input tokens' },
      { key: 'OPENAI_OUTPUT_COST_PER_1K', label: 'Output Cost per 1K tokens ($)', type: 'number', description: 'Cost per 1K output tokens' }
    ]
  },
  mistral: {
    title: 'Mistral AI Configuration',
    description: 'Settings for Mistral AI models',
    keys: [
      { key: 'MISTRAL_API_KEY', label: 'API Key', type: 'password', encrypted: true, description: 'Mistral AI API Key' },
      { key: 'MISTRAL_MODEL', label: 'Model', type: 'text', description: 'Mistral model to use' },
      { key: 'MISTRAL_INPUT_COST_PER_1K', label: 'Input Cost per 1K tokens ($)', type: 'number', description: 'Cost per 1K input tokens' },
      { key: 'MISTRAL_OUTPUT_COST_PER_1K', label: 'Output Cost per 1K tokens ($)', type: 'number', description: 'Cost per 1K output tokens' }
    ]
  },
  processing: {
    title: 'Processing Settings',
    description: 'General document processing configuration',
    keys: [
      { key: 'MAX_PAGES_PER_SPLIT', label: 'Max Pages per Split', type: 'number', description: 'Maximum pages before splitting document' },
      { key: 'MAX_PARALLEL_WORKERS', label: 'Max Parallel Workers', type: 'number', description: 'Maximum parallel processing workers' },
      { key: 'DOCUMENT_AI_TIMEOUT', label: 'Timeout (ms)', type: 'number', description: 'Document AI timeout in milliseconds' },
      { key: 'USE_BATCH_PROCESSING', label: 'Use Batch Processing', type: 'select', options: ['YES', 'NO'], description: 'Use batch API for cost savings' }
    ]
  }
  // Note: Extraction Settings have been moved to Output Profile Management
  // Each output profile can have its own custom extraction prompt
};

const ProcessingEngineConfig = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Config values - keyed by config_key
  const [defaultConfig, setDefaultConfig] = useState({});
  const [categoryConfigs, setCategoryConfigs] = useState({});

  // Show/hide password fields
  const [showPasswords, setShowPasswords] = useState({});

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');

      const response = await axios.get(
        'http://localhost:5000/api/admin/processing-config',
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        // Process default configs
        const defaultMap = {};
        response.data.data.default.forEach(c => {
          defaultMap[c.config_key] = {
            value: c.config_value || '',
            display_value: c.display_value || '',
            is_encrypted: c.is_encrypted,
            description: c.description
          };
        });
        setDefaultConfig(defaultMap);

        // Process category configs
        const catConfigs = {};
        Object.keys(response.data.data.categories).forEach(catId => {
          const catData = response.data.data.categories[catId];
          catConfigs[catId] = {
            name: catData.category_name,
            configs: {}
          };
          catData.configs.forEach(c => {
            catConfigs[catId].configs[c.config_key] = {
              value: c.config_value || '',
              display_value: c.display_value || '',
              is_encrypted: c.is_encrypted,
              description: c.description
            };
          });
        });
        setCategoryConfigs(catConfigs);
        setCategories(response.data.categories);
      }
    } catch (err) {
      console.error('Error fetching config:', err);
      setError('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleDefaultConfigChange = (key, value) => {
    setDefaultConfig(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        value: value
      }
    }));
  };

  const handleCategoryConfigChange = (catId, key, value) => {
    setCategoryConfigs(prev => ({
      ...prev,
      [catId]: {
        ...prev[catId],
        configs: {
          ...prev[catId]?.configs,
          [key]: {
            ...prev[catId]?.configs?.[key],
            value: value
          }
        }
      }
    }));
  };

  const saveDefaultConfig = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const token = localStorage.getItem('token');

      // Build configs array
      const configs = [];
      Object.keys(CONFIG_SECTIONS).forEach(section => {
        CONFIG_SECTIONS[section].keys.forEach(keyConfig => {
          const configData = defaultConfig[keyConfig.key];
          if (configData) {
            configs.push({
              config_key: keyConfig.key,
              config_value: configData.value,
              is_encrypted: keyConfig.encrypted || false,
              description: keyConfig.description
            });
          }
        });
      });

      await axios.post(
        'http://localhost:5000/api/admin/processing-config/bulk',
        { doc_category_id: null, configs },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess('Default configuration saved successfully');
      fetchConfig(); // Refresh to get updated display values
    } catch (err) {
      console.error('Error saving config:', err);
      setError('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const saveCategoryConfig = async (categoryId) => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const token = localStorage.getItem('token');

      const catConfig = categoryConfigs[categoryId];
      if (!catConfig) return;

      // Build configs array
      const configs = [];
      Object.keys(CONFIG_SECTIONS).forEach(section => {
        CONFIG_SECTIONS[section].keys.forEach(keyConfig => {
          const configData = catConfig.configs?.[keyConfig.key];
          if (configData && configData.value) {
            configs.push({
              config_key: keyConfig.key,
              config_value: configData.value,
              is_encrypted: keyConfig.encrypted || false,
              description: keyConfig.description
            });
          }
        });
      });

      await axios.post(
        'http://localhost:5000/api/admin/processing-config/bulk',
        { doc_category_id: parseInt(categoryId), configs },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess(`Configuration for ${catConfig.name} saved successfully`);
      fetchConfig();
    } catch (err) {
      console.error('Error saving category config:', err);
      setError('Failed to save category configuration');
    } finally {
      setSaving(false);
    }
  };

  const copyDefaultToCategory = async (categoryId) => {
    try {
      setSaving(true);
      setError('');
      const token = localStorage.getItem('token');

      await axios.post(
        `http://localhost:5000/api/admin/processing-config/copy-to-category/${categoryId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess('Default configuration copied to category');
      fetchConfig();
    } catch (err) {
      console.error('Error copying config:', err);
      setError('Failed to copy configuration');
    } finally {
      setSaving(false);
    }
  };

  const togglePasswordVisibility = (key) => {
    setShowPasswords(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const renderConfigField = (keyConfig, value, displayValue, onChange, isCategory = false) => {
    const { key, label, type, options, encrypted, description } = keyConfig;
    const fieldValue = value || '';
    const placeholder = encrypted && displayValue ? displayValue : '';

    if (type === 'select') {
      return (
        <FormControl fullWidth size="small">
          <InputLabel>{label}</InputLabel>
          <Select
            value={fieldValue}
            label={label}
            onChange={(e) => onChange(key, e.target.value)}
          >
            {isCategory && <MenuItem value=""><em>Use Default</em></MenuItem>}
            {options.map(opt => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
          </Select>
        </FormControl>
      );
    }

    if (type === 'textarea') {
      return (
        <TextField
          fullWidth
          multiline
          rows={4}
          label={label}
          value={fieldValue}
          onChange={(e) => onChange(key, e.target.value)}
          placeholder={isCategory ? 'Leave empty to use default' : ''}
          helperText={description}
          size="small"
        />
      );
    }

    if (type === 'password') {
      const isSaved = !fieldValue && displayValue;
      return (
        <Box>
          <TextField
            fullWidth
            type={showPasswords[key] ? 'text' : 'password'}
            label={label}
            value={fieldValue}
            onChange={(e) => onChange(key, e.target.value)}
            placeholder={placeholder || (isCategory ? 'Leave empty to use default' : 'Enter API key')}
            helperText={isSaved ? `Saved: ${displayValue} (enter new value to replace)` : description}
            size="small"
            InputProps={{
              endAdornment: (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {isSaved && (
                    <Tooltip title="API key is saved and encrypted">
                      <CheckCircleIcon color="success" sx={{ mr: 0.5, fontSize: 20 }} />
                    </Tooltip>
                  )}
                  <IconButton
                    size="small"
                    onClick={() => togglePasswordVisibility(key)}
                  >
                    {showPasswords[key] ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </Box>
              )
            }}
            sx={isSaved ? { '& .MuiOutlinedInput-root': { backgroundColor: 'rgba(46, 125, 50, 0.04)' } } : {}}
          />
        </Box>
      );
    }

    return (
      <TextField
        fullWidth
        type={type === 'number' ? 'number' : 'text'}
        label={label}
        value={fieldValue}
        onChange={(e) => onChange(key, e.target.value)}
        placeholder={isCategory ? 'Leave empty to use default' : ''}
        helperText={description}
        size="small"
        inputProps={type === 'number' ? { step: '0.000001' } : {}}
      />
    );
  };

  const renderConfigSection = (sectionKey, section, configData, onChange, isCategory = false) => {
    return (
      <Accordion key={sectionKey} defaultExpanded={sectionKey === 'provider'}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box>
            <Typography variant="subtitle1" fontWeight="medium">{section.title}</Typography>
            <Typography variant="caption" color="text.secondary">{section.description}</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            {section.keys.map(keyConfig => (
              <Grid item xs={12} md={keyConfig.type === 'textarea' ? 12 : 6} key={keyConfig.key}>
                {renderConfigField(
                  keyConfig,
                  configData[keyConfig.key]?.value,
                  configData[keyConfig.key]?.display_value,
                  onChange,
                  isCategory
                )}
              </Grid>
            ))}
          </Grid>
        </AccordionDetails>
      </Accordion>
    );
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold">Processing Engine Configuration</Typography>
          <Typography variant="body2" color="text.secondary">
            Configure processing settings. Category-specific settings override defaults. Missing settings fall back to .env file.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchConfig}
        >
          Refresh
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab label="Default Configuration" />
          <Tab label="Category-Specific Configuration" />
        </Tabs>

        {/* Default Configuration Tab */}
        {activeTab === 0 && (
          <Box sx={{ p: 3 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              Default configuration applies to all document categories unless overridden by category-specific settings.
            </Alert>

            {Object.keys(CONFIG_SECTIONS).map(sectionKey =>
              renderConfigSection(
                sectionKey,
                CONFIG_SECTIONS[sectionKey],
                defaultConfig,
                handleDefaultConfigChange,
                false
              )
            )}

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                onClick={saveDefaultConfig}
                disabled={saving}
              >
                Save Default Configuration
              </Button>
            </Box>
          </Box>
        )}

        {/* Category-Specific Configuration Tab */}
        {activeTab === 1 && (
          <Box sx={{ p: 3 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              Configure settings for specific document categories. Empty fields will use the default configuration.
            </Alert>

            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Select Document Category</InputLabel>
              <Select
                value={selectedCategory || ''}
                label="Select Document Category"
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {categories.map(cat => (
                  <MenuItem key={cat.category_id} value={cat.category_id}>
                    {cat.category_name}
                    {categoryConfigs[cat.category_id]?.configs &&
                     Object.keys(categoryConfigs[cat.category_id].configs).length > 0 && (
                      <Chip size="small" label="Has Overrides" color="primary" sx={{ ml: 1 }} />
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedCategory && (
              <>
                <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
                  <Tooltip title="Copy all default settings to this category as a starting point">
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<CopyIcon />}
                      onClick={() => copyDefaultToCategory(selectedCategory)}
                      disabled={saving}
                    >
                      Copy Defaults to Category
                    </Button>
                  </Tooltip>
                </Box>

                {Object.keys(CONFIG_SECTIONS).map(sectionKey =>
                  renderConfigSection(
                    sectionKey,
                    CONFIG_SECTIONS[sectionKey],
                    categoryConfigs[selectedCategory]?.configs || {},
                    (key, value) => handleCategoryConfigChange(selectedCategory, key, value),
                    true
                  )
                )}

                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                    onClick={() => saveCategoryConfig(selectedCategory)}
                    disabled={saving}
                  >
                    Save {categoryConfigs[selectedCategory]?.name} Configuration
                  </Button>
                </Box>
              </>
            )}

            {!selectedCategory && (
              <Typography color="text.secondary" textAlign="center" py={4}>
                Select a document category above to configure its specific settings.
              </Typography>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default ProcessingEngineConfig;
