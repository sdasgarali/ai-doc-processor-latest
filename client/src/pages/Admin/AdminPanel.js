import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Tabs, Tab, Paper } from '@mui/material';

const AdminPanel = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const tabs = [
    { label: 'User Management', path: '/admin/users' },
    { label: 'Client Management', path: '/admin/clients' },
    { label: 'Doc Category', path: '/admin/doc-categories' },
    { label: 'Model Management', path: '/admin/model-versions' },
    { label: 'Field Management', path: '/admin/fields' },
    { label: 'Permission Management', path: '/admin/permissions' },
    { label: 'Processing Engine', path: '/admin/processing-config' },
    { label: 'Pricing Configuration', path: '/admin/pricing' },
    { label: 'Billing Config', path: '/admin/billing/config' },
    { label: 'Invoices', path: '/admin/billing/invoices' },
    { label: 'Mail Logs', path: '/admin/billing/mail-logs' }
  ];
  
  const currentTab = tabs.findIndex(tab => location.pathname === tab.path);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Admin Panel
      </Typography>
      
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={currentTab !== -1 ? currentTab : 0} 
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {tabs.map((tab, index) => (
            <Tab 
              key={tab.path} 
              label={tab.label} 
              onClick={() => navigate(tab.path)}
            />
          ))}
        </Tabs>
      </Paper>
      
      <Outlet />
    </Box>
  );
};

export default AdminPanel;
