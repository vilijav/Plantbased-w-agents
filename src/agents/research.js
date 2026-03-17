import { callClaudeSearch, parseJSON } from '../utils/claude.js';
import { addSources } from '../db/store.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Discover trending topics ───
export async function discoverTopics(category = 'general', lang = 'sr') {
  const catMap = {
    'Recepti': 'trending vegan recipes and cooking ideas',
    'Top Namirnice': 'trending superfoods and plant-based ingredients',
    'Zdravlje': 'plant-based health news and new studies',
    'general': 'trending plant-based and vegan topics',
  };
  const query = catMap[category] || catMap.general;

  console.log(`[Research] Discovering: ${query}`);
  const raw = await callClaudeSearch([{
    role: 'user',
    content: `Search for ${query} from the past 7 days. Check Reddit, food blogs, nutrition news.

Respond with ONLY a JSON array of 6 topics. Each must include the SOURCE where you found it:
[{"title":"Article title","angle":"One sentence","keywords":["word1"],"reason":"Why trending","source_name":"Reddit r/vegan","source_url":"https://actual-url.com","date":"2026-03-11"}]`
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
    // Store scraped facts as verified sources
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
