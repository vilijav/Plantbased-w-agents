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

// ─── Claude with web search ───
export async function callClaudeSearch(messages, { model = 'claude-haiku-4-5-20251001', maxTokens = 1500, system = '' } = {}) {
  const params = {
    model, max_tokens: maxTokens, messages,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
  };
  if (system) params.system = system;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.messages.create(params);
      
      console.log('[Claude] stop_reason:', response.stop_reason, 'blocks:', response.content.length);
      
      // Collect text from ALL blocks regardless of type
      const texts = [];
      for (const b of response.content) {
        console.log(`[Claude] Block: type=${b.type}`);
        if (b.type === 'text' && b.text) {
          texts.push(b.text);
        }
        // web_search_tool_result blocks may have nested content
        if (b.type === 'web_search_tool_result' && b.content) {
          for (const sub of (Array.isArray(b.content) ? b.content : [b.content])) {
            if (sub.type === 'text' && sub.text) texts.push(sub.text);
            if (sub.text) texts.push(sub.text);
          }
        }
        // server_tool_result 
        if (b.type === 'server_tool_result' && b.content) {
          for (const sub of (Array.isArray(b.content) ? b.content : [b.content])) {
            if (sub.text) texts.push(sub.text);
          }
        }
      }
      
      const result = texts.join('\n\n');
      console.log('[Claude] Text length:', result.length, 'preview:', result.slice(0, 300));
      
      // If no text at all, dump full response for debugging
      if (!result || result.length === 0) {
        console.log('[Claude] NO TEXT. Full response:', JSON.stringify(response.content).slice(0, 1000));
        // Last resort: stringify entire content and try to find any text
        const dump = JSON.stringify(response.content);
        const textMatch = dump.match(/"text"\s*:\s*"([^"]{20,})"/);
        if (textMatch) return textMatch[1];
      }
      
      return result;
    } catch (err) {
      console.error('[Claude] Error:', err.message || err);
      if (err?.status === 429 && attempt < 2) {
        const wait = 30 + attempt * 20;
        console.log(`Rate limit, waiting ${wait}s...`);
        await sleep(wait * 1000);
        continue;
      }
      throw err;
    }
  }
  return '';
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
