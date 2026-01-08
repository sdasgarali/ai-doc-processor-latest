const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists and is active
    const users = await query(
      'SELECT userid, email, user_role, client_id, is_active, timezone FROM user_profile WHERE userid = ?',
      [decoded.userid]
    );

    if (users.length === 0 || !users[0].is_active) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token or user inactive.' 
      });
    }

    req.user = users[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired. Please login again.' 
      });
    }
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token.' 
    });
  }
};

// Check user role
const checkRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required.' 
      });
    }

    if (!roles.includes(req.user.user_role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Insufficient permissions.' 
      });
    }

    next();
  };
};

// Check if user belongs to client
const checkClientAccess = async (req, res, next) => {
  try {
    const clientId = req.params.clientId || req.body.client_id;
    
    if (!clientId) {
      return next();
    }

    // Superadmin can access all clients
    if (req.user.user_role === 'superadmin') {
      return next();
    }

    // Check if user belongs to the client
    if (req.user.client_id !== parseInt(clientId)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. You do not have access to this client.' 
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Error checking client access.' 
    });
  }
};

// Check specific permission
const checkPermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      // Superadmin has all permissions
      if (req.user.user_role === 'superadmin') {
        return next();
      }

      const permissions = await query(
        'SELECT permission_name FROM user_permissions WHERE userid = ? AND permission_name = ?',
        [req.user.userid, permissionName]
      );

      if (permissions.length === 0) {
        return res.status(403).json({ 
          success: false, 
          message: `Access denied. ${permissionName} permission required.` 
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        message: 'Error checking permissions.' 
      });
    }
  };
};

// Log user activity
const logActivity = (action) => {
  return async (req, res, next) => {
    try {
      const originalSend = res.send;
      
      res.send = function(data) {
        // Log the activity
        query(
          `INSERT INTO audit_log (userid, action, table_name, ip_address, user_agent) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            req.user?.userid,
            action,
            req.baseUrl,
            req.ip,
            req.headers['user-agent']
          ]
        ).catch(err => console.error('Audit log error:', err));

        originalSend.call(this, data);
      };

      next();
    } catch (error) {
      next();
    }
  };
};

module.exports = {
  verifyToken,
  checkRole,
  checkClientAccess,
  checkPermission,
  logActivity
};
