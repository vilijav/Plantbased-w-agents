import { callClaudeSearch, parseJSON } from '../utils/claude.js';
import { addSources } from '../db/store.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Discover trending topics ───
export async function discoverTopics(category = 'general', lang = 'sr') {
  // Use multiple specific search strategies instead of one generic query
  const searches = {
    'Recepti': [
      'new viral vegan recipe 2026 TikTok',
      'plant-based recipe trending reddit this week',
      'best new vegan cookbook recipes march 2026'
    ],
    'Top Namirnice': [
      'new superfood trending 2026',
      'plant-based ingredient going viral',
      'reddit r/plantbaseddiet what are you eating this week'
    ],
    'Zdravlje': [
      'new plant-based health study published 2026',
      'vegan nutrition research news this month',
      'plant-based diet health benefits new evidence'
    ],
    'general': [
      'vegan news this week 2026',
      'plant-based trending reddit this week',
      'new vegan product launch march 2026',
      'plant-based food trend social media viral'
    ],
  };
  const queries = searches[category] || searches.general;
  // Pick a random query to get variety each time
  const query = queries[Math.floor(Math.random() * queries.length)];

  console.log(`[Research] Discovering with: ${query}`);
  const raw = await callClaudeSearch([{
    role: 'user',
    content: `Search for: ${query}

Find 6 DIFFERENT article ideas from DIFFERENT sources. Each idea must come from a DIFFERENT website or Reddit thread.

DO NOT suggest the same topics you suggested before. Look for what is NEW this week specifically.

Respond with ONLY a JSON array:
[{"title":"Article title","angle":"One sentence","keywords":["word1"],"reason":"Why trending NOW","source_name":"Source site name","source_url":"https://actual-url-you-found","date":"2026-03-17"}]`
  }]);

  return parseJSON(raw);
}

// ─── Find angles for a specific topic ───
export async function findAngles(topic) {
  console.log(`[Research] Finding angles for: ${topic}`);
  const raw = await callClaudeSearch([{
    role: 'user',
    content: `Find article angles for: "${topic}". Search web for discussions and recent coverage.

Also search site:plantbased.telegraf.rs for similar existing articles. Mark duplicates.

Respond with ONLY JSON array of 5 angles:
[{"title":"Blog title","angle":"Angle","keywords":["seo"],"reason":"Why","source_name":"Source","source_url":"https://...","already_covered":false,"existing_url":""}]`
  }]);

  try { return parseJSON(raw); } catch {
    return [{ title: topic, angle: 'Overview', keywords: [topic.toLowerCase()], reason: 'Requested', source_name: 'Manual', source_url: '' }];
  }
}

// ─── Scrape a URL and extract all facts ───
export async function scrapeArticle(url) {
  console.log(`[Research] Scraping: ${url}`);
  const raw = await callClaudeSearch([{
    role: 'user',
    content: `Visit this URL: ${url}

Read the FULL article. Extract ALL:
1. Main topic and thesis
2. Every specific fact, statistic, number
3. Every study cited (exact authors, journal, year, what it ACTUALLY found)
4. Every person quoted (exact name, role, what they said)
5. Every external link/source referenced in the article

Return ONLY JSON:
{"topic":"Main topic","summary":"3 sentence summary","facts":["Fact 1 with specific detail","Fact 2"],"studies":[{"authors":"Names","journal":"Journal","year":"2024","finding":"EXACT finding","url":"study URL if available"}],"people":[{"name":"Full name","role":"Their role","quote":"What they said","gender":"male/female"}],"links":[{"url":"https://...","description":"What this links to"}],"angles":[{"title":"Article title","angle":"Angle on same topic"}]}`
  }], { maxTokens: 2500, model: 'claude-sonnet-4-20250514' });

  return parseJSON(raw);
}

// ─── Gather online discussions with REAL URLs ───
export async function gatherDiscussions(topic) {
  console.log(`[Research] Finding discussions for: ${topic}`);
  const raw = await callClaudeSearch([{
    role: 'user',
    content: `Search Reddit and forums for real discussions about: "${topic}"

Find 3-4 actual threads/comments. For each, get the REAL URL of the thread.

Return ONLY JSON:
[{"text":"What the person said","author":"Username","source":"r/vegan","url":"https://reddit.com/r/vegan/actual-thread-url","type":"reddit"}]`
  }]);

  try { return parseJSON(raw); } catch { return []; }
}

// ─── Find relevant scientific studies ───
export async function findStudies(topic) {
  console.log(`[Research] Finding studies for: ${topic}`);
  const raw = await callClaudeSearch([{
    role: 'user',
    content: `Search for scientific studies about: "${topic}"

Look on PubMed, Google Scholar, and nutrition journals. Only include studies you can actually find and verify.

Return ONLY JSON:
[{"authors":"Author names","journal":"Journal name","year":"2024","finding":"Exact key finding from the study","url":"https://pubmed.ncbi.nlm.nih.gov/... or doi link","title":"Study title"}]

If you cannot find real studies with real URLs, return an empty array: []`
  }]);

  try { return parseJSON(raw); } catch { return []; }
}

// ─── Full research pipeline for a topic ───
export async function fullResearch(articleId, topic, sourceUrl = null) {
  const allSources = [];

  // If URL provided, scrape it first
  let scraped = null;
  if (sourceUrl) {
    scraped = await scrapeArticle(sourceUrl);
    if (scraped.facts) {
      scraped.facts.forEach(fact => {
        allSources.push({ articleId, type: 'fact', content: fact, url: sourceUrl, source: scraped.topic || 'Source article', verified: true });
      });
    }
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
    if (scraped.links) {
      scraped.links.forEach(link => {
        allSources.push({ articleId, type: 'link', content: link.description, url: link.url, verified: true });
      });
    }
  }

  await sleep(10000);

  // Find ADDITIONAL news articles about the same topic (for diversity of sources)
  console.log(`[Research] Finding additional sources for: ${topic}`);
  const additionalRaw = await callClaudeSearch([{
    role: 'user',
    content: `Search for other articles and news about: "${topic}"

Find 2-3 DIFFERENT articles from DIFFERENT websites that cover this same topic. Extract key facts from each.

Return ONLY JSON:
[{"url":"https://actual-article-url","site":"Site name","key_facts":["Fact 1","Fact 2"]}]

If you can't find additional sources, return: []`
  }]);
  try {
    const additional = parseJSON(additionalRaw);
    additional.forEach(src => {
      (src.key_facts || []).forEach(fact => {
        allSources.push({ articleId, type: 'fact', content: fact, url: src.url, source: src.site, verified: true });
      });
    });
  } catch {}

  await sleep(10000);

  // Find online discussions
  const discussions = await gatherDiscussions(topic);
  discussions.forEach(d => {
    allSources.push({ articleId, type: 'discussion', content: d.text, author: d.author, source: d.source, url: d.url || '', verified: !!d.url });
  });

  await sleep(10000);

  // Find studies (skip if URL import already provided studies)
  if (!scraped || !scraped.studies || scraped.studies.length === 0) {
    const studies = await findStudies(topic);
    studies.forEach(s => {
      allSources.push({ articleId, type: 'study', content: s.finding, authors: s.authors, journal: s.journal, year: s.year, url: s.url || '', title: s.title, verified: !!s.url });
    });
  }

  // Save all sources to DB
  if (allSources.length > 0) {
    addSources(allSources);
  }

  console.log(`[Research] Found ${allSources.length} sources for article ${articleId}`);
  return allSources;
}

export default { discoverTopics, findAngles, scrapeArticle, gatherDiscussions, findStudies, fullResearch };
