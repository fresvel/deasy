const modalRegistry = new WeakMap();

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   LA ALTURA DE UN MODAL ES CONSECUENCIA DE CUÁNDO SE ABRE, NO UNA PROPIEDAD SUYA
   ══════════════════════════════════════════════════════════════════════════════════════════════

   Al mostrarse, un modal se coloca **un escalón por encima del más alto que esté visible en ese
   momento**. Nadie declara profundidades: la profundidad la determina la pila que hay al abrir,
   que es donde de verdad vive esa información.

   ── POR QUÉ NO ES UN NÚMERO DECLARADO (se probaron las dos, y una es imposible) ────────────────

   Hubo una versión con niveles fijos: `<AppModalShell nivel="2">`. Se cayó al medir un caso real.
   `openProcessWizard()` se llama desde **SIETE sitios** de la misma vista: seis desde la tabla,
   con nada abierto, y uno desde dentro del editor de registro. Es un componente, un número y
   siete profundidades: cualquier valor está mal en algún camino. Con `nivel="1"` el asistente se
   abría **por debajo** del editor —parecía que el botón no hacía nada—, y con `nivel="2"` mentía
   en los otros seis. No es un valor mal elegido: es que el dato no cabe en el componente.

   La alternativa —que lo pase quien abre— reparte el problema entre las siete llamadas, ninguna
   comprueba nada, y la octava que se añada falla en silencio. Es el mismo acuerdo por convención
   que produjo el desorden que F5.3 vino a quitar.

   ── DOS COSAS QUE HAY QUE SABER ANTES DE TOCAR ESTO ───────────────────────────────────────────

   1. **Esto escribe la altura EN LÍNEA, y una altura en línea gana a cualquier clase.** O sea que
      este fichero, y no el CSS, es quien manda en la altura de los modales. La clase
      `z-(--z-modal)` del armazón es el SUELO: dónde caen si esto nunca corre.
   2. **Hay que liberar al cerrar.** Si no, cada apertura sube un escalón que ya no vuelve a bajar
      y en una sesión larga los números se escapan de la banda. Por eso `liberarAltura` no es un
      detalle de limpieza: es la mitad del mecanismo.

   El suelo se lee del token en vez de clavarse (estuvo clavado a 1060, dentro de la banda que hoy
   está reservada a librerías) para que el CSS y este fichero no puedan desincronizarse.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

const SUELO_DE_RESERVA = 4020; // = --z-modal; sólo si el token no se puede leer (SSR, tests)
const sueloModal = () => {
    if (typeof document === 'undefined') return SUELO_DE_RESERVA;
    const declarado = getComputedStyle(document.documentElement).getPropertyValue('--z-modal');
    const n = parseInt(declarado, 10);
    return Number.isNaN(n) ? SUELO_DE_RESERVA : n;
};

/* Se mide sobre los modales realmente VISIBLES, no sobre los montados: los dos mecanismos ocultan
   con `display:none` —el antiguo por estilo en línea, el de Vue con la clase `hidden`—, así que el
   mismo predicado vale para ambos y ninguno cuenta mientras está guardado. */
const topVisibleModalZIndex = (exclude) => {
    if (typeof document === 'undefined') return SUELO_DE_RESERVA;
    let max = sueloModal();
    document.querySelectorAll('.deasy-dialog-root').forEach((el) => {
        if (el === exclude) return;
        if (getComputedStyle(el).display === 'none') return;
        const z = parseInt(el.style.zIndex || getComputedStyle(el).zIndex, 10);
        if (!Number.isNaN(z)) max = Math.max(max, z);
    });
    return max;
};

/* Las dos mitades del sistema de modales llaman AQUÍ, y ésa es la razón de que exista este par:
   el mecanismo antiguo (`ModalController.show/hide`, diez módulos) y el de Vue (`AppModalShell`
   con `:open`, que antes no elevaba nada y por eso era el único que se podía romper). Una sola
   regla, un solo sitio donde cambiarla. */
export const elevarSobreLoVisible = (elemento) => {
    if (!elemento || typeof document === 'undefined') return;
    elemento.style.zIndex = String(topVisibleModalZIndex(elemento) + 1);
};

export const liberarAltura = (elemento) => {
    if (!elemento) return;
    elemento.style.zIndex = '';
};

class ModalController {
    constructor(element) {
        this.element = element;
        this.boundOnDismiss = this.onDismissClick.bind(this);
        this.boundOnKeydown = this.onKeydown.bind(this);
        this.element.addEventListener('click', this.boundOnDismiss);
    }

    dispatchLifecycleEvent(name) {
        this.element.dispatchEvent(new CustomEvent(name, { bubbles: true }));
    }

    onDismissClick(event) {
        const dismissTarget = event.target.closest('[data-modal-dismiss]');
        if (dismissTarget) {
            event.preventDefault();
            this.hide();
        }
    }

    onKeydown(event) {
        if (event.key === 'Escape') {
            this.hide();
        }
    }

    show() {
        if (this.element.classList.contains('show')) {
            return;
        }

        this.dispatchLifecycleEvent('show.bs.modal');
        this.element.style.display = 'block';
        elevarSobreLoVisible(this.element);
        this.element.removeAttribute('aria-hidden');
        this.element.setAttribute('aria-modal', 'true');
        this.element.setAttribute('role', 'dialog');

        requestAnimationFrame(() => {
            this.element.classList.add('show');
            this.dispatchLifecycleEvent('shown.bs.modal');
        });

        document.addEventListener('keydown', this.boundOnKeydown);
    }

    hide() {
        if (!this.element.classList.contains('show') && this.element.style.display === 'none') {
            return;
        }

        this.dispatchLifecycleEvent('hide.bs.modal');
        this.element.classList.remove('show');
        this.element.setAttribute('aria-hidden', 'true');
        this.element.removeAttribute('aria-modal');
        this.element.removeAttribute('role');
        this.element.style.display = 'none';
        liberarAltura(this.element);

        document.removeEventListener('keydown', this.boundOnKeydown);

        this.dispatchLifecycleEvent('hidden.bs.modal');
    }

    dispose() {
        this.hide();
        this.element.removeEventListener('click', this.boundOnDismiss);
        modalRegistry.delete(this.element);
    }
}

export class Modal {
    constructor(element) {
        return Modal.getOrCreateInstance(element);
    }

    static getOrCreateInstance(element) {
        if (!element) return null;

        let instance = modalRegistry.get(element);
        if (!instance) {
            instance = new ModalController(element);
            modalRegistry.set(element, instance);
        }

        return instance;
    }

    static getInstance(element) {
        if (!element) return null;
        return modalRegistry.get(element) || null;
    }
}
