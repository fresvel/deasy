Politicas de diseno

Base visual: estilos y componentes de la pagina Formacion y modales de "Agregar".

Modales
- Usar Bootstrap modal con estructura: modal > modal-dialog > modal-content.
- Modal title en h5 con clase "modal-title".
- Boton cerrar con "btn-close".
- Contenido en "modal-body" con paddings estandar.
- Botones de accion en "modal-footer" con primario "btn btn-primary" y secundario "btn btn-outline-secondary".

Inputs
- Usar inputs Bootstrap ("form-control") y selects ("form-select").
- En modales usar "form-label" y agrupar en filas con "row g-3".
- Inputs de busqueda deben soportar debounce y estados de error con texto "text-danger small".

Botones
- Primario: "btn btn-primary".
- Secundario: "btn btn-outline-primary".
- Peligro: "btn btn-outline-danger".
- Tamano grande en cards: "btn btn-primary btn-lg w-100".
- Tamano pequeño en barras de herramientas: "btn btn-sm".

Colores
- Fondo general: var(--brand-white).
- Texto principal: var(--brand-navy).
- Acento: var(--brand-accent).
- Superficies suaves: var(--brand-info-soft), var(--brand-surface-alt).
- Lineas: var(--brand-line).
- Peligro: var(--brand-danger).

Tipografia y tamanos
- Titulo de seccion: "profile-section-title".
- Subtitulo de seccion: "profile-section-subtitle".
- Texto de ayuda en cards: usar "text-muted" y ajustar a 1rem cuando sea informativo.
- Texto en listas activas debe contrastar con fondo (blanco).

Layout
- Usar "container-fluid py-4" en vistas principales.
- Encabezado de seccion con "profile-section-header" y "profile-section-actions".
- Cards con "card shadow-sm" para bloques principales.

Tablas
- Usar "table table-striped table-hover align-middle table-institutional".
- Encabezados en mayusculas cuando aplique.
- Mensajes vacios con "text-muted" centrado.

Dragfiles
- Boton con estilo dropzone: "btn btn-primary btn-lg w-100" + borde punteado.
- Fondo transparente con leve color de apoyo y borde dashed.
- Estado dragover: resaltar con clase "drop-button--active".
- Input oculto con ".file-input-hidden { display: none; }".

Referencias de clases (archivo:linea)
- Layout y titulos: `frontend/src/scss/theme.scss:135` (`.profile-section-header`), `frontend/src/scss/theme.scss:145` (`.profile-section-title`), `frontend/src/scss/theme.scss:150` (`.profile-section-subtitle`).
- Boton principal de Formacion: `frontend/src/scss/theme.scss:116` (`.profile-add-btn`) y uso en `frontend/src/sections/perfil/TitulosView.vue:9`.
- Tablas institucionales: `frontend/src/scss/theme.scss:176` (`.table-institutional`) y variantes en `frontend/src/scss/theme.scss:183`, `frontend/src/scss/theme.scss:187`, `frontend/src/scss/theme.scss:197`, `frontend/src/scss/theme.scss:201`.
- Ejemplos de tabla: `frontend/src/sections/perfil/TitulosView.vue:22`, `frontend/src/sections/perfil/CertificacionView.vue:17`, `frontend/src/sections/perfil/LaboralView.vue:22`.
- Modales Bootstrap (estructura): `frontend/src/sections/perfil/TitulosView.vue:157`, `frontend/src/views/logged/perfil/CapacitaciónView.vue:108`.
