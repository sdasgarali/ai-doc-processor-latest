import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider
} from '@mui/material';
import {
  People as PeopleIcon,
  Business as BusinessIcon,
  Category as CategoryIcon,
  Storage as StorageIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import axios from 'axios';

const Dashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || '';
      const response = await axios.get(`${apiUrl}/api/admin/dashboard/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnalytics(response.data.data);
      setError('');
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color = 'primary.main', subtitle }) => (
    <Card sx={{ height: '100%', bgcolor: 'background.paper' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography color="text.secondary" gutterBottom variant="subtitle2">
              {title}
            </Typography>
            <Typography variant="h3" component="div" sx={{ color }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box sx={{ 
            bgcolor: color, 
            p: 1.5, 
            borderRadius: 2, 
            display: 'flex',
            opacity: 0.1
          }}>
            <Icon sx={{ fontSize: 40, color: 'white' }} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  const getRoleColor = (role) => {
    switch (role) {
      case 'superadmin': return 'error';
      case 'admin': return 'warning';
      case 'client': return 'info';
      default: return 'default';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!analytics) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No analytics data available
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Dashboard
      </Typography>

      {/* Main Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <StatCard
            title="Total Users"
            value={analytics.totals.users}
            icon={PeopleIcon}
            color="primary.main"
            subtitle={`${analytics.userStats.active} active`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <StatCard
            title="Clients"
            value={analytics.totals.clients}
            icon={BusinessIcon}
            color="success.main"
            subtitle={`${analytics.clientStats.active} active`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <StatCard
            title="Models"
            value={analytics.totals.models}
            icon={StorageIcon}
            color="info.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <StatCard
            title="Fields"
            value={analytics.totals.fields}
            icon={AssignmentIcon}
            color="warning.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <StatCard
            title="Categories"
            value={analytics.totals.categories}
            icon={CategoryIcon}
            color="secondary.main"
          />
        </Grid>
      </Grid>

      {/* Second Row: User Stats and Client Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* User Statistics */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <PeopleIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">User Statistics</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
                  <Typography variant="h4" color="success.dark">
                    {analytics.userStats.active}
                  </Typography>
                  <Typography variant="body2" color="success.dark">
                    Active Users
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.200', borderRadius: 1 }}>
                  <Typography variant="h4" color="text.secondary">
                    {analytics.userStats.inactive}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Inactive Users
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Users by Role
            </Typography>
            <Box sx={{ mt: 2 }}>
              {analytics.userStats.byRole.map((roleData) => (
                <Box key={roleData.user_role} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Chip 
                      label={roleData.user_role} 
                      color={getRoleColor(roleData.user_role)} 
                      size="small"
                      sx={{ minWidth: 100 }}
                    />
                  </Box>
                  <Typography variant="h6" color="text.primary">
                    {roleData.count}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Client Statistics */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <BusinessIcon sx={{ mr: 1, color: 'success.main' }} />
              <Typography variant="h6">Client Statistics</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
                  <Typography variant="h4" color="success.dark">
                    {analytics.clientStats.active}
                  </Typography>
                  <Typography variant="body2" color="success.dark">
                    Active Clients
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.200', borderRadius: 1 }}>
                  <Typography variant="h4" color="text.secondary">
                    {analytics.clientStats.inactive}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Inactive Clients
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 4 }}>
              Fields by Category
            </Typography>
            <Box sx={{ mt: 2 }}>
              {analytics.fieldsByCategory.slice(0, 5).map((cat) => (
                <Box key={cat.category_name} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">{cat.category_name}</Typography>
                    <Typography variant="body2" fontWeight="bold">{cat.field_count} fields</Typography>
                  </Box>
                  <Box sx={{ 
                    width: '100%', 
                    height: 8, 
                    bgcolor: 'grey.200', 
                    borderRadius: 1,
                    overflow: 'hidden'
                  }}>
                    <Box sx={{ 
                      width: `${Math.min((cat.field_count / analytics.totals.fields) * 100, 100)}%`, 
                      height: '100%', 
                      bgcolor: 'primary.main',
                      transition: 'width 0.3s'
                    }} />
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Third Row: Recent Activity */}
      <Grid container spacing={3}>
        {/* Recent Users */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <TrendingUpIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">Recent Users</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            {analytics.recent.users.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                No recent users
              </Typography>
            ) : (
              <List>
                {analytics.recent.users.map((user, index) => (
                  <React.Fragment key={user.userid}>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body1">
                              {user.first_name} {user.last_name}
                            </Typography>
                            <Chip 
                              label={user.user_role} 
                              size="small" 
                              color={getRoleColor(user.user_role)}
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {user.email}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Joined: {formatDate(user.created_at)}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < analytics.recent.users.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Recent Clients */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <TrendingUpIcon sx={{ mr: 1, color: 'success.main' }} />
              <Typography variant="h6">Recent Clients</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            {analytics.recent.clients.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                No recent clients
              </Typography>
            ) : (
              <List>
                {analytics.recent.clients.map((client, index) => (
                  <React.Fragment key={client.client_id}>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body1" fontWeight="medium">
                              {client.client_name}
                            </Typography>
                            <Chip 
                              label={client.status} 
                              size="small" 
                              color={client.status === 'active' ? 'success' : 'default'}
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            {client.contact_name && (
                              <Typography variant="body2" color="text.secondary">
                                Contact: {client.contact_name}
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary">
                              Added: {formatDate(client.created_at)}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < analytics.recent.clients.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
