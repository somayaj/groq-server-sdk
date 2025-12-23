/**
 * Basic example of using the Groq Chat Server
 * 
 * Run with: node examples/basic-server.js
 * 
 * Make sure to set your GROQ_API_KEY environment variable:
 *   export GROQ_API_KEY=your-api-key-here
 */

const { ChatServer } = require('../src');

// Create a new chat server instance
const server = new ChatServer({
  // API key (can also use GROQ_API_KEY env variable)
  apiKey: process.env.GROQ_API_KEY,
  
  // Server configuration
  port: 3000,
  host: 'localhost',
  
  // Groq model settings
  model: 'llama-3.3-70b-versatile',
  temperature: 0.7,
  maxTokens: 2048,
  
  // Custom system prompt
  systemPrompt: 'You are a helpful and friendly AI assistant. Be concise but thorough in your responses.',
  
  // Enable WebSocket for real-time streaming
  enableWebSocket: true,
  
  // Rate limiting (messages per minute per session)
  rateLimit: 30
});

// Start the server
server.start(() => {
  console.log('\n✅ Server is ready to accept connections!\n');
  console.log('Example curl commands:\n');
  console.log('1. Simple chat:');
  console.log('   curl -X POST http://localhost:3000/chat/simple \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"message": "Hello, how are you?"}\'\n');
  console.log('2. Create conversation and chat:');
  console.log('   curl -X POST http://localhost:3000/conversation');
  console.log('   curl -X POST http://localhost:3000/chat \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"message": "What is the capital of France?", "conversationId": "<id>"}\'');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down server...');
  server.stop(() => {
    console.log('Server stopped.');
    process.exit(0);
  });
});
