import React, { useState, useEffect, useRef } from 'react';
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
  CircularProgress,
  Alert,
  Grid,
  TextField,
  IconButton,
  Divider,
  Link,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Tabs,
  Tab
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Code as CodeIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const DocumentDetails = () => {
  const { processId } = useParams();
  const navigate = useNavigate();
  const pdfViewerRef = useRef(null);

  const [document, setDocument] = useState(null);
  const [extractedData, setExtractedData] = useState([]);
  const [editedData, setEditedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pdfUrl, setPdfUrl] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showPdf, setShowPdf] = useState(true);
  const [jsonContent, setJsonContent] = useState('');
  const [jsonTab, setJsonTab] = useState(0); // 0 = formatted, 1 = raw

  useEffect(() => {
    fetchDocumentDetails();
  }, [processId]);

  const fetchDocumentDetails = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      console.log('DEBUG: processId =', processId);
      console.log('DEBUG: token exists =', !!token);

      // Fetch document metadata
      const docResponse = await axios.get(
        `http://localhost:5000/api/documents/${processId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('DEBUG: Document metadata response =', docResponse.data);
      setDocument(docResponse.data.data);

      // Fetch PDF for viewing
      if (docResponse.data.data.processing_status === 'Processed') {
        try {
          const pdfResponse = await axios.get(
            `http://localhost:5000/api/documents/${processId}/download/pdf`,
            {
              headers: { Authorization: `Bearer ${token}` },
              responseType: 'blob'
            }
          );
          const pdfBlobUrl = URL.createObjectURL(pdfResponse.data);
          setPdfUrl(pdfBlobUrl);
        } catch (err) {
          console.error('Error fetching PDF:', err);
          console.error('Error details:', err.response?.data || err.message);
          // Don't fail completely if PDF fetch fails - user can still view/edit data
        }

        // Fetch extracted data from database (or fallback to JSON file)
        try {
          console.log('DEBUG: Fetching extracted-data...');
          const dataResponse = await axios.get(
            `http://localhost:5000/api/documents/${processId}/extracted-data`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          console.log('DEBUG: Extracted data response =', dataResponse.data);

          let results = dataResponse.data.data || [];
          console.log('DEBUG: Results count =', results.length);

          // If no data in database, try to load from JSON file
          if (results.length === 0) {
            console.log('DEBUG: No data in DB, trying JSON file...');
            const jsonResponse = await axios.get(
              `http://localhost:5000/api/documents/${processId}/data`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            results = jsonResponse.data.data.results || [];
            console.log('DEBUG: JSON file results count =', results.length);
          }

          console.log('DEBUG: Setting extractedData and editedData with', results.length, 'records');
          setExtractedData(results);
          setEditedData(JSON.parse(JSON.stringify(results))); // Deep clone

          // For Facesheet documents (doc_category = 2 or "2"), also load full JSON
          if (docResponse.data.data.doc_category === '2' || docResponse.data.data.doc_category === 2) {
            try {
              const jsonResponse = await axios.get(
                `http://localhost:5000/api/documents/${processId}/data`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              setJsonContent(JSON.stringify(jsonResponse.data.data, null, 2));
            } catch (jsonErr) {
              console.error('Error loading JSON content:', jsonErr);
            }
          }
        } catch (err) {
          console.error('DEBUG ERROR: Error fetching extracted data:', err);
          console.error('DEBUG ERROR: Response data:', err.response?.data);
          console.error('DEBUG ERROR: Status:', err.response?.status);
        }
      }

      setError('');
    } catch (err) {
      console.error('Error fetching document:', err);
      setError('Failed to load document details');
    } finally {
      setLoading(false);
    }
  };

  const navigateToPdfPage = (pageNumber) => {
    if (pdfViewerRef.current && pdfUrl) {
      const newUrl = `${pdfUrl}#page=${pageNumber}`;
      pdfViewerRef.current.src = newUrl;
      setCurrentPage(pageNumber);
    }
  };

  const handleCellEdit = (rowIndex, field, value) => {
    const newData = [...editedData];
    newData[rowIndex][field] = value;
    setEditedData(newData);
  };

  const handleAddNewRecord = () => {
    // Create a new empty record with fields in the defined column order
    const newRecord = {};
    COLUMN_ORDER.forEach(field => {
      newRecord[field] = '';
    });

    setEditedData([...editedData, newRecord]);
    setSuccess('New record added. Don\'t forget to save!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const newSelected = editedData.map((_, index) => index);
      setSelected(newSelected);
    } else {
      setSelected([]);
    }
  };

  const handleSelectRow = (index) => {
    const selectedIndex = selected.indexOf(index);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = [...selected, index];
    } else {
      newSelected = selected.filter(i => i !== selectedIndex);
    }

    setSelected(newSelected);
  };

  const handleDeleteSelected = () => {
    if (selected.length === 0) {
      setError('Please select records to delete');
      setTimeout(() => setError(''), 3000);
      return;
    }
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    // Remove selected records from editedData
    const newData = editedData.filter((_, index) => !selected.includes(index));
    setEditedData(newData);
    setSelected([]);
    setDeleteDialogOpen(false);
    setSuccess(`${selected.length} record(s) deleted. Don't forget to save!`);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');

      // Remove metadata before saving
      const recordsToSave = editedData.map(record => {
        const { id, _metadata, ...cleanRecord } = record;
        return cleanRecord;
      });

      await axios.post(
        `http://localhost:5000/api/documents/${processId}/extracted-data`,
        { records: recordsToSave },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Refresh data from database
      await fetchDocumentDetails();

      setSuccess('Data saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving data:', err);
      setError('Failed to save changes');
      setTimeout(() => setError(''), 5000);
    } finally {
      setSaving(false);
    }
  };

  // Define fixed column order
  const COLUMN_ORDER = [
    'Original_page_no',
    'EOB_page_no',
    'patient_acct',
    'Patient_ID',
    'Claim_ID',
    'Patient Name',
    'First_Name',
    'Last Name',
    'member_number',
    'service_date',
    'allowed_amount',
    'interest_amount',
    'paid_amount',
    'insurance_co',
    'billed_amount',
    'cpt_hcpcs',
    'adj_co45',
    'adj_co144',
    'adj_co253',
    'check_number',
    'account_number',
    'patient_responsibility',
    'claim_summary',
    'action_required',
    'reason_code_comments',
    'Confidence_Score'
  ];

  const getFieldKeys = () => {
    if (editedData.length === 0) return COLUMN_ORDER;

    // Get all unique keys from the data
    const dataKeys = Object.keys(editedData[0]).filter(k => k !== 'id' && k !== '_metadata');

    // Return columns in the defined order, plus any additional columns not in the order
    const orderedKeys = COLUMN_ORDER.filter(col => dataKeys.includes(col));
    const extraKeys = dataKeys.filter(col => !COLUMN_ORDER.includes(col));

    return [...orderedKeys, ...extraKeys];
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!document) {
    return (
      <Box>
        <Alert severity="error">Document not found</Alert>
      </Box>
    );
  }

  const isSelected = (index) => selected.indexOf(index) !== -1;

  // Check if this is a Facesheet document
  const isFacesheet = document.doc_category === '2' || document.doc_category === 2;

  const handleDownloadJson = () => {
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${document.original_filename.replace('.pdf', '')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/documents')} sx={{ mr: 2 }}>
          <BackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4">Document Details</Typography>
          <Typography variant="body2" color="text.secondary">
            Process ID: {document.process_id} | Filename: {document.original_filename} | Status: {document.processing_status}
          </Typography>
        </Box>
        {pdfUrl && document.processing_status === 'Processed' && (
          <Button
            variant="outlined"
            startIcon={showPdf ? <VisibilityOffIcon /> : <VisibilityIcon />}
            onClick={() => setShowPdf(!showPdf)}
            sx={{ ml: 2 }}
          >
            {showPdf ? 'Hide PDF' : 'Show PDF'}
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* Split Layout: Data Grid or JSON (Left) + PDF Viewer (Right) */}
      <Grid container spacing={2}>
        {/* Left Side - Editable Data Grid or JSON Viewer */}
        <Grid item xs={12} md={pdfUrl && showPdf ? 7 : 12}>
          {/* Show JSON Viewer for Facesheet documents */}
          {isFacesheet && document.processing_status === 'Processed' && (
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  <CodeIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                  Facesheet Data (JSON)
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadJson}
                  disabled={!jsonContent}
                >
                  Download JSON
                </Button>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Tabs value={jsonTab} onChange={(e, newValue) => setJsonTab(newValue)}>
                  <Tab label="Formatted View" />
                  <Tab label="Raw JSON" />
                </Tabs>
              </Box>

              {jsonTab === 0 && (
                <Box sx={{ 
                  maxHeight: '70vh', 
                  overflow: 'auto',
                  border: '1px solid #e0e0e0',
                  borderRadius: 1,
                  p: 2,
                  bgcolor: '#f5f5f5'
                }}>
                  {extractedData.length > 0 ? (
                    extractedData.map((record, index) => (
                      <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: 'white' }}>
                        <Typography variant="subtitle2" color="primary" gutterBottom>
                          Record #{index + 1}
                        </Typography>
                        <Divider sx={{ mb: 1 }} />
                        <Grid container spacing={2}>
                          {Object.entries(record).filter(([key]) => key !== 'id' && key !== '_metadata').map(([key, value]) => {
                            // Handle different value types
                            let displayValue;
                            if (value === null || value === undefined || value === '') {
                              displayValue = <em style={{ color: '#999' }}>-</em>;
                            } else if (typeof value === 'object') {
                              // If it's an object or array, stringify it
                              displayValue = JSON.stringify(value, null, 2);
                            } else {
                              displayValue = String(value);
                            }
                            
                            return (
                              <Grid item xs={12} sm={6} md={4} key={key}>
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {key.replace(/_/g, ' ').toUpperCase()}
                                </Typography>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    wordBreak: 'break-word',
                                    whiteSpace: 'pre-wrap',
                                    fontFamily: typeof value === 'object' ? 'monospace' : 'inherit',
                                    fontSize: typeof value === 'object' ? '0.75rem' : 'inherit'
                                  }}
                                >
                                  {displayValue}
                                </Typography>
                              </Grid>
                            );
                          })}
                        </Grid>
                      </Paper>
                    ))
                  ) : (
                    <Typography color="text.secondary" align="center">
                      No data available
                    </Typography>
                  )}
                </Box>
              )}

              {jsonTab === 1 && (
                <Box sx={{ 
                  maxHeight: '70vh', 
                  overflow: 'auto',
                  border: '1px solid #e0e0e0',
                  borderRadius: 1,
                  bgcolor: '#1e1e1e',
                  color: '#d4d4d4',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  lineHeight: 1.6
                }}>
                  <pre style={{ margin: 0, padding: '16px' }}>
                    {jsonContent || 'Loading...'}
                  </pre>
                </Box>
              )}
            </Paper>
          )}

          {/* Show Editable Table for non-Facesheet documents */}
          {!isFacesheet && document.processing_status === 'Processed' && editedData.length >= 0 && (
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Extracted Data ({editedData.length} record{editedData.length !== 1 ? 's' : ''})
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={handleAddNewRecord}
                    disabled={saving}
                  >
                    Add Record
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={handleDeleteSelected}
                    disabled={saving || selected.length === 0}
                  >
                    Delete Selected ({selected.length})
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </Box>
              </Box>

              <TableContainer sx={{ maxHeight: 600, overflowY: 'auto' }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" sx={{ bgcolor: 'primary.main', color: 'white' }}>
                        <Checkbox
                          color="default"
                          indeterminate={selected.length > 0 && selected.length < editedData.length}
                          checked={editedData.length > 0 && selected.length === editedData.length}
                          onChange={handleSelectAll}
                          sx={{ color: 'white' }}
                        />
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>#</TableCell>
                      {getFieldKeys().map((key) => (
                        <TableCell key={key} sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold', minWidth: 120 }}>
                          {key.replace(/_/g, ' ').toUpperCase()}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {editedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={getFieldKeys().length + 2} align="center" sx={{ py: 5 }}>
                          <Typography color="text.secondary">
                            No records found. Click "Add Record" to create one.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      editedData.map((row, rowIndex) => {
                        const isItemSelected = isSelected(rowIndex);
                        return (
                          <TableRow
                            key={rowIndex}
                            hover
                            onClick={() => handleSelectRow(rowIndex)}
                            role="checkbox"
                            aria-checked={isItemSelected}
                            selected={isItemSelected}
                            sx={{ cursor: 'pointer' }}
                          >
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={isItemSelected}
                                onChange={() => handleSelectRow(rowIndex)}
                              />
                            </TableCell>
                            <TableCell>{rowIndex + 1}</TableCell>
                            {getFieldKeys().map((key) => (
                              <TableCell key={key} onClick={(e) => e.stopPropagation()}>
                                {(key === 'Original_page_no' || key === 'EOB_page_no') && row[key] && pdfUrl ? (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <TextField
                                      fullWidth
                                      size="small"
                                      value={row[key] || ''}
                                      onChange={(e) => handleCellEdit(rowIndex, key, e.target.value)}
                                      variant="outlined"
                                    />
                                    <Link
                                      component="button"
                                      variant="body2"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigateToPdfPage(parseInt(row[key]));
                                      }}
                                      sx={{ cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                                    >
                                      View
                                    </Link>
                                  </Box>
                                ) : (
                                  <TextField
                                    fullWidth
                                    size="small"
                                    value={row[key] || ''}
                                    onChange={(e) => handleCellEdit(rowIndex, key, e.target.value)}
                                    variant="outlined"
                                  />
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {document.processing_status === 'In-Progress' && (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <CircularProgress size={40} />
              <Typography variant="body1" sx={{ mt: 2 }}>
                Document is being processed...
              </Typography>
            </Paper>
          )}

          {document.processing_status === 'Failed' && (
            <Alert severity="error">
              Document processing failed. Please try uploading again.
            </Alert>
          )}
        </Grid>

        {/* Right Side - PDF Viewer */}
        {pdfUrl && document.processing_status === 'Processed' && showPdf && (
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 2, position: 'sticky', top: 20 }}>
              <Typography variant="h6" gutterBottom>
                PDF Preview
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box
                sx={{
                  width: '100%',
                  height: '80vh',
                  overflow: 'hidden',
                  borderRadius: 1,
                  border: '1px solid #ccc'
                }}
              >
                <iframe
                  ref={pdfViewerRef}
                  src={`${pdfUrl}#page=${currentPage}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none'
                  }}
                  title="PDF Viewer"
                />
              </Box>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete {selected.length} selected record(s)?
            This action cannot be undone after saving.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DocumentDetails;
