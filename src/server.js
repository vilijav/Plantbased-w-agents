import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

// API routes
app.use('/api', apiRoutes);

// Dashboard (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🌱 PlantBased Agent running on http://localhost:${PORT}\n`);
});
