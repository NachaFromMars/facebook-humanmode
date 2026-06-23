# Facebook HumanMode V1.0 - Setup Guide

## Environment Variables

### Required

Set these in your shell or `.env` file:

```bash
export FB_EMAIL="your-email@gmail.com"
export FB_PASS="your-facebook-password"
```

### Optional

```bash
export FB_PAGE_URL="https://www.facebook.com/yourpage"  # Page to post on
export OLLAMA_URL="http://localhost:11434"              # Ollama server (default shown)
export OLLAMA_MODEL="black-hermes-heretic:36b-q5km"     # Model name
```

## Installation Steps

### 1. Prerequisites

- **Node.js** 16.0+ (LTS recommended)
- **npm** or **yarn**
- **Playwright** dependencies (installed automatically)
- **Chromium** browser (installed via playwright)

### 2. Install Dependencies

```bash
cd skills/facebook-humanmode
npm install
npx playwright install chromium
```

This will:
- Install Playwright and TypeScript
- Download Chromium browser (~400MB)
- Install tsx for running TypeScript

### 3. Set Environment Variables

**Option A: Export in shell**
```bash
export FB_EMAIL="your@email.com"
export FB_PASS="your-password"
```

**Option B: Create `.env` file** (recommended for development)
```bash
# .env
FB_EMAIL=your@email.com
FB_PASS=your-password
```

Then load before running:
```bash
source .env
npm run start
```

**Option C: Pass as environment**
```bash
FB_EMAIL="your@email.com" FB_PASS="pass" npm run start
```

### 4. First Login (Save Session)

```bash
npm run login
```

This will:
1. Open a browser window
2. Navigate to Facebook login
3. Simulate human typing (email, password)
4. Wait for 2FA if needed (check your phone/email)
5. Save session cookies to `./data/cookies/session.json`

**If 2FA is required:**
- You'll see: "📱 2FA detected. Please approve on your device"
- Approve the login attempt on your phone/email
- Browser will auto-continue after approval

### 5. Verify Installation

```bash
# Test TypeScript compilation
npx tsc --noEmit

# List available commands
npm run
```

Output should show:
```
start     tsx scripts/fb_orchestrator.ts
login     tsx scripts/fb_core.ts login
post      tsx scripts/fb_core.ts post
comment   tsx scripts/fb_core.ts comment
feed      tsx scripts/fb_core.ts feed
```

## Configuration

### default.json

Main settings file at `config/default.json`:

```json
{
  "timing": {
    "charDelay": [50, 150],      // Typing speed per character (ms)
    "wordDelay": [200, 400],     // Pause between words (ms)
    "thinkDelay": [3000, 5000],  // Think before commenting (ms)
    "readDelay": [5000, 15000],  // Reading pause (ms)
    "betweenComments": [10000, 300000],  // Pause between actions (ms)
    "sessionLength": [900000, 2700000]   // Session duration (ms) - 15-45 minutes
  },
  "behavior": {
    "typoRate": 0.12,            // 12% of words get typos
    "distractionRate": 0.15,     // 15% chance random distraction
    "imageOpenRate": 0.20,       // 20% chance to open image
    "profilePeekRate": 0.10,     // 10% chance to peek profile
    "reactRate": 0.30,           // 30% chance to like/react
    "commentRate": 0.20,         // 20% chance to comment
    "sleepHours": [22, 7],       // No activity 22:00-07:00
    "moodWeights": {
      "active": 0.2,             // 20% chance active mood
      "moderate": 0.4,           // 40% chance moderate
      "quiet": 0.3,              // 30% chance quiet
      "lurk": 0.1                // 10% chance lurk
    }
  },
  "browser": {
    "viewport": {
      "width": 1366,
      "height": 768,
      "randomize": 50            // ±50px randomization
    },
    "userAgent": "Mozilla/5.0...",
    "headless": false,           // Show browser window
    "cookiePath": "./data/cookies/session.json"
  },
  "ai": {
    "ollamaUrl": "http://localhost:11434",
    "model": "black-hermes-heretic:36b-q5km",
    "fallbackModel": "black-nacha-mistral:24b-q6k"
  }
}
```

### anti-detect.json

Anti-detection rules at `config/anti-detect.json`:

```json
{
  "rules": {
    "maxCommentsPerHour": 5,     // Don't spam
    "maxReactsPerHour": 15,      // Rate limiting
    "maxSessionsPerDay": 6,      // Daily limit
    "neverCommentSameContentTwice": true,  // Vary replies
    "varyTypingSpeed": true,     // Don't be predictable
    "randomizeViewport": true    // Change screen size
  }
}
```

## AI Setup (Optional)

For AI-powered comment generation, install Ollama:

### 1. Install Ollama

```bash
# macOS / Linux
curl https://ollama.ai/install.sh | sh

# Windows
# Download from https://ollama.ai/download

# Or use Docker
docker run -it --rm ollama/ollama
```

### 2. Pull Models

```bash
# Primary model (recommended)
ollama pull black-hermes-heretic:36b-q5km

# Alternative models
ollama pull black-nacha-mistral:24b-q6k
ollama pull mistral:7b
```

### 3. Start Ollama Server

```bash
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Run Facebook HumanMode
cd skills/facebook-humanmode
npm run start
```

### 4. Test AI Connection

```bash
# Should return 200 if Ollama is running
curl http://localhost:11434/api/generate -X POST \
  -H "Content-Type: application/json" \
  -d '{"model":"black-hermes-heretic:36b-q5km","prompt":"Hello"}'
```

## Data Directory

Script creates:
```
./data/
├── cookies/
│   └── session.json           # Saved browser cookies
└── logs/                       # Session logs (optional)
```

Ensure write permissions:
```bash
mkdir -p data/cookies
chmod 755 data/
```

## Running Sessions

### Single Session
```bash
npm run start
```

Runs one 15-45 minute session with:
- Random mood selection
- 1-10 interactions (depends on mood)
- Automatic cookie saving
- Realistic delays and human behavior

### Daily Schedule
```bash
npx tsx scripts/fb_orchestrator.ts run
```

Runs 2-6 sessions throughout the day:
- Respects sleep hours (default 22:00-07:00)
- 30min-2h breaks between sessions
- Mood randomization each day
- Automatic session management

### Specific Commands

```bash
# Login only (save session)
npm run login

# Browse feed only
npm run feed

# Post content
npm run post

# Comment on posts
npm run comment
```

## Troubleshooting

### "FB_EMAIL and FB_PASS not set"

**Solution:** Set environment variables before running:
```bash
export FB_EMAIL="your@email.com"
export FB_PASS="your-password"
npm run start
```

### Browser Won't Start

**Solution:** Ensure Chromium is installed:
```bash
npx playwright install chromium
```

If still failing:
```bash
# Check Playwright health
npx playwright install

# Try with verbose logging
DEBUG=pw:api npm run start
```

### Login Keeps Failing

**Possible causes:**
1. **Wrong credentials** - Check email/password
2. **Facebook blocks** - Try different IP/VPN
3. **2FA required** - Approve on your device
4. **Cookies expired** - Delete `./data/cookies/session.json` and re-login

**Solution:**
```bash
# Fresh login
rm -rf ./data/cookies/session.json
npm run login
```

### No AI Responses (Comments Are Generic)

**Cause:** Ollama not running or model not found

**Solution:**
```bash
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Check available models
ollama list

# If not found, pull it
ollama pull black-hermes-heretic:36b-q5km

# Terminal 3: Run Facebook HumanMode
npm run start
```

Check logs for fallback messages:
```
⚠️  Ollama API error: 500
💬 Comment posted (fallback response)
```

### Selectors Not Found (No Comments Posted)

**Cause:** Facebook UI changed

**Solution:**
1. Check console logs for missing selector
2. Open browser dev tools (F12) while running
3. Find new selector in HTML
4. Update in relevant .ts file:
   - `fb_comment.ts` - comment boxes
   - `fb_post.ts` - post buttons
   - `fb_feed.ts` - feed elements

**Example:** If comment button selector changed:
```typescript
// In fb_comment.ts, update commentSelectors array
const commentSelectors = [
  'NEW_SELECTOR_HERE',  // Add new one first
  'div[contenteditable="true"][aria-label*="comment"]',
  'div[contenteditable="true"][role="textbox"]',
];
```

### High CPU/Memory Usage

**Normal ranges:**
- CPU: 30-50%
- Memory: 300-400MB
- Network: 2-5MB per session

**If higher:**
1. Close other browsers
2. Disable extensions
3. Check for tabs/processes in background
4. Reduce session frequency

## Performance Tips

### Speed Up Development

```bash
# Use faster fallback model (smaller)
# In config/default.json:
"model": "mistral:7b"  # Faster than heretic:36b

# Or disable AI entirely (use fallback responses)
# Modify fb_comment.ts generateReply() to skip Ollama
```

### Reduce Detection Risk

```json
// config/default.json - More conservative settings
{
  "behavior": {
    "commentRate": 0.10,      // Comment less
    "reactRate": 0.15,        // React less
    "maxSessionsPerDay": 3    // Fewer sessions
  }
}
```

### Better Cookie Management

```bash
# Backup cookies
cp data/cookies/session.json data/cookies/session.backup.json

# Use separate cookies for different accounts
# In config/default.json:
"cookiePath": "./data/cookies/account1.json"
```

## Next Steps

1. ✅ Install and configure
2. ✅ Set environment variables
3. ✅ Run first login: `npm run login`
4. ✅ Test single session: `npm run start`
5. 📅 Schedule daily runs: `npx tsx scripts/fb_orchestrator.ts run`
6. 🎯 Customize config as needed
7. 🤖 Set up Ollama for better AI

## Additional Resources

- **Playwright Docs**: https://playwright.dev
- **Ollama Models**: https://ollama.ai/models
- **Facebook Selectors**: Check browser DevTools (F12)
- **TypeScript Guide**: https://www.typescriptlang.org/docs

## Support

For issues:
1. Check logs in terminal output
2. Verify environment variables: `echo $FB_EMAIL`
3. Update selectors if Facebook UI changed
4. Ensure all dependencies installed: `npm install`
5. Check internet connection and Firebase availability

Happy automating! 🚀
