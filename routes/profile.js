const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

// Get current user profile
router.get('/me', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userid;

    const userResult = await query(
      `SELECT 
        u.userid,
        u.email,
        u.first_name,
        u.last_name,
        u.user_role,
        u.is_active,
        u.timezone,
        u.last_login,
        u.created_at,
        c.client_id,
        c.client_name,
        c.contact_name as client_contact,
        c.phone_no as client_phone
      FROM user_profile u
      LEFT JOIN client c ON u.client_id = c.client_id
      WHERE u.userid = ?`,
      [userId]
    );

    if (userResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult[0];
    // Remove sensitive data
    delete user.password;

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile'
    });
  }
});

// Update user profile
router.put('/me', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userid;
    const { first_name, last_name, timezone } = req.body;

    // Validate input
    if (!first_name || !last_name) {
      return res.status(400).json({
        success: false,
        message: 'First name and last name are required'
      });
    }

    await query(
      `UPDATE user_profile 
       SET first_name = ?, last_name = ?, timezone = ?
       WHERE userid = ?`,
      [first_name, last_name, timezone || 'UTC', userId]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
});

// Change password
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userid;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All password fields are required'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New passwords do not match'
      });
    }

    // Password strength validation
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    // Check if password contains at least one uppercase, one lowercase, one number, and one special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      });
    }

    // Get current password hash
    const userResult = await query(
      'SELECT password FROM user_profile WHERE userid = ?',
      [userId]
    );

    if (userResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, userResult[0].password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await query(
      'UPDATE user_profile SET password = ? WHERE userid = ?',
      [hashedPassword, userId]
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password'
    });
  }
});

// Get user activity log (last 10 logins)
router.get('/activity', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userid;

    // For now, return basic info. You can create an activity_log table for detailed tracking
    const userResult = await query(
      `SELECT 
        last_login,
        created_at
      FROM user_profile 
      WHERE userid = ?`,
      [userId]
    );

    if (userResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get document processing activity
    const documentActivity = await query(
      `SELECT 
        process_id,
        document_name,
        status,
        created_at
      FROM document_process
      WHERE userid = ?
      ORDER BY created_at DESC
      LIMIT 10`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        lastLogin: userResult[0].last_login,
        accountCreated: userResult[0].created_at,
        recentDocuments: documentActivity
      }
    });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching activity'
    });
  }
});

module.exports = router;
