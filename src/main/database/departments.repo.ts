import { getDb } from './connection'
import { DEPARTMENT_NAME_MAX_LENGTH } from '../../shared/constants'
import type { Department, CreateDepartmentInput, UpdateDepartmentInput } from '../../shared/types'

export function getDepartments(): Department[] {
  return getDb().prepare('SELECT id, name FROM departments ORDER BY name').all() as Department[]
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

  const result = db.prepare('INSERT INTO departments (name) VALUES (?)').run(name)
  return { id: Number(result.lastInsertRowid), name }
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

  db.prepare('UPDATE departments SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    name,
    input.id
  )

  // Update products that reference the old department name
  db.prepare('UPDATE products SET dept_id = ? WHERE dept_id = ?').run(name, current.name)

  return { id: input.id, name }
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
