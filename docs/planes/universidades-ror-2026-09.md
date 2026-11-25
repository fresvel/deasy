# Frente 19 · La universidad que emite el título deja de ser texto

**Abierto el 2026-09-05 por decisión del dueño**, al preguntar si existe un registro público mundial
de universidades que sirva de semilla.

## §0 · Control de ejecución

| Tarea | Qué entrega | Estado | Evidencia | Fecha |
|---|---|:--:|---|---|
| **U0** | Este plan, con la viabilidad medida | 🟡 | ROR medido contra su API el 2026-09-05. **Pendiente de aprobación del dueño** | |
| **U1** | La fuente evaluada y descargada: volcado de ROR filtrado a `types:education` | ⬜ | | |
| **U2** | La tabla `universidades`, sembrada por el bootstrap | ⬜ | | |
| **U3** | `expediente_titulos.ies` y `expediente_tesis.ies` pasan a clave ajena | ⬜ | | |
| **U4** | El frontend: desplegable con cotejo y alta local | ⬜ | | |
| **U5** | La actualización periódica del volcado, decidida y documentada | ⬜ | | |

**6 tareas.** `U3` depende del frente 18: mientras `expediente_titulos` no exista, no hay columna que
convertir.

---

## 1 · Por qué

`ies` es hoy **texto libre** en dos tablas del diseño del frente 18. Es el mismo problema que ya se
resolvió con el país y con la titulación: sin catálogo no se puede agrupar, ni contar, ni detectar
que `PUCESE`, `P.U.C.E.S.E.` y `Pontificia Universidad Católica del Ecuador Sede Esmeraldas` son la
misma institución.

Y hay un consumidor concreto esperando: **homologar títulos extranjeros** exige saber qué institución
los emitió, no una cadena.

## 2 · La fuente: ROR, medida

**[ROR (Research Organization Registry)](https://ror.org/)** — CC0 1.0, API REST abierta sin clave, y
volcados mensuales en Zenodo. Medido contra `api.ror.org/v2` el **2026-09-05**:

| | |
|---|---:|
| Organizaciones con `types:education` | **27 055** |
| Ecuador | **103** |
| Colombia | 223 |
| España | 218 |
| Francia | 500 |
| Estados Unidos | 4 425 |

Cada ficha trae: identificador propio, **nombres alternativos y acrónimos**, país y localidad
(vía GeoNames), año de fundación, dominios web, identificadores externos y `status`.

```
GET https://api.ror.org/v2/organizations?filter=types:education,country.country_code:EC
→ Universidad Yachay Tech · Universidad Técnica de Babahoyo · Universidad Estatal de Bolívar …
```

## 3 · Lo que la descalifica como autoridad, y está medido

```
GET https://api.ror.org/v2/organizations?query=Esmeraldas
→ 0 resultados
```

**PUCESE no está en ROR.** Sí están `PUCE` y las sedes de **Ibarra**, **Manabí** y **Santo Domingo**;
Esmeraldas no.

No es un fallo puntual: ROR indexa organizaciones **de investigación** —las que aparecen como
afiliación en literatura científica—, no todas las que emiten títulos. Van a faltar institutos
técnicos y tecnológicos, universidades pequeñas, y centros extranjeros sin producción indexada.

⚠️ **Por eso una clave ajena obligatoria contra ROR sería un error**, y uno ya conocido: es la trampa
de `titulacion_libre` del frente 18 otra vez —forzar el catálogo y perder el dato real—, con el
agravante de que **la primera víctima sería la institución del propio usuario**.

## 4 · El diseño: la misma forma que `titulaciones`

No hay que inventar nada. El frente 18 ya resolvió este problema exacto, y el mecanismo se reutiliza
entero:

| Pieza | De dónde sale |
|---|---|
| `origen` (`ror` · `registro_local`) | El eje de procedencia de `carreras`/`titulaciones` |
| `nombre_norm` `GENERATED ALWAYS ... STORED` | La forma canónica con `translate()`, no `unaccent()` |
| Índice único sobre la forma canónica | Lo que convierte el aviso en imposibilidad |
| Cotejo `sim >= 0,75` **o** `lev <= 2` | Umbrales ya medidos sobre 863 nombres reales |
| `pais_id` → `paises` | La misma costura del multi-inquilino |

```
universidades
  id · pais_id FK · ror_id (nulable, UNIQUE) · nombre · nombre_norm (generada)
  acronimo · origen CHECK · is_active · vigente_hasta
```

`ror_id` **nulable** es lo que expresa la realidad medida: una universidad puede estar en el catálogo
sin estar en ROR. Y **único** cuando existe, para que un mismo ROR no entre dos veces.

## 5 · Lo que hay que decidir

| | |
|---|---|
| **¿`ies` sigue admitiendo texto?** | El frente 18 retiró `titulacion_libre`. Coherente sería `universidad_id NOT NULL` y dar de alta lo que falte. **Es la misma decisión y debería tener la misma respuesta** |
| **¿Se enlaza con `units`?** | `ies` puede ser la propia institución. Hoy son mundos separados y está abierto en el §7 del frente 18 |
| **¿Cada cuánto se refresca el volcado?** | ROR publica mensualmente. Refrescar no puede pisar las altas locales ni las correcciones |
| **¿Sedes o institución?** | ROR modela PUCE y sus sedes como organizaciones **distintas** con relaciones entre sí. Hay que decidir si `universidades` es plana o recoge esa jerarquía |

## 6 · Cómo se verifica

```bash
bash scripts/stack.sh <letra> exec -T backend npm run test:char:run
bash scripts/docs/gen-dbml.sh
```
Y en el navegador, `/perfil` como gestor: añadir un título con una universidad del catálogo y otra
que no esté, comprobando que el cotejo avisa antes de crearla.

## 7 · Fuentes

- [Research Organization Registry](https://ror.org/) — el registro
- [ROR · About](https://ror.org/about/) — licencia CC0 y modelo de gobernanza
- [ROR Data en Zenodo](https://zenodo.org/records/19576723) — los volcados versionados
