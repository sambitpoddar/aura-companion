# AURA – AI Companion (OpenRouter Edition)

> Your on-device AI companion that anticipates your needs — powered by **genuinely free AI models** via OpenRouter. No credit card. No subscription. No cost.

---

## ⚡ Quick Start (5 minutes, $0)

### Step 1 — Get your free OpenRouter API key
1. Go to **[openrouter.ai](https://openrouter.ai)** → Sign up (just email, no card)
2. Go to **[openrouter.ai/keys](https://openrouter.ai/keys)** → Create a key
3. Copy it (starts with `sk-or-v1-`)

### Step 2 — Deploy AURA for free
**Option A: GitHub Pages (recommended)**
```bash
git init && git add . && git commit -m "AURA launch"
# Create repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/aura.git
git push -u origin main
# Enable Pages: Settings → Pages → Source: main branch /root
```
Live at: `https://YOUR_USERNAME.github.io/aura`

**Option B: Netlify (30 seconds)**
- Drag this folder onto [app.netlify.com/drop](https://app.netlify.com/drop) → Done.

**Option C: Vercel**
```bash
npx vercel --yes
```

### Step 3 — Open AURA, paste your key, done ✓

---

## 🆓 Free Models Available

All models below are **100% free** on OpenRouter — no usage costs:

| Model | Strength | Context |
|---|---|---|
| **Gemini 2.0 Flash Exp** ⭐ | Fast, smart, recommended | 1M tokens |
| **Llama 3.3 70B** | Very capable, great writing | 128K tokens |
| **DeepSeek R1** | Best at reasoning & logic | 64K tokens |
| **Mistral 7B** | Lightweight, reliable backup | 32K tokens |
| **openrouter/free** | Auto-selects any free model | varies |

**Rate limits (free tier):** ~200 requests/day, 20/minute per model.
AURA automatically falls back through the chain if one model is rate-limited.

---

## ✨ Features

| Feature | Description |
|---|---|
| **Proactive Engine** | Detects context (morning, low battery, idle) and suggests actions |
| **Auto Fallback** | If one free model rate-limits, silently tries the next |
| **On-device Memory** | Stores history + learned topics in `localStorage` — never leaves device |
| **Streaming Responses** | Real-time character-by-character streaming |
| **Voice Input** | Web Speech API — tap mic, speak, auto-sends |
| **PWA / Installable** | Installs on Android, iOS, Desktop — works offline |
| **Zero Server Cost** | Pure static site — host free on GitHub Pages, Netlify, Vercel |

---

## 📁 File Structure

```
aura/
├── index.html          # App shell
├── styles.css          # Dark cosmic theme
├── app.js              # UI & orchestration
├── context-engine.js   # Device signal reader
├── memory-engine.js    # localStorage memory
├── ai-engine.js        # OpenRouter API client (streaming + fallback)
├── register-sw.js      # PWA install support
├── sw.js               # Service worker (offline cache)
├── manifest.json       # PWA manifest
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## 🧠 Proactive Intelligence Triggers

AURA checks context every 10 minutes and proactively surfaces:

- **7–10 AM** → Morning briefing offer
- **Battery < 20%** → Save/wrap-up prompt
- **Offline** → Offline capability tips
- **Idle 15+ min return** → Re-focus helper
- **Evening + 60 min session** → End-of-day review
- **11 PM+** → Focus or wind-down offer
- **Topic 2–24h ago** → Resume prior conversation

---

## 🔒 Privacy

- All conversation history stored in **your browser's localStorage only**
- API key stored locally — only sent to `openrouter.ai` as the Authorization header
- OpenRouter does **not** train on your data by default
- No analytics, no tracking, no third-party scripts

---

## 📈 Go-to-Market (Free)

1. **Product Hunt** — Launch Tuesday/Wednesday morning
2. **Reddit** — r/selfhosted, r/productivity, r/LocalLLaMA, r/artificial
3. **Hacker News** — "Show HN: AURA, a proactive on-device AI companion (free models)"
4. **Twitter/X** — Screen recording of a proactive suggestion triggering
5. **Dev.to** — "I built an AI companion that talks to you before you ask — using free models"

**Pitch:** *"The AI that notices before you ask."*

---

Built with the Web Platform + OpenRouter free models. Zero infrastructure. Zero cost.
