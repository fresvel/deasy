// @vitest-environment jsdom
// (el entorno por defecto de este repo es `node`; montar un componente necesita DOM)

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import AppAlert from './AppAlert.vue';

/* OJO CON LO QUE SE AFIRMA AQUI. Dos tests de este repo se rompieron el 2026-08-13 con el
   comportamiento INTACTO por afirmar sobre el nombre de la paleta (`toContain('slate')`). Un test
   acoplado al valor no protege la regla: protege la implementacion, y estorba justo cuando hace
   falta cambiarla. Asi que aqui se comprueba el CONTRATO —que la variante llega a la clase, que el
   contenido se pinta, que hay `role="alert"`— y NO de que color acaba siendo. El color es CSS
   derivado con `color-mix()`, y eso se verifica en el navegador, no con jsdom: `getComputedStyle`
   en jsdom no resuelve `color-mix()` ni las capas. */
describe('AppAlert', () => {
  it('por defecto es la variante de error, que es el 100 % de los usos que sustituye', () => {
    const wrapper = mount(AppAlert);
    expect(wrapper.classes()).toContain('deasy-alert');
    expect(wrapper.classes()).toContain('deasy-alert--danger');
  });

  it('lleva la variante a la clase modificadora', () => {
    for (const variant of ['danger', 'warning', 'success', 'info']) {
      expect(mount(AppAlert, { props: { variant } }).classes()).toContain(`deasy-alert--${variant}`);
    }
  });

  it('anuncia el mensaje a los lectores de pantalla', () => {
    /* Las 15 copias a mano que sustituye NO tenian `role`: el mensaje de error aparecia y un
       lector de pantalla no lo anunciaba. Es lo que gana el usuario al extraer el componente. */
    expect(mount(AppAlert).attributes('role')).toBe('alert');
  });

  it('pinta el contenido del slot', () => {
    const wrapper = mount(AppAlert, { slots: { default: 'No se pudo guardar' } });
    expect(wrapper.text()).toBe('No se pudo guardar');
  });

  it('rechaza una variante que no existe, en vez de emitir una clase muerta', () => {
    /* Es el fallo de `workspaceNavIcons`: componia `${prefix}--${tone}` sin validar y un tono
       inexistente salia transparente, en silencio. Aqui el validador de la prop avisa. */
    const { validator } = AppAlert.props.variant;
    expect(validator('danger')).toBe(true);
    expect(validator('inventada')).toBe(false);
  });
});
