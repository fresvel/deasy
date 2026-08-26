/* ─────────────────────────────────────────────────────────────────────────────
   VISOR DE DIAGRAMAS — zoom, arrastre y pantalla completa para los Mermaid.

   ── Por que existe ──────────────────────────────────────────────────────────
   Mermaid le pone al SVG un `max-width` igual a su tamaño natural, y el CSS del
   sitio le da `width: 100%`. El resultado es que el diagrama SIEMPRE se pinta al
   ancho de la columna, encogido si no cabe. Medido el 2026-08-26 a 1905 px de
   ventana (columna de 1285 px), sobre los 14 diagramas de `/modelo/`:

     mapa-completo          3538 x 1191   escala 0,36   letra efectiva  5,8 px
     flujo-de-firma         2362 x 2599   escala 0,54   letra efectiva  8,7 px
     proceso                1920 x 1600   escala 0,67   letra efectiva 10,7 px
     organizacion           1864 x 2371   escala 0,69   letra efectiva 11,0 px
     vocabularios-de-estado 1754 x  222   escala 0,73   letra efectiva 11,7 px

   Siete de los catorce salian encogidos y cinco por debajo de 12 px, que es
   donde se deja de leer.

   ── Por que el zoom del navegador NO lo arreglaba ───────────────────────────
   Al ampliar, el viewport se estrecha EN PIXELES CSS, la columna se estrecha con
   el, y el SVG —que es `width: 100%`— se encoge en la misma proporcion. Su
   tamaño FISICO no cambia: solo se recorta. De ahi el sintoma que lo destapo,
   "crece hasta un punto y luego se hace pequeño".

   ── Que hace este fichero ───────────────────────────────────────────────────
   Envuelve cada diagrama en un visor con su propio zoom, que es un `transform`
   sobre el SVG. Al ser vectorial no se pixela: acercar da letra de verdad, no
   una ampliacion borrosa. El estado de reposo es EXACTAMENTE el de hoy (ajuste
   a la columna), asi que los siete diagramas que ya se veian bien no cambian.

   ── Dos detalles que no son negociables ─────────────────────────────────────
   1. La rueda sola NO hace zoom: hace scroll de pagina, como en cualquier sitio.
      Para acercar hay que pulsar Ctrl (o ⌘). Secuestrar la rueda dentro de un
      documento largo es de las cosas que mas molestan al leer.
   2. La envoltura va POR FUERA del `<pre>`. `astro-mermaid` reescribe el
      `innerHTML` del `<pre>` cada vez que cambia el tema (claro/oscuro), asi que
      cualquier cosa que metamos DENTRO desaparece. Por eso el observador
      re-engancha el SVG nuevo conservando el zoom.
   ───────────────────────────────────────────────────────────────────────────── */

(function () {
  "use strict";

  var ZOOM_MAX = 8;
  var PASO = 1.35;

  // El zoom se expresa RELATIVO AL AJUSTE: `k = 1` es "como se ve hoy". El
  // porcentaje que se ENSEÑA, en cambio, es relativo al tamaño natural del
  // diagrama, que es el dato que le importa a quien no puede leer las letras:
  // el mapa completo abre diciendo "36 %", y eso ya explica el problema.
  var visores = new WeakMap();

  function medidaNatural(svg) {
    var vb = svg.getAttribute("viewBox");
    if (vb) {
      var p = vb.split(/[\s,]+/);
      var w = Number(p[2]);
      var h = Number(p[3]);
      if (w > 0 && h > 0) return { w: w, h: h };
    }
    var r = svg.getBoundingClientRect();
    return { w: r.width || 1, h: r.height || 1 };
  }

  function boton(etiqueta, texto) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "deasy-visor-boton";
    b.setAttribute("aria-label", etiqueta);
    b.title = etiqueta;
    b.textContent = texto;
    return b;
  }

  function limitar(est) {
    var w = est.pre.clientWidth;
    var h = est.pre.clientHeight;
    var W = w * est.k;
    var H = est.altoAjustado * est.k;
    // Si el contenido cabe, se centra; si no, se impide sacarlo del hueco.
    est.x = W <= w ? (w - W) / 2 : Math.min(0, Math.max(w - W, est.x));
    est.y = H <= h ? (h - H) / 2 : Math.min(0, Math.max(h - H, est.y));
  }

  function aplicar(est) {
    if (!est.svg) return;
    limitar(est);
    est.svg.style.transformOrigin = "0 0";
    est.svg.style.transform =
      "translate(" + est.x.toFixed(2) + "px," + est.y.toFixed(2) + "px) scale(" + est.k.toFixed(4) + ")";
    est.envoltura.classList.toggle("deasy-visor-movible", est.k > 1.001);

    var natural = est.natural.w || 1;
    var pct = Math.round((est.k * est.pre.clientWidth * 100) / natural);
    est.nivel.value = pct + " %";
    est.nivel.title = "Tamaño natural del diagrama: " + Math.round(natural) + " px de ancho";
    est.menos.disabled = est.k <= 1.001;
  }

  // Acerca o aleja manteniendo quieto el punto (px, py), en coordenadas del hueco.
  function zoom(est, factor, px, py) {
    var previo = est.k;
    var nuevo = Math.min(ZOOM_MAX, Math.max(1, previo * factor));
    if (nuevo === previo) return;
    var razon = nuevo / previo;
    est.x = px - (px - est.x) * razon;
    est.y = py - (py - est.y) * razon;
    est.k = nuevo;
    aplicar(est);
  }

  function centro(est) {
    return [est.pre.clientWidth / 2, est.pre.clientHeight / 2];
  }

  function ajustar(est) {
    est.k = 1;
    est.x = 0;
    est.y = 0;
    aplicar(est);
  }

  function crear(pre) {
    var envoltura = document.createElement("div");
    envoltura.className = "deasy-visor";
    pre.parentNode.insertBefore(envoltura, pre);
    envoltura.appendChild(pre);

    var barra = document.createElement("div");
    barra.className = "deasy-visor-barra";
    var ayuda = document.createElement("span");
    ayuda.className = "deasy-visor-ayuda";
    ayuda.textContent = "Doble clic: tamaño natural · Ctrl + rueda: acercar · arrastra para moverte";
    barra.appendChild(ayuda);
    var menos = boton("Alejar", "−");
    var nivel = document.createElement("output");
    nivel.className = "deasy-visor-nivel";
    var mas = boton("Acercar", "+");
    var reset = boton("Ajustar a la columna", "⤡");
    var pantalla = boton("Pantalla completa", "⤢");
    barra.appendChild(menos);
    barra.appendChild(nivel);
    barra.appendChild(mas);
    barra.appendChild(reset);
    barra.appendChild(pantalla);
    envoltura.appendChild(barra);

    var est = {
      pre: pre,
      envoltura: envoltura,
      nivel: nivel,
      menos: menos,
      svg: null,
      natural: { w: 1, h: 1 },
      altoAjustado: 1,
      k: 1,
      x: 0,
      y: 0
    };

    pre.tabIndex = 0;
    pre.setAttribute("aria-label", "Diagrama con zoom. Usa las teclas + y − para acercar y alejar, 0 para ajustar, y las flechas para moverte.");

    menos.addEventListener("click", function () {
      var c = centro(est);
      zoom(est, 1 / PASO, c[0], c[1]);
    });
    mas.addEventListener("click", function () {
      var c = centro(est);
      zoom(est, PASO, c[0], c[1]);
    });
    reset.addEventListener("click", function () {
      ajustar(est);
    });
    pantalla.addEventListener("click", function () {
      if (document.fullscreenElement === envoltura) {
        document.exitFullscreen();
      } else if (envoltura.requestFullscreen) {
        envoltura.requestFullscreen().catch(function () {});
      }
    });

    document.addEventListener("fullscreenchange", function () {
      if (document.fullscreenElement === envoltura || est.enPantalla) {
        est.enPantalla = document.fullscreenElement === envoltura;
        pantalla.textContent = est.enPantalla ? "⤡" : "⤢";
        pantalla.title = est.enPantalla ? "Salir de pantalla completa" : "Pantalla completa";
        pantalla.setAttribute("aria-label", pantalla.title);
        // El hueco cambia de tamaño: hay que volver a medir el alto ajustado.
        requestAnimationFrame(function () {
          medirYAplicar(est);
        });
      }
    });

    // La rueda SOLO con Ctrl/⌘. Sin modificador se deja pasar el scroll de la
    // pagina, que es lo que espera cualquiera que este leyendo.
    pre.addEventListener(
      "wheel",
      function (e) {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        var r = pre.getBoundingClientRect();
        zoom(est, e.deltaY < 0 ? PASO : 1 / PASO, e.clientX - r.left, e.clientY - r.top);
      },
      { passive: false }
    );

    // Doble clic: alterna entre el ajuste y el tamaño natural, en el punto pulsado.
    pre.addEventListener("dblclick", function (e) {
      var r = pre.getBoundingClientRect();
      var px = e.clientX - r.left;
      var py = e.clientY - r.top;
      var kNatural = Math.min(ZOOM_MAX, Math.max(1, est.natural.w / (pre.clientWidth || 1)));
      if (est.k > 1.001) ajustar(est);
      else zoom(est, kNatural, px, py);
    });

    var arrastre = null;
    pre.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 || est.k <= 1.001) return;
      arrastre = { id: e.pointerId, x: e.clientX, y: e.clientY };
      pre.setPointerCapture(e.pointerId);
      envoltura.classList.add("deasy-visor-arrastrando");
    });
    pre.addEventListener("pointermove", function (e) {
      if (!arrastre || e.pointerId !== arrastre.id) return;
      est.x += e.clientX - arrastre.x;
      est.y += e.clientY - arrastre.y;
      arrastre.x = e.clientX;
      arrastre.y = e.clientY;
      aplicar(est);
    });
    function soltar(e) {
      if (!arrastre || e.pointerId !== arrastre.id) return;
      arrastre = null;
      envoltura.classList.remove("deasy-visor-arrastrando");
    }
    pre.addEventListener("pointerup", soltar);
    pre.addEventListener("pointercancel", soltar);

    pre.addEventListener("keydown", function (e) {
      var c = centro(est);
      var salto = 60;
      if (e.key === "+" || e.key === "=") zoom(est, PASO, c[0], c[1]);
      else if (e.key === "-" || e.key === "_") zoom(est, 1 / PASO, c[0], c[1]);
      else if (e.key === "0") ajustar(est);
      else if (e.key === "ArrowLeft") est.x += salto;
      else if (e.key === "ArrowRight") est.x -= salto;
      else if (e.key === "ArrowUp") est.y += salto;
      else if (e.key === "ArrowDown") est.y -= salto;
      else return;
      e.preventDefault();
      aplicar(est);
    });

    return est;
  }

  // Mide el diagrama SIN el `transform` puesto: con el aplicado, cualquier
  // medida sale multiplicada por el zoom y el calculo se realimenta.
  function medirYAplicar(est) {
    if (!est.svg) return;
    var transformPrevio = est.svg.style.transform;
    est.svg.style.transform = "none";
    est.natural = medidaNatural(est.svg);
    est.altoAjustado = est.pre.clientHeight || est.svg.getBoundingClientRect().height || 1;
    est.svg.style.transform = transformPrevio;
    aplicar(est);
  }

  function enganchar(pre) {
    var svg = pre.querySelector("svg");
    if (!svg) return;
    var est = visores.get(pre);
    if (!est) {
      est = crear(pre);
      visores.set(pre, est);
    }
    if (est.svg === svg) return;
    est.svg = svg;
    est.envoltura.setAttribute("data-listo", "");
    medirYAplicar(est);
  }

  var pendiente = false;
  function escanear() {
    pendiente = false;
    var lista = document.querySelectorAll("pre.mermaid");
    for (var i = 0; i < lista.length; i++) enganchar(lista[i]);
  }
  function pedirEscaneo() {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(escanear);
  }

  // `astro-mermaid` no avisa de que ha terminado (no emite ningun evento), y
  // ademas rehace el `innerHTML` del `<pre>` al cambiar el tema. Observar el
  // documento cubre las dos cosas con el mismo mecanismo.
  function arrancar() {
    escanear();
    new MutationObserver(pedirEscaneo).observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", function () {
      var lista = document.querySelectorAll("pre.mermaid");
      for (var i = 0; i < lista.length; i++) {
        var est = visores.get(lista[i]);
        if (est) medirYAplicar(est);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", arrancar);
  } else {
    arrancar();
  }
})();
