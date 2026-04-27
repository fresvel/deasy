# Contrato Runtime para el Compilador Documental

Este documento describe cómo debe conectarse `pattern_ref` con el compilador documental sin
confundir el plano del patrón con el plano del render. La idea central es que el compilador no use
el patrón para escribir LaTeX directamente. El patrón se usa antes, en una etapa de preparación del
payload runtime que luego sí entra al renderizador Jinja.

## Qué recibe realmente el compilador

Cuando el compilador documental exista como pieza operativa completa, su entrada debería quedar
separada en cuatro bloques:

- la ruta del template fuente, normalmente `modes/process/jinja2/src`
- la metadata del template, es decir `meta.yaml`
- el schema del documento, es decir `schema.json`
- el payload de datos con el que se renderiza el documento

Ese payload de datos no tiene por qué salir directamente de `data.yaml`. En documentos con firmas,
lo correcto es que exista primero una etapa de preparación runtime que tome el payload base y le
inyecte los valores concretos de los actores resueltos.

## Dónde entra `pattern_ref`

`pattern_ref` no renderiza texto y no compila PDF por sí mismo. Su función es declarar que el
template adopta un patrón reusable de firma, por ejemplo `signatures/three-stage-era`. Ese patrón
describe:

- qué slots de firma existen
- qué campos runtime necesita cada slot
- qué anchors se esperan
- qué estructura lógica de pasos existe

Con esa información, el sistema puede preparar el payload final sin repetir la misma lógica por
template.

## Pipeline recomendado

La secuencia recomendada es esta:

1. se toma `data.yaml` o `data.json` como payload base del documento
2. se leen `meta.yaml` y `schema.json`
3. si `meta.yaml` declara `workflows.signatures.pattern_ref`, se carga ese patrón
4. se resuelven los actores concretos del documento desde la base de datos
5. se construye un bloque runtime con valores reales
6. ese bloque runtime se materializa sobre el payload base
7. recién entonces Jinja renderiza el `.tex`
8. el `.tex` compila a PDF
9. el signer usa los tokens ya impresos en el PDF para estampar

De esta forma, el patrón participa en la preparación del payload y no en el render directo.

## Valores runtime esperados

Para el patrón `three-stage-era`, el bloque runtime esperado tiene esta forma:

```json
{
  "signatures": {
    "elaborado": {
      "token": "!-abc123-!",
      "nombre": "Nombre del firmante",
      "cargo": "Coordinador de carrera",
      "fecha": "2026-03-31"
    },
    "revisado": {
      "token": "!-def456-!",
      "nombre": "Nombre de revisión",
      "cargo": "Responsable de aseguramiento",
      "fecha": "2026-03-31"
    },
    "aprobado": {
      "token": "!-ghi789-!",
      "nombre": "Nombre de aprobación",
      "cargo": "Director de escuela",
      "fecha": "2026-03-31"
    }
  }
}
```

El origen normal de esos datos debería ser:

- `persons.token`
- nombre visible de la persona
- cargo visible resuelto por la estructura organizacional
- fecha operativa del paso o de la compilación

## Script de apoyo actual

Ya existe una pieza mínima que implementa esta preparación runtime:

- [prepare_runtime_payload.py](/home/fresvel/Sharepoint/DIR/Deploy/deasy/tools/templates/python/prepare_runtime_payload.py)

Y quedó expuesta en la CLI así:

```bash
node tools/templates/cli.mjs prepare-runtime \
  --key investigación/formativa/informe-docente \
  --version 1.0.0 \
  --runtime /ruta/runtime.json
```

Ese comando:

- lee `data.yaml` o `data.json`
- lee `meta.yaml`
- lee `schema.json`
- carga el `pattern_ref`
- toma el bloque runtime
- y genera un `runtime.data.json` listo para entrar al render

Ese comando sigue siendo una herramienta de apoyo y depuración del contrato del template. No debe
leerse como la implementación final del pipeline documental.

## Qué materializa exactamente

La materialización actual trabaja así:

- usa el patrón para saber qué `field_refs` runtime existen
- usa `schema.json` para traducir esos `field_refs` a `x-deasy-data-key`
- escribe los valores concretos tanto en la clave flat heredada como en la ruta lógica

Eso permite convivir con el payload histórico del proyecto y, al mismo tiempo, ir empujando el
modelo hacia identificadores lógicos estables.

## Qué falta después

Esta pieza todavía no es el compilador completo. Lo que deja resuelto es la conexión entre patrón y
payload runtime. La etapa siguiente sería envolver este comportamiento en un servicio documental que,
además de preparar el payload:

- seleccione la versión vigente del template
- renderice Jinja
- compile LaTeX
- suba `working_file_path` a MinIO
- y, cuando corresponda, desencadene la firma

Con eso `pattern_ref` deja de ser solo documentación y pasa a ser parte operativa del pipeline de
compilación documental.

## Estado actual en backend

Ya existe una primera pieza de backend para esta evolución:

- [DocumentRuntimeService.js](/home/fresvel/Sharepoint/DIR/Deploy/deasy/backend/services/documents/DocumentRuntimeService.js)

Ese servicio no compila todavía, pero sí construye el insumo correcto para una futura compilación.
Su responsabilidad es:

- leer `document_version`
- cargar `meta.yaml`, `schema.json` y `data` del artifact desde MinIO
- cargar `pattern_ref` si existe
- resolver la parte runtime de firmas desde `signature_requests`
- producir:
  - `baseData`
  - `runtimePayload`
  - `mergedPayload`

En otras palabras, el script de `tools/templates` fija y prueba el contrato. El servicio de backend
empieza a trasladar ese contrato al flujo documental real.
