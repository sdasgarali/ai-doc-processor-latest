const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken, checkRole } = require('../middleware/auth');
const crypto = require('crypto');

// Encryption key from environment (should be 32 bytes for AES-256)
const ENCRYPTION_KEY = process.env.CONFIG_ENCRYPTION_KEY || 'default-encryption-key-32-bytes!';
const IV_LENGTH = 16;

// Encrypt sensitive values
function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// Decrypt sensitive values
function decrypt(text) {
  if (!text || !text.includes(':')) return text;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    return text; // Return as-is if decryption fails
  }
}

// Mask sensitive values for display
function maskValue(value) {
  if (!value || value.length < 8) return '****';
  return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

// Get all configuration (grouped by category)
router.get('/', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    // Get all configs with category info
    const configs = await query(`
      SELECT pc.*, dc.category_name
      FROM processing_config pc
      LEFT JOIN doc_category dc ON pc.doc_category_id = dc.category_id
      ORDER BY pc.doc_category_id IS NULL DESC, pc.doc_category_id, pc.config_key
    `);

    // Get all categories for the dropdown
    const categories = await query('SELECT category_id, category_name FROM doc_category ORDER BY category_name');

    // Process configs - decrypt and mask sensitive values
    const processedConfigs = configs.map(config => {
      let displayValue = config.config_value;
      if (config.is_encrypted && config.config_value) {
        const decrypted = decrypt(config.config_value);
        displayValue = maskValue(decrypted);
      }
      return {
        ...config,
        display_value: displayValue,
        // Don't send actual encrypted value to frontend
        config_value: config.is_encrypted ? '' : config.config_value
      };
    });

    // Group by category
    const grouped = {
      default: processedConfigs.filter(c => c.doc_category_id === null),
      categories: {}
    };

    categories.forEach(cat => {
      grouped.categories[cat.category_id] = {
        category_name: cat.category_name,
        configs: processedConfigs.filter(c => c.doc_category_id === cat.category_id)
      };
    });

    res.json({
      success: true,
      data: grouped,
      categories: categories
    });
  } catch (error) {
    console.error('Get processing config error:', error);
    res.status(500).json({ success: false, message: 'Error fetching configuration' });
  }
});

// Get default (global) configuration
router.get('/default', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const configs = await query(`
      SELECT * FROM processing_config
      WHERE doc_category_id IS NULL
      ORDER BY config_key
    `);

    const processedConfigs = configs.map(config => ({
      ...config,
      display_value: config.is_encrypted ? maskValue(decrypt(config.config_value)) : config.config_value,
      config_value: config.is_encrypted ? '' : config.config_value
    }));

    res.json({ success: true, data: processedConfigs });
  } catch (error) {
    console.error('Get default config error:', error);
    res.status(500).json({ success: false, message: 'Error fetching default configuration' });
  }
});

// Get configuration for a specific category
router.get('/category/:categoryId', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { categoryId } = req.params;

    const configs = await query(`
      SELECT * FROM processing_config
      WHERE doc_category_id = ?
      ORDER BY config_key
    `, [categoryId]);

    const processedConfigs = configs.map(config => ({
      ...config,
      display_value: config.is_encrypted ? maskValue(decrypt(config.config_value)) : config.config_value,
      config_value: config.is_encrypted ? '' : config.config_value
    }));

    res.json({ success: true, data: processedConfigs });
  } catch (error) {
    console.error('Get category config error:', error);
    res.status(500).json({ success: false, message: 'Error fetching category configuration' });
  }
});

// Create or update configuration
router.post('/', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { doc_category_id, config_key, config_value, is_encrypted, description } = req.body;

    if (!config_key) {
      return res.status(400).json({ success: false, message: 'Config key is required' });
    }

    // Encrypt value if marked as encrypted
    const valueToStore = is_encrypted && config_value ? encrypt(config_value) : config_value;

    // Use UPSERT (INSERT ... ON DUPLICATE KEY UPDATE)
    await query(`
      INSERT INTO processing_config (doc_category_id, config_key, config_value, is_encrypted, description)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        config_value = VALUES(config_value),
        is_encrypted = VALUES(is_encrypted),
        description = VALUES(description),
        updated_at = CURRENT_TIMESTAMP
    `, [doc_category_id || null, config_key, valueToStore, is_encrypted || false, description || null]);

    res.json({ success: true, message: 'Configuration saved successfully' });
  } catch (error) {
    console.error('Save processing config error:', error);
    res.status(500).json({ success: false, message: 'Error saving configuration' });
  }
});

// Bulk update configuration
router.post('/bulk', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { doc_category_id, configs } = req.body;

    if (!Array.isArray(configs)) {
      return res.status(400).json({ success: false, message: 'Configs must be an array' });
    }

    for (const config of configs) {
      if (!config.config_key) continue;

      // Only update if value is provided (skip empty values for encrypted fields that weren't changed)
      if (config.config_value === '' && config.is_encrypted) continue;

      const valueToStore = config.is_encrypted && config.config_value ? encrypt(config.config_value) : config.config_value;

      await query(`
        INSERT INTO processing_config (doc_category_id, config_key, config_value, is_encrypted, description)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          config_value = VALUES(config_value),
          is_encrypted = VALUES(is_encrypted),
          description = VALUES(description),
          updated_at = CURRENT_TIMESTAMP
      `, [doc_category_id || null, config.config_key, valueToStore, config.is_encrypted || false, config.description || null]);
    }

    res.json({ success: true, message: 'Configuration saved successfully' });
  } catch (error) {
    console.error('Bulk save processing config error:', error);
    res.status(500).json({ success: false, message: 'Error saving configuration' });
  }
});

// Delete a configuration entry
router.delete('/:configId', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { configId } = req.params;

    await query('DELETE FROM processing_config WHERE config_id = ?', [configId]);

    res.json({ success: true, message: 'Configuration deleted successfully' });
  } catch (error) {
    console.error('Delete processing config error:', error);
    res.status(500).json({ success: false, message: 'Error deleting configuration' });
  }
});

// Copy default config to a category
router.post('/copy-to-category/:categoryId', verifyToken, checkRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { categoryId } = req.params;

    // Get default configs
    const defaultConfigs = await query('SELECT * FROM processing_config WHERE doc_category_id IS NULL');

    // Copy each to the category
    for (const config of defaultConfigs) {
      await query(`
        INSERT INTO processing_config (doc_category_id, config_key, config_value, is_encrypted, description)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE config_key = config_key
      `, [categoryId, config.config_key, config.config_value, config.is_encrypted, config.description]);
    }

    res.json({ success: true, message: 'Configuration copied to category successfully' });
  } catch (error) {
    console.error('Copy config to category error:', error);
    res.status(500).json({ success: false, message: 'Error copying configuration' });
  }
});

// Get effective configuration for processing (used by Python processor)
// This merges: category config -> default config -> .env fallback
router.get('/effective/:categoryId?', async (req, res) => {
  try {
    const { categoryId } = req.params;

    // Get default configs
    const defaultConfigs = await query('SELECT * FROM processing_config WHERE doc_category_id IS NULL');

    // Get category-specific configs if categoryId provided
    let categoryConfigs = [];
    if (categoryId) {
      categoryConfigs = await query('SELECT * FROM processing_config WHERE doc_category_id = ?', [categoryId]);
    }

    // Build effective config map
    const effectiveConfig = {};

    // Start with default configs
    for (const config of defaultConfigs) {
      let value = config.config_value;
      if (config.is_encrypted && value) {
        value = decrypt(value);
      }
      // Only use if value is not empty
      if (value) {
        effectiveConfig[config.config_key] = value;
      }
    }

    // Override with category-specific configs
    for (const config of categoryConfigs) {
      let value = config.config_value;
      if (config.is_encrypted && value) {
        value = decrypt(value);
      }
      // Only override if value is not empty
      if (value) {
        effectiveConfig[config.config_key] = value;
      }
    }

    res.json({ success: true, data: effectiveConfig });
  } catch (error) {
    console.error('Get effective config error:', error);
    res.status(500).json({ success: false, message: 'Error fetching effective configuration' });
  }
});

module.exports = router;
