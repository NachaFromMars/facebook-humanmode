import { Page, ElementHandle } from 'playwright';
import { humanClick, humanType, randomDelay, humanPause } from './humanmode.js';
import { uploadMedia } from './fb_media.js';

/**
 * Message data structure
 */
export interface Message {
  id: string;
  from: string;
  text: string;
  timestamp: string;
  isRead: boolean;
}

/**
 * Check unread messages
 */
export async function checkMessages(page: Page): Promise<Message[]> {
  try {
    console.log('💬 Checking messages...');

    // Navigate to messenger or check sidebar
    const messengerUrl = 'https://www.facebook.com/messages';
    await page.goto(messengerUrl, { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 4000);

    // Get unread messages
    const messages = await getUnreadMessages(page);
    console.log(`✓ Found ${messages.length} unread message(s)`);

    return messages;
  } catch (error) {
    console.error('❌ Error checking messages:', error);
    return [];
  }
}

/**
 * Get unread messages from sidebar
 */
async function getUnreadMessages(page: Page): Promise<Message[]> {
  const messages: Message[] = [];

  try {
    // Find message items (unread ones typically have special styling)
    const itemSelectors = [
      '[data-testid="messageListItem"]',
      '[data-testid="message_list_item"]',
      '[role="button"][data-testid*="thread"]',
      'div[data-testid*="thread_list"]',
    ];

    let items: ElementHandle[] = [];
    for (const selector of itemSelectors) {
      try {
        items = await page.$$(selector);
        if (items.length > 0) break;
      } catch {
        continue;
      }
    }

    // Process unread items
    for (const item of items) {
      try {
        // Check if unread (usually has data-testid or class indicating unread)
        const classAttr = await item.getAttribute('class');
        const isUnread = classAttr && classAttr.includes('unread');

        if (!isUnread) continue;

        // Extract sender
        const senderText = await item.$eval('span', (el) => el.textContent).catch(() => 'Unknown');

        // Extract preview text
        const previewText = await item.$eval('div[dir="auto"]', (el) => el.textContent).catch(() => '');

        const message: Message = {
          id: `${Date.now()}-${Math.random()}`,
          from: senderText,
          text: previewText,
          timestamp: new Date().toISOString(),
          isRead: false,
        };

        messages.push(message);
      } catch {
        continue;
      }
    }
  } catch (error) {
    console.error('❌ Error getting unread messages:', error);
  }

  return messages;
}

/**
 * Read a conversation thread
 */
export async function readConversation(page: Page, threadId: string): Promise<Message[]> {
  try {
    console.log(`📖 Reading conversation: ${threadId}`);

    // Navigate to conversation
    await page.goto(`https://www.facebook.com/messages/t/${threadId}`, { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 4000);

    // Read messages in thread
    const messages = await parseConversationMessages(page);
    console.log(`✓ Read ${messages.length} message(s) from conversation`);

    return messages;
  } catch (error) {
    console.error('❌ Error reading conversation:', error);
    return [];
  }
}

/**
 * Parse messages from conversation
 */
async function parseConversationMessages(page: Page): Promise<Message[]> {
  const messages: Message[] = [];

  try {
    // Find message bubbles
    const bubbleSelectors = [
      '[data-testid="message"]',
      '[data-testid="messageListItem"]',
      'div[data-testid*="bubble"]',
      'div[data-testid="message_container"]',
    ];

    let bubbles: ElementHandle[] = [];
    for (const selector of bubbleSelectors) {
      try {
        bubbles = await page.$$(selector);
        if (bubbles.length > 0) break;
      } catch {
        continue;
      }
    }

    // Process bubbles (get last 10)
    for (const bubble of bubbles.slice(-10)) {
      try {
        const text = await bubble.textContent() || '';
        const timestamp = new Date().toISOString();

        // Determine if sent by us or them (simple heuristic: position/alignment)
        const classAttr = await bubble.getAttribute('class');
        const isSentByMe = classAttr && (classAttr.includes('me') || classAttr.includes('sent'));

        if (text) {
          const message: Message = {
            id: `${Date.now()}-${Math.random()}`,
            from: isSentByMe ? 'Me' : 'Them',
            text,
            timestamp,
            isRead: true,
          };

          messages.push(message);
        }
      } catch {
        continue;
      }
    }
  } catch (error) {
    console.error('❌ Error parsing conversation messages:', error);
  }

  return messages;
}

/**
 * Send a text message
 */
export async function sendMessage(page: Page, threadId: string, text: string): Promise<boolean> {
  try {
    console.log(`📤 Sending message to ${threadId}...`);

    // Navigate to conversation if not already there
    const currentUrl = page.url();
    if (!currentUrl.includes(threadId)) {
      await page.goto(`https://www.facebook.com/messages/t/${threadId}`, { waitUntil: 'domcontentloaded' });
      await randomDelay(2000, 4000);
    }

    // Think before typing
    await humanPause('think');

    // Find message input box
    const inputSelectors = [
      'textarea[aria-label*="message"]',
      'textarea[aria-label*="Aa"]',
      'div[contenteditable="true"][aria-label*="message"]',
      'div[contenteditable="true"][role="textbox"]',
      'input[aria-label*="message"]',
    ];

    let found = false;
    for (const selector of inputSelectors) {
      try {
        const el = await page.$(selector);
        if (el) {
          await humanClick(page, selector);
          found = true;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!found) {
      console.error('❌ Could not find message input');
      return false;
    }

    await randomDelay(500, 1500);

    // Type message
    await humanType(page, inputSelectors[0], text);
    await randomDelay(500, 1500);

    // Send message (Enter key or Send button)
    const sendSelectors = [
      'button[aria-label="Send"]',
      'button[data-testid="send_button"]',
      'button:has-text("Send")',
    ];

    let sent = false;
    for (const selector of sendSelectors) {
      try {
        const btn = await page.$(selector);
        if (btn) {
          await btn.click();
          sent = true;
          break;
        }
      } catch {
        continue;
      }
    }

    // Fallback: press Enter
    if (!sent) {
      await page.keyboard.press('Enter');
    }

    await randomDelay(1000, 2000);

    console.log('✓ Message sent');
    return true;
  } catch (error) {
    console.error('❌ Error sending message:', error);
    return false;
  }
}

/**
 * Send a message with media (image/video)
 */
export async function sendMediaMessage(page: Page, threadId: string, filePath: string): Promise<boolean> {
  try {
    console.log(`📤 Sending media message to ${threadId}...`);

    // Navigate to conversation
    const currentUrl = page.url();
    if (!currentUrl.includes(threadId)) {
      await page.goto(`https://www.facebook.com/messages/t/${threadId}`, { waitUntil: 'domcontentloaded' });
      await randomDelay(2000, 4000);
    }

    // Find and click media button
    const mediaButtonSelectors = [
      'button[aria-label*="Photo"]',
      'button[aria-label*="Image"]',
      'button[data-testid="messenger_composer_image_button"]',
      'div[aria-label*="Upload"]',
    ];

    let found = false;
    for (const selector of mediaButtonSelectors) {
      try {
        const btn = await page.$(selector);
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
      console.warn('⚠️  Could not find media button');
      return false;
    }

    await randomDelay(500, 1500);

    // Upload media
    const uploaded = await uploadMedia(page, [filePath]);
    if (!uploaded) {
      console.error('❌ Failed to upload media');
      return false;
    }

    // Send
    await randomDelay(1000, 2000);

    const sendSelectors = [
      'button[aria-label="Send"]',
      'button[data-testid="send_button"]',
      'button:has-text("Send")',
    ];

    for (const selector of sendSelectors) {
      try {
        const btn = await page.$(selector);
        if (btn) {
          await btn.click();
          await randomDelay(1000, 2000);
          console.log('✓ Media message sent');
          return true;
        }
      } catch {
        continue;
      }
    }

    // Try Enter key
    await page.keyboard.press('Enter');
    await randomDelay(1000, 2000);

    console.log('✓ Media message sent');
    return true;
  } catch (error) {
    console.error('❌ Error sending media message:', error);
    return false;
  }
}

/**
 * Reply to a message
 */
export async function replyToMessage(page: Page, threadId: string, replyText: string): Promise<boolean> {
  try {
    console.log(`↩️  Replying to message...`);

    // Ensure we're in the conversation
    const currentUrl = page.url();
    if (!currentUrl.includes(threadId)) {
      await page.goto(`https://www.facebook.com/messages/t/${threadId}`, { waitUntil: 'domcontentloaded' });
      await randomDelay(2000, 4000);
    }

    // Read messages first
    const messages = await parseConversationMessages(page);
    if (messages.length === 0) {
      console.warn('⚠️  No messages to reply to');
      return false;
    }

    // Think before replying
    await humanPause('think');

    // Send reply as regular message
    return await sendMessage(page, threadId, replyText);
  } catch (error) {
    console.error('❌ Error replying to message:', error);
    return false;
  }
}

/**
 * Get conversation list
 */
export async function getConversationList(page: Page): Promise<Array<{ id: string; name: string; unread: boolean }>> {
  try {
    const conversations: Array<{ id: string; name: string; unread: boolean }> = [];

    // Navigate to messages
    await page.goto('https://www.facebook.com/messages', { waitUntil: 'domcontentloaded' });
    await randomDelay(1000, 2000);

    // Find conversation items
    const itemSelectors = [
      '[data-testid="messageListItem"]',
      '[data-testid="thread_list_item"]',
      'div[role="button"][data-testid*="thread"]',
    ];

    let items: ElementHandle[] = [];
    for (const selector of itemSelectors) {
      try {
        items = await page.$$(selector);
        if (items.length > 0) break;
      } catch {
        continue;
      }
    }

    // Parse items
    for (const item of items.slice(0, 10)) {
      try {
        const name = await item.$eval('span', (el) => el.textContent).catch(() => 'Unknown');
        const href = await item.getAttribute('href').catch(() => '');

        // Extract thread ID from href
        const threadMatch = href?.match(/\/t\/(\d+)/);
        const threadId = threadMatch ? threadMatch[1] : '';

        const classAttr = await item.getAttribute('class');
        const unread = classAttr && classAttr.includes('unread');

        if (threadId && name) {
          conversations.push({
            id: threadId,
            name,
            unread: !!unread,
          });
        }
      } catch {
        continue;
      }
    }

    return conversations;
  } catch (error) {
    console.error('❌ Error getting conversation list:', error);
    return [];
  }
}

/**
 * Respond to all unread messages
 */
export async function respondToUnreadMessages(page: Page, responseText: string = 'Thanks for the message!'): Promise<number> {
  try {
    console.log('📬 Responding to all unread messages...');

    const conversations = await getConversationList(page);
    const unreadConversations = conversations.filter(c => c.unread);

    let count = 0;
    for (const conv of unreadConversations) {
      try {
        await randomDelay(5000, 10000);
        const sent = await sendMessage(page, conv.id, responseText);
        if (sent) {
          count++;
          console.log(`✓ Responded to message from ${conv.name}`);
        }
      } catch {
        continue;
      }
    }

    console.log(`✓ Responded to ${count} unread message(s)`);
    return count;
  } catch (error) {
    console.error('❌ Error responding to unread messages:', error);
    return 0;
  }
}
