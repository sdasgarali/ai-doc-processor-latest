const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken, checkRole } = require('../middleware/auth');

// Middleware to check if user has permission
const checkPermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.userid;
      const userRole = req.user.user_role;

      // SuperAdmin always has access
      if (userRole === 'superadmin') {
        return next();
      }

      // Check if permission exists
      const permissionResult = await query(
        'SELECT permission_id FROM permissions WHERE permission_name = ?',
        [permissionName]
      );

      if (permissionResult.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Permission not found'
        });
      }

      const permissionId = permissionResult[0].permission_id;

      // Check user-specific deny permissions first
      const userDeny = await query(
        `SELECT id FROM user_specific_permissions 
         WHERE userid = ? AND permission_id = ? AND permission_type = 'deny'
         AND (expires_at IS NULL OR expires_at > NOW())`,
        [userId, permissionId]
      );

      if (userDeny.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied by user-specific permission'
        });
      }

      // Check user-specific allow permissions
      const userAllow = await query(
        `SELECT id FROM user_specific_permissions 
         WHERE userid = ? AND permission_id = ? AND permission_type = 'allow'
         AND (expires_at IS NULL OR expires_at > NOW())`,
        [userId, permissionId]
      );

      if (userAllow.length > 0) {
        return next();
      }

      // Check role-based permissions
      const rolePermission = await query(
        'SELECT id FROM role_permissions WHERE user_role = ? AND permission_id = ?',
        [userRole, permissionId]
      );

      if (rolePermission.length > 0) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking permissions'
      });
    }
  };
};

// Get all permissions
router.get('/permissions', verifyToken, checkPermission('view_permissions'), async (req, res) => {
  try {
    const { category } = req.query;

    let sql = 'SELECT * FROM permissions';
    const params = [];

    if (category) {
      sql += ' WHERE permission_category = ?';
      params.push(category);
    }

    sql += ' ORDER BY permission_category, permission_name';

    const permissions = await query(sql, params);

    // Group by category
    const grouped = permissions.reduce((acc, perm) => {
      if (!acc[perm.permission_category]) {
        acc[perm.permission_category] = [];
      }
      acc[perm.permission_category].push(perm);
      return acc;
    }, {});

    res.json({
      success: true,
      data: permissions,
      grouped: grouped
    });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching permissions'
    });
  }
});

// Get all permission categories
router.get('/permissions/categories', verifyToken, async (req, res) => {
  try {
    const categories = await query(
      'SELECT DISTINCT permission_category FROM permissions ORDER BY permission_category'
    );

    res.json({
      success: true,
      data: categories.map(c => c.permission_category)
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories'
    });
  }
});

// Get role permissions
router.get('/roles/:role/permissions', verifyToken, checkPermission('view_permissions'), async (req, res) => {
  try {
    const { role } = req.params;

    const rolePermissions = await query(
      `SELECT p.*, rp.id as role_permission_id, rp.created_at as assigned_at
       FROM permissions p
       INNER JOIN role_permissions rp ON p.permission_id = rp.permission_id
       WHERE rp.user_role = ?
       ORDER BY p.permission_category, p.permission_name`,
      [role]
    );

    res.json({
      success: true,
      data: rolePermissions
    });
  } catch (error) {
    console.error('Get role permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching role permissions'
    });
  }
});

// Update role permissions
router.post('/roles/:role/permissions', verifyToken, checkPermission('manage_role_permissions'), async (req, res) => {
  try {
    const { role } = req.params;
    const { permissionIds } = req.body; // Array of permission IDs to assign
    const grantedBy = req.user.userid;

    if (!Array.isArray(permissionIds)) {
      return res.status(400).json({
        success: false,
        message: 'permissionIds must be an array'
      });
    }

    // Delete existing role permissions
    await query('DELETE FROM role_permissions WHERE user_role = ?', [role]);

    // Insert new permissions
    if (permissionIds.length > 0) {
      const values = permissionIds.map(permId => `('${role}', ${permId}, ${grantedBy})`).join(',');
      await query(
        `INSERT INTO role_permissions (user_role, permission_id, granted_by) VALUES ${values}`
      );
    }

    res.json({
      success: true,
      message: 'Role permissions updated successfully',
      count: permissionIds.length
    });
  } catch (error) {
    console.error('Update role permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating role permissions'
    });
  }
});

// Get user-specific permissions
router.get('/users/:userid/permissions', verifyToken, checkPermission('view_permissions'), async (req, res) => {
  try {
    const { userid } = req.params;

    // Get user's role-based permissions
    const userInfo = await query(
      'SELECT user_role FROM user_profile WHERE userid = ?',
      [userid]
    );

    if (userInfo.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userRole = userInfo[0].user_role;

    // Get role permissions
    const rolePermissions = await query(
      `SELECT p.*, 'role' as source, rp.created_at as assigned_at
       FROM permissions p
       INNER JOIN role_permissions rp ON p.permission_id = rp.permission_id
       WHERE rp.user_role = ?`,
      [userRole]
    );

    // Get user-specific permissions
    const userPermissions = await query(
      `SELECT p.*, usp.permission_type, usp.expires_at, usp.created_at as assigned_at,
              u.email as granted_by_email
       FROM permissions p
       INNER JOIN user_specific_permissions usp ON p.permission_id = usp.permission_id
       LEFT JOIN user_profile u ON usp.granted_by = u.userid
       WHERE usp.userid = ?`,
      [userid]
    );

    res.json({
      success: true,
      data: {
        userRole: userRole,
        rolePermissions: rolePermissions,
        userSpecificPermissions: userPermissions
      }
    });
  } catch (error) {
    console.error('Get user permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user permissions'
    });
  }
});

// Add user-specific permission
router.post('/users/:userid/permissions', verifyToken, checkPermission('manage_user_permissions'), async (req, res) => {
  try {
    const { userid } = req.params;
    const { permissionId, permissionType = 'allow', expiresAt } = req.body;
    const grantedBy = req.user.userid;

    if (!permissionId) {
      return res.status(400).json({
        success: false,
        message: 'permissionId is required'
      });
    }

    // Check if user exists
    const userCheck = await query('SELECT userid FROM user_profile WHERE userid = ?', [userid]);
    if (userCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Insert or update user-specific permission
    await query(
      `INSERT INTO user_specific_permissions (userid, permission_id, permission_type, granted_by, expires_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE permission_type = VALUES(permission_type), 
                                expires_at = VALUES(expires_at),
                                granted_by = VALUES(granted_by)`,
      [userid, permissionId, permissionType, grantedBy, expiresAt || null]
    );

    res.json({
      success: true,
      message: 'User permission added successfully'
    });
  } catch (error) {
    console.error('Add user permission error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding user permission'
    });
  }
});

// Remove user-specific permission
router.delete('/users/:userid/permissions/:permissionId', verifyToken, checkPermission('manage_user_permissions'), async (req, res) => {
  try {
    const { userid, permissionId } = req.params;

    await query(
      'DELETE FROM user_specific_permissions WHERE userid = ? AND permission_id = ?',
      [userid, permissionId]
    );

    res.json({
      success: true,
      message: 'User permission removed successfully'
    });
  } catch (error) {
    console.error('Remove user permission error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing user permission'
    });
  }
});

// Bulk update user permissions
router.post('/users/:userid/permissions/bulk', verifyToken, checkPermission('manage_user_permissions'), async (req, res) => {
  try {
    const { userid } = req.params;
    const { permissions } = req.body; // Array of {permissionId, permissionType, expiresAt}
    const grantedBy = req.user.userid;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        message: 'permissions must be an array'
      });
    }

    // Delete existing user-specific permissions
    await query('DELETE FROM user_specific_permissions WHERE userid = ?', [userid]);

    // Insert new permissions
    if (permissions.length > 0) {
      for (const perm of permissions) {
        await query(
          `INSERT INTO user_specific_permissions (userid, permission_id, permission_type, granted_by, expires_at)
           VALUES (?, ?, ?, ?, ?)`,
          [userid, perm.permissionId, perm.permissionType || 'allow', grantedBy, perm.expiresAt || null]
        );
      }
    }

    res.json({
      success: true,
      message: 'User permissions updated successfully',
      count: permissions.length
    });
  } catch (error) {
    console.error('Bulk update user permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user permissions'
    });
  }
});

// Check if user has specific permission
router.get('/check/:permissionName', verifyToken, async (req, res) => {
  try {
    const { permissionName } = req.params;
    const userId = req.user.userid;
    const userRole = req.user.user_role;

    // SuperAdmin always has access
    if (userRole === 'superadmin') {
      return res.json({ success: true, hasPermission: true });
    }

    // Get permission ID
    const permissionResult = await query(
      'SELECT permission_id FROM permissions WHERE permission_name = ?',
      [permissionName]
    );

    if (permissionResult.length === 0) {
      return res.json({ success: true, hasPermission: false });
    }

    const permissionId = permissionResult[0].permission_id;

    // Check user-specific deny
    const userDeny = await query(
      `SELECT id FROM user_specific_permissions 
       WHERE userid = ? AND permission_id = ? AND permission_type = 'deny'
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [userId, permissionId]
    );

    if (userDeny.length > 0) {
      return res.json({ success: true, hasPermission: false });
    }

    // Check user-specific allow
    const userAllow = await query(
      `SELECT id FROM user_specific_permissions 
       WHERE userid = ? AND permission_id = ? AND permission_type = 'allow'
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [userId, permissionId]
    );

    if (userAllow.length > 0) {
      return res.json({ success: true, hasPermission: true });
    }

    // Check role-based permission
    const rolePermission = await query(
      'SELECT id FROM role_permissions WHERE user_role = ? AND permission_id = ?',
      [userRole, permissionId]
    );

    res.json({
      success: true,
      hasPermission: rolePermission.length > 0
    });
  } catch (error) {
    console.error('Check permission error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking permission'
    });
  }
});

module.exports = router;
module.exports.checkPermission = checkPermission;
