# facebook-humanmode — Facebook automation that behaves like a human

> Playwright + TypeScript browser automation for Facebook with Bézier mouse curves, natural typing, mood-based sessions, and AI-generated comments. Anti-detection built in.

[![OpenClaw Skill](https://img.shields.io/badge/OpenClaw-Skill-blueviolet)](https://github.com/NachaFromMars)

## Overview
facebook-humanmode is a sophisticated Facebook browser automation framework that simulates natural human behavior throughout each session. Mouse movements follow Bézier curves, typing includes natural variation and occasional typos, scrolling mimics reading patterns, and session activity levels vary by mood. AI comment generation uses a local Ollama model so responses feel contextual, not templated. Anti-detection techniques include randomized viewports and realistic timing delays.

## Features
- **Bézier curve mouse movement** — no straight-line robot paths
- **Natural typing** — variable speed with occasional typos
- **Reading-style scrolling** — pause, skim, continue patterns
- **AI comments** — generated via local Ollama models
- **Mood-based sessions** — activity level varies per session
- **Anti-detection** — randomized viewports, realistic delays

## Usage / Quick Start
```bash
npm install
npx playwright install chromium
export FB_EMAIL="your@email.com"
export FB_PASS="your-password"
npm run login
```

## Trigger Keywords (OpenClaw)
Facebook automation, human-like Facebook, Facebook posting, Facebook browsing, anti-detection Facebook

## Related Skills
- [facebook-page-manager](https://github.com/NachaFromMars/facebook-page-manager) — Graph API-based page management

---
Part of the [NachaFromMars](https://github.com/NachaFromMars) OpenClaw skill ecosystem.
