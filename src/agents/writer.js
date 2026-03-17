import { callClaude, parseJSON } from '../utils/claude.js';
import { VOICE_SR, VOICE_EN } from '../utils/voice.js';

// ─── Build the source context for the prompt ───
function buildSourceContext(sources) {
  const discussions = sources.filter(s => s.type === 'discussion');
  const studies = sources.filter(s => s.type === 'study');
  const facts = sources.filter(s => s.type === 'fact');
  const people = sources.filter(s => s.type === 'person');
  const links = sources.filter(s => s.type === 'link');

  let ctx = '';

  if (facts.length) {
    ctx += '\nVERIFIED FACTS (use these exactly, link to source URL):\n';
    facts.forEach((f, i) => { ctx += `${i + 1}. ${f.content} [Source: ${f.url || 'no URL'}]\n`; });
  }

  if (studies.length) {
    ctx += '\nSTUDIES (cite exactly as written, link URL):\n';
    studies.forEach((s, i) => {
      ctx += `${i + 1}. "${s.content}" — ${s.authors || 'unknown'} (${s.journal || 'unknown'}, ${s.year || 'unknown'}) URL: ${s.url || 'no URL'}\n`;
    });
  }

  if (discussions.length) {
    ctx += '\nONLINE DISCUSSIONS (paraphrase and link to thread URL):\n';
    discussions.forEach((d, i) => {
      ctx += `${i + 1}. "${d.content}" — ${d.author || 'user'} in ${d.source || 'forum'} URL: ${d.url || 'no URL'}\n`;
    });
  }

  if (people.length) {
    ctx += '\nPEOPLE QUOTED (use exact names, roles, genders):\n';
    people.forEach((p, i) => {
      ctx += `${i + 1}. ${p.name} (${p.role}, ${p.gender || 'unknown'}): "${p.content}"\n`;
    });
  }

  if (links.length) {
    ctx += '\nADDITIONAL SOURCES:\n';
    links.forEach((l, i) => { ctx += `${i + 1}. ${l.content} — ${l.url}\n`; });
  }

  return ctx;
}

// ─── Write article ───
export async function writeArticle({ title, angle, sources, lang = 'sr', category = 'Top Namirnice', length = 'medium', tone = 50 }) {
  const voice = lang === 'sr' ? VOICE_SR : VOICE_EN;
  const sourceCtx = buildSourceContext(sources);
  const lenMap = { short: '400-600 words, 2-3 H2 sections', medium: '600-900 words, 3-4 H2 sections', long: '900-1200 words, 4-6 H2 sections' };
  const toneDesc = tone < 30 ? 'Very editorial, formal' : tone > 70 ? 'Warmer, slightly personal' : 'Balanced editorial';
  const isRecipe = category === 'Recepti';

  let recipeBlock = '';
  if (isRecipe) {
    recipeBlock = `\n\nRECIPE MODE: First-person voice. Personal opening about discovering this recipe. Ingredients in <ul><li> with bold amounts. Step by step preparation. Serving suggestions.`;
  }

  const prompt = `Write a plant-based blog article.

Topic: "${title}"
Angle: ${angle}

${voice}
${recipeBlock}

TONE: ${toneDesc}
LENGTH: ${lenMap[length]}
CATEGORY: ${category}

CRITICAL — SOURCE-ONLY WRITING:
- ONLY write facts from the sources below. Do NOT add unsourced health claims, statistics, or study findings.
- Every source with a URL must be linked: <a href="URL">relevant phrase</a>
- If sources are limited, write shorter. NEVER pad with invented details.
- End with "Izvori" / "Sources" section listing all URLs used.

FORMATTING:
- HTML only: <h2> <h3> <p> <strong> <em> <ul> <li> <blockquote> <a href="">
- Bold: <strong>word</strong>, NEVER **word**
- No classes, styles, divs, spans

SOURCES:
${sourceCtx || 'No sources found. Write a short general overview based on common knowledge only. No specific claims.'}

Return ONLY JSON:
{"title":"SEO title","meta":"Under 155 chars","html":"Full HTML with sources section at end"}`;

  console.log(`[Writer] Writing: ${title}`);
  const raw = await callClaude([{ role: 'user', content: prompt }], { maxTokens: 4096 });

  try {
    const parsed = parseJSON(raw);
    // Fix markdown bold
    if (parsed.html) parsed.html = parsed.html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return parsed;
  } catch {
    return { title, meta: angle, html: `<p>${raw.slice(0, 3000)}</p>` };
  }
}

export default { writeArticle };
