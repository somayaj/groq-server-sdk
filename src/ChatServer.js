const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const ChatClient = require('./ChatClient');
const { defaultConfig } = require('./config');

/**
 * ChatServer - Express-based chat server with WebSocket support
 * Powered by Groq API
 */
class ChatServer {
  constructor(options = {}) {
    this.config = { ...defaultConfig, ...options };
    
    if (!options.apiKey && !process.env.GROQ_API_KEY) {
      throw new Error('Groq API key is required. Pass it as options.apiKey or set GROQ_API_KEY environment variable.');
    }

    this.apiKey = options.apiKey || process.env.GROQ_API_KEY;
    
    // Initialize ChatClient
    this.chatClient = new ChatClient({
      apiKey: this.apiKey,
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      systemPrompt: this.config.systemPrompt
    });

    // Conversation storage (in-memory, can be replaced with database)
    this.conversations = new Map();
    
    // Rate limiting storage
    this.rateLimits = new Map();

    // Initialize Express app
    this.app = express();
    this._setupMiddleware();
    this._setupRoutes();

    // HTTP server for WebSocket
    this.server = http.createServer(this.app);
    
    // WebSocket server
    if (this.config.enableWebSocket) {
      this._setupWebSocket();
    }
  }

  /**
   * Setup Express middleware
   * @private
   */
  _setupMiddleware() {
    this.app.use(cors({
      origin: this.config.corsOrigins
    }));
    this.app.use(express.json());
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup API routes
   * @private
   */
  _setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Create new conversation
    this.app.post('/conversation', (req, res) => {
      const conversationId = uuidv4();
      const { systemPrompt } = req.body;
      
      this.conversations.set(conversationId, {
        id: conversationId,
        messages: [],
        systemPrompt: systemPrompt || this.config.systemPrompt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      res.json({
        success: true,
        conversationId,
        message: 'Conversation created successfully'
      });
    });

    // Get conversation
    this.app.get('/conversation/:id', (req, res) => {
      const conversation = this.conversations.get(req.params.id);
      
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }

      res.json({
        success: true,
        conversation
      });
    });

    // Delete conversation
    this.app.delete('/conversation/:id', (req, res) => {
      const deleted = this.conversations.delete(req.params.id);
      
      res.json({
        success: deleted,
        message: deleted ? 'Conversation deleted' : 'Conversation not found'
      });
    });

    // Send chat message
    this.app.post('/chat', async (req, res) => {
      const { message, conversationId, stream } = req.body;

      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'Message is required'
        });
      }

      // Get or create conversation
      let conversation;
      let convId = conversationId;

      if (convId && this.conversations.has(convId)) {
        conversation = this.conversations.get(convId);
      } else {
        convId = uuidv4();
        conversation = {
          id: convId,
          messages: [],
          systemPrompt: this.config.systemPrompt,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        this.conversations.set(convId, conversation);
      }

      // Check rate limit
      if (!this._checkRateLimit(convId)) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded. Please wait before sending more messages.'
        });
      }

      // Add user message to history
      conversation.messages.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      });

      // Prepare messages for API
      const apiMessages = [
        { role: 'system', content: conversation.systemPrompt },
        ...conversation.messages.slice(-this.config.maxConversationHistory).map(m => ({
          role: m.role,
          content: m.content
        }))
      ];

      // Handle streaming response
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const result = await this.chatClient.streamChat(
          apiMessages,
          (chunk) => {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
        );

        if (result.success) {
          conversation.messages.push({
            role: 'assistant',
            content: result.message.content,
            timestamp: new Date().toISOString()
          });
          conversation.updatedAt = new Date().toISOString();
        }

        res.write(`data: ${JSON.stringify({ done: true, conversationId: convId })}\n\n`);
        res.end();
      } else {
        // Non-streaming response
        const result = await this.chatClient.chat(apiMessages);

        if (result.success) {
          conversation.messages.push({
            role: 'assistant',
            content: result.message.content,
            timestamp: new Date().toISOString()
          });
          conversation.updatedAt = new Date().toISOString();

          res.json({
            success: true,
            conversationId: convId,
            message: result.message,
            usage: result.usage
          });
        } else {
          res.status(500).json({
            success: false,
            error: result.error
          });
        }
      }
    });

    // Simple single-turn chat (no conversation history)
    this.app.post('/chat/simple', async (req, res) => {
      const { message, systemPrompt } = req.body;

      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'Message is required'
        });
      }

      const messages = [
        { role: 'user', content: message }
      ];

      const options = systemPrompt ? { systemPrompt } : {};
      
      if (systemPrompt) {
        this.chatClient.systemPrompt = systemPrompt;
      }

      const result = await this.chatClient.chat(messages);

      // Reset system prompt
      this.chatClient.systemPrompt = this.config.systemPrompt;

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          usage: result.usage
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    });

    // List all conversations
    this.app.get('/conversations', (req, res) => {
      const conversations = Array.from(this.conversations.values()).map(c => ({
        id: c.id,
        messageCount: c.messages.length,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      }));

      res.json({
        success: true,
        conversations
      });
    });
  }

  /**
   * Setup WebSocket server for real-time streaming
   * @private
   */
  _setupWebSocket() {
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: this.config.wsPath
    });

    this.wss.on('connection', (ws) => {
      const sessionId = uuidv4();
      console.log(`[WebSocket] Client connected: ${sessionId}`);

      // Create conversation for this session
      this.conversations.set(sessionId, {
        id: sessionId,
        messages: [],
        systemPrompt: this.config.systemPrompt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      ws.on('message', async (data) => {
        try {
          const payload = JSON.parse(data.toString());
          
          if (payload.type === 'chat') {
            await this._handleWebSocketChat(ws, sessionId, payload);
          } else if (payload.type === 'configure') {
            this._handleWebSocketConfigure(ws, sessionId, payload);
          } else if (payload.type === 'clear') {
            this._handleWebSocketClear(ws, sessionId);
          }
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Invalid message format'
          }));
        }
      });

      ws.on('close', () => {
        console.log(`[WebSocket] Client disconnected: ${sessionId}`);
        // Optionally clean up conversation
        // this.conversations.delete(sessionId);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        sessionId,
        message: 'Connected to chat server'
      }));
    });
  }

  /**
   * Handle WebSocket chat message
   * @private
   */
  async _handleWebSocketChat(ws, sessionId, payload) {
    const conversation = this.conversations.get(sessionId);
    
    if (!conversation) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Session not found'
      }));
      return;
    }

    // Check rate limit
    if (!this._checkRateLimit(sessionId)) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Rate limit exceeded'
      }));
      return;
    }

    // Add user message
    conversation.messages.push({
      role: 'user',
      content: payload.message,
      timestamp: new Date().toISOString()
    });

    // Prepare messages
    const apiMessages = [
      { role: 'system', content: conversation.systemPrompt },
      ...conversation.messages.slice(-this.config.maxConversationHistory).map(m => ({
        role: m.role,
        content: m.content
      }))
    ];

    // Stream response
    ws.send(JSON.stringify({ type: 'start' }));

    const result = await this.chatClient.streamChat(
      apiMessages,
      (chunk) => {
        ws.send(JSON.stringify({
          type: 'chunk',
          ...chunk
        }));
      }
    );

    if (result.success) {
      conversation.messages.push({
        role: 'assistant',
        content: result.message.content,
        timestamp: new Date().toISOString()
      });
      conversation.updatedAt = new Date().toISOString();
    }

    ws.send(JSON.stringify({
      type: 'end',
      success: result.success
    }));
  }

  /**
   * Handle WebSocket configure message
   * @private
   */
  _handleWebSocketConfigure(ws, sessionId, payload) {
    const conversation = this.conversations.get(sessionId);
    
    if (conversation && payload.systemPrompt) {
      conversation.systemPrompt = payload.systemPrompt;
    }

    ws.send(JSON.stringify({
      type: 'configured',
      success: true
    }));
  }

  /**
   * Handle WebSocket clear message
   * @private
   */
  _handleWebSocketClear(ws, sessionId) {
    const conversation = this.conversations.get(sessionId);
    
    if (conversation) {
      conversation.messages = [];
      conversation.updatedAt = new Date().toISOString();
    }

    ws.send(JSON.stringify({
      type: 'cleared',
      success: true
    }));
  }

  /**
   * Check rate limit for a session
   * @private
   */
  _checkRateLimit(sessionId) {
    const now = Date.now();
    const windowMs = 60000; // 1 minute window
    
    if (!this.rateLimits.has(sessionId)) {
      this.rateLimits.set(sessionId, []);
    }

    const timestamps = this.rateLimits.get(sessionId);
    
    // Remove old timestamps
    const validTimestamps = timestamps.filter(t => now - t < windowMs);
    
    if (validTimestamps.length >= this.config.rateLimit) {
      return false;
    }

    validTimestamps.push(now);
    this.rateLimits.set(sessionId, validTimestamps);
    return true;
  }

  /**
   * Add custom Express middleware
   */
  use(...args) {
    this.app.use(...args);
  }

  /**
   * Add custom route
   */
  route(method, path, handler) {
    this.app[method.toLowerCase()](path, handler);
  }

  /**
   * Start the server
   */
  start(callback) {
    const port = this.config.port;
    const host = this.config.host;

    this.server.listen(port, host, () => {
      console.log(`🚀 Chat server running at http://${host}:${port}`);
      console.log(`📡 WebSocket available at ws://${host}:${port}${this.config.wsPath}`);
      console.log(`\nEndpoints:`);
      console.log(`  POST /chat          - Send a message`);
      console.log(`  POST /chat/simple   - Single-turn chat`);
      console.log(`  POST /conversation  - Create conversation`);
      console.log(`  GET  /conversation/:id - Get conversation`);
      console.log(`  GET  /conversations - List conversations`);
      console.log(`  GET  /health        - Health check`);
      
      if (callback) callback();
    });

    return this.server;
  }

  /**
   * Stop the server
   */
  stop(callback) {
    if (this.wss) {
      this.wss.close();
    }
    this.server.close(callback);
  }

  /**
   * Get the Express app instance for custom configuration
   */
  getApp() {
    return this.app;
  }

  /**
   * Get the ChatClient instance
   */
  getChatClient() {
    return this.chatClient;
  }
}

module.exports = ChatServer;
