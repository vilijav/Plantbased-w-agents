import { createArticle, updateArticle, getSources } from '../db/store.js';
import { fullResearch, discoverTopics, findAngles, scrapeArticle } from './research.js';
import { writeArticle } from './writer.js';
import { fullReview } from './review.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Generate article from a topic idea ───
export async function generateArticle({ title, angle, sourceUrl = null, lang = 'sr', category = 'Top Namirnice', length = 'medium', tone = 50 }) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Pipeline] Starting: ${title}`);
  console.log(`${'='.repeat(60)}\n`);

  // Create article record
  const article = createArticle({
    title,
    angle,
    sourceUrl,
    lang,
    category,
    length,
    tone,
    status: 'researching',
  });

  try {
    // ─── Phase 1: Research ───
    console.log('[Pipeline] Phase 1: Research');
    updateArticle(article.id, { status: 'researching' });
    const sources = await fullResearch(article.id, title, sourceUrl);
    await sleep(12000);

    // ─── Phase 2: Write ───
    console.log('[Pipeline] Phase 2: Writing');
    updateArticle(article.id, { status: 'writing' });
    const draft = await writeArticle({ title, angle, sources, lang, category, length, tone });
    await sleep(12000);

    // ─── Phase 3: Review (grammar + quality + SEO) ───
    console.log('[Pipeline] Phase 3: Review');
    updateArticle(article.id, { status: 'reviewing' });
    const reviewed = await fullReview(draft, lang);

    // ─── Phase 4: Save final ───
    console.log('[Pipeline] Phase 4: Saving');
    const final = updateArticle(article.id, {
      status: 'ready',
      title: reviewed.title,
      meta: reviewed.meta,
      html: reviewed.html,
      slug: reviewed.slug,
      keywords: reviewed.keywords,
      seoScore: reviewed.seoScore,
      sourceCount: sources.length,
    });

    console.log(`\n[Pipeline] ✓ Article ready: ${reviewed.title}`);
    console.log(`[Pipeline] Sources: ${sources.length}, SEO: ${reviewed.seoScore}/100\n`);

    return final;
  } catch (err) {
    console.error(`[Pipeline] ✗ Failed: ${err.message}`);
    updateArticle(article.id, { status: 'error', error: err.message });
    throw err;
  }
}

// ─── Discover and generate (fully automatic) ───
export async function autoGenerate({ category = 'general', lang = 'sr', length = 'medium', tone = 50 } = {}) {
  console.log('[Auto] Starting auto-generation...');
  
  const topics = await discoverTopics(category, lang);
  if (!topics.length) throw new Error('No topics found');

  // Pick the first non-duplicate topic
  const topic = topics[0];
  console.log(`[Auto] Selected: ${topic.title}`);

  return generateArticle({
    title: topic.title,
    angle: topic.angle,
    sourceUrl: topic.source_url || null,
    lang,
    category: category === 'general' ? 'Top Namirnice' : category,
    length,
    tone,
  });
}

export default { generateArticle, autoGenerate };
