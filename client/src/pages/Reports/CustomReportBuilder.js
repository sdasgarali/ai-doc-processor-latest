import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  MenuItem,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as RunIcon
} from '@mui/icons-material';
import axios from 'axios';

const CustomReportBuilder = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Report configuration
  const [module, setModule] = useState('documents');
  const [reportName, setReportName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [selectedFields, setSelectedFields] = useState([]);
  
  // Available fields from backend
  const [availableFields, setAvailableFields] = useState([]);
  
  // Saved reports
  const [savedReports, setSavedReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState('');
  
  // Report results
  const [reportData, setReportData] = useState(null);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    fetchSavedReports();
  }, []);

  useEffect(() => {
    if (module) {
      fetchAvailableFields();
      setSelectedFields([]);
    }
  }, [module]);

  const fetchAvailableFields = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `/api/custom-reports/fields/${module}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAvailableFields(response.data.data || []);
      setError('');
    } catch (err) {
      console.error('Error fetching fields:', err);
      setError('Failed to load available fields');
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedReports = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        '/api/custom-reports',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSavedReports(response.data.data || []);
    } catch (err) {
      console.error('Error fetching saved reports:', err);
    }
  };

  const handleFieldToggle = (fieldName) => {
    setSelectedFields(prev => {
      if (prev.includes(fieldName)) {
        return prev.filter(f => f !== fieldName);
      } else {
        return [...prev, fieldName];
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedFields(availableFields.map(f => f.field_name));
  };

  const handleDeselectAll = () => {
    setSelectedFields([]);
  };

  const handleSaveReport = async () => {
    if (!reportName.trim()) {
      setError('Report name is required');
      return;
    }

    if (selectedFields.length === 0) {
      setError('Please select at least one field');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const reportData = {
        report_name: reportName,
        description: description,
        is_public: isPublic,
        module: module,
        selected_fields: selectedFields
      };

      if (selectedReportId) {
        // Update existing report
        await axios.put(
          `/api/custom-reports/${selectedReportId}`,
          reportData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess('Report updated successfully!');
      } else {
        // Create new report
        await axios.post(
          '/api/custom-reports',
          reportData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess('Report saved successfully!');
      }

      await fetchSavedReports();
      handleClearForm();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving report:', err);
      setError(err.response?.data?.message || 'Failed to save report');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadReport = async (reportId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `/api/custom-reports/${reportId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const report = response.data.data;
      setSelectedReportId(reportId);
      setModule(report.module);
      setReportName(report.report_name);
      setDescription(report.description || '');
      setIsPublic(report.is_public);
      // selected_fields is already parsed by MySQL2, no need to JSON.parse
      setSelectedFields(Array.isArray(report.selected_fields) ? report.selected_fields : JSON.parse(report.selected_fields));
      setError('');
    } catch (err) {
      console.error('Error loading report:', err);
      setError('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const handleRunReport = async (reportId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `/api/custom-reports/${reportId}/execute`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setReportData(response.data);
      setShowResults(true);
      setError('');
    } catch (err) {
      console.error('Error running report:', err);
      setError('Failed to run report');
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = async (reportId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `/api/custom-reports/${reportId}/export`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Custom_Report_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error exporting report:', err);
      alert('Failed to export report');
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('Are you sure you want to delete this report?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `/api/custom-reports/${reportId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess('Report deleted successfully!');
      await fetchSavedReports();
      
      if (selectedReportId === reportId) {
        handleClearForm();
      }
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting report:', err);
      setError('Failed to delete report');
    }
  };

  const handleClearForm = () => {
    setSelectedReportId('');
    setReportName('');
    setDescription('');
    setIsPublic(false);
    setSelectedFields([]);
    setModule('documents');
  };

  const groupFieldsByCategory = () => {
    const groups = {};
    availableFields.forEach(field => {
      const category = field.table_name || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(field);
    });
    return groups;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Custom Report Builder
        </Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleClearForm}
          disabled={loading}
        >
          New Report
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Grid container spacing={3}>
        {/* Left Panel - Report Builder */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {selectedReportId ? 'Edit Report' : 'Create New Report'}
            </Typography>

            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Report Name"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  required
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  multiline
                  rows={2}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  select
                  label="Module"
                  value={module}
                  onChange={(e) => setModule(e.target.value)}
                  disabled={!!selectedReportId}
                >
                  <MenuItem value="documents">Documents</MenuItem>
                  <MenuItem value="clients">Clients</MenuItem>
                  <MenuItem value="users">Users</MenuItem>
                </TextField>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                    />
                  }
                  label="Make this report public (visible to all users)"
                />
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1">
                    Select Fields ({selectedFields.length} selected)
                  </Typography>
                  <Box>
                    <Button size="small" onClick={handleSelectAll} sx={{ mr: 1 }}>
                      Select All
                    </Button>
                    <Button size="small" onClick={handleDeselectAll}>
                      Deselect All
                    </Button>
                  </Box>
                </Box>

                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  Object.entries(groupFieldsByCategory()).map(([category, fields]) => (
                    <Accordion key={category} defaultExpanded={category === 'document_processed'}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography fontWeight="medium">
                          {category.replace(/_/g, ' ').toUpperCase()} ({fields.length} fields)
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <FormGroup>
                          {fields.map((field) => (
                            <FormControlLabel
                              key={field.field_name}
                              control={
                                <Checkbox
                                  checked={selectedFields.includes(field.field_name)}
                                  onChange={() => handleFieldToggle(field.field_name)}
                                />
                              }
                              label={
                                <Box>
                                  <Typography variant="body2">{field.display_name}</Typography>
                                  {field.description && (
                                    <Typography variant="caption" color="text.secondary">
                                      {field.description}
                                    </Typography>
                                  )}
                                </Box>
                              }
                            />
                          ))}
                        </FormGroup>
                      </AccordionDetails>
                    </Accordion>
                  ))
                )}
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveReport}
                    disabled={loading || !reportName.trim() || selectedFields.length === 0}
                  >
                    {loading ? 'Saving...' : (selectedReportId ? 'Update Report' : 'Save Report')}
                  </Button>
                  {selectedReportId && (
                    <Button
                      variant="outlined"
                      onClick={handleClearForm}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Right Panel - Saved Reports */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Saved Reports
            </Typography>

            {savedReports.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                No saved reports yet
              </Typography>
            ) : (
              <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
                {savedReports.map((report) => (
                  <Paper key={report.report_id} sx={{ p: 2, mb: 2, bgcolor: 'action.hover' }}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {report.report_name}
                    </Typography>
                    {report.description && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {report.description}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                      <Chip label={report.module} size="small" color="primary" />
                      {report.is_public && <Chip label="Public" size="small" color="success" />}
                      <Chip 
                        label={`${(Array.isArray(report.selected_fields) ? report.selected_fields : JSON.parse(report.selected_fields)).length} fields`} 
                        size="small" 
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 2 }}>
                      <Tooltip title="Run Report">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleRunReport(report.report_id)}
                        >
                          <RunIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Export to Excel">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleExportReport(report.report_id)}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit Report">
                        <IconButton
                          size="small"
                          color="info"
                          onClick={() => handleLoadReport(report.report_id)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Report">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteReport(report.report_id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Paper>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Results Dialog */}
      <Dialog
        open={showResults}
        onClose={() => setShowResults(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          {reportData?.report_name || 'Report Results'}
        </DialogTitle>
        <DialogContent>
          {reportData && reportData.data && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {reportData.fields.map((field) => (
                      <TableCell key={field.field_name}>{field.display_name}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reportData.data.map((row, idx) => (
                    <TableRow key={idx}>
                      {reportData.fields.map((field) => (
                        <TableCell key={field.field_name}>
                          {row[field.field_name]?.toString() || '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {reportData && reportData.data && reportData.data.length === 0 && (
            <Typography textAlign="center" color="text.secondary" py={3}>
              No data found
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowResults(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomReportBuilder;
