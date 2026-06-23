import { Page, ElementHandle } from 'playwright';
import { humanClick, randomDelay, humanPause } from './humanmode.js';
import { generateReply, postComment, readCommentThread } from './fb_comment.js';
import { Config } from './fb_core.js';

/**
 * Notification data structure
 */
export interface Notification {
  id: string;
  type: 'comment_reply' | 'mention' | 'reaction' | 'friend_request' | 'message' | 'page' | 'other';
  title: string;
  description: string;
  timestamp: string;
  url?: string;
  isRead: boolean;
}

/**
 * Check notifications
 */
export async function checkNotifications(page: Page): Promise<Notification[]> {
  try {
    console.log('🔔 Checking notifications...');

    // Click notification bell icon
    const bellSelectors = [
      'button[aria-label*="notification"]',
      'button[aria-label="Notifications"]',
      'a[aria-label*="notification"]',
      'div[aria-label*="Notification"]',
    ];

    let found = false;
    for (const selector of bellSelectors) {
      try {
        const btn = await page.$(selector);
        if (btn) {
          await humanClick(page, selector);
          found = true;
          console.log('✓ Notifications opened');
          break;
        }
      } catch {
        continue;
      }
    }

    if (!found) {
      console.warn('⚠️  Could not find notification bell');
      return [];
    }

    await randomDelay(1000, 2000);

    // Wait for notification dropdown
    try {
      await page.waitForSelector('[role="menu"]', { timeout: 5000 }).catch(() => {});
    } catch {
      // Menu may not appear
    }

    // Parse notification items
    const notificationItems = await parseNotifications(page);
    console.log(`✓ Found ${notificationItems.length} notifications`);

    // Close notification panel
    await page.keyboard.press('Escape').catch(() => {});
    await randomDelay(500, 1000);

    return notificationItems;
  } catch (error) {
    console.error('❌ Error checking notifications:', error);
    return [];
  }
}

/**
 * Parse notification items from dropdown
 */
async function parseNotifications(page: Page): Promise<Notification[]> {
  const notifications: Notification[] = [];

  try {
    // Find notification list items
    const itemSelectors = [
      '[data-testid="notif_item"]',
      '[role="menuitem"]',
      'a[data-testid*="notification"]',
      'div[data-testid*="notification_item"]',
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

    for (const item of items.slice(0, 10)) {
      try {
        // Extract notification info
        const title = await item.$eval('span', (el) => el.textContent).catch(() => '');
        const description = await item.$eval('div[dir="auto"]', (el) => el.textContent).catch(() => '');
        const url = await item.getAttribute('href').catch(() => undefined);
        const isRead = !((await item.getAttribute('class')) ?? '').includes('unread');

        // Determine notification type
        let type: Notification['type'] = 'other';
        if (title.includes('commented') || description.includes('commented')) {
          type = 'comment_reply';
        } else if (title.includes('liked') || description.includes('reacted')) {
          type = 'reaction';
        } else if (title.includes('mentioned') || description.includes('mentioned you')) {
          type = 'mention';
        } else if (title.includes('friend') || description.includes('friend')) {
          type = 'friend_request';
        } else if (title.includes('message') || description.includes('sent')) {
          type = 'message';
        } else if (title.includes('page') || title.includes('Page')) {
          type = 'page';
        }

        const notification: Notification = {
          id: `${Date.now()}-${Math.random()}`,
          type,
          title,
          description,
          timestamp: new Date().toISOString(),
          url: url ?? undefined,
          isRead,
        };

        notifications.push(notification);
      } catch {
        continue;
      }
    }
  } catch (error) {
    console.error('❌ Error parsing notifications:', error);
  }

  return notifications;
}

/**
 * Respond to a notification (click and interact)
 */
export async function respondToNotification(page: Page, config: Config, notif: Notification): Promise<void> {
  try {
    console.log(`📍 Responding to notification: ${notif.title}`);

    // Navigate to notification context
    if (notif.url) {
      console.log(`🔗 Navigating to: ${notif.url}`);
      await page.goto(notif.url, { waitUntil: 'domcontentloaded' });
      await randomDelay(2000, 4000);
    }

    // Handle based on type
    switch (notif.type) {
      case 'comment_reply':
        console.log('↩️  Handling comment reply notification');
        await respondToCommentReply(page, config);
        break;

      case 'reaction':
        console.log('😊 Handling reaction notification');
        await respondToReaction(page);
        break;

      case 'mention':
        console.log('@️ Handling mention notification');
        await respondToMention(page, config);
        break;

      case 'friend_request':
        console.log('👥 Handling friend request notification');
        await respondToFriendRequest(page);
        break;

      case 'message':
        console.log('💬 Handling message notification');
        await respondToMessage(page);
        break;

      default:
        console.log('❓ Ignoring other notification type');
    }

    // Navigate back to feed
    await randomDelay(1000, 2000);
  } catch (error) {
    console.error('❌ Error responding to notification:', error);
  }
}

/**
 * Handle comment reply notification
 */
async function respondToCommentReply(page: Page, config: Config): Promise<void> {
  try {
    await humanPause('read');

    // Read existing comments
    const comments = await readCommentThread(page);
    if (comments.length > 0) {
      // Get the latest comment (most likely the one we're replying to)
      const targetComment = comments[comments.length - 1];

      // Generate reply
      const reply = await generateReply(
        {
          postAuthor: 'Unknown',
          postText: '',
          postImages: [],
          threadComments: comments,
          targetComment,
        },
        config.ai.ollamaUrl,
        config.ai.model
      );

      // Post reply
      await postComment(page, reply);
    }
  } catch (error) {
    console.warn('⚠️  Error responding to comment:', error);
  }
}

/**
 * Handle reaction notification
 */
async function respondToReaction(page: Page): Promise<void> {
  try {
    console.log('👍 Someone reacted to your post');
    await humanPause('read');
    // Usually just acknowledge reactions, don't need to do anything
  } catch (error) {
    console.warn('⚠️  Error handling reaction:', error);
  }
}

/**
 * Handle mention notification
 */
async function respondToMention(page: Page, config: Config): Promise<void> {
  try {
    console.log('@️  You were mentioned');
    await humanPause('read');

    // Read the post/comment where mentioned
    const comments = await readCommentThread(page);
    if (comments.length > 0) {
      const targetComment = comments[0];
      const reply = await generateReply(
        {
          postAuthor: 'Unknown',
          postText: '',
          postImages: [],
          threadComments: comments,
          targetComment,
        },
        config.ai.ollamaUrl,
        config.ai.model
      );

      await postComment(page, reply);
    }
  } catch (error) {
    console.warn('⚠️  Error handling mention:', error);
  }
}

/**
 * Handle friend request notification
 */
async function respondToFriendRequest(page: Page): Promise<void> {
  try {
    console.log('👥 Friend request received');
    await humanPause('think');

    // Maybe accept (30% chance)
    if (Math.random() < 0.3) {
      const acceptSelectors = [
        'button[aria-label="Confirm"]',
        'button:has-text("Confirm")',
        'button[name="confirm"]',
      ];

      for (const selector of acceptSelectors) {
        try {
          const btn = await page.$(selector);
          if (btn) {
            await btn.click();
            console.log('✓ Friend request accepted');
            await randomDelay(500, 1000);
            return;
          }
        } catch {
          continue;
        }
      }
    } else {
      // Decline (70% chance)
      const declineSelectors = [
        'button[aria-label="Delete"]',
        'button:has-text("Delete")',
        'button[name="delete"]',
      ];

      for (const selector of declineSelectors) {
        try {
          const btn = await page.$(selector);
          if (btn) {
            await btn.click();
            console.log('✓ Friend request declined');
            await randomDelay(500, 1000);
            return;
          }
        } catch {
          continue;
        }
      }
    }
  } catch (error) {
    console.warn('⚠️  Error handling friend request:', error);
  }
}

/**
 * Handle message notification
 */
async function respondToMessage(page: Page): Promise<void> {
  try {
    console.log('💬 Message received');
    await humanPause('read');
    // Messenger handling delegated to fb_messenger.ts
  } catch (error) {
    console.warn('⚠️  Error handling message:', error);
  }
}

/**
 * Get unread notification count
 */
export async function getNotificationCount(page: Page): Promise<number> {
  try {
    const badge = await page.$('[data-testid="notification_icon"] span');
    if (badge) {
      const text = await badge.textContent();
      return parseInt(text || '0');
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Mark all notifications as read
 */
export async function markNotificationsAsRead(page: Page): Promise<void> {
  try {
    console.log('✓ Marking notifications as read');

    const itemSelectors = [
      '[data-testid="notif_item"]:not(.read)',
      '[role="menuitem"]:not(.read)',
    ];

    for (const selector of itemSelectors) {
      try {
        const items = await page.$$(selector);
        for (const item of items) {
          try {
            await item.click();
            await randomDelay(200, 500);
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }
  } catch (error) {
    console.warn('⚠️  Error marking notifications as read:', error);
  }
}
