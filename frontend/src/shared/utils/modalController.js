const modalRegistry = new WeakMap();

// Apilamiento de modales: al mostrar un modal se coloca por encima del modal visible más alto
// (sea con z-index estático inline o dinámico), de modo que un modal anidado siempre quede encima
// y accesible. Se calcula sobre los modales realmente visibles, así no importa el esquema previo.
const MODAL_BASE_Z = 1060;
const topVisibleModalZIndex = (exclude) => {
    if (typeof document === 'undefined') return MODAL_BASE_Z;
    let max = MODAL_BASE_Z;
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
