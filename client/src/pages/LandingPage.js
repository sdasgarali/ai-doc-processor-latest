import React, { useState, useEffect, useRef } from 'react';
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
  Alert,
  Paper,
  Tab,
  Tabs
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
  Twitter as TwitterIcon,
  LocalHospital as HealthcareIcon,
  Receipt as ReceiptIcon,
  Description as DocumentIcon,
  Gavel as LegalIcon,
  Business as BusinessIcon,
  AccountBalance as FinanceIcon,
  Inventory as InventoryIcon,
  People as HRIcon,
  TrendingUp as TrendingUpIcon,
  Bolt as BoltIcon,
  Hub as IntegrationIcon,
  Verified as VerifiedIcon,
  DataObject as DataIcon,
  AutoGraph as AutoGraphIcon,
  Layers as LayersIcon,
  PlayArrow as PlayIcon
} from '@mui/icons-material';

// CSS Keyframe animations (injected via style tag)
const injectStyles = () => {
  const styleId = 'landing-page-animations';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes float {
      0%, 100% { transform: translateY(0px) rotate(0deg); }
      50% { transform: translateY(-20px) rotate(2deg); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.4; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.05); }
    }
    @keyframes gradientShift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(40px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(-30px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.8); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes dash {
      to { stroke-dashoffset: 0; }
    }
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    @keyframes morphBlob {
      0%, 100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
      25% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
      50% { border-radius: 50% 60% 30% 60% / 30% 60% 70% 40%; }
      75% { border-radius: 60% 40% 60% 30% / 60% 30% 40% 70%; }
    }
    @keyframes countUp {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    @keyframes ripple {
      0% { transform: scale(0.8); opacity: 1; }
      100% { transform: scale(2.4); opacity: 0; }
    }
    .animate-float { animation: float 6s ease-in-out infinite; }
    .animate-float-delayed { animation: float 6s ease-in-out infinite 2s; }
    .animate-pulse { animation: pulse 3s ease-in-out infinite; }
    .animate-gradient {
      background-size: 200% 200%;
      animation: gradientShift 8s ease infinite;
    }
    .animate-slideUp { animation: slideUp 0.8s ease-out forwards; }
    .animate-scaleIn { animation: scaleIn 0.6s ease-out forwards; }
    .animate-bounce { animation: bounce 2s ease-in-out infinite; }
    .animate-shimmer {
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      background-size: 200% 100%;
      animation: shimmer 2s infinite;
    }
    .blob {
      animation: morphBlob 8s ease-in-out infinite;
    }
    .card-hover {
      transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .card-hover:hover {
      transform: translateY(-12px) scale(1.02);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }
    .glow {
      box-shadow: 0 0 40px rgba(99, 102, 241, 0.3);
    }
    .text-gradient {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .border-gradient {
      border: 2px solid transparent;
      background: linear-gradient(white, white) padding-box,
                  linear-gradient(135deg, #667eea, #764ba2) border-box;
    }
    .particle {
      position: absolute;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: rgba(255,255,255,0.6);
      animation: float 4s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
};

// Animated counter component
const AnimatedCounter = ({ end, duration = 2000, suffix = '', prefix = '' }) => {
  const [count, setCount] = useState(0);
  const countRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (countRef.current) observer.observe(countRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTime;
    const endValue = typeof end === 'number' ? end : parseFloat(end.replace(/[^0-9.]/g, ''));

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);

      setCount(Math.floor(easeOutQuart * endValue));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(endValue);
      }
    };

    requestAnimationFrame(animate);
  }, [isVisible, end, duration]);

  return (
    <span ref={countRef}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
};

// Floating particles component
const FloatingParticles = () => {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    delay: `${Math.random() * 5}s`,
    size: Math.random() * 4 + 2,
    duration: `${Math.random() * 4 + 4}s`
  }));

  return (
    <>
      {particles.map((p) => (
        <Box
          key={p.id}
          className="particle"
          sx={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            animationDuration: p.duration,
            opacity: 0.4
          }}
        />
      ))}
    </>
  );
};

// Industry use cases data
const industries = [
  {
    icon: <HealthcareIcon sx={{ fontSize: 40 }} />,
    name: 'Healthcare',
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    documents: ['EOB Documents', 'Facesheet Records', 'Medical Claims', 'Patient Forms'],
    stats: '40% faster claims processing',
    description: 'Automate extraction from EOBs, facesheets, and medical claims with HIPAA-compliant processing.'
  },
  {
    icon: <FinanceIcon sx={{ fontSize: 40 }} />,
    name: 'Finance',
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    documents: ['Invoices', 'Receipts', 'Bank Statements', 'Tax Documents'],
    stats: '95% accuracy on invoices',
    description: 'Extract line items, totals, and vendor details from financial documents automatically.'
  },
  {
    icon: <LegalIcon sx={{ fontSize: 40 }} />,
    name: 'Legal',
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    documents: ['Contracts', 'Legal Filings', 'Court Documents', 'NDAs'],
    stats: '70% reduction in review time',
    description: 'Parse complex legal documents, extract key clauses, dates, and party information.'
  },
  {
    icon: <HRIcon sx={{ fontSize: 40 }} />,
    name: 'Human Resources',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    documents: ['Resumes', 'Applications', 'Onboarding Forms', 'Timesheets'],
    stats: '60% faster onboarding',
    description: 'Streamline HR workflows with automated document processing and data extraction.'
  },
  {
    icon: <InventoryIcon sx={{ fontSize: 40 }} />,
    name: 'Supply Chain',
    color: '#ef4444',
    gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    documents: ['Shipping Labels', 'Packing Slips', 'BOL', 'Customs Forms'],
    stats: '50% faster processing',
    description: 'Automate logistics document processing for faster shipment handling and tracking.'
  },
  {
    icon: <BusinessIcon sx={{ fontSize: 40 }} />,
    name: 'Insurance',
    color: '#06b6d4',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
    documents: ['Claims', 'Policies', 'Certificates', 'Loss Reports'],
    stats: '80% automation rate',
    description: 'Process insurance documents faster with intelligent data extraction and validation.'
  }
];

// Features with enhanced descriptions
const features = [
  {
    icon: <AIIcon sx={{ fontSize: 50 }} />,
    title: 'Multi-Model AI Engine',
    description: 'Powered by Google Document AI and OpenAI GPT-4 for unparalleled accuracy across any document type.',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    stats: '99.2% accuracy'
  },
  {
    icon: <BoltIcon sx={{ fontSize: 50 }} />,
    title: 'Lightning Processing',
    description: 'Process thousands of pages per hour with our optimized parallel processing pipeline.',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
    stats: '< 3 sec/page'
  },
  {
    icon: <SecurityIcon sx={{ fontSize: 50 }} />,
    title: 'Enterprise Security',
    description: 'Bank-level encryption, HIPAA & SOC 2 compliant. Your data never leaves secure infrastructure.',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    stats: '100% compliant'
  },
  {
    icon: <IntegrationIcon sx={{ fontSize: 50 }} />,
    title: 'Universal Integration',
    description: 'REST APIs, webhooks, and pre-built connectors for ERP, CRM, and accounting systems.',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    stats: '50+ integrations'
  },
  {
    icon: <AutoGraphIcon sx={{ fontSize: 50 }} />,
    title: 'Smart Analytics',
    description: 'Real-time dashboards, trend analysis, and actionable insights to optimize your workflows.',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    stats: 'Real-time insights'
  },
  {
    icon: <LayersIcon sx={{ fontSize: 50 }} />,
    title: 'Custom Output Profiles',
    description: 'Configure output formats, field mappings, and transformations for each document type.',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
    stats: 'Fully customizable'
  }
];

// Stats with animated counters
const stats = [
  { value: 50, suffix: 'M+', label: 'Documents Processed', icon: <DocumentIcon /> },
  { value: 99.2, suffix: '%', label: 'Extraction Accuracy', icon: <VerifiedIcon /> },
  { value: 2000, suffix: '+', label: 'Enterprise Clients', icon: <BusinessIcon /> },
  { value: 85, suffix: '%', label: 'Time Saved', icon: <TrendingUpIcon /> }
];

// Processing workflow steps
const workflowSteps = [
  {
    step: 1,
    title: 'Upload Any Document',
    description: 'Drag & drop PDFs, images, or connect cloud storage. We handle 100+ document types.',
    icon: <UploadIcon sx={{ fontSize: 36 }} />,
    color: '#3b82f6'
  },
  {
    step: 2,
    title: 'AI Extracts Data',
    description: 'Our multi-model AI identifies document type and extracts structured data fields.',
    icon: <AIIcon sx={{ fontSize: 36 }} />,
    color: '#8b5cf6'
  },
  {
    step: 3,
    title: 'Validate & Transform',
    description: 'Automatic validation, data enrichment, and transformation to your desired format.',
    icon: <DataIcon sx={{ fontSize: 36 }} />,
    color: '#10b981'
  },
  {
    step: 4,
    title: 'Export & Integrate',
    description: 'Get JSON, CSV, Excel, or push directly to your systems via API or webhooks.',
    icon: <ReportIcon sx={{ fontSize: 36 }} />,
    color: '#f59e0b'
  }
];

// Pricing tiers
const pricingTiers = [
  {
    name: 'Starter',
    price: 99,
    description: 'For small teams getting started',
    features: [
      '500 pages/month',
      '5 users',
      '3 document types',
      'Email support',
      'Basic analytics',
      'API access'
    ],
    popular: false,
    gradient: 'linear-gradient(135deg, #64748b 0%, #475569 100%)'
  },
  {
    name: 'Professional',
    price: 399,
    description: 'For growing businesses',
    features: [
      '5,000 pages/month',
      '25 users',
      'All document types',
      'Priority support',
      'Advanced analytics',
      'Custom integrations',
      'Custom output profiles'
    ],
    popular: true,
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large organizations',
    features: [
      'Unlimited pages',
      'Unlimited users',
      'Custom AI models',
      '24/7 dedicated support',
      'On-premise option',
      'SLA guarantee',
      'HIPAA BAA included',
      'Custom development'
    ],
    popular: false,
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
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
    quote: 'DocuParse transformed our billing operations. We reduced EOB processing time by 80% and improved accuracy to near-perfect levels.',
    industry: 'Healthcare'
  },
  {
    name: 'Michael Chen',
    role: 'CFO',
    company: 'Pacific Financial Group',
    avatar: 'M',
    rating: 5,
    quote: 'Processing 10,000+ invoices monthly is now effortless. The accuracy and speed are remarkable. ROI achieved in just 6 weeks.',
    industry: 'Finance'
  },
  {
    name: 'Jennifer Williams',
    role: 'Legal Operations Director',
    company: 'Morrison & Associates',
    avatar: 'J',
    rating: 5,
    quote: 'Contract review time dropped by 70%. The AI accurately extracts clauses and key terms that used to take hours to find manually.',
    industry: 'Legal'
  }
];

// FAQs
const faqs = [
  {
    question: 'What types of documents can DocuParse process?',
    answer: 'DocuParse handles 100+ document types across industries including healthcare (EOBs, facesheets, claims), finance (invoices, receipts, statements), legal (contracts, filings), HR (resumes, applications), and more. Our AI continuously learns new formats.'
  },
  {
    question: 'How accurate is the data extraction?',
    answer: 'Our multi-model AI achieves 99%+ accuracy on structured documents and 95%+ on complex unstructured documents. Each extraction includes confidence scores, and our validation engine catches potential errors automatically.'
  },
  {
    question: 'Is my data secure and compliant?',
    answer: 'Absolutely. We maintain HIPAA, SOC 2 Type II, and GDPR compliance with full encryption at rest and in transit. We offer Business Associate Agreements (BAA) and can deploy on-premise for maximum security.'
  },
  {
    question: 'How does custom output profile work?',
    answer: 'Output profiles let you configure exactly how extracted data is formatted and delivered. Define field mappings, transformations, date formats, and choose output types (JSON, CSV, Excel, XML) per document category and client.'
  },
  {
    question: 'Can I integrate with my existing systems?',
    answer: 'Yes! We offer REST APIs, webhooks, and pre-built integrations with major platforms including Salesforce, SAP, Oracle, Epic, Cerner, QuickBooks, and 50+ more. Custom integrations available for Enterprise plans.'
  },
  {
    question: 'Is there a free trial?',
    answer: 'Yes! Start with a 14-day free trial with full feature access. No credit card required. Our team provides personalized onboarding to help you process your first documents within minutes.'
  }
];

function LandingPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [activeIndustry, setActiveIndustry] = useState(0);

  useEffect(() => {
    injectStyles();
  }, []);

  // Auto-rotate industries
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndustry((prev) => (prev + 1) % industries.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

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
    <Box sx={{ overflowX: 'hidden' }}>
      {/* Navigation */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          background: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ py: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 1.5
                }}
              >
                <AutoAwesomeIcon sx={{ color: 'white', fontSize: 24 }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'white' }}>
                Docu<span className="text-gradient">Parse</span>
              </Typography>
            </Box>

            {isMobile ? (
              <IconButton color="inherit" onClick={() => setMobileMenuOpen(true)}>
                <MenuIcon />
              </IconButton>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {['Industries', 'Features', 'Pricing', 'Testimonials'].map((item) => (
                  <Button
                    key={item}
                    color="inherit"
                    onClick={() => scrollToSection(item.toLowerCase())}
                    sx={{
                      color: 'rgba(255,255,255,0.8)',
                      '&:hover': { color: 'white', background: 'rgba(255,255,255,0.1)' }
                    }}
                  >
                    {item}
                  </Button>
                ))}
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={() => navigate('/login')}
                  sx={{
                    borderRadius: 2,
                    ml: 2,
                    borderColor: 'rgba(255,255,255,0.3)',
                    '&:hover': { borderColor: 'white', background: 'rgba(255,255,255,0.1)' }
                  }}
                >
                  Login
                </Button>
                <Button
                  variant="contained"
                  onClick={() => scrollToSection('cta')}
                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: 2,
                    px: 3,
                    fontWeight: 600,
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                    '&:hover': {
                      boxShadow: '0 6px 20px rgba(102, 126, 234, 0.6)',
                    }
                  }}
                >
                  Start Free Trial
                </Button>
              </Box>
            )}
          </Toolbar>
        </Container>
      </AppBar>

      {/* Mobile Menu */}
      <Drawer anchor="right" open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}>
        <Box sx={{ width: 280, pt: 4, px: 2, background: '#0f172a', height: '100%' }}>
          <List>
            {['Industries', 'Features', 'Pricing', 'Testimonials', 'FAQ'].map((item) => (
              <ListItem
                button
                key={item}
                onClick={() => scrollToSection(item.toLowerCase())}
                sx={{ color: 'white', borderRadius: 2, mb: 1 }}
              >
                <ListItemText primary={item} />
              </ListItem>
            ))}
            <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />
            <ListItem button onClick={() => navigate('/login')} sx={{ color: 'white', borderRadius: 2 }}>
              <ListItemText primary="Login" />
            </ListItem>
            <ListItem sx={{ mt: 2 }}>
              <Button
                fullWidth
                variant="contained"
                onClick={() => scrollToSection('cta')}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: 2,
                  py: 1.5
                }}
              >
                Start Free Trial
              </Button>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* Hero Section */}
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        {/* Animated background elements */}
        <FloatingParticles />

        {/* Gradient orbs */}
        <Box
          className="blob animate-pulse"
          sx={{
            position: 'absolute',
            top: '10%',
            right: '10%',
            width: { xs: 200, md: 400 },
            height: { xs: 200, md: 400 },
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)',
            filter: 'blur(60px)',
            zIndex: 0
          }}
        />
        <Box
          className="blob animate-pulse"
          sx={{
            position: 'absolute',
            bottom: '20%',
            left: '5%',
            width: { xs: 150, md: 300 },
            height: { xs: 150, md: 300 },
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%)',
            filter: 'blur(60px)',
            zIndex: 0,
            animationDelay: '2s'
          }}
        />

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, pt: 12, pb: 8 }}>
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={6}>
              <Box className="animate-slideUp">
                <Chip
                  icon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
                  label="Powered by Google AI & GPT-4"
                  sx={{
                    mb: 3,
                    background: 'rgba(102, 126, 234, 0.2)',
                    color: '#a5b4fc',
                    border: '1px solid rgba(102, 126, 234, 0.3)',
                    fontWeight: 500,
                    '& .MuiChip-icon': { color: '#a5b4fc' }
                  }}
                />
                <Typography
                  variant="h1"
                  sx={{
                    fontWeight: 800,
                    color: 'white',
                    fontSize: { xs: '2.5rem', sm: '3rem', md: '3.75rem' },
                    lineHeight: 1.1,
                    mb: 3,
                    letterSpacing: '-0.02em'
                  }}
                >
                  Universal AI
                  <Box
                    component="span"
                    className="text-gradient"
                    sx={{ display: 'block' }}
                  >
                    Document Processing
                  </Box>
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    color: 'rgba(255,255,255,0.7)',
                    mb: 4,
                    lineHeight: 1.8,
                    fontSize: { xs: '1rem', md: '1.125rem' },
                    maxWidth: 520
                  }}
                >
                  Transform any document into structured data in seconds.
                  From healthcare EOBs to financial invoices, legal contracts to HR forms —
                  our AI handles it all with 99% accuracy.
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 4 }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => scrollToSection('cta')}
                    endIcon={<ArrowIcon />}
                    sx={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      px: 4,
                      py: 1.5,
                      borderRadius: 2,
                      fontWeight: 600,
                      fontSize: '1rem',
                      boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
                      '&:hover': {
                        boxShadow: '0 6px 30px rgba(102, 126, 234, 0.6)',
                        transform: 'translateY(-2px)'
                      },
                      transition: 'all 0.3s ease'
                    }}
                  >
                    Start Free Trial
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={<PlayIcon />}
                    onClick={() => scrollToSection('how-it-works')}
                    sx={{
                      borderColor: 'rgba(255,255,255,0.3)',
                      color: 'white',
                      px: 4,
                      py: 1.5,
                      borderRadius: 2,
                      fontWeight: 500,
                      '&:hover': {
                        borderColor: 'white',
                        background: 'rgba(255,255,255,0.1)'
                      }
                    }}
                  >
                    Watch Demo
                  </Button>
                </Box>

                <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {['No credit card required', 'Setup in 5 minutes', '14-day free trial'].map((text, i) => (
                    <Box
                      key={text}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        color: 'rgba(255,255,255,0.6)'
                      }}
                      className="animate-slideUp"
                      style={{ animationDelay: `${0.2 + i * 0.1}s` }}
                    >
                      <CheckIcon sx={{ fontSize: 18, mr: 0.5, color: '#10b981' }} />
                      <Typography variant="body2">{text}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box
                className="animate-scaleIn"
                sx={{
                  position: 'relative',
                  perspective: '1000px'
                }}
              >
                {/* Document processing visualization */}
                <Paper
                  elevation={0}
                  sx={{
                    background: 'rgba(255,255,255,0.05)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 4,
                    p: 4,
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #667eea, #764ba2, #f093fb)', className: 'animate-shimmer' }} />

                  <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 3, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Processing Documents Across Industries
                  </Typography>

                  {/* Industry tabs with auto-rotation */}
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
                      {industries.slice(0, 4).map((industry, i) => (
                        <Chip
                          key={industry.name}
                          label={industry.name}
                          onClick={() => setActiveIndustry(i)}
                          sx={{
                            background: activeIndustry === i ? industry.gradient : 'rgba(255,255,255,0.1)',
                            color: 'white',
                            fontWeight: 500,
                            transition: 'all 0.3s ease',
                            cursor: 'pointer',
                            '&:hover': { transform: 'scale(1.05)' }
                          }}
                        />
                      ))}
                    </Box>

                    {/* Active industry details */}
                    <Box
                      key={activeIndustry}
                      className="animate-slideUp"
                      sx={{
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: 2,
                        p: 2.5,
                        border: `1px solid ${industries[activeIndustry].color}30`
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Box sx={{
                          color: industries[activeIndustry].color,
                          mr: 1.5,
                          display: 'flex'
                        }}>
                          {industries[activeIndustry].icon}
                        </Box>
                        <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                          {industries[activeIndustry].name}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
                        {industries[activeIndustry].description}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {industries[activeIndustry].documents.map((doc) => (
                          <Chip
                            key={doc}
                            label={doc}
                            size="small"
                            sx={{
                              background: 'rgba(255,255,255,0.1)',
                              color: 'rgba(255,255,255,0.8)',
                              fontSize: '0.75rem'
                            }}
                          />
                        ))}
                      </Box>
                      <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <Typography
                          variant="body2"
                          sx={{
                            color: industries[activeIndustry].color,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <TrendingUpIcon sx={{ fontSize: 18, mr: 0.5 }} />
                          {industries[activeIndustry].stats}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Stats row */}
                  <Grid container spacing={2}>
                    {[
                      { label: 'Document Types', value: '100+' },
                      { label: 'Accuracy', value: '99.2%' },
                      { label: 'Avg. Time', value: '<3s' }
                    ].map((stat) => (
                      <Grid item xs={4} key={stat.label}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h5" sx={{ color: 'white', fontWeight: 700 }}>
                            {stat.value}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                            {stat.label}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              </Box>
            </Grid>
          </Grid>
        </Container>

        {/* Scroll indicator */}
        <Box
          className="animate-bounce"
          sx={{
            position: 'absolute',
            bottom: 30,
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer'
          }}
          onClick={() => scrollToSection('stats')}
        >
          <ExpandMoreIcon sx={{ fontSize: 32 }} />
        </Box>
      </Box>

      {/* Stats Section */}
      <Box
        id="stats"
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          py: 8,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            {stats.map((stat, i) => (
              <Grid item xs={6} md={3} key={stat.label}>
                <Box
                  sx={{
                    textAlign: 'center',
                    p: 3,
                    borderRadius: 3,
                    background: 'rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(10px)'
                  }}
                  className="card-hover"
                >
                  <Box sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                    {stat.icon}
                  </Box>
                  <Typography
                    variant="h3"
                    sx={{
                      fontWeight: 800,
                      color: 'white',
                      fontSize: { xs: '2rem', md: '2.5rem' }
                    }}
                  >
                    <AnimatedCounter
                      end={stat.value}
                      suffix={stat.suffix}
                      duration={2000 + i * 200}
                    />
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                    {stat.label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Industries Section */}
      <Box id="industries" sx={{ py: 12, background: '#f8fafc' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Chip
              label="Multi-Industry Solution"
              sx={{ mb: 2, background: 'rgba(102, 126, 234, 0.1)', color: '#667eea' }}
            />
            <Typography
              variant="h2"
              sx={{
                fontWeight: 800,
                mb: 2,
                fontSize: { xs: '2rem', md: '2.75rem' }
              }}
            >
              One Platform, <span className="text-gradient">Every Industry</span>
            </Typography>
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ maxWidth: 600, mx: 'auto', fontWeight: 400 }}
            >
              From healthcare to finance, legal to logistics — DocuParse adapts to your industry's
              unique document processing needs.
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {industries.map((industry, index) => (
              <Grid item xs={12} sm={6} md={4} key={industry.name}>
                <Card
                  className="card-hover"
                  sx={{
                    height: '100%',
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'grey.200',
                    overflow: 'visible',
                    position: 'relative'
                  }}
                  elevation={0}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -20,
                      left: 24,
                      width: 56,
                      height: 56,
                      borderRadius: 2,
                      background: industry.gradient,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      boxShadow: `0 8px 20px ${industry.color}40`
                    }}
                  >
                    {industry.icon}
                  </Box>
                  <CardContent sx={{ pt: 6, pb: 3, px: 3 }}>
                    <Typography variant="h5" fontWeight={700} gutterBottom sx={{ mt: 1 }}>
                      {industry.name}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mb: 2, minHeight: 60 }}>
                      {industry.description}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                      {industry.documents.slice(0, 3).map((doc) => (
                        <Chip
                          key={doc}
                          label={doc}
                          size="small"
                          sx={{
                            background: `${industry.color}10`,
                            color: industry.color,
                            fontSize: '0.7rem',
                            height: 24
                          }}
                        />
                      ))}
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        color: industry.color,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <TrendingUpIcon sx={{ fontSize: 16, mr: 0.5 }} />
                      {industry.stats}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* How It Works Section */}
      <Box id="how-it-works" sx={{ py: 12, background: 'white' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Chip
              label="Simple Workflow"
              sx={{ mb: 2, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}
            />
            <Typography
              variant="h2"
              sx={{
                fontWeight: 800,
                mb: 2,
                fontSize: { xs: '2rem', md: '2.75rem' }
              }}
            >
              From Document to Data in <span className="text-gradient">Seconds</span>
            </Typography>
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ maxWidth: 600, mx: 'auto', fontWeight: 400 }}
            >
              Our streamlined 4-step process turns any document into actionable structured data.
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {workflowSteps.map((step, index) => (
              <Grid item xs={12} sm={6} md={3} key={step.step}>
                <Box
                  sx={{
                    textAlign: 'center',
                    position: 'relative'
                  }}
                >
                  {/* Connector line */}
                  {index < workflowSteps.length - 1 && !isMobile && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 40,
                        left: '60%',
                        width: '80%',
                        height: 2,
                        background: `linear-gradient(90deg, ${step.color}, ${workflowSteps[index + 1].color})`,
                        opacity: 0.3,
                        zIndex: 0
                      }}
                    />
                  )}

                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      background: `${step.color}15`,
                      border: `3px solid ${step.color}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: step.color,
                      mx: 'auto',
                      mb: 3,
                      position: 'relative',
                      zIndex: 1
                    }}
                    className="card-hover"
                  >
                    {step.icon}
                  </Box>
                  <Typography
                    variant="overline"
                    sx={{
                      color: step.color,
                      fontWeight: 700,
                      letterSpacing: 2
                    }}
                  >
                    Step {step.step}
                  </Typography>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    {step.title}
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    {step.description}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Box id="features" sx={{ py: 12, background: '#0f172a' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Chip
              label="Powerful Features"
              sx={{ mb: 2, background: 'rgba(102, 126, 234, 0.2)', color: '#a5b4fc' }}
            />
            <Typography
              variant="h2"
              sx={{
                fontWeight: 800,
                color: 'white',
                mb: 2,
                fontSize: { xs: '2rem', md: '2.75rem' }
              }}
            >
              Enterprise-Grade <span className="text-gradient">AI Processing</span>
            </Typography>
            <Typography
              variant="h6"
              sx={{
                color: 'rgba(255,255,255,0.6)',
                maxWidth: 600,
                mx: 'auto',
                fontWeight: 400
              }}
            >
              Everything you need to automate document processing at scale.
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {features.map((feature, index) => (
              <Grid item xs={12} md={4} key={feature.title}>
                <Card
                  className="card-hover"
                  sx={{
                    height: '100%',
                    background: 'rgba(255,255,255,0.03)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 3
                  }}
                  elevation={0}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: 2,
                        background: feature.gradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        mb: 3,
                        boxShadow: '0 8px 20px rgba(0,0,0,0.3)'
                      }}
                    >
                      {feature.icon}
                    </Box>
                    <Typography variant="h5" fontWeight={700} gutterBottom sx={{ color: 'white' }}>
                      {feature.title}
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.6)', mb: 2 }}>
                      {feature.description}
                    </Typography>
                    <Chip
                      label={feature.stats}
                      size="small"
                      sx={{
                        background: 'rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.8)'
                      }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Pricing Section */}
      <Box id="pricing" sx={{ py: 12, background: '#f8fafc' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Chip
              label="Simple Pricing"
              sx={{ mb: 2, background: 'rgba(102, 126, 234, 0.1)', color: '#667eea' }}
            />
            <Typography
              variant="h2"
              sx={{
                fontWeight: 800,
                mb: 2,
                fontSize: { xs: '2rem', md: '2.75rem' }
              }}
            >
              Transparent, <span className="text-gradient">Scalable Pricing</span>
            </Typography>
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ maxWidth: 600, mx: 'auto', fontWeight: 400 }}
            >
              Start free, scale as you grow. All plans include core AI features.
            </Typography>
          </Box>

          <Grid container spacing={4} justifyContent="center">
            {pricingTiers.map((tier) => (
              <Grid item xs={12} md={4} key={tier.name}>
                <Card
                  className="card-hover"
                  sx={{
                    height: '100%',
                    borderRadius: 3,
                    border: tier.popular ? '2px solid #667eea' : '1px solid',
                    borderColor: tier.popular ? '#667eea' : 'grey.200',
                    position: 'relative',
                    overflow: 'visible'
                  }}
                  elevation={tier.popular ? 8 : 0}
                >
                  {tier.popular && (
                    <Chip
                      label="Most Popular"
                      sx={{
                        position: 'absolute',
                        top: -12,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        fontWeight: 600
                      }}
                    />
                  )}
                  <CardContent sx={{ p: 4, pt: tier.popular ? 5 : 4 }}>
                    <Typography variant="h5" fontWeight={700} gutterBottom>
                      {tier.name}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mb: 3 }}>
                      {tier.description}
                    </Typography>
                    <Box sx={{ mb: 3 }}>
                      {typeof tier.price === 'number' ? (
                        <>
                          <Typography component="span" variant="h3" fontWeight={800}>
                            ${tier.price}
                          </Typography>
                          <Typography component="span" color="text.secondary">/month</Typography>
                        </>
                      ) : (
                        <Typography variant="h4" fontWeight={800}>
                          {tier.price}
                        </Typography>
                      )}
                    </Box>
                    <Divider sx={{ my: 3 }} />
                    <Box sx={{ mb: 3 }}>
                      {tier.features.map((feature) => (
                        <Box key={feature} sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                          <CheckIcon sx={{ color: '#10b981', mr: 1.5, fontSize: 20 }} />
                          <Typography variant="body2">{feature}</Typography>
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
                        fontWeight: 600,
                        ...(tier.popular && {
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
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
      <Box id="testimonials" sx={{ py: 12, background: 'white' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Chip
              label="Customer Stories"
              sx={{ mb: 2, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}
            />
            <Typography
              variant="h2"
              sx={{
                fontWeight: 800,
                mb: 2,
                fontSize: { xs: '2rem', md: '2.75rem' }
              }}
            >
              Trusted by <span className="text-gradient">Industry Leaders</span>
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {testimonials.map((testimonial) => (
              <Grid item xs={12} md={4} key={testimonial.name}>
                <Card
                  className="card-hover"
                  sx={{
                    height: '100%',
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'grey.200'
                  }}
                  elevation={0}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Chip
                      label={testimonial.industry}
                      size="small"
                      sx={{ mb: 2, background: 'rgba(102, 126, 234, 0.1)', color: '#667eea' }}
                    />
                    <Rating value={testimonial.rating} readOnly sx={{ mb: 2 }} />
                    <Typography sx={{ mb: 3, fontStyle: 'italic', color: 'text.secondary' }}>
                      "{testimonial.quote}"
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar
                        sx={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          mr: 2
                        }}
                      >
                        {testimonial.avatar}
                      </Avatar>
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
      <Box id="faq" sx={{ py: 12, background: '#f8fafc' }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography
              variant="h2"
              sx={{
                fontWeight: 800,
                fontSize: { xs: '2rem', md: '2.75rem' }
              }}
            >
              Frequently Asked <span className="text-gradient">Questions</span>
            </Typography>
          </Box>

          {faqs.map((faq, index) => (
            <Accordion
              key={index}
              elevation={0}
              sx={{
                mb: 2,
                '&:before': { display: 'none' },
                borderRadius: '12px !important',
                border: '1px solid',
                borderColor: 'grey.200',
                overflow: 'hidden'
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ px: 3, py: 1 }}
              >
                <Typography variant="subtitle1" fontWeight={600}>
                  {faq.question}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 3, pb: 3 }}>
                <Typography color="text.secondary">
                  {faq.answer}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Container>
      </Box>

      {/* CTA Section */}
      <Box
        id="cta"
        sx={{
          py: 12,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <FloatingParticles />
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ textAlign: 'center', color: 'white' }}>
            <Typography
              variant="h3"
              fontWeight={800}
              gutterBottom
              sx={{ fontSize: { xs: '1.75rem', md: '2.5rem' } }}
            >
              Ready to Transform Your Document Processing?
            </Typography>
            <Typography variant="h6" sx={{ mb: 4, opacity: 0.8, fontWeight: 400 }}>
              Join 2,000+ companies processing millions of documents with DocuParse.
              Start your 14-day free trial today.
            </Typography>

            <Box
              component="form"
              onSubmit={handleDemoRequest}
              sx={{
                display: 'flex',
                gap: 2,
                justifyContent: 'center',
                flexWrap: 'wrap',
                mb: 4
              }}
            >
              <TextField
                placeholder="Enter your work email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                sx={{
                  minWidth: { xs: '100%', sm: 320 },
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
                endIcon={<ArrowIcon />}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  px: 4,
                  borderRadius: 2,
                  fontWeight: 600,
                  boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                  minWidth: { xs: '100%', sm: 'auto' }
                }}
              >
                Start Free Trial
              </Button>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
              {['14-day free trial', 'No credit card required', 'Full feature access'].map((text) => (
                <Box key={text} sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckIcon sx={{ fontSize: 18, mr: 0.5, color: '#10b981' }} />
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>{text}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ background: '#0f172a', color: 'white', py: 8 }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mr: 1.5
                  }}
                >
                  <AutoAwesomeIcon sx={{ color: 'white', fontSize: 24 }} />
                </Box>
                <Typography variant="h5" fontWeight={700}>
                  DocuParse
                </Typography>
              </Box>
              <Typography sx={{ opacity: 0.7, mb: 2, maxWidth: 300 }}>
                Universal AI-powered document processing platform for modern enterprises.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <IconButton sx={{ color: 'white', opacity: 0.7, '&:hover': { opacity: 1 } }}>
                  <LinkedInIcon />
                </IconButton>
                <IconButton sx={{ color: 'white', opacity: 0.7, '&:hover': { opacity: 1 } }}>
                  <TwitterIcon />
                </IconButton>
              </Box>
            </Grid>

            <Grid item xs={6} md={2}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>Product</Typography>
              {['Features', 'Pricing', 'Industries', 'API Docs', 'Integrations'].map((item) => (
                <Typography
                  key={item}
                  sx={{ opacity: 0.7, mb: 1, cursor: 'pointer', '&:hover': { opacity: 1 } }}
                >
                  {item}
                </Typography>
              ))}
            </Grid>

            <Grid item xs={6} md={2}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>Company</Typography>
              {['About', 'Blog', 'Careers', 'Contact', 'Partners'].map((item) => (
                <Typography
                  key={item}
                  sx={{ opacity: 0.7, mb: 1, cursor: 'pointer', '&:hover': { opacity: 1 } }}
                >
                  {item}
                </Typography>
              ))}
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>Contact Us</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, opacity: 0.7 }}>
                <EmailIcon sx={{ mr: 1.5, fontSize: 18 }} />
                <Typography>support@docuparse.com</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, opacity: 0.7 }}>
                <PhoneIcon sx={{ mr: 1.5, fontSize: 18 }} />
                <Typography>1-800-DOCUPARSE</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', opacity: 0.7 }}>
                <LocationIcon sx={{ mr: 1.5, fontSize: 18 }} />
                <Typography>San Francisco, CA</Typography>
              </Box>
            </Grid>
          </Grid>

          <Divider sx={{ my: 4, borderColor: 'rgba(255,255,255,0.1)' }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Typography sx={{ opacity: 0.5 }}>
              2026 DocuParse. All rights reserved.
            </Typography>
            <Box sx={{ display: 'flex', gap: 3 }}>
              {['Privacy Policy', 'Terms of Service', 'Security', 'Compliance'].map((item) => (
                <Typography
                  key={item}
                  sx={{ opacity: 0.5, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
                >
                  {item}
                </Typography>
              ))}
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
