/**
 * AURA AI Engine — OpenRouter Edition
 *
 * Uses OpenRouter's OpenAI-compatible API with genuinely free models.
 * No credit card needed. Sign up at openrouter.ai → get API key → use forever free.
 *
 * Free model limits (as of 2025-2026): ~200 req/day, 20 req/min per model.
 * Strategy: primary model + automatic fallback chain if rate-limited.
 */

class AIEngine {
  constructor() {
    this.API_URL = 'https://openrouter.ai/api/v1/chat/completions';
    this.DEFAULT_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
    this.MAX_TOKENS = 1500;
    this._abortController = null;

    /**
     * Ordered fallback chain — all genuinely free on OpenRouter.
     * If the primary model rate-limits (429), we try the next automatically.
     */
    this.FREE_MODEL_FALLBACKS = [
      'meta-llama/llama-3.3-70b-instruct:free',
      'deepseek/deepseek-r1:free',
      'mistralai/mistral-7b-instruct:free',
      'openrouter/free',
    ];
  }

  buildSystemPrompt(profile, contextSummary, memorySummary) {
    const name = profile?.name || 'there';
    const focusAreas = profile?.focusAreas?.join(', ') || 'general use';

    return `You are AURA, an intelligent on-device AI companion. You are ${name}'s dedicated personal assistant — warm, perceptive, and concise.

## User Profile
- Name: ${name}
- Focus areas: ${focusAreas}

## Current Device Context
${contextSummary}

## Memory & History
${memorySummary || 'Fresh session — no prior history.'}

## Response Rules
1. Be concise — say more with fewer words
2. Use **bold** for key terms, \`code\` for technical terms, and bullet points for lists
3. Reference device context (time, battery, etc.) only when genuinely relevant
4. Morning -> energising and forward-looking tone
5. Evening -> reflective, wrap-up focused
6. Low battery -> acknowledge and help save important info
7. Never be verbose. The user's time is precious.

You are always ready, always on their device.`;
  }

  async sendMessage(userMessage, conversationHistory, options = {}, onChunk, onDone, onError) {
    const profile = window.memoryEngine.getProfile();
    if (!profile?.apiKey) {
      onError('No API key set. Open settings and add your OpenRouter key.');
      return;
    }

    const contextSummary = window.contextEngine.getContextSummary();
    const memorySummary  = window.memoryEngine.buildMemorySummary();
    const systemPrompt   = this.buildSystemPrompt(profile, contextSummary, memorySummary);
    const memoryDepth    = parseInt(profile.memoryDepth) || 20;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-memoryDepth),
      { role: 'user', content: userMessage },
    ];

    const preferredModel = profile.model || this.DEFAULT_MODEL;
    const fallbackChain  = this._buildFallbackChain(preferredModel);

    if (this._abortController) this._abortController.abort();
    this._abortController = new AbortController();

    for (let attempt = 0; attempt < fallbackChain.length; attempt++) {
      const model  = fallbackChain[attempt];
      const isLast = attempt === fallbackChain.length - 1;

      try {
        const result = await this._streamRequest(
          model, messages, profile.apiKey, onChunk, this._abortController.signal
        );

        if (result.rateLimited && !isLast) {
          console.warn('[AURA] ' + model + ' rate-limited, trying fallback...');
          continue;
        }
        if (result.error && !isLast) {
          console.warn('[AURA] ' + model + ' error: ' + result.error + ', trying fallback...');
          continue;
        }
        if (result.error) { onError(result.error); return; }
        if (result.fullText) {
          onDone(result.fullText);
          window.memoryEngine.saveProfile({ lastUsedModel: model });
        }
        return;

      } catch (err) {
        if (err.name === 'AbortError') return;
        if (!isLast) { continue; }
        onError(err.message || 'Network error. Check your connection.');
      }
    }
  }

  async _streamRequest(model, messages, apiKey, onChunk, signal) {
    const response = await fetch(this.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'AURA AI Companion',
      },
      body: JSON.stringify({
        model,
        max_tokens: this.MAX_TOKENS,
        messages,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      if (response.status === 429) return { rateLimited: true };
      let errMsg = 'API error ' + response.status;
      try {
        const errData = await response.json();
        errMsg = errData?.error?.message || errMsg;
      } catch { }
      if (response.status === 401) return { error: 'Invalid API key. Check your OpenRouter key in settings.' };
      return { error: errMsg };
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer   = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') return { fullText };

        try {
          const parsed = JSON.parse(data);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (delta) { fullText += delta; onChunk(delta, fullText); }

          const finishReason = parsed?.choices?.[0]?.finish_reason;
          if (finishReason && finishReason !== 'null') return { fullText };

          if (parsed?.error) return { error: parsed.error.message || 'Stream error' };
        } catch { }
      }
    }

    return fullText ? { fullText } : { error: 'Empty response from model.' };
  }

  async quickInfer(prompt, maxTokens = 200) {
    const profile = window.memoryEngine.getProfile();
    if (!profile?.apiKey) return null;
    const model = profile.model || this.DEFAULT_MODEL;
    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + profile.apiKey,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'AURA AI Companion',
        },
        body: JSON.stringify({
          model, max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
        }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data?.choices?.[0]?.message?.content || null;
    } catch { return null; }
  }

  async validateApiKey(apiKey) {
    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'AURA AI Companion',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct:free'',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Hi' }],
          stream: false,
        }),
      });
      if (response.ok) return { valid: true };
      if (response.status === 401) return { valid: false, error: 'Invalid API key. Double-check at openrouter.ai/keys' };
      if (response.status === 429) return { valid: true };
      const err = await response.json().catch(() => ({}));
      return { valid: false, error: err?.error?.message || ('Error ' + response.status) };
    } catch (e) {
      return { valid: false, error: 'Network error — are you online?' };
    }
  }

  _buildFallbackChain(preferredModel) {
    const chain = [preferredModel];
    for (const m of this.FREE_MODEL_FALLBACKS) {
      if (m !== preferredModel) chain.push(m);
    }
    return chain;
  }

  cancel() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }
}

window.aiEngine = new AIEngine();
