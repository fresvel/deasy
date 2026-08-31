import { Router } from 'express';

// ⚠️ ESTE ROUTER SE VACIO EL 2026-08-31. Tenia una sola ruta, `POST /email/verify`, que aceptaba
// `{ user_id, code }` SIN SESION: cualquiera podia probar codigos contra la cuenta de cualquiera --y
// de paso averiguar que identificadores existen-- con seis cifras y sin limitador de intentos.
//
// Su sustituta vive en `user_router` y va sobre `me`:
//
//     POST /users/me/verificacion/correo            (autenticada)
//     POST /users/me/verificacion/correo/reenviar   (autenticada, un codigo por minuto)
//
// El fichero se conserva vacio a proposito: `ROUTES.email` sigue montado, y dejarlo aqui hace
// visible que la ruta se RETIRO en vez de que alguien la busque y crea que nunca existio.
const router = Router();

export default router;
