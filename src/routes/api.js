import { Router } from 'express';
import { getArticles, getArticle, deleteArticle, getSources } from '../db/store.js';
import { generateArticle, autoGenerate } from '../agents/pipeline.js';
import { discoverTopics, findAngles } from '../agents/research.js';

const router = Router();

// ─── Articles ───
router.get('/articles', (req, res) => {
  const status = req.query.status || null;
  res.json(getArticles(status));
});

router.get('/articles/:id', (req, res) => {
  const article = getArticle(req.params.id);
  if (!article) return res.status(404).json({ error: 'Not found' });
  const sources = getSources(req.params.id);
  res.json({ ...article, sources });
});

router.delete('/articles/:id', (req, res) => {
  deleteArticle(req.params.id);
  res.json({ ok: true });
});

// ─── Discovery ───
router.post('/discover', async (req, res) => {
  try {
    const { category = 'general', lang = 'sr' } = req.body;
    const topics = await discoverTopics(category, lang);
    res.json(topics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/angles', async (req, res) => {
  try {
    const { topic } = req.body;
    const angles = await findAngles(topic);
    res.json(angles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Generate ───
router.post('/generate', async (req, res) => {
  const { title, angle, sourceUrl, lang, category, length, tone } = req.body;
  
  // Start generation in background, return immediately
  res.json({ status: 'started', message: `Generating: ${title}` });
  
  // Run pipeline async
  generateArticle({ title, angle, sourceUrl, lang, category, length, tone })
    .then(article => console.log(`[API] Article ready: ${article.id}`))
    .catch(err => console.error(`[API] Generation failed: ${err.message}`));
});

router.post('/auto-generate', async (req, res) => {
  const { category, lang, length, tone } = req.body;
  
  res.json({ status: 'started', message: 'Auto-generating article...' });
  
  autoGenerate({ category, lang, length, tone })
    .then(article => console.log(`[API] Auto article ready: ${article.id}`))
    .catch(err => console.error(`[API] Auto generation failed: ${err.message}`));
});

export default router;
