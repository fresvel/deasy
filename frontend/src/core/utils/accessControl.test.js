// Tests del control de acceso del frontend.
//
// accessControl.js es el ESPEJO de backend/services/auth/RbacService.js: decide qué se
// muestra en la UI con la misma lógica core (`res.action || res.manage`) que el backend
// usa para decidir qué se permite. Estos tests fijan ese contrato en el frontend; si
// deriva del backend, fallan aquí y no allá (o viceversa), haciendo visible la divergencia.
//
// Todas las funciones aceptan `user` por parámetro, así que se prueban sin localStorage.

import { describe, test, expect } from 'vitest'

import {
  getUserRoles,
  getUserPermissions,
  hasAnyRole,
  hasPermission,
  canAccessResource,
  canReadResource,
  canWriteResource,
  isTraceabilityTable,
  resolveAdminTableResource,
  canReadAdminTable,
  canCreateAdminTable,
  isAdminUser,
} from '@/core/utils/accessControl.js'

// --- getUserRoles: fusiona tres fuentes y deduplica -------------------------

describe('getUserRoles', () => {
  test('funde access.roleNames, roles y el role legacy, sin duplicados', () => {
    const user = {
      access: { roleNames: ['Usuario', 'GestorProcesos'] },
      roles: ['GestorProcesos', 'GestorFirmas'],
      role: 'Usuario',
    }
    expect(getUserRoles(user).sort()).toEqual(['GestorFirmas', 'GestorProcesos', 'Usuario'])
  })

  test('devuelve [] para un usuario sin roles', () => {
    expect(getUserRoles({})).toEqual([])
    expect(getUserRoles(null)).toEqual([])
  })
})

describe('getUserPermissions', () => {
  test('funde access.permissions y permissions, sin duplicados', () => {
    const user = {
      access: { permissions: ['users.read'] },
      permissions: ['users.read', 'documents.update'],
    }
    expect(getUserPermissions(user).sort()).toEqual(['documents.update', 'users.read'])
  })
})

// --- hasPermission: espejo del backend --------------------------------------

describe('hasPermission', () => {
  test('concede todo a un usuario con rol AdminSistema', () => {
    const admin = { access: { roleNames: ['AdminSistema'], permissions: [] } }
    expect(hasPermission('cualquier.cosa', admin)).toBe(true)
  })

  test('exige que el permiso esté en la lista para un no-admin', () => {
    const user = { access: { roleNames: ['Usuario'], permissions: ['units.read'] } }
    expect(hasPermission('units.read', user)).toBe(true)
    expect(hasPermission('units.delete', user)).toBe(false)
  })

  test('rechaza un código de permiso vacío', () => {
    const admin = { access: { roleNames: ['AdminSistema'] } }
    expect(hasPermission('', admin)).toBe(false)
  })
})

// --- can*Resource: la lógica core espejada con el backend -------------------

describe('canAccessResource', () => {
  test('concede con el permiso exacto de la acción', () => {
    const user = { permissions: ['units.create'] }
    expect(canAccessResource('units', 'create', user)).toBe(true)
  })

  test('concede con el comodín .manage del recurso', () => {
    const user = { permissions: ['units.manage'] }
    expect(canAccessResource('units', 'create', user)).toBe(true)
    expect(canAccessResource('units', 'delete', user)).toBe(true)
  })

  test('rechaza sin permiso exacto ni .manage', () => {
    const user = { permissions: ['units.read'] }
    expect(canAccessResource('units', 'create', user)).toBe(false)
  })

  test('rechaza recurso o acción vacíos', () => {
    const user = { permissions: ['units.manage'] }
    expect(canAccessResource('', 'create', user)).toBe(false)
    expect(canAccessResource('units', '', user)).toBe(false)
  })
})

describe('canReadResource / canWriteResource', () => {
  test('canReadResource usa la acción read', () => {
    expect(canReadResource('units', { permissions: ['units.read'] })).toBe(true)
    expect(canReadResource('units', { permissions: ['units.create'] })).toBe(false)
  })

  test('canWriteResource acepta create, update, delete o manage', () => {
    expect(canWriteResource('units', { permissions: ['units.update'] })).toBe(true)
    expect(canWriteResource('units', { permissions: ['units.manage'] })).toBe(true)
    // read no es escritura.
    expect(canWriteResource('units', { permissions: ['units.read'] })).toBe(false)
  })
})

// --- hasAnyRole -------------------------------------------------------------

describe('hasAnyRole', () => {
  test('detecta la intersección de roles', () => {
    const user = { access: { roleNames: ['Usuario', 'GestorProcesos'] } }
    expect(hasAnyRole(['GestorProcesos'], user)).toBe(true)
    expect(hasAnyRole(['AdminSistema'], user)).toBe(false)
  })
})

// --- Mapa de tablas admin -> recurso ----------------------------------------

describe('resolveAdminTableResource', () => {
  test('mapea tablas conocidas a su recurso', () => {
    expect(resolveAdminTableResource('cargos')).toBe('people')
    expect(resolveAdminTableResource('roles')).toBe('security')
    expect(resolveAdminTableResource('template_artifacts')).toBe('templates')
    expect(resolveAdminTableResource('units')).toBe('units')
  })

  test('cae al recurso por defecto para una tabla desconocida', () => {
    expect(resolveAdminTableResource('tabla_inventada')).toBe('process_definitions')
    expect(resolveAdminTableResource('')).toBe('process_definitions')
  })
})

describe('isTraceabilityTable', () => {
  test('reconoce las tablas de trazabilidad', () => {
    expect(isTraceabilityTable('fill_requests')).toBe(true)
    expect(isTraceabilityTable('task_items')).toBe(true)
    expect(isTraceabilityTable('cargos')).toBe(false)
  })
})

describe('canReadAdminTable / canCreateAdminTable', () => {
  test('resuelven el recurso de la tabla y aplican la acción', () => {
    // cargos -> people. Un permiso people.read permite leer, no crear.
    const reader = { permissions: ['people.read'] }
    expect(canReadAdminTable('cargos', reader)).toBe(true)
    expect(canCreateAdminTable('cargos', reader)).toBe(false)

    const manager = { permissions: ['people.manage'] }
    expect(canCreateAdminTable('cargos', manager)).toBe(true)
  })
})

describe('isAdminUser', () => {
  test('es true solo con el rol AdminSistema', () => {
    expect(isAdminUser({ access: { roleNames: ['AdminSistema'] } })).toBe(true)
    expect(isAdminUser({ access: { roleNames: ['GestorProcesos'] } })).toBe(false)
  })
})
