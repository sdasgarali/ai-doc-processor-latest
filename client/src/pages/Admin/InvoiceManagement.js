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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Card,
  CardContent
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  GetApp as DownloadIcon,
  Send as SendIcon,
  Edit as EditIcon,
  Autorenew as GenerateIcon,
  AttachMoney as MoneyIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Notifications as NotificationIcon
} from '@mui/icons-material';
import axios from 'axios';

const InvoiceManagement = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generating, setGenerating] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    status: '',
    client_id: '',
    month: '',
    year: new Date().getFullYear().toString()
  });
  
  // Statistics
  const [stats, setStats] = useState({
    total_billed: 0,
    total_paid: 0,
    total_outstanding: 0,
    overdue_count: 0
  });
  
  // Dialog states
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [editData, setEditData] = useState({
    status: '',
    notes: ''
  });

  useEffect(() => {
    fetchInvoices();
  }, [filters]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Build query string
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.client_id) params.append('client_id', filters.client_id);
      if (filters.month) params.append('month', filters.month);
      if (filters.year) params.append('year', filters.year);
      
      const response = await axios.get(
        `http://localhost:5000/api/billing/invoices?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const invoiceData = response.data.data || [];
      setInvoices(invoiceData);
      
      // Calculate statistics
      const stats = {
        total_billed: invoiceData.reduce((sum, inv) => sum + parseFloat(inv.amount_due), 0),
        total_paid: invoiceData.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + parseFloat(inv.amount_due), 0),
        total_outstanding: invoiceData.filter(inv => inv.status !== 'paid').reduce((sum, inv) => sum + parseFloat(inv.amount_due), 0),
        overdue_count: invoiceData.filter(inv => inv.status === 'overdue').length
      };
      setStats(stats);
      setError('');
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvoices = async () => {
    if (!window.confirm('Generate invoices for all clients this month?')) {
      return;
    }

    try {
      setGenerating(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:5000/api/billing/invoices/generate',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess(`Generated ${response.data.data.invoices.length} invoices!`);
      fetchInvoices();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error generating invoices:', err);
      setError(err.response?.data?.message || 'Failed to generate invoices');
    } finally {
      setGenerating(false);
    }
  };

  const handleSendEmail = async (invoiceId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:5000/api/billing/invoices/${invoiceId}/send`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess('Invoice email sent successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error sending email:', err);
      setError('Failed to send email');
    }
  };

  const handleDownloadPDF = async (invoiceId, invoiceNumber) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `http://localhost:5000/api/billing/invoices/${invoiceId}/pdf`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Invoice_${invoiceNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error downloading PDF:', err);
      setError('Failed to download PDF');
    }
  };

  const handleOpenEditDialog = (invoice) => {
    setEditingInvoice(invoice);
    setEditData({
      status: invoice.status,
      notes: invoice.notes || ''
    });
    setOpenEditDialog(true);
  };

  const handleCloseEditDialog = () => {
    setOpenEditDialog(false);
    setEditingInvoice(null);
  };

  const handleUpdateInvoice = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:5000/api/billing/invoices/${editingInvoice.invoice_id}`,
        editData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess('Invoice updated successfully!');
      handleCloseEditDialog();
      fetchInvoices();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating invoice:', err);
      setError('Failed to update invoice');
    }
  };

  const handleSendReminders = async () => {
    if (!window.confirm('Send reminders to all overdue invoices?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        'http://localhost:5000/api/billing/reminders/send',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess('Reminders sent successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error sending reminders:', err);
      setError('Failed to send reminders');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'success';
      case 'unpaid': return 'warning';
      case 'overdue': return 'error';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Box>
      {/* Statistics Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MoneyIcon color="primary" />
                <Box>
                  <Typography variant="body2" color="text.secondary">Total Billed</Typography>
                  <Typography variant="h6">{formatCurrency(stats.total_billed)}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckIcon color="success" />
                <Box>
                  <Typography variant="body2" color="text.secondary">Total Paid</Typography>
                  <Typography variant="h6">{formatCurrency(stats.total_paid)}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon color="warning" />
                <Box>
                  <Typography variant="body2" color="text.secondary">Outstanding</Typography>
                  <Typography variant="h6">{formatCurrency(stats.total_outstanding)}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <NotificationIcon color="error" />
                <Box>
                  <Typography variant="body2" color="text.secondary">Overdue</Typography>
                  <Typography variant="h6">{stats.overdue_count}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">Invoice Management</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchInvoices}>
              Refresh
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<NotificationIcon />} 
              onClick={handleSendReminders}
              color="warning"
            >
              Send Reminders
            </Button>
            <Button 
              variant="contained" 
              startIcon={<GenerateIcon />} 
              onClick={handleGenerateInvoices}
              disabled={generating}
            >
              {generating ? 'Generating...' : 'Generate Invoices'}
            </Button>
          </Box>
        </Box>

        {/* Filters */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              size="small"
              label="Status"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="unpaid">Unpaid</MenuItem>
              <MenuItem value="paid">Paid</MenuItem>
              <MenuItem value="overdue">Overdue</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </TextField>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              size="small"
              label="Month"
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: e.target.value })}
            >
              <MenuItem value="">All</MenuItem>
              {[...Array(12)].map((_, i) => (
                <MenuItem key={i + 1} value={`${filters.year}-${String(i + 1).padStart(2, '0')}`}>
                  {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Year"
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: e.target.value })}
            />
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
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Invoice #</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Client</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Due Date</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Amount</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">No invoices found</TableCell>
                  </TableRow>
                ) : (
                  invoices.map((invoice) => (
                    <TableRow key={invoice.invoice_id} hover>
                      <TableCell>{invoice.invoice_number}</TableCell>
                      <TableCell>{invoice.client_name}</TableCell>
                      <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                      <TableCell>{formatDate(invoice.due_date)}</TableCell>
                      <TableCell>{formatCurrency(invoice.amount_due)}</TableCell>
                      <TableCell>
                        <Chip label={invoice.status} color={getStatusColor(invoice.status)} size="small" />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Download PDF">
                            <IconButton 
                              size="small" 
                              color="primary"
                              onClick={() => handleDownloadPDF(invoice.invoice_id, invoice.invoice_number)}
                            >
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Send Email">
                            <IconButton 
                              size="small" 
                              color="info"
                              onClick={() => handleSendEmail(invoice.invoice_id)}
                            >
                              <SendIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit Invoice">
                            <IconButton 
                              size="small" 
                              color="warning"
                              onClick={() => handleOpenEditDialog(invoice)}
                            >
                              <EditIcon fontSize="small" />
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
      </Paper>

      {/* Edit Invoice Dialog */}
      <Dialog open={openEditDialog} onClose={handleCloseEditDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Invoice</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              select
              label="Status"
              fullWidth
              value={editData.status}
              onChange={(e) => setEditData({ ...editData, status: e.target.value })}
            >
              <MenuItem value="unpaid">Unpaid</MenuItem>
              <MenuItem value="paid">Paid</MenuItem>
              <MenuItem value="overdue">Overdue</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </TextField>
            
            <TextField
              label="Notes"
              fullWidth
              multiline
              rows={4}
              value={editData.notes}
              onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog}>Cancel</Button>
          <Button onClick={handleUpdateInvoice} variant="contained">
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InvoiceManagement;
