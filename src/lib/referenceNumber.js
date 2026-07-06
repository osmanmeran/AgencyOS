import { db } from '@/lib/DbContext';

/**
 * Generates the next sequential reference number for a department (e.g.
 * `TRP-SAL-2607-0001`), atomically bumping (or creating) the per-department
 * monthly counter in `ReferenceCounter`.
 * @returns {Promise<string>}
 */
export async function generateReferenceNumber(department, settings) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const prefix = settings?.reference_format?.prefix || 'TRP';
  const deptCode = department ? department.slice(0, 3).toUpperCase() : 'GEN';
  const counters = await db.entities.ReferenceCounter.filter({ department: department || 'general', year, month });
  let counter = 1;
  if (counters.length > 0) {
    counter = (counters[0].counter || 0) + 1;
    await db.entities.ReferenceCounter.update(counters[0].id, { ...counters[0], counter });
  } else {
    await db.entities.ReferenceCounter.create({ department: department || 'general', year, month, counter: 1 });
  }
  return `${prefix}-${deptCode}-${String(year).slice(-2)}${String(month).padStart(2, '0')}-${String(counter).padStart(4, '0')}`;
}
