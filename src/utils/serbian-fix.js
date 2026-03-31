// Deterministic Croatian → Serbian word replacement
// No AI involved — just find and replace
// This catches what the AI grammar check misses

const REPLACEMENTS = [
  // Croatian → Serbian vocabulary (most common AI mistakes)
  // Format: [regex pattern, replacement]
  
  // Nouns
  [/\bznanstvenici?\b/gi, (m) => m.startsWith('Z') ? 'Naučnici' : 'naučnici'],
  [/\bznanstvenike?\b/gi, (m) => m.startsWith('Z') ? 'Naučnike' : 'naučnike'],
  [/\bznanstvenika?\b/gi, (m) => m.startsWith('Z') ? 'Naučnika' : 'naučnika'],
  [/\bznanstvenikov\b/gi, 'naučnikov'],
  [/\bznanstven(a|o|e|i|u|om|og|im|ih)\b/gi, 'naučn$1'],
  [/\bkazališt(e|a|u|em)\b/gi, 'pozorišt$1'],
  [/\btjeda?n(a|u|e|om|i)?\b/gi, (m) => {
    if (/tjedna/i.test(m)) return 'nedelja'; // genetiv
    return m.replace(/tjeda?n/i, 'nedelj').replace(/om$/,'om').replace(/a$/,'a').replace(/u$/,'u').replace(/e$/,'e').replace(/i$/,'e');
  }],
  [/\bkruh(a|u|om)?\b/gi, (m) => m.replace(/kruh/i, 'hleb')],
  [/\bzrak(a|u|om)?\b/gi, (m) => m.replace(/zrak/i, 'vazduh')],
  [/\botoci?\b/gi, (m) => m.startsWith('O') ? 'Ostrva' : 'ostrva'],
  [/\boток(a|u|om|e|i)?\b/gi, (m) => m.replace(/oток/i, 'ostrv')],
  [/\brajčic(a|e|u|i|om|ama)\b/gi, 'paradajz$1'],
  [/\bmrkv(a|e|u|i|om|ama)\b/gi, 'šargarepa'],
  [/\btisuć(a|e|u|i|ama)\b/gi, 'hilj$1'],  
  [/\btočk(a|e|u|i|om|ama)\b/gi, 'tačk$1'],
  [/\bvlak(ovi)?\b/gi, 'voz'],
  [/\bvlaka\b/gi, 'voza'],
  [/\bvlaku\b/gi, 'vozu'],
  [/\bvlakom\b/gi, 'vozom'],
  [/\btvornic(a|e|u|i|om|ama)\b/gi, 'fabrik$1'],
  [/\budrug(a|e|u|i|om|ama)\b/gi, 'udruženj$1'],
  [/\bsveučilišt(a|e|u|em)\b/gi, 'univerzitet$1'],
  [/\bliječni(k|ka|ku|ci|ke|cima)\b/gi, 'lekar$1'],
  [/\blijek(a|u|ovi|ove)?\b/gi, (m) => m.replace(/lijek/i, 'lek')],
  [/\btvar(i)?\b/gi, 'materij$1'],
  
  // Adverbs/Conjunctions
  [/\btakođer\b/gi, 'takođe'],
  [/\bopćenito\b/gi, 'uopšteno'],
  [/\bmeđutim(?:,)?\s/gi, 'Međutim, '],  // This is same in both but fix spacing
  
  // Ijekavian → Ekavian (the big ones)
  [/\bsvijetu?\b/gi, (m) => m.length > 6 ? 'svetu' : 'svet'],
  [/\bvrijem(e|ena)\b/gi, 'vrem$1'],
  [/\bmlijeko\b/gi, 'mleko'],
  [/\bmliječn(i|a|o|e|ih|im|og|om)\b/gi, 'mlečn$1'],
  [/\bdjel(ovati|ovanje|uje|ovao)\b/gi, 'del$1'],
  [/\bpotreb(no|na|ni|ne)\b/gi, 'potreb$1'], // same in both, OK
  [/\bvrijedi\b/gi, 'vredi'],
  [/\bpovijest\b/gi, 'istorija'],
  [/\bpovijesti\b/gi, 'istorije'],
  [/\bbijel(a|o|i|e|og|om|im|ih)\b/gi, 'bel$1'],
  [/\bcijel(a|o|i|e|og|om|im|ih)\b/gi, 'cel$1'],
  [/\bslijed(i|iti|io|ila|eći)\b/gi, 'sled$1'],
  [/\bpodručj(e|a|u|em|ima)\b/gi, 'oblast$1'], // sometimes 'područje' is used in Serbian too
  
  // Anglicisms
  [/\bkancer(a|u|om|i)?\b/gi, (m) => m.replace(/kancer/i, 'rak')],
  [/\bfreezer(a|u|om|i|e)?\b/gi, 'zamrzivač'],
  [/\bstir-fry\b/gi, 'wok'],
  
  // Common typos/AI errors  
  [/\bugljeni hidrat/gi, 'ugljenični hidrat'],
  [/\bugljični/gi, 'ugljenični'],
  
  // Tone fixes
  [/\beliminacij(a|u|e|om|i)\b/gi, 'gubit$1'],
  [/\bneverovatnih\b/gi, 'značajnih'],
  [/\bneverovatno\b/gi, 'značajno'],
];

// Extract plain text from HTML (skip tags and attributes)
function extractText(html) {
  return html.replace(/<[^>]+>/g, ' ');
}

// Apply replacements to HTML content (carefully, preserving tags)
export function fixSerbianWords(html) {
  let fixed = html;
  let changeCount = 0;
  
  for (const [pattern, replacement] of REPLACEMENTS) {
    const before = fixed;
    if (typeof replacement === 'function') {
      fixed = fixed.replace(pattern, (...args) => {
        // Don't replace inside HTML tags or attributes
        const fullMatch = args[0];
        const offset = args[args.length - 2];
        const str = args[args.length - 1];
        // Check if we're inside a tag
        const before = str.slice(Math.max(0, offset - 50), offset);
        if (before.lastIndexOf('<') > before.lastIndexOf('>')) return fullMatch; // inside tag
        return replacement(fullMatch);
      });
    } else {
      fixed = fixed.replace(pattern, replacement);
    }
    if (fixed !== before) changeCount++;
  }
  
  if (changeCount > 0) {
    console.log(`[SerbianFix] Applied ${changeCount} word corrections`);
  }
  
  return fixed;
}

// Quick check — returns list of Croatian words found
export function findCroatianWords(html) {
  const text = extractText(html).toLowerCase();
  const found = [];
  const checkWords = [
    'znanstvenik', 'kazalište', 'tjedan', 'kruh', 'zrak', 'rajčica', 'mrkva',
    'tisuća', 'točka', 'vlak', 'tvornica', 'udruga', 'sveučilište', 'liječnik',
    'također', 'općenito', 'svijet', 'vrijeme', 'mlijeko', 'djelovanje',
    'povijest', 'bijel', 'cijel', 'kancer', 'ugljični',
  ];
  for (const word of checkWords) {
    if (text.includes(word)) found.push(word);
  }
  return found;
}

export default { fixSerbianWords, findCroatianWords };
