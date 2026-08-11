> ⚠️ **ARCHIVADO — no es fuente de verdad.**
> Este documento describe el sistema tal como era antes de la reorganizacion de `docs/`.
> Puede citar MariaDB, MongoDB, EMQX/MQTT o rutas que ya no existen. Se conserva por su
> valor historico. Para el estado actual, ver el `README.md` de la raiz.

# Documentación de controllers que no existen

Archivados el 2026-08-08. Estas tres páginas describían controllers que **no están en el
repositorio**: no hay `facultad_controler.js`, `perfil_controler.js` ni `vacancy_controler.js` en
`backend/controllers/`, ni con ese nombre ni con otro parecido.

Se conservan por si documentan algo que se quiso construir y no llegó a existir. **No son
referencia de nada**: describen código que nunca vas a encontrar.

Comprobado con:

```bash
for f in $(find docs/03-backend/02-controllers -name '*.md'); do
  base=$(basename "$f" .md)
  find backend/controllers -name "$base.js" | grep -q . || echo "huérfano: $f"
done
```
