import { callClaude, parseJSON } from '../utils/claude.js';
import { VOICE_SR, VOICE_EN } from '../utils/voice.js';

function buildSourceContext(scraped, allSources) {
  let ctx = '';
  
  // Original article content
  const original = allSources.find(s => s.type === 'original');
  if (original) {
    ctx += `\nORIGINAL ARTICLE CONTENT (rewrite this into Serbian, keep all facts):\n${original.content}\n`;
    if (original.facts && original.facts.length) {
      ctx += `\nKEY FACTS FROM ORIGINAL (include all of these):\n${original.facts.map((f, i) => `${i+1}. ${f}`).join('\n')}\n`;
    }
  }

  // Studies
  const studies = allSources.filter(s => s.type === 'study');
  if (studies.length) {
    ctx += `\nSTUDIES MENTIONED (cite exactly, link where URL available):\n`;
    studies.forEach((s, i) => {
      ctx += `${i+1}. ${s.content} — ${s.authors || ''} (${s.journal || ''}, ${s.year || ''}) ${s.url ? 'URL: '+s.url : ''}\n`;
    });
  }

  // People quoted
  const people = allSources.filter(s => s.type === 'person');
  if (people.length) {
    ctx += `\nPEOPLE QUOTED (use exact names, genders, quotes):\n`;
    people.forEach((p, i) => {
      ctx += `${i+1}. ${p.name} (${p.role}, ${p.gender || ''}): "${p.content}"\n`;
    });
  }

  // Enrichment from related article
  const enrichments = allSources.filter(s => s.type === 'enrichment');
  if (enrichments.length) {
    ctx += `\nADDITIONAL FACTS FROM RELATED ARTICLE (weave in naturally if relevant):\n`;
    enrichments.forEach((e, i) => {
      ctx += `${i+1}. ${e.content} [from: ${e.source}, ${e.url || ''}]\n`;
    });
  }

  // Reddit discussion
  const discussions = allSources.filter(s => s.type === 'discussion');
  if (discussions.length) {
    ctx += `\nREDDIT DISCUSSION (optional, include if it adds value):\n`;
    discussions.forEach(d => {
      ctx += `"${d.content}" — ${d.author} in ${d.source} ${d.url ? 'URL: '+d.url : ''}\n`;
    });
  }

  return ctx;
}

export async function writeArticle({ title, angle, sources, scraped, lang = 'sr', category = 'Top Namirnice', length = 'medium', tone = 50, contentType = '' }) {
  const voice = lang === 'sr' ? VOICE_SR : VOICE_EN;
  const sourceCtx = buildSourceContext(scraped, sources);
  const lenMap = { short: '400-600 words', medium: '600-900 words', long: '900-1200 words' };

  const prompt = `You are rewriting a foreign article into ${lang === 'sr' ? 'Serbian' : 'English'} for ${lang === 'sr' ? 'plantbased.rs' : 'plantbasedhouse.com'}.

${voice}

YOUR JOB: Take the original article content below and REWRITE it in the plantbased.rs style. This is NOT a translation — it's a rewrite. You should:
1. Keep ALL the facts, statistics, study findings, and quotes from the original
2. Restructure and rewrite in the plantbased.rs voice and tone
3. Write a UNIQUE intro — NEVER "Stojite u prodavnici" or "Da li ste se ikada zapitali". Pick from: surprising fact, misconception, direct statement, seasonal hook, or mini-story. EACH article must have a DIFFERENT intro style.
4. If additional facts from a related article are provided, weave them in where natural
5. If a Reddit discussion is provided, include it ONLY if it genuinely adds value
6. If a YouTube video is the source, LINK to it and mention the creator by name

CRITICAL RULES:
- Do NOT invent ANY facts, statistics, or numbers. If a number is not in the sources below, do not write it.
- Do NOT add health claims that aren't in the sources.
- LINKS: Max 3-4 <a href> links in the whole article. Link sparingly — only the most important source, a key study, or a discussion thread.
- BOLD: Use <strong>term</strong> on first mention of 4-6 key terms. Never use markdown **.
- READABILITY: Write for a general audience. If the source contains scientific jargon (like "reactive oxygen species" or "matrix metalloproteinases"), explain it in plain language or skip it entirely. Readers are not scientists.
- No em-dashes (—)
- IZVORI SECTION at end:
  <h2>Izvori</h2>
  <ul>
  <li><a href="URL">Source name</a></li>
  </ul>

LENGTH: ${lenMap[length]}
CONTENT TYPE: ${contentType || category}

SOURCES — rewrite based on this content:
${sourceCtx}

Return ONLY JSON:
{"title":"${lang === 'sr' ? 'SEO naslov na srpskom' : 'SEO title in English'}","meta":"Under 155 chars","html":"Full HTML article with proper Izvori <ul><li> section at end"}`;

  console.log(`[Writer] Rewriting: ${title}`);
  const raw = await callClaude([{ role: 'user', content: prompt }], { maxTokens: 4096 });

  try {
    const parsed = parseJSON(raw);
    if (parsed.html) {
      parsed.html = parsed.html
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/__/g, '');  // Remove stray underscores around URLs
    }
    return parsed;
  } catch {
    return { title, meta: angle || '', html: '<p>' + raw.slice(0, 3000) + '</p>' };
  }
}

export default { writeArticle };
