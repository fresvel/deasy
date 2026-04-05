import { logChatError, logChatInfo } from "./chat_logging.js";

const DEFAULT_EMQX_API_BASE_URL = "http://emqx:18083/api/v5";
const DEFAULT_EMQX_API_USERNAME = "admin";
const DEFAULT_EMQX_API_PASSWORD = "public";
const TOKEN_TTL_MS = 5 * 60 * 1000;

const buildJsonPayload = (payload) => Buffer.from(JSON.stringify(payload)).toString("base64");

export default class ChatRealtimePublisherService {
  constructor() {
    this.apiBaseUrl = String(process.env.EMQX_API_BASE_URL || DEFAULT_EMQX_API_BASE_URL).replace(/\/$/, "");
    this.username = String(process.env.EMQX_API_USERNAME || DEFAULT_EMQX_API_USERNAME);
    this.password = String(process.env.EMQX_API_PASSWORD || DEFAULT_EMQX_API_PASSWORD);
    this.enabled = String(process.env.CHAT_REALTIME_ENABLED || "true").trim().toLowerCase() !== "false";
    this.authToken = null;
    this.authTokenExpiresAt = 0;
  }

  async getAuthorizationHeader() {
    const now = Date.now();
    if (this.authToken && now < this.authTokenExpiresAt) {
      return `Bearer ${this.authToken}`;
    }

    const response = await fetch(`${this.apiBaseUrl}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: this.username,
        password: this.password
      })
    });

    if (!response.ok) {
      const responseText = await response.text();
      const error = new Error(`No se pudo autenticar el publicador realtime en EMQX (${response.status}).`);
      error.status = 502;
      error.details = responseText;
      throw error;
    }

    const data = await response.json();
    this.authToken = String(data?.token || "");
    this.authTokenExpiresAt = now + TOKEN_TTL_MS;
    return `Bearer ${this.authToken}`;
  }

  async publish(topic, payload, { qos = 0, retain = false } = {}) {
    const authorizationHeader = await this.getAuthorizationHeader();
    const response = await fetch(`${this.apiBaseUrl}/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorizationHeader
      },
      body: JSON.stringify({
        topic,
        qos,
        retain,
        payload: buildJsonPayload(payload),
        payload_encoding: "base64"
      })
    });

    if (!response.ok) {
      const responseText = await response.text();
      logChatError("chat.realtime.publish_failed", {
        topic,
        status: response.status,
        details: responseText
      });
      const error = new Error(`No se pudo publicar evento realtime en EMQX (${response.status}).`);
      error.status = 502;
      error.details = responseText;
      throw error;
    }

    return {
      topic,
      qos,
      retain
    };
  }

  async publishMessageCreated(payload) {
    if (!this.enabled) {
      return { published: false, reason: "disabled_by_env" };
    }

    const conversationId = payload?.conversation?.id;
    const messageId = payload?.message?.id;
    if (!conversationId || !messageId) {
      return { published: false, reason: "missing_message_context" };
    }

    const publications = [];
    const envelope = {
      event: "chat.message.created",
      conversation: payload.conversation,
      message: payload.message,
      recipient_person_ids: payload.recipient_person_ids || []
    };

    publications.push(
      await this.publish(`conversations/${conversationId}/messages`, envelope)
    );

    const uniqueRecipientIds = Array.from(
      new Set(
        (payload.recipient_person_ids || [])
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0)
      )
    );

    for (const recipientPersonId of uniqueRecipientIds) {
      publications.push(
        await this.publish(`users/${recipientPersonId}/notifications`, {
          event: "chat.notification.created",
          conversation_id: conversationId,
          message_id: messageId,
          recipient_person_id: recipientPersonId,
          title: payload?.conversation?.title || "Chat del proceso",
          body: payload?.message?.content || "Nuevo mensaje"
        })
      );
    }

    const processId = Number(
      payload?.conversation?.scope?.process_id
      || payload?.conversation?.process_id
      || 0
    );
    if (processId > 0) {
      publications.push(
        await this.publish(`processes/${processId}/thread`, envelope)
      );
    }

    logChatInfo("chat.realtime.published", {
      conversation_id: conversationId,
      message_id: messageId,
      publications_count: publications.length
    });

    return {
      published: true,
      publications
    };
  }
}
