/**
 * AURA Memory Engine
 * Manages on-device persistent memory: conversation history, user profile,
 * learned topics, and interaction patterns. Uses localStorage only.
 */

class MemoryEngine {
  constructor() {
    this.KEYS = {
      profile: 'aura_profile',
      history: 'aura_history',
      topics: 'aura_topics',
      stats: 'aura_stats',
    };
    this.MAX_HISTORY = 100; // max messages stored
    this.MAX_TOPICS = 20;
    this._cache = {};
  }

  // ──────────────────────────────────────────
  //  PROFILE
  // ──────────────────────────────────────────

  getProfile() {
    if (this._cache.profile) return this._cache.profile;
    const raw = localStorage.getItem(this.KEYS.profile);
    const profile = raw ? JSON.parse(raw) : null;
    this._cache.profile = profile;
    return profile;
  }

  saveProfile(data) {
    const existing = this.getProfile() || {};
    const updated = { ...existing, ...data, updatedAt: Date.now() };
    localStorage.setItem(this.KEYS.profile, JSON.stringify(updated));
    this._cache.profile = updated;
    return updated;
  }

  isSetupComplete() {
    const profile = this.getProfile();
    return profile && profile.name && profile.apiKey;
  }

  // ──────────────────────────────────────────
  //  CONVERSATION HISTORY
  // ──────────────────────────────────────────

  getHistory() {
    const raw = localStorage.getItem(this.KEYS.history);
    return raw ? JSON.parse(raw) : [];
  }

  addMessage(role, content) {
    const history = this.getHistory();
    const message = {
      role,         // 'user' | 'assistant'
      content,
      timestamp: Date.now(),
      id: this._uuid(),
    };
    history.push(message);

    // Trim to max
    if (history.length > this.MAX_HISTORY) {
      history.splice(0, history.length - this.MAX_HISTORY);
    }

    localStorage.setItem(this.KEYS.history, JSON.stringify(history));

    // Extract topics from user messages
    if (role === 'user') {
      this._extractAndSaveTopic(content);
    }

    return message;
  }

  /**
   * Returns the last N messages formatted for the API (role + content only).
   * @param {number} n - number of messages
   */
  getRecentMessages(n = 20) {
    const history = this.getHistory();
    const recent = history.slice(-n);
    return recent.map(m => ({ role: m.role, content: m.content }));
  }

  clearHistory() {
    localStorage.removeItem(this.KEYS.history);
    localStorage.removeItem(this.KEYS.topics);
    this._cache = {};
  }

  // ──────────────────────────────────────────
  //  TOPIC EXTRACTION & LEARNING
  // ──────────────────────────────────────────

  _extractAndSaveTopic(text) {
    // Extract a short topic label (heuristic: first meaningful phrase)
    const cleaned = text.trim().replace(/\s+/g, ' ');
    if (cleaned.length < 10) return;

    // Take first sentence or 60 chars
    const label = cleaned.length > 60
      ? cleaned.substring(0, 57) + '…'
      : cleaned;

    const topics = this.getTopics();

    // Avoid duplicate recent topic
    const last = topics[0];
    if (last && last.label === label) return;

    topics.unshift({
      label,
      timestamp: Date.now(),
      id: this._uuid(),
    });

    if (topics.length > this.MAX_TOPICS) topics.pop();
    localStorage.setItem(this.KEYS.topics, JSON.stringify(topics));

    // Update profile recent topics
    this.saveProfile({ recentTopics: topics.slice(0, 5) });
  }

  getTopics() {
    const raw = localStorage.getItem(this.KEYS.topics);
    return raw ? JSON.parse(raw) : [];
  }

  // ──────────────────────────────────────────
  //  STATS
  // ──────────────────────────────────────────

  incrementStat(key) {
    const stats = this.getStats();
    stats[key] = (stats[key] || 0) + 1;
    stats.lastUsed = Date.now();
    localStorage.setItem(this.KEYS.stats, JSON.stringify(stats));
  }

  getStats() {
    const raw = localStorage.getItem(this.KEYS.stats);
    return raw ? JSON.parse(raw) : {};
  }

  /**
   * Builds a memory summary string for the system prompt.
   * Gives the AI context about the user's history.
   */
  buildMemorySummary() {
    const profile = this.getProfile();
    const topics = this.getTopics().slice(0, 8);
    const stats = this.getStats();

    const parts = [];

    if (profile?.focusAreas?.length) {
      parts.push(`User's main interests: ${profile.focusAreas.join(', ')}`);
    }

    if (topics.length > 0) {
      const topicList = topics.map(t => `"${t.label}"`).join(', ');
      parts.push(`Recent conversation topics: ${topicList}`);
    }

    if (stats.totalMessages) {
      parts.push(`Total interactions: ${stats.totalMessages}`);
    }

    if (profile?.lastMorningBriefing) {
      const daysAgo = Math.floor((Date.now() - profile.lastMorningBriefing) / (1000 * 60 * 60 * 24));
      if (daysAgo === 0) parts.push('User already received morning briefing today');
    }

    return parts.length > 0 ? parts.join('\n') : '';
  }

  // ──────────────────────────────────────────
  //  UTILITY
  // ──────────────────────────────────────────

  _uuid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
}

window.memoryEngine = new MemoryEngine();
