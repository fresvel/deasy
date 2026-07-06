// Normalización para golden-master.
//
// Los characterization tests deben ser estables entre ejecuciones y entre
// motores de base de datos. Por eso enmascaramos los campos volátiles cuyo
// valor concreto NO forma parte del comportamiento observable:
//   - marcas de tiempo de escritura (created_at, updated_at, ...): dependen del
//     reloj de siembra, no de la lógica.
//   - tokens/JWT y sus claims iat/exp: cambian en cada login.
//
// Los IDs (auto-increment / _id) SÍ se conservan por defecto: con la misma
// semilla determinista deben ser idénticos en MariaDB y en Postgres, y su
// estabilidad es parte del contrato que queremos verificar. Si un flujo crea
// filas nuevas (IDs no deterministas), enmascara esos campos puntualmente con
// la opción `mask`.

const VOLATILE_KEYS = new Set([
  "createdAt", "created_at",
  "updatedAt", "updated_at",
  "deletedAt", "deleted_at",
  "last_message_at", "lastMessageAt",
  "joined_at", "left_at", "read_at", "edited_at", "archived_at",
  "iat", "exp",
  "token", "accessToken", "access_token", "refreshToken", "refresh_token",
  "expiresIn", "expires_in", "expiresAt", "expires_at",
]);

const MASK = "<normalized>";

// Claves que son ids (primarios o foráneos). Con `maskIdKeys` se enmascaran
// TODAS genéricamente: en datos de ejecución los auto-increment derivan entre
// reseeds (baseline usa DELETE, no reinicia AUTO_INCREMENT), y perseguirlas una
// a una es whack-a-mole. El contrato de columnas ya lo fija listFingerprint.
const ID_KEY_RE = /(^id$|_id$|Id$)/;

// Ordena claves de objetos para que las diferencias de orden de serialización
// (frecuentes al cambiar de driver/motor) no generen falsos positivos.
// `drop`: claves a ELIMINAR por completo (no enmascarar) — para campos que
// existen en un motor/store y no en otro (p.ej. `usuario`/`__v` de Mongo que la
// versión SQL no emite), de modo que el golden pase idéntico en ambos.
export function normalize(value, { extraMask = [], keep = [], maskIdKeys = false, drop = [] } = {}) {
  const maskSet = new Set([...VOLATILE_KEYS, ...extraMask]);
  keep.forEach((k) => maskSet.delete(k));
  const dropSet = new Set(drop);

  const shouldMask = (key) =>
    maskSet.has(key) || (maskIdKeys && ID_KEY_RE.test(key) && !keep.includes(key));

  const walk = (node) => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      const out = {};
      for (const key of Object.keys(node).sort()) {
        if (dropSet.has(key)) continue;
        out[key] = shouldMask(key) ? MASK : walk(node[key]);
      }
      return out;
    }
    return node;
  };

  return walk(value);
}

// Reduce una respuesta HTTP a lo que queremos fijar: status + body normalizado.
// Las cabeceras se omiten salvo que se pidan explícitamente (son ruidosas).
export function snapshotShape(response, opts = {}) {
  return {
    status: response.status,
    body: normalize(response.body, opts),
  };
}

// Huella ESTRUCTURAL para respuestas de lista potencialmente grandes.
// En vez de fijar cada fila (frágil y ruidoso), fija el contrato: status,
// conteo y la unión ordenada de claves presentes en los elementos. Un cambio de
// motor/driver que altere qué columnas se devuelven ROMPE esta huella — que es
// exactamente la regresión que buscamos. `pick` permite apuntar a la lista
// dentro de un sobre, p.ej. pick = "data" para { data: [...] }.
export function listFingerprint(response, { pick } = {}) {
  const payload = pick ? response.body?.[pick] : response.body;
  if (!Array.isArray(payload)) {
    return { status: response.status, isArray: false, body: normalize(response.body) };
  }
  const keys = new Set();
  for (const item of payload) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      Object.keys(item).forEach((k) => keys.add(k));
    }
  }
  return {
    status: response.status,
    isArray: true,
    count: payload.length,
    itemKeys: [...keys].sort(),
  };
}
