import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../data/db.json');

function ensureDir() {
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function load() {
  try {
    if (existsSync(DB_PATH)) return JSON.parse(readFileSync(DB_PATH, 'utf-8'));
  } catch {}
  return { articles: [], sources: [], research: [], topics: [] };
}

function save(data) {
  ensureDir();
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ─── Articles ───
export function getArticles(status = null) {
  const db = load();
  if (status) return db.articles.filter(a => a.status === status);
  return db.articles;
}

export function getArticle(id) {
  return load().articles.find(a => a.id === id);
}

export function createArticle(article) {
  const db = load();
  const id = 'art_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const record = {
    id,
    ...article,
    status: article.status || 'draft', // draft | researching | writing | reviewing | ready | published
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.articles.push(record);
  save(db);
  return record;
}

export function updateArticle(id, updates) {
  const db = load();
  const idx = db.articles.findIndex(a => a.id === id);
  if (idx === -1) return null;
  db.articles[idx] = { ...db.articles[idx], ...updates, updatedAt: new Date().toISOString() };
  save(db);
  return db.articles[idx];
}

export function deleteArticle(id) {
  const db = load();
  db.articles = db.articles.filter(a => a.id !== id);
  save(db);
}

// ─── Sources (verified facts, quotes, studies linked to an article) ───
export function getSources(articleId) {
  return load().sources.filter(s => s.articleId === articleId);
}

export function addSource(source) {
  const db = load();
  const id = 'src_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const record = {
    id,
    ...source,
    verified: source.verified || false,
    createdAt: new Date().toISOString(),
  };
  db.sources.push(record);
  save(db);
  return record;
}

export function addSources(sources) {
  const db = load();
  const records = sources.map(source => ({
    id: 'src_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    ...source,
    verified: source.verified || false,
    createdAt: new Date().toISOString(),
  }));
  db.sources.push(...records);
  save(db);
  return records;
}

// ─── Topics (to track what's been covered) ───
export function getTopics() {
  return load().topics;
}

export function addTopic(topic) {
  const db = load();
  db.topics.push({ ...topic, createdAt: new Date().toISOString() });
  save(db);
}

export function topicExists(title) {
  const db = load();
  const normalized = title.toLowerCase().trim();
  return db.articles.some(a => 
    a.title && a.title.toLowerCase().includes(normalized.slice(0, 30))
  );
}

export default { getArticles, getArticle, createArticle, updateArticle, deleteArticle, getSources, addSource, addSources, getTopics, addTopic, topicExists };
