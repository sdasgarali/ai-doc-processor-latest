import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Grid,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Container
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Receipt as ReceiptIcon
} from '@mui/icons-material';
import axios from 'axios';

const PaymentPage = () => {
  const { paymentLink } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);

  useEffect(() => {
    fetchInvoice();
  }, [paymentLink]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `http://localhost:5000/api/billing/payment/${paymentLink}`
      );
      
      setInvoice(response.data.data);
      
      // Check if already paid
      if (response.data.data.status === 'paid') {
        setPaymentComplete(true);
      }
      
      setError('');
    } catch (err) {
      console.error('Error fetching invoice:', err);
      setError(err.response?.data?.message || 'Invalid or expired payment link');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!window.confirm(`Process payment of ${formatCurrency(invoice.amount_due)}?`)) {
      return;
    }

    try {
      setProcessing(true);
      setError('');

      // In a real implementation with Stripe, you would:
      // 1. Create payment intent: POST /api/billing/payment/:paymentLink/intent
      // 2. Use Stripe Elements to collect card details
      // 3. Confirm payment with Stripe
      // 4. Webhook handles the rest

      // For demo purposes, we'll simulate the payment
      const response = await axios.post(
        `http://localhost:5000/api/billing/payment/${paymentLink}`,
        {
          payment_method_id: 'test_payment_method',
          amount: invoice.amount_due
        }
      );

      if (response.data.success) {
        setSuccess(true);
        setPaymentComplete(true);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.response?.data?.message || 'Payment processing failed');
    } finally {
      setProcessing(false);
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

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 5 }}>
        <Paper sx={{ p: 5, textAlign: 'center' }}>
          <CircularProgress />
          <Typography variant="body1" sx={{ mt: 2 }}>
            Loading invoice...
          </Typography>
        </Paper>
      </Container>
    );
  }

  if (error && !invoice) {
    return (
      <Container maxWidth="md" sx={{ mt: 5 }}>
        <Paper sx={{ p: 5, textAlign: 'center' }}>
          <ErrorIcon sx={{ fontSize: 60, color: 'error.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Payment Link Invalid
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {error}
          </Typography>
        </Paper>
      </Container>
    );
  }

  if (paymentComplete) {
    return (
      <Container maxWidth="md" sx={{ mt: 5 }}>
        <Paper sx={{ p: 5, textAlign: 'center' }}>
          <CheckIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            {success ? 'Payment Successful!' : 'Already Paid'}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            {success 
              ? 'Thank you for your payment. A confirmation email has been sent.'
              : 'This invoice has already been paid.'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Invoice: <strong>{invoice.invoice_number}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Amount: <strong>{formatCurrency(invoice.amount_due)}</strong>
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 5, mb: 5 }}>
      <Paper sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <ReceiptIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            Invoice Payment
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Complete your payment securely
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Invoice Details */}
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Invoice Details
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Invoice Number
                </Typography>
                <Typography variant="body1" fontWeight="bold">
                  {invoice.invoice_number}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Client
                </Typography>
                <Typography variant="body1" fontWeight="bold">
                  {invoice.client_name}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Invoice Date
                </Typography>
                <Typography variant="body1">
                  {formatDate(invoice.invoice_date)}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Due Date
                </Typography>
                <Typography 
                  variant="body1"
                  color={new Date(invoice.due_date) < new Date() ? 'error' : 'inherit'}
                >
                  {formatDate(invoice.due_date)}
                  {new Date(invoice.due_date) < new Date() && ' (Overdue)'}
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  Amount Due
                </Typography>
                <Typography variant="h4" color="primary" fontWeight="bold">
                  {formatCurrency(invoice.amount_due)}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Payment Section */}
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Payment Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Demo Mode:</strong> This is a demonstration payment page. 
                In production, this would integrate with Stripe Elements for secure card processing.
              </Typography>
            </Alert>

            {/* In production, Stripe Elements would go here:
            <Elements stripe={stripePromise}>
              <CardElement />
            </Elements>
            */}

            <Box sx={{ 
              p: 3, 
              bgcolor: 'grey.50', 
              borderRadius: 1,
              border: '1px dashed',
              borderColor: 'grey.300'
            }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Credit Card Payment
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Secure payment processing powered by Stripe
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="contained"
            size="large"
            onClick={handlePayment}
            disabled={processing}
            sx={{ minWidth: 200 }}
          >
            {processing ? 'Processing...' : `Pay ${formatCurrency(invoice.amount_due)}`}
          </Button>
        </Box>

        {/* Security Note */}
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            🔒 Your payment is secure and encrypted
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default PaymentPage;
