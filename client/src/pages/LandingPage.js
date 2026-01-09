import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  AppBar,
  Toolbar,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Avatar,
  Rating,
  IconButton,
  Divider,
  useTheme,
  useMediaQuery,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Snackbar,
  Alert
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  Cloud as CloudIcon,
  Analytics as AnalyticsIcon,
  AutoAwesome as AutoAwesomeIcon,
  AttachMoney as MoneyIcon,
  CheckCircle as CheckIcon,
  ArrowForward as ArrowIcon,
  Menu as MenuIcon,
  Upload as UploadIcon,
  Psychology as AIIcon,
  Assessment as ReportIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  LinkedIn as LinkedInIcon,
  Twitter as TwitterIcon
} from '@mui/icons-material';

// Styles
const styles = {
  gradientBg: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  heroSection: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1a237e 0%, #3949ab 50%, #5c6bc0 100%)',
    position: 'relative',
    overflow: 'hidden',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.05"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
      opacity: 0.5,
    }
  },
  floatingCard: {
    position: 'absolute',
    borderRadius: 3,
    background: 'rgba(255,255,255,0.1)',
    backdropFilter: 'blur(10px)',
    animation: 'float 6s ease-in-out infinite',
  },
  featureCard: {
    height: '100%',
    transition: 'all 0.3s ease',
    border: '1px solid transparent',
    '&:hover': {
      transform: 'translateY(-8px)',
      boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
      borderColor: '#667eea',
    }
  },
  pricingCard: {
    position: 'relative',
    transition: 'all 0.3s ease',
    '&:hover': {
      transform: 'scale(1.02)',
    }
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    px: 2,
    py: 0.5,
    borderRadius: 2,
  },
  statsBox: {
    textAlign: 'center',
    p: 3,
  },
  testimonialCard: {
    height: '100%',
    background: 'linear-gradient(145deg, #ffffff, #f5f5f5)',
  },
  ctaSection: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    py: 10,
  },
  footer: {
    background: '#1a237e',
    color: 'white',
    py: 6,
  }
};

// Feature data
const features = [
  {
    icon: <AIIcon sx={{ fontSize: 50, color: '#667eea' }} />,
    title: 'AI-Powered Extraction',
    description: 'Advanced machine learning algorithms extract data from EOBs with 99% accuracy, reducing manual data entry by 95%.'
  },
  {
    icon: <SpeedIcon sx={{ fontSize: 50, color: '#764ba2' }} />,
    title: 'Lightning Fast Processing',
    description: 'Process hundreds of documents per minute. Our optimized pipeline handles large volumes effortlessly.'
  },
  {
    icon: <SecurityIcon sx={{ fontSize: 50, color: '#3949ab' }} />,
    title: 'Enterprise Security',
    description: 'Bank-level encryption, HIPAA compliant, SOC 2 certified. Your healthcare data is protected at all times.'
  },
  {
    icon: <CloudIcon sx={{ fontSize: 50, color: '#5c6bc0' }} />,
    title: 'Cloud-Native Platform',
    description: 'Access your data anywhere, anytime. Automatic backups and 99.9% uptime guarantee.'
  },
  {
    icon: <AnalyticsIcon sx={{ fontSize: 50, color: '#7e57c2' }} />,
    title: 'Powerful Analytics',
    description: 'Real-time dashboards, custom reports, and actionable insights to optimize your revenue cycle.'
  },
  {
    icon: <MoneyIcon sx={{ fontSize: 50, color: '#26a69a' }} />,
    title: 'Automated Billing',
    description: 'Generate invoices automatically, track payments, and integrate with your accounting systems.'
  }
];

// Pricing tiers
const pricingTiers = [
  {
    name: 'Starter',
    price: 99,
    description: 'Perfect for small practices',
    features: [
      '100 documents/month',
      '5 users',
      'Email support',
      'Basic analytics',
      'API access'
    ],
    popular: false
  },
  {
    name: 'Professional',
    price: 299,
    description: 'For growing organizations',
    features: [
      '1,000 documents/month',
      '25 users',
      'Priority support',
      'Advanced analytics',
      'Custom integrations',
      'White-label options'
    ],
    popular: true
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large healthcare systems',
    features: [
      'Unlimited documents',
      'Unlimited users',
      '24/7 dedicated support',
      'Custom AI models',
      'On-premise deployment',
      'SLA guarantee',
      'HIPAA BAA included'
    ],
    popular: false
  }
];

// Testimonials
const testimonials = [
  {
    name: 'Dr. Sarah Johnson',
    role: 'Chief Revenue Officer',
    company: 'MedCare Health Systems',
    avatar: 'S',
    rating: 5,
    quote: 'EOB Extract transformed our billing operations. We reduced processing time by 80% and improved accuracy to near-perfect levels.'
  },
  {
    name: 'Michael Chen',
    role: 'Director of Operations',
    company: 'Pacific Medical Group',
    avatar: 'M',
    rating: 5,
    quote: 'The AI accuracy is remarkable. What used to take our team days now happens in minutes. ROI was achieved in just 2 months.'
  },
  {
    name: 'Jennifer Williams',
    role: 'Billing Manager',
    company: 'HealthFirst Clinic',
    avatar: 'J',
    rating: 5,
    quote: 'Outstanding support team and intuitive interface. Even our non-technical staff adapted quickly. Highly recommended!'
  }
];

// FAQs
const faqs = [
  {
    question: 'What types of documents can EOB Extract process?',
    answer: 'EOB Extract processes all major insurance EOB formats including Medicare, Medicaid, and commercial payers. Our AI continuously learns new formats to expand coverage.'
  },
  {
    question: 'How accurate is the data extraction?',
    answer: 'Our AI achieves 99%+ accuracy on structured EOBs. Each extraction includes a confidence score, and our validation engine catches potential errors before they affect your workflow.'
  },
  {
    question: 'Is my data secure and HIPAA compliant?',
    answer: 'Absolutely. We maintain HIPAA compliance with full encryption at rest and in transit. We offer Business Associate Agreements (BAA) and are SOC 2 Type II certified.'
  },
  {
    question: 'Can I integrate with my existing systems?',
    answer: 'Yes! We offer REST APIs, webhooks, and pre-built integrations with major practice management and EHR systems including Epic, Cerner, and Athena.'
  },
  {
    question: 'What kind of support do you offer?',
    answer: 'All plans include email support. Professional plans get priority response times, and Enterprise clients receive 24/7 dedicated support with a named account manager.'
  },
  {
    question: 'Is there a free trial?',
    answer: 'Yes! We offer a 14-day free trial with full access to all features. No credit card required. Our team will help you get started with a personalized demo.'
  }
];

// Stats
const stats = [
  { value: '10M+', label: 'Documents Processed' },
  { value: '99.2%', label: 'Accuracy Rate' },
  { value: '500+', label: 'Healthcare Clients' },
  { value: '85%', label: 'Time Saved' }
];

function LandingPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const handleDemoRequest = (e) => {
    e.preventDefault();
    if (email) {
      setSnackbar({ open: true, message: 'Thank you! We will contact you shortly.', severity: 'success' });
      setEmail('');
    }
  };

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <Box>
      {/* Navigation */}
      <AppBar position="fixed" elevation={0} sx={{ background: 'rgba(26, 35, 126, 0.95)', backdropFilter: 'blur(10px)' }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters>
            <Typography variant="h5" sx={{ fontWeight: 700, flexGrow: 1, display: 'flex', alignItems: 'center' }}>
              <AutoAwesomeIcon sx={{ mr: 1 }} />
              EOB Extract
            </Typography>

            {isMobile ? (
              <IconButton color="inherit" onClick={() => setMobileMenuOpen(true)}>
                <MenuIcon />
              </IconButton>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Button color="inherit" onClick={() => scrollToSection('features')}>Features</Button>
                <Button color="inherit" onClick={() => scrollToSection('pricing')}>Pricing</Button>
                <Button color="inherit" onClick={() => scrollToSection('testimonials')}>Testimonials</Button>
                <Button color="inherit" onClick={() => scrollToSection('faq')}>FAQ</Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={() => navigate('/login')}
                  sx={{ borderRadius: 2 }}
                >
                  Login
                </Button>
                <Button
                  variant="contained"
                  onClick={() => scrollToSection('cta')}
                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: 2,
                    px: 3
                  }}
                >
                  Get Started
                </Button>
              </Box>
            )}
          </Toolbar>
        </Container>
      </AppBar>

      {/* Mobile Menu */}
      <Drawer anchor="right" open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}>
        <List sx={{ width: 250, pt: 4 }}>
          <ListItem button onClick={() => scrollToSection('features')}>
            <ListItemText primary="Features" />
          </ListItem>
          <ListItem button onClick={() => scrollToSection('pricing')}>
            <ListItemText primary="Pricing" />
          </ListItem>
          <ListItem button onClick={() => scrollToSection('testimonials')}>
            <ListItemText primary="Testimonials" />
          </ListItem>
          <ListItem button onClick={() => scrollToSection('faq')}>
            <ListItemText primary="FAQ" />
          </ListItem>
          <Divider sx={{ my: 2 }} />
          <ListItem button onClick={() => navigate('/login')}>
            <ListItemText primary="Login" />
          </ListItem>
          <ListItem>
            <Button
              fullWidth
              variant="contained"
              onClick={() => scrollToSection('cta')}
              sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            >
              Get Started
            </Button>
          </ListItem>
        </List>
      </Drawer>

      {/* Hero Section */}
      <Box sx={styles.heroSection}>
        <Container maxWidth="lg" sx={{ pt: 15, pb: 10, position: 'relative', zIndex: 1 }}>
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={6}>
              <Chip
                label="Now with GPT-4 Integration"
                sx={{ mb: 3, background: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
              <Typography
                variant="h1"
                sx={{
                  fontWeight: 800,
                  color: 'white',
                  fontSize: { xs: '2.5rem', md: '3.5rem' },
                  lineHeight: 1.2,
                  mb: 3
                }}
              >
                Transform Your EOB Processing with AI
              </Typography>
              <Typography
                variant="h6"
                sx={{ color: 'rgba(255,255,255,0.9)', mb: 4, lineHeight: 1.7 }}
              >
                Automate the extraction of critical data from Explanation of Benefits documents.
                Reduce manual work by 95%, improve accuracy to 99%, and accelerate your revenue cycle.
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 4 }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => scrollToSection('cta')}
                  endIcon={<ArrowIcon />}
                  sx={{
                    background: 'white',
                    color: '#1a237e',
                    px: 4,
                    py: 1.5,
                    borderRadius: 2,
                    fontWeight: 600,
                    '&:hover': { background: '#f5f5f5' }
                  }}
                >
                  Start Free Trial
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => scrollToSection('features')}
                  sx={{
                    borderColor: 'white',
                    color: 'white',
                    px: 4,
                    py: 1.5,
                    borderRadius: 2,
                    '&:hover': { borderColor: 'white', background: 'rgba(255,255,255,0.1)' }
                  }}
                >
                  See How It Works
                </Button>
              </Box>

              <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {['No credit card required', 'Setup in 5 minutes', 'Cancel anytime'].map((text) => (
                  <Box key={text} sx={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.8)' }}>
                    <CheckIcon sx={{ fontSize: 18, mr: 0.5 }} />
                    <Typography variant="body2">{text}</Typography>
                  </Box>
                ))}
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 4,
                p: 4,
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.2)'
              }}>
                {/* How it Works Steps */}
                {[
                  { icon: <UploadIcon />, title: '1. Upload Documents', desc: 'Drag & drop PDFs or connect to your existing systems' },
                  { icon: <AIIcon />, title: '2. AI Extraction', desc: 'Our AI processes and extracts all relevant data fields' },
                  { icon: <ReportIcon />, title: '3. Export & Integrate', desc: 'Get structured data in your preferred format' }
                ].map((step, i) => (
                  <Box key={i} sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    mb: i < 2 ? 3 : 0,
                    color: 'white'
                  }}>
                    <Box sx={{
                      background: 'rgba(255,255,255,0.2)',
                      borderRadius: 2,
                      p: 1.5,
                      mr: 2,
                      display: 'flex'
                    }}>
                      {step.icon}
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={600}>{step.title}</Typography>
                      <Typography variant="body2" sx={{ opacity: 0.8 }}>{step.desc}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Stats Section */}
      <Box sx={{ background: '#f8f9fa', py: 6 }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            {stats.map((stat) => (
              <Grid item xs={6} md={3} key={stat.label}>
                <Box sx={styles.statsBox}>
                  <Typography variant="h3" fontWeight={800} color="primary">{stat.value}</Typography>
                  <Typography variant="body1" color="text.secondary">{stat.label}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Box id="features" sx={{ py: 10 }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography variant="h2" fontWeight={700} gutterBottom>
              Powerful Features for Modern Healthcare
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
              Everything you need to streamline EOB processing and accelerate your revenue cycle management.
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {features.map((feature) => (
              <Grid item xs={12} md={4} key={feature.title}>
                <Card sx={styles.featureCard} elevation={0}>
                  <CardContent sx={{ p: 4, textAlign: 'center' }}>
                    <Box sx={{ mb: 2 }}>{feature.icon}</Box>
                    <Typography variant="h5" fontWeight={600} gutterBottom>
                      {feature.title}
                    </Typography>
                    <Typography color="text.secondary">
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Pricing Section */}
      <Box id="pricing" sx={{ py: 10, background: '#f8f9fa' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography variant="h2" fontWeight={700} gutterBottom>
              Simple, Transparent Pricing
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Choose the plan that fits your needs. All plans include a 14-day free trial.
            </Typography>
          </Box>

          <Grid container spacing={4} justifyContent="center">
            {pricingTiers.map((tier) => (
              <Grid item xs={12} md={4} key={tier.name}>
                <Card
                  sx={{
                    ...styles.pricingCard,
                    border: tier.popular ? '2px solid #667eea' : '1px solid #e0e0e0',
                    position: 'relative'
                  }}
                  elevation={tier.popular ? 8 : 1}
                >
                  {tier.popular && (
                    <Typography sx={styles.popularBadge}>Most Popular</Typography>
                  )}
                  <CardContent sx={{ p: 4 }}>
                    <Typography variant="h5" fontWeight={600} gutterBottom>
                      {tier.name}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mb: 3 }}>
                      {tier.description}
                    </Typography>
                    <Box sx={{ mb: 3 }}>
                      {typeof tier.price === 'number' ? (
                        <>
                          <Typography component="span" variant="h3" fontWeight={700}>
                            ${tier.price}
                          </Typography>
                          <Typography component="span" color="text.secondary">/month</Typography>
                        </>
                      ) : (
                        <Typography variant="h4" fontWeight={700}>
                          {tier.price}
                        </Typography>
                      )}
                    </Box>
                    <Divider sx={{ my: 3 }} />
                    <Box sx={{ mb: 3 }}>
                      {tier.features.map((feature) => (
                        <Box key={feature} sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                          <CheckIcon sx={{ color: '#667eea', mr: 1.5, fontSize: 20 }} />
                          <Typography>{feature}</Typography>
                        </Box>
                      ))}
                    </Box>
                    <Button
                      fullWidth
                      variant={tier.popular ? 'contained' : 'outlined'}
                      size="large"
                      sx={{
                        borderRadius: 2,
                        py: 1.5,
                        ...(tier.popular && {
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        })
                      }}
                    >
                      {tier.price === 'Custom' ? 'Contact Sales' : 'Start Free Trial'}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Testimonials */}
      <Box id="testimonials" sx={{ py: 10 }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography variant="h2" fontWeight={700} gutterBottom>
              Trusted by Healthcare Leaders
            </Typography>
            <Typography variant="h6" color="text.secondary">
              See what our customers say about EOB Extract
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {testimonials.map((testimonial) => (
              <Grid item xs={12} md={4} key={testimonial.name}>
                <Card sx={styles.testimonialCard} elevation={0}>
                  <CardContent sx={{ p: 4 }}>
                    <Rating value={testimonial.rating} readOnly sx={{ mb: 2 }} />
                    <Typography sx={{ mb: 3, fontStyle: 'italic' }}>
                      "{testimonial.quote}"
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar sx={{ bgcolor: '#667eea', mr: 2 }}>{testimonial.avatar}</Avatar>
                      <Box>
                        <Typography fontWeight={600}>{testimonial.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {testimonial.role}, {testimonial.company}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* FAQ Section */}
      <Box id="faq" sx={{ py: 10, background: '#f8f9fa' }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography variant="h2" fontWeight={700} gutterBottom>
              Frequently Asked Questions
            </Typography>
          </Box>

          {faqs.map((faq, index) => (
            <Accordion
              key={index}
              elevation={0}
              sx={{
                mb: 2,
                '&:before': { display: 'none' },
                borderRadius: '8px !important',
                border: '1px solid #e0e0e0'
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {faq.question}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography color="text.secondary">
                  {faq.answer}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Container>
      </Box>

      {/* CTA Section */}
      <Box id="cta" sx={styles.ctaSection}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center', color: 'white' }}>
            <Typography variant="h3" fontWeight={700} gutterBottom>
              Ready to Transform Your EOB Processing?
            </Typography>
            <Typography variant="h6" sx={{ mb: 4, opacity: 0.9 }}>
              Start your 14-day free trial today. No credit card required.
            </Typography>

            <Box
              component="form"
              onSubmit={handleDemoRequest}
              sx={{
                display: 'flex',
                gap: 2,
                justifyContent: 'center',
                flexWrap: 'wrap'
              }}
            >
              <TextField
                placeholder="Enter your work email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                sx={{
                  minWidth: 300,
                  '& .MuiOutlinedInput-root': {
                    background: 'white',
                    borderRadius: 2,
                  }
                }}
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                sx={{
                  background: '#1a237e',
                  px: 4,
                  borderRadius: 2,
                  '&:hover': { background: '#0d1642' }
                }}
              >
                Get Started Free
              </Button>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, mt: 4, flexWrap: 'wrap' }}>
              {['14-day free trial', 'No credit card required', 'Full feature access'].map((text) => (
                <Box key={text} sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckIcon sx={{ fontSize: 18, mr: 0.5 }} />
                  <Typography variant="body2">{text}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={styles.footer}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Typography variant="h5" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <AutoAwesomeIcon sx={{ mr: 1 }} />
                EOB Extract
              </Typography>
              <Typography sx={{ opacity: 0.8, mb: 2 }}>
                AI-powered document processing for modern healthcare organizations.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <IconButton sx={{ color: 'white' }}><LinkedInIcon /></IconButton>
                <IconButton sx={{ color: 'white' }}><TwitterIcon /></IconButton>
              </Box>
            </Grid>

            <Grid item xs={6} md={2}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>Product</Typography>
              <Typography sx={{ opacity: 0.8, mb: 1, cursor: 'pointer' }}>Features</Typography>
              <Typography sx={{ opacity: 0.8, mb: 1, cursor: 'pointer' }}>Pricing</Typography>
              <Typography sx={{ opacity: 0.8, mb: 1, cursor: 'pointer' }}>API Docs</Typography>
              <Typography sx={{ opacity: 0.8, mb: 1, cursor: 'pointer' }}>Integrations</Typography>
            </Grid>

            <Grid item xs={6} md={2}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>Company</Typography>
              <Typography sx={{ opacity: 0.8, mb: 1, cursor: 'pointer' }}>About</Typography>
              <Typography sx={{ opacity: 0.8, mb: 1, cursor: 'pointer' }}>Blog</Typography>
              <Typography sx={{ opacity: 0.8, mb: 1, cursor: 'pointer' }}>Careers</Typography>
              <Typography sx={{ opacity: 0.8, mb: 1, cursor: 'pointer' }}>Contact</Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>Contact Us</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, opacity: 0.8 }}>
                <EmailIcon sx={{ mr: 1, fontSize: 18 }} />
                <Typography>support@eobextract.com</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, opacity: 0.8 }}>
                <PhoneIcon sx={{ mr: 1, fontSize: 18 }} />
                <Typography>1-800-EOB-DATA</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', opacity: 0.8 }}>
                <LocationIcon sx={{ mr: 1, fontSize: 18 }} />
                <Typography>San Francisco, CA</Typography>
              </Box>
            </Grid>
          </Grid>

          <Divider sx={{ my: 4, borderColor: 'rgba(255,255,255,0.2)' }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Typography sx={{ opacity: 0.6 }}>
              2026 EOB Extract. All rights reserved.
            </Typography>
            <Box sx={{ display: 'flex', gap: 3 }}>
              <Typography sx={{ opacity: 0.6, cursor: 'pointer' }}>Privacy Policy</Typography>
              <Typography sx={{ opacity: 0.6, cursor: 'pointer' }}>Terms of Service</Typography>
              <Typography sx={{ opacity: 0.6, cursor: 'pointer' }}>HIPAA Compliance</Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default LandingPage;
