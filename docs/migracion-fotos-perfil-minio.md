# Migración de las fotos de perfil a MinIO

Estado: F0–F3 hechas y verificadas en dev. **F4 pendiente**: no se puede cerrar hasta
que las fases anteriores estén desplegadas y la migración haya corrido en cada entorno.

## Por qué

Las fotos de perfil eran el único adjunto del sistema que no vivía en MinIO. Se escribían
en `backend/uploads/profile_photos/` y se servían con `app.use("/uploads", express.static("uploads"))`.
De ahí salían tres problemas:

1. **Se perdían en cada despliegue.** `uploads_data` estaba declarado en `compose.prod.yml`
   y `compose.qa.yml` pero no montado en el servicio `backend`, así que el fichero quedaba
   en la capa efímera del contenedor y `pull_policy: always` lo borraba en cada redeploy,
   dejando `persons.photo_url` apuntando a un 404.
2. **Eran públicas.** El `express.static` se monta antes de cualquier `authMiddleware`, así
   que cualquiera con la URL descargaba la foto de cualquier persona. Además el nombre del
   fichero incluía la cédula, o sea un dato personal en una ruta pública.
3. **Ataban el backend a una sola instancia** y quedaban fuera del respaldo de `minio_data`.

El patrón de referencia para arreglarlo era el de los certificados P12
(`user_certificate_controller.js`): temporal del sistema → objeto en MinIO → `unlink`, y
descarga por un handler autenticado que hace stream. No se copió `buildDossierFileUrl`
(`dossier_controler.js`), que arma URLs contra `MINIO_PUBLIC_ENDPOINT`: esa URL no es
accesible desde el ingress en producción.

## Formatos que puede guardar `persons.photo_url`

`backend/services/users/profilePhotoStorage.js` es el único módulo que los interpreta:

| Formato | Origen | Lectura |
|---|---|---|
| `minio://<bucket>/<objeto>` | formato destino | stream desde MinIO |
| `uploads/profile_photos/x.jpg` | heredado | fichero en disco, confinado a `uploads/` |
| `data:image/png;base64,…` | heredado | se decodifica en memoria |
| `https://…` | avatares importados | el cliente la usa directamente |

## Fases

- **F0 — `fix(docker)`**: montar `uploads_data` en el backend de prod y qa. Protege lo ya
  subido mientras dura la transición.
- **F1 — `feat(users)`**: `GET /users/:cedula/photo` autenticado, que sirve tanto MinIO como
  lo heredado; el frontend descarga el avatar con la sesión y lo expone como object URL
  (`frontend/src/core/services/userPhotoService.js`).
- **F2 — `feat(users)`**: la escritura va a MinIO (`deasy-users`, `users/{cedula}/profile/`),
  el formato se decide por la firma del fichero y no por el mimetype declarado, y la foto
  anterior se borra best-effort.
- **F3 — `feat(scripts)`**: `backend/scripts/migrate_profile_photos.mjs` sube lo heredado.
- **F4 — pendiente**: retirar `express.static("/uploads")`, los montajes de `uploads_data` y
  las ramas legacy del resolver.

## Runbook de despliegue

Por entorno, en este orden:

```bash
# 1. Desplegar F0–F3 (backend + frontend).

# 2. Ver qué hay que migrar, sin escribir nada:
bash scripts/docker-env.sh <env> exec backend node scripts/migrate_profile_photos.mjs --dry-run

# 3. Migrar. --delete-source borra el fichero ya subido; --clear-missing pone a NULL las
#    referencias que apuntan a ficheros que ya no existen.
bash scripts/docker-env.sh <env> exec backend node scripts/migrate_profile_photos.mjs \
  --delete-source --clear-missing

# 4. Comprobar que no queda nada fuera de MinIO (todo debe salir como "yaEnMinio"):
bash scripts/docker-env.sh <env> exec backend node scripts/migrate_profile_photos.mjs --dry-run
```

El script es idempotente y no devuelve error por referencias rotas o URLs externas: solo
las reporta.

## Qué queda para F4

1. Quitar `app.use("/uploads", express.static("uploads"))` de `backend/index.js`.
2. Quitar el montaje `uploads_data` de `compose.dev.yml`, `compose.qa.local.yml`,
   `compose.qa.yml` y `compose.prod.yml`, y la declaración del volumen.
3. Podar del resolver las ramas `legacy-file` y `data-uri` (y sus tests) cuando ningún
   entorno tenga ya referencias de ese tipo.
4. **Sacar del repositorio `backend/uploads/profile_photos/*.jpg`**: hay dos fotos reales
   versionadas, con la cédula en el nombre, que además viajan dentro de la imagen. Si se
   borran hay que dejar un `.gitkeep` en el directorio, porque si la ruta no existe en la
   imagen Docker crea el volumen como `root` y el usuario `node` no puede escribir en él.
   Ojo: borrarlas de HEAD no las saca del historial de git.
