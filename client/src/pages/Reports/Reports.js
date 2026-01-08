import React, { useState } from 'react';
import { Box, Typography, Paper, Tabs, Tab } from '@mui/material';
import {
  Assessment as AssessmentIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import ClientUsageReport from './ClientUsageReport';
import CustomReportBuilder from './CustomReportBuilder';

const Reports = () => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Reports
      </Typography>

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<AssessmentIcon />} label="Standard Reports" />
          <Tab icon={<TrendingUpIcon />} label="Customized Reports" />
        </Tabs>
      </Paper>

      {activeTab === 0 && <ClientUsageReport />}
      {activeTab === 1 && <CustomReportBuilder />}
    </Box>
  );
};

export default Reports;
