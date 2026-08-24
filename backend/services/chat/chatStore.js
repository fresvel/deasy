// Acceso a datos del chat sobre el núcleo relacional (Fase 5, ex-MongoDB).
// Usa el pool de config/postgres.js (adaptador estilo mysql2).
// Reemplaza a los modelos Mongoose.
//
// IDs: se exponen como STRING (String(n)) para preservar el contrato "id opaco"
// que tenía Mongo (ObjectId.toString()); el front los trata como opacos.

import { getPostgresPool } from "../../config/postgres.js";

const pool = () => getPostgresPool();

export const isValidId = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0;
};

const sid = (v) => (v === null || v === undefined ? null : String(v));
const num = (v) => (v === null || v === undefined ? null : Number(v));

// --- Mappers row -> summary (misma forma que exponían los serializadores) ---

export const buildScope = (row) => ({
  process_id: num(row.scope_process_id),
  scope_unit_id: num(row.scope_unit_id),
  stable_key: row.stable_key ?? null,
  current_definition_id: num(row.scope_current_definition_id),
  origin_definition_id: num(row.scope_origin_definition_id),
});

export const mapConversation = (row, participants = [], unreadCount = 0) => ({
  id: sid(row.id),
  type: row.type,
  title: row.title,
  process_id: num(row.process_id),
  scope: buildScope(row),
  participants: participants.map((p) => ({
    person_id: Number(p.person_id),
    role: p.role || "member",
    joined_at: p.joined_at,
    left_at: p.left_at,
  })),
  created_by: num(row.created_by),
  created_at: row.created_at,
  updated_at: row.updated_at,
  last_message_id: sid(row.last_message_id),
  last_message_at: row.last_message_at,
  archived_at: row.archived_at,
  mobile_summary: row.mobile_summary,
  unread_count: Number(unreadCount || 0),
});

export const mapMessage = (row, reads = [], attachments = []) => ({
  id: sid(row.id),
  conversation_id: sid(row.conversation_id),
  sender_person_id: Number(row.sender_person_id),
  content: row.content,
  content_type: row.content_type,
  attachments: attachments.map((a) => ({
    path: a.path,
    filename: a.filename,
    mime: a.mime,
    size: Number(a.size || 0),
  })),
  reply_to_message_id: sid(row.reply_to_message_id),
  created_at: row.created_at,
  edited_at: row.edited_at,
  deleted_at: row.deleted_at,
  read_by: reads.map((r) => Number(r.person_id)),
  delivery_state: row.delivery_state,
});

export const mapNotification = (row) => ({
  id: sid(row.id),
  recipient_person_id: Number(row.recipient_person_id),
  type: row.type,
  title: row.title,
  body: row.body,
  conversation_id: sid(row.conversation_id),
  message_id: sid(row.message_id),
  channel: row.channel,
  created_at: row.created_at,
  read_at: row.read_at,
});

// --- Conversaciones ---

export async function findConversationById(id) {
  const [rows] = await pool().query(`SELECT * FROM chat_conversations WHERE id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

export async function findConversationForParticipant(id, personId) {
  const [rows] = await pool().query(
    `SELECT c.* FROM chat_conversations c
       JOIN chat_conversation_participants p
         ON p.conversation_id = c.id AND p.person_id = ? AND p.left_at IS NULL
      WHERE c.id = ? LIMIT 1`,
    [Number(personId), id]
  );
  return rows[0] || null;
}

export async function findConversationByStableKey(stableKey, personId = null) {
  if (personId) {
    const [rows] = await pool().query(
      `SELECT c.* FROM chat_conversations c
         JOIN chat_conversation_participants p
           ON p.conversation_id = c.id AND p.person_id = ? AND p.left_at IS NULL
        WHERE c.stable_key = ? LIMIT 1`,
      [Number(personId), String(stableKey)]
    );
    return rows[0] || null;
  }
  const [rows] = await pool().query(`SELECT * FROM chat_conversations WHERE stable_key = ? LIMIT 1`, [String(stableKey)]);
  return rows[0] || null;
}

export async function findProcessThreadForParticipant(processId, personId) {
  const [rows] = await pool().query(
    `SELECT c.* FROM chat_conversations c
       JOIN chat_conversation_participants p
         ON p.conversation_id = c.id AND p.person_id = ? AND p.left_at IS NULL
      WHERE c.type = 'thread' AND c.process_id = ? LIMIT 1`,
    [Number(personId), Number(processId)]
  );
  return rows[0] || null;
}

export async function listConversationsForParticipant(personId, limit) {
  const [rows] = await pool().query(
    `SELECT c.* FROM chat_conversations c
       JOIN chat_conversation_participants p
         ON p.conversation_id = c.id AND p.person_id = ? AND p.left_at IS NULL
      ORDER BY c.last_message_at DESC, c.updated_at DESC
      LIMIT ?`,
    [Number(personId), Number(limit)]
  );
  return rows;
}

export async function loadParticipants(conversationIds) {
  const map = new Map();
  if (!conversationIds.length) return map;
  const [rows] = await pool().query(
    `SELECT conversation_id, person_id, role, joined_at, left_at
       FROM chat_conversation_participants
      WHERE conversation_id IN (?) ORDER BY id ASC`,
    [conversationIds]
  );
  for (const r of rows) {
    const key = String(r.conversation_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return map;
}

export async function unreadCount(conversationId, personId) {
  if (!personId) return 0;
  const [rows] = await pool().query(
    `SELECT COUNT(*) AS c FROM chat_messages m
      WHERE m.conversation_id = ? AND m.sender_person_id <> ?
        AND NOT EXISTS (SELECT 1 FROM chat_message_reads r WHERE r.message_id = m.id AND r.person_id = ?)`,
    [conversationId, Number(personId), Number(personId)]
  );
  return Number(rows[0]?.c || 0);
}

export async function insertConversation(fields) {
  const cols = Object.keys(fields);
  const placeholders = cols.map(() => "?").join(", ");
  const [res] = await pool().query(
    `INSERT INTO chat_conversations (${cols.join(", ")}) VALUES (${placeholders})`,
    cols.map((c) => fields[c])
  );
  return res.insertId;
}

export async function insertParticipants(conversationId, participants) {
  for (const p of participants) {
    await pool().query(
      `INSERT INTO chat_conversation_participants (conversation_id, person_id, role, joined_at, left_at)
       VALUES (?, ?, ?, ?, ?)`,
      [conversationId, Number(p.person_id), p.role, p.joined_at, p.left_at ?? null]
    );
  }
}

export async function replaceParticipants(conversationId, participants) {
  await pool().query(`DELETE FROM chat_conversation_participants WHERE conversation_id = ?`, [conversationId]);
  await insertParticipants(conversationId, participants);
}

export async function updateConversation(conversationId, fields) {
  const cols = Object.keys(fields);
  if (!cols.length) return;
  const setClause = cols.map((c) => `${c} = ?`).join(", ");
  await pool().query(`UPDATE chat_conversations SET ${setClause} WHERE id = ?`, [...cols.map((c) => fields[c]), conversationId]);
}

// --- Mensajes ---

export async function listMessages(conversationId, limit, before) {
  let sql = `SELECT * FROM chat_messages WHERE conversation_id = ?`;
  const params = [conversationId];
  if (before) {
    const beforeDate = new Date(before);
    if (!Number.isNaN(beforeDate.getTime())) {
      sql += ` AND created_at < ?`;
      params.push(beforeDate);
    }
  }
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(Number(limit));
  const [rows] = await pool().query(sql, params);
  return rows;
}

export async function loadReads(messageIds) {
  const map = new Map();
  if (!messageIds.length) return map;
  const [rows] = await pool().query(
    `SELECT message_id, person_id FROM chat_message_reads WHERE message_id IN (?) ORDER BY person_id ASC`,
    [messageIds]
  );
  for (const r of rows) {
    const key = String(r.message_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return map;
}

export async function loadAttachments(messageIds) {
  const map = new Map();
  if (!messageIds.length) return map;
  const [rows] = await pool().query(
    `SELECT message_id, path, filename, mime, size FROM chat_message_attachments
      WHERE message_id IN (?) ORDER BY sort_order ASC, id ASC`,
    [messageIds]
  );
  for (const r of rows) {
    const key = String(r.message_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return map;
}

// Ensambla message summaries cargando reads/attachments en lote.
export async function mapMessages(rows) {
  const ids = rows.map((r) => r.id);
  const [reads, attachments] = await Promise.all([loadReads(ids), loadAttachments(ids)]);
  return rows.map((r) => mapMessage(r, reads.get(String(r.id)) || [], attachments.get(String(r.id)) || []));
}

export async function insertMessage(fields) {
  const cols = Object.keys(fields);
  const placeholders = cols.map(() => "?").join(", ");
  const [res] = await pool().query(
    `INSERT INTO chat_messages (${cols.join(", ")}) VALUES (${placeholders})`,
    cols.map((c) => fields[c])
  );
  const [rows] = await pool().query(`SELECT * FROM chat_messages WHERE id = ? LIMIT 1`, [res.insertId]);
  return rows[0];
}

export async function insertMessageReads(messageId, personIds) {
  for (const pid of personIds) {
    await pool().query(
      `INSERT IGNORE INTO chat_message_reads (message_id, person_id) VALUES (?, ?)`,
      [messageId, Number(pid)]
    );
  }
}

export async function insertAttachments(messageId, attachments) {
  let order = 0;
  for (const a of attachments) {
    await pool().query(
      `INSERT INTO chat_message_attachments (message_id, sort_order, path, filename, mime, size)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [messageId, order++, a.path, a.filename, a.mime ?? null, Number(a.size || 0)]
    );
  }
}

// Marca leídos todos los mensajes de otros en la conversación; añade reads.
export async function markConversationReadForPerson(conversationId, personId) {
  await pool().query(
    `INSERT IGNORE INTO chat_message_reads (message_id, person_id)
       SELECT m.id, ? FROM chat_messages m
        WHERE m.conversation_id = ? AND m.sender_person_id <> ?
          AND NOT EXISTS (SELECT 1 FROM chat_message_reads r WHERE r.message_id = m.id AND r.person_id = ?)`,
    [Number(personId), conversationId, Number(personId), Number(personId)]
  );
  return unreadCount(conversationId, personId);
}

export async function findMessageForConversation(messageId, conversationId) {
  const [rows] = await pool().query(
    `SELECT * FROM chat_messages WHERE id = ? AND conversation_id = ? LIMIT 1`,
    [messageId, conversationId]
  );
  return rows[0] || null;
}

// --- Notificaciones ---

export async function listNotifications(personId, limit) {
  const [rows] = await pool().query(
    `SELECT * FROM chat_notifications WHERE recipient_person_id = ? ORDER BY created_at DESC LIMIT ?`,
    [Number(personId), Number(limit)]
  );
  return rows;
}

export async function insertNotification(fields) {
  const cols = Object.keys(fields);
  const placeholders = cols.map(() => "?").join(", ");
  const [res] = await pool().query(
    `INSERT INTO chat_notifications (${cols.join(", ")}) VALUES (${placeholders})`,
    cols.map((c) => fields[c])
  );
  const [rows] = await pool().query(`SELECT * FROM chat_notifications WHERE id = ? LIMIT 1`, [res.insertId]);
  return rows[0];
}

export async function markNotificationsRead(personId, ids, readAt) {
  await pool().query(
    `UPDATE chat_notifications SET read_at = ?
      WHERE id IN (?) AND recipient_person_id = ? AND read_at IS NULL`,
    [readAt, ids, Number(personId)]
  );
  const [rows] = await pool().query(
    `SELECT * FROM chat_notifications WHERE id IN (?) AND recipient_person_id = ? ORDER BY created_at DESC`,
    [ids, Number(personId)]
  );
  return rows;
}

export async function markConversationNotificationsRead(personId, conversationId, readAt) {
  await pool().query(
    `UPDATE chat_notifications SET read_at = ?
      WHERE recipient_person_id = ? AND conversation_id = ? AND read_at IS NULL`,
    [readAt, Number(personId), conversationId]
  );
  const [rows] = await pool().query(
    `SELECT * FROM chat_notifications WHERE recipient_person_id = ? AND conversation_id = ? ORDER BY created_at DESC`,
    [Number(personId), conversationId]
  );
  return rows;
}
