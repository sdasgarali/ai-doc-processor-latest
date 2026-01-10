import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  TextField,
  Button,
  Grid,
  Avatar,
  Divider,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Chip,
  Card,
  CardContent,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Person as PersonIcon,
  Lock as LockIcon,
  History as HistoryIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const Profile = () => {
  const { user: authUser } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Profile data
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    timezone: ''
  });

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [passwordStrength, setPasswordStrength] = useState('');

  // Activity data
  const [activity, setActivity] = useState(null);

  const timezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney'
  ];

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (activeTab === 2) {
      fetchActivity();
    }
  }, [activeTab]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/profile/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setProfile(response.data.data);
      setEditForm({
        first_name: response.data.data.first_name,
        last_name: response.data.data.last_name,
        timezone: response.data.data.timezone || 'UTC'
      });
      setError('');
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivity = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/profile/activity', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActivity(response.data.data);
    } catch (err) {
      console.error('Error fetching activity:', err);
    }
  };

  const handleEditProfile = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({
      first_name: profile.first_name,
      last_name: profile.last_name,
      timezone: profile.timezone || 'UTC'
    });
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      await axios.put(
        '/api/profile/me',
        editForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
      await fetchProfile();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.response?.data?.message || 'Failed to update profile');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const checkPasswordStrength = (password) => {
    if (!password) {
      setPasswordStrength('');
      return;
    }

    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[@$!%*?&]/.test(password)) strength++;

    if (strength <= 2) setPasswordStrength('weak');
    else if (strength <= 4) setPasswordStrength('medium');
    else setPasswordStrength('strong');
  };

  const handlePasswordChange = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      await axios.post(
        '/api/profile/change-password',
        passwordForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess('Password changed successfully!');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setPasswordStrength('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error changing password:', err);
      setError(err.response?.data?.message || 'Failed to change password');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getInitials = () => {
    if (!profile) return 'U';
    return `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase();
  };

  const renderProfileTab = () => (
    <Box>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Avatar sx={{ width: 80, height: 80, bgcolor: 'primary.main', fontSize: '2rem', mr: 3 }}>
              {getInitials()}
            </Avatar>
            <Box>
              <Typography variant="h5" fontWeight="bold">
                {profile?.first_name} {profile?.last_name}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {profile?.email}
              </Typography>
              <Chip 
                label={profile?.user_role?.toUpperCase()} 
                color="primary" 
                size="small" 
                sx={{ mt: 1 }}
              />
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                label="First Name"
                fullWidth
                value={isEditing ? editForm.first_name : profile?.first_name}
                onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                disabled={!isEditing}
                InputProps={{
                  readOnly: !isEditing
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Last Name"
                fullWidth
                value={isEditing ? editForm.last_name : profile?.last_name}
                onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                disabled={!isEditing}
                InputProps={{
                  readOnly: !isEditing
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Email"
                fullWidth
                value={profile?.email}
                disabled
                helperText="Email cannot be changed"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                select
                label="Timezone"
                fullWidth
                value={isEditing ? editForm.timezone : profile?.timezone || 'UTC'}
                onChange={(e) => setEditForm({ ...editForm, timezone: e.target.value })}
                disabled={!isEditing}
                SelectProps={{
                  native: true
                }}
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="User Role"
                fullWidth
                value={profile?.user_role}
                disabled
                helperText="Role is managed by administrators"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Account Status"
                fullWidth
                value={profile?.is_active ? 'Active' : 'Inactive'}
                disabled
              />
            </Grid>
            {profile?.client_name && (
              <>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Client Organization"
                    fullWidth
                    value={profile?.client_name}
                    disabled
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Client Contact"
                    fullWidth
                    value={profile?.client_contact || 'N/A'}
                    disabled
                  />
                </Grid>
              </>
            )}
            <Grid item xs={12} md={6}>
              <TextField
                label="Last Login"
                fullWidth
                value={formatDate(profile?.last_login)}
                disabled
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Account Created"
                fullWidth
                value={formatDate(profile?.created_at)}
                disabled
              />
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            {isEditing ? (
              <>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveProfile}
                  disabled={loading}
                >
                  Save Changes
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<CancelIcon />}
                  onClick={handleCancelEdit}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={handleEditProfile}
              >
                Edit Profile
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );

  const renderPasswordTab = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Change Password
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Ensure your password is strong and unique. Must be at least 8 characters with uppercase, lowercase, number, and special character.
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              label="Current Password"
              type={showPasswords.current ? 'text' : 'password'}
              fullWidth
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                      edge="end"
                    >
                      {showPasswords.current ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="New Password"
              type={showPasswords.new ? 'text' : 'password'}
              fullWidth
              value={passwordForm.newPassword}
              onChange={(e) => {
                setPasswordForm({ ...passwordForm, newPassword: e.target.value });
                checkPasswordStrength(e.target.value);
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      edge="end"
                    >
                      {showPasswords.new ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
              helperText={
                passwordStrength && (
                  <span>
                    Password strength: {' '}
                    <span style={{
                      color: passwordStrength === 'weak' ? 'red' : passwordStrength === 'medium' ? 'orange' : 'green',
                      fontWeight: 'bold'
                    }}>
                      {passwordStrength.toUpperCase()}
                    </span>
                  </span>
                )
              }
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Confirm New Password"
              type={showPasswords.confirm ? 'text' : 'password'}
              fullWidth
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              error={passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword}
              helperText={
                passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword
                  ? 'Passwords do not match'
                  : ''
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      edge="end"
                    >
                      {showPasswords.confirm ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 3 }}>
          <Button
            variant="contained"
            startIcon={<LockIcon />}
            onClick={handlePasswordChange}
            disabled={
              loading ||
              !passwordForm.currentPassword ||
              !passwordForm.newPassword ||
              !passwordForm.confirmPassword ||
              passwordForm.newPassword !== passwordForm.confirmPassword
            }
          >
            Change Password
          </Button>
        </Box>
      </CardContent>
    </Card>
  );

  const renderActivityTab = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Account Activity
        </Typography>

        {activity ? (
          <>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, bgcolor: 'primary.light' }}>
                  <Typography variant="body2" color="primary.contrastText">
                    Last Login
                  </Typography>
                  <Typography variant="h6" color="primary.contrastText">
                    {formatDate(activity.lastLogin)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, bgcolor: 'secondary.light' }}>
                  <Typography variant="body2" color="secondary.contrastText">
                    Member Since
                  </Typography>
                  <Typography variant="h6" color="secondary.contrastText">
                    {formatDate(activity.accountCreated)}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Recent Document Processing
            </Typography>

            {activity.recentDocuments && activity.recentDocuments.length > 0 ? (
              <List>
                {activity.recentDocuments.map((doc) => (
                  <ListItem key={doc.process_id} divider>
                    <ListItemText
                      primary={doc.document_name}
                      secondary={`Status: ${doc.status} • ${formatDate(doc.created_at)}`}
                    />
                    <Chip
                      label={doc.status}
                      color={
                        doc.status === 'completed' ? 'success' :
                        doc.status === 'processing' ? 'warning' :
                        doc.status === 'failed' ? 'error' : 'default'
                      }
                      size="small"
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                No recent document processing activity
              </Typography>
            )}
          </>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        )}
      </CardContent>
    </Card>
  );

  if (loading && !profile) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        My Profile
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<PersonIcon />} label="Profile" />
          <Tab icon={<LockIcon />} label="Security" />
          <Tab icon={<HistoryIcon />} label="Activity" />
        </Tabs>
      </Paper>

      {activeTab === 0 && renderProfileTab()}
      {activeTab === 1 && renderPasswordTab()}
      {activeTab === 2 && renderActivityTab()}
    </Box>
  );
};

export default Profile;
