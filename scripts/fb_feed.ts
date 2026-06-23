import { Page, ElementHandle } from 'playwright';
import { humanScroll, readingScroll, maybeDistraction, maybeOpenImage, maybeCheckProfile, humanPause, randomDelay, humanMove, humanClick } from './humanmode.js';
import { readPostContent, generateReply, postComment, readCommentThread } from './fb_comment.js';
import { Config } from './fb_core.js';

/**
 * Feed browsing configuration
 */
export interface FeedConfig {
  postsToInteractWith?: number;
  reactProbability?: number;
  commentProbability?: number;
  distractionProbability?: number;
  imageOpenProbability?: number;
  profilePeekProbability?: number;
  maxSessionDuration?: number;
}

/**
 * Browse Facebook feed with human-like interactions
 */
export async function browseFeed(page: Page, config: Config, feedConfig: FeedConfig = {}): Promise<void> {
  const {
    postsToInteractWith = 5,
    reactProbability = 0.30,
    commentProbability = 0.20,
    distractionProbability = 0.15,
    imageOpenProbability = 0.20,
    profilePeekProbability = 0.10,
    maxSessionDuration = 30 * 60 * 1000, // 30 minutes
  } = feedConfig;

  try {
    console.log('📰 Browsing feed...');

    // Navigate to feed
    await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 4000);

    const sessionStart = Date.now();
    let interactCount = 0;

    // Simulate reading the feed
    for (let iteration = 0; iteration < 5; iteration++) {
      if (Date.now() - sessionStart > maxSessionDuration) {
        console.log('⏰ Session duration limit reached');
        break;
      }

      // Slow scroll while reading
      await readingScroll(page, 1);

      // Get visible posts
      const posts = await getVisiblePosts(page);
      console.log(`📍 Found ${posts.length} visible post(s)`);

      // Interact with random posts
      for (let i = 0; i < Math.min(posts.length, 3); i++) {
        if (interactCount >= postsToInteractWith) {
          console.log(`✓ Reached interaction limit (${postsToInteractWith})`);
          break;
        }

        if (Date.now() - sessionStart > maxSessionDuration) {
          break;
        }

        const post = posts[i];

        try {
          // Maybe get distracted
          if (await maybeDistraction(page, distractionProbability)) {
            console.log('😵 Got distracted for a moment');
            await randomDelay(500, 1000);
            continue;
          }

          // Maybe open an image
          await maybeOpenImage(page, imageOpenProbability);

          // Maybe peek at poster's profile
          await maybeCheckProfile(page, profilePeekProbability);

          // Maybe react to post
          if (Math.random() < reactProbability) {
            const reacted = await reactToPost(page, post);
            if (reacted) {
              interactCount++;
              console.log(`👍 Reacted to post (${interactCount}/${postsToInteractWith})`);
            }
          }

          await humanPause('between_comments');

          // Maybe comment on post
          if (Math.random() < commentProbability) {
            // Click on post to open it
            try {
              const box = await post.boundingBox();
              if (box) {
                await humanMove(page, box.x + box.width / 2, box.y + box.height / 2);
                await randomDelay(100, 300);
                await post.click();
                await randomDelay(2000, 4000);

                // Read post content
                const postContent = await readPostContent(page, post);
                console.log(`📄 Post by ${postContent.author}: "${postContent.text.slice(0, 50)}..."`);

                // Read comments
                const comments = await readCommentThread(page);
                if (comments.length > 0) {
                  const targetComment = comments[0];
                  const reply = await generateReply(
                    {
                      postAuthor: postContent.author,
                      postText: postContent.text,
                      postImages: postContent.images,
                      threadComments: comments,
                      targetComment,
                    },
                    config.ai.ollamaUrl,
                    config.ai.model
                  );

                  const commented = await postComment(page, reply);
                  if (commented) {
                    interactCount++;
                    console.log(`💬 Commented (${interactCount}/${postsToInteractWith})`);
                  }
                }

                // Go back to feed
                await page.goBack().catch(() => {});
                await randomDelay(1000, 2000);
              }
            } catch (error) {
              console.warn('⚠️  Could not interact with post:', error);
              // Go back to feed
              await page.goBack().catch(() => {});
            }
          }

          await humanPause('between_comments');
        } catch (error) {
          console.warn('⚠️  Error interacting with post:', error);
        }
      }

      // Scroll down for more posts
      await humanScroll(page, { minPx: 300, maxPx: 500 });
    }

    console.log(`✓ Feed browsing complete (${interactCount} interactions)`);
  } catch (error) {
    console.error('❌ Error browsing feed:', error);
  }
}

/**
 * React to a post with like or other emoji reactions
 */
export async function reactToPost(page: Page, postEl: ElementHandle, reaction?: string): Promise<boolean> {
  try {
    // Find like button
    const likeSelectors = [
      'button[aria-label*="Like"]',
      'button[aria-label="Like"]',
      'button[data-testid="UFI2ReactButton/root"]',
      'svg[aria-label="Like"]',
    ];

    let likeBtn: ElementHandle | null = null;
    for (const selector of likeSelectors) {
      try {
        likeBtn = await postEl.$(selector);
        if (likeBtn) break;
      } catch {
        continue;
      }
    }

    if (!likeBtn) {
      console.warn('⚠️  Could not find like button');
      return false;
    }

    // Hover to show reaction picker
    const box = await likeBtn.boundingBox();
    if (!box) {
      return false;
    }

    await humanMove(page, box.x + box.width / 2, box.y + box.height / 2);
    await randomDelay(500, 1000);

    // Select reaction
    if (reaction) {
      // Click specific reaction
      const reactionSelectors = [
        `button[aria-label="${reaction}"]`,
        `div[aria-label="${reaction}"]`,
      ];

      for (const selector of reactionSelectors) {
        try {
          const btn = await page.$(selector);
          if (btn) {
            await btn.click();
            await randomDelay(500, 1000);
            return true;
          }
        } catch {
          continue;
        }
      }
    } else {
      // Random reaction
      const reactions = ['Like', 'Love', 'Haha', 'Wow', 'Sad', 'Angry'];
      const weights = [0.60, 0.20, 0.10, 0.05, 0.03, 0.02];

      let rand = Math.random();
      let selected = reactions[0];
      let cumulative = 0;

      for (let i = 0; i < reactions.length; i++) {
        cumulative += weights[i];
        if (rand < cumulative) {
          selected = reactions[i];
          break;
        }
      }

      const reactionSelectors = [
        `button[aria-label="${selected}"]`,
        `div[aria-label="${selected}"]`,
      ];

      for (const selector of reactionSelectors) {
        try {
          const btn = await page.$(selector);
          if (btn) {
            await btn.click();
            await randomDelay(500, 1000);
            console.log(`✓ Reacted with ${selected}`);
            return true;
          }
        } catch {
          continue;
        }
      }

      // Fallback: just click like
      try {
        await likeBtn.click();
        await randomDelay(500, 1000);
        console.log('✓ Liked post');
        return true;
      } catch {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Error reacting to post:', error);
    return false;
  }
}

/**
 * Get all currently visible post elements in feed
 */
export async function getVisiblePosts(page: Page): Promise<ElementHandle[]> {
  try {
    const postSelectors = [
      '[data-testid="post"]',
      '[data-testid="feed_story_container"]',
      '[role="article"]',
      'div[data-testid="post_container"]',
    ];

    for (const selector of postSelectors) {
      try {
        const posts = await page.$$(selector);
        if (posts.length > 0) {
          // Filter to only visible posts
          const visiblePosts = [];
          for (const post of posts) {
            try {
              const isVisible = await post.isVisible();
              if (isVisible) {
                visiblePosts.push(post);
              }
            } catch {
              continue;
            }
          }
          return visiblePosts.slice(0, 10); // Return max 10
        }
      } catch {
        continue;
      }
    }

    return [];
  } catch (error) {
    console.error('❌ Error getting visible posts:', error);
    return [];
  }
}

/**
 * Get feed stats (engagement counts)
 */
export async function getFeedStats(page: Page): Promise<{ posts: number; interactions: number }> {
  try {
    const posts = await getVisiblePosts(page);

    let interactions = 0;
    for (const post of posts) {
      try {
        // Try to get reaction count
        const reactionText = await post.$eval('[data-testid="UFI2ReactionsCount"]', (el) => el.textContent).catch(() => '0');
        const reactions = parseInt(reactionText.replace(/\D/g, '') || '0');
        interactions += reactions;
      } catch {
        continue;
      }
    }

    return {
      posts: posts.length,
      interactions,
    };
  } catch (error) {
    console.error('❌ Error getting feed stats:', error);
    return { posts: 0, interactions: 0 };
  }
}
