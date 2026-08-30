# `channels`

La pasarela de canales de mensajería de Deasy: **sostiene conexiones** con Telegram,
WhatsApp y un receptor de SMS para que una persona pueda demostrar que un número de
teléfono es suyo.

**El diseño completo, con sus porqués, está en
[`docs/arquitecturas/microservicio-channels.md`](../docs/arquitecturas/microservicio-channels.md).**
Este README no lo repite: sólo dice cómo se corre.

La regla que decide qué vive aquí y qué no:

> **El servicio guarda CONEXIONES. El backend hace LLAMADAS.**

Así que aquí **no** hay verificación de correo, ni códigos, ni caducidades, ni acceso a la
base de Deasy. Eso es del backend. Aquí sólo hay canales y la política que interpreta lo
que llega por ellos.

```bash
npm test     # los unitarios: no necesitan red, ni Telegram, ni un módem
npm start    # el servicio
```
