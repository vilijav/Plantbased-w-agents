import { callClaudeSearch, parseJSON } from '../utils/claude.js';
import { addSources } from '../db/store.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Find complete articles to rewrite (not topics) ───
export async function discoverArticles(category = 'general', lang = 'sr') {
  // Randomize search to avoid same results
  const timestamp = Date.now();
  const randomSeed = Math.floor(Math.random() * 1000);
  
  const categorySearches = {
    'Recepti': `new vegan recipe blog post ${randomSeed % 2 === 0 ? 'TikTok viral' : 'healthy easy'} 2026`,
    'Top Namirnice': `plant-based superfood ingredient health benefits ${randomSeed % 3 === 0 ? 'underrated' : randomSeed % 3 === 1 ? 'seasonal spring' : 'surprising'} 2026`,
    'Zdravlje': `vegan plant-based health study research ${randomSeed % 2 === 0 ? 'new findings' : 'myth debunk'} 2026`,
    'general': [
      'plant-based vegan article published this week 2026 march',
      'vegan food news interesting story this month 2026',
      'plant-based recipe health tip new article march 2026',
      'vegan lifestyle food trend article published recently 2026',
    ][randomSeed % 4],
  };
  
  const query = categorySearches[category] || categorySearches.general;
  console.log(`[Research] Finding articles with: ${query}`);

  const raw = await callClaudeSearch([{
    role: 'user',
    content: `Search for: ${query}

Find 6 COMPLETE, PUBLISHED ARTICLES from English-language websites that could be rewritten for a Serbian plant-based blog. 

REQUIREMENTS:
- Each article must be from a DIFFERENT website
- Articles must be from 2025 or 2026 (recent content only)
- Include the ACTUAL URL of each article (not a homepage)
- Vary the content types: include a recipe, a health article, a news piece, a practical tip, etc.
- Do NOT suggest articles from plantbased.rs or plantbasedhouse.com

For each article, provide a brief summary of what it covers.

Respond with ONLY a JSON array:
[{"title":"Original article title","summary":"2-3 sentence summary of what the article covers","source_name":"Website name","source_url":"https://full-article-url","date":"2026-03","content_type":"recipe|ingredient|health|tip|news|story"}]`
  }], { maxTokens: 2000 });

  return parseJSON(raw);
}

// ─── Scrape a complete article for rewriting ───
export async function scrapeForRewrite(url) {
  console.log(`[Research] Scraping for rewrite: ${url}`);
  const raw = await callClaudeSearch([{
    role: 'user',
    content: `Visit this URL: ${url}

Read the COMPLETE article. Extract EVERYTHING:
1. The full article content — every paragraph, every fact, every detail
2. All statistics and numbers mentioned
3. All studies referenced (exact names, authors, journals, years, findings)
4. All people quoted (exact names, roles, exact quotes)
5. All external sources/links mentioned in the article
6. The article structure (how it's organized, what sections it has)

Be THOROUGH. Do not skip any content. I need the complete picture to rewrite this article.

Return ONLY JSON:
{"title":"Original title","full_content":"Complete article text preserving all facts and structure","facts":["Every specific fact, stat, or claim from the article"],"studies":[{"authors":"Names","journal":"Journal","year":"Year","finding":"Exact finding as stated","url":"if available"}],"people":[{"name":"Full name","role":"Role","quote":"Exact quote","gender":"male/female"}],"sources":[{"url":"https://...","description":"What this source covers"}],"structure":["Section 1 topic","Section 2 topic"]}`
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
