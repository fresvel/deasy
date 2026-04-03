# Listado de actividades

Avance del checklist: `12/12`

Buenas practicas base validadas con Context7:
- `GitHub Actions` (`/websites/github_en_actions`): no asumir que `pull_request` usa el mismo nombre de rama que `push`; la logica de ramas debe usar el contexto correcto del evento y los jobs de deploy deben saltarse con condiciones explicitas y seguras.
- `GitHub Actions` (`/websites/github_en_actions`): separar claramente validacion, publicacion y despliegue para que un `pull_request` ejecute CI sin intentar resolver rutas de deploy no aplicables.
- `systemd` (`/systemd/systemd`): separar la responsabilidad entre el servicio que ejecuta el update/deploy y el timer que programa la ejecucion; para tareas de despliegue usar servicios `oneshot`.
- `systemd` (`/systemd/systemd`): cuando el host depende de red o registry, preparar la unidad para esperar condiciones de red de forma explicita en lugar de asumir disponibilidad inmediata.

0. [x] Revisar el estado actual del workflow, scripts y documentos relacionados con CI/CD para confirmar el punto de partida posterior a los cambios recientes.
1. [x] Corregir el error del `pull_request` en el job `prepare` del workflow `CD Multi-Env`, eliminando la suposicion incorrecta sobre el nombre de rama del evento.
2. [x] Validar que el workflow siga comportandose correctamente para `push`, `pull_request` y `workflow_dispatch` despues de la correccion.
3. [x] Redefinir la estrategia de despliegue para soportar dos modos sin perder la linea actual: `push remoto desde GitHub Actions` y `pull/actualizacion iniciada desde el servidor`.
4. [x] Diseñar una interfaz operativa comun reutilizando scripts existentes para que ambos modos de despliegue compartan la misma logica de actualizacion del stack.
5. [x] Implementar un flujo de `pull manual` en servidor que permita actualizar codigo o artefactos y luego ejecutar el despliegue con comandos simples y trazables.
6. [x] Implementar una opcion compatible con `systemd` para ejecucion programada o controlada desde el servidor, usando unidades y/o templates documentados.
7. [x] Ajustar el workflow y la documentacion para que el despliegue remoto desde GitHub Actions pueda quedar desactivado o condicionado cuando no exista IP publica estatica.
8. [x] Mantener preparada la ruta de despliegue remoto por SSH para reactivarla sin rediseño cuando exista infraestructura adecuada.
9. [x] Verificar que `qa` y `prod` puedan operar con la nueva modalidad basada en `pull` sin romper la separacion por ambientes ni el uso de imagenes versionadas.
10. [x] Actualizar el manual principal de CI/CD y cualquier README operativo afectado para explicar ambos modos de despliegue, sus prerequisitos y sus tradeoffs.
11. [x] Ejecutar validaciones finales del flujo revisado y dejar documentado que queda completamente operativo hoy y que queda pendiente de infraestructura futura.
