import { describe, expect, it } from 'vitest';

import {
  resolveWorkspaceAdminGroupIcon,
  resolveWorkspaceAreaIcon,
  workspaceIconToneClass,
} from './workspaceNavIcons';

/* Esta funcion componia `${prefix}--${tone}` a ciegas contra un CSS que declaraba doce variantes
   con el MISMO cuerpo. Dos consecuencias, las dos reales:
   - once de las doce clases eran ruido;
   - un tono no declarado salia con fondo transparente y no lo veia nadie — le paso a `indigo`,
     que dejo «Mis envios» sin color con el build, el lint y los 304 tests en verde.
   Desde el 2026-08-13 el aspecto normal es el por defecto de la clase base y solo `slate` tiene
   clase propia. Estos casos son justamente los que ninguna otra puerta ve. */
describe('workspaceIconToneClass', () => {
  it('emite la clase del unico tono que existe en el CSS', () => {
    expect(workspaceIconToneClass('slate')).toBe('deasy-nav-item__icon--slate');
  });

  it('respeta el prefijo del glifo', () => {
    expect(workspaceIconToneClass('slate', 'deasy-nav-glyph')).toBe('deasy-nav-glyph--slate');
  });

  it('NO emite clase para un tono sin declarar, para que caiga al aspecto por defecto', () => {
    for (const tone of ['sky', 'amber', 'emerald', 'indigo', 'violet', 'inventado']) {
      expect(workspaceIconToneClass(tone)).toBe('');
    }
  });

  it('no emite clase sin argumentos', () => {
    expect(workspaceIconToneClass()).toBe('');
  });
});

describe('resolvedores de icono', () => {
  it('solo producen tonos que la hoja sepa pintar', () => {
    const tonos = [
      resolveWorkspaceAreaIcon('Academico').tone,
      resolveWorkspaceAreaIcon('cualquier otra cosa').tone,
      resolveWorkspaceAdminGroupIcon('seguridad').tone,
      resolveWorkspaceAdminGroupIcon('procesos').tone,
    ];
    for (const tone of tonos) {
      expect(['sky', 'slate']).toContain(tone);
    }
  });
});
