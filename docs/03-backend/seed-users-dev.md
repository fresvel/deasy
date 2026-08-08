# Usuarios de desarrollo

Las cuentas de desarrollo **no vienen de un seed SQL**: las crea el **bootstrap del sistema**.
Con la base vacia, el backend arranca en modo bootstrap y el frontend redirige a `/setup`
(`SystemBootstrapView`); ahi se marca la casilla **"Usar datos de ejemplo"** en cada bloque
(administrador, gestor y usuario) y se envia el formulario, que llama a
`POST /deasy/v1/system/bootstrap/initialize`.

> Estas credenciales son solo para entornos **locales o de desarrollo**. No deben usarse en QA,
> produccion ni en ambientes con datos reales.

## Credenciales

El login es por **cedula**, no por correo. Los correos de ejemplo (`admin@institucion.edu.ec`,
`gestor@institucion.edu.ec`, `usuario@institucion.edu.ec`) sirven para notificaciones, no para
autenticarse.

| Rol | Cedula | Contrasena |
| --- | --- | --- |
| Admin | `1234567890` | `Demo1234!` |
| Gestor | `0987654321` | `Gestor1234!` |
| Usuario | `1122334455` | `Demo1234!` |

Dos avisos que ahorran tiempo perdido:

- **La contrasena del gestor no es `Demo1234!`**, es `Gestor1234!`. Es la unica que se sale del
  patron.
- El **gestor conserva ademas el rol de usuario** (`Usuario`, permisos `dossier.*`) aparte de
  `GestorProcesos`. Por eso sirve para probar el dossier propio sin cambiar de cuenta.

## El admin no puede entrar a `/home` ni a `/perfil`

El router del frontend marca esas rutas con `meta: { blockedForAdmin: true }` y el guard
redirige al admin a `/admin`. Estan bloqueadas para el admin:

- `/home`
- `/home/documentos`
- `/home/firmas`
- `/perfil` y todas sus rutas hijas (el `meta` se hereda)

Es decir: **para probar el dossier o las firmas hay que entrar como gestor o como usuario**, no
como admin.

## Reinstalar desde cero

```bash
bash scripts/reset-system.sh dev
```

Deja PostgreSQL y los buckets de MinIO vacios, recicla `backend` y `signer`, y el backend vuelve
a modo bootstrap. No toca RabbitMQ.
Despues, en el navegador: `/setup` → **"Usar datos de ejemplo"** en los tres bloques → enviar.

## Datos de ejecucion para probar HomeView

El bootstrap deja un organigrama completo pero **muy poca carga operativa**: un solo proceso (el
"Proceso por defecto", `routed`). Con eso `/home` no se puede verificar de verdad — no hay
multiseleccion de procesos, ni encabezados de grupo, ni entregables `single`/`replicated`.

Para poblar unidades, tareas y entregables de la **persona 3** (`1122334455`):

```bash
bash scripts/docker-env.sh dev exec -T backend node /app/backend/scripts/seed_dev_rich.mjs
```

⚠️ Los **tests de caracterizacion resetean la base de dev** (`test:char:run` hace reset +
bootstrap + seed). Tras correrlos hay que volver a ejecutar `seed_dev_rich.mjs` o la persona 3 se
queda sin datos de ejecucion.
