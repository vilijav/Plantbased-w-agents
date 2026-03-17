import { createArticle, updateArticle } from '../db/store.js';
import { fullResearch, discoverArticles } from './research.js';
import { writeArticle } from './writer.js';
import { fullReview } from './review.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Generate from a source article URL ───
export async function generateArticle({ title, angle, sourceUrl, lang = 'sr', category = 'Top Namirnice', length = 'medium', tone = 50, contentType = '' }) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Pipeline] Rewriting: ${title}`);
  console.log(`[Pipeline] Source: ${sourceUrl}`);
  console.log(`${'='.repeat(60)}\n`);

  const article = createArticle({
    title, angle, sourceUrl, lang, category, length, tone, contentType,
    status: 'researching',
  });

  try {
    // Phase 1: Research — scrape original + find related + find discussion
    console.log('[Pipeline] Phase 1: Research');
    updateArticle(article.id, { status: 'researching' });
    const { scraped, allSources } = await fullResearch(article.id, sourceUrl);
    await sleep(12000);

    // Phase 2: Write — rewrite the article in plantbased.rs style
    console.log('[Pipeline] Phase 2: Writing');
    updateArticle(article.id, { status: 'writing' });
    const draft = await writeArticle({
      title: scraped.title || title,
      angle: angle || '',
      sources: allSources,
      scraped,
      lang, category, length, tone, contentType,
    });
    await sleep(12000);

    // Phase 3: Review — grammar + quality + SEO
    console.log('[Pipeline] Phase 3: Review');
    updateArticle(article.id, { status: 'reviewing' });
    const reviewed = await fullReview(draft, lang);

    // Phase 4: Save
    console.log('[Pipeline] Phase 4: Saving');
    const final = updateArticle(article.id, {
      status: 'ready',
      title: reviewed.title,
      meta: reviewed.meta,
      html: reviewed.html,
      slug: reviewed.slug,
      keywords: reviewed.keywords,
      seoScore: reviewed.seoScore,
      sourceCount: allSources.length,
    });

    console.log(`\n[Pipeline] ✓ Done: ${reviewed.title}`);
    console.log(`[Pipeline] Sources: ${allSources.length}, SEO: ${reviewed.seoScore}/100\n`);
    return final;
  } catch (err) {
    console.error(`[Pipeline] ✗ Failed: ${err.message}`);
    updateArticle(article.id, { status: 'error', error: err.message });
    throw err;
  }
}

// ─── Auto-discover articles to rewrite ───
export async function discover({ category = 'general', lang = 'sr' } = {}) {
  console.log('[Discover] Finding articles...');
  return discoverArticles(category, lang);
}

export default { generateArticle, discover };
