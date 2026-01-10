import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress, Alert, AlertTitle, Button, Paper, Typography } from '@mui/material';
import { Block as BlockIcon } from '@mui/icons-material';
import { useAuth } from './contexts/AuthContext';

// Pages
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import DocumentDetails from './pages/DocumentDetails';
import Upload from './pages/Upload';
import AdminPanel from './pages/Admin/AdminPanel';
import UserManagement from './pages/Admin/UserManagement';
import ClientManagement from './pages/Admin/ClientManagement';
import CategoryManagement from './pages/Admin/CategoryManagement';
import ModelManagement from './pages/Admin/ModelManagement';
import FieldManagement from './pages/Admin/FieldManagement';
import PermissionManagement from './pages/Admin/PermissionManagement';
import PricingConfig from './pages/Admin/PricingConfig';
import BillingConfiguration from './pages/Admin/BillingConfiguration';
import InvoiceManagement from './pages/Admin/InvoiceManagement';
import MailLogs from './pages/Admin/MailLogs';
import ProcessingEngineConfig from './pages/Admin/ProcessingEngineConfig';
import OutputProfileManagement from './pages/Admin/OutputProfileManagement';
import Profile from './pages/Profile';
import Reports from './pages/Reports/Reports';
import MyInvoices from './pages/Client/MyInvoices';
import PaymentPage from './pages/Payment/PaymentPage';

// Components
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';

function App() {
  const { loading, clientInactive, clientInactiveMessage, logout } = useAuth();

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  // Show full-page message when client is inactive
  if (clientInactive) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        sx={{ bgcolor: '#f5f5f5' }}
      >
        <Paper elevation={3} sx={{ p: 5, maxWidth: 500, textAlign: 'center' }}>
          <BlockIcon sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom color="error">
            Account Inactive
          </Typography>
          <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
            <AlertTitle>Access Denied</AlertTitle>
            {clientInactiveMessage || 'Your client account has been deactivated. All features are disabled.'}
          </Alert>
          <Typography variant="body1" color="text.secondary" paragraph>
            Please contact your administrator to reactivate your account.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={logout}
            size="large"
          >
            Log Out
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Routes>
      {/* Public Landing Page */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />

      {/* Public Payment Route */}
      <Route path="/payment/:paymentLink" element={<PaymentPage />} />

      <Route
        path="/app"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="documents" element={<Documents />} />
        <Route path="documents/:processId" element={<DocumentDetails />} />
        <Route path="upload" element={<Upload />} />
        <Route path="reports" element={<Reports />} />
        <Route path="profile" element={<Profile />} />
        
        {/* Client Routes */}
        <Route path="invoices" element={<MyInvoices />} />
        
        {/* Admin Routes */}
        <Route path="admin" element={<AdminPanel />}>
          <Route index element={<Navigate to="/app/admin/users" replace />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="clients" element={<ClientManagement />} />
          <Route path="categories" element={<CategoryManagement />} />
          <Route path="output-profiles" element={<OutputProfileManagement />} />
          <Route path="model-versions" element={<ModelManagement />} />
          <Route path="fields" element={<FieldManagement />} />
          <Route path="permissions" element={<PermissionManagement />} />
          <Route path="pricing" element={<PricingConfig />} />
          <Route path="billing/config" element={<BillingConfiguration />} />
          <Route path="billing/invoices" element={<InvoiceManagement />} />
          <Route path="billing/mail-logs" element={<MailLogs />} />
          <Route path="processing-config" element={<ProcessingEngineConfig />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
