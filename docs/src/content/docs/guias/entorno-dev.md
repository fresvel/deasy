---
title: Levantar el entorno de desarrollo
description: Cómo arrancar la pila de Docker, y cómo trabajar en paralelo con las pilas A–D sin pisar a nadie.
sidebar:
  order: 1
---

Todo el sistema está dockerizado. No se ejecuta `npm` ni `pnpm` en el host: los binarios,
las versiones de Node y los `node_modules` viven dentro de los contenedores.

## Arrancar

```bash
bash scripts/docker-env.sh dev up -d --build
bash scripts/docker-env.sh dev ps
bash scripts/docker-env.sh dev logs -f backend
```

Con eso tienes la aplicación en `http://localhost:8088` (o `https://localhost:8443`) y
esta documentación en `http://localhost:4321`.

## Trabajar en paralelo: las pilas A–D

**Si hay varias sesiones trabajando a la vez, cada una necesita su pila.** Los montajes de
código son *relativos* (`../backend:/app/backend`), así que levantar `dev` desde otro
worktree **no crea una pila nueva: recrea los mismos contenedores apuntando al código
nuevo**. Ya pasó tres veces, y las dos primeras se midieron pruebas contra código ajeno
sin que nadie se enterara.

```bash
bash scripts/stack.sh status                              # qué pila hay y qué worktree monta
bash scripts/stack.sh c up -d --build                     # levanta la pila C con ESTE worktree
bash scripts/stack.sh c exec -T backend npm run test:unit
bash scripts/stack.sh c down                              # OBLIGATORIO al terminar
```

| Pila | Proyecto | proxy | https | postgres | minio | signer | rabbit | docs |
|---|---|---|---|---|---|---|---|---|
| **A** | `deasy-dev` | 8088 | 8443 | 5432 | 9000 | 4000 | 5672 | 4321 |
| **B** | `deasy-b` | 8188 | 8543 | 5532 | 9100 | 4100 | 5772 | 4421 |
| **C** | `deasy-c` | 8288 | 8643 | 5632 | 9200 | 4200 | 5872 | 4521 |
| **D** | `deasy-d` | 8388 | 8743 | 5732 | 9300 | 4300 | 5972 | 4621 |

Detalles que cuestan tiempo si no se saben:

- **La pila A ES la `dev` de siempre.** `docker-env.sh dev` y `stack.sh a` son la misma
  pila; no hay una quinta.
- Cada pila tiene **base, MinIO, RabbitMQ, `node_modules` y red propios**. Compartirlos era
  el fallo: con el mismo volumen de Postgres, un `test:char:run` **resetea la base de la
  otra sesión**.
- **Quien levanta B, C o D la baja al terminar.** Cuatro pilas son 28 contenedores.
- El primer `up --build` de cada pila cuesta un `npm install` completo, porque el volumen de
  `node_modules` es suyo. A partir de ahí es rápido.
- `stack.sh` **comprueba** que la pila que vas a usar monta el worktree desde el que la
  llamas, y se niega si no coincide. Para saltárselo a sabiendas, `DEASY_STACK_FORCE=1`.

## Usuarios de referencia

Los crea el bootstrap (`/setup` → «usar datos de ejemplo»); no hay ningún seed SQL
alternativo. Ojo con la contraseña del gestor, que **no** sigue el patrón de las otras:

| Rol | Cédula | Contraseña |
|---|---|---|
| admin | `1234567890` | `Demo1234!` |
| gestor | `0987654321` | `Gestor1234!` |
| usuario | `1122334455` | `Demo1234!` |

El router bloquea el espacio de usuario para el admin (`meta: { blockedForAdmin: true }`),
así que **para probar el dossier o las firmas hay que entrar como gestor o usuario**.

## Editar esta documentación

Es el mismo bucle que el del código:

1. Levanta el servicio: `bash scripts/docker-env.sh dev up -d docs`
2. Abre `http://localhost:4321`
3. Edita cualquier fichero de `docs/src/content/docs/` con tu editor de siempre
4. Guarda — el navegador se recarga solo

La carpeta **es** la URL: `docs/src/content/docs/guias/entorno-dev.md` se publica en
`/guias/entorno-dev`. No hay que registrar la página en ningún sitio, y el menú lateral se
llena solo porque el grupo «Guías» está configurado con `autogenerate`.

:::caution[Dependencias nuevas]
El volumen de `node_modules` **sombrea** el de la imagen. Si añades una dependencia al
sitio, instálala **dentro del contenedor** — un `pnpm install` en el host no se ve dentro:

```bash
bash scripts/docker-env.sh dev exec docs pnpm add <paquete>
```
:::

