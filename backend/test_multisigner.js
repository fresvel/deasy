import amqp from 'amqplib';

const RABBITMQ_URL = 'amqp://localhost:5672';
const REQUEST_QUEUE = 'multisigner/request';

const testMessage = {
  signType: 'coordinates',
  coordinates: { page: 1, x: 100, y: 200 },
  minioPdfPath: 'd.pdf',
  stampText: 'Juan Pérez',
  finalPath: 'signed_test.pdf',
  minioCertPath: 'cert.p12',
  certPassword: 'Password123'
};

async function sendTestMessage() {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue(REQUEST_QUEUE);
  channel.sendToQueue(REQUEST_QUEUE, Buffer.from(JSON.stringify(testMessage)));
  console.log('Mensaje de prueba enviado');
  await channel.close();
  await connection.close();
}

sendTestMessage().catch(console.error);