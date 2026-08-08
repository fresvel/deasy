# Auditoría del microservicio de firma (`signer/`) — 2026-08

> Fase F de `docs/plan-calidad-2026-08.md` §5-F, mitad Python.
> `signer/app.py` es el peor fichero del repositorio (complejidad cognitiva **356**, 1 190 ncloc,
> anidamiento máximo 14) y **nunca había tenido una auditoría ni un solo test**.
> Este documento es el mapa; `signer/tests/` es la red que se montó antes de proponer ningún corte.

---

## 0. Titular

**La complejidad del signer no está en firmar. Está en leer identidad de certificados ecuatorianos.**

De las 8 funciones que SonarQube marca por complejidad cognitiva (183 puntos de los 356 del
fichero), **6 son parseo de certificados y de metadatos del PDF y suman 148 puntos — el 81 % de la
complejidad marcada**. La firma propiamente dicha (`sign_pdf_document`, cogn. 17) y el worker de
colas (cogn. 18) son los otros dos, y son los más pequeños de la lista.

Consecuencia directa para el plan: **el bloque grande y peligroso de este fichero es también el más
fácil de cubrir con pruebas puras**, porque no toca ni red, ni disco, ni criptografía — solo
recorre objetos. Eso invierte el orden intuitivo: aquí la red de seguridad se pudo montar sobre
justo la parte que da miedo.

Segundo hallazgo, este de bulto: **762 líneas del microservicio eran una implementación Node
anterior del mismo servicio que ya no se ejecutaba** (`index.js`, `signService.js`,
`minioClient.js` y sus manifiestos). Ni siquiera arrancaba: la imagen no instala sus dependencias.
Ahí vivían 5 de las 21 incidencias que Sonar imputaba al microservicio. **Retiradas** (fase F1, §9).

### Estado de esta pasada

| Fase | Estado |
|---|---|
| F0 — red de pruebas | ✅ **hecha**: 224 casos, 93 % de las funciones, verificada por mutación (§8) |
| F1 — retirar el signer Node muerto | ✅ **hecha**: −762 líneas, imagen reconstruida y servicio verificado (§9) |
| R-8 — `on_message` fuera de la clausura | ✅ **cerrado**: movimiento puro, con 7 pruebas de enrutado nuevas |
| F2, F3 (resto), F4 | 📋 planificadas, no ejecutadas |
| F5 — tocar la firma | 🚫 **bloqueada** hasta que exista la prueba de integración de §9 |

---

## 1. Cómo se midió (reproducible)

Todo dentro del contenedor, como manda `CLAUDE.md`.

```bash
# La red de pruebas
bash scripts/docker-env.sh dev exec -T signer sh -lc 'cd /app && python -m unittest discover -s tests -t . -v'

# Complejidad ciclomatica, LOC y anidamiento por funcion
bash scripts/docker-env.sh dev exec -T signer sh -lc 'cd /app && python -m tests.herramientas complejidad app.py'

# Que funciones de app.py ejerce la suite (no hay `coverage` en la imagen)
bash scripts/docker-env.sh dev exec -T signer sh -lc 'cd /app && python -m tests.herramientas cobertura'

# Complejidad COGNITIVA (la de Sonar) y el resto de incidencias
python3 -c "
import sys; sys.path.insert(0,'<scratchpad>')
from sq import issues
for i in issues('python:S3776'): print(i['component'], i.get('line'), i['message'])
"
```

Las dos primeras cifras se reproducen con `signer/tests/herramientas.py`, que vive en el paquete de
pruebas precisamente para que no se analice como código de producción.

Medidas de SonarQube para `signer/app.py` (2026-08-07):

| Métrica | Valor |
|---|---:|
| ncloc | 1 190 |
| complejidad cognitiva | **356** |
| complejidad ciclomática | 300 |
| funciones | 55 |
| densidad de duplicación | **0,0 %** |
| densidad de comentarios | 0,4 % |

Nota sobre el entorno: **la imagen del signer no trae `pytest` ni `coverage`** (`requirements.txt`
solo lista `pyhanko`, `pdfplumber`, `pika`, `minio`, `cryptography`). Python es 3.14.6. Por eso la
red usa `unittest` de la biblioteca estándar y la cobertura se midió con un rastreador propio
basado en `sys.settrace` — no se añadió ni una dependencia a un servicio que firma documentos
legales.

---

## 2. Mapa real del fichero

`app.py` no tiene secciones ni separadores: son 55 funciones seguidas. Estas son las bandas reales,
por responsabilidad:

| Líneas | LOC | Responsabilidad | Naturaleza |
|---:|---:|---|---|
| 1-36 | 36 | Importaciones (10 de pyHanko, 4 de criptografía) | — |
| 39-56 | 18 | **Configuración por entorno**: 18 constantes leídas de `os.getenv` a nivel de módulo | fontanería |
| 59-107 | 49 | Logging + **tres tablas de OIDs** de las ACs ecuatorianas (Security Data, iCert, FirmaSegura) | datos |
| 110-120 | 11 | Cliente MinIO — **se construye al importar el módulo** (`MINIO_CLIENT = create_minio_client()`) | fontanería |
| 123-128 | 6 | `JobPaths`: las 4 rutas temporales de un job | fontanería |
| 131-187 | 57 | **Validación de payload y política**: campos obligatorios, `signType`, TSA, tolerancia a avisos | dominio (reglas) |
| 190-202 | 13 | Almacenamiento: `ensure_parent`, descarga y subida a MinIO | fontanería |
| 205-244 | 40 | **Normalización del PDF con Ghostscript** y la regla que la desactiva si ya hay firmas | dominio (regla) |
| 247-269 | 23 | Resolución de coordenadas (directas o buscando el token en el PDF) | dominio |
| 272-301 | 30 | Carga del PKCS#12 del firmante y **guards de vigencia del certificado** | dominio (delicado) |
| **304-579** | **276** | **Introspección de certificados: DN, extensiones, OIDs, cédula** | dominio (delicado) |
| 582-678 | 97 | Lectura del diccionario `/Sig` del PDF y del estado de pyHanko (accesos por alias) | dominio |
| 681-734 | 54 | Normalización de la ficha del certificado y estado de revocación | dominio |
| 737-802 | 66 | **Material de confianza**: carga de `trust/roots` y `trust/extra`, contexto de validación | fontanería + política |
| 805-829 | 25 | Sello visual: invoca el CLI Node de `sigmaker` y define el estilo | fontanería |
| **832-919** | **88** | **La firma**. Caja del sello, metadatos PAdES, encadenado de N firmas | dominio (crítico) |
| 922-965 | 44 | Validación posterior a la firma y su política de tolerancia | dominio (crítico) |
| **968-1145** | **178** | **Informe de validación**: una entrada por firma, resumen, emparejado de sellos de tiempo | dominio |
| 1148-1218 | 71 | Orquestación del job de validación (temporal + descarga + informe) | orquestación |
| 1221-1277 | 57 | Orquestación del job de firma (temporal + descarga + firma + subida) | orquestación |
| 1280-1316 | 37 | Servidor HTTP interno (`/health`, `/sign`, `/validate`) | transporte |
| 1319-1387 | 69 | Worker de RabbitMQ + arranque del servidor | transporte |
| 1390-1393 | 4 | `__main__`: hilo del worker + servidor HTTP en el principal | transporte |

Sumando: **identidad y metadatos (304-734) son 430 líneas, el 36 % del fichero.** La firma real son
88. La orquestación, 128. El transporte, 110.

`find_marker.py` (47 líneas) queda aparte y está sano: localiza el token en el PDF con `pdfplumber`
y devuelve coordenadas. Una sola responsabilidad.

---

## 3. Ranking por complejidad

### 3.1 Complejidad cognitiva (la de Sonar, umbral 15) — las 8 marcadas

| Línea | Función | Cognitiva | Bloque |
|---:|---|---:|---|
| 519 | `extract_certificate_extensions` | **40** | identidad |
| 968 | `normalize_signature_entry` | **30** | identidad / informe |
| 410 | `extract_name_attributes` | 23 | identidad |
| 582 | `parse_pdf_datetime` | 20 | metadatos PDF |
| 349 | `parse_distinguished_name_text` | 19 | identidad |
| 1332 | `start_rabbit_worker` | 18 | transporte |
| 832 | `sign_pdf_document` | 17 | **firma** |
| 304 | `safe_serialize` | 16 | identidad |

**183 de 356 puntos (51 %) están en estas 8; los otros 173 se reparten entre las 47 restantes.**
Eso confirma el diagnóstico del plan maestro: es un problema de estructura, no de una función mala.
Pero lo afina: **148 de esos 183 (81 %) son identidad y metadatos**.

### 3.2 Complejidad ciclomática y anidamiento (medidos con `ast`)

Las 12 peores por ciclomática:

| Función | Líneas | LOC | CC | Anidamiento |
|---|---|---:|---:|---:|
| `normalize_signature_entry` | 968-1103 | 136 | 26 | 3 |
| `sign_pdf_document` | 832-919 | 88 | 20 | 3 |
| `extract_certificate_extensions` | 519-569 | 51 | 17 | **6** |
| `parse_pdf_datetime` | 582-624 | 43 | 17 | 2 |
| `safe_serialize` | 304-329 | 26 | 15 | 3 |
| `parse_distinguished_name_text` | 349-407 | 59 | 15 | 3 |
| `extract_name_attributes` | 410-444 | 35 | 15 | 3 |
| `process_validation_job` | 1148-1218 | 71 | 14 | 3 |
| `validate_payload` | 131-150 | 20 | 11 | 2 |
| `start_rabbit_worker` | 1332-1381 | 50 | 9 | **5** |
| `extract_common_name` | 332-346 | 15 | 9 | 3 |
| `decode_extension_bytes` | 482-498 | 17 | 8 | 3 |

Por **anidamiento** el orden cambia y señala a otros culpables:

| Función | Anidamiento | Por qué |
|---|---:|---|
| `extract_certificate_extensions` | 6 | `try` → `for` → `if` → `try` → `for` → `if` |
| `start_rabbit_worker` | 5 | `while` → `try` → `def on_message` → `try`/`if` |
| `get_pdf_dictionary_value` | 4 | `for` → `try` → `if` → `if` |
| `get_status_attr` | 4 | `for` → `if` → `try` |

> El anidamiento máximo de 14 que reporta Sonar corresponde a `extract_certificate_extensions`;
> Sonar cuenta también los niveles de expresión que `ast` no ve como sentencias.

**La función más larga del fichero es `normalize_signature_entry`: 136 líneas y 26 caminos, para
construir un único diccionario.** No tiene un solo `return` intermedio: es una cadena de 20
asignaciones donde cada una tiene su propio respaldo.

---

## 4. Duplicación

**Sonar reporta 0,0 % de duplicación en `app.py`, y tiene razón: no hay bloques copiados.**
La duplicación de este fichero no es textual, es de *patrón*, y por eso el detector de tokens no la
ve. Hay cuatro familias:

**D-1. El acceso defensivo por alias (25 `getattr`, 31 `try`).**
El mismo gesto —"pregunta por estos nombres, quédate con el primero que exista, y si algo revienta
sigue"— está reimplementado cinco veces con firmas distintas: `get_status_attr`,
`get_signing_certificate`, `get_signature_dictionary`, `get_pdf_dictionary_value` y el arranque de
`stringify_name`. Es la respuesta a que pyHanko renombra atributos entre versiones. Una sola
función `primer_atributo(objeto, *nombres)` cubriría las cinco.

**D-2. Las tres tablas de OIDs (líneas 62-107).**
`SECURITY_DATA_EXTENSION_OIDS`, `ICERT_EXTENSION_OIDS` y `FIRMASEGURA_EXTENSION_OIDS` tienen la
misma forma y casi las mismas claves con prefijos distintos. **Esto NO es duplicación a eliminar:
son datos, como `backend/config/sqlTables.js` (§7 del plan maestro). La forma correcta es tenerlas
las tres explícitas.** Lo que sí sobra es que estén en medio del código: son un fichero de datos.

**D-3. Los dos recorridos de extensiones (519-553 y 555-567).**
`extract_certificate_extensions` recorre las extensiones dos veces: primero por la API de
`cryptography` y después por la de `asn1crypto`, con la misma intención y estructura distinta. Es
duplicación real, y es el 40 de complejidad cognitiva.

**D-4. `process_job` y `process_validation_job` (1221-1277 y 1148-1218).**
Comparten el esqueleto entero: validar payload → generar `jobId` → crear el workspace → abrir un
temporal → descargar de MinIO → hacer el trabajo → `except Exception` → devolver
`{"status": "error", "message": ..., "jobId": ...}`. Solo cambia el "hacer el trabajo". Un
`ejecutar_job(validador, trabajo)` los colapsaría — y es la extracción de fontanería con mejor
relación valor/riesgo del fichero.

---

## 5. Dominio contra fontanería

Es la separación que decide qué se puede mover con la mano ligera y qué no.

### Fontanería (mover es barato) — ~330 líneas

| Qué | Dónde |
|---|---|
| Configuración por entorno (18 constantes) | 39-56 |
| Cliente y transferencias MinIO | 110-120, 190-202 |
| `JobPaths` y el ciclo de vida del `TemporaryDirectory` | 123-128, dentro de los dos `process_*` |
| Carga del material de confianza desde `trust/` | 759-802 |
| Invocación del CLI de `sigmaker` y estilo del sello | 805-829 |
| Servidor HTTP y worker de RabbitMQ | 1280-1393 |
| El esqueleto común de los dos jobs | 1148-1277 |

### Dominio (mover exige red) — ~860 líneas

| Qué | Dónde | Por qué es delicado |
|---|---|---|
| Reglas del payload y precedencia de la TSA | 131-187 | El orden de los guards **es** el contrato de error del backend |
| Regla de Ghostscript | 215-244 | Aplanar un PDF ya firmado **destruye las firmas previas** |
| Guards de vigencia del certificado | 272-301 | Es el único punto donde el servicio se niega a firmar |
| Identidad del firmante (DN, OIDs, cédula) | 304-579 | Produce el `signerCedula` con el que el backend cruza firmas y personas |
| Colocación del sello y metadatos PAdES | 832-919 | Mueve el sello y decide el nivel de firma (LTV / LTA) |
| Política de validación posterior | 941-965 | Decide si una firma con cadena no confiable se acepta o aborta el job |
| Informe de validación | 968-1145 | Su forma exacta la pinta el frontend |

**La lógica de firma propiamente dicha son 88 líneas** (`sign_pdf_document`) más las 44 de la
política de validación. Todo lo demás que parece "firma" es en realidad lectura.

---

## 6. Acoplamientos: qué contratos hay que preservar sí o sí

### 6.1 RabbitMQ — el camino real

El backend habla con el signer **solo por colas**
(`backend/services/infrastructure/rabbit_signer.js`). Es un RPC hecho a mano:

- **Consume** de `deasy.sign.request` y `deasy.sign.validate.request`, ambas declaradas *durables*,
  con `prefetch_count=1`. El enrutado entre firma y validación se decide por
  `method.routing_key` dentro de `on_message`.
- **Produce** en la cola que venga en el campo `responseQueue` del propio mensaje. El signer la
  declara durable antes de publicar. Publica JSON, `content_type: application/json`,
  `delivery_mode: 2`, y **añade `correlationId` copiándolo del payload de entrada**.
- Hace `basic_ack` **siempre**, incluso cuando el payload es ilegible o no trae `responseQueue`.
  No hay reintentos ni DLQ: un mensaje malo se pierde en silencio (con log de error).

**El contrato que rompe el backend si se toca:**

| Campo | Quién lo lee | Qué pasa si cambia |
|---|---|---|
| `status === "success"` | `rabbit_signer.js:32` | Cualquier otro valor se convierte en excepción |
| `message` | `rabbit_signer.js:35` | Es el texto de error que ve el usuario final |
| `correlationId` | (informativo) | — |

El backend hace *polling* de la cola de respuesta cada `SIGN_POLL_MS` (1 s) hasta `SIGN_TIMEOUT_MS`
(120 s). Un job de firma más lento que eso se da por perdido aunque el signer acabe bien —
y el PDF firmado **ya se habrá escrito en MinIO**.

### 6.2 Payloads que entran

**Firma** (`sign_controller.js:242` y `:259`):
`signType` (`"token"` | `"coordinates"`), `minioBucket`, `minioPdfPath`, `minioCertBucket`,
`minioCertPath`, `certPassword`, `stampText`, `finalPath`, `use_timestamp`,
`allow_untrusted_signer`, `tsaUrl`, y según el modo `token` o `coordinates: {page, x, y}`.
Opcionales que el signer entiende y el backend hoy no manda: `boxWidth`, `boxHeight`, `reason`,
`location`, `useDefaultTsa`, `allowValidationWarning`.

**Validación** (`sign_controller.js:606`): `minioBucket`, `minioPdfPath`, `cedula`.

### 6.3 Respuestas que salen

**Firma** — lo que `sign_controller.js` lee del resultado: `status`, `message`, `signedPath`,
`finalPath`, `certificate`, `signature.matchCount`, `validation.performed`,
`validation.bottomLine`, `validation.warningAccepted`, `tsaUrl`, `timestamped`, `jobId`.

**Validación** — el controlador hace `res.json(result)`: **la respuesta del signer viaja íntegra al
navegador**. `frontend/src/modules/firmas/components/FirmarPdf.vue` lee `summary`, `signatures`,
`timestamps`, `matchByCedula`, `warnings`, y de cada firma `signerName`, `signerCedula`, `valid`,
`intact`, `trusted`, `revoked`, `revocationStatus`, `signingTime`, `timestampTime`,
`timestampStatus`, `certificateAuthority`, `certificateIssuedAt`, `certificateExpiresAt` y
`extras.*`. **Renombrar una clave del informe rompe la vista de validación y no lo detecta ningún
test del backend**, porque el signer vive detrás de una cola.

### 6.4 MinIO

- Bucket por defecto `MINIO_SPOOL_BUCKET` (`deasy-spool`) cuando el payload no manda `minioBucket`.
- Descarga el PDF y el `.p12` con `fget_object`.
- **Sobrescribe el objeto de origen** (`minioPdfPath`) con el PDF firmado, y **además** lo sube a
  `finalPath` si es distinto. Siempre con `content_type="application/pdf"`.
- El PDF firmado se sube **antes** de que el backend sepa nada: si vence el timeout de 120 s, el
  objeto en MinIO ya está firmado aunque el backend registre un fallo.

### 6.5 sigmaker (CLI de Node)

`node $SIGMAKER_DIR/cli.mjs <outputPath> <stampText> <finalPath> <logoPath>`. Contrato
**posicional**: el orden de los cuatro argumentos es la interfaz. `stampText` va recortado, y el
tercer argumento (lo que acaba en el QR) es `finalPath` **o**, si no viene, `minioPdfPath`.

### 6.6 Sistema de ficheros y entorno

- `SIGNER_TRUST_DIR` (`/app/trust`) con subcarpetas `roots/` y `extra/`; extensiones aceptadas
  `.pem`, `.crt`, `.cer`, `.der`; **no recursivo**. Si no hay subcarpetas, cualquier certificado
  suelto en `trust/` se trata como raíz de confianza (compatibilidad).
- `SIGNER_WORKSPACE_DIR` (`/tmp/deasy-signer-workspace`) como raíz de los temporales de cada job.
- Ghostscript (`gs`) en el `PATH`, instalado por el Dockerfile.
- El bind mount de dev es `../signer:/app`, así que lo que se escriba en `signer/` está vivo en el
  contenedor sin reconstruir.

### 6.7 El servidor HTTP no tiene consumidores

`GET /health`, `POST /sign` y `POST /validate` en el puerto 4000, publicado al host. Una búsqueda
en `backend/`, `frontend/src`, `docker/` y `scripts/` **no encuentra ni una llamada**: el único
camino en producción es RabbitMQ. Es una segunda puerta de entrada mantenida por inercia — útil
para depurar, pero **hoy expone la firma sin ninguna autenticación en el puerto 4000 publicado**.

---

## 7. Defectos y riesgos encontrados

Ordenados por gravedad. Ninguno se ha corregido en esta pasada: **un cambio de comportamiento aquí
es un incidente, no un bug**. Todos están fijados por una prueba que documenta el comportamiento
actual, para que arreglarlos sea después un diff visible.

| # | Dónde | Qué |
|---|---|---|
| **R-1** | payload de firma | **La contraseña del PKCS#12 viaja en claro** (`certPassword`) por AMQP sin TLS (`amqp://`, Sonar `S5332` en `:40`). Red interna, pero cualquiera con acceso a la cola o al bus lee claves privadas de firma. Es el riesgo más serio del microservicio. |
| **R-2** | `validate_signed_pdf_with_policy:955` | `validation_info.get("bottomLine", True)` — cuando el PDF firmado **no contiene firmas embebidas**, `validate_signed_pdf` devuelve `{"performed": False, "message": ...}`, un informe **sin** `bottomLine`, y el `.get(..., True)` lo deja pasar como válido. Un fallo silencioso de la firma se reporta como éxito. |
| **R-3** | `decode_extension_bytes:484-487` | **La rama que desenvuelve el OCTET STRING es inalcanzable** (comprobado): el primer candidato, el DER completo, sí parsea, y devuelve el contenido crudo con la cabecera del tipo interno pegada delante (`'\x13\n1234567890'`). La cédula sale sucia. **Funciona en producción de milagro**, porque `extract_cedula_from_values` la rescata después con una expresión regular. |
| **R-4** | `validate_payload:144` | `isinstance(True, int)` es cierto en Python: se aceptan booleanos como coordenadas (`{"page": True, "x": True, "y": True}` pasa el guard). Y `value == ""` deja pasar `0` en campos de texto. |
| **R-5** | `do_POST:1313` | `200 if result.get("status") == "success" else 500`: un payload inválido (culpa del cliente) sale como **500**, no 400. |
| **R-6** | todo el fichero | **30 `except Exception`, de los cuales 11 hacen `pass` y 3 `continue`**: 14 puntos donde un fallo desaparece sin dejar traza. Es deliberado (pyHanko cambia de API entre versiones), pero significa que una actualización de la librería degrada la salida en silencio en vez de romper. |
| **R-7** | `app.py:120` | `MINIO_CLIENT = create_minio_client()` **en tiempo de importación**. Efecto global: impide inyectar el cliente, obliga a parchear el módulo en pruebas y ata el arranque del proceso a que la configuración de MinIO sea parseable. |
| ~~**R-8**~~ | `app.py:1332` (antes clausura en `:1348`) | ✅ **CERRADO en esta pasada.** `on_message` era una **clausura** dentro del worker: el enrutado firma/validación —la única decisión de negocio del transporte— no se podía probar sin levantar el worker. Se sacó a función de módulo (**movimiento puro, cuerpo idéntico verificado línea a línea**) y se cubrió con 7 pruebas. `start_rabbit_worker` baja de 50 a 28 líneas, CC 9→6 y anidamiento 5→4. |
| **R-9** | `on_message:1336` | `logger.error` dentro de un `except` donde toca `logger.exception` (Sonar `S8572`): se pierde el *traceback* del payload ilegible. |
| **R-10** | puerto 4000 | Servidor HTTP sin autenticación, publicado al host, con `POST /sign` operativo y sin ningún consumidor legítimo (§6.7). |
| **R-11** | `SIGNER_WORKSPACE_DIR` | `/tmp/deasy-signer-workspace` es un directorio públicamente escribible (Sonar `S5443`). Mitigado en la imagen (`chown appuser`), no en el código. |
| **R-12** | modo token con N marcas | `sign_pdf_document` firma N veces reabriendo y reescribiendo el PDF entero en cada vuelta, con un temporal intermedio por firma. Coste O(N) en escrituras completas. No es un defecto, es una factura que conviene conocer antes de subir el número de marcas por documento. |

### 7.1 Código muerto: el signer Node anterior — ✅ retirado

`signer/index.js` (103 L), `signer/signService.js` (186 L), `signer/minioClient.js` (60 L),
`signer/package.json` (15 L) y `signer/package-lock.json` (398 L) eran **762 líneas de una
implementación anterior del mismo microservicio en Node**, sustituida por `app.py`.

Estaba muerta, comprobado:

- `docker/signer/Dockerfile` termina en `CMD ["python", "app.py"]`.
- El `npm install` de la imagen se ejecuta **solo en `/opt/sigmaker`**, no en `/app`. Las
  dependencias de `signer/package.json` (`amqplib`, `minio`, `fs-extra`) **no están instaladas**:
  `node index.js` fallaría en el primer `import`.
- No hay ni una referencia a esos ficheros fuera de ellos mismos.

Ahí vivían **5 de las 21 incidencias** que Sonar imputaba a `signer/`
(`javascript:S5332` ×2, `javascript:S5443`, `javascript:S3358`, `javascript:S7773`,
`javascript:S7785`). Nótese que `signer/sigmaker/` **sí está vivo** y no se toca.

---

## 8. La red de pruebas montada (fase 0, ya hecha)

`signer/tests/`, **224 casos en 8 ficheros**, `unittest` puro, sin dependencias nuevas.

```bash
bash scripts/docker-env.sh dev exec -T signer sh -lc 'cd /app && python -m unittest discover -s tests -t . -v'
```

| Fichero | Casos | Qué fija |
|---|---:|---|
| `test_payload_validation.py` | 34 | Campos obligatorios y **su orden**, `signType`, coordenadas, `as_bool`, precedencia de la TSA, tolerancia a avisos, resolución de coordenadas y token |
| `test_certificate_parsing.py` | 52 | `safe_serialize`, DN por objeto y por texto, atributos por OID con su respaldo, common name, cédula (incluido el RUC de 13 y el rechazo de 14 dígitos), decodificación de extensiones, prioridad entre las tres ACs, ficha del certificado |
| `test_pdf_metadata.py` | 33 | Fechas PDF (`D:`, zona horaria, truncadas, imposibles), diccionario `/Sig` con y sin barra, los alias defensivos de pyHanko **y su orden**, estado de revocación |
| `test_validation_report.py` | 21 | La entrada de firma completa que consume el frontend, `/DocTimeStamp` y `/ETSI.RFC3161`, el fallo de validación que no tumba la entrada, `/Contents` resumido por longitud, resumen y emparejado de sellos de tiempo |
| `test_plumbing.py` | 20 | Cliente MinIO (esquema y TLS), bucket por defecto, `content_type`, **la regla de Ghostscript en sus cuatro caminos**, carga de `trust/roots` y `trust/extra`, contexto de validación |
| `test_signing_flow.py` | 35 | **La caja del sello y el desplazamiento del modo token**, PAdES/sha256, `embed_validation_info` y `use_pades_lta` en sus combinaciones, encadenado de N firmas, y el contrato de respuesta completo de los dos jobs |
| `test_certificate_loading.py` | 9 | PKCS#12 real generado en memoria: ficha, cadena, **expirado**, **aún no vigente**, sin clave privada, contraseña incorrecta; carga de PEM y DER de confianza |
| `test_transport.py` | 20 | `/health`, 404, JSON inválido, **el mapeo status→código HTTP**, despacho a los dos jobs, **enrutado del worker por `routing_key`**, `correlationId` de vuelta, `basic_ack` incondicional, payload ilegible y sin `responseQueue`, orden posicional de los argumentos de `sigmaker`, publicación durable y persistente en RabbitMQ |

**Cobertura por función: 51 de 55 (93 %).** Las 4 sin cubrir son exactamente las que no se pueden
probar sin levantar el proceso o sin un PDF firmado de verdad: `start_rabbit_worker`,
`start_http_server`, `log_message` y `validate_signed_pdf`.

**La red se verificó por mutación**, no por fe. Se introdujeron cinco cambios de comportamiento en
`app.py` —desplazamiento del sello de `0.5` a `0.25` de alto, ancho por defecto 124→120, aceptar
enteros como token, `"Posible revocacion"`→`"Revocado"`, y anular el aviso de cédula no
encontrada— y la suite los cazó los cinco (6 casos en rojo). Después se revirtió: `git diff` sobre
`app.py` queda vacío.

Lo que la red **no** cubre y conviene saber: no firma ni un PDF de verdad. pyHanko está sustituido
por dobles en `test_signing_flow.py`. Fija las decisiones que toma `app.py` (geometría, banderas,
encadenado, contratos), no que pyHanko produzca una firma válida. **Eso es justo lo que hace falta
antes de la fase 5.**

---

## 9. Plan de corte por fases

Riesgo creciente. Cada fase dice qué red hace falta **antes** de empezarla.

### F0 — Red de pruebas · ✅ **HECHA** · riesgo nulo
224 casos, 93 % de las funciones, verificada por mutación. Detallada en §8.

### F1 — Retirar el signer Node muerto · ✅ **HECHA** · riesgo **muy bajo**
Borrados `signer/index.js`, `signer/signService.js`, `signer/minioClient.js`,
`signer/package.json` y `signer/package-lock.json` (§7.1). **`signer/sigmaker/` intacto.**

*Verificación hecha:* imagen reconstruida (`docker-env.sh dev up -d --build signer`), contenedor
arrancado, worker conectado a las dos colas, `GET /health` respondiendo y la suite en verde.
*Ganancia:* −762 líneas del microservicio y **−5 incidencias de Sonar** sin tocar una línea viva.

### F2 — Extraer configuración y fontanería · riesgo **bajo**
Tres módulos nuevos, **movimiento puro**:

- `signer/config.py` — las 18 constantes de entorno (39-56) y los tres mapas de OIDs (62-107), que
  son datos.
- `signer/storage.py` — cliente MinIO, `ensure_parent`, `download_from_minio`, `upload_to_minio`
  (110-120, 190-202). Aprovechar para **quitar el cliente global del tiempo de importación** (R-7):
  construirlo perezosamente. Ojo: eso *sí* es un cambio de comportamiento de arranque, va con su
  prueba.
- `signer/trust.py` — `load_certificate_file`, `load_certificates_from_dir`, `load_trust_material`,
  `build_validation_context` (759-802, 741-756).

*Red necesaria antes:* F0. Al mover, los parches `mock.patch.object(app, "X")` que apuntan a
constantes migradas hay que reapuntarlos al módulo nuevo — **las pruebas viajan con el código**.
*Ganancia:* ~150 líneas fuera de `app.py` y un sitio donde mirar la configuración.

### F3 — Extraer transporte y colapsar el esqueleto de los jobs · riesgo **bajo-medio**
- ✅ **Hecho ya**: `on_message` fuera de la clausura (R-8), con sus 7 pruebas de enrutado. Era el
  requisito previo, porque esas pruebas no se podían escribir antes.
- Pendiente: `signer/transport.py` con el servidor HTTP y el worker de RabbitMQ (1280-1393).
- Pendiente: colapsar la duplicación D-4 con un `ejecutar_job(validador, trabajo)` que recoja el
  esqueleto común de `process_job` y `process_validation_job`.

*Red necesaria antes:* F0, que ya incluye las pruebas de enrutado.
*Ganancia:* ~110 líneas fuera, y el transporte deja de ser el punto ciego de la cobertura.

### F4 — Extraer identidad de certificados · riesgo **medio**
`signer/certificates.py` con el bloque 304-734 (~430 líneas, **6 de las 8 funciones marcadas por
Sonar y 148 de los 356 puntos de complejidad cognitiva**). Es dominio, pero es **lectura**: no
genera criptografía, y es la parte mejor cubierta por la red de F0.

Dentro de esta fase, y solo dentro, cabe **reducir complejidad de verdad** (no solo mover):

- Unificar los cinco accesos defensivos por alias en un `primer_atributo(objeto, *nombres)` (D-1).
- Partir `extract_certificate_extensions` en sus dos recorridos, hoy entrelazados (D-3): es el 40
  de complejidad cognitiva y el anidamiento 6.
- Convertir `normalize_signature_entry` (136 líneas, 26 caminos) en una composición de pasos con
  nombre.

*Red necesaria antes:* F0, que ya cubre este bloque a conciencia. **Añadir además** un caso por
cada AC ecuatoriana con un certificado sintético completo antes de tocar
`extract_certificate_extensions`, porque hoy solo se prueban las tablas de OIDs, no el recorrido de
`asn1crypto`.
*Ganancia:* `app.py` baja de 1 190 a ~760 ncloc y la complejidad cognitiva del fichero cae
aproximadamente a la mitad.

### F5 — Tocar la firma · riesgo **alto** · **NO empezar sin la red de integración**
`sign_pdf_document` (832-919) y la política de validación (941-965). Aquí están R-2 y R-12.

*Red necesaria antes — y esta no existe todavía:* **una prueba de integración que firme un PDF de
verdad**. Generar un PKCS#12 en memoria (ya se hace en `test_certificate_loading.py`), firmar un
PDF mínimo con pyHanko real, y validar el resultado con `validate_pdf_signature`. Sin sello de
tiempo y sin red. Mientras esa prueba no exista y esté verde, **`sign_pdf_document` no se toca**:
la red actual fija las decisiones de `app.py`, no que la firma resultante sea válida.

### Lo que NO entra en ninguna fase

- **Los tres mapas de OIDs.** Son datos de las ACs ecuatorianas. La repetición es la forma
  correcta, igual que en `backend/config/sqlTables.js` (§7 del plan maestro). Se mueven a
  `config.py` en F2 y no se "unifican" nunca.
- **El orden de los guards de `validate_payload`.** El contrato de error del backend lo fija. Está
  caracterizado en `test_payload_validation.py`.
- **La regla de Ghostscript.** Aplanar un PDF ya firmado destruye las firmas previas. La condición
  se conserva tal cual.
- **Los `except Exception` de los accesos a pyHanko** (R-6). Son el precio de sobrevivir a los
  cambios de API de la librería. Se pueden centralizar (D-1), no eliminar.
- **`find_marker.py`.** 47 líneas, una responsabilidad, sano.
- **`signer/sigmaker/`.** Vivo y en uso; no confundir con el signer Node muerto de §7.1.
- **Los `S5332` de `amqp://` y `http://`** mientras el despliegue sea de red interna. Lo que sí hay
  que atender es R-1, que es el problema real detrás de esa marca.

---

## 10. Recomendación

**F1 está hecha** (−762 líneas muertas) y con ella el requisito previo de F3 (R-8). Lo siguiente
por orden de valor **no es F2**: mover la fontanería es barato pero apenas mueve la aguja —unas
150 líneas y ~14 puntos de complejidad cognitiva de 356—. **El corte que de verdad cambia el
fichero es F4**: 430 líneas, 6 de las 8 funciones marcadas y 148 de los 356 puntos, sobre el bloque
que la red de F0 cubre mejor. F2 conviene hacerla justo antes, para que F4 no arrastre configuración.

**F5 sigue bloqueada** hasta que exista una prueba que firme un PDF real. La red actual fija las
decisiones que toma `app.py`; no demuestra que la firma resultante sea válida.

Y antes de cualquier fase, hay dos cosas que no son refactor y merecen decisión propia: **R-1** (la
contraseña del certificado viajando en claro por la cola) y **R-2** (un fallo de firma que se
reporta como éxito). Ninguna de las dos se arregla moviendo código.
