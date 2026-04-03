# Listado de actividades

Avance del checklist: `21/23`

Buenas practicas base validadas con Context7 (`/docker/compose`):
- Mantener un compose base con lo comun y archivos por ambiente con overrides.
- Resolver diferencias de ambiente en `compose` y `.env`, no en los Dockerfiles principales.
- Hacer que `qa` y `prod` usen ejecucion estable, sin mounts de codigo local.

0. [x] Revisar `Requisitos00.md` para tener el contexto completo de la implementacion y usarlo como base de la hoja de ruta.
1. [x] Declarar formalmente que el stack actual equivale a `dev`.
2. [x] Crear `.env.dev`, `.env.qa` y `.env.prod`.
3. [x] Crear `compose.base.yml`.
4. [x] Crear `compose.dev.yml`.
5. [x] Crear `compose.qa.yml`.
6. [x] Crear `compose.prod.yml`.
7. [x] Refactorizar Dockerfile del backend a modo estable.
8. [x] Crear `Dockerfile.dev` del backend si aplica.
9. [x] Refactorizar Dockerfile del frontend a modo estable.
10. [x] Crear `Dockerfile.dev` del frontend si aplica.
11. [x] Evaluar `docs`, `signer`, `analytics` para definir si requieren variantes `dev`.
12. [x] Separar volumenes por ambiente.
13. [x] Separar nombres de proyecto Docker por ambiente.
14. [x] Ajustar puertos y redes por ambiente.
15. [x] Alinear ramas `develop`, `qa` y `main` con ambientes.
16. [x] Preparar integracion con CI/CD.
17. [x] Endurecer progresivamente la operacion de `prod`.
18. [x] Reajustar ramas para dejar `develop`, `qa` y `main` basadas temporalmente en `develop`, preservando estados anteriores en ramas deprecadas.
19. [x] Implementar CD real por ambiente a partir de la nueva estrategia de ramas.
20. [ ] Activar la estrategia en remoto: commit, push de `develop`, `qa` y `main`, y creacion/verificacion de `GitHub Environments` con sus secrets.
21. [x] Sincronizar el estado local con el remoto y verificar que las ramas y artefactos base de CD queden publicados sin perder trazabilidad de las ramas deprecadas.
22. [ ] Remediar fuga de secreto en Git: registrar incidente, purgar el valor del historial accesible y volver a publicar las referencias afectadas.
