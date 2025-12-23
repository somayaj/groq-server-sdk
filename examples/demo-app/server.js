/**
 * Demo Chat Application Server
 * 
 * A complete example showing how to use groq-server-sdk
 * with a beautiful web interface.
 * 
 * Run with: node examples/demo-app/server.js
 */

const path = require('path');
const express = require('express');
const { ChatServer } = require('../../src');

// Create the chat server
const chatServer = new ChatServer({
  apiKey: process.env.GROQ_API_KEY,
  port: 3000,
  host: 'localhost',
  model: 'llama-3.3-70b-versatile',
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: `You are a friendly and helpful AI assistant. 
You provide clear, concise, and accurate responses.
When appropriate, use markdown formatting for better readability.
If you don't know something, admit it honestly.`,
  enableWebSocket: true,
  rateLimit: 30
});

// Get the Express app to add custom routes
const app = chatServer.getApp();

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
chatServer.start(() => {
  console.log('\n🎉 Demo Chat Application is running!');
  console.log('📱 Open http://localhost:3000 in your browser\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  chatServer.stop(() => {
    console.log('Server stopped.');
    process.exit(0);
  });
});
