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
  rateLimit: 60
};

module.exports = { defaultConfig };
