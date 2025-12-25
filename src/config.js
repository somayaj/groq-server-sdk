/**
 * Default configuration for the ChatServer
 */
const defaultConfig = {
  // Groq settings
  model: 'llama-3.3-70b-versatile',
  temperature: 0.7,
  maxTokens: 2048,
  
  // Server settings
  port: 3000,
  host: 'localhost',
  
  // CORS settings
  corsOrigins: '*',
  
  // Conversation settings
  systemPrompt: 'You are a helpful assistant.',
  maxConversationHistory: 50,
  
  // WebSocket settings
  enableWebSocket: true,
  wsPath: '/ws',
  
  // Rate limiting (messages per minute per session)
  rateLimit: 60,
  
  // Guardrails settings
  guardrails: {
    // Input validation
    maxMessageLength: 10000,
    minMessageLength: 1,
    
    // Content filtering
    enableContentFilter: true,
    blockedPatterns: [],
    allowedPatterns: null,
    
    // Profanity filtering
    enableProfanityFilter: true,
    
    // Output moderation
    enableOutputModeration: true,
    maxResponseLength: 50000,
    
    // Policy enforcement
    policies: [],
    
    // Logging
    logViolations: true,
    
    // Action on violation: 'reject', 'warn', 'allow'
    violationAction: 'reject'
  }
};

module.exports = { defaultConfig };
