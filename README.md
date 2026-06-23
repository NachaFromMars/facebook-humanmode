# Facebook HumanMode V1.0

![Status](https://img.shields.io/badge/Status-Beta-yellow)
![License](https://img.shields.io/badge/License-MIT-blue)
![Ecosystem](https://img.shields.io/badge/Ecosystem-Nacharium-green)
![AI-Powered](https://img.shields.io/badge/AI-Powered-purple)

A sophisticated Facebook automation tool built for the Nacharium ecosystem. Designed to mimic human behavior precisely using Playwright and AI, bypassing typical bot detection systems.

## 🌟 Features

- **Human-Like Interactions**: Realistic typing speed, random pauses, mouse movements, and distraction simulations.
- **AI-Powered Engagement**: Generates context-aware comments and replies using Ollama (Llama 3, Mistral, etc.).
- **Anti-Detection Engine**: Randomized viewports, fingerprint masking, and behavioral variations.
- **2FA Support**: Handles two-factor authentication with manual approval waiting and session persistence.
- **Mood System**: Automatically switches between active, moderate, quiet, and lurking modes.
- **Automated Orchestration**: Scheduled sessions throughout the day with sleep-hour awareness.
- **Standalone Utilities**: Quick scan tools for checking account status without a full session.

## 🏗️ Architecture

```text
[ Orchestrator ] ───▶ [ Core Session ] ───▶ [ HumanMode Engine ]
       │                     │                      │
       │                     ├─▶ [ Feed Module ]    ├─▶ Mouse/Scroll
       │                     ├─▶ [ Notify Module ]  ├─▶ Typing/Typos
       └─▶ [ Schedule ]      ├─▶ [ Media Module ]   └─▶ Distractions
                             └─▶ [ AI Agent ] ──────▶ [ Ollama API ]
```

## 📂 Project Structure

```text
.
├── config/             # Configuration files (JSON)
├── data/               # Persistent data (cookies, logs) [Git Ignored]
├── references/         # Documentation & setup guides
├── scripts/            # TypeScript source files
│   ├── fb_comment.ts   # Commenting & AI reply logic
│   ├── fb_core.ts      # Login & Session management
│   ├── fb_feed.ts      # Feed browsing & interaction
│   ├── fb_media.ts     # Media (image/video) handling
│   ├── fb_messenger.ts # Message handling
│   ├── fb_notification.ts # Notification monitoring
│   ├── fb_orchestrator.ts # Daily scheduler & loop
│   ├── fb_post.ts      # Content posting logic
│   ├── fb_scan_v2.ts   # Account status utility
│   └── humanmode.ts    # Core anti-detection engine
├── SKILL.md            # OpenClaw skill definition
├── BLUEPRINT.md        # Technical build specification
├── LICENSE             # MIT License
└── README.md           # This file
```

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 16.0+
- Playwright & Chromium
- [Ollama](https://ollama.ai/) (optional, for AI features)

### 2. Installation
```bash
npm install
npx playwright install chromium
```

### 3. Setup Environment
Create a `.env` file or export variables:
```bash
FB_EMAIL="your-email@example.com"
FB_PASS="your-password"
```

### 4. First Login
```bash
npm run login
```
*Approve 2FA on your device if prompted.*

### 5. Start Automating
```bash
npm start
```

---

## ⚙️ Configuration

Settings are managed in `config/default.json`. You can adjust:
- **Timing**: Character delay, think time, session length.
- **Behavior**: Typo rates, distraction probability, mood weights.
- **AI**: Ollama URL and model selection.
- **Browser**: User-agent, viewport size, and headless mode.

---

## ⚠️ Known Limitations

- **Fingerprinting**: `webglNoise` and `canvasNoise` in `anti-detect.json` are placeholders and currently not implemented in the core engine.
- **Standalone Utility**: `fb_scan_v2.ts` is a standalone script and does not share modules with the core system.
- **UI Changes**: Facebook frequently updates its CSS classes; selectors may require periodic updates in `scripts/`.

---

## 🛠️ Development & Support

- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Scan**: `npm run scan`

Built for the **Nacharium** ecosystem.

**Credits & License**
Copyright 2026 Nacharium / Mr Nắng.
Licensed under the **MIT License**.
