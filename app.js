/**
 * AURA – Main Application Controller
 * Wires together context, memory, AI engines with the UI.
 */

(function () {
  'use strict';

  // ──────────────────────────────────────────
  //  STATE
  // ──────────────────────────────────────────
  const state = {
    isStreaming: false,
    selectedFocusAreas: [],
    proactiveCooldown: false,
    proactiveCheckInterval: null,
    lastProactiveTopic: null,
    voiceRecognition: null,
    isRecording: false,
  };

  // ──────────────────────────────────────────
  //  DOM REFERENCES
  // ──────────────────────────────────────────
  const $ = id => document.getElementById(id);

  const dom = {
    setupScreen: $('setup-screen'),
    appScreen: $('app-screen'),
    userNameInput: $('user-name-input'),
    apiKeyInput: $('api-key-input'),
    focusChips: $('focus-chips'),
    setupBtn: $('setup-btn'),
    chatArea: $('chat-area'),
    messages: $('messages'),
    welcomeState: $('welcome-state'),
    userDisplayName: $('user-display-name'),
    welcomeGreeting: $('welcome-greeting'),
    quickActions: $('quick-actions'),
    userInput: $('user-input'),
    sendBtn: $('send-btn'),
    voiceBtn: $('voice-btn'),
    auraStatus: $('aura-status'),
    dynamicGreeting: $('dynamic-greeting'),
    proactiveBar: $('proactive-bar'),
    proactiveText: $('proactive-text'),
    proactiveActBtn: $('proactive-act-btn'),
    proactiveDismissBtn: $('proactive-dismiss-btn'),
    settingsBtn: $('settings-btn'),
    contextBtn: $('context-btn'),
    settingsPanel: $('settings-panel'),
    contextPanel: $('context-panel'),
    closeSettings: $('close-settings'),
    closeContext: $('close-context'),
    overlay: $('overlay'),
    settingsName: $('settings-name'),
    settingsApiKey: $('settings-api-key'),
    toggleProactive: $('toggle-proactive'),
    modelSelect: $('model-select'),
    memoryDepth: $('memory-depth'),
    saveSettingsBtn: $('save-settings-btn'),
    clearMemoryBtn: $('clear-memory-btn'),
    contextPanelBody: $('context-panel-body'),
    tokenHint: $('token-hint'),
  };

  // ──────────────────────────────────────────
  //  INIT
  // ──────────────────────────────────────────

  function init() {
    initParticles();
    bindSetupEvents();
    bindAppEvents();

    if (window.memoryEngine.isSetupComplete()) {
      showApp();
    } else {
      showSetup();
    }
  }

  // ──────────────────────────────────────────
  //  SCREEN MANAGEMENT
  // ──────────────────────────────────────────

  function showSetup() {
    dom.setupScreen.classList.remove('hidden');
    dom.appScreen.classList.add('hidden');
    // Slight delay for animation
    setTimeout(() => dom.userNameInput.focus(), 300);
  }

  function showApp() {
    dom.setupScreen.classList.add('hidden');
    dom.appScreen.classList.remove('hidden');
    loadAppState();
    startProactiveEngine();
    updateGreeting();
    setInterval(updateGreeting, 60_000);
  }

  function loadAppState() {
    const profile = window.memoryEngine.getProfile();
    if (!profile) return;

    dom.userDisplayName.textContent = profile.name;
    dom.welcomeGreeting.innerHTML = `Hello, <span id="user-display-name">${profile.name}</span>`;

    // Populate quick actions based on focus areas
    renderQuickActions(profile.focusAreas || []);

    // Load settings into panel
    dom.settingsName.value = profile.name || '';
    dom.settingsApiKey.value = profile.apiKey || '';
    dom.toggleProactive.checked = profile.proactiveEnabled !== false;
    if (profile.model) dom.modelSelect.value = profile.model;
    if (profile.memoryDepth) dom.memoryDepth.value = profile.memoryDepth;
  }

  function updateGreeting() {
    const signals = window.contextEngine.getSignals();
    const greetings = {
      morning: 'Good morning',
      afternoon: 'Good afternoon',
      evening: 'Good evening',
      night: 'Working late',
    };
    dom.dynamicGreeting.textContent = greetings[signals.timeOfDay] || 'Hello';
  }

  // ──────────────────────────────────────────
  //  SETUP EVENTS
  // ──────────────────────────────────────────

  function bindSetupEvents() {
    // Focus chips
    dom.focusChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const value = chip.dataset.value;
        if (state.selectedFocusAreas.includes(value)) {
          state.selectedFocusAreas = state.selectedFocusAreas.filter(v => v !== value);
          chip.classList.remove('selected');
        } else {
          state.selectedFocusAreas.push(value);
          chip.classList.add('selected');
        }
      });
    });

    // Setup button
    dom.setupBtn.addEventListener('click', async () => {
      const name = dom.userNameInput.value.trim();
      const apiKey = dom.apiKeyInput.value.trim();

      if (!name) { showToast('Please enter your name'); dom.userNameInput.focus(); return; }
      if (!apiKey) { showToast('Please enter your API key'); dom.apiKeyInput.focus(); return; }
      if (!apiKey.startsWith('sk-or-') && !apiKey.startsWith('sk-')) {
        showToast('OpenRouter keys start with sk-or-v1-'); dom.apiKeyInput.focus(); return;
      }

      dom.setupBtn.textContent = 'Validating key…';
      dom.setupBtn.disabled = true;

      const result = await window.aiEngine.validateApiKey(apiKey);

      if (!result.valid) {
        showToast(result.error || 'Invalid API key');
        dom.setupBtn.textContent = 'Activate AURA →';
        dom.setupBtn.disabled = false;
        return;
      }

      // Save profile
      window.memoryEngine.saveProfile({
        name,
        apiKey,
        focusAreas: state.selectedFocusAreas,
        proactiveEnabled: true,
        model: 'google/gemini-2.0-flash-exp:free',
        memoryDepth: 20,
        createdAt: Date.now(),
      });

      dom.setupBtn.textContent = 'Activating…';
      await sleep(400);
      showApp();
    });

    // Enter key on last field
    dom.apiKeyInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') dom.setupBtn.click();
    });
  }

  // ──────────────────────────────────────────
  //  APP EVENTS
  // ──────────────────────────────────────────

  function bindAppEvents() {
    // Send on button click
    dom.sendBtn.addEventListener('click', handleSend);

    // Send on Enter (Shift+Enter = newline)
    dom.userInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // Auto-resize textarea + update send button
    dom.userInput.addEventListener('input', () => {
      autoResize(dom.userInput);
      const hasText = dom.userInput.value.trim().length > 0;
      dom.sendBtn.classList.toggle('active', hasText);
      // Token hint
      const charCount = dom.userInput.value.length;
      dom.tokenHint.textContent = charCount > 100 ? `~${Math.ceil(charCount / 4)} tokens` : '';
    });

    // Proactive bar
    dom.proactiveActBtn.addEventListener('click', () => {
      const action = dom.proactiveActBtn.dataset.action;
      if (action) {
        dom.userInput.value = action;
        autoResize(dom.userInput);
        dom.sendBtn.classList.add('active');
        hideProactiveBar();
        handleSend();
      }
    });

    dom.proactiveDismissBtn.addEventListener('click', () => {
      hideProactiveBar();
      state.proactiveCooldown = true;
      setTimeout(() => { state.proactiveCooldown = false; }, 30 * 60 * 1000); // 30 min cooldown
    });

    // Panels
    dom.settingsBtn.addEventListener('click', openPanel.bind(null, 'settings'));
    dom.contextBtn.addEventListener('click', () => {
      populateContextPanel();
      openPanel('context');
    });
    dom.closeSettings.addEventListener('click', closePanel.bind(null, 'settings'));
    dom.closeContext.addEventListener('click', closePanel.bind(null, 'context'));
    dom.overlay.addEventListener('click', () => {
      closePanel('settings');
      closePanel('context');
    });

    // Save settings
    dom.saveSettingsBtn.addEventListener('click', saveSettings);

    // Clear memory
    dom.clearMemoryBtn.addEventListener('click', () => {
      if (confirm('Clear all memory and history? This cannot be undone.')) {
        window.memoryEngine.clearHistory();
        window.memoryEngine.saveProfile({
          recentTopics: [],
          lastMorningBriefing: null,
        });
        dom.messages.innerHTML = '';
        dom.welcomeState.classList.remove('hidden');
        closePanel('settings');
        showToast('Memory cleared ✓');
      }
    });

    // Voice input
    dom.voiceBtn.addEventListener('click', toggleVoiceInput);
  }

  // ──────────────────────────────────────────
  //  MESSAGE HANDLING
  // ──────────────────────────────────────────

  async function handleSend() {
    const text = dom.userInput.value.trim();
    if (!text || state.isStreaming) return;

    // Clear input
    dom.userInput.value = '';
    autoResize(dom.userInput);
    dom.sendBtn.classList.remove('active');

    // Show welcome state → hide, show messages
    dom.welcomeState.classList.add('hidden');

    // Add user message to UI
    addMessageToUI('user', text);

    // Save to memory
    window.memoryEngine.addMessage('user', text);
    window.memoryEngine.incrementStat('totalMessages');

    // Get conversation history (without the message we just added, since API builds it)
    const history = window.memoryEngine.getRecentMessages(
      parseInt(dom.memoryDepth?.value || 20)
    );
    // Remove the last message (just added) to avoid duplication
    const historyWithoutLast = history.slice(0, -1);

    // Show typing indicator
    const typingEl = addTypingIndicator();
    setThinking(true);
    state.isStreaming = true;

    let assistantMessageEl = null;
    let fullResponse = '';

    await window.aiEngine.sendMessage(
      text,
      historyWithoutLast,
      {},
      // onChunk
      (chunk, full) => {
        fullResponse = full;
        if (!assistantMessageEl) {
          typingEl.remove();
          assistantMessageEl = addMessageToUI('assistant', '', true);
        }
        // Stream into bubble
        const bubble = assistantMessageEl.querySelector('.message-bubble');
        bubble.innerHTML = formatMarkdown(full);
        scrollToBottom();
      },
      // onDone
      (fullText) => {
        state.isStreaming = false;
        setThinking(false);
        if (!assistantMessageEl) {
          typingEl.remove();
          addMessageToUI('assistant', fullText);
        }
        // Save to memory
        window.memoryEngine.addMessage('assistant', fullText);
        window.memoryEngine.incrementStat('totalMessages');
        scrollToBottom();

        // Check if it was a morning briefing
        const profile = window.memoryEngine.getProfile();
        const signals = window.contextEngine.getSignals();
        if (signals.timeOfDay === 'morning' && text.toLowerCase().includes('morning')) {
          window.memoryEngine.saveProfile({ lastMorningBriefing: Date.now() });
        }
      },
      // onError
      (errMsg) => {
        state.isStreaming = false;
        setThinking(false);
        typingEl.remove();
        addMessageToUI('assistant', `⚠️ ${errMsg}`, false, true);
        scrollToBottom();
      }
    );
  }

  // ──────────────────────────────────────────
  //  UI HELPERS
  // ──────────────────────────────────────────

  function addMessageToUI(role, content, isStreaming = false, isError = false) {
    const msgEl = document.createElement('div');
    msgEl.className = `message ${role}`;

    const bubble = document.createElement('div');
    bubble.className = `message-bubble${isError ? ' error' : ''}`;
    bubble.innerHTML = isStreaming ? '' : (role === 'assistant' ? formatMarkdown(content) : escapeHtml(content));

    const time = document.createElement('span');
    time.className = 'message-time';
    time.textContent = formatTime(new Date());

    msgEl.appendChild(bubble);
    msgEl.appendChild(time);

    dom.messages.appendChild(msgEl);
    scrollToBottom();
    return msgEl;
  }

  function addTypingIndicator() {
    const msgEl = document.createElement('div');
    msgEl.className = 'message assistant';

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span');
      dot.className = 'typing-dot';
      indicator.appendChild(dot);
    }

    msgEl.appendChild(indicator);
    dom.messages.appendChild(msgEl);
    scrollToBottom();
    return msgEl;
  }

  function scrollToBottom() {
    dom.chatArea.scrollTop = dom.chatArea.scrollHeight;
  }

  function setThinking(isThinking) {
    dom.auraStatus.classList.toggle('thinking', isThinking);
  }

  // ──────────────────────────────────────────
  //  QUICK ACTIONS
  // ──────────────────────────────────────────

  const QUICK_ACTIONS = {
    work: [
      { label: '📝 Summarize my day', prompt: 'Help me do a quick end-of-day review. What are 3 questions I should ask myself to reflect on productivity?' },
      { label: '⚡ Boost focus', prompt: 'I need to focus for the next 90 minutes. Give me a practical focus protocol.' },
      { label: '📧 Draft an email', prompt: 'Help me draft a professional email. Ask me what it\'s about.' },
    ],
    learning: [
      { label: '🧠 Quick quiz me', prompt: 'Quiz me on a topic. Ask me what I\'m currently studying.' },
      { label: '📚 Explain a concept', prompt: 'Explain a complex concept simply. Ask me what I want to understand.' },
      { label: '🗺️ Learning roadmap', prompt: 'Create a learning roadmap for me. Ask what skill I want to build.' },
    ],
    creative: [
      { label: '💡 Brainstorm ideas', prompt: 'Let\'s brainstorm. Ask me what project or problem I\'m working on.' },
      { label: '✍️ Writing help', prompt: 'Help me with writing. Ask what I\'m working on.' },
    ],
    health: [
      { label: '🧘 Mindfulness break', prompt: 'Guide me through a quick 2-minute mindfulness or breathing exercise right now.' },
      { label: '💪 Quick workout', prompt: 'Give me a quick 10-minute workout I can do anywhere with no equipment.' },
    ],
    personal: [
      { label: '🎯 Set intentions', prompt: 'Help me set clear intentions for today. Ask me what matters most right now.' },
      { label: '💬 Talk it through', prompt: 'I want to think through something. Help me reflect. Ask what\'s on my mind.' },
    ],
    tech: [
      { label: '🐛 Debug code', prompt: 'I need help debugging code. Paste your code or describe the issue.' },
      { label: '🏗️ Architecture help', prompt: 'Help me design a system or architecture. Ask me what I\'m building.' },
    ],
  };

  function renderQuickActions(focusAreas) {
    dom.quickActions.innerHTML = '';
    const areas = focusAreas.length > 0 ? focusAreas : ['work', 'learning'];

    let actions = [];
    areas.forEach(area => {
      if (QUICK_ACTIONS[area]) {
        actions.push(...QUICK_ACTIONS[area]);
      }
    });

    // Limit to 6 actions
    actions = actions.slice(0, 6);

    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.className = 'quick-action-btn';
      btn.textContent = action.label;
      btn.addEventListener('click', () => {
        dom.userInput.value = action.prompt;
        autoResize(dom.userInput);
        dom.sendBtn.classList.add('active');
        handleSend();
      });
      dom.quickActions.appendChild(btn);
    });
  }

  // ──────────────────────────────────────────
  //  PROACTIVE ENGINE
  // ──────────────────────────────────────────

  function startProactiveEngine() {
    const profile = window.memoryEngine.getProfile();
    if (!profile?.proactiveEnabled) return;

    // Check after 3 seconds (initial load)
    setTimeout(checkProactive, 3000);

    // Then check every 10 minutes
    state.proactiveCheckInterval = setInterval(checkProactive, 10 * 60 * 1000);
  }

  function checkProactive() {
    if (state.proactiveCooldown) return;
    if (state.isStreaming) return;

    const profile = window.memoryEngine.getProfile();
    if (!profile?.proactiveEnabled) return;

    const suggestion = window.contextEngine.generateProactiveSuggestion(profile);
    if (!suggestion) return;

    // Don't repeat the same suggestion
    if (state.lastProactiveTopic === suggestion.text) return;
    state.lastProactiveTopic = suggestion.text;

    showProactiveBar(suggestion);
  }

  function showProactiveBar(suggestion) {
    dom.proactiveText.textContent = suggestion.text;
    dom.proactiveActBtn.dataset.action = suggestion.action;
    dom.proactiveBar.classList.remove('hidden');

    // Auto-hide after 30 seconds
    setTimeout(() => {
      if (!dom.proactiveBar.classList.contains('hidden')) {
        hideProactiveBar();
      }
    }, 30_000);
  }

  function hideProactiveBar() {
    dom.proactiveBar.classList.add('hidden');
  }

  // ──────────────────────────────────────────
  //  SETTINGS
  // ──────────────────────────────────────────

  function saveSettings() {
    const name = dom.settingsName.value.trim();
    const apiKey = dom.settingsApiKey.value.trim();
    const proactiveEnabled = dom.toggleProactive.checked;
    const model = dom.modelSelect.value;
    const memoryDepth = parseInt(dom.memoryDepth.value) || 20;

    if (!name || !apiKey) {
      showToast('Name and API key are required');
      return;
    }

    window.memoryEngine.saveProfile({ name, apiKey, proactiveEnabled, model, memoryDepth });
    showToast('Settings saved ✓');
    closePanel('settings');
    loadAppState();
  }

  // ──────────────────────────────────────────
  //  CONTEXT PANEL
  // ──────────────────────────────────────────

  function populateContextPanel() {
    const signals = window.contextEngine.getSignals();
    const profile = window.memoryEngine.getProfile();
    const topics = window.memoryEngine.getTopics().slice(0, 5);

    const items = [
      { icon: '🕐', name: 'Time', value: `${signals.timeOfDay} · ${signals.dayOfWeek}` },
      { icon: '🌍', name: 'Timezone', value: signals.timezone || 'Unknown' },
      { icon: '🌐', name: 'Network', value: signals.networkOnline ? (signals.networkType || 'Online') : 'Offline' },
      { icon: '📱', name: 'Platform', value: signals.platform },
      { icon: '⏱️', name: 'Session', value: `${signals.sessionDuration} minutes` },
    ];

    if (signals.batteryLevel !== null) {
      items.push({
        icon: signals.batteryCharging ? '🔌' : (signals.batteryLevel < 20 ? '🪫' : '🔋'),
        name: 'Battery',
        value: `${signals.batteryLevel}%${signals.batteryCharging ? ' (charging)' : ''}`,
      });
    }

    if (signals.focusState === 'idle') {
      items.push({ icon: '😴', name: 'Focus State', value: `Idle for ~${signals.idleMinutes} min` });
    } else {
      items.push({ icon: '🎯', name: 'Focus State', value: 'Active' });
    }

    let html = '<div style="display:flex;flex-direction:column;gap:10px">';

    items.forEach(item => {
      html += `
        <div class="context-signal">
          <span class="signal-icon">${item.icon}</span>
          <div class="signal-info">
            <div class="signal-name">${item.name}</div>
            <div class="signal-value">${item.value}</div>
          </div>
        </div>
      `;
    });

    if (topics.length > 0) {
      html += `
        <div style="margin-top:8px">
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px">Recent Topics</div>
          ${topics.map(t => `<div style="font-size:13px;color:var(--text-muted);font-family:var(--font-mono);padding:4px 0;border-bottom:1px solid var(--border)">${escapeHtml(t.label)}</div>`).join('')}
        </div>
      `;
    }

    html += '</div>';
    dom.contextPanelBody.innerHTML = html;
  }

  // ──────────────────────────────────────────
  //  PANEL MANAGEMENT
  // ──────────────────────────────────────────

  function openPanel(name) {
    const panel = name === 'settings' ? dom.settingsPanel : dom.contextPanel;
    panel.classList.remove('hidden');
    dom.overlay.classList.remove('hidden');
  }

  function closePanel(name) {
    const panel = name === 'settings' ? dom.settingsPanel : dom.contextPanel;
    panel.classList.add('hidden');
    // Hide overlay only if both panels are closed
    if (dom.settingsPanel.classList.contains('hidden') && dom.contextPanel.classList.contains('hidden')) {
      dom.overlay.classList.add('hidden');
    }
  }

  // ──────────────────────────────────────────
  //  VOICE INPUT
  // ──────────────────────────────────────────

  function toggleVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Voice input not supported in this browser');
      return;
    }

    if (state.isRecording) {
      state.voiceRecognition?.stop();
      state.isRecording = false;
      dom.voiceBtn.classList.remove('recording');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      state.isRecording = true;
      dom.voiceBtn.classList.add('recording');
      showToast('Listening…');
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('');
      dom.userInput.value = transcript;
      autoResize(dom.userInput);
      dom.sendBtn.classList.toggle('active', transcript.trim().length > 0);
    };

    recognition.onerror = (event) => {
      state.isRecording = false;
      dom.voiceBtn.classList.remove('recording');
      if (event.error !== 'aborted') showToast(`Voice error: ${event.error}`);
    };

    recognition.onend = () => {
      state.isRecording = false;
      dom.voiceBtn.classList.remove('recording');
      // Auto-send if there's content
      if (dom.userInput.value.trim()) {
        setTimeout(handleSend, 300);
      }
    };

    state.voiceRecognition = recognition;
    recognition.start();
  }

  // ──────────────────────────────────────────
  //  PARTICLES
  // ──────────────────────────────────────────

  function initParticles() {
    const canvas = $('particle-canvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    class Particle {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
        this.alpha = Math.random() * 0.4 + 0.05;
        this.size = Math.random() * 1.5 + 0.3;
        this.color = Math.random() > 0.5 ? '108, 99, 255' : '167, 139, 250';
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
          this.reset();
        }
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color}, ${this.alpha})`;
        ctx.fill();
      }
    }

    // Create particles
    for (let i = 0; i < 80; i++) particles.push(new Particle());

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => { p.update(); p.draw(); });

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(108, 99, 255, ${0.08 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();
  }

  // ──────────────────────────────────────────
  //  UTILITY FUNCTIONS
  // ──────────────────────────────────────────

  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function showToast(message, duration = 3000) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function formatTime(date) {
    return date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Simple markdown → HTML formatter.
   * Handles: **bold**, *italic*, `code`, ```code blocks```, # headers, - lists, numbered lists, line breaks.
   */
  function formatMarkdown(text) {
    if (!text) return '';

    let html = escapeHtml(text);

    // Code blocks (``` ... ```)
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const langLabel = lang ? `<span class="code-lang">${lang}</span>` : '';
      return `<pre>${langLabel}<code>${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Unordered lists
    html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Double newlines → paragraphs
    const paragraphs = html.split(/\n\n+/);
    html = paragraphs.map(p => {
      p = p.trim();
      if (!p) return '';
      if (p.startsWith('<h') || p.startsWith('<pre') || p.startsWith('<ul') || p.startsWith('<ol') || p.startsWith('<li')) return p;
      // Single line breaks within paragraph
      p = p.replace(/\n/g, '<br>');
      return `<p>${p}</p>`;
    }).join('');

    return html;
  }

  // ──────────────────────────────────────────
  //  BOOT
  // ──────────────────────────────────────────

  // Wait for DOM + engines to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
