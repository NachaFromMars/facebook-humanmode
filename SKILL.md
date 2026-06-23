---
name: facebook-humanmode
description: "Facebook HumanMode V1.0 - Nacharium. Full Facebook automation with human-like behavior simulation. Use when: automating Facebook login, browsing, posting, commenting, replying, uploading media, or managing pages with AI-powered responses and anti-detection."
---

# Facebook HumanMode V1.0 - Nacharium

## Overview

Facebook HumanMode V1.0 is a sophisticated browser automation framework for Facebook that simulates natural human behavior. Built with Playwright and TypeScript, it provides:

- **Human-like interactions**: Bézier curve mouse movement, natural typing with typos, reading-style scrolling
- **AI-powered engagement**: Comment generation using local Ollama models
- **Session management**: Multiple daily sessions with mood-based activity levels
- **Anti-detection**: Randomized viewports, realistic delays, behavioral patterns
- **Full Facebook integration**: Feed browsing, posting, commenting, messaging, notifications

## Quick Start

### Installation

```bash
cd skills/facebook-humanmode
npm install
npx playwright install chromium
```

### Environment Setup

Set required environment variables:

```bash
export FB_EMAIL="your-facebook-email@example.com"
export FB_PASS="your-facebook-password"
```

### First Login (Save Session)

```bash
npm run login
```

This will:
1. Open a visible browser window
2. Simulate human-like login
3. Handle 2FA if needed (approve on your device)
4. Save cookies for future sessions

### ⚠️ Login Policy — QUAN TRỌNG

**Max 3 lần thử login.** Nếu thất bại 3 lần → DỪNG NGAY, báo cáo lý do.

Quy tắc bắt buộc:
1. **Ưu tiên cookies** — Luôn thử login bằng cookies trước. Chỉ login bằng credentials khi cookies hết hạn.
2. **Retry limit = 3** — Dùng `loginWithRetry()` thay vì gọi `login()` nhiều lần thủ công.
3. **Backoff** — Giữa các lần retry: 5s → 10s → stop.
4. **Báo cáo khi fail** — Nếu 3 lần đều thất bại, log chi tiết lý do (2FA, captcha, sai pass, timeout) và **KHÔNG thử tiếp**.
5. **Không spam login** — Facebook sẽ lock tài khoản nếu login quá nhiều lần liên tục.

```typescript
// ✅ ĐÚNG - dùng loginWithRetry
const result = await loginWithRetry(session, email, password, 3);
if (!result.success) {
  console.log(`🛑 Login failed after ${result.attempts} attempts`);
  console.log(`Reasons: ${result.reasons.join(', ')}`);
  // STOP — không thử thêm
}

// ❌ SAI - loop login không giới hạn
while (!loggedIn) { await login(...); } // KHÔNG BAO GIỜ LÀM THẾ NÀY
```

### Run a Single Session

```bash
npm run start
```

Starts one interactive session with random mood and actions.

### Run Full Daily Schedule

```bash
npx tsx scripts/fb_orchestrator.ts run
```

Runs 2-6 sessions throughout the day with sleep hours and breaks.

## Commands

| Command | Description |
|---------|-------------|
| `npm run login` | Login and save session cookies |
| `npm run start` | Single interactive session |
| `npm run post` | Create a post |
| `npm run comment` | Browse feed and comment |
| `npm run feed` | Browse feed only |
| `npx tsx scripts/fb_orchestrator.ts session` | Start one session |
| `npx tsx scripts/fb_orchestrator.ts run` | Run full daily schedule |

## HumanMode Features

### Typing Engine
- **Natural rhythm**: 50-150ms per character
- **Word pauses**: 200-400ms between words
- **Typo injection**: 8-15% of long words get realistic typos
- **Typo correction**: Pause, backspace, retype (simulates human error recovery)
- **Final text always correct**: Ensures comments are properly spelled

### Mouse Movement
- **Bézier curves**: Smooth, non-linear mouse paths
- **Speed variation**: Slow start, faster middle, slow end
- **Occasional overshoot**: 15% chance to overshoot and correct
- **Distance-aware**: Movement time scales with distance (200-500ms)

### Scrolling
- **Variable speed**: Not constant; resembles human reading
- **Pauses**: Random dwell times at 10-20% of scrolls
- **Reverse scrolling**: 5% chance to scroll back up
- **Reading mode**: Slow scrolls with pauses (simulates actually reading)

### Behavioral Distractions
- **Random clicks**: 15% chance to get "distracted" by random posts
- **Image viewing**: 20% chance to open and view images
- **Profile peeking**: 10% chance to check someone's profile briefly
- **Natural delays**: Each distraction simulates real attention

### Session Mood System

Four mood types determine activity level:

- **active** (20% chance): 8-10 interactions per session
- **moderate** (40% chance): 4-6 interactions per session
- **quiet** (30% chance): 1-3 interactions per session
- **lurk** (10% chance): 0 interactions (just scrolling)

## Configuration

### default.json

Main configuration file with timing, behavior, and browser settings:

```json
{
  "timing": {
    "charDelay": [50, 150],      // ms per character
    "wordDelay": [200, 400],     // ms per word
    "thinkDelay": [3000, 5000],  // ms before commenting
    "sessionLength": [900000, 2700000]  // 15-45 minutes
  },
  "behavior": {
    "typoRate": 0.12,            // 12% of words get typos
    "distractionRate": 0.15,     // 15% chance to distract
    "commentRate": 0.20,         // 20% chance to comment on post
    "sleepHours": [22, 7]        // No activity 22:00-07:00
  }
}
```

### anti-detect.json

Detection avoidance rules:

```json
{
  "rules": {
    "maxCommentsPerHour": 5,
    "maxReactsPerHour": 15,
    "maxSessionsPerDay": 6,
    "neverCommentSameContentTwice": true,
    "varyTypingSpeed": true,
    "randomizeViewport": true
  }
}
```

## API Reference

### Core Functions

#### fb_core.ts
- `initBrowser(config)` - Launch browser with realistic viewport
- `login(page, email, password)` - Human-like login with 2FA support
- `loadCookies(page, path)` - Load saved session
- `saveCookies(page, path)` - Save browser cookies

#### humanmode.ts
- `humanClick(page, selector)` - Click with natural mouse movement
- `humanType(page, selector, text)` - Type with typos and corrections
- `humanScroll(page, options)` - Scroll with variable speed
- `readingScroll(page, times)` - Slow scroll (simulates reading)
- `maybeDistraction(page, probability)` - Random distraction event
- `humanPause(action)` - Semantic delay (think/read/between_comments)

#### fb_feed.ts
- `browseFeed(page, config)` - Browse feed with random interactions
- `reactToPost(page, postEl)` - Like/react to post
- `getVisiblePosts(page)` - Get current visible posts

#### fb_comment.ts
- `readPostContent(page, postEl)` - Extract post data
- `readCommentThread(page)` - Read all comments
- `generateReply(context, ollamaUrl, model)` - AI-powered reply generation
- `postComment(page, text)` - Post comment with human delays
- `replyToComment(page, commentEl, text)` - Reply to specific comment

#### fb_post.ts
- `createPost(page, options)` - Create text/media post
- `createPagePost(page, pageUrl, options)` - Post to Facebook Page

#### fb_media.ts
- `uploadMedia(page, filePaths)` - Upload images/videos
- `uploadToComposer(page, filePaths)` - Upload to post composer

#### fb_notification.ts
- `checkNotifications(page)` - Get unread notifications
- `respondToNotification(page, notif)` - Reply to notification

#### fb_messenger.ts
- `checkMessages(page)` - Get unread messages
- `sendMessage(page, threadId, text)` - Send text message
- `sendMediaMessage(page, threadId, filePath)` - Send media message
- `respondToUnreadMessages(page, text)` - Reply to all unread

#### fb_orchestrator.ts
- `startSession(config)` - Run single session
- `runSchedule(config)` - Run full daily schedule

## AI Integration

Requires local Ollama for comment generation:

```bash
# Install Ollama from https://ollama.ai
ollama pull black-hermes-heretic:36b-q5km
ollama serve
```

Model can be changed in `config/default.json`:

```json
{
  "ai": {
    "ollamaUrl": "http://localhost:11434",
    "model": "black-hermes-heretic:36b-q5km",
    "systemPrompt": "Custom persona..."
  }
}
```

## File Support

Supported media types:
- **Images**: jpg, png, gif, webp
- **Videos**: mp4, mov, avi, webm

Upload methods:
1. `setInputFiles()` - Direct DOM injection (preferred)
2. `fileChooser` event - OS file dialog interception (fallback)

## Architecture

### Module Breakdown

- **humanmode.ts** (400 lines): Core engine for human-like behavior
- **fb_core.ts** (250 lines): Browser initialization and login
- **fb_comment.ts** (300 lines): Comment/reply with AI
- **fb_post.ts** (200 lines): Post creation
- **fb_media.ts** (150 lines): Media upload
- **fb_feed.ts** (200 lines): Feed browsing and reactions
- **fb_notification.ts** (150 lines): Notification handling
- **fb_messenger.ts** (200 lines): Message management
- **fb_orchestrator.ts** (300 lines): Session scheduling

### Key Design Patterns

- **Config-driven**: All timings from config files
- **Error handling**: Try/catch on all browser interactions
- **Fallback selectors**: Multiple selector options for Facebook UI
- **Human delays**: Every action has semantic pauses
- **State preservation**: Cookies saved between sessions

## Anti-Detection

Implements multiple anti-detection techniques:

1. **Realistic viewport** (1366x768 ±50px randomization)
2. **Legitimate user agent** (Chrome/Windows)
3. **Bézier mouse movement** (non-linear, natural paths)
4. **Typing delays** (variable, with typos)
5. **Session scheduling** (realistic sleep hours)
6. **Activity limits** (max comments/reacts per hour)
7. **Content tracking** (don't comment same thing twice)
8. **Browser fingerprinting** (randomized, consistent)

## Logging

All actions logged with timestamps and emojis:

```
✓ Browser initialized (1366x768)
🔐 Navigating to login page...
✍️  Typing email...
👍 Reacted to post (1/5)
💬 Commented (2/5)
⏳ Waiting for page load...
✓ Session complete (23 minutes)
```

## Troubleshooting

### Login Issues
- Ensure `FB_EMAIL` and `FB_PASS` are set
- Facebook may require 2FA - approve on your device
- Cookies auto-save after successful login

### No Ollama Response
- Make sure Ollama is running: `ollama serve`
- Check model exists: `ollama list`
- Fallback responses provided if Ollama unavailable

### Selectors Not Found
- Facebook UI changes frequently
- Multiple fallback selectors for each element
- Check console logs for which selectors failed
- Update selectors in relevant module if needed

### Comments Not Posting
- Check if logged in: `npm run login`
- Verify comment box is visible
- Ensure text box is focused before typing
- Check for Facebook rate limiting

## Performance

Typical session:
- **Duration**: 15-45 minutes per session
- **Interactions**: 1-10 depending on mood
- **CPU**: ~30-50% (browser automation)
- **Memory**: ~300-400MB (Chromium process)
- **Network**: ~2-5MB per session

## Security Notes

⚠️ **IMPORTANT**:
- Store credentials in environment variables only
- Never hardcode FB_EMAIL or FB_PASS
- Cookies stored locally (./data/cookies/session.json)
- Use on accounts you own/control
- Respect Facebook's Terms of Service
- Use responsibly for legitimate automation

## Development

### Build
```bash
npm run tsc
```

### Linting
```bash
npx tsc --noEmit
```

### Adding Custom Actions

Edit `fb_orchestrator.ts` `executeAction()` function:

```typescript
case 'custom_action':
  console.log('🎯 Custom action');
  await myCustomFunction(page);
  break;
```

## License

Built for the Nacharium ecosystem. Research and educational use only.

## Support

For issues, check:
1. Logs for error messages
2. Selector fallbacks in relevant modules
3. Facebook UI may have changed (update selectors)
4. Ollama availability for comment generation
