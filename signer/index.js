import http from 'http';
import { signDocument } from './signService.js';

const PORT = process.env.SIGNER_PORT || 4000;

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/sign') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: 'Not found. Use POST /sign' }));
    return;
  }

  let body = '';
  req.on('data', (chunk) => { body += chunk.toString(); });
  req.on('end', async () => {
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON body' }));
      return;
    }

    const result = await signDocument(data);

    const statusCode = result.status === 'success' ? 200 : 500;
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  });
});

server.listen(PORT, () => {
  console.log(`Signer service running on port ${PORT}`);
});