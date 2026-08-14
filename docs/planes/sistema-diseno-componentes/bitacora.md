# Bitácora — Sistema de diseño, tercera vuelta

> Se escribe **al ejecutar**, no antes. Cada entrada con lo que se midió, no con lo que se supuso.
>
> La de la segunda vuelta está en
> [`docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno-plantillas/bitacora.md`](../../docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno-plantillas/bitacora.md)
> y **sigue valiendo**: es donde están las trampas ya pagadas.

## Lo que la vuelta anterior dejó aprendido, y aquí se da por sabido

Cinco cosas que costaron caro y que valen para todo lo que queda:

1. **Un test que afirma sobre el valor no protege la regla.** Dos suites se rompieron con el
   comportamiento **intacto** por comprobar `toContain('slate')`. Se afirma el contrato, no el color.
2. **Un color en `hover:`/`focus:` no es el color del elemento.** Cinco botones acabaron convertidos
   en alertas porque `\b` no impide casar dentro de una variante con prefijo.
3. **El patrón a nivel de atributo cruza las comillas de un ternario.** Para un `:class` con
   expresión, el reemplazo va a nivel de **token**.
4. **`border-*` (color) y `border` (ancho) no son lo mismo.** Colapsar unas clases dejó 29 controles
   sin borde: el reset de Tailwind pone `border-width: 0` y nada lo repone.
5. **Vue renderiza al DOM los comentarios HTML de una plantilla.** Los comentarios de componente van
   en el `<script>`.

## Lo que hay que remedir antes de empezar

Las cifras del plan son del **2026-08-13** y el frontend se mueve. Antes de la fase A, remedir:

```bash
bash scripts/stack.sh b exec -T frontend pnpm run lint       # los cuatro gates dan el estado actual
rtk proxy wc -l frontend/src/modules/home/views/HomeView.vue frontend/src/modules/firmas/components/FirmarPdf.vue
```

⚠️ Y **capturar la línea base ANTES de tocar nada**: huella de `getComputedStyle` de las pantallas de
control y el CSS construido. Sin eso no hay A/B, y en una extracción el A/B es la única prueba.
