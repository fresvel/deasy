import http from 'http';
import amqp from 'amqplib';
import { signDocument } from './signService.js';

const PORT = process.env.SIGNER_PORT || 4000;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672';
const SIGN_REQUEST_QUEUE = process.env.SIGN_REQUEST_QUEUE || 'deasy.sign.request';

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

const startRabbitWorker = async () => {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue(SIGN_REQUEST_QUEUE, { durable: true });
  channel.prefetch(1);
  console.log(`[signer] RabbitMQ conectado en ${RABBITMQ_URL}`);
  console.log(`[signer] Escuchando solicitudes en ${SIGN_REQUEST_QUEUE}`);

  await channel.consume(SIGN_REQUEST_QUEUE, async (message) => {
    if (!message) return;
    let data;
    try {
      data = JSON.parse(message.content.toString());
    } catch (error) {
      console.error('[signer] Payload RabbitMQ inválido:', error);
      channel.ack(message);
      return;
    }

    const responseQueue = data.responseQueue;
    if (!responseQueue) {
      console.error('[signer] Solicitud RabbitMQ sin responseQueue');
      channel.ack(message);
      return;
    }

    try {
      const result = await signDocument(data);
      await channel.assertQueue(responseQueue, { durable: true });
      channel.sendToQueue(
        responseQueue,
        Buffer.from(JSON.stringify({
          ...result,
          correlationId: data.correlationId || null
        })),
        {
          persistent: true,
          contentType: 'application/json'
        }
      );
      channel.ack(message);
    } catch (error) {
      console.error('[signer] Error procesando trabajo:', error);
      channel.sendToQueue(
        responseQueue,
        Buffer.from(JSON.stringify({
          status: 'error',
          message: error.message || 'Error interno del signer.',
          correlationId: data.correlationId || null
        })),
        {
          persistent: true,
          contentType: 'application/json'
        }
      );
      channel.ack(message);
    }
  });
};

startRabbitWorker().catch((error) => {
  console.error('[signer] Error RabbitMQ:', error);
  process.exit(1);
});
