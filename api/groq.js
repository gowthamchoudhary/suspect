import process from 'node:process';
import { proxyRequest } from './_proxy.js';

export default async function handler(req, res) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Missing GROQ_API_KEY' });
    return;
  }

  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const path = url.searchParams.get('path') || '';
  url.searchParams.delete('path');

  try {
    await proxyRequest(req, res, {
      baseUrl: 'https://api.groq.com',
      path: `/${path}${url.search}`,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch (error) {
    res.status(502).json({ error: 'Groq proxy failed', detail: error.message });
  }
}
