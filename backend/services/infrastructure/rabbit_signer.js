import { randomUUID } from "crypto";
import {
  consumeRabbitMessages,
  ensureRabbitQueue,
  publishRabbitMessage
} from "./rabbitmq_http.js";

const SIGN_REQUEST_QUEUE = process.env.SIGN_REQUEST_QUEUE || "deasy.sign.request";
const SIGN_VALIDATE_REQUEST_QUEUE = process.env.SIGN_VALIDATE_REQUEST_QUEUE || "deasy.sign.validate.request";
const SIGN_RESPONSE_QUEUE_PREFIX = process.env.SIGN_RESPONSE_QUEUE_PREFIX || "deasy.sign.response";
const SIGN_TIMEOUT_MS = Number(process.env.SIGN_TIMEOUT_MS || 120000);
const SIGN_POLL_MS = Number(process.env.SIGN_POLL_MS || 1000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const requestSignerQueueJob = async (queue, payload) => {
  const correlationId = randomUUID();
  const responseQueue = `${SIGN_RESPONSE_QUEUE_PREFIX}.${correlationId}`;

  await ensureRabbitQueue(responseQueue);
  await publishRabbitMessage(queue, {
    ...payload,
    correlationId,
    responseQueue
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < SIGN_TIMEOUT_MS) {
    const messages = await consumeRabbitMessages(responseQueue, 1);
    const message = messages[0]?.payload;
    if (message) {
      if (message.status === "success") {
        return message;
      }
      throw new Error(message.message || "El signer respondió con error.");
    }
    await sleep(SIGN_POLL_MS);
  }

  throw new Error("Tiempo de espera agotado para la respuesta del signer.");
};

export const requestSignerJob = async (payload) =>
  requestSignerQueueJob(SIGN_REQUEST_QUEUE, payload);

export const requestSignerValidationJob = async (payload) =>
  requestSignerQueueJob(SIGN_VALIDATE_REQUEST_QUEUE, payload);
