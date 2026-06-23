import { Page } from 'playwright';
import { humanType, humanClick, randomDelay, humanPause } from './humanmode.js';
import { uploadMedia } from './fb_media.js';

/**
 * Options for creating a post
 */
export interface PostOptions {
  text: string;
  media?: string[];
  visibility?: 'public' | 'friends' | 'private';
  pageId?: string;
}

/**
 * Create a post on user's timeline
 */
export async function createPost(page: Page, options: PostOptions): Promise<boolean> {
  try {
    console.log('📝 Creating post...');
    await humanPause('think');

    // Navigate to user's profile or home feed
    console.log('📍 Navigating to post creation...');
    await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 4000);

    // Find and click "What's on your mind" button
    const postButtonSelectors = [
      'div[aria-label="What\'s on your mind?"]',
      'div[aria-label*="What"]',
      '[data-testid="post_composer_call_to_action"]',
      'div:has-text("What\'s on your mind")',
      'div:has-text("Bạn đang nghĩ gì")',
    ];

    let found = false;
    for (const selector of postButtonSelectors) {
      try {
        const btn = await page.$(selector);
        if (btn) {
          await humanClick(page, selector);
          found = true;
          console.log('✓ Post composer opened');
          break;
        }
      } catch {
        continue;
      }
    }

    if (!found) {
      console.error('❌ Could not find post composer');
      return false;
    }

    await randomDelay(1000, 2000);

    // Find compose text area
    const composeSelectors = [
      'div[contenteditable="true"][aria-label*="What"]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea[aria-label*="What"]',
      'div[contenteditable="true"]',
    ];

    found = false;
    for (const selector of composeSelectors) {
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
      console.error('❌ Could not find compose area');
      return false;
    }

    await randomDelay(500, 1500);

    // Type post text
    console.log('✍️  Typing post content...');
    await humanType(page, composeSelectors[0], options.text);

    // Upload media if provided
    if (options.media && options.media.length > 0) {
      console.log('🖼️  Uploading media...');
      await randomDelay(1000, 2000);

      // Find photo/media button
      const mediaButtonSelectors = [
        'button[aria-label*="Photo"]',
        'button:has-text("Photo")',
        'div[aria-label*="Photo"]',
        'button[data-testid="post_composer_photo_button"]',
      ];

      found = false;
      for (const selector of mediaButtonSelectors) {
        try {
          const btn = await page.$(selector);
          if (btn) {
            await humanClick(page, selector);
            found = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (found) {
        await randomDelay(500, 1500);
        await uploadMedia(page, options.media);
      }
    }

    // Set visibility if specified
    if (options.visibility && options.visibility !== 'public') {
      console.log(`🔒 Setting visibility to ${options.visibility}...`);
      await randomDelay(1000, 2000);

      const visibilitySelectors = [
        'button[aria-label*="visibility"]',
        'button:has-text("Friends")',
        'div[aria-label*="visibility"]',
      ];

      for (const selector of visibilitySelectors) {
        try {
          const btn = await page.$(selector);
          if (btn) {
            await humanClick(page, selector);
            break;
          }
        } catch {
          continue;
        }
      }

      await randomDelay(500, 1000);

      // Click specific visibility option
      if (options.visibility === 'friends') {
        try {
          const friendsOption = await page.$('div[role="option"]:has-text("Friends")');
          if (friendsOption) {
            await friendsOption.click();
          }
        } catch {
          // Continue without changing visibility
        }
      }
    }

    await randomDelay(1000, 2000);

    // Click post/share button
    console.log('📤 Posting...');
    const postSelectors = [
      'button[aria-label="Post"]',
      'button:has-text("Post")',
      'button:has-text("Share")',
      'button[data-testid="post_composer_post_button"]',
    ];

    found = false;
    for (const selector of postSelectors) {
      try {
        const btn = await page.$(selector);
        if (btn) {
          await humanClick(page, selector);
          found = true;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!found) {
      console.error('❌ Could not find post button');
      return false;
    }

    await randomDelay(2000, 4000);

    console.log('✓ Post created successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to create post:', error);
    return false;
  }
}

/**
 * Create a post on a specific Facebook Page
 */
export async function createPagePost(page: Page, pageUrl: string, options: PostOptions): Promise<boolean> {
  try {
    console.log(`📄 Creating post on page: ${pageUrl}`);
    await humanPause('think');

    // Navigate to page
    console.log('📍 Navigating to page...');
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 4000);

    // Find page post composer
    const postButtonSelectors = [
      'div[aria-label="What\'s on your mind?"]',
      'div[aria-label*="What"]',
      '[data-testid="post_composer_call_to_action"]',
      'div:has-text("What\'s on your mind")',
    ];

    let found = false;
    for (const selector of postButtonSelectors) {
      try {
        const btn = await page.$(selector);
        if (btn) {
          await humanClick(page, selector);
          found = true;
          console.log('✓ Page post composer opened');
          break;
        }
      } catch {
        continue;
      }
    }

    if (!found) {
      console.error('❌ Could not find page post composer');
      return false;
    }

    // Rest is same as createPost
    await randomDelay(1000, 2000);

    const composeSelectors = [
      'div[contenteditable="true"][aria-label*="What"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
    ];

    found = false;
    for (const selector of composeSelectors) {
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
      console.error('❌ Could not find compose area');
      return false;
    }

    await randomDelay(500, 1500);
    await humanType(page, composeSelectors[0], options.text);

    if (options.media && options.media.length > 0) {
      console.log('🖼️  Uploading media...');
      await randomDelay(1000, 2000);
      const mediaButtonSelectors = [
        'button[aria-label*="Photo"]',
        'button:has-text("Photo")',
        'div[aria-label*="Photo"]',
      ];

      for (const selector of mediaButtonSelectors) {
        try {
          const btn = await page.$(selector);
          if (btn) {
            await humanClick(page, selector);
            await randomDelay(500, 1500);
            await uploadMedia(page, options.media);
            break;
          }
        } catch {
          continue;
        }
      }
    }

    await randomDelay(1000, 2000);

    const postSelectors = [
      'button[aria-label="Post"]',
      'button:has-text("Post")',
      'button:has-text("Share")',
    ];

    found = false;
    for (const selector of postSelectors) {
      try {
        const btn = await page.$(selector);
        if (btn) {
          await humanClick(page, selector);
          found = true;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!found) {
      console.error('❌ Could not find post button');
      return false;
    }

    await randomDelay(2000, 4000);

    console.log('✓ Page post created successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to create page post:', error);
    return false;
  }
}
