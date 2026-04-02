# Listado de actividades 

0. Revisa el archivo Requisitos00.md para tener el contexto completo de la implementación, luego pasa al punto 1.
1. Declarar formalmente que el stack actual equivale a `dev`.
2. Crear `.env.dev`, `.env.qa` y `.env.prod`.
3. Crear `compose.base.yml`.
4. Crear `compose.dev.yml`.
5. Crear `compose.qa.yml`.
6. Crear `compose.prod.yml`.
7. Refactorizar Dockerfile del backend a modo estable.
8. Crear `Dockerfile.dev` del backend si aplica.
9. Refactorizar Dockerfile del frontend a modo estable.
10. Crear `Dockerfile.dev` del frontend si aplica.
11. Evaluar docs, signer, analytics y para definir si requieren variantes dev.
12. Separar volúmenes por ambiente.
13. Separar nombres de proyecto Docker por ambiente.
14. Ajustar puertos y redes por ambiente.
15. Alinear ramas `develop`, `qa` y `main` con ambientes.
16. Preparar integración con CI/CD.
17. Endurecer progresivamente operación de `prod`.
