import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Tabs, Tab, Paper } from '@mui/material';

const AdminPanel = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const tabs = [
    { label: 'User Management', path: '/app/admin/users' },
    { label: 'Client Management', path: '/app/admin/clients' },
    { label: 'Doc Category', path: '/app/admin/doc-categories' },
    { label: 'Output Profiles', path: '/app/admin/output-profiles' },
    { label: 'Category Creation', path: '/app/admin/category-creation' },
    { label: 'Model Management', path: '/app/admin/model-versions' },
    { label: 'Field Management', path: '/app/admin/fields' },
    { label: 'Permission Management', path: '/app/admin/permissions' },
    { label: 'Processing Engine', path: '/app/admin/processing-config' },
    { label: 'Pricing Configuration', path: '/app/admin/pricing' },
    { label: 'Billing Config', path: '/app/admin/billing/config' },
    { label: 'Invoices', path: '/app/admin/billing/invoices' },
    { label: 'Mail Logs', path: '/app/admin/billing/mail-logs' }
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
