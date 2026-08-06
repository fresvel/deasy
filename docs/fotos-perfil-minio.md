# Fotos de perfil

Las fotos de perfil viven en MinIO, como el resto de adjuntos del sistema. No hay
almacenamiento local ni ninguna URL publica que sirva la imagen.

## Cómo funciona

- **Subida** — `PUT /users/:cedula/photo`. Multer deja el fichero en un temporal del
  sistema, `services/users/profilePhotoStorage.js` lo sube al bucket `deasy-users` bajo
  `users/{cedula}/profile/{timestamp}.{ext}` y borra el temporal. El formato se decide por
  la **firma del fichero**, no por el mimetype que declara el cliente, así que un SVG
  renombrado a `.png` se rechaza con 400. La foto anterior se borra best-effort.
- **Referencia** — `persons.photo_url` guarda `minio://<bucket>/<objeto>`. No es una URL:
  solo el backend sabe resolverla.
- **Lectura** — `GET /users/:cedula/photo` hace stream del objeto tras validar la sesión.
  Basta con estar autenticado y activo: los avatares se ven entre compañeros (listados de
  procesos, chat, firmas), lo que se cierra es el acceso anónimo.
- **Frontend** — `core/services/userPhotoService.js` descarga el avatar con la sesión y lo
  expone como object URL, igual que los PDF del dossier. Cachea por cédula y expone
  `invalidateUserPhoto(cedula)` para cuando el usuario sube una foto nueva.

El patrón es el mismo de los certificados P12 (`user_certificate_controller.js`). No se usa
`buildDossierFileUrl` (`dossier_controler.js`), que arma URLs contra `MINIO_PUBLIC_ENDPOINT`:
esa URL no es accesible desde el ingress en producción.

## De dónde viene esto

Hasta agosto de 2026 las fotos se escribían en `backend/uploads/profile_photos/` y se
servían con `app.use("/uploads", express.static("uploads"))`. Eso daba tres problemas, y los
tres desaparecen al guardarlas en MinIO:

1. **Se perdían en cada despliegue.** El volumen `uploads_data` estaba declarado en los
   overlays de qa y prod pero no montado en el servicio `backend`, así que el fichero
   quedaba en la capa efímera del contenedor y `pull_policy: always` lo borraba en cada
   redeploy, dejando `photo_url` apuntando a un 404.
2. **Eran públicas.** El `express.static` se monta antes de cualquier `authMiddleware`, así
   que cualquiera con la URL descargaba la foto de cualquier persona — y el nombre del
   fichero incluía la cédula.
3. **Ataban el backend a una sola instancia** y quedaban fuera del respaldo de `minio_data`.

La compatibilidad con lo heredado (rutas de disco y data URI en base64) existió durante la
transición y se retiró al no haber datos que conservar. Si aparece un `photo_url` con
formato antiguo, `parsePhotoReference` lo descarta y el usuario ve el avatar por defecto
hasta que vuelva a subir su foto.
