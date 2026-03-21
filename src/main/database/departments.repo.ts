import { getDb } from './connection'
import { DEPARTMENT_NAME_MAX_LENGTH } from '../../shared/constants'
import type { Department, CreateDepartmentInput, UpdateDepartmentInput } from '../../shared/types'

export function getDepartments(): Department[] {
  return getDb()
    .prepare(
      'SELECT id, name, description, COALESCE(default_profit_margin, 0) AS default_profit_margin, COALESCE(default_tax_rate, 0) AS default_tax_rate FROM departments ORDER BY name'
    )
    .all() as Department[]
}

export function createDepartment(input: CreateDepartmentInput): Department {
  const db = getDb()
  const name = input.name.trim()

  if (!name) {
    throw new Error('Department name is required')
  }

  if (name.length > DEPARTMENT_NAME_MAX_LENGTH) {
    throw new Error(`Department name must be ${DEPARTMENT_NAME_MAX_LENGTH} characters or less`)
  }

  const existing = db.prepare('SELECT id FROM departments WHERE name = ?').get(name) as
    | { id: number }
    | undefined

  if (existing) {
    throw new Error('Department already exists')
  }

  const result = db
    .prepare(
      'INSERT INTO departments (name, description, default_profit_margin, default_tax_rate) VALUES (?, ?, ?, ?)'
    )
    .run(
      name,
      input.description ?? null,
      input.default_profit_margin ?? 0,
      input.default_tax_rate ?? 0
    )
  return {
    id: Number(result.lastInsertRowid),
    name,
    description: input.description ?? null,
    default_profit_margin: input.default_profit_margin ?? 0,
    default_tax_rate: input.default_tax_rate ?? 0
  }
}

export function updateDepartment(input: UpdateDepartmentInput): Department {
  const db = getDb()
  const name = input.name.trim()

  if (!name) {
    throw new Error('Department name is required')
  }

  if (name.length > DEPARTMENT_NAME_MAX_LENGTH) {
    throw new Error(`Department name must be ${DEPARTMENT_NAME_MAX_LENGTH} characters or less`)
  }

  const duplicate = db
    .prepare('SELECT id FROM departments WHERE name = ? AND id != ?')
    .get(name, input.id) as { id: number } | undefined

  if (duplicate) {
    throw new Error('Department already exists')
  }

  const current = db.prepare('SELECT name FROM departments WHERE id = ?').get(input.id) as
    | { name: string }
    | undefined

  if (!current) {
    throw new Error('Department not found')
  }

  db.prepare(
    'UPDATE departments SET name = ?, description = ?, default_profit_margin = ?, default_tax_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(
    name,
    input.description ?? null,
    input.default_profit_margin ?? 0,
    input.default_tax_rate ?? 0,
    input.id
  )

  // Update products that reference the old department name
  db.prepare('UPDATE products SET dept_id = ? WHERE dept_id = ?').run(name, current.name)

  return {
    id: input.id,
    name,
    description: input.description ?? null,
    default_profit_margin: input.default_profit_margin ?? 0,
    default_tax_rate: input.default_tax_rate ?? 0
  }
}

export function deleteDepartment(id: number): void {
  const db = getDb()

  const dept = db.prepare('SELECT name FROM departments WHERE id = ?').get(id) as
    | { name: string }
    | undefined

  if (!dept) {
    throw new Error('Department not found')
  }

  const productCount = db
    .prepare('SELECT COUNT(*) AS count FROM products WHERE dept_id = ?')
    .get(dept.name) as { count: number }

  if (productCount.count > 0) {
    throw new Error('Cannot delete department that is assigned to products')
  }

  db.prepare('DELETE FROM departments WHERE id = ?').run(id)
}
