/**
 * AURA AI Engine
 * Manages Anthropic API communication with streaming, context injection,
 * and intelligent system prompt construction.
 */

class AIEngine {
  constructor() {
    this.API_URL = 'https://api.anthropic.com/v1/messages';
    this.DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
    this.MAX_TOKENS = 1500;
    this._abortController = null;
  }

  /**
   * Build the system prompt with full context injection.
   */
  buildSystemPrompt(profile, contextSummary, memorySummary) {
    const name = profile?.name || 'there';
    const focusAreas = profile?.focusAreas?.join(', ') || 'general use';
    const persona = profile?.persona || 'balanced';

    return `You are AURA, an intelligent on-device AI companion designed to be genuinely helpful, proactive, and deeply personal. You are not a generic assistant — you are ${name}'s dedicated companion.

## Your Identity
- Name: AURA (Adaptive Universal Reasoning Assistant)
- You are warm, perceptive, and concise
- You speak naturally, like a knowledgeable friend, not a corporate chatbot
- You are direct and action-oriented, cutting to what matters
- You remember context within this conversation and use it intelligently

## User Profile
- Name: ${name}
- Primary focus areas: ${focusAreas}

## Current Device Context
${contextSummary}

## Memory & History
${memorySummary || 'No prior history yet. This may be a new session.'}

## Behavioral Guidelines
1. **Be proactive**: If context suggests something useful, mention it. Don't wait to be asked.
2. **Be concise**: Prefer shorter, denser responses. Use bullet points for lists. Use code blocks for code.
3. **Be contextual**: Reference the time, battery, or other context when genuinely relevant.
4. **Format well**: Use **bold** for key terms, \`code\` for technical terms, and clear structure.
5. **Low battery / offline**: If the user is on low battery or offline, acknowledge and adapt.
6. **Morning energy**: In the morning, be energizing and forward-looking.
7. **Evening wind-down**: In the evening, be reflective and help with wrap-ups.
8. **Never be verbose**: Respect the user's time. Say more with less.

Respond naturally, intelligently, and helpfully. You are on their device, always ready.`;
  }

  /**
   * Send a message and get a streaming response.
   * @param {string} userMessage
   * @param {Array} conversationHistory - Array of {role, content} objects
   * @param {object} options
   * @param {function} onChunk - called with each text chunk
   * @param {function} onDone - called when complete
   * @param {function} onError - called on error
   */
  async sendMessage(userMessage, conversationHistory, options = {}, onChunk, onDone, onError) {
    const profile = window.memoryEngine.getProfile();
    if (!profile?.apiKey) {
      onError('No API key configured. Please set up AURA first.');
      return;
    }

    const contextSummary = window.contextEngine.getContextSummary();
    const memorySummary = window.memoryEngine.buildMemorySummary();
    const systemPrompt = this.buildSystemPrompt(profile, contextSummary, memorySummary);

    const model = profile.model || this.DEFAULT_MODEL;
    const memoryDepth = profile.memoryDepth || 20;

    // Build messages array (trim to memory depth)
    const messages = [
      ...conversationHistory.slice(-memoryDepth),
      { role: 'user', content: userMessage },
    ];

    // Cancel any in-flight request
    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();

    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': profile.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: this.MAX_TOKENS,
          system: systemPrompt,
          messages,
          stream: true,
        }),
        signal: this._abortController.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData?.error?.message || `API error: ${response.status} ${response.statusText}`;
        onError(errMsg);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              const chunk = parsed.delta.text;
              fullText += chunk;
              onChunk(chunk, fullText);
            }

            if (parsed.type === 'message_stop') {
              onDone(fullText);
              return;
            }

            // Handle API errors in stream
            if (parsed.type === 'error') {
              onError(parsed.error?.message || 'Stream error');
              return;
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      // If we get here without message_stop, still call onDone
      if (fullText) onDone(fullText);

    } catch (err) {
      if (err.name === 'AbortError') {
        // User cancelled — don't call onError
        return;
      }
      onError(err.message || 'Network error. Check your connection.');
    }
  }

  /**
   * Cancel the current in-flight request.
   */
  cancel() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  /**
   * Quick non-streaming inference for internal use (proactive suggestions, summaries).
   * @param {string} prompt
   * @param {number} maxTokens
   * @returns {Promise<string>}
   */
  async quickInfer(prompt, maxTokens = 200) {
    const profile = window.memoryEngine.getProfile();
    if (!profile?.apiKey) return null;

    const model = profile.model || this.DEFAULT_MODEL;

    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': profile.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data.content?.[0]?.text || null;
    } catch {
      return null;
    }
  }

  /**
   * Validate an API key by making a minimal test request.
   * @param {string} apiKey
   * @returns {Promise<{valid: boolean, error?: string}>}
   */
  async validateApiKey(apiKey) {
    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });

      if (response.ok) return { valid: true };

      const err = await response.json().catch(() => ({}));
      if (response.status === 401) return { valid: false, error: 'Invalid API key' };
      if (response.status === 429) return { valid: true }; // Rate limited = key is valid
      return { valid: false, error: err?.error?.message || `Error ${response.status}` };
    } catch (e) {
      return { valid: false, error: 'Network error. Check your connection.' };
    }
  }
}

window.aiEngine = new AIEngine();
