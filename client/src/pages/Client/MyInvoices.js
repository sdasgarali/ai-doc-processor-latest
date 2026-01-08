import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  GetApp as DownloadIcon,
  Receipt as ReceiptIcon,
  AttachMoney as MoneyIcon
} from '@mui/icons-material';
import axios from 'axios';

const MyInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/billing/invoices', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setInvoices(response.data.data || []);
      setError('');
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError('Failed to load invoices');
    } finally {
      setLoading(false);
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
      
      setSuccess('Invoice downloaded successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      setError('Failed to download invoice');
    }
  };

  const handlePayOnline = (paymentLink) => {
    // Open payment page in new tab
    window.open(`/payment/${paymentLink}`, '_blank');
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
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Calculate summary
  const summary = {
    total: invoices.length,
    unpaid: invoices.filter(inv => inv.status === 'unpaid' || inv.status === 'overdue').length,
    total_outstanding: invoices
      .filter(inv => inv.status !== 'paid')
      .reduce((sum, inv) => sum + parseFloat(inv.amount_due), 0)
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      </Paper>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        My Invoices
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ReceiptIcon color="primary" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Invoices
                  </Typography>
                  <Typography variant="h6">{summary.total}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ReceiptIcon color="warning" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Unpaid Invoices
                  </Typography>
                  <Typography variant="h6">{summary.unpaid}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MoneyIcon color="error" />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Outstanding
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(summary.total_outstanding)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Invoices List */}
      {invoices.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center' }}>
          <ReceiptIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No invoices found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            You don't have any invoices yet.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {invoices.map((invoice) => (
            <Grid item xs={12} key={invoice.invoice_id}>
              <Card>
                <CardContent>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="text.secondary">
                        Invoice Number
                      </Typography>
                      <Typography variant="h6">
                        {invoice.invoice_number}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={2}>
                      <Typography variant="body2" color="text.secondary">
                        Date
                      </Typography>
                      <Typography variant="body1">
                        {formatDate(invoice.invoice_date)}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={2}>
                      <Typography variant="body2" color="text.secondary">
                        Due Date
                      </Typography>
                      <Typography variant="body1">
                        {formatDate(invoice.due_date)}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={2}>
                      <Typography variant="body2" color="text.secondary">
                        Amount
                      </Typography>
                      <Typography variant="h6" color="primary">
                        {formatCurrency(invoice.amount_due)}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={1}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Status
                      </Typography>
                      <Chip 
                        label={invoice.status} 
                        color={getStatusColor(invoice.status)} 
                        size="small"
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={2}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<DownloadIcon />}
                          onClick={() => handleDownloadPDF(invoice.invoice_id, invoice.invoice_number)}
                          fullWidth
                        >
                          Download PDF
                        </Button>
                        {(invoice.status === 'unpaid' || invoice.status === 'overdue') && (
                          <Button
                            variant="contained"
                            size="small"
                            color="primary"
                            onClick={() => handlePayOnline(invoice.payment_link)}
                            fullWidth
                          >
                            Pay Online
                          </Button>
                        )}
                      </Box>
                    </Grid>
                  </Grid>
                  
                  {invoice.notes && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="body2" color="text.secondary">
                        <strong>Notes:</strong> {invoice.notes}
                      </Typography>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default MyInvoices;
