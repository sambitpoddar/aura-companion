# AURA – AI Companion

> Your on-device AI companion that anticipates your needs with human-like intuition.

AURA is a **free, installable PWA** (Progressive Web App) that runs entirely on the user's device. It uses passive device signals (time of day, battery, network, idle state, usage patterns) to proactively surface suggestions — without the user having to prompt every time.

---

## ✨ Features

| Feature | Description |
|---|---|
| **Proactive Engine** | Automatically detects context (morning, low battery, post-idle) and suggests actions |
| **On-device Memory** | Stores conversation history + learned topics in `localStorage` |
| **Streaming AI** | Real-time streamed responses via Anthropic API |
| **Voice Input** | Web Speech API for hands-free interaction |
| **PWA / Installable** | Works offline (cached), installable on Android/iOS/Desktop |
| **Context Signals** | Reads time, battery, network, platform, session duration |
| **Zero Server Cost** | Pure static site — deploy free on GitHub Pages, Vercel, or Netlify |

---

## 🚀 Deployment Guide (100% Free)

### Option 1: GitHub Pages (Recommended)

1. Create a free GitHub account at [github.com](https://github.com)
2. Create a new repository: `aura-companion` (set to **Public**)
3. Upload all files from this folder to the repository root
4. Go to **Settings → Pages → Source**: select `main` branch, root `/`
5. Your app is live at: `https://YOUR_USERNAME.github.io/aura-companion`

```bash
# Or via git:
git init
git add .
git commit -m "Initial AURA deployment"
git remote add origin https://github.com/YOUR_USERNAME/aura-companion.git
git push -u origin main
```

### Option 2: Vercel (Zero config)

```bash
npm i -g vercel
vercel
# Follow prompts — deployed in 30 seconds
```

### Option 3: Netlify

1. Go to [netlify.com](https://netlify.com)
2. Drag & drop this entire folder onto the deploy zone
3. Done — live URL provided instantly

### Option 4: Cloudflare Pages (fastest globally)

1. Push to GitHub (Option 1)
2. Connect repo at [pages.cloudflare.com](https://pages.cloudflare.com)
3. Framework: None (static site), build command: empty

---

## 🔑 Getting Your Free API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up (free tier includes credits)
3. Go to **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-`)
5. Paste it in AURA's setup screen

**Recommended model for free tier:** `claude-haiku-4-5-20251001` — extremely fast & cheap (~$0.001 per conversation).

---

## 📁 File Structure

```
aura-companion/
├── index.html          # Main app shell
├── styles.css          # Complete stylesheet (dark cosmic theme)
├── app.js              # UI controller & orchestration
├── context-engine.js   # Device signal reader (battery, time, network, idle)
├── memory-engine.js    # localStorage memory & topic learning
├── ai-engine.js        # Anthropic API client (streaming)
├── register-sw.js      # PWA service worker registration
├── sw.js               # Service worker (caching + offline)
├── manifest.json       # PWA manifest (installability)
└── icons/
    ├── icon-192.png    # App icon
    └── icon-512.png    # App icon (large)
```

---

## 🧠 How Proactive Intelligence Works

AURA's context engine runs passively in the background and checks every 10 minutes:

1. **Morning (7–10 AM)** → Offers daily briefing if not done today
2. **Low battery (<20%)** → Prompts to save notes before losing power
3. **Offline** → Tells user what still works
4. **Long idle return (>15 min)** → Helps re-enter focus state
5. **Evening (after 7 PM, 60+ min session)** → Suggests end-of-day review
6. **Late night (after 11 PM)** → Offers focus or wind-down help
7. **Topic follow-up (2–24h later)** → Resumes prior conversations

---

## 🔒 Privacy

- **All data stays on your device** — conversation history in `localStorage`
- **API key stored locally** — never sent to any server except Anthropic
- **No analytics, no tracking, no ads**
- AURA reads device signals (battery, network) locally — none of this leaves the browser

---

## ⚙️ Configuration

All settings accessible via the ⚙️ icon:

| Setting | Options |
|---|---|
| **Model** | `claude-haiku-4-5-20251001` (fast/cheap) or `claude-sonnet-4-6` (smarter) |
| **Proactive suggestions** | On/Off |
| **Memory depth** | 4–40 messages of context |
| **Clear memory** | Wipes all history + topics |

---

## 🛠 Extending AURA

### Adding new proactive triggers

Edit `context-engine.js` → `generateProactiveSuggestion()`:

```javascript
// Example: Suggest exercise after 2+ hours of sitting
if (s.sessionDuration > 120) {
  suggestions.push({
    text: "You've been at it for 2 hours. Time to move?",
    action: "Give me a quick 5-minute desk stretch routine.",
    priority: 6,
  });
}
```

### Adding memory persistence across devices

Replace `localStorage` calls in `memory-engine.js` with a free service:
- **Deta Space** (free KV store)
- **PocketBase** (self-hosted, free)
- **Supabase** (free tier)

### Adding notifications

```javascript
// Request permission and send a notification
if (Notification.permission === 'granted') {
  new Notification('AURA', { body: 'Your reminder!', icon: '/icons/icon-192.png' });
}
```

---

## 📈 Getting Traction (Go-to-Market)

1. **Product Hunt** — Launch on PH on a Tuesday/Wednesday morning
2. **Reddit** — Post in r/selfhosted, r/productivity, r/artificial
3. **Hacker News** — "Show HN: AURA, an on-device AI companion that anticipates your needs"
4. **Twitter/X** — Demo video of proactive suggestions triggering in real-time
5. **Dev.to article** — "How I built a proactive AI companion for free using browser APIs"

**Key differentiator to highlight:** *"The AI that talks to you before you talk to it"*

---

Built with ❤️ using Anthropic Claude API + Web Platform APIs.
