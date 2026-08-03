import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { catchAsync } from '../middleware/errors.js';
import { BadRequestError } from '../middleware/errors.js';
import { createEntity, findEntityById } from '../services/entities.js';
import { listTasks, completeTask, DEFAULT_TASK_TEMPLATES } from '../services/tasks.js';
import { broadcast } from '../lib/ws.js';
import { getTenantId } from '../db.js';

const router = Router();

router.use(authMiddleware);

// POST /api/tasks — create a manual (or any) task. Delegates to the generic
// entity writer so permissions (create_trips) + created_by stamping apply.
router.post(
  '/',
  catchAsync(async (req, res) => {
    if (!req.body || !req.body.title || !String(req.body.title).trim()) {
      throw new BadRequestError('Task title is required');
    }
    const result = createEntity('Task', req.body, req.user);
    broadcast(
      { type: 'entity_change', action: 'create', entityType: 'Task', entityId: result.id },
      { excludeUserId: req.user.id, tenantId: getTenantId() },
    );
    res.status(201).json(result);
  }),
);

// GET /api/tasks — contextual list with FK + SLA filters.
//   ?booking_id=   ?customer_id=   ?supplier_id=   ?assigned_to_user_id=
//   ?status=       ?priority=       ?overdue=1      ?escalated=1
//   ?sort=         ?limit=          ?offset=
router.get(
  '/',
  catchAsync(async (req, res) => {
    const result = listTasks({
      booking_id: req.query.booking_id,
      customer_id: req.query.customer_id,
      supplier_id: req.query.supplier_id,
      assigned_to_user_id: req.query.assigned_to_user_id,
      status: req.query.status,
      priority: req.query.priority,
      overdue: req.query.overdue === '1' || req.query.overdue === 'true',
      escalated: req.query.escalated === '1' || req.query.escalated === 'true',
      sort: req.query.sort,
      limit: req.query.limit !== undefined ? Number(req.query.limit) : undefined,
      offset: req.query.offset !== undefined ? Number(req.query.offset) : undefined,
      user: req.user,
    });
    res.json(result);
  }),
);

// GET /api/tasks/default-templates — the built-in template set, for Settings >
// Task Templates to pre-populate its editor before an admin has customized
// AppSettings.task_templates. Must be registered before GET /:id.
router.get('/default-templates', (req, res) => {
  res.json(DEFAULT_TASK_TEMPLATES);
});

// PUT /api/tasks/:id/complete — mark complete + audit the action.
router.put(
  '/:id/complete',
  catchAsync(async (req, res) => {
    const updated = completeTask(req.params.id, req.user, req.body?.note);
    broadcast(
      { type: 'entity_change', action: 'update', entityType: 'Task', entityId: req.params.id },
      { excludeUserId: req.user.id, tenantId: getTenantId() },
    );
    res.json(updated);
  }),
);

// Lightweight fetch of a single task (mirrors generic entity GET).
router.get(
  '/:id',
  catchAsync(async (req, res) => {
    const data = findEntityById('Task', req.params.id, req.user);
    res.json(data);
  }),
);

export default router;
