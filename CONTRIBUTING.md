# Contributing to Deasy

Gracias por tu interes en contribuir.
Este proyecto incluye backend, frontend, documentacion y componentes de despliegue.

## Formas de contribuir

- Reportar bugs.
- Proponer mejoras funcionales o tecnicas.
- Enviar pull requests con correcciones o nuevas capacidades.
- Mejorar documentacion tecnica y de usuario.

## Antes de empezar

1. Busca si ya existe un issue relacionado.
2. Si no existe, crea uno con contexto claro.
3. Para cambios grandes, primero discute el enfoque en un issue.

## Preparar entorno

### Opcion A: entorno completo con Docker (recomendado)

Desde la raiz del repositorio:

```bash
./scripts/start-services.sh
```

Si necesitas recargar servicios especificos:

```bash
./scripts/reload-services.sh
```

### Opcion B: desarrollo por modulo

Backend:

```bash
cd backend
npm install
cp .env_model .env
npm run start
```

Frontend:

```bash
cd frontend
pnpm install
pnpm run dev
```

Documentacion (Astro/Starlight):

```bash
cd docs
pnpm install
pnpm dev
```

## Flujo de trabajo con Git

1. Haz fork del repositorio (si aplica).
2. Crea una rama descriptiva:

```bash
git checkout -b feature/nombre-corto
```

1. Realiza cambios pequenos y atomicos.
2. Escribe mensajes de commit claros.
3. Abre un pull request hacia la rama objetivo definida por maintainers.

## Convenciones recomendadas

- Commits: usa formato tipo Conventional Commits cuando sea posible.
  - `feat: agrega validacion de token`
  - `fix: corrige error en carga de plantillas`
  - `docs: actualiza guia de despliegue`
- Mantener separacion de responsabilidades por modulo.
- Evitar cambios no relacionados en un mismo PR.

## Calidad minima antes de abrir PR

Frontend:

```bash
cd frontend
pnpm run lint
pnpm run build
```

Backend (validacion minima):

- Inicia el servidor sin errores.
- Verifica endpoints afectados.
- Si tocas SQL o modelos, explica impacto y plan de rollback.

Documentacion:

- Verifica enlaces y comandos.
- Mantiene consistencia con el estado real del codigo.

## Pull Requests

Incluye en la descripcion:

- Problema que resuelve.
- Enfoque de solucion.
- Evidencia de pruebas (comandos, capturas o logs relevantes).
- Riesgos o efectos secundarios conocidos.

Un PR puede ser rechazado o pedir cambios si:

- No hay contexto suficiente.
- Rompe compatibilidad sin justificacion.
- Mezcla cambios no relacionados.
- Introduce deuda tecnica sin plan.

## Seguridad

No reportes vulnerabilidades en issues publicos.
Revisa SECURITY.md para el proceso de divulgacion responsable.

## Licencia

Al contribuir, aceptas que tu contribucion se publica bajo la licencia del
repositorio (ver LICENSE).
