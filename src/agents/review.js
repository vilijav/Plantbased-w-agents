import { callClaude, parseJSON } from '../utils/claude.js';
import { GRAMMAR_SYSTEM } from '../utils/voice.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Grammar check (Serbian) ───
export async function grammarCheck(html, lang = 'sr') {
  if (lang !== 'sr') return html;

  console.log('[Review] Running grammar check...');
  const raw = await callClaude([{
    role: 'user',
    content: `Fix ALL grammar, spelling, and word choice issues in this Serbian article.

CHECK:
- Every word exists in Serbian (replace made-up words)
- Ekavian standard (svet not svijet, mleko not mlijeko)
- Serbian not Croatian vocabulary
- Padezi correct on every noun+adjective
- Gender agreement
- Vi/Vas/Vam capitalized
- No em-dashes, no markdown bold
- Scientific names in <em>
- Sentences max 25 words
- Remove fake internal links (ona.rs, telegraf.rs)
- Keep real external source links

Article:
${html}

Return ONLY corrected HTML. First character must be <.`
  }], { maxTokens: 4096, system: GRAMMAR_SYSTEM });

  let clean = raw.replace(/```html|```/g, '').trim();
  const ft = clean.indexOf('<');
  if (ft > 0) clean = clean.slice(ft);
  clean = clean.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return clean.length > 100 ? clean : html;
}

// ─── Quality review — finds issues and fixes them ───
export async function qualityReview(html, lang = 'sr') {
  console.log('[Review] Running quality review...');

  const langChecks = lang === 'sr'
    ? `- Any non-existent Serbian words? (e.g. 'imunija', 'pozicionirajuće')
- Any Croatian forms? (ijekavian, Croatian vocabulary)
- Any anglicisms where Serbian word exists?
- Padezi correct?
- Vi/Vas/Vam capitalized?`
    : `- Grammar errors?
- Awkward phrasing?`;

  const raw = await callClaude([{
    role: 'user',
    content: `You are a strict quality reviewer for a news publication. Find and FIX every problem.

CHECKLIST:

1. BROKEN CHARACTERS: Chinese/Japanese chars, encoding errors, random symbols? Remove.

2. LANGUAGE:
${langChecks}

3. HEADINGS: Numbered listicles like "3 Ways..." or "5 Things..."? Rewrite to descriptive style. Too dramatic? Tone down. Heading promises something body doesn't deliver? Fix.

4. SENTENCES: Max 25 words. One idea each. No run-ons.

5. BANNED: 'U današnje vreme', 'Važno je napomenuti', 'potrebno je napomenuti', 'Kada je reč o', 'Na kraju dana', 'Sve u svemu', 'dramatično', 'revolucionarno', 'zauvek promeniti', 'u eri kada', 'eksponencijalni'

6. LINKS: Remove <a href> to ona.rs, telegraf.rs (fake). Keep real external sources.

7. FORMAT: **markdown** → <strong>HTML</strong>. Em-dashes → commas/periods.

8. UNSOURCED CLAIMS: Specific health claims, statistics, study findings with NO <a href> source? Either remove the claim or soften to general knowledge.

9. SOURCES SECTION: Must have "Izvori"/"Sources" at end. If no source links in article, note that.

10. REPETITION: Same word 3+ times → synonyms.

11. TONE: Professional news publication, not personal blog. No hype.

Fix ALL issues. Return ONLY corrected HTML. First character must be <.

Article:
${html}`
  }], { maxTokens: 4096 });

  let clean = raw.replace(/```html|```/g, '').trim();
  const ft = clean.indexOf('<');
  if (ft > 0) clean = clean.slice(ft);
  clean = clean.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return clean.length > 100 ? clean : html;
}

// ─── SEO optimization (title + meta only) ───
export async function seoOptimize(title, meta) {
  console.log('[Review] SEO optimizing title & meta...');
  const prompt = `SEO expert for Google Discover. Optimize title and meta ONLY.

Title: ${title}
Meta: ${meta}

Rules:
- Title: curiosity gap or question, 50-65 chars, primary keyword, colon format. NOT numbered listicle.
- Meta: 145-155 chars, keyword in first 60 chars.

Return ONLY JSON:
{"title":"Optimized title","meta":"Optimized meta","slug":"url-slug","keywords":["primary","secondary"],"score":80}`;

  const raw = await callClaude([{ role: 'user', content: prompt }], { maxTokens: 500, model: 'claude-haiku-4-5-20251001' });
  try { return parseJSON(raw); } catch { return { title, meta, slug: 'article', keywords: [], score: 70 }; }
}

// ─── Full review pipeline ───
export async function fullReview(article, lang = 'sr') {
  let html = article.html;

  // Step 1: Grammar
  html = await grammarCheck(html, lang);
  await sleep(10000);

  // Step 2: Quality review
  html = await qualityReview(html, lang);
  await sleep(8000);

  // Step 3: SEO (title + meta)
  const seo = await seoOptimize(article.title, article.meta);

  // Step 4: Final cleanup
  html = html
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/ class="[^"]*"/g, '').replace(/ style="[^"]*"/g, '').replace(/ id="[^"]*"/g, '')
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
