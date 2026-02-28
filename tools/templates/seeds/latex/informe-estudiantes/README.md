# Seed LaTeX (base)

Seed Jinja2 para generar:
- `modes/system/jinja2/src` (plantilla fuente)
- `modes/user/latex/src` (renderizado con defaults)

Archivo de configuración:
- `defaults.yaml` (se copia como `data.yaml` al crear un template)

Notas:
- El bloque de referencias se activa automáticamente si `Referencias/references.bib` contiene entradas (`@...`).
- `show_firmas` está activo por defecto.
- Orientación/márgenes se controlan vía `layout_*` en `defaults.yaml` y macros `\UseLayout{portrait|landscape}`.
- Paleta: `brand_rgb` y `palette` (gray/blue/navy/blue_alt/black/white). `colhead` se deriva de `brand`.
