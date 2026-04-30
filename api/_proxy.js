import { Buffer } from 'node:buffer';

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function copyHeaders(headers, blocked = []) {
  const blockedSet = new Set([
    'connection',
    'content-length',
    'host',
    'transfer-encoding',
    ...blocked.map((header) => header.toLowerCase()),
  ]);

  return Object.fromEntries(
    Object.entries(headers).filter(([key]) => !blockedSet.has(key.toLowerCase())),
  );
}

export async function proxyRequest(req, res, { baseUrl, path, headers }) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const target = new URL(path, baseUrl);
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);

  const upstream = await fetch(target, {
    method: req.method,
    headers: {
      ...copyHeaders(req.headers, ['authorization', 'xi-api-key']),
      ...headers,
    },
    body,
  });

  res.statusCode = upstream.status;
  upstream.headers.forEach((value, key) => {
    if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });

  const buffer = Buffer.from(await upstream.arrayBuffer());
  res.end(buffer);
}
