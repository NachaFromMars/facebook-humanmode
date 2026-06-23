import { Page, ElementHandle } from 'playwright';
import { humanType, humanClick, humanPause, randomDelay } from './humanmode.js';

/**
 * Post content extracted from Facebook post
 */
export interface PostContent {
  author: string;
  text: string;
  images: string[];
  timestamp: string;
  reactionsCount: number;
  commentsCount: number;
  sharesCount: number;
  existingComments: Comment[];
}

/**
 * Comment data structure
 */
export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
  likes: number;
  replies?: Comment[];
}

/**
 * Context for AI reply generation
 */
export interface CommentContext {
  postAuthor: string;
  postText: string;
  postImages: string[];
  threadComments: Comment[];
  parentComment?: Comment;
  targetComment: Comment;
}

/**
 * Read post content from a post element
 */
export async function readPostContent(page: Page, postElement: ElementHandle): Promise<PostContent> {
  try {
    // Extract post author
    const authorSelectors = ['a[data-testid="post_commenter"]', 'a[aria-label*="profile"]', 'a[href*="/profile"]'];
    let author = 'Unknown';

    for (const selector of authorSelectors) {
      try {
        const el = await postElement.$(selector);
        if (el) {
          author = await el.textContent() || 'Unknown';
          break;
        }
      } catch {
        continue;
      }
    }

    // Extract post text
    const textSelectors = ['[data-testid="post_message"]', '[data-testid="post"] div[dir="auto"]', '[role="article"] div[dir="auto"]'];
    let text = '';

    for (const selector of textSelectors) {
      try {
        const el = await postElement.$(selector);
        if (el) {
          text = await el.textContent() || '';
          if (text) break;
        }
      } catch {
        continue;
      }
    }

    // Extract images
    const images: string[] = [];
    const imgElements = await postElement.$$('img[src]');
    for (const img of imgElements) {
      try {
        const src = await img.getAttribute('src');
        if (src && (src.includes('cdninstagram') || src.includes('fbcdn'))) {
          images.push(src);
        }
      } catch {
        continue;
      }
    }

    // Extract timestamp
    let timestamp = 'Recently';
    try {
      const timeEl = await postElement.$('time');
      if (timeEl) {
        timestamp = await timeEl.textContent() || 'Recently';
      }
    } catch {
      // Use default
    }

    // Extract reaction counts
    let reactionsCount = 0;
    const reactionsText = await postElement.$eval('[data-testid="post_reaction_count"]', (el) => el.textContent).catch(() => '0');
    reactionsCount = parseInt(reactionsText.replace(/\D/g, '') || '0');

    // Extract comments count
    let commentsCount = 0;
    const commentsText = await postElement.$eval('[data-testid="post_comment_count"]', (el) => el.textContent).catch(() => '0');
    commentsCount = parseInt(commentsText.replace(/\D/g, '') || '0');

    // Extract shares count
    let sharesCount = 0;
    const sharesText = await postElement.$eval('[data-testid="post_share_count"]', (el) => el.textContent).catch(() => '0');
    sharesCount = parseInt(sharesText.replace(/\D/g, '') || '0');

    // Read existing comments
    const existingComments = await readCommentThread(page);

    return {
      author,
      text,
      images,
      timestamp,
      reactionsCount,
      commentsCount,
      sharesCount,
      existingComments,
    };
  } catch (error) {
    console.error('❌ Failed to read post content:', error);
    return {
      author: 'Unknown',
      text: '',
      images: [],
      timestamp: 'Recently',
      reactionsCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      existingComments: [],
    };
  }
}

/**
 * Read all comments in current thread
 */
export async function readCommentThread(page: Page): Promise<Comment[]> {
  const comments: Comment[] = [];

  try {
    // Find all comment elements
    const commentSelectors = [
      '[data-testid="comment"]',
      '[role="article"] > div > div:has-text("ago")',
      '.x1iyjqo2',
    ];

    let commentElements: ElementHandle[] = [];
    for (const selector of commentSelectors) {
      try {
        commentElements = await page.$$(selector);
        if (commentElements.length > 0) break;
      } catch {
        continue;
      }
    }

    // Process each comment
    for (const commentEl of commentElements.slice(0, 10)) {
      try {
        const author = await commentEl.$eval('a', (el) => el.textContent).catch(() => 'Unknown');
        const text = await commentEl.$eval('[dir="auto"]', (el) => el.textContent).catch(() => '');
        const timestamp = await commentEl.$eval('time', (el) => el.textContent).catch(() => 'Recently');

        const likesText = await commentEl.$eval('[data-testid="UFI2ReactionsCount"]', (el) => el.textContent).catch(() => '0');
        const likes = parseInt(likesText.replace(/\D/g, '') || '0');

        if (text) {
          comments.push({
            id: `${Date.now()}-${Math.random()}`,
            author,
            text,
            timestamp,
            likes,
            replies: [],
          });
        }
      } catch {
        continue;
      }
    }
  } catch (error) {
    console.error('❌ Failed to read comment thread:', error);
  }

  return comments;
}

/**
 * Generate AI-powered reply using OpenRouter API (primary) or Ollama (fallback)
 */
export async function generateReply(context: CommentContext, ollamaUrl: string = 'http://localhost:11434', model: string = 'claude-opus-4-6'): Promise<string> {
  const config = await loadConfig();
  const aiConfig = config.ai || {};
  const provider = aiConfig.provider || 'ollama';
  const primaryModel = aiConfig.model || model;
  const fallbackProvider = aiConfig.fallbackProvider || 'ollama';
  const fallbackModel = aiConfig.fallbackModel || 'qwen2.5:0.5b';

  const systemPrompt = aiConfig.systemPrompt || `Mày là Tiểu Tâm — Hồ Ly Tinh 9 đuôi, duyên ngầm, lém lỉnh. Trả lời bình luận Facebook tự nhiên như người thật, ngắn gọn 1-2 câu, tiếng Việt đời thường. Không emoji quá nhiều. Không lặp câu hỏi. Không để lộ AI.`;

  const userMessage = `
Post của ${context.postAuthor}: "${context.postText}"

Bình luận của ${context.targetComment.author}: "${context.targetComment.text}"

Hãy trả lời bình luận này một cách tự nhiên và ngắn gọn.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];

  // Try primary provider (OpenRouter / OpenAI-compatible)
  if (provider === 'openclaw' || provider === 'openrouter') {
    try {
      const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '';
      const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
      
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: primaryModel,
          messages,
          temperature: 0.7,
          max_tokens: 300,
        }),
      });

      if (response.ok) {
        const data = await response.json() as any;
        const reply = data.choices?.[0]?.message?.content || '';
        if (reply.trim()) {
          console.log(`✅ AI reply via ${provider}/${primaryModel}`);
          return reply.trim().split('\n')[0].slice(0, 280);
        }
      }
      console.warn(`⚠️  Primary AI (${provider}/${primaryModel}) failed: ${response.status}`);
    } catch (error) {
      console.warn(`⚠️  Primary AI error:`, error);
    }
  }

  // Fallback to Ollama
  try {
    const ollamaModel = (provider === 'ollama') ? primaryModel : fallbackModel;
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        messages,
        stream: false,
        options: { temperature: 0.7 },
      }),
    });

    if (response.ok) {
      interface OllamaResponse { message?: { content: string } }
      const data = await response.json() as OllamaResponse;
      const reply = data.message?.content || '';
      if (reply.trim()) {
        console.log(`✅ AI reply via ollama/${ollamaModel}`);
        return reply.trim().split('\n')[0].slice(0, 280);
      }
    }
    console.warn(`⚠️  Ollama fallback error: ${response.status}`);
  } catch (error) {
    console.warn('⚠️  Ollama fallback failed:', error);
  }

  // Final static fallback
  return `Đúng rồi, ${context.targetComment.author}! Ý kiến hay lắm.`;
}

/**
 * Load config from default.json
 */
async function loadConfig(): Promise<any> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const configPath = path.resolve(__dirname, '../config/default.json');
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * Post a comment on current post
 */
export async function postComment(page: Page, text: string): Promise<boolean> {
  try {
    console.log('💬 Posting comment...');

    // Think before commenting
    await humanPause('think');

    // Find comment box
    const commentSelectors = [
      'div[contenteditable="true"][aria-label*="comment"]',
      'div[contenteditable="true"][role="textbox"]',
      '[data-testid="post_comment_text"]',
      'textarea[aria-label*="Write"]',
      'div[aria-label*="What are you thinking"]',
    ];

    let found = false;
    let foundSelector = '';
    for (const selector of commentSelectors) {
      try {
        const el = await page.$(selector);
        if (el) {
          await humanClick(page, selector);
          found = true;
          foundSelector = selector;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!found) {
      console.error('❌ Could not find comment box');
      return false;
    }

    await randomDelay(500, 1500);

    // Type comment
    await humanType(page, foundSelector, text);

    await randomDelay(500, 1500);

    // Submit comment
    const submitSelectors = [
      'button[aria-label="Post"]',
      'button:has-text("Post")',
      'button[data-testid="post_comment_post_button"]',
      'button[name="post"]',
    ];

    for (const selector of submitSelectors) {
      try {
        const btn = await page.$(selector);
        if (btn) {
          await page.click(selector);
          await randomDelay(1000, 2000);
          found = true;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!found) {
      // Try pressing Enter
      await page.keyboard.press('Enter');
      await randomDelay(1000, 2000);
    }

    // Random delay between comments
    await humanPause('between_comments');

    console.log('✓ Comment posted');
    return true;
  } catch (error) {
    console.error('❌ Failed to post comment:', error);
    return false;
  }
}

/**
 * Reply to a specific comment
 */
export async function replyToComment(page: Page, commentEl: ElementHandle, text: string): Promise<boolean> {
  try {
    console.log('↩️  Replying to comment...');

    // Click reply button
    const replySelectors = [
      'button[aria-label="Reply"]',
      'button:has-text("Reply")',
      'a[aria-label="Reply"]',
    ];

    let found = false;
    for (const selector of replySelectors) {
      try {
        const btn = await commentEl.$(selector);
        if (btn) {
          await btn.click();
          found = true;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!found) {
      console.error('❌ Could not find reply button');
      return false;
    }

    await humanPause('think');

    // Find reply text box (usually appears after clicking reply)
    const replyBoxSelectors = [
      'div[contenteditable="true"][aria-label*="reply"]',
      'textarea[aria-label*="reply"]',
    ];

    found = false;
    for (const selector of replyBoxSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        await humanType(page, selector, text);
        found = true;
        break;
      } catch {
        continue;
      }
    }

    if (!found) {
      console.error('❌ Could not find reply text box');
      return false;
    }

    await randomDelay(500, 1500);

    // Submit reply
    await page.keyboard.press('Enter');
    await randomDelay(1000, 2000);

    console.log('✓ Reply posted');
    return true;
  } catch (error) {
    console.error('❌ Failed to reply to comment:', error);
    return false;
  }
}
