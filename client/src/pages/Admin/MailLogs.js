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
  Chip,
  Alert,
  CircularProgress,
  Tooltip,
  TextField,
  MenuItem,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Replay as RetryIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import axios from 'axios';

const MailLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Filters
  const [filters, setFilters] = useState({
    status: '',
    email_type: ''
  });
  
  // Dialog state
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Build query string
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.email_type) params.append('email_type', filters.email_type);
      
      const response = await axios.get(
        `/api/billing/mail-logs?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setLogs(response.data.data || []);
      setError('');
    } catch (err) {
      console.error('Error fetching mail logs:', err);
      setError('Failed to load mail logs');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (mailLogId) => {
    if (!window.confirm('Retry sending this email?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `/api/billing/mail-logs/${mailLogId}/retry`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess('Email retry initiated successfully!');
      fetchLogs();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error retrying email:', err);
      setError(err.response?.data?.message || 'Failed to retry email');
    }
  };

  const handleViewEmail = (log) => {
    setSelectedLog(log);
    setOpenViewDialog(true);
  };

  const handleCloseViewDialog = () => {
    setOpenViewDialog(false);
    setSelectedLog(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'sent': return 'success';
      case 'failed': return 'error';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  const getEmailTypeLabel = (type) => {
    switch (type) {
      case 'invoice_generated': return 'Invoice Generated';
      case 'payment_reminder': return 'Payment Reminder';
      case 'payment_received': return 'Payment Received';
      default: return type;
    }
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">Email Logs</Typography>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchLogs}>
          Refresh
        </Button>
      </Box>

      {/* Filters */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            select
            fullWidth
            size="small"
            label="Status"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="sent">Sent</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
          </TextField>
        </Grid>
        
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            select
            fullWidth
            size="small"
            label="Email Type"
            value={filters.email_type}
            onChange={(e) => setFilters({ ...filters, email_type: e.target.value })}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="invoice_generated">Invoice Generated</MenuItem>
            <MenuItem value="payment_reminder">Payment Reminder</MenuItem>
            <MenuItem value="payment_received">Payment Received</MenuItem>
          </TextField>
        </Grid>
      </Grid>

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
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Invoice #</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Client</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Email Type</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Recipient</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Retry Count</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Sent At</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">No email logs found</TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.mail_log_id} hover>
                    <TableCell>{log.mail_log_id}</TableCell>
                    <TableCell>{log.invoice_number || '-'}</TableCell>
                    <TableCell>{log.client_name || '-'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={getEmailTypeLabel(log.email_type)} 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{log.recipient_email}</TableCell>
                    <TableCell>
                      <Chip 
                        label={log.status} 
                        color={getStatusColor(log.status)} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell align="center">
                      {log.retry_count > 0 ? (
                        <Chip label={log.retry_count} color="warning" size="small" />
                      ) : (
                        log.retry_count
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap>
                        {log.sent_at ? formatDateTime(log.sent_at) : 'Not sent'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="View Email">
                          <IconButton 
                            size="small" 
                            color="primary"
                            onClick={() => handleViewEmail(log)}
                          >
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {log.status === 'failed' && log.retry_count < 3 && (
                          <Tooltip title="Retry Email">
                            <IconButton 
                              size="small" 
                              color="warning"
                              onClick={() => handleRetry(log.mail_log_id)}
                            >
                              <RetryIcon fontSize="small" />
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

      {/* View Email Dialog */}
      <Dialog open={openViewDialog} onClose={handleCloseViewDialog} maxWidth="md" fullWidth>
        <DialogTitle>Email Details</DialogTitle>
        <DialogContent>
          {selectedLog && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Email Type:</Typography>
                  <Typography variant="body1">{getEmailTypeLabel(selectedLog.email_type)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Status:</Typography>
                  <Chip 
                    label={selectedLog.status} 
                    color={getStatusColor(selectedLog.status)} 
                    size="small" 
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Recipient:</Typography>
                  <Typography variant="body1">{selectedLog.recipient_email}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Sent At:</Typography>
                  <Typography variant="body1">
                    {selectedLog.sent_at ? formatDateTime(selectedLog.sent_at) : 'Not sent'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Subject:</Typography>
                  <Typography variant="body1">{selectedLog.subject}</Typography>
                </Grid>
                {selectedLog.error_message && (
                  <Grid item xs={12}>
                    <Alert severity="error">
                      <Typography variant="body2" fontWeight="bold">Error:</Typography>
                      <Typography variant="body2">{selectedLog.error_message}</Typography>
                    </Alert>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Email Body:
                  </Typography>
                  <Paper 
                    variant="outlined" 
                    sx={{ p: 2, maxHeight: 400, overflow: 'auto', bgcolor: 'grey.50' }}
                  >
                    {selectedLog.body ? (
                      <div dangerouslySetInnerHTML={{ __html: selectedLog.body }} />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No body content available
                      </Typography>
                    )}
                  </Paper>
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Retry Count: {selectedLog.retry_count}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Created: {formatDateTime(selectedLog.created_at)}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {selectedLog?.status === 'failed' && selectedLog?.retry_count < 3 && (
            <Button 
              onClick={() => {
                handleCloseViewDialog();
                handleRetry(selectedLog.mail_log_id);
              }} 
              color="warning"
              startIcon={<RetryIcon />}
            >
              Retry Email
            </Button>
          )}
          <Button onClick={handleCloseViewDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default MailLogs;
