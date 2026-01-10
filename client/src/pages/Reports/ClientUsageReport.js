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
  TextField,
  MenuItem,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  Card,
  CardContent,
  InputAdornment
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import axios from 'axios';

const ClientUsageReport = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState([]);
  const [totals, setTotals] = useState(null);
  
  // Get current month date range
  const currentDate = new Date();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  const [filters, setFilters] = useState({
    client_id: '',
    doc_category: '',
    from_date: firstDayOfMonth.toISOString().split('T')[0],
    to_date: lastDayOfMonth.toISOString().split('T')[0],
    search: ''
  });

  const [clients, setClients] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetchClients();
    fetchCategories();
    fetchReport();
  }, []);

  const fetchClients = async () => {
    try {
      const token = localStorage.getItem('token');
      // Only fetch active clients for dropdown
      const response = await axios.get('http://localhost:5000/api/admin/clients?status=active', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClients(response.data.data || []);
    } catch (err) {
      console.error('Error fetching clients:', err);
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

  const fetchReport = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams();
      if (filters.client_id) params.append('client_id', filters.client_id);
      if (filters.doc_category) params.append('doc_category', filters.doc_category);
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      if (filters.search) params.append('search', filters.search);

      const response = await axios.get(
        `http://localhost:5000/api/reports/client-usage?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setReportData(response.data.data);
      setTotals(response.data.totals);
      setError('');
    } catch (err) {
      console.error('Error fetching report:', err);
      setError('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams();
      if (filters.client_id) params.append('client_id', filters.client_id);
      if (filters.doc_category) params.append('doc_category', filters.doc_category);
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      if (filters.search) params.append('search', filters.search);

      const response = await axios.get(
        `http://localhost:5000/api/reports/client-usage/export?${params}`,
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
      link.setAttribute('download', `Client_Usage_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error exporting report:', err);
      alert('Failed to export report');
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleClearFilters = () => {
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    setFilters({
      client_id: '',
      doc_category: '',
      from_date: firstDay.toISOString().split('T')[0],
      to_date: lastDay.toISOString().split('T')[0],
      search: ''
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Client-wise Usage Report
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchReport}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={loading || reportData.length === 0}
            color="success"
          >
            Export to Excel
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Summary Cards */}
      {totals && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Total Clients
                </Typography>
                <Typography variant="h4" color="primary">
                  {totals.total_clients}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Total Documents
                </Typography>
                <Typography variant="h4" color="secondary">
                  {totals.total_documents}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Total Pages
                </Typography>
                <Typography variant="h4" color="info.main">
                  {totals.total_pages}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Total Cost
                </Typography>
                <Typography variant="h4" color="success.main">
                  ${parseFloat(totals.total_cost || 0).toFixed(4)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Filters
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              select
              label="Client"
              value={filters.client_id}
              onChange={(e) => handleFilterChange('client_id', e.target.value)}
              size="small"
            >
              <MenuItem value="">All Clients</MenuItem>
              {clients.map((client) => (
                <MenuItem key={client.client_id} value={client.client_id}>
                  {client.client_name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              select
              label="Doc Category"
              value={filters.doc_category}
              onChange={(e) => handleFilterChange('doc_category', e.target.value)}
              size="small"
            >
              <MenuItem value="">All Categories</MenuItem>
              {categories.map((category) => (
                <MenuItem key={category.category_id} value={category.category_id}>
                  {category.category_name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              type="date"
              label="From Date"
              value={filters.from_date}
              onChange={(e) => handleFilterChange('from_date', e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              type="date"
              label="To Date"
              value={filters.to_date}
              onChange={(e) => handleFilterChange('to_date', e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                onClick={fetchReport}
                fullWidth
                disabled={loading}
              >
                Apply
              </Button>
              <Button
                variant="outlined"
                onClick={handleClearFilters}
                disabled={loading}
              >
                Clear
              </Button>
            </Box>
          </Grid>
        </Grid>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              placeholder="Search by client name, contact, or email..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Report Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#1976d2' }}>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Client ID</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Client Name</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Contact</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Email</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Total Docs</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Total Pages</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Total Records</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Total Cost ($)</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Success/Failed</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 5 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : reportData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 5 }}>
                  <Typography color="text.secondary">No data found for selected filters</Typography>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {reportData.map((row) => (
                  <TableRow key={row.client_id} hover>
                    <TableCell>{row.client_id}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {row.client_name}
                      </Typography>
                    </TableCell>
                    <TableCell>{row.contact_name}</TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {row.email}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={row.total_documents || 0} size="small" />
                    </TableCell>
                    <TableCell align="center">
                      {row.total_pages || 0}
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={row.total_records || 0} size="small" color="primary" />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium" color="success.main">
                        ${parseFloat(row.total_cost || 0).toFixed(4)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        <Chip
                          label={row.successful_docs || 0}
                          size="small"
                          color="success"
                          icon={<TrendingUpIcon />}
                        />
                        <Chip
                          label={row.failed_docs || 0}
                          size="small"
                          color="error"
                        />
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                {totals && (
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell colSpan={4}>
                      <Typography variant="body1" fontWeight="bold">
                        TOTAL
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={totals.total_documents} size="small" color="primary" />
                    </TableCell>
                    <TableCell align="center">
                      <Typography fontWeight="bold">{totals.total_pages}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={totals.total_records} size="small" color="primary" />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body1" fontWeight="bold" color="success.main">
                        ${parseFloat(totals.total_cost || 0).toFixed(4)}
                      </Typography>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ClientUsageReport;
