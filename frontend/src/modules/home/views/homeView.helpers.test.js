// Tests de los helpers puros extraidos de HomeView.vue (Fase A del refactor).
//
// HomeView.vue no tenia NINGUN test (era un God Object de 7445 L). Estas funciones deciden
// la ETIQUETA, el COLOR y el ESTADO que ve el usuario en cada paso de entrega y firma: si una
// rama se rompe, el usuario ve mal el estado de su documento. Aisladas, se prueban sin montar
// el componente.

import { describe, test, expect } from 'vitest';

import {
  formatAttachmentSize,
  formatDate,
  formatDateTime,
  formatWorkflowDateTime,
  getSignatureStepStatusCode,
  getSignatureStepStatusLabel,
  getSignatureStepStatusVariant,
  formatTriggerLabel,
  getFillStepStatusLabel,
  getFillStepStatusTagVariant,
  getFillStepCardClass,
  getFillStepAccentClass,
  getWorkflowStateTagVariant,
  getDeliverableAccessTagVariant,
  getFillRequestStatusCode,
  isCompletedSignatureRequestStatus,
  mapSigner,
  getFillStepResolverLabel,
  getSignatureStepResolverLabel,
} from './homeView.helpers.js';

describe('formatAttachmentSize', () => {
  test('cadena vacia para 0 o falsy', () => {
    expect(formatAttachmentSize(0)).toBe('');
    expect(formatAttachmentSize(null)).toBe('');
    expect(formatAttachmentSize(undefined)).toBe('');
  });
  test('escala B / KB / MB', () => {
    expect(formatAttachmentSize(512)).toBe('512 B');
    expect(formatAttachmentSize(2048)).toBe('2.0 KB');
    expect(formatAttachmentSize(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatAttachmentSize(1023)).toBe('1023 B'); // justo por debajo del umbral KB
  });
});

describe('formatDate', () => {
  test('em dash para valor vacio', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('')).toBe('—');
  });
  test('formatea una fecha ISO a es-EC (mes abreviado)', () => {
    // Toma solo los 10 primeros chars, asi que la hora no altera el dia.
    expect(formatDate('2026-03-15T23:59:00Z')).toMatch(/2026/);
    expect(formatDate('2026-03-15')).toMatch(/mar/i);
  });
  test('devuelve la cadena normalizada si no es fecha valida', () => {
    expect(formatDate('no-es-fecha')).toBe('no-es-fech'); // slice(0,10)
  });
});

describe('formatDateTime / formatWorkflowDateTime', () => {
  test('placeholders ante valor vacio', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatWorkflowDateTime(null)).toBe(''); // este usa cadena vacia, no em dash
  });
  test('valor invalido: formatDateTime devuelve el original, workflow devuelve vacio', () => {
    expect(formatDateTime('xxx')).toBe('xxx');
    expect(formatWorkflowDateTime('xxx')).toBe('');
  });
  test('fecha valida produce texto con el anio', () => {
    expect(formatDateTime('2026-07-14T15:30:00Z')).toMatch(/2026/);
    expect(formatWorkflowDateTime('2026-07-14T15:30:00Z')).toMatch(/2026/);
  });
});

describe('getSignatureStepStatusCode', () => {
  const step = { step_order: 2 };
  test('sin solicitudes relacionadas -> unresolved', () => {
    expect(getSignatureStepStatusCode(step, [])).toBe('unresolved');
    expect(getSignatureStepStatusCode(step, [{ stepOrder: 9, requestStatusCode: 'completado' }])).toBe('unresolved');
  });
  test('rechazado o cancelado -> rejected (tiene prioridad)', () => {
    expect(getSignatureStepStatusCode(step, [{ stepOrder: 2, requestStatusCode: 'rechazado' }])).toBe('rejected');
    expect(getSignatureStepStatusCode(step, [
      { stepOrder: 2, requestStatusCode: 'completado' },
      { stepOrder: 2, requestStatusCode: 'cancelado' },
    ])).toBe('rejected');
  });
  test('todas completadas -> completed', () => {
    expect(getSignatureStepStatusCode(step, [
      { stepOrder: 2, requestStatusCode: 'completado' },
      { stepOrder: 2, requestStatusCode: 'completado' },
    ])).toBe('completed');
  });
  test('el paso actual -> current', () => {
    expect(getSignatureStepStatusCode(step, [{ stepOrder: 2, requestStatusCode: 'pendiente' }], 2)).toBe('current');
  });
  test('en_progreso -> current aunque no sea el paso marcado como actual', () => {
    expect(getSignatureStepStatusCode(step, [{ stepOrder: 2, requestStatusCode: 'en_progreso' }])).toBe('current');
  });
  test('resto -> pending', () => {
    expect(getSignatureStepStatusCode(step, [{ stepOrder: 2, requestStatusCode: 'pendiente' }])).toBe('pending');
  });
});

describe('getSignatureStepStatusLabel / Variant', () => {
  test('mapa de etiquetas', () => {
    expect(getSignatureStepStatusLabel('completed')).toBe('Firmado');
    expect(getSignatureStepStatusLabel('current')).toBe('En curso');
    expect(getSignatureStepStatusLabel('rejected')).toBe('Rechazado');
    expect(getSignatureStepStatusLabel('unresolved')).toBe('Sin responsables');
    expect(getSignatureStepStatusLabel('loquesea')).toBe('Pendiente'); // default
  });
  test('mapa de variantes', () => {
    expect(getSignatureStepStatusVariant('completed')).toBe('success');
    expect(getSignatureStepStatusVariant('current')).toBe('info');
    expect(getSignatureStepStatusVariant('rejected')).toBe('danger');
    expect(getSignatureStepStatusVariant('pending')).toBe('salmon');
    expect(getSignatureStepStatusVariant('unresolved')).toBe('salmon');
    expect(getSignatureStepStatusVariant('otro')).toBe('neutral');
  });
});

/* Antes probaba `getSignatureStepCardClass`/`AccentClass`, que murieron en L6: eran una segunda
   traduccion del mismo codigo de estado, esta vez a cadenas de Tailwind. Lo que las pruebas
   afirmaban de verdad —que el estado y el turno cambian lo que se pinta— sigue siendo cierto y
   sigue probandose, pero sobre la pieza que queda: el CODIGO. Es mejor sitio, porque no depende
   de que el CSS se llame de una forma u otra. */
describe('getSignatureStepStatusCode (el estado y el turno mandan)', () => {
  const paso = { step_order: 1 };
  const conEstado = (code) => [{ stepOrder: 1, requestStatusCode: code }];

  test('estados distintos dan codigos distintos', () => {
    expect(getSignatureStepStatusCode(paso, conEstado('completado')))
      .not.toBe(getSignatureStepStatusCode(paso, conEstado('pendiente')));
  });

  test('ser el paso ACTUAL cambia el codigo aunque el estado sea el mismo', () => {
    expect(getSignatureStepStatusCode(paso, conEstado('pendiente'), 1))
      .not.toBe(getSignatureStepStatusCode(paso, conEstado('pendiente')));
  });

  test('todo codigo tiene tono, y el tono es una variante viva de AppTag', () => {
    /* Cierra el agujero que dejo L1: `muted` se quedo aqui despues de morir en `tags.css`, y
       ningun gate podia verlo porque `:variant` se compone en tiempo de ejecucion. */
    const vivas = ['success', 'warning', 'danger', 'info', 'salmon', 'accent', 'primary', 'neutral'];
    for (const code of ['completed', 'current', 'rejected', 'pending', 'unresolved', 'loquesea']) {
      expect(vivas).toContain(getSignatureStepStatusVariant(code));
    }
  });
});

describe('formatTriggerLabel', () => {
  test('placeholder sin periodo', () => {
    expect(formatTriggerLabel(null)).toBe('Periodo');
  });
  test('prefiere el nombre, cae al codigo, y al generico', () => {
    expect(formatTriggerLabel({ term_type_name: 'Semestre', term_type_code: 'SEM' })).toBe('Semestre');
    expect(formatTriggerLabel({ term_type_code: 'SEM' })).toBe('SEM');
    expect(formatTriggerLabel({})).toBe('Tipo de periodo');
  });
});

describe('mapSigner', () => {
  test('cargo con unidad -> unit_exact', () => {
    expect(mapSigner({ kind: 'cargo', cargo_id: 3, unit_id: 8 }))
      .toEqual({ cargo_id: 3, unit_id: 8, unit_scope_type: 'unit_exact' });
  });
  test('cargo sin unidad -> all_units', () => {
    expect(mapSigner({ kind: 'cargo', cargo_id: 3 }))
      .toEqual({ cargo_id: 3, unit_id: null, unit_scope_type: 'all_units' });
  });
  test('persona concreta -> person_id', () => {
    expect(mapSigner({ kind: 'person', person_id: 7 })).toEqual({ person_id: 7 });
  });
});

describe('getFillRequestStatusCode', () => {
  test('normaliza desde cualquiera de los alias de estado', () => {
    expect(getFillRequestStatusCode({ status_name: 'In_Progress' })).toBe('in_progress');
    expect(getFillRequestStatusCode({ requestStatus: ' APPROVED ' })).toBe('approved');
    expect(getFillRequestStatusCode({})).toBe('');
  });
});

describe('isCompletedSignatureRequestStatus', () => {
  test('reconoce completado / completed en cualquier caja', () => {
    expect(isCompletedSignatureRequestStatus('Completado')).toBe(true);
    expect(isCompletedSignatureRequestStatus('completed')).toBe(true);
    expect(isCompletedSignatureRequestStatus('pendiente')).toBe(false);
  });
});

describe('getWorkflowStateTagVariant', () => {
  test('agrupa estados por familia de color', () => {
    expect(getWorkflowStateTagVariant('firmado')).toBe('success');
    expect(getWorkflowStateTagVariant('listo para firma')).toBe('info');
    expect(getWorkflowStateTagVariant('devuelto')).toBe('warning');
    expect(getWorkflowStateTagVariant('rechazado')).toBe('danger');
  });
  test('usa el fallback ante vacio o desconocido', () => {
    expect(getWorkflowStateTagVariant('')).toBe('neutral');
    expect(getWorkflowStateTagVariant('loquesea')).toBe('neutral');
    expect(getWorkflowStateTagVariant('', 'accent')).toBe('accent');
  });
});

describe('getDeliverableAccessTagVariant', () => {
  test('directo/derivado/otro', () => {
    expect(getDeliverableAccessTagVariant('Directo')).toBe('success');
    expect(getDeliverableAccessTagVariant('derivado')).toBe('accent');
    expect(getDeliverableAccessTagVariant('otro')).toBe('neutral');
  });
});

describe('getFillStepStatusLabel / TagVariant', () => {
  test('etiquetas del paso de llenado', () => {
    expect(getFillStepStatusLabel('approved')).toBe('Aprobado');
    expect(getFillStepStatusLabel('in_progress')).toBe('En progreso');
    expect(getFillStepStatusLabel('returned')).toBe('Devuelto');
    expect(getFillStepStatusLabel('cualquiera')).toBe('Pendiente');
  });
  test('variantes del paso de llenado', () => {
    expect(getFillStepStatusTagVariant('approved')).toBe('success');
    expect(getFillStepStatusTagVariant('in_progress')).toBe('info');
    expect(getFillStepStatusTagVariant('returned')).toBe('warning');
    expect(getFillStepStatusTagVariant('rejected')).toBe('danger');
    expect(getFillStepStatusTagVariant('otro')).toBe('neutral');
  });
});

/* Estas pruebas afirmaban sobre el NOMBRE DE LA PALETA (`toContain('slate')`), asi que una
   migracion de color las rompio aunque el comportamiento fuera identico. Un test acoplado al valor
   no protege la regla: protege la implementacion, y estorba justo cuando hace falta cambiarla.
   Reescritas el 2026-08-13 para afirmar lo que sus propios nombres dicen —que el turno manda sobre
   el estado, y que cada estado se distingue del resto—, que sobrevive a repintar la aplicacion. */
describe('getFillStepCardClass / AccentClass', () => {
  const card = (estado, actual) => getFillStepCardClass({ step_order: 2, request_status: estado }, actual);
  const accent = (estado, actual) => getFillStepAccentClass({ step_order: 2, request_status: estado }, actual);

  test('el paso ACTUAL manda sobre el estado', () => {
    /* Mismo estado, distinto turno: si el turno no mandara, las dos saldrian iguales. */
    expect(card('approved', 2)).not.toBe(card('approved', 1));
    expect(accent('approved', 2)).not.toBe(accent('approved', 1));
  });

  test('si no es el actual, cada estado se distingue de los demas', () => {
    const clases = ['approved', 'rejected', 'returned', 'pendiente'].map((e) => card(e, 1));
    expect(new Set(clases).size).toBe(clases.length);
  });

  test('un estado desconocido cae en el neutro, no en el de otro estado', () => {
    expect(card('lo-que-sea', 1)).toBe(card('pendiente', 1));
    expect(card('lo-que-sea', 1)).toContain('border-line');
  });
});

describe('getFillStepResolverLabel / getSignatureStepResolverLabel', () => {
  test('une resolver y modo con separador', () => {
    expect(getFillStepResolverLabel({ resolver_type: 'task_assignee', selection_mode: 'auto_one' }))
      .toBe('task_assignee · auto_one');
    expect(getFillStepResolverLabel({})).toBe('');
  });
  test('firma: fallback a cargo_in_scope cuando no hay datos', () => {
    expect(getSignatureStepResolverLabel({ resolverType: 'cargo_in_scope', selectionMode: 'auto_all' }))
      .toBe('cargo_in_scope · auto_all');
    expect(getSignatureStepResolverLabel({})).toBe('cargo_in_scope');
  });
});
