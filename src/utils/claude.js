import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Core API call with retry ───
export async function callClaude(messages, { model = 'claude-sonnet-4-20250514', maxTokens = 1000, system = '' } = {}) {
  const params = { model, max_tokens: maxTokens, messages };
  if (system) params.system = system;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.messages.create(params);
      return response.content.map(b => b.text || '').join('');
    } catch (err) {
      if (err?.status === 429 && attempt < 2) {
        const wait = 30 + attempt * 20;
        console.log(`Rate limit hit, waiting ${wait}s...`);
        await sleep(wait * 1000);
        continue;
      }
      throw err;
    }
  }
}

// ─── Claude with web search (handles multi-turn tool use) ───
export async function callClaudeSearch(messages, { model = 'claude-haiku-4-5-20251001', maxTokens = 1500, system = '' } = {}) {
  const params = {
    model, max_tokens: maxTokens, messages,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
  };
  if (system) params.system = system;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let response = await client.messages.create(params);
      
      // Handle multi-turn tool use
      let turns = 0;
      let allMessages = [...messages];
      while (response.stop_reason === 'tool_use' && turns++ < 5) {
        allMessages.push({ role: 'assistant', content: response.content });
        const toolResults = response.content
          .filter(b => b.type === 'tool_use' || b.type === 'web_search_tool_use')
          .map(b => ({ type: 'tool_result', tool_use_id: b.id, content: 'Search completed.' }));
        if (toolResults.length === 0) break;
        allMessages.push({ role: 'user', content: toolResults });
        response = await client.messages.create({ ...params, messages: allMessages });
      }

      return response.content.filter(b => b.type === 'text').map(b => b.text).join('\n\n');
    } catch (err) {
      if (err?.status === 429 && attempt < 2) {
        const wait = 30 + attempt * 20;
        console.log(`Rate limit hit, waiting ${wait}s...`);
        await sleep(wait * 1000);
        continue;
      }
      throw err;
    }
  }
}

// ─── Parse JSON from Claude response ───
export function parseJSON(raw) {
  const clean = raw.replace(/```json|```/g, '').trim();
  const a = clean.indexOf('['), b = clean.indexOf('{');
  let s = -1;
  if (a >= 0 && b >= 0) s = Math.min(a, b);
  else s = Math.max(a, b);
  if (s < 0) throw new Error('No JSON in response');
  const sub = clean.slice(s);
  try { return JSON.parse(sub); } catch {
    // Try bracket matching
    const isArr = sub[0] === '[';
    const close = isArr ? ']' : '}';
    let depth = 0, end = -1;
    for (let i = 0; i < sub.length; i++) {
      if (sub[i] === sub[0]) depth++;
      if (sub[i] === close) depth--;
      if (depth === 0) { end = i + 1; break; }
    }
    if (end > 0) try { return JSON.parse(sub.slice(0, end)); } catch {}
    throw new Error('Could not parse JSON');
  }
}

export default { callClaude, callClaudeSearch, parseJSON };
