# Status

## Resumen

- Se reorganizaron las semillas LaTeX y se definió un flujo seed → system/jinja2 → user/latex.
- Se corrigió la lógica de layout (evita errores en `\SetDefaultLayout`).
- Se añadió el render de semillas a carpeta `render/` y comandos unificados `deasy_tpl`.
- Se creó documentación de comandos y troubleshooting.

## Semillas

Ubicación: `seeds/latex/`

- `informe-docente` (default): semilla base para informes de carrera/docentes. Secciones: Introducción, Objetivos, Desarrollo, Acciones de Mejora Continua.
- `informe-general`: conserva estructura anterior (incluye Resumen/Conclusiones/Recomendaciones).
- `guia-laboratorio`: basada en formato de guía de laboratorio (tabla de datos de práctica + secciones específicas).
- `informe-estudiantes`: estructura genérica de informe estudiantil.
- `informe-laboratorio`: informe de laboratorio con secciones de metodología, resultados y rúbrica.
- `slides-puce`: semilla de presentaciones Beamer PUCE.

Cada semilla tiene:
- `src/`
- `defaults.yaml`
- `render/` (preview generado)

## Comandos

### Setup

```bash
source scripts/setup_env.sh
```

### Crear template desde seed

```bash
deasy_tpl new --key investigacion/guias/lab --version 1.0.0 --seed guia-laboratorio
```

### Renderizar template

```bash
cd templates/<key>/<version>
deasy_tpl render --here
```

### Renderizar seed (preview)

```bash
deasy_tpl seed --seed informe-docente --compile
```

### Regenerar data.json

```bash
deasy_tpl json
```

## Cambios técnicos importantes

- `new_template.sh` soporta `--seed <name|path>` y usa `informe-docente` por defecto.
- `render_seed_preview.sh` autodetecta seed si se ejecuta dentro de ella y, desde la raíz, usa `informe-docente`.
- `render_template.sh` regenera `modes/user/latex/src` a partir de `system/jinja2/src` y `data.yaml`.
- `data.json` se genera desde `data.yaml` y queda read-only.
- `make.sh` detecta bibliografía con `Referencias/references.bib` y genera `Preambulo/bibflag.tex`.

## Estado de migración

- Migrados al flujo `seed -> system/jinja2 -> user/latex`: `investigación/formativa/informe-docente`, `investigación/formativa/informe-carrera`, `investigación/formativa/plan-docente`, `investigación/formativa/plan-carrera`, `investigación/formativa/informe-estudiantes`, `investigación/integración/artículos-académicos/planes/trabajo-uic`, `investigación/productiva/testing`.
- Externos `user-only` (fuera del pipeline de migración): `investigación/integración/artículos-académicos/revistas/ieee`, `investigación/integración/artículos-académicos/revistas/mdpi`, `investigación/integración/artículos-académicos/revistas/springer`.

## Rutas clave

- Repo: `/home/fresvel/Sharepoint/EQUIPO EIS - Documentos/DCC/GLOBAL/0000/Devs/pucese-templates`
- Semillas: `seeds/latex/`
- Templates: `templates/`
- Scripts: `scripts/`
- Docs: `docs/README.md`

## Pendientes

- Definir si `informe-estudiantes` debe basarse en un informe real (dar ruta exacta para adaptar contenido).
- Aclarar qué elementos exactos reutilizar desde `templates/investigación/integración/artículos-académicos/revistas`.
