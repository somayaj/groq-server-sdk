const Groq = require('groq-sdk');

/**
 * ChatClient - Wrapper for Groq API interactions
 */
class ChatClient {
  constructor(options = {}) {
    if (!options.apiKey) {
      throw new Error('Groq API key is required');
    }

    this.groq = new Groq({
      apiKey: options.apiKey
    });

    this.model = options.model || 'llama-3.3-70b-versatile';
    this.temperature = options.temperature ?? 0.7;
    this.maxTokens = options.maxTokens || 2048;
    this.systemPrompt = options.systemPrompt || 'You are a helpful assistant.';
  }

  /**
   * Send a message and get a response
   * @param {Array} messages - Array of message objects with role and content
   * @param {Object} options - Override options for this specific request
   * @returns {Promise<Object>} - The response from Groq
   */
  async chat(messages, options = {}) {
    const formattedMessages = this._formatMessages(messages);

    try {
      const response = await this.groq.chat.completions.create({
        model: options.model || this.model,
        messages: formattedMessages,
        temperature: options.temperature ?? this.temperature,
        max_tokens: options.maxTokens || this.maxTokens,
        ...options.extra
      });

      return {
        success: true,
        message: response.choices[0].message,
        usage: response.usage,
        id: response.id,
        model: response.model
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          code: error.code || 'UNKNOWN_ERROR',
          status: error.status
        }
      };
    }
  }

  /**
   * Stream a chat response
   * @param {Array} messages - Array of message objects
   * @param {Function} onChunk - Callback for each chunk
   * @param {Object} options - Override options
   * @returns {Promise<Object>} - Final response summary
   */
  async streamChat(messages, onChunk, options = {}) {
    const formattedMessages = this._formatMessages(messages);

    try {
      const stream = await this.groq.chat.completions.create({
        model: options.model || this.model,
        messages: formattedMessages,
        temperature: options.temperature ?? this.temperature,
        max_tokens: options.maxTokens || this.maxTokens,
        stream: true,
        ...options.extra
      });

      let fullContent = '';

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          onChunk({
            content,
            done: false
          });
        }
      }

      onChunk({
        content: '',
        done: true,
        fullContent
      });

      return {
        success: true,
        message: {
          role: 'assistant',
          content: fullContent
        }
      };
    } catch (error) {
      onChunk({
        content: '',
        done: true,
        error: error.message
      });

      return {
        success: false,
        error: {
          message: error.message,
          code: error.code || 'UNKNOWN_ERROR'
        }
      };
    }
  }

  /**
   * Format messages with system prompt
   * @private
   */
  _formatMessages(messages) {
    const formatted = [];

    // Add system prompt if not already present
    if (!messages.some(m => m.role === 'system')) {
      formatted.push({
        role: 'system',
        content: this.systemPrompt
      });
    }

    // Add all messages
    for (const msg of messages) {
      formatted.push({
        role: msg.role,
        content: msg.content
      });
    }

    return formatted;
  }

  /**
   * Update configuration
   */
  configure(options) {
    if (options.model) this.model = options.model;
    if (options.temperature !== undefined) this.temperature = options.temperature;
    if (options.maxTokens) this.maxTokens = options.maxTokens;
    if (options.systemPrompt) this.systemPrompt = options.systemPrompt;
  }
}

module.exports = ChatClient;
