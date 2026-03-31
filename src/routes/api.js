import { Router } from 'express';
import { getArticles, getArticle, deleteArticle, getSources } from '../db/store.js';
import { generateArticle, discover } from '../agents/pipeline.js';

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

// ─── Discover articles to rewrite ───
router.post('/discover', async (req, res) => {
  try {
    const { category = 'general', lang = 'sr' } = req.body;
    const articles = await discover({ category, lang });
    res.json(articles);
  } catch (err) {
    console.error('[API] Discover error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Generate (rewrite a source article) ───
router.post('/generate', async (req, res) => {
  const { title, angle, sourceUrl, lang, category, length, tone, contentType } = req.body;
  
  if (!sourceUrl) {
    return res.status(400).json({ error: 'sourceUrl is required — pick an article to rewrite' });
  }

  res.json({ status: 'started', message: `Rewriting: ${title}` });
  
  generateArticle({ title, angle, sourceUrl, lang, category, length, tone, contentType })
    .then(article => console.log(`[API] Article ready: ${article.id}`))
    .catch(err => console.error(`[API] Failed: ${err.message}`));
});

export default router;
