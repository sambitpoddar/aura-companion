/**
 * AURA Context Engine
 * Collects passive device signals to enable proactive intelligence.
 * All data stays on-device. Never sent anywhere except the AI prompt.
 */

class ContextEngine {
  constructor() {
    this.signals = {
      timeOfDay: null,       // morning / afternoon / evening / night
      hour: null,
      dayOfWeek: null,
      batteryLevel: null,
      batteryCharging: null,
      networkType: null,
      networkOnline: navigator.onLine,
      timezone: null,
      sessionDuration: 0,    // minutes since page load
      sessionStart: Date.now(),
      focusState: 'active',  // active / idle
      lastIdleAt: null,
      idleMinutes: 0,
      clipboardHint: null,   // word count or type hint (not actual content)
      language: navigator.language,
      platform: this._detectPlatform(),
    };

    this._idleTimer = null;
    this._idleThreshold = 5 * 60 * 1000; // 5 min
    this._sessionTimer = null;

    this._init();
  }

  _detectPlatform() {
    const ua = navigator.userAgent.toLowerCase();
    if (/android/.test(ua)) return 'android';
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (/windows/.test(ua)) return 'windows';
    if (/mac/.test(ua)) return 'macos';
    if (/linux/.test(ua)) return 'linux';
    return 'unknown';
  }

  async _init() {
    this._updateTime();
    this._watchNetwork();
    this._watchFocus();
    this._watchVisibility();
    await this._watchBattery();
    this._updateSessionDuration();

    // Update time every minute
    setInterval(() => this._updateTime(), 60_000);
    setInterval(() => this._updateSessionDuration(), 60_000);
  }

  _updateTime() {
    const now = new Date();
    const hour = now.getHours();
    this.signals.hour = hour;
    this.signals.dayOfWeek = now.toLocaleDateString('en', { weekday: 'long' });
    this.signals.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (hour >= 5 && hour < 12) this.signals.timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) this.signals.timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 21) this.signals.timeOfDay = 'evening';
    else this.signals.timeOfDay = 'night';
  }

  _updateSessionDuration() {
    this.signals.sessionDuration = Math.round((Date.now() - this.signals.sessionStart) / 60_000);
  }

  _watchNetwork() {
    const update = () => {
      this.signals.networkOnline = navigator.onLine;
      if ('connection' in navigator) {
        const conn = navigator.connection;
        this.signals.networkType = conn.effectiveType || conn.type || 'unknown';
      } else {
        this.signals.networkType = navigator.onLine ? 'online' : 'offline';
      }
    };
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    if ('connection' in navigator) {
      navigator.connection.addEventListener('change', update);
    }
  }

  _watchFocus() {
    const resetIdle = () => {
      clearTimeout(this._idleTimer);
      if (this.signals.focusState === 'idle') {
        this.signals.focusState = 'active';
        this.signals.idleMinutes = this.signals.lastIdleAt
          ? Math.round((Date.now() - this.signals.lastIdleAt) / 60_000)
          : 0;
      }
      this._idleTimer = setTimeout(() => {
        this.signals.focusState = 'idle';
        this.signals.lastIdleAt = Date.now();
      }, this._idleThreshold);
    };

    ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'].forEach(evt =>
      document.addEventListener(evt, resetIdle, { passive: true })
    );
    resetIdle();
  }

  _watchVisibility() {
    document.addEventListener('visibilitychange', () => {
      this.signals.focusState = document.hidden ? 'background' : 'active';
    });
  }

  async _watchBattery() {
    if ('getBattery' in navigator) {
      try {
        const battery = await navigator.getBattery();
        const update = () => {
          this.signals.batteryLevel = Math.round(battery.level * 100);
          this.signals.batteryCharging = battery.charging;
        };
        update();
        battery.addEventListener('levelchange', update);
        battery.addEventListener('chargingchange', update);
      } catch {
        // Battery API not available or denied
      }
    }
  }

  /**
   * Returns a natural-language context summary for use in the AI system prompt.
   * @returns {string}
   */
  getContextSummary() {
    const s = this.signals;
    const parts = [];

    parts.push(`Time: ${s.timeOfDay} (${s.hour}:00, ${s.dayOfWeek})`);
    parts.push(`Timezone: ${s.timezone}`);

    if (s.batteryLevel !== null) {
      const batteryStatus = s.batteryCharging
        ? `${s.batteryLevel}% (charging)`
        : `${s.batteryLevel}%${s.batteryLevel < 20 ? ' — LOW' : ''}`;
      parts.push(`Battery: ${batteryStatus}`);
    }

    parts.push(`Network: ${s.networkOnline ? (s.networkType || 'online') : 'OFFLINE'}`);
    parts.push(`Platform: ${s.platform}`);
    parts.push(`Session duration: ${s.sessionDuration} minutes`);

    if (s.focusState === 'idle') {
      parts.push(`User has been idle for ~${s.idleMinutes} minutes`);
    }

    return parts.join('\n');
  }

  /**
   * Returns raw signals object.
   */
  getSignals() {
    this._updateTime();
    this._updateSessionDuration();
    return { ...this.signals };
  }

  /**
   * Generate a proactive suggestion based on current context + memory.
   * Returns null if no suggestion applies.
   * @param {object} userProfile - from MemoryEngine
   * @returns {string|null}
   */
  generateProactiveSuggestion(userProfile) {
    const s = this.signals;
    const suggestions = [];

    // Morning briefing prompt
    if (s.timeOfDay === 'morning' && s.hour >= 7 && s.hour < 10) {
      if (!userProfile.lastMorningBriefing || this._daysSince(userProfile.lastMorningBriefing) >= 1) {
        suggestions.push({
          text: `Good morning! Want a quick briefing to start your ${s.dayOfWeek}?`,
          action: `Good morning AURA! Give me a brief, energizing morning overview for a ${s.dayOfWeek}. Include a motivational nudge and suggest one key focus for today.`,
          priority: 10,
        });
      }
    }

    // Low battery warning
    if (s.batteryLevel !== null && s.batteryLevel < 20 && !s.batteryCharging) {
      suggestions.push({
        text: `Battery at ${s.batteryLevel}%. Should we wrap up or save important notes?`,
        action: `My device battery is at ${s.batteryLevel}%. Help me quickly summarize or save anything important from our conversation before I lose power.`,
        priority: 9,
      });
    }

    // Offline mode tip
    if (!s.networkOnline) {
      suggestions.push({
        text: 'You\'re offline. I can still help with things that don\'t need the internet.',
        action: 'I\'m currently offline. What are some useful things you can help me with that work offline?',
        priority: 8,
      });
    }

    // Evening wind-down
    if (s.timeOfDay === 'evening' && s.hour >= 19) {
      if (s.sessionDuration > 60) {
        suggestions.push({
          text: `You've been working for ${s.sessionDuration} minutes. Time for a break or end-of-day review?`,
          action: `I've been working for ${s.sessionDuration} minutes this evening. Help me do a quick end-of-day review — what I accomplished and what to prioritize tomorrow.`,
          priority: 7,
        });
      }
    }

    // Late night focus
    if (s.timeOfDay === 'night' && s.hour >= 23) {
      suggestions.push({
        text: 'Working late? I can help you focus or wind down.',
        action: 'It\'s late and I\'m still working. Give me 3 practical tips for either maintaining late-night focus or winding down effectively.',
        priority: 6,
      });
    }

    // Long idle return
    if (s.focusState === 'active' && s.idleMinutes > 15 && s.sessionDuration > 5) {
      suggestions.push({
        text: `Welcome back after ${s.idleMinutes} minutes. Want to pick up where you left off?`,
        action: `I just returned after being away for ${s.idleMinutes} minutes. Help me quickly get back into focus mode.`,
        priority: 5,
      });
    }

    // Topic follow-up
    if (userProfile.recentTopics && userProfile.recentTopics.length > 0) {
      const lastTopic = userProfile.recentTopics[0];
      const hoursAgo = this._hoursSince(lastTopic.timestamp);
      if (hoursAgo >= 2 && hoursAgo < 24) {
        suggestions.push({
          text: `Earlier you were working on "${lastTopic.label}". Want to continue?`,
          action: `Let's continue from where we left off. Earlier I was working on: ${lastTopic.label}. Please help me pick this up.`,
          priority: 4,
        });
      }
    }

    if (suggestions.length === 0) return null;

    // Return highest priority
    suggestions.sort((a, b) => b.priority - a.priority);
    return suggestions[0];
  }

  _daysSince(timestamp) {
    return (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
  }

  _hoursSince(timestamp) {
    return (Date.now() - timestamp) / (1000 * 60 * 60);
  }
}

// Export global instance
window.contextEngine = new ContextEngine();
