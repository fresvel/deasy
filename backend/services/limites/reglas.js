/**
 * Cuánto se puede intentar cada cosa, y CONTRA QUÉ se cuenta.
 *
 * ── LO QUE SE CUENTA IMPORTA MÁS QUE EL NÚMERO ──────────────────────────────────────────────────
 *
 * Un limitador mal apuntado hace más daño que no tenerlo, y hay dos formas clásicas de errarlo:
 *
 *  · **Sólo por IP**: una universidad sale a internet POR NAT, así que el campus entero comparte una
 *    IP pública. «5 intentos por IP» deja fuera a toda la facultad al quinto despiste de cualquiera.
 *  · **Sólo por cuenta**: entonces el limitador ES el arma — quien sepa tu correo te bloquea fallando
 *    adrede.
 *
 * Por eso el sujeto se elige POR ACCIÓN, y en el acceso es el PAR correo+ip: ataca a quien de verdad
 * está fallando, sin castigar al vecino de NAT ni dejar bloquear una cuenta ajena.
 *
 * ⚠️ Los TOPES son una propuesta y se ajustan midiendo. Lo que NO se ajusta a ojo es el `sujeto`:
 * eso es el diseño, y cambiarlo cambia a quién se castiga.
 */
export const SUJETOS = Object.freeze({
  IP: "ip",
  CORREO_E_IP: "correo+ip",
  PERSONA: "person_id",
});

export const REGLAS = Object.freeze({
  // ⚠️ CUESTA DINERO DE UN TERCERO: estas dos son un proxy sin autenticar a un servicio EXTERNO DE
  // PAGO (`webservices.ec`). Cualquiera con un bucle agota la cuota, y el daño NO se ve en nuestra
  // máquina. Son las más estrictas del sistema, y por eso.
  validar_cedula: { ventanaSegundos: 60, tope: 10, sujeto: SUJETOS.IP },
  validar_whatsapp: { ventanaSegundos: 60, tope: 10, sujeto: SUJETOS.IP },

  // Cuesta CPU: la comprobación es bcrypt, cara a propósito. Quien dispara contra el acceso no está
  // sólo probando contraseñas, está gastando nuestro procesador.
  login: { ventanaSegundos: 900, tope: 10, sujeto: SUJETOS.CORREO_E_IP },

  // HOLGADAS a propósito: una sala de informática dando de alta a treinta personas seguidas es
  // legítimo, y es un caso real de esta institución.
  registro: { ventanaSegundos: 3600, tope: 40, sujeto: SUJETOS.IP },
  recuperar_correo: { ventanaSegundos: 3600, tope: 10, sujeto: SUJETOS.IP },
  reset_password: { ventanaSegundos: 3600, tope: 10, sujeto: SUJETOS.IP },

  // Autenticadas: el sujeto es la PERSONA, no dónde está. Cambiar de red no da intentos nuevos.
  // ⚠️ MARGEN CON LAS PRUEBAS, medido el 2026-09-01: la tanda de caracterizacion gasta **9 de estos
  // 20** para la persona 1 en una sola corrida. No molesta hoy --cada `test:char:run` empieza con la
  // base recien puesta, asi que no se acumula entre corridas-- pero si alguien añade una decena de
  // pruebas de verificacion de telefono, la suite empezara a fallar con 429 y el sintoma sera
  // desconcertante: la prueba falla SOLO cuando corre despues de las otras. Si eso pasa, el arreglo
  // es subir este numero a sabiendas, no bajar las pruebas.
  emitir_llave_telefono: { ventanaSegundos: 3600, tope: 20, sujeto: SUJETOS.PERSONA },
});

// ⚠️ **`reenviarMiCodigo` NO ESTÁ AQUÍ, Y ES A PROPÓSITO.** El plan de `C9` decía migrarlo «para
// dejar un solo mecanismo», y al leerlo de cerca resultó que **el suyo es mejor**: cuenta desde el
// `created_at` del ÚLTIMO CÓDIGO ENVIADO, un dato que ya existe y que es exactamente el hecho que se
// quiere frenar.
//
// Traerlo aquí habría creado **dos fuentes de verdad** sobre «cuándo se mandó el último código»: si
// algún día se envía uno por otro camino, el contador de intentos no se enteraría y el freno mentiría.
// Y encima cuesta una fila por reenvío que la otra forma no necesita.
//
// **La regla que queda de esto:** cuando el freno se puede DERIVAR de un dato que ya existe, se
// deriva. Un contador aparte es para lo que no deja rastro — un login fallido, una consulta a un
// servicio externo — que es justo lo que hay en la lista de arriba.

/**
 * Si la base no contesta, ¿se deja pasar o se corta?
 *
 * ⚠️ NO HAY UNA RESPUESTA ÚNICA, y elegir una sola sería un error:
 *
 *  · Se ABRE donde la base ya es imprescindible: sin ella el acceso y el registro no funcionan
 *    igualmente, así que el limitador no puede ser LO QUE LOS ROMPE.
 *  · Se CIERRA donde el endpoint es una comodidad y detrás hay dinero de otro: si no puedo contar,
 *    no llamo.
 */
export const ACCIONES_QUE_CIERRAN_SI_FALLA_LA_BASE = Object.freeze([
  "validar_cedula",
  "validar_whatsapp",
]);
