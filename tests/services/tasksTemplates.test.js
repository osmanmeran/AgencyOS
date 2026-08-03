import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, uid } from '../../server/db.js';
import {
  generateTasksForBooking,
  rescheduleTasksForBooking,
  DEFAULT_TASK_TEMPLATES,
} from '../../server/services/tasks.js';

const db = getDb();

function insertTrip(data, { createdDate } = {}) {
  const id = uid();
  const now = createdDate || new Date().toISOString();
  db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
    id,
    'Trip',
    JSON.stringify(data),
    now,
    now,
  );
  return id;
}

function updateTrip(id, patch) {
  const row = db.prepare('SELECT data FROM entities WHERE id = ?').get(id);
  const data = { ...JSON.parse(row.data), ...patch };
  db.prepare('UPDATE entities SET data = ? WHERE id = ?').run(JSON.stringify(data), id);
}

function tasksForBooking(bookingId) {
  return db
    .prepare("SELECT id, data FROM entities WHERE type = 'Task' AND json_extract(data, '$.booking_id') = ?")
    .all(bookingId)
    .map((r) => ({ id: r.id, ...JSON.parse(r.data) }));
}

function setAppSettings(patch) {
  db.prepare("DELETE FROM entities WHERE type = 'AppSettings'").run();
  const id = uid();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
    id,
    'AppSettings',
    JSON.stringify(patch),
    now,
    now,
  );
}

function daysFromNowYmd(n) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Mirrors tasks.js's addDaysYMD: add `deltaDays` to a `YYYY-MM-DD` string. */
function addDaysYmd(ymd, deltaDays) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

describe('Task template engine', () => {
  beforeEach(() => {
    db.prepare(`DELETE FROM entities WHERE type IN ('Trip', 'Task', 'AppSettings')`).run();
  });

  it('generates a task for every default template on a trip with start_date, end_date, and created_date', () => {
    const createdDate = new Date().toISOString();
    const tripId = insertTrip(
      {
        name: 'Full Template Trip',
        client_name: 'Jane Doe',
        destination: 'Kenya',
        start_date: daysFromNowYmd(60),
        end_date: daysFromNowYmd(67),
      },
      { createdDate },
    );

    const created = generateTasksForBooking(tripId, { id: 'agent-1' });

    expect(created).toHaveLength(DEFAULT_TASK_TEMPLATES.length);
    const keys = created.map((t) => t.template_key).sort();
    expect(keys).toEqual(DEFAULT_TASK_TEMPLATES.map((t) => t.template_key).sort());

    const followUp = created.find((t) => t.template_key === 'post_trip_followup');
    expect(followUp.due_date).toBe(daysFromNowYmd(69)); // end_date + 2
    expect(followUp.description).toContain('Jane Doe');
    expect(followUp.description).toContain('Kenya');

    const deposit = created.find((t) => t.template_key === 'collect_deposit');
    expect(deposit.due_date).toBe(addDaysYmd(createdDate.slice(0, 10), 3)); // created_date + 3
    expect(deposit.priority).toBe('high');
  });

  it('skips end_date-anchored templates when the trip has no end_date yet, without failing the rest', () => {
    const tripId = insertTrip({
      name: 'No End Date Trip',
      client_name: 'Sam',
      start_date: daysFromNowYmd(60),
    });

    const created = generateTasksForBooking(tripId, { id: 'agent-1' });

    expect(created.some((t) => t.template_key === 'post_trip_followup')).toBe(false);
    expect(created.some((t) => t.template_key === 'collect_final_balance')).toBe(true);
  });

  it('is idempotent — calling generateTasksForBooking twice does not duplicate tasks', () => {
    const tripId = insertTrip({
      name: 'Idempotent Trip',
      client_name: 'Sam',
      start_date: daysFromNowYmd(60),
      end_date: daysFromNowYmd(65),
    });

    generateTasksForBooking(tripId, { id: 'agent-1' });
    generateTasksForBooking(tripId, { id: 'agent-1' });

    expect(tasksForBooking(tripId)).toHaveLength(DEFAULT_TASK_TEMPLATES.length);
  });

  it('filters templates by department: a department-scoped template only applies to matching trips', () => {
    setAppSettings({
      task_templates: [
        {
          template_key: 'luxury_concierge_intro',
          title: 'Introduce Concierge',
          anchor: 'start_date',
          offsetDays: -10,
          priority: 'medium',
          department: 'Luxury',
          description: 'Introduce the dedicated concierge to {client_name}.',
        },
        {
          template_key: 'general_task',
          title: 'General Task',
          anchor: 'start_date',
          offsetDays: -5,
          priority: 'low',
          department: '',
          description: 'Applies to every department.',
        },
      ],
    });

    const luxuryTrip = insertTrip({
      name: 'Luxury Trip',
      client_name: 'VIP',
      department: 'Luxury',
      start_date: daysFromNowYmd(30),
    });
    const adventureTrip = insertTrip({
      name: 'Adventure Trip',
      client_name: 'Backpacker',
      department: 'Adventure',
      start_date: daysFromNowYmd(30),
    });

    const luxuryTasks = generateTasksForBooking(luxuryTrip, { id: 'agent-1' });
    const adventureTasks = generateTasksForBooking(adventureTrip, { id: 'agent-1' });

    expect(luxuryTasks.map((t) => t.template_key).sort()).toEqual(['general_task', 'luxury_concierge_intro']);
    expect(adventureTasks.map((t) => t.template_key)).toEqual(['general_task']);
  });

  it('a configured AppSettings.task_templates list fully replaces the defaults, not merges with them', () => {
    setAppSettings({
      task_templates: [
        {
          template_key: 'only_this_one',
          title: 'Only This One',
          anchor: 'start_date',
          offsetDays: -1,
          priority: 'low',
          department: '',
          description: 'Just one custom template.',
        },
      ],
    });

    const tripId = insertTrip({
      name: 'Custom Only Trip',
      client_name: 'Sam',
      start_date: daysFromNowYmd(30),
      end_date: daysFromNowYmd(35),
    });

    const created = generateTasksForBooking(tripId, { id: 'agent-1' });

    expect(created).toHaveLength(1);
    expect(created[0].template_key).toBe('only_this_one');
  });

  it('resyncs an end_date-anchored task when the trip end_date changes', () => {
    const tripId = insertTrip({
      name: 'Reschedule Trip',
      client_name: 'Sam',
      start_date: daysFromNowYmd(30),
      end_date: daysFromNowYmd(35),
    });
    generateTasksForBooking(tripId, { id: 'agent-1' });

    updateTrip(tripId, { end_date: daysFromNowYmd(40) });
    const { rescheduled } = rescheduleTasksForBooking(tripId);

    expect(rescheduled).toBe(DEFAULT_TASK_TEMPLATES.length);
    const followUp = tasksForBooking(tripId).find((t) => t.template_key === 'post_trip_followup');
    expect(followUp.due_date).toBe(daysFromNowYmd(42)); // new end_date + 2
  });

  it('leaves manual tasks (no template_key) untouched on reschedule', () => {
    const tripId = insertTrip({
      name: 'Manual Task Trip',
      client_name: 'Sam',
      start_date: daysFromNowYmd(30),
    });
    generateTasksForBooking(tripId, { id: 'agent-1' });

    const manualId = uid();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
      manualId,
      'Task',
      JSON.stringify({ title: 'Manual', status: 'pending', booking_id: tripId, due_date: '2030-01-01' }),
      now,
      now,
    );

    updateTrip(tripId, { start_date: daysFromNowYmd(90) });
    rescheduleTasksForBooking(tripId);

    const manual = tasksForBooking(tripId).find((t) => t.id === manualId);
    expect(manual.due_date).toBe('2030-01-01');
  });
});
