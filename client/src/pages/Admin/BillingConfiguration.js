import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Divider,
  InputAdornment
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from 'axios';

const BillingConfiguration = () => {
  const [config, setConfig] = useState({
    system_mailer: '',
    invoice_date_day: 1,
    due_date_day: 15,
    reminder_frequency_days: 7,
    max_reminder_count: 3,
    tax_rate: 0,
    company_name: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    currency: 'USD',
    auto_generate_enabled: true
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/billing/config', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfig(response.data.data);
      setError('');
    } catch (err) {
      console.error('Error fetching config:', err);
      setError('Failed to load billing configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (config.invoice_date_day < 1 || config.invoice_date_day > 28) {
      setError('Invoice date day must be between 1 and 28');
      return;
    }
    
    if (config.due_date_day < 1 || config.due_date_day > 28) {
      setError('Due date day must be between 1 and 28');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      await axios.put(
        '/api/billing/config',
        config,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess('Billing configuration saved successfully!');
      setError('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving config:', err);
      setError(err.response?.data?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
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
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">Billing Configuration</Typography>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchConfig}>
          Refresh
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Email Settings */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Email Settings
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="System Mailer Email"
              type="email"
              required
              value={config.system_mailer}
              onChange={(e) => handleChange('system_mailer', e.target.value)}
              helperText="Email address used for sending invoices"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Company Email"
              type="email"
              value={config.company_email}
              onChange={(e) => handleChange('company_email', e.target.value)}
              helperText="Company contact email on invoices"
            />
          </Grid>

          {/* Invoice Settings */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ mt: 2 }}>
              Invoice Settings
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Invoice Generation Day"
              type="number"
              required
              value={config.invoice_date_day}
              onChange={(e) => handleChange('invoice_date_day', parseInt(e.target.value))}
              inputProps={{ min: 1, max: 28 }}
              helperText="Day of month (1-28)"
            />
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Payment Due Date Day"
              type="number"
              required
              value={config.due_date_day}
              onChange={(e) => handleChange('due_date_day', parseInt(e.target.value))}
              inputProps={{ min: 1, max: 28 }}
              helperText="Day of month (1-28)"
            />
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Currency"
              required
              value={config.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
              helperText="e.g., USD, EUR, GBP"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Tax Rate"
              type="number"
              required
              value={config.tax_rate}
              onChange={(e) => handleChange('tax_rate', parseFloat(e.target.value))}
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
              inputProps={{ min: 0, max: 100, step: 0.01 }}
              helperText="Tax percentage applied to invoices"
            />
          </Grid>

          {/* Reminder Settings */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ mt: 2 }}>
              Payment Reminder Settings
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Reminder Frequency"
              type="number"
              required
              value={config.reminder_frequency_days}
              onChange={(e) => handleChange('reminder_frequency_days', parseInt(e.target.value))}
              InputProps={{
                endAdornment: <InputAdornment position="end">days</InputAdornment>,
              }}
              inputProps={{ min: 1, max: 30 }}
              helperText="Days between reminder emails"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Maximum Reminders"
              type="number"
              required
              value={config.max_reminder_count}
              onChange={(e) => handleChange('max_reminder_count', parseInt(e.target.value))}
              inputProps={{ min: 1, max: 10 }}
              helperText="Max reminder emails per invoice"
            />
          </Grid>

          {/* Company Details */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ mt: 2 }}>
              Company Details (shown on invoices)
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Company Name"
              required
              value={config.company_name}
              onChange={(e) => handleChange('company_name', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Company Phone"
              value={config.company_phone}
              onChange={(e) => handleChange('company_phone', e.target.value)}
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Company Address"
              multiline
              rows={3}
              value={config.company_address}
              onChange={(e) => handleChange('company_address', e.target.value)}
              helperText="Full address including city, state, zip"
            />
          </Grid>

          {/* Auto Generation */}
          <Grid item xs={12}>
            <Box sx={{ 
              p: 2, 
              bgcolor: 'info.lighter', 
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'info.main'
            }}>
              <Typography variant="body2" color="info.dark">
                <strong>Note:</strong> Invoices will be automatically generated on the {config.invoice_date_day}th 
                of each month via cron job. Payment reminders will be sent every {config.reminder_frequency_days} days 
                for up to {config.max_reminder_count} reminders per invoice.
              </Typography>
            </Box>
          </Grid>

          {/* Submit Button */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                startIcon={<SaveIcon />}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Paper>
  );
};

export default BillingConfiguration;
