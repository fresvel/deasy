# Frente 21 · El mapa, y que la dirección se prellene sola

**Abierto el 2026-09-08 por decisión del dueño**, al preguntar por el mapa del modal de direcciones:
si conviene uno mejor, qué costaría, y si al marcar un punto puede rellenarse el formulario.

## §0 · Control de ejecución

| Tarea | Qué entrega | Estado | Evidencia | Fecha |
|---|---|:--:|---|---|
| **M0** | Este plan, con los costes medidos y el proveedor decidido | 🟡 | Precios verificados el 2026-09-08. **Falta la decisión del dueño sobre el proveedor** | |
| **M1** | ~~Los iconos del marcador dejan de venir de un CDN de terceros~~ | ✅ | Se adelantó al frente 20: `leaflet@1.9.4` empaquetado, `data:` en el build, **cero peticiones a `cdnjs`** medidas en el navegador | 2026-09-08 |
| **M2** | El proveedor de teselas, decidido y configurado por variable de entorno | ⬜ | | |
| **M3** | La geocodificación inversa: de un punto a país · provincia · cantón | ⬜ | | |
| **M4** | El cotejo del texto devuelto contra el catálogo | ⬜ | Depende de **M3** | |
| **M5** | El prellenado en el formulario, con la persona verificando antes de guardar | ⬜ | Depende del **P9** del frente 20 | |
| **M6** | Lo que la LOPDP obliga a declarar, si el proveedor es de terceros | ⬜ | | |

**7 tareas · 1 cerrada.** `M5` va **después de `P9`** del frente 20: ahí es donde el prellenado vale,
y hacerlo antes en `/admin` para repetirlo luego es trabajo doble.

---

## 1 · Lo que hay hoy, medido

**Leaflet 1.9.4 + teselas de OpenStreetMap.** Sin clave, sin cuenta, sin factura. Vive en
`frontend/src/shared/components/inputs/AppMapPicker.vue`, y lo consume el control `geopoint` del
editor genérico.

⚠️ **Las teselas de `tile.openstreetmap.org` tienen política de uso**: prohíben el uso intensivo y el
acceso puede retirarse sin aviso. Para un formulario de RR. HH. no hay problema hoy; conviene saberlo
antes de que lo use el registro público.

### M1, ya cerrada: los iconos venían de un tercero

```js
iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png"
```

Dos defectos en una línea, y ninguno era el que se buscaba:

- **El marcador se descargaba de Cloudflare en tiempo de ejecución.** Sin internet, tras un
  cortafuegos o si cdnjs cae, el mapa se abría **sin marcador**. Y cada persona que abría el modal le
  pegaba a Cloudflare con su IP — que en un formulario de datos personales no es un detalle.
- **Apuntaba a la 1.7.1 y la instalada es la 1.9.4.** Nadie lo notó porque esas imágenes no han
  cambiado, pero era un desajuste esperando a morder.

Las tres imágenes vienen dentro del paquete. Ahora se importan con `?url`, y como pesan menos de 4 KB
**Vite las incrusta como `data:`**: cero peticiones, ni siquiera al propio servidor.

## 2 · Lo que costaría un mapa mejor

Precios verificados el **2026-09-08**:

| Opción | Coste | Qué gana | Qué cuesta |
|---|---|---|---|
| **OSM** (actual) | **0** | — | Menos detalle en zona rural |
| **Google Maps** | **10 000 cargas/mes gratis**, luego **7 $/1 000** | El mejor detalle y las fotos | Clave en el navegador, cuenta de facturación, y **un tercero que recibe la IP** de cada persona |
| **Mapbox · MapTiler** | Escalón gratuito mayor, precio menor | Estilos propios | Sigue siendo clave y factura |
| **Teselas propias** | Un servidor | Cero terceros | Operación propia |

⚠️ **Con este volumen, Google saldría gratis**: 10 000 cargas al mes son ~330 aperturas diarias del
formulario, muy por encima de lo que hace una universidad. **El coste real no es el dinero: es que el
frente 17 montó consentimiento demostrable y meter Google añade un tratamiento de datos que habría
que declarar.** Esa decisión es del dueño y del área legal, no técnica — y por eso `M0` sigue 🟡.

## 3 · El prellenado: sí se puede, y el problema difícil no es el que parece

Coordenadas → dirección es **geocodificación inversa**:

| | Coste | Límite |
|---|---|---|
| **Nominatim** público (OSM) | 0 | **1 petición/segundo**, y el uso periódico está **desaconsejado**. Puede retirarse sin aviso |
| **Nominatim o Photon propios** | Un contenedor | Sin límite. Photon además tolera erratas |
| **Google Geocoding** | Escalón gratuito | El más preciso en direcciones urbanas |

**Pero el trabajo no está en obtener la dirección: está en meterla en el catálogo.** El servicio
devuelve **cadenas** —`"Esmeraldas"`, `"Provincia de Esmeraldas"`— y el modelo guarda `canton_id`. Hay
que casar ese texto contra **222 cantones**, con sus tildes y sus nombres repetidos entre provincias
(«Bolívar» está en Carchi y en Manabí).

⚠️ **Esa maquinaria ya existe**: es el cotejo del frente 18 —`nombre_norm` generada, trigramas y
Levenshtein— con los umbrales ya medidos sobre datos reales. Aquí además va **acotado por provincia**,
que lo hace bastante más fácil. `M4` la reutiliza; no se escribe de nuevo.

**Lo realista es prellenar hasta el cantón** —país, provincia, cantón— y dejar que la persona escriba
sector, barrio y calles: el detalle de calle en la zona rural de Esmeraldas no lo tiene ni Google.

## 4 · Lo que hay que decidir

| | |
|---|---|
| **El proveedor de teselas** | OSM, Google, Mapbox o propias. Decide coste, clave y declaración LOPDP |
| **El de geocodificación** | Puede ser distinto del de teselas |
| **Si el registro público lo usa** | Si sí, el volumen sube y la política de OSM empieza a importar |
| **Qué se declara en el consentimiento** | Si entra un tercero, hay que decirlo — el frente 17 dejó el mecanismo |

## 5 · Cómo se verifica

```bash
bash scripts/stack.sh <letra> exec -T frontend pnpm run test:unit
bash scripts/stack.sh <letra> exec -T frontend pnpm run build
```
Y en el navegador, **con la pestaña de red abierta**: el modal de dirección de
`/admin/usuarios/personas/direcciones` no debe pedir nada a un dominio que no esté declarado.
