# La herramienta de este plan

Copia de solo lectura del comando `plan` y de su vocabulario, **versión 2**, del skill `plan-trabajo`. Dentro de este proyecto `plan` corre ESTA copia, así que lo que comprueba el portátil y lo que comprueba la integración continua es lo mismo, y un cambio en el skill no pone en rojo este plan hasta que alguien decide subir de versión.

No se edita a mano: cambia con `plan actualizar --aplicar`, que antes enseña qué hallazgos nuevos aparecerían.

Para correr la puerta sin el skill (integración continua):

```bash
pip install pyyaml
PLAN_RAIZ=<esta carpeta de planes> python3 <esta carpeta>/herramienta/plan verificar
```
