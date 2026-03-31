import { callClaude, callClaudeSearch, parseJSON } from '../utils/claude.js';
import { addSources } from '../db/store.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Find complete articles to rewrite (not topics) ───
export async function discoverArticles(category = 'general', lang = 'sr') {
  const randomSeed = Math.floor(Math.random() * 1000);
  
  const queries = [
    'best new vegan plant-based articles published march 2026',
    'trending vegan recipe health news this week 2026',
    'plant-based food news articles this month march 2026',
    'new vegan lifestyle health food article 2026',
    'latest plant-based nutrition recipe news march 2026',
    'vegan superfoods health tips recipes new articles 2026',
  ];
  const query = queries[randomSeed % queries.length];
  console.log(`[Research] Finding articles: ${query}`);

  // Try with web search first
  let raw = '';
  try {
    raw = await callClaudeSearch([{
      role: 'user',
      content: `Search the web for: ${query}

Find 6 recently published articles (from 2026) about plant-based food, vegan health, or vegan recipes. Each from a DIFFERENT website.

Return ONLY a JSON array, nothing else:
[{"title":"Article title","summary":"What it covers","source_name":"Site","source_url":"https://full-url","content_type":"recipe|health|news|tip|ingredient|story"}]`
    }], { maxTokens: 2000 });
  } catch (e) {
    console.error('[Research] Web search failed:', e.message);
  }

  console.log('[Research] Raw length:', (raw||'').length);

  // Try parsing
  if (raw && raw.length > 10) {
    try { return parseJSON(raw); } catch (e) {
      console.log('[Research] Parse failed, trying extraction fallback...');
    }

    // Fallback 1: Ask Claude to extract JSON from the text
    try {
      const extracted = await callClaude([{
        role: 'user',
        content: `This text contains information about articles. Extract it into a JSON array. Return ONLY the JSON array, no other text.

Format: [{"title":"...","summary":"...","source_name":"...","source_url":"https://...","content_type":"recipe|health|news"}]

Text:
${raw.slice(0, 3000)}`
      }], { maxTokens: 2000, model: 'claude-haiku-4-5-20251001' });
      return parseJSON(extracted);
    } catch (e) {
      console.log('[Research] Extraction fallback failed:', e.message);
    }
  }

  // Fallback 2: Use Claude WITHOUT web search — generate article suggestions from knowledge
  console.log('[Research] Using non-search fallback...');
  const fallback = await callClaude([{
    role: 'user',
    content: `Suggest 6 article topics for a plant-based food blog. For each, suggest a real website where this type of article would likely be found (VegNews, PlantBasedNews, MinimalistBaker, BBC Good Food vegan, Healthline plant-based, etc).

Make them VARIED: 1 recipe, 1 health/study, 1 ingredient spotlight, 1 practical tip, 1 news/trend, 1 myth-busting.

Return ONLY JSON array:
[{"title":"Article title idea","summary":"What it covers","source_name":"Suggested site","source_url":"https://www.vegnews.com","content_type":"recipe|health|news|tip|ingredient|story"}]`
  }], { maxTokens: 1500, model: 'claude-haiku-4-5-20251001' });
  
  return parseJSON(fallback);
}

// ─── Scrape a complete article for rewriting ───
export async function scrapeForRewrite(url) {
  console.log(`[Research] Scraping for rewrite: ${url}`);
  const raw = await callClaudeSearch([{
    role: 'user',
    content: `Visit this URL: ${url}

Read the COMPLETE article. Extract EVERYTHING — do not skip anything:
1. The full article content — every paragraph, every fact, every detail
2. All statistics and numbers mentioned
3. All studies referenced (exact names, authors, journals, years, findings)
4. All people quoted (exact names, roles, exact quotes)
5. ALL embedded content: YouTube videos (with URLs), Instagram posts (with URLs), tweets, TikToks — include the actual embed URLs
6. All external hyperlinks in the article (every <a href> link you find)
7. The article structure (sections, headings)

IMPORTANT: If the article embeds a YouTube video, Instagram post, or any social media content, you MUST include the URL in the sources list.

Return ONLY JSON:
{"title":"Original title","full_content":"Complete article text preserving all facts and structure","facts":["Every specific fact, stat, or claim"],"studies":[{"authors":"Names","journal":"Journal","year":"Year","finding":"Exact finding","url":"study URL if available"}],"people":[{"name":"Full name","role":"Role","quote":"Exact quote","gender":"male/female"}],"sources":[{"url":"https://...","description":"What this is","type":"article|youtube|instagram|study|other"}],"structure":["Section 1","Section 2"]}`
  }], { maxTokens: 3000, model: 'claude-sonnet-4-20250514' });

  return parseJSON(raw);
}

// ─── Find a second article on same topic (optional enrichment) ───
export async function findRelatedArticle(topic) {
  console.log(`[Research] Finding related article for: ${topic}`);
  const raw = await callClaudeSearch([{
    role: 'user',
    content: `Search for another recent article (2025-2026) about: "${topic}"

Find ONE article from a DIFFERENT website that covers the same or very similar topic. It should add new information or a different perspective.

If you cannot find a genuinely relevant and recent article, return: {"found": false}

Otherwise return:
{"found":true,"title":"Article title","source_name":"Site","source_url":"https://...","key_additions":["New fact 1 not in original","New fact 2","New perspective"]}`
  }]);

  try {
    const result = parseJSON(raw);
    if (result.found === false) return null;
    return result;
  } catch { return null; }
}

// ─── Find ONE Reddit discussion (not forced) ───
export async function findDiscussion(topic) {
  console.log(`[Research] Looking for discussion on: ${topic}`);
  const raw = await callClaudeSearch([{
    role: 'user',
    content: `Search Reddit for a real discussion about: "${topic}"

Find ONE good Reddit thread where people discuss this topic with real opinions. Get the ACTUAL thread URL.

If there is no relevant Reddit discussion, return: {"found": false}

Otherwise return:
{"found":true,"text":"Key point from the discussion","author":"u/username","url":"https://reddit.com/r/.../actual-thread","subreddit":"r/vegan"}`
  }]);

  try {
    const result = parseJSON(raw);
    if (result.found === false) return null;
    return result;
  } catch { return null; }
}

// ─── Full research for an article rewrite ───
export async function fullResearch(articleId, sourceUrl) {
  const allSources = [];

  // Step 1: Scrape the main article completely
  const scraped = await scrapeForRewrite(sourceUrl);
  
  // Store all extracted content
  allSources.push({
    articleId, type: 'original', 
    content: scraped.full_content || scraped.title,
    url: sourceUrl, source: 'Original article', verified: true,
    facts: scraped.facts || [],
    structure: scraped.structure || [],
  });

  if (scraped.studies) {
    scraped.studies.forEach(study => {
      allSources.push({ articleId, type: 'study', content: study.finding, authors: study.authors, journal: study.journal, year: study.year, url: study.url || '', verified: true });
    });
  }
  if (scraped.people) {
    scraped.people.forEach(person => {
      allSources.push({ articleId, type: 'person', content: person.quote, name: person.name, role: person.role, gender: person.gender, verified: true });
    });
  }
  if (scraped.sources) {
    scraped.sources.forEach(src => {
      allSources.push({ articleId, type: 'link', content: src.description, url: src.url, verified: true });
    });
  }

  await sleep(12000);

  // Step 2: Try to find one related article for enrichment (optional)
  const related = await findRelatedArticle(scraped.title || sourceUrl);
  if (related && related.key_additions) {
    related.key_additions.forEach(fact => {
      allSources.push({ articleId, type: 'enrichment', content: fact, url: related.source_url, source: related.source_name, verified: true });
    });
  }

  await sleep(10000);

  // Step 3: Try to find one Reddit discussion (optional, not forced)
  const discussion = await findDiscussion(scraped.title || sourceUrl);
  if (discussion) {
    allSources.push({ articleId, type: 'discussion', content: discussion.text, author: discussion.author, source: discussion.subreddit, url: discussion.url, verified: true });
  }

  // Save to DB
  if (allSources.length > 0) addSources(allSources);
  
  console.log(`[Research] Collected ${allSources.length} source items for article ${articleId}`);
  return { scraped, allSources };
}

export default { discoverArticles, scrapeForRewrite, findRelatedArticle, findDiscussion, fullResearch };
