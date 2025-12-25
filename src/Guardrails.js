/**
 * Guardrails - Content moderation and policy enforcement
 */
class Guardrails {
  constructor(options = {}) {
    this.config = {
      // Input validation
      maxMessageLength: options.maxMessageLength || 10000,
      minMessageLength: options.minMessageLength || 1,
      
      // Content filtering
      enableContentFilter: options.enableContentFilter !== false,
      blockedPatterns: options.blockedPatterns || [],
      allowedPatterns: options.allowedPatterns || null,
      
      // Profanity filtering
      enableProfanityFilter: options.enableProfanityFilter !== false,
      
      // Output moderation
      enableOutputModeration: options.enableOutputModeration !== false,
      maxResponseLength: options.maxResponseLength || 50000,
      
      // Policy enforcement
      policies: options.policies || [],
      
      // Logging
      logViolations: options.logViolations !== false,
      
      // Action on violation
      violationAction: options.violationAction || 'reject', // 'reject', 'warn', 'allow'
      
      ...options
    };
    
    // Common profanity patterns (basic list - can be extended)
    this.profanityPatterns = options.profanityPatterns || [
      /\b(fuck|shit|damn|hell|bitch|asshole)\b/gi,
      // Add more patterns as needed
    ];
    
    // Common harmful content patterns
    this.harmfulPatterns = options.harmfulPatterns || [
      /\b(kill|murder|suicide|bomb|terrorist|violence)\b/gi,
      // Add more patterns as needed
    ];
  }

  /**
   * Validate input message
   * @param {string} message - The message to validate
   * @returns {Object} - { valid: boolean, reason?: string }
   */
  validateInput(message) {
    if (typeof message !== 'string') {
      return { valid: false, reason: 'Message must be a string', code: 'INVALID_TYPE' };
    }

    // Length validation
    if (message.length < this.config.minMessageLength) {
      return { 
        valid: false, 
        reason: `Message too short. Minimum length: ${this.config.minMessageLength}`, 
        code: 'MESSAGE_TOO_SHORT' 
      };
    }

    if (message.length > this.config.maxMessageLength) {
      return { 
        valid: false, 
        reason: `Message too long. Maximum length: ${this.config.maxMessageLength}`, 
        code: 'MESSAGE_TOO_LONG' 
      };
    }

    // Empty or whitespace-only check
    if (!message.trim()) {
      return { valid: false, reason: 'Message cannot be empty', code: 'EMPTY_MESSAGE' };
    }

    return { valid: true };
  }

  /**
   * Check for blocked patterns
   * @param {string} content - Content to check
   * @returns {Object} - { blocked: boolean, pattern?: string, reason?: string }
   */
  checkBlockedPatterns(content) {
    if (!this.config.enableContentFilter) {
      return { blocked: false };
    }

    // Check custom blocked patterns
    for (const pattern of this.config.blockedPatterns) {
      const regex = typeof pattern === 'string' ? new RegExp(pattern, 'gi') : pattern;
      if (regex.test(content)) {
        return { 
          blocked: true, 
          pattern: pattern.toString(), 
          reason: 'Content matches blocked pattern',
          code: 'BLOCKED_PATTERN'
        };
      }
    }

    // Check allowed patterns (if specified, content must match at least one)
    if (this.config.allowedPatterns && this.config.allowedPatterns.length > 0) {
      const matchesAny = this.config.allowedPatterns.some(pattern => {
        const regex = typeof pattern === 'string' ? new RegExp(pattern, 'gi') : pattern;
        return regex.test(content);
      });
      
      if (!matchesAny) {
        return { 
          blocked: true, 
          reason: 'Content does not match any allowed pattern',
          code: 'NOT_ALLOWED_PATTERN'
        };
      }
    }

    return { blocked: false };
  }

  /**
   * Check for profanity
   * @param {string} content - Content to check
   * @returns {Object} - { hasProfanity: boolean, matches?: string[] }
   */
  checkProfanity(content) {
    if (!this.config.enableProfanityFilter) {
      return { hasProfanity: false };
    }

    const matches = [];
    for (const pattern of this.profanityPatterns) {
      const match = content.match(pattern);
      if (match) {
        matches.push(...match);
      }
    }

    if (matches.length > 0) {
      return { 
        hasProfanity: true, 
        matches: [...new Set(matches)],
        reason: 'Content contains profanity',
        code: 'PROFANITY_DETECTED'
      };
    }

    return { hasProfanity: false };
  }

  /**
   * Check for harmful content
   * @param {string} content - Content to check
   * @returns {Object} - { isHarmful: boolean, reason?: string }
   */
  checkHarmfulContent(content) {
    if (!this.config.enableContentFilter) {
      return { isHarmful: false };
    }

    for (const pattern of this.harmfulPatterns) {
      if (pattern.test(content)) {
        return { 
          isHarmful: true, 
          reason: 'Content may contain harmful or violent language',
          code: 'HARMFUL_CONTENT'
        };
      }
    }

    return { isHarmful: false };
  }

  /**
   * Apply custom policies
   * @param {string} content - Content to check
   * @param {string} context - Context (e.g., 'input', 'output')
   * @returns {Object} - { passed: boolean, violations?: Array }
   */
  applyPolicies(content, context = 'input') {
    if (!this.config.policies || this.config.policies.length === 0) {
      return { passed: true };
    }

    const violations = [];

    for (const policy of this.config.policies) {
      const result = this._evaluatePolicy(policy, content, context);
      if (!result.passed) {
        violations.push({
          policy: policy.name || 'unnamed',
          reason: result.reason,
          code: result.code || 'POLICY_VIOLATION'
        });
      }
    }

    if (violations.length > 0) {
      return { 
        passed: false, 
        violations,
        reason: `Violated ${violations.length} policy/policies`,
        code: 'POLICY_VIOLATION'
      };
    }

    return { passed: true };
  }

  /**
   * Evaluate a single policy
   * @private
   */
  _evaluatePolicy(policy, content, context) {
    // Policy can be a function or an object with a check function
    if (typeof policy === 'function') {
      try {
        const result = policy(content, context);
        return typeof result === 'boolean' 
          ? { passed: result, reason: result ? null : 'Policy check failed' }
          : result;
      } catch (error) {
        return { passed: false, reason: `Policy error: ${error.message}`, code: 'POLICY_ERROR' };
      }
    }

    if (policy.check && typeof policy.check === 'function') {
      try {
        const result = policy.check(content, context);
        return typeof result === 'boolean'
          ? { passed: result, reason: result ? null : (policy.reason || 'Policy check failed') }
          : result;
      } catch (error) {
        return { passed: false, reason: `Policy error: ${error.message}`, code: 'POLICY_ERROR' };
      }
    }

    return { passed: true, reason: 'Invalid policy format' };
  }

  /**
   * Moderate input content
   * @param {string} message - Message to moderate
   * @returns {Object} - { allowed: boolean, reason?: string, code?: string, details?: Object }
   */
  moderateInput(message) {
    // Validate input
    const validation = this.validateInput(message);
    if (!validation.valid) {
      this._logViolation('input_validation', validation);
      return { 
        allowed: false, 
        reason: validation.reason, 
        code: validation.code,
        action: this.config.violationAction
      };
    }

    // Check blocked patterns
    const blockedCheck = this.checkBlockedPatterns(message);
    if (blockedCheck.blocked) {
      this._logViolation('blocked_pattern', blockedCheck);
      return { 
        allowed: false, 
        reason: blockedCheck.reason, 
        code: blockedCheck.code,
        action: this.config.violationAction
      };
    }

    // Check profanity
    const profanityCheck = this.checkProfanity(message);
    if (profanityCheck.hasProfanity) {
      this._logViolation('profanity', profanityCheck);
      if (this.config.violationAction === 'reject') {
        return { 
          allowed: false, 
          reason: profanityCheck.reason, 
          code: profanityCheck.code,
          matches: profanityCheck.matches,
          action: this.config.violationAction
        };
      }
    }

    // Check harmful content
    const harmfulCheck = this.checkHarmfulContent(message);
    if (harmfulCheck.isHarmful) {
      this._logViolation('harmful_content', harmfulCheck);
      return { 
        allowed: false, 
        reason: harmfulCheck.reason, 
        code: harmfulCheck.code,
        action: this.config.violationAction
      };
    }

    // Apply custom policies
    const policyCheck = this.applyPolicies(message, 'input');
    if (!policyCheck.passed) {
      this._logViolation('policy_violation', policyCheck);
      return { 
        allowed: false, 
        reason: policyCheck.reason, 
        code: policyCheck.code,
        violations: policyCheck.violations,
        action: this.config.violationAction
      };
    }

    return { allowed: true };
  }

  /**
   * Moderate output content
   * @param {string} content - Response content to moderate
   * @returns {Object} - { allowed: boolean, reason?: string, code?: string }
   */
  moderateOutput(content) {
    if (!this.config.enableOutputModeration) {
      return { allowed: true };
    }

    // Length check
    if (content.length > this.config.maxResponseLength) {
      return { 
        allowed: false, 
        reason: `Response too long. Maximum length: ${this.config.maxResponseLength}`, 
        code: 'RESPONSE_TOO_LONG' 
      };
    }

    // Check blocked patterns
    const blockedCheck = this.checkBlockedPatterns(content);
    if (blockedCheck.blocked) {
      this._logViolation('output_blocked_pattern', blockedCheck);
      return { 
        allowed: false, 
        reason: blockedCheck.reason, 
        code: blockedCheck.code,
        action: this.config.violationAction
      };
    }

    // Apply custom policies
    const policyCheck = this.applyPolicies(content, 'output');
    if (!policyCheck.passed) {
      this._logViolation('output_policy_violation', policyCheck);
      return { 
        allowed: false, 
        reason: policyCheck.reason, 
        code: policyCheck.code,
        violations: policyCheck.violations,
        action: this.config.violationAction
      };
    }

    return { allowed: true };
  }

  /**
   * Log policy violations
   * @private
   */
  _logViolation(type, details) {
    if (this.config.logViolations) {
      console.warn(`[Guardrails] Violation: ${type}`, {
        timestamp: new Date().toISOString(),
        type,
        details
      });
    }
  }

  /**
   * Update configuration
   */
  configure(options) {
    this.config = { ...this.config, ...options };
    if (options.profanityPatterns) {
      this.profanityPatterns = options.profanityPatterns;
    }
    if (options.harmfulPatterns) {
      this.harmfulPatterns = options.harmfulPatterns;
    }
  }
}

module.exports = Guardrails;

