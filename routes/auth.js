const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const {
  validatePassword,
  validatePasswordMiddleware,
  validateNewPasswordMiddleware,
  getPasswordRequirements
} = require('../middleware/passwordPolicy');
const {
  loginLimiter,
  registerLimiter,
  passwordChangeLimiter,
  passwordResetLimiter
} = require('../middleware/rateLimiter');

// Login - with strict rate limiting
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required.' 
      });
    }

    // Get user
    const users = await query(
      'SELECT * FROM user_profile WHERE email = ? AND is_active = true',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password.' 
      });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password.' 
      });
    }

    // Update last login
    await query(
      'UPDATE user_profile SET last_login = NOW() WHERE userid = ?',
      [user.userid]
    );

    // Generate JWT token
    const token = jwt.sign(
      { 
        userid: user.userid, 
        email: user.email, 
        role: user.user_role,
        client_id: user.client_id
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    // Remove password from response
    delete user.password;

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        userid: user.userid,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        user_role: user.user_role,
        client_id: user.client_id,
        timezone: user.timezone
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login.' 
    });
  }
});

// Register (admin only can create users) - with rate limiting
router.post('/register', registerLimiter, verifyToken, async (req, res) => {
  try {
    const { email, password, first_name, last_name, user_role, client_id, timezone } = req.body;

    // Only admin and superadmin can create users
    if (!['admin', 'superadmin'].includes(req.user.user_role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only administrators can create users.'
      });
    }

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    // Validate password against policy
    const passwordValidation = validatePassword(password, { email, first_name, last_name });
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet security requirements',
        errors: passwordValidation.errors
      });
    }

    // Check if user already exists
    const existingUsers = await query(
      'SELECT userid FROM user_profile WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists.'
      });
    }

    // Hash password with higher cost factor for security
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const result = await query(
      `INSERT INTO user_profile (email, password, first_name, last_name, user_role, client_id, timezone) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [email, hashedPassword, first_name, last_name, user_role || 'user', client_id, timezone || 'UTC']
    );

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      userid: result.insertId
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during registration.' 
    });
  }
});

// Get current user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const users = await query(
      `SELECT u.userid, u.email, u.first_name, u.last_name, u.user_role, u.client_id, 
              u.timezone, u.last_login, u.created_at, c.client_name
       FROM user_profile u
       LEFT JOIN client c ON u.client_id = c.client_id
       WHERE u.userid = ?`,
      [req.user.userid]
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found.' 
      });
    }

    res.json({
      success: true,
      user: users[0]
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching profile.' 
    });
  }
});

// Update profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { first_name, last_name, timezone } = req.body;

    await query(
      'UPDATE user_profile SET first_name = ?, last_name = ?, timezone = ? WHERE userid = ?',
      [first_name, last_name, timezone || 'UTC', req.user.userid]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating profile.' 
    });
  }
});

// Change password - with rate limiting
router.post('/change-password', passwordChangeLimiter, verifyToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'Current and new passwords are required.'
      });
    }

    // Validate new password against policy
    const passwordValidation = validatePassword(new_password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'New password does not meet security requirements',
        errors: passwordValidation.errors
      });
    }

    // Get current user with password
    const users = await query(
      'SELECT password FROM user_profile WHERE userid = ?',
      [req.user.userid]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Verify current password
    const isValid = await bcrypt.compare(current_password, users[0].password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect.'
      });
    }

    // Ensure new password is different from current
    const isSamePassword = await bcrypt.compare(new_password, users[0].password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password.'
      });
    }

    // Hash new password with higher cost factor
    const hashedPassword = await bcrypt.hash(new_password, 12);

    // Update password
    await query(
      'UPDATE user_profile SET password = ? WHERE userid = ?',
      [hashedPassword, req.user.userid]
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error changing password.' 
    });
  }
});

// Reset password (admin function) - with rate limiting
router.post('/reset-password/:userid', passwordResetLimiter, verifyToken, async (req, res) => {
  try {
    const { new_password } = req.body;
    const targetUserId = req.params.userid;

    // Only admin and superadmin can reset passwords
    if (!['admin', 'superadmin'].includes(req.user.user_role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only administrators can reset passwords.'
      });
    }

    if (!new_password) {
      return res.status(400).json({
        success: false,
        message: 'New password is required.'
      });
    }

    // Validate new password against policy
    const passwordValidation = validatePassword(new_password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'New password does not meet security requirements',
        errors: passwordValidation.errors
      });
    }

    // Hash new password with higher cost factor
    const hashedPassword = await bcrypt.hash(new_password, 12);

    // Update password
    const result = await query(
      'UPDATE user_profile SET password = ? WHERE userid = ?',
      [hashedPassword, targetUserId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found.' 
      });
    }

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error resetting password.' 
    });
  }
});

// Verify token (for frontend to check if token is still valid)
router.get('/verify', verifyToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// Get password requirements (for frontend display)
router.get('/password-requirements', (req, res) => {
  res.json({
    success: true,
    requirements: getPasswordRequirements()
  });
});

module.exports = router;
