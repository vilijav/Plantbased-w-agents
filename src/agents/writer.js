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
export async function writeArticle({ title, angle, sources, lang = 'sr', category = 'Top Namirnice', length = 'medium', tone = 50, contentType = '' }) {
  const voice = lang === 'sr' ? VOICE_SR : VOICE_EN;
  const sourceCtx = buildSourceContext(sources);
  const lenMap = { short: '400-600 words, 2-3 H2 sections', medium: '600-900 words, 3-4 H2 sections', long: '900-1200 words, 4-6 H2 sections' };
  const toneDesc = tone < 30 ? 'Very editorial, formal' : tone > 70 ? 'Warmer, slightly personal' : 'Balanced editorial';

  // Content type specific instructions
  const typeInstructions = {
    recipe: `RECIPE ARTICLE FORMAT:
- First-person voice throughout ("Probala sam...", "Upustila sam se...")
- Opening: tell a personal story about how you discovered this recipe
- Background section about the main ingredient (nutritional value, fun facts)
- <h2>Sastojci</h2> with ingredients in <ul><li> format, bold the amounts
- <h2>Priprema</h2> with step-by-step numbered paragraphs
- <h2>Saveti za serviranje</h2> with serving ideas
- Warm, personal, enthusiastic tone
EXAMPLE INTRO: "Moram da priznam da džem od kivija nikada nisam ni videla ni probala sve dok ga nisam sama napravila. A onda sam se zaista prijatno iznenadila!"`,

    ingredient: `INGREDIENT SPOTLIGHT FORMAT:
- Opening: surprising fact or common misconception about this ingredient
- Section on nutritional profile (vitamins, minerals, specific data)
- Section on health benefits (with linked sources)
- Section on how to use it in cooking (practical tips, combinations)
- Section on buying/storing tips
EXAMPLE INTRO: "Kada se pomene karanfilić, prva asocijacija mnogima je kuvano vino i zima. Ovaj sitni, sušeni pupoljak cveta krije u sebi mnogo više od prepoznatljive arome."`,

    myth: `MYTH-BUSTING / Q&A FORMAT:
- Opening: state the common belief or question that everyone has
- Present what people THINK is true
- Then reveal the actual answer with sources
- Practical takeaway: what should the reader actually do?
EXAMPLE INTRO: "Sigurno vam se bar jednom desilo da zaboravite veknu hleba u kutiji. Verovatno ste se barem jednom zapitali: da li je dovoljno da odsečem ubuđali deo i iskoristim ostatak?"`,

    tip: `PRACTICAL TIP / KITCHEN HACK FORMAT:
- Opening: describe the common problem this solves
- Explain the tip/hack clearly and simply
- Why it works (brief science or logic)
- What to watch out for (caveats)
EXAMPLE INTRO: "Pronašli ste odličan recept za brzu večeru, propržili luk i protein po izboru, i došli do onog koraka gde piše: 'dodajte paradajz'. Otvarate frižider... Pogrešno."`,

    health: `HEALTH NEWS / STUDY FORMAT:
- Opening: relatable health concern the reader might have
- Present the key finding from the study/research
- What this means practically for someone eating plant-based
- Caveats and limitations
EXAMPLE INTRO: "Zeleni čaj se decenijama smatra ultimativnim napitkom za zdravlje. Međutim, medicinski stručnjaci upozoravaju da ova navika može doneti više štete nego koristi."`,

    story: `NEWS / TREND STORY FORMAT:
- Opening: vivid scene-setting or surprising statistic
- What is happening and why it matters
- Who is involved (real people, companies, communities)
- Online discussion section with linked Reddit/forum threads
- What this means for the future`,
  };

  const typeBlock = typeInstructions[contentType] || typeInstructions[category === 'Recepti' ? 'recipe' : 'story'] || '';

  const prompt = `Write a plant-based blog article.

Topic: "${title}"
Angle: ${angle}

${voice}

${typeBlock ? `ARTICLE TYPE INSTRUCTIONS:\n${typeBlock}\n` : ''}

TONE: ${toneDesc}
LENGTH: ${lenMap[length]}
CATEGORY: ${category}

CRITICAL — SOURCE-ONLY WRITING:
- ONLY write facts from the sources below. Do NOT add unsourced health claims or statistics.
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

  console.log(`[Writer] Writing (${contentType || category}): ${title}`);
  const raw = await callClaude([{ role: 'user', content: prompt }], { maxTokens: 4096 });

  try {
    const parsed = parseJSON(raw);
    if (parsed.html) parsed.html = parsed.html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return parsed;
  } catch {
    return { title, meta: angle, html: `<p>${raw.slice(0, 3000)}</p>` };
  }
}

export default { writeArticle };
