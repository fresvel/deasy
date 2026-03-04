# Docs

## Quick Start

1) Enable commands:

```bash
source scripts/setup_env.sh
```

2) Create a new template from a seed:

```bash
deasy_tpl new --key investigacion/guias/lab --version 1.0.0 --seed guia-laboratorio
```

3) Re-render a template after editing data.yaml or seed:

```bash
cd templates/investigacion/guias/lab/1.0.0
deasy_tpl render --here
```

4) Preview a seed (render + optional compile):

```bash
deasy_tpl seed --seed informe-docente --compile
```

## Structure

Templates are stored under `templates/<template_key>/<version>/` and include:

- `meta.yaml`
- `schema.json`
- `data.yaml`
- `data.json` (read-only example generated from `data.yaml`)
- `modes/system/jinja2/src` (seed source)
- `modes/user/latex/src` (rendered output)

Seeds are stored under `seeds/latex/<seed_name>/` and include:

- `src/` (Jinja2 LaTeX source)
- `defaults.yaml` (default render variables)
- `render/` (preview output; auto-generated)

## Commands

### `deasy_tpl new`
Create a template from a seed.

Examples:

```bash
deasy_tpl new --key investigacion/reportes/docente --version 1.0.0
```

```bash
deasy_tpl new --key investigacion/guias/lab --version 1.0.0 --seed guia-laboratorio
```

Notes:
- If you use `--here`, it must be inside `templates/` and not inside a version folder.
- `--seed` accepts a seed name (e.g. `guia-laboratorio`) or a full path.

### `deasy_tpl ver`
Create a new version from an existing one.

```bash
deasy_tpl ver --key investigacion/guias/lab --from templates/investigacion/guias/lab/1.0.0 --version 1.1.0
```

### `deasy_tpl render`
Re-render the user LaTeX from the system Jinja2 source and `data.yaml`.

```bash
cd templates/investigacion/guias/lab/1.0.0
deasy_tpl render --here
```

### `deasy_tpl seed`
Render a seed into its `render/` folder and optionally compile it.

```bash
deasy_tpl seed --seed informe-docente
```

```bash
deasy_tpl seed --seed guia-laboratorio --compile
```

Behavior:
- If run inside a seed folder, it auto-detects that seed.
- If run from repo root with no args, it defaults to `informe-docente`.

### `deasy_tpl json`
Regenerate `data.json` from `data.yaml` (read-only example payload).

```bash
deasy_tpl json
```

## Recommended Workflow

1) Start from a seed (choose one of the default seeds or create a new one).
2) Create a template with `deasy_tpl new`.
3) Edit `data.yaml` and/or `modes/system/jinja2/src`.
4) Re-render with `deasy_tpl render`.
5) Compile from `modes/user/latex/src` with `./make.sh`.

## Notes

- `data.json` is generated from `data.yaml` and is set to read-only.
- For bibliography rendering, the seed `make.sh` toggles `Preambulo/bibflag.tex` based on `Referencias/references.bib` content.
- Output is packaged into `dist/` by `package_templates.sh`.

## Troubleshooting

Common issues and fixes:

- `Seed not found` when running `deasy_tpl seed`:
  - Use `--seed <name|path>` or run it inside a seed folder.
  - From repo root with no args, it defaults to `informe-docente`.

- `meta.yaml not found` with `deasy_tpl render --here`:
  - Ensure you are inside a template version folder `templates/<key>/<version>`.

- `system/jinja2 seed not found` during render:
  - The template was created without a seed. Recreate it using `deasy_tpl new --seed ...` or add the `modes/system/jinja2/src` folder.

- `make.sh not found` or not executable:
  - Check `modes/user/latex/src/make.sh`.
  - If you edited a seed, re-render the template with `deasy_tpl render --here`.

- Bibliography not appearing:
  - Ensure `Referencias/references.bib` has at least one entry (`@...`).
  - Run `./make.sh` again to regenerate `Preambulo/bibflag.tex`.

- LaTeX compile errors after seed changes:
  - Re-render user output with `deasy_tpl render --here`.
  - If it still fails, inspect `output/build/main.log`.
