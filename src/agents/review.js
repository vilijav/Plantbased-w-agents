import { callClaude, parseJSON } from '../utils/claude.js';
import { SERBIAN_CORRECTIONS } from '../utils/voice.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Serbian grammar + Croatian word check ───
export async function grammarCheck(html, lang = 'sr') {
  if (lang !== 'sr') return html;
  console.log('[Review] Grammar check...');

  const prompt = `You are a STRICT Serbian language editor. Fix EVERY issue in this article.

${SERBIAN_CORRECTIONS}

ADDITIONAL CHECKS:
- Every word must exist in Serbian. If you see a word that looks odd, replace it.
- Padezi must be correct on EVERY noun+adjective pair.
- Gender agreement on all adjectives.
- No em-dashes. No markdown bold.
- Sentences max 25 words.
- Remove any __ underscores around URLs in <a href> tags.
- Keep all <a href> links intact but fix the URL if it has __ around it.

Article:
${html}

Return ONLY the corrected HTML. First character must be <.`;

  const raw = await callClaude([{ role: 'user', content: prompt }], { maxTokens: 4096 });
  let clean = raw.replace(/```html|```/g, '').trim();
  const ft = clean.indexOf('<');
  if (ft > 0) clean = clean.slice(ft);
  clean = clean.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  clean = clean.replace(/href="__/g, 'href="').replace(/__"/g, '"');
  return clean.length > 100 ? clean : html;
}

// ─── Quality review ───
export async function qualityReview(html, lang = 'sr') {
  console.log('[Review] Quality review...');

  const checks = lang === 'sr' 
    ? `- Any Croatian words? (znanstvenik, kazalište, tjedan, rajčica, mrkva, ugljični, što umesto šta, također, općenito, sveučilište, tvornica, udruga)
- Any made-up words that don't exist in Serbian?
- Any anglicisms? (kancer→rak, freezer→zamrzivač)
- Padezi correct?
- Vi/Vas/Vam capitalized?
- Is the intro unique and engaging (NOT "Stojite u prodavnici...")?`
    : '- Grammar and spelling correct?\n- Natural phrasing?';

  const prompt = `Strict quality review. Find and FIX every problem.

CHECKLIST:
1. BROKEN CHARS: Chinese/Japanese characters, encoding errors? Remove.
2. LANGUAGE: ${checks}
3. HEADINGS: No numbered listicles. No generic "Zdravstveni benefiti". Must be descriptive.
4. SENTENCES: Max 25 words each. No run-ons.
5. BANNED: "U današnje vreme", "Važno je napomenuti", "Kada je reč o", "Na kraju dana", "Sve u svemu", "Da li ste se ikada zapitali"
6. LINKS: Remove fake links (ona.rs, telegraf.rs). Fix URLs with __ underscores. Total links should be max 3-4.
7. FORMAT: **markdown** → <strong>HTML</strong>. No em-dashes.
8. UNSOURCED CLAIMS: Specific health claims without <a href> source? Remove or soften to general knowledge.
9. REPETITION: Same word 3+ times → use synonyms.
10. SOURCES SECTION: Must have "Izvori" at end.

Fix ALL issues. Return ONLY corrected HTML. First character must be <.

Article:
${html}`;

  const raw = await callClaude([{ role: 'user', content: prompt }], { maxTokens: 4096 });
  let clean = raw.replace(/```html|```/g, '').trim();
  const ft = clean.indexOf('<');
  if (ft > 0) clean = clean.slice(ft);
  clean = clean.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  clean = clean.replace(/href="__/g, 'href="').replace(/__"/g, '"');
  return clean.length > 100 ? clean : html;
}

// ─── SEO (title + meta only) ───
export async function seoOptimize(title, meta, lang = 'sr') {
  console.log('[Review] SEO...');
  const langNote = lang === 'sr' ? 'Title must be in Serbian. Use colon or question format like plantbased.rs.' : 'Title in English with colon or question.';
  const prompt = `SEO for Google Discover. Optimize title and meta ONLY.

Title: ${title}
Meta: ${meta}

${langNote}
- Title: curiosity gap, 50-65 chars, keyword included. NOT numbered listicle.
- Meta: 145-155 chars.
- Slug: URL-friendly, 3-6 words.

Return ONLY JSON:
{"title":"Optimized","meta":"Optimized","slug":"url-slug","keywords":["primary","secondary"],"score":80}`;

  const raw = await callClaude([{ role: 'user', content: prompt }], { maxTokens: 500, model: 'claude-haiku-4-5-20251001' });
  try { return parseJSON(raw); } catch { return { title, meta, slug: 'article', keywords: [], score: 70 }; }
}

// ─── Full review pipeline ───
export async function fullReview(article, lang = 'sr') {
  let html = article.html;

  // Grammar (Serbian only)
  html = await grammarCheck(html, lang);
  await sleep(10000);

  // Quality review
  html = await qualityReview(html, lang);
  await sleep(8000);

  // SEO
  const seo = await seoOptimize(article.title, article.meta, lang);

  // Final cleanup
  html = html
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/href="__/g, 'href="').replace(/__"/g, '"')
    .replace(/ class="[^"]*"/g, '').replace(/ style="[^"]*"/g, '')
    .replace(/<div[^>]*>/g, '').replace(/<\/div>/g, '')
    .replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '')
    .replace(/<br\s*\/?>/g, '').replace(/\n{3,}/g, '\n\n').trim();

  return {
    title: seo.title || article.title,
    meta: seo.meta || article.meta,
    html,
    slug: seo.slug,
    keywords: seo.keywords,
    seoScore: seo.score,
  };
}

export default { grammarCheck, qualityReview, seoOptimize, fullReview };
