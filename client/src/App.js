import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from './contexts/AuthContext';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import DocumentDetails from './pages/DocumentDetails';
import Upload from './pages/Upload';
import AdminPanel from './pages/Admin/AdminPanel';
import UserManagement from './pages/Admin/UserManagement';
import ClientManagement from './pages/Admin/ClientManagement';
import DocCategoryManagement from './pages/Admin/DocCategoryManagement';
import ModelManagement from './pages/Admin/ModelManagement';
import FieldManagement from './pages/Admin/FieldManagement';
import PermissionManagement from './pages/Admin/PermissionManagement';
import PricingConfig from './pages/Admin/PricingConfig';
import BillingConfiguration from './pages/Admin/BillingConfiguration';
import InvoiceManagement from './pages/Admin/InvoiceManagement';
import MailLogs from './pages/Admin/MailLogs';
import Profile from './pages/Profile';
import Reports from './pages/Reports/Reports';
import MyInvoices from './pages/Client/MyInvoices';
import PaymentPage from './pages/Payment/PaymentPage';

// Components
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';

function App() {
  const { loading } = useAuth();

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

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      {/* Public Payment Route */}
      <Route path="/payment/:paymentLink" element={<PaymentPage />} />
      
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
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
          <Route index element={<Navigate to="/admin/users" replace />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="clients" element={<ClientManagement />} />
          <Route path="doc-categories" element={<DocCategoryManagement />} />
          <Route path="model-versions" element={<ModelManagement />} />
          <Route path="fields" element={<FieldManagement />} />
          <Route path="permissions" element={<PermissionManagement />} />
          <Route path="pricing" element={<PricingConfig />} />
          <Route path="billing/config" element={<BillingConfiguration />} />
          <Route path="billing/invoices" element={<InvoiceManagement />} />
          <Route path="billing/mail-logs" element={<MailLogs />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
