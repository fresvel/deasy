const modalRegistry = new WeakMap();

// Apilamiento de modales: al mostrar un modal se coloca por encima del modal visible más alto
// (sea con z-index estático inline o dinámico), de modo que un modal anidado siempre quede encima
// y accesible. Se calcula sobre los modales realmente visibles, así no importa el esquema previo.
//
// ⚠️ Esto pone la altura EN LÍNEA, y una altura en línea gana a cualquier clase. O sea que este
// fichero —y no el CSS— es quien manda en los modales que pasan por él, que son diez módulos.
// Convive con la prop `nivel` de `AppModalShell` sin pelearse: `nivel` fija el SUELO por clase y
// esto sube desde el más alto que haya visible, así que sólo empuja hacia arriba, nunca hacia
// abajo. El suelo se lee del token para que las dos mitades no puedan desincronizarse: estaba
// clavado a 1060, dentro de la banda que ahora está reservada a librerías.
const SUELO_DE_RESERVA = 4020; // = --z-modal; sólo se usa si el token no se puede leer (SSR, tests)
const sueloModal = () => {
    if (typeof document === 'undefined') return SUELO_DE_RESERVA;
    const declarado = getComputedStyle(document.documentElement).getPropertyValue('--z-modal');
    const n = parseInt(declarado, 10);
    return Number.isNaN(n) ? SUELO_DE_RESERVA : n;
};
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
        const topZ = topVisibleModalZIndex(this.element);
        this.element.style.display = 'block';
        this.element.style.zIndex = String(topZ + 1);
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
        this.element.style.zIndex = '';

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
