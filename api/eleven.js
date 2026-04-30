import process from 'node:process';
import { proxyRequest } from './_proxy.js';

export default async function handler(req, res) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Missing ELEVENLABS_API_KEY' });
    return;
  }

  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const path = url.searchParams.get('path') || '';
  url.searchParams.delete('path');

  try {
    await proxyRequest(req, res, {
      baseUrl: 'https://api.elevenlabs.io',
      path: `/${path}${url.search}`,
      headers: { 'xi-api-key': apiKey },
    });
  } catch (error) {
    res.status(502).json({ error: 'ElevenLabs proxy failed', detail: error.message });
  }
}
