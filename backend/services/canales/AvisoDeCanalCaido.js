import { getPostgresPool } from "../../config/postgres.js";
import { transporter } from "../../lib/mailer.js";
import { hayCorreoConfigurado } from "../mail/configuracionDeCorreo.js";

/**
 * A quién se le dice que un canal lleva caído, y por dónde.
 *
 * ── POR QUÉ CORREO Y NO SÓLO UNA NOTIFICACIÓN ───────────────────────────────────────────────────
 *
 * **El correo es la única vía que alcanza a alguien que NO está mirando la aplicación**, y eso es
 * exactamente el problema que esta tarea existe para resolver: el 2026-08-31 la información estaba
 * disponible y nadie la miró. Una notificación dentro de la app hereda el mismo defecto que la
 * pantalla. Se manda además, para quien sí esté trabajando dentro.
 *
 * ⚠️ **Y NO se avisa por Telegram ni por WhatsApp**, aunque el sistema sepa hablar por ahí: el fallo
 * que hay que notificar **es justo el que impide notificarlo**.
 *
 * ── A QUIÉN ─────────────────────────────────────────────────────────────────────────────────────
 *
 * A quien tenga el permiso **`channels.read`**, que sale del RBAC en vez de una lista aparte: si
 * mañana alguien recibe el permiso, empieza a recibir avisos sin tocar código, y si se le quita,
 * dejan de llegarle. Una segunda lista sería una segunda cosa que mantener y que se olvida.
 */
export default class AvisoDeCanalCaido {
  constructor({ pool = null, realtime = null } = {}) {
    this.pool = pool;
    this.realtime = realtime;
  }

  #pool() {
    return this.pool ?? getPostgresPool();
  }

  async canalCaido({ canal, salud, detalle, minutos }) {
    const destinatarios = await this.quienDebeSaberlo();
    if (!destinatarios.length) {
      // Que no haya a quién avisar ES un problema, y hay que decirlo en vez de callar.
      console.error(`[vigilante] ${canal} lleva ${minutos} min en «${salud}» y NADIE tiene channels.read`);
      return;
    }

    const asunto = `Deasy: el canal ${canal} lleva ${minutos} minutos sin funcionar`;
    const cuerpo =
      `El canal ${canal} está en estado «${salud}» desde hace ${minutos} minutos.\n\n` +
      `${detalle ?? ""}\n\n` +
      `Mientras siga así, nadie puede verificar su teléfono por ese canal.`;

    await Promise.all([
      this.porCorreo(destinatarios, asunto, cuerpo),
      this.porNotificacion(destinatarios, asunto, cuerpo),
    ]);
  }

  /** Sale del RBAC: quien tenga `channels.read` o `channels.manage`. */
  async quienDebeSaberlo() {
    const [filas] = await this.#pool().query(
      `SELECT DISTINCT p.id, e.direccion
         FROM persons p
         INNER JOIN role_assignments ra ON ra.person_id = p.id
         INNER JOIN role_permissions rp ON rp.role_id = ra.role_id
         INNER JOIN permissions perm ON perm.id = rp.permission_id
         INNER JOIN resources r ON r.id = perm.resource_id
         INNER JOIN actions a ON a.id = perm.action_id
         LEFT JOIN emails e ON e.person_id = p.id
        WHERE r.code = 'channels' AND a.code IN ('read', 'manage')`
    );
    return filas ?? [];
  }

  async porCorreo(destinatarios, asunto, cuerpo) {
    // Sin correo configurado no se rompe nada: se dice y se sigue. La notificación en la app llega
    // igual, y un vigilante que se cae por no poder avisar es peor que uno que avisa a medias.
    if (!hayCorreoConfigurado()) {
      console.warn("[vigilante] no hay correo configurado: el aviso va sólo a la aplicación");
      return;
    }
    const correos = destinatarios.map((d) => d.direccion).filter(Boolean);
    if (!correos.length) return;
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: correos.join(", "),
        subject: asunto,
        text: cuerpo,
      });
    } catch (error) {
      console.error(`[vigilante] no se pudo enviar el aviso por correo: ${error.message}`);
    }
  }

  async porNotificacion(destinatarios, titulo, cuerpo) {
    for (const destinatario of destinatarios) {
      try {
        await this.#pool().query(
          `INSERT INTO chat_notifications (recipient_person_id, type, title, body)
           VALUES (?, ?, ?, ?)`,
          [destinatario.id, "canal_caido", titulo, cuerpo]
        );
        this.realtime?.emitToUser?.(destinatario.id, "canal:caido", { titulo, cuerpo });
      } catch (error) {
        console.error(`[vigilante] no se pudo notificar a ${destinatario.id}: ${error.message}`);
      }
    }
  }
}
