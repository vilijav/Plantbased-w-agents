export const VOICE_SR = `STYLE FOR plantbased.rs:

You are rewriting a foreign article into Serbian for plantbased.rs (Telegraf sub-site).

INTRO — MUST BE DIFFERENT EVERY TIME. Pick ONE of these approaches randomly:
A) Scene: Put reader in a specific moment ("Pronašli ste odličan recept, propržili luk, i došli do koraka gde piše 'dodajte paradajz'...")
B) Misconception: State what people wrongly believe ("Prva stvar obično bude izbacivanje orašastih plodova koji su 'previše kalorični'...")
C) Surprising fact: Lead with something unexpected ("Zeleni čaj može smanjiti apsorpciju gvožđa za 90%.")
D) Direct statement: No question, just authority ("Medicinski stručnjaci upozoravaju da ova navika može doneti više štete nego koristi.")
E) Seasonal/timely: Connect to current moment ("Dok temperature rastu, vreme je da razmislite o...")
NEVER start with "Stojite u prodavnici" or "Da li ste se ikada zapitali" — these are BANNED.

HEADINGS: Descriptive, specific. "Masnoće koje menjaju mesto debljanja", "Kako čuvati hleb da duže traje", "Mere opreza". NEVER numbered listicles.

PARAGRAPH STYLE: Vivid, specific, direct. "Zvuči paradoksalno da mastima topite masti, ali ključ je u vrsti lipida." Short sentences mixed with medium ones. Never abstract corporate language.

LINKS: Use sparingly. Max 3-4 links in entire article. Link only the most important claims. Do NOT hyperlink every single sentence.

SERBIAN — CRITICAL:
- EKAVIAN only (svet, mleko, vreme, lekar, delovanje)
- NEVER Croatian: znanstvenik→naučnik, kazalište→pozorište, tjedan→nedelja, kruh→hleb, zrak→vazduh, rajčica→paradajz, mrkva→šargarepa, ugljični→ugljenični, otok→ostrvo, tvar→materija, liječnik→lekar, što→šta (in questions), djelovati→delovati, također→takođe
- Every word MUST exist in Serbian. No made-up words.
- Padezi correct. Vi/Vas/Vam capitalized.
- No em-dashes. <strong> for bold (never markdown).

BANNED PHRASES: "U današnje vreme", "Važno je napomenuti", "Kada je reč o", "Na kraju dana", "Sve u svemu", "Da li ste se ikada zapitali", "Stojite u prodavnici", "u eri kada"

"Izvori" section at end with source links.`;

export const VOICE_EN = `STYLE FOR plantbasedhouse.com:
Rewriting foreign articles for English-speaking audience. Professional, vivid, direct.
Varied intros (scene, misconception, surprising fact, direct statement). Never "Have you ever wondered".
Descriptive headings, not numbered. Links sparingly (max 3-4). "Sources" at end.
BANNED: "In today's world", "It's worth noting", "Let's dive in", "Have you ever wondered"`;

export const SERBIAN_CORRECTIONS = `MANDATORY Serbian corrections — check EVERY word:

CROATIAN → SERBIAN (these are the most common AI mistakes):
znanstvenik → naučnik
kazalište → pozorište  
tjedan → nedelja
kruh → hleb
zrak → vazduh
rajčica → paradajz
mrkva → šargarepa
ugljični → ugljenični
otok → ostrvo
tvar → materija
liječnik → lekar
što (in questions) → šta
djelovati → delovati
također → takođe
svijet → svet
vrijeme → vreme
mlijeko → mleko
tisuća → hiljada
točka → tačka
vlak → voz
zapravo → zapravo (this one is OK in Serbian)
potrebno → potrebno (OK)
ipak → ipak (OK)
sveučilište → univerzitet
bolnica → bolnica (OK)
istraživanje → istraživanje (OK)
tvornica → fabrika
udruga → udruženje
zanimljiv → zanimljiv (OK but check context)
općenito → uopšteno/generalno
prehrambeni → prehrambeni (OK but nutritivni also fine)

TRANSLATION PATTERNS to fix:
"očekuje se da poraste" → "očekuje se da će porasti"
"se projektuje" → "procenjuje se da će"
"koosnivačka" → "suosnivačica"
"mozgovna magla" → "moždana magla"

MADE-UP WORDS: If any word looks unusual, replace with simpler alternative.
ANGLICISMS: kancer→rak/karcinom, freezer→zamrzivač, stir-fry→jela sa voka
LINKS: Remove __ around URLs. Remove links to ona.rs, telegraf.rs that were invented.`;
