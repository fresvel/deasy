> ⚠️ **ARCHIVADO — no es fuente de verdad.**
> Este documento describe el sistema tal como era antes de la reorganizacion de `docs/`.
> Puede citar MariaDB, MongoDB, EMQX/MQTT o rutas que ya no existen. Se conserva por su
> valor historico. Para el estado actual, ver el `README.md` de la raiz.

# Reportes y firmas - LaTeX

## Generacion de reportes

- Servicio principal: backend/services/latex/
- Utilidades: backend/utils/latex.js

## Templates

- Plantillas: backend/services/latex/templates/
- Ejemplos: backend/services/latex/templates/informe-sample/
- Legacy runtime auxiliar: backend/templates_legacy/

## Ejecucion

- Compilacion delegada a scripts/compiladores internos.
- Revisar logs en backend/services/latex/.
