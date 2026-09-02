# Frente 16 · El versionado de objetos en MinIO — análisis

> **Estado: ABIERTO, sin trabajo hecho.** Nace del hallazgo de que **los tres buckets están sin
> versionar**, y de la decisión del dueño de analizarlo a fondo antes de tocar nada.
>
> **No se ha modificado ningún bucket.**

---

## 1 · El hallazgo

Medido el 2026-09-02 en la pila C: `deasy-documents`, `deasy-templates` y `deasy-users` responden
`is un-versioned`, los tres.

**Consecuencia:** sobrescribir el objeto de un documento firmado **destruye el anterior sin dejar
rastro**. No hay «deshacer», no hay «qué había antes», no hay auditoría posible sobre el fichero.

---

## 2 · Lo que ya existe, y por qué no es lo mismo

⚠️ **El sistema SÍ versiona — pero por SUB-RUTA, no por objeto.** Comprobado:

```
System/tpl_informe_general/1.0.0/   ← storage_version 1.0.0, lifecycle_state 'retired'
System/tpl_informe_general/1.1.0/   ← storage_version 1.1.0, lifecycle_state 'published'
```

Es un versionado **lógico y explícito**: cada versión tiene su carpeta, su fila en
`template_artifacts` y su estado de ciclo de vida. **Funciona, y tiene ventajas reales** sobre el
versionado del almacén:

| | Sub-ruta (hoy) | Versionado de MinIO |
|---|---|---|
| ¿Se ve desde la base? | ✅ **es una fila, con su estado** | ❌ vive fuera del modelo |
| ¿Se puede publicar/retirar? | ✅ `lifecycle_state` | ❌ no tiene ese concepto |
| ¿Protege de una **sobrescritura accidental**? | ❌ **no** — si algo escribe sobre la misma ruta, se pierde | ✅ **sí** |
| ¿Sabe qué versión leyó cada quien? | parcialmente | ✅ con el `version-id` |

**Ninguno de los dos sustituye al otro**, y ése es el nudo del análisis: no es «migrar de uno a otro»
sino decidir **qué protege cada capa**.

---

## 3 · Las preguntas que este frente tiene que contestar

1. **¿Son capas complementarias?** La hipótesis de partida: la sub-ruta es el **versionado del
   negocio** (qué versión está publicada) y el de MinIO es el **seguro del almacén** (que nada se
   pierda por un `PUT` equivocado). Si es así, se activan los dos y no hay migración que hacer.
2. **¿Qué pasa con lo que ya existe?** Activar el versionado **no versiona hacia atrás**: lo que hay
   hoy queda como versión inicial. No se pierde nada, pero tampoco se recupera nada de lo ya perdido.
3. **¿Cuánto ocupa?** Cada sobrescritura pasa a conservar la anterior. Hay que medir el ritmo real de
   escritura antes de activarlo en producción, no después.
4. **¿Hace falta ciclo de vida?** MinIO puede expirar versiones antiguas automáticamente. Sin eso,
   el bucket crece para siempre — que es el mismo error que ya se detectó con el perfil de WhatsApp.
5. **¿Y el modelo actual mejora?** El dueño lo apuntó: quizá con versionado de objeto, parte de lo
   que hoy se resuelve con sub-rutas se simplifique. **Merece mirarse, no darse por hecho.**

---

## 4 · Lo que NO hay que hacer todavía

- **No activar el versionado «porque sí».** Es reversible, pero lo que se acumula mientras tanto no
  se borra solo.
- **No confundirlo con el bucket legal.** Ése (`deasy-legal`) es **WORM**, otra cosa: allí la
  inmutabilidad es el objetivo. Aquí el objetivo es no perder lo anterior por accidente.
- **No mezclarlo con el frente 15.** Los canales ya están cerrados; esto es del frente documental.

---

## 5 · Por dónde empezar

| | |
|---|---|
| **1** | Medir el ritmo de escritura real por bucket — cuántos `PUT` sobre la misma clave hay al día |
| **2** | Decidir si son capas complementarias (§3.1). Es la pregunta que ordena el resto |
| **3** | Probar el versionado en la pila de un worktree, con datos de verdad, y medir el crecimiento |
| **4** | Decidir la expiración de versiones antiguas **antes** de activarlo, no después |
