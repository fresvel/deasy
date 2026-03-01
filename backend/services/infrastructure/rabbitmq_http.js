const RABBIT_HTTP_BASE = (process.env.RABBITMQ_HTTP_API || "http://rabbitmq:15672/api").replace(/\/+$/g, "");
const RABBIT_USER = process.env.RABBITMQ_HTTP_USER || "guest";
const RABBIT_PASSWORD = process.env.RABBITMQ_HTTP_PASSWORD || "guest";

const buildAuthHeader = () => `Basic ${Buffer.from(`${RABBIT_USER}:${RABBIT_PASSWORD}`).toString("base64")}`;

const rabbitRequest = async (method, path, body = null) => {
  const response = await fetch(`${RABBIT_HTTP_BASE}${path}`, {
    method,
    headers: {
      Authorization: buildAuthHeader(),
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `RabbitMQ respondio con ${response.status}.`);
  }

  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export const ensureRabbitQueue = async (queueName) => {
  if (!queueName) {
    throw new Error("RabbitMQ requiere un nombre de cola.");
  }
  await rabbitRequest("PUT", `/queues/%2F/${encodeURIComponent(queueName)}`, {
    durable: true,
    auto_delete: false,
    arguments: {}
  });
};

export const publishRabbitMessage = async (queueName, payload) => {
  await ensureRabbitQueue(queueName);
  await rabbitRequest("POST", "/exchanges/%2F/amq.default/publish", {
    properties: {
      delivery_mode: 2,
      content_type: "application/json"
    },
    routing_key: queueName,
    payload: JSON.stringify(payload),
    payload_encoding: "string"
  });
};

export const consumeRabbitMessages = async (queueName, count = 1) => {
  await ensureRabbitQueue(queueName);
  const rows = await rabbitRequest("POST", `/queues/%2F/${encodeURIComponent(queueName)}/get`, {
    count,
    ackmode: "ack_requeue_false",
    encoding: "auto",
    truncate: 500000
  });
  const messages = Array.isArray(rows) ? rows : [];
  return messages.map((message) => {
    let payload = message?.payload;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        // Keep raw payload as-is if it's not valid JSON.
      }
    }
    return {
      ...message,
      payload
    };
  });
};
