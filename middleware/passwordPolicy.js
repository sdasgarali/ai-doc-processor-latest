/**
 * Password Policy Enforcement
 * Enterprise-level password requirements for security compliance
 */

// Password policy configuration
const PASSWORD_POLICY = {
  minLength: parseInt(process.env.PASSWORD_MIN_LENGTH) || 12,
  maxLength: parseInt(process.env.PASSWORD_MAX_LENGTH) || 128,
  requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
  requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false',
  requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== 'false',
  requireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL !== 'false',
  specialCharsAllowed: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  preventCommonPasswords: process.env.PASSWORD_PREVENT_COMMON !== 'false',
  preventUserInfo: process.env.PASSWORD_PREVENT_USER_INFO !== 'false',
  preventRepeatingChars: process.env.PASSWORD_PREVENT_REPEATING !== 'false',
  maxRepeatingChars: 3
};

// Common weak passwords to block
const COMMON_PASSWORDS = [
  'password', 'password123', '123456', '12345678', 'qwerty', 'abc123',
  'monkey', 'letmein', 'dragon', 'football', 'baseball', 'iloveyou',
  'master', 'sunshine', 'ashley', 'bailey', 'shadow', 'passw0rd',
  'admin', 'admin123', 'root', 'toor', 'test', 'test123',
  'welcome', 'welcome1', 'changeme', 'changeme123'
];

/**
 * Validate password against policy
 * @param {string} password - Password to validate
 * @param {object} userInfo - Optional user info to check against (email, first_name, last_name)
 * @returns {object} { isValid: boolean, errors: string[] }
 */
function validatePassword(password, userInfo = {}) {
  const errors = [];

  if (!password) {
    return { isValid: false, errors: ['Password is required'] };
  }

  // Length check
  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters long`);
  }

  if (password.length > PASSWORD_POLICY.maxLength) {
    errors.push(`Password must not exceed ${PASSWORD_POLICY.maxLength} characters`);
  }

  // Uppercase check
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Lowercase check
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Number check
  if (PASSWORD_POLICY.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Special character check
  if (PASSWORD_POLICY.requireSpecialChars) {
    const specialCharsRegex = new RegExp(`[${PASSWORD_POLICY.specialCharsAllowed.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`);
    if (!specialCharsRegex.test(password)) {
      errors.push(`Password must contain at least one special character (${PASSWORD_POLICY.specialCharsAllowed})`);
    }
  }

  // Common password check
  if (PASSWORD_POLICY.preventCommonPasswords) {
    const lowerPassword = password.toLowerCase();
    if (COMMON_PASSWORDS.some(common => lowerPassword.includes(common))) {
      errors.push('Password is too common. Please choose a more unique password');
    }
  }

  // User info check (prevent using email, name in password)
  if (PASSWORD_POLICY.preventUserInfo && userInfo) {
    const lowerPassword = password.toLowerCase();
    const fieldsToCheck = [
      userInfo.email?.split('@')[0],
      userInfo.first_name,
      userInfo.last_name
    ].filter(Boolean).map(f => f.toLowerCase());

    for (const field of fieldsToCheck) {
      if (field && field.length >= 3 && lowerPassword.includes(field)) {
        errors.push('Password should not contain your email, first name, or last name');
        break;
      }
    }
  }

  // Repeating characters check
  if (PASSWORD_POLICY.preventRepeatingChars) {
    const repeatingRegex = new RegExp(`(.)\\1{${PASSWORD_POLICY.maxRepeatingChars},}`);
    if (repeatingRegex.test(password)) {
      errors.push(`Password should not have more than ${PASSWORD_POLICY.maxRepeatingChars} repeating characters`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Calculate password strength (0-100)
 * @param {string} password - Password to evaluate
 * @returns {object} { score: number, strength: string }
 */
function calculatePasswordStrength(password) {
  if (!password) return { score: 0, strength: 'none' };

  let score = 0;

  // Length scoring
  if (password.length >= 8) score += 10;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;
  if (password.length >= 20) score += 10;

  // Character type scoring
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 15;
  if (/\d/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 20;

  // Pattern penalties
  const lowerPassword = password.toLowerCase();
  if (COMMON_PASSWORDS.some(common => lowerPassword.includes(common))) {
    score -= 30;
  }
  if (/(.)\1{2,}/.test(password)) score -= 10;
  if (/^[a-zA-Z]+$/.test(password)) score -= 10;
  if (/^\d+$/.test(password)) score -= 20;

  // Ensure score is within bounds
  score = Math.max(0, Math.min(100, score));

  let strength = 'weak';
  if (score >= 80) strength = 'strong';
  else if (score >= 60) strength = 'good';
  else if (score >= 40) strength = 'moderate';

  return { score, strength };
}

/**
 * Express middleware to validate password in request body
 * @param {string} passwordField - Name of password field in request body
 */
function validatePasswordMiddleware(passwordField = 'password') {
  return (req, res, next) => {
    const password = req.body[passwordField];
    const userInfo = {
      email: req.body.email,
      first_name: req.body.first_name,
      last_name: req.body.last_name
    };

    const validation = validatePassword(password, userInfo);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet security requirements',
        errors: validation.errors
      });
    }

    next();
  };
}

/**
 * Express middleware for new password validation (e.g., password change)
 */
function validateNewPasswordMiddleware(req, res, next) {
  const password = req.body.new_password;

  const validation = validatePassword(password);

  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      message: 'New password does not meet security requirements',
      errors: validation.errors
    });
  }

  next();
}

/**
 * Get password policy requirements (for frontend display)
 */
function getPasswordRequirements() {
  const requirements = [];

  requirements.push(`At least ${PASSWORD_POLICY.minLength} characters long`);

  if (PASSWORD_POLICY.requireUppercase) {
    requirements.push('At least one uppercase letter (A-Z)');
  }
  if (PASSWORD_POLICY.requireLowercase) {
    requirements.push('At least one lowercase letter (a-z)');
  }
  if (PASSWORD_POLICY.requireNumbers) {
    requirements.push('At least one number (0-9)');
  }
  if (PASSWORD_POLICY.requireSpecialChars) {
    requirements.push(`At least one special character (${PASSWORD_POLICY.specialCharsAllowed})`);
  }
  if (PASSWORD_POLICY.preventCommonPasswords) {
    requirements.push('Cannot be a common password');
  }
  if (PASSWORD_POLICY.preventUserInfo) {
    requirements.push('Cannot contain your email or name');
  }

  return requirements;
}

module.exports = {
  validatePassword,
  calculatePasswordStrength,
  validatePasswordMiddleware,
  validateNewPasswordMiddleware,
  getPasswordRequirements,
  PASSWORD_POLICY
};
