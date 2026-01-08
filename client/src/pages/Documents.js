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
  Chip,
  IconButton,
  TextField,
  MenuItem,
  Grid,
  Pagination,
  Button,
  CircularProgress,
  Alert,
  Tooltip,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  PictureAsPdf as PdfIcon,
  TableChart as CsvIcon,
  Code as JsonIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const Documents = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Delete functionality state
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  useEffect(() => {
    fetchDocuments();
  }, [statusFilter, categoryFilter, fromDate, toDate, page]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('No authentication token found. Please log in again.');
        setLoading(false);
        return;
      }
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });
      
      if (statusFilter) {
        params.append('status', statusFilter);
      }
      
      if (categoryFilter) {
        params.append('doc_category', categoryFilter);
      }
      
      if (fromDate) {
        params.append('from_date', fromDate);
      }
      
      if (toDate) {
        params.append('to_date', toDate);
      }
      
      console.log('Fetching documents with URL:', `http://localhost:5000/api/documents?${params}`);
      
      const response = await axios.get(
        `http://localhost:5000/api/documents?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      console.log('Documents fetched successfully:', response.data);
      const firstDoc = response.data.data?.[0];
      console.log('First document data:', firstDoc); // Debug log
      console.log('First document category_name:', firstDoc?.category_name);
      console.log('First document doc_category:', firstDoc?.doc_category);
      console.log('First document doc_category type:', typeof firstDoc?.doc_category);
      setDocuments(response.data.data || []);
      setTotalPages(response.data.pagination?.totalPages || 1);
      setError('');
    } catch (err) {
      console.error('Error fetching documents:', err);
      console.error('Error response:', err.response);
      console.error('Error message:', err.message);
      
      if (err.response) {
        setError(`Failed to load documents: ${err.response.data?.message || err.response.statusText}`);
      } else if (err.request) {
        setError('Failed to load documents: No response from server. Please check if the backend is running.');
      } else {
        setError(`Failed to load documents: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Processed':
        return 'success';
      case 'In-Progress':
        return 'warning';
      case 'Failed':
        return 'error';
      case 'Pending':
        return 'info';
      default:
        return 'default';
    }
  };

  const handleViewDetails = (processId) => {
    navigate(`/documents/${processId}`);
  };

  const handleDownload = async (processId, fileType, originalFilename) => {
    try {
      console.log('Download initiated:', { processId, fileType, originalFilename });
      const token = localStorage.getItem('token');

      const url = `http://localhost:5000/api/documents/${processId}/download/${fileType}`;
      console.log('Request URL:', url);

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      console.log('Response received:', response.status, response.headers);

      // Generate download filename based on original filename
      let downloadFilename;
      if (fileType === 'pdf') {
        downloadFilename = originalFilename;
      } else {
        const filenameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
        downloadFilename = `${filenameWithoutExt}.${fileType}`;
      }

      console.log('Download filename:', downloadFilename);

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', downloadFilename);
      document.body.appendChild(link);
      link.click();
      link.remove();

      console.log('Download triggered successfully');
    } catch (err) {
      console.error('Download error:', err);
      console.error('Error response:', err.response);
      alert(`Failed to download file: ${err.response?.data?.message || err.message}`);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const formatTime = (seconds) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const filteredDocuments = documents.filter(doc =>
    searchTerm === '' || 
    doc.original_filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.session_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleClearFilters = () => {
    setStatusFilter('');
    setCategoryFilter('');
    setFromDate('');
    setToDate('');
    setSearchTerm('');
    setPage(1);
  };

  // Selection handlers
  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedDocs(filteredDocuments.map(doc => doc.process_id));
    } else {
      setSelectedDocs([]);
    }
  };

  const handleSelectDoc = (processId) => {
    setSelectedDocs(prev =>
      prev.includes(processId)
        ? prev.filter(id => id !== processId)
        : [...prev, processId]
    );
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeleting(true);
      const token = localStorage.getItem('token');

      // Delete each selected document
      const deletePromises = selectedDocs.map(processId =>
        axios.delete(`http://localhost:5000/api/documents/${processId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      );

      await Promise.all(deletePromises);

      setSelectedDocs([]);
      setDeleteDialogOpen(false);
      fetchDocuments();
    } catch (err) {
      console.error('Delete error:', err);
      setError(`Failed to delete documents: ${err.response?.data?.message || err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">Documents</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {isAdmin && selectedDocs.length > 0 && (
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDeleteClick}
            >
              Delete ({selectedDocs.length})
            </Button>
          )}
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchDocuments}>
            Refresh
          </Button>
          <Button variant="outlined" color="secondary" onClick={handleClearFilters}>
            Clear Filters
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              placeholder="Search by filename..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
              InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField 
              fullWidth 
              select 
              label="Status" 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              size="small"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Pending">Pending</MenuItem>
              <MenuItem value="In-Progress">In Progress</MenuItem>
              <MenuItem value="Processed">Processed</MenuItem>
              <MenuItem value="Failed">Failed</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField 
              fullWidth 
              select 
              label="Doc Category" 
              value={categoryFilter} 
              onChange={(e) => setCategoryFilter(e.target.value)}
              size="small"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="1">EOB</MenuItem>
              <MenuItem value="2">Facesheet</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              type="date"
              label="From Date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              type="date"
              label="To Date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={1}>
            <Typography variant="body2" color="text.secondary" textAlign="right">
              Total: {filteredDocuments.length}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper} elevation={2}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#1976d2' }}>
              {isAdmin && (
                <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 2, width: 50 }}>
                  <Checkbox
                    checked={filteredDocuments.length > 0 && selectedDocs.length === filteredDocuments.length}
                    indeterminate={selectedDocs.length > 0 && selectedDocs.length < filteredDocuments.length}
                    onChange={handleSelectAll}
                    sx={{ color: 'white', '&.Mui-checked': { color: 'white' }, '&.MuiCheckbox-indeterminate': { color: 'white' } }}
                  />
                </TableCell>
              )}
              <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 2 }}>Process ID</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 2 }}>Document Name</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 2 }}>Client</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 2 }}>Model</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 2 }}>Category</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 2 }}>Pages</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 2 }}>Records</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 2 }}>Status</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 2 }}>Uploaded</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 2 }}>Time</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 2 }}>Cost</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold', py: 2 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 13 : 12} align="center" sx={{ py: 5 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : filteredDocuments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 13 : 12} align="center" sx={{ py: 5 }}>
                  <Typography color="text.secondary">No documents found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredDocuments.map((doc, index) => (
                <TableRow
                  key={doc.process_id}
                  hover
                  selected={selectedDocs.includes(doc.process_id)}
                  sx={{
                    '&:nth-of-type(odd)': { bgcolor: 'action.hover' },
                    '&:hover': { bgcolor: 'action.selected' }
                  }}
                >
                  {isAdmin && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedDocs.includes(doc.process_id)}
                        onChange={() => handleSelectDoc(doc.process_id)}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {doc.process_id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={doc.original_filename}>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>
                        {doc.original_filename}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {doc.client_name || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {doc.effective_model_id ? `Model ID: ${doc.effective_model_id}` : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {doc.category_name || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2">
                      {doc.no_of_pages || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight="medium">
                      {doc.total_records || 0}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={doc.processing_status} 
                      color={getStatusColor(doc.processing_status)} 
                      size="small"
                      sx={{ fontWeight: 'medium', minWidth: 90 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                      {formatDate(doc.time_initiated)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatTime(doc.total_processing_time)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium" color="success.main">
                      ${doc.cost ? Number(doc.cost).toFixed(4) : '0.0000'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'nowrap' }}>
                      <Tooltip title="View Details">
                        <IconButton 
                          size="small" 
                          color="primary" 
                          onClick={() => handleViewDetails(doc.process_id)}
                          sx={{ p: 0.5 }}
                        >
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {doc.processing_status === 'Processed' && (() => {
                        // Check if this is a Facesheet document
                        const isFacesheet = doc.category_name?.toLowerCase() === 'facesheet' || 
                                           doc.doc_category === '2' || 
                                           doc.doc_category === 2 ||
                                           String(doc.doc_category) === '2';
                        
                        return (
                          <>
                            <Tooltip title="Download PDF">
                              <IconButton 
                                size="small" 
                                color="error" 
                                onClick={() => handleDownload(doc.process_id, 'pdf', doc.original_filename)}
                                sx={{ p: 0.5 }}
                              >
                                <PdfIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {/* Hide CSV download for Facesheet documents */}
                            {!isFacesheet && (
                              <Tooltip title="Download CSV">
                                <IconButton 
                                  size="small" 
                                  color="success" 
                                  onClick={() => handleDownload(doc.process_id, 'csv', doc.original_filename)}
                                  sx={{ p: 0.5 }}
                                >
                                  <CsvIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Download JSON">
                              <IconButton 
                                size="small" 
                                color="info" 
                                onClick={() => handleDownload(doc.process_id, 'json', doc.original_filename)}
                                sx={{ p: 0.5 }}
                              >
                                <JsonIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        );
                      })()}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(e, value) => setPage(value)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete {selectedDocs.length} document{selectedDocs.length > 1 ? 's' : ''}?
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Documents;
