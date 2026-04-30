import process from 'node:process';
import { proxyRequest } from '../_proxy.js';

export default async function handler(req, res) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Missing GROQ_API_KEY' });
    return;
  }

  const parts = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);
  const search = req.url.includes('?') ? `?${req.url.split('?')[1]}` : '';

  try {
    await proxyRequest(req, res, {
      baseUrl: 'https://api.groq.com',
      path: `/${parts.join('/')}${search}`,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch (error) {
    res.status(502).json({ error: 'Groq proxy failed', detail: error.message });
  }
}
