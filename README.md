# Groq Server SDK

A simple and powerful npm package that creates a Groq-powered chat server interface. Experience lightning-fast AI responses with Groq's LPU inference engine. Supports both REST API and WebSocket connections for real-time streaming.

## Installation

```bash
npm install groq-server-sdk
```

## Quick Start

```javascript
const { ChatServer } = require('groq-server-sdk');

const server = new ChatServer({
  apiKey: process.env.GROQ_API_KEY,
  port: 3000
});

server.start();
```

## Features

- ⚡ **Lightning Fast** - Powered by Groq's LPU inference engine
- 🚀 **Easy Setup** - Get a chat server running in minutes
- 💬 **Conversation Management** - Maintains context across messages
- 🔄 **Streaming Support** - Real-time response streaming via SSE and WebSocket
- 🔧 **Configurable** - Customize model, temperature, tokens, and more
- 🛡️ **Rate Limiting** - Built-in rate limiting per session
- 🌐 **CORS Support** - Configurable CORS for cross-origin requests

## groq-server-sdk vs groq-sdk

This package is built **on top of** the official [`groq-sdk`](https://www.npmjs.com/package/groq-sdk) — it's a higher-level abstraction, not a replacement.

| Feature | Official `groq-sdk` | `groq-server-sdk` |
|---------|:-------------------:|:-----------------:|
| API calls to Groq | ✅ | ✅ |
| Ready-to-use REST endpoints | ❌ | ✅ |
| WebSocket streaming | ❌ | ✅ |
| Conversation history | ❌ | ✅ |
| Session management | ❌ | ✅ |
| Rate limiting | ❌ | ✅ |
| Express server | ❌ | ✅ |
| CORS handling | ❌ | ✅ |

**Use `groq-sdk`** when you need full control and want to build your own architecture.

**Use `groq-server-sdk`** when you want a working chat server in minutes with conversations, streaming, and rate limiting out of the box.

## Available Models

Groq supports several high-performance models:

| Model | Description |
|-------|-------------|
| `llama-3.3-70b-versatile` | Latest Llama 3.3 70B (default) |
| `llama-3.1-70b-versatile` | Llama 3.1 70B |
| `llama-3.1-8b-instant` | Fast Llama 3.1 8B |
| `mixtral-8x7b-32768` | Mixtral 8x7B |
| `gemma2-9b-it` | Google Gemma 2 9B |

## Configuration Options

```javascript
const server = new ChatServer({
  // Required
  apiKey: 'your-groq-api-key',
  
  // Server settings
  port: 3000,                    // Server port
  host: 'localhost',             // Server host
  corsOrigins: '*',              // CORS origins
  
  // Groq settings
  model: 'llama-3.3-70b-versatile', // Model to use
  temperature: 0.7,              // Response creativity (0-2)
  maxTokens: 2048,               // Max response tokens
  systemPrompt: 'You are a helpful assistant.',
  
  // WebSocket
  enableWebSocket: true,         // Enable WebSocket server
  wsPath: '/ws',                 // WebSocket path
  
  // Limits
  maxConversationHistory: 50,    // Max messages to keep
  rateLimit: 60,                 // Messages per minute per session
  
  // Guardrails & Policies
  guardrails: {
    maxMessageLength: 10000,      // Maximum input message length
    minMessageLength: 1,         // Minimum input message length
    enableContentFilter: true,    // Enable content filtering
    enableProfanityFilter: true, // Enable profanity filtering
    enableOutputModeration: true,// Moderate AI responses
    maxResponseLength: 50000,    // Maximum response length
    violationAction: 'reject',  // 'reject', 'warn', or 'allow'
    logViolations: true,         // Log policy violations
    blockedPatterns: [],         // Array of regex patterns to block
    policies: []                 // Custom policy functions
  }
});
```

## REST API Endpoints

### Health Check
```bash
GET /health
```

### Simple Chat (Single Turn)
```bash
POST /chat/simple
Content-Type: application/json

{
  "message": "Hello, how are you?",
  "systemPrompt": "You are a pirate." // optional
}
```

### Chat with Conversation
```bash
POST /chat
Content-Type: application/json

{
  "message": "What is the capital of France?",
  "conversationId": "optional-existing-id",
  "stream": false  // set to true for SSE streaming
}
```

### Create Conversation
```bash
POST /conversation
Content-Type: application/json

{
  "systemPrompt": "You are a coding assistant." // optional
}
```

### Get Conversation
```bash
GET /conversation/:id
```

### Delete Conversation
```bash
DELETE /conversation/:id
```

### List All Conversations
```bash
GET /conversations
```

## Streaming Responses

### Server-Sent Events (SSE)

```javascript
// Using fetch with SSE
const response = await fetch('http://localhost:3000/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Tell me a story',
    stream: true
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      process.stdout.write(data.content || '');
    }
  }
}
```

### WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  // Send a chat message
  ws.send(JSON.stringify({
    type: 'chat',
    message: 'Hello!'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'connected':
      console.log('Connected:', data.sessionId);
      break;
    case 'start':
      console.log('Response starting...');
      break;
    case 'chunk':
      process.stdout.write(data.content || '');
      break;
    case 'end':
      console.log('\nResponse complete');
      break;
  }
};

// Configure system prompt
ws.send(JSON.stringify({
  type: 'configure',
  systemPrompt: 'You are a helpful coding assistant.'
}));

// Clear conversation history
ws.send(JSON.stringify({
  type: 'clear'
}));
```

## Using ChatClient Directly

You can also use the ChatClient class directly without the server:

```javascript
const { ChatClient } = require('groq-server-sdk');

const client = new ChatClient({
  apiKey: process.env.GROQ_API_KEY,
  model: 'llama-3.3-70b-versatile',
  temperature: 0.7
});

// Simple chat
const response = await client.chat([
  { role: 'user', content: 'What is 2 + 2?' }
]);

console.log(response.message.content);

// Streaming chat
await client.streamChat(
  [{ role: 'user', content: 'Tell me a joke' }],
  (chunk) => {
    if (!chunk.done) {
      process.stdout.write(chunk.content);
    }
  }
);
```

## Extending the Server

### Add Custom Middleware

```javascript
const server = new ChatServer({ apiKey: '...' });

// Add authentication middleware
server.use((req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

server.start();
```

### Add Custom Routes

```javascript
const server = new ChatServer({ apiKey: '...' });

// Add custom endpoint
server.route('get', '/custom', (req, res) => {
  res.json({ message: 'Custom endpoint!' });
});

server.start();
```

### Access Express App

```javascript
const server = new ChatServer({ apiKey: '...' });
const app = server.getApp();

// Use Express app directly
app.get('/my-route', (req, res) => {
  res.send('Hello!');
});
```

## Guardrails & Content Moderation

The SDK includes built-in guardrails for content moderation and policy enforcement:

### Input Validation

- **Length limits**: Configurable min/max message lengths
- **Empty message detection**: Prevents empty or whitespace-only messages
- **Type validation**: Ensures messages are strings

### Content Filtering

- **Blocked patterns**: Block specific regex patterns
- **Allowed patterns**: Only allow content matching specific patterns
- **Profanity filtering**: Basic profanity detection (configurable)
- **Harmful content detection**: Detects potentially harmful language

### Output Moderation

- **Response length limits**: Prevents excessively long responses
- **Content validation**: Applies same filters to AI responses
- **Policy enforcement**: Custom policies for both input and output

### Custom Policies

You can define custom policies as functions:

```javascript
const server = new ChatServer({
  apiKey: '...',
  guardrails: {
    policies: [
      // Policy as a function
      (content, context) => {
        // Return true to allow, false to reject
        // Or return { passed: boolean, reason?: string, code?: string }
        if (content.includes('spam')) {
          return { passed: false, reason: 'Spam detected', code: 'SPAM_DETECTED' };
        }
        return { passed: true };
      },
      
      // Policy as an object
      {
        name: 'No URLs',
        check: (content) => {
          const urlPattern = /https?:\/\/[^\s]+/g;
          return !urlPattern.test(content);
        },
        reason: 'URLs are not allowed'
      }
    ]
  }
});
```

### Example: Custom Guardrails Configuration

```javascript
const server = new ChatServer({
  apiKey: process.env.GROQ_API_KEY,
  guardrails: {
    maxMessageLength: 5000,
    enableProfanityFilter: true,
    enableContentFilter: true,
    blockedPatterns: [
      /credit\s*card\s*number/gi,
      /ssn|social\s*security/gi
    ],
    violationAction: 'reject', // or 'warn' or 'allow'
    logViolations: true
  }
});
```

### Using Guardrails Standalone

You can also use the Guardrails class directly:

```javascript
const { Guardrails } = require('groq-server-sdk');

const guardrails = new Guardrails({
  maxMessageLength: 10000,
  enableProfanityFilter: true
});

// Moderate input
const result = guardrails.moderateInput('Hello, world!');
if (!result.allowed) {
  console.error('Blocked:', result.reason);
}

// Moderate output
const outputResult = guardrails.moderateOutput(aiResponse);
```

## Environment Variables

You can use environment variables instead of passing options:

```bash
export GROQ_API_KEY=your-api-key-here
```

Then simply:

```javascript
const server = new ChatServer({ port: 3000 });
server.start();
```

## Demo Application

Run the included demo application with a beautiful chat interface:

```bash
export GROQ_API_KEY=your-api-key-here
npm run demo
```

Then open http://localhost:3000 in your browser.

## Error Handling

The server returns consistent error responses:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "status": 400
  }
}
```

## Why Groq?

Groq's LPU (Language Processing Unit) inference engine delivers:
- **Ultra-low latency** - Responses in milliseconds
- **High throughput** - Handle more requests simultaneously
- **Cost effective** - Competitive pricing with superior performance

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.