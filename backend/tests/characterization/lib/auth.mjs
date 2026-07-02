// Helper de autenticación.
//
// Login real confirmado en el mapa de la API:
//   POST /users/login  body { cedula, password }  -> 200 { token, expiresIn, user }
// El token es un JWT Bearer que se pasa en Authorization.
//
// Cachea el token por usuario dentro de una ejecución para no re-loguear en cada
// caso (el login es un efecto observable que ya fijamos aparte en auth.test.mjs).

import { post } from "./http.mjs";
import { USERS } from "../config.mjs";

const cache = new Map();

export async function login(user) {
  const res = await post("/users/login", {
    body: { cedula: user.identifier, password: user.password },
  });
  return res; // forma cruda: el llamador decide qué fijar
}

export async function tokenFor(userKey) {
  if (cache.has(userKey)) return cache.get(userKey);
  const user = USERS[userKey];
  if (!user) throw new Error(`Usuario de prueba desconocido: ${userKey}`);

  const res = await login(user);
  if (res.status !== 200 || !res.body?.token) {
    throw new Error(
      `Login de "${userKey}" (cédula ${user.identifier}) falló: ` +
        `status=${res.status} body=${JSON.stringify(res.body)}. ` +
        `¿Están sembrados los usuarios seed y es correcta la password?`,
    );
  }
  cache.set(userKey, res.body.token);
  return res.body.token;
}
