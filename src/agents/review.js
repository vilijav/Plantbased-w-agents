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

  const prompt = `Strict quality review for a plant-based news publication. Find and FIX every problem.

CHECKLIST:

1. BROKEN CHARS: Chinese/Japanese characters, encoding errors? Remove.

2. LANGUAGE: ${checks}

3. HEADINGS: No numbered listicles. No generic "Zdravstveni benefiti". Must be descriptive.

4. SENTENCES: Max 25 words each. No run-ons.

5. BANNED WORDS: "U današnje vreme", "Važno je napomenuti", "Kada je reč o", "Na kraju dana", "Sve u svemu", "Da li ste se ikada zapitali", "neverovatnih", "šokantno", "revolucionarno"

6. LINKS: Remove fake links (ona.rs, telegraf.rs). Fix URLs with __ underscores. Max 3-4 links total in article. Do NOT hyperlink every sentence.

7. FORMAT: **markdown** → <strong>HTML</strong>. No em-dashes.

8. UNSOURCED SPECIFIC NUMBERS (CRITICAL): Look at EVERY specific statistic, percentage, dollar amount, or study finding in the article. If it does NOT have an <a href> link nearby OR is not clearly attributed to a named source, it is PROBABLY HALLUCINATED. Either:
   a) Remove the specific number entirely
   b) Replace with vague language ("deo radnika mogao bi da pređe" instead of "10-40% radnika")
   c) Add "prema procenama" or similar hedging
   This is the #1 most important check. AI loves to invent convincing-sounding numbers.

9. BOLD TERMS: Key terms should be <strong>bolded</strong> on first mention. If there are zero <strong> tags in the article, add them on 4-6 key terms.

10. READABILITY: Is any section too scientific/technical for a general audience? Simplify jargon. Example: "neutrališu reaktivne vrste kiseonika (ROS), povećavaju signaliziranje epidermalnog faktora rasta (EGF)" → simplify to plain language the reader understands.

11. REPETITION: Same word 3+ times → use synonyms. Same sentence structure repeating → vary it.

12. SOURCES SECTION: Must have "Izvori" at end with linked sources.

13. INTRO: Must NOT start with "Stojite u prodavnici" or "Da li ste se ikada zapitali" or any generic AI pattern. Must be vivid and specific.

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

  // Step 1: Grammar (AI-based, Serbian only)
  html = await grammarCheck(html, lang);
  await sleep(10000);

  // Step 2: Quality review (AI-based)
  html = await qualityReview(html, lang);
  await sleep(8000);

  // Step 3: DETERMINISTIC Serbian word fixer — catches ALL Croatian words the AI missed
  if (lang === 'sr') {
    const { fixSerbianWords, findCroatianWords } = await import('../utils/serbian-fix.js');
    const croatianBefore = findCroatianWords(html);
    if (croatianBefore.length > 0) {
      console.log(`[Review] Found Croatian words: ${croatianBefore.join(', ')}`);
    }
    html = fixSerbianWords(html);
    const croatianAfter = findCroatianWords(html);
    if (croatianAfter.length > 0) {
      console.log(`[Review] WARNING: Still Croatian after fix: ${croatianAfter.join(', ')}`);
    }
  }

  // Step 4: Fix sources section formatting (must be <ul><li> with links)
  if (!html.includes('<h2>Izvori</h2>') && !html.includes('<h3>Izvori</h3>')) {
    // Check for <h2>Izvori or similar
    const sourcesMatch = html.match(/<h[23]>Izvori<\/h[23]>/i);
    if (!sourcesMatch) {
      // Sources section missing or malformatted — don't add fake one
    }
  }
  // Fix sources that are plain text instead of list
  html = html.replace(/(<h[23]>Izvori<\/h[23]>)\s*<p>([\s\S]*?)<\/p>/i, (match, heading, content) => {
    // Convert plain text sources to proper <ul><li> format
    const lines = content.split(/\n|<br\s*\/?>/).filter(l => l.trim());
    if (lines.length > 0) {
      const items = lines.map(line => '<li>' + line.trim() + '</li>').join('\n');
      return heading + '\n<ul>\n' + items + '\n</ul>';
    }
    return match;
  });

  // Step 5: SEO
  const seo = await seoOptimize(article.title, article.meta, lang);

  // Step 6: Final cleanup
  html = html
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/href="__/g, 'href="').replace(/__"/g, '"')
    .replace(/ class="[^"]*"/g, '').replace(/ style="[^"]*"/g, '')
    .replace(/<div[^>]*>/g, '').replace(/<\/div>/g, '')
    .replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '')
    .replace(/<br\s*\/?>/g, '').replace(/\n{3,}/g, '\n\n').trim();

  // Step 7: Run Serbian fixer ONE MORE TIME on the final output (catches anything SEO step introduced)
  let finalTitle = seo.title || article.title;
  let finalMeta = seo.meta || article.meta;
  if (lang === 'sr') {
    const { fixSerbianWords } = await import('../utils/serbian-fix.js');
    html = fixSerbianWords(html);
    finalTitle = fixSerbianWords(finalTitle);
    finalMeta = fixSerbianWords(finalMeta);
  }

  return {
    title: finalTitle,
    meta: finalMeta,
    html,
    slug: seo.slug,
    keywords: seo.keywords,
    seoScore: seo.score,
  };
}

export default { grammarCheck, qualityReview, seoOptimize, fullReview };
