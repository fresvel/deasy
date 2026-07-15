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
  getSignatureStepCardClass,
  getSignatureStepAccentClass,
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
    expect(getSignatureStepStatusVariant('otro')).toBe('muted');
  });
});

describe('getSignatureStepCardClass / AccentClass (delegan en el status code)', () => {
  test('un paso completado usa clases emerald; uno actual usa sky/verde', () => {
    const completado = [{ stepOrder: 1, requestStatusCode: 'completado' }];
    expect(getSignatureStepCardClass({ step_order: 1 }, completado)).toContain('emerald');
    expect(getSignatureStepAccentClass({ step_order: 1 }, completado)).toContain('emerald');

    const actual = [{ stepOrder: 1, requestStatusCode: 'pendiente' }];
    expect(getSignatureStepCardClass({ step_order: 1 }, actual, 1)).toContain('sky');
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
    expect(getWorkflowStateTagVariant('', 'muted')).toBe('muted');
  });
});

describe('getDeliverableAccessTagVariant', () => {
  test('directo/derivado/otro', () => {
    expect(getDeliverableAccessTagVariant('Directo')).toBe('success');
    expect(getDeliverableAccessTagVariant('derivado')).toBe('accent');
    expect(getDeliverableAccessTagVariant('otro')).toBe('muted');
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

describe('getFillStepCardClass / AccentClass', () => {
  test('el paso ACTUAL manda sobre el estado (clases sky)', () => {
    expect(getFillStepCardClass({ step_order: 2, request_status: 'approved' }, 2)).toContain('sky');
    expect(getFillStepAccentClass({ step_order: 2, request_status: 'approved' }, 2)).toContain('sky');
  });
  test('si no es el actual, colorea por estado', () => {
    expect(getFillStepCardClass({ step_order: 2, request_status: 'approved' }, 1)).toContain('emerald');
    expect(getFillStepCardClass({ step_order: 2, request_status: 'rejected' }, 1)).toContain('rose');
    expect(getFillStepCardClass({ step_order: 2, request_status: 'returned' }, 1)).toContain('amber');
    expect(getFillStepCardClass({ step_order: 2, request_status: 'pendiente' }, 1)).toContain('slate');
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
