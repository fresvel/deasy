const modalRegistry = new WeakMap();

class ModalController {
    constructor(element) {
        this.element = element;
        this.backdrop = null;
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
        this.element.removeAttribute('aria-hidden');
        this.element.setAttribute('aria-modal', 'true');
        this.element.setAttribute('role', 'dialog');

        requestAnimationFrame(() => {
            this.element.classList.add('show');
            this.dispatchLifecycleEvent('shown.bs.modal');
        });

        if (!this.backdrop) {
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop fade show';
            backdrop.dataset.modalBackdrop = 'true';
            backdrop.addEventListener('click', () => this.hide());
            document.body.appendChild(backdrop);
            this.backdrop = backdrop;
        }

        document.body.classList.add('modal-open');
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

        if (this.backdrop) {
            this.backdrop.remove();
            this.backdrop = null;
        }

        document.removeEventListener('keydown', this.boundOnKeydown);

        if (!document.querySelector('.modal.show')) {
            document.body.classList.remove('modal-open');
        }

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
