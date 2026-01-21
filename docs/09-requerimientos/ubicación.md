# Captura de ubicación por QR (Web primero, APP después) + sincronización a PC vía MQTT

## Objetivo
Permitir que un usuario que está registrándose/actualizando datos en una PC pueda “transferir” su ubicación actual desde un celular, escaneando un QR. El QR abre una página web móvil que solicita permiso de ubicación y envía coordenadas al servidor; el servidor notifica a la sesión de PC (idealmente en tiempo real) vía MQTT.

Nota clave: en web, la Geolocation API funciona en “secure contexts” (HTTPS) y requiere consentimiento del usuario. En Chrome, geolocalización sobre HTTP está bloqueada. Referencias: MDN y Chrome Dev. :contentReference[oaicite:0]{index=0}

---

## Arquitectura recomendada (mínimo viable)
PC (browser)  ⇄  Backend  ⇄  MQTT Broker
   ↑                    ↑
   │                    │
   └── (QR) ── Móvil (browser) ──(POST ubicación)──┘

Dos variantes para “push” a la PC:
A) PC se conecta al broker MQTT por WebSockets (MQTT-over-WS).
B) PC se conecta a su Backend (WebSocket/SSE) y el Backend hace puente con MQTT.

Si su prioridad es seguridad y simplicidad operativa, normalmente B) es más controlable (no expone credenciales/broker al frontend). Para MQTT en navegador se usa WebSockets porque el navegador no habla MQTT “nativo”. :contentReference[oaicite:1]{index=1}

---

## Flujo de extremo a extremo (token de emparejamiento)
1) En la PC (formulario):
   - Backend crea una `location_session` con `token` aleatorio (alta entropía) y TTL corto (1–3 min).
   - Devuelve un QR con URL:
     `https://su-dominio.com/location/pair/<token>`

2) En el móvil:
   - Al abrir la URL, mostrar explicación y un botón explícito “Enviar mi ubicación”.
   - En el clic, pedir ubicación con `navigator.geolocation.getCurrentPosition(...)`.
   - Enviar al backend: `{token, lat, lon, accuracy, ts}`.

Recomendación UX: solicitar geolocalización por acción del usuario (clic) reduce fricción y bloqueos percibidos. :contentReference[oaicite:2]{index=2}

3) Backend:
   - Valida token (vigente/no usado).
   - Persiste y publica evento:
     `topic: reg/<token>/location`
     `payload: {"lat":..,"lon":..,"accuracy":..,"ts":..}`

4) PC:
   - Ya está suscrita a `reg/<token>/location` (vía MQTT-over-WS o puente).
   - Recibe coordenadas, rellena campos y centra un mapa.

---

## Contratos de API (sugeridos)

### 1) Crear sesión (PC)
`POST /api/location-sessions`
Respuesta:
```json
{
  "token": "base64url_32bytes",
  "expires_at": "2026-01-17T12:34:56Z",
  "qr_url": "https://su-dominio.com/location/pair/<token>"
}

