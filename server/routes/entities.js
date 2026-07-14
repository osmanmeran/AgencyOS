import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { catchAsync } from '../middleware/errors.js';
import { validate, schemas } from '../middleware/validate.js';
import {
  findEntities,
  findEntityById,
  createEntity,
  updateEntity,
  deleteEntity,
  bulkCreateEntities,
  bulkUpdateEntities,
  bulkDeleteEntities,
} from '../services/entities.js';
import { broadcast } from '../lib/ws.js';
import { generateTasksForBooking, rescheduleTasksForBooking } from '../services/tasks.js';

const router = Router();

router.use(authMiddleware);

router.get(
  '/:type',
  validate(schemas.entityListQuery, 'query'),
  catchAsync(async (req, res) => {
    const results = findEntities(req.params.type, {
      sort: req.query.sort,
      filter: req.query.filter,
      search: req.query.search,
      limit: req.query.limit,
      offset: req.query.offset,
      user: req.user,
    });
    res.json(results);
  }),
);

router.get(
  '/:type/:id',
  catchAsync(async (req, res) => {
    const data = findEntityById(req.params.type, req.params.id, req.user);
    res.json(data);
  }),
);

router.post(
  '/:type',
  validate(schemas.entityData),
  catchAsync(async (req, res) => {
    const result = createEntity(req.params.type, req.body, req.user);
    // Signal only — no entity data — so clients refetch through the normal,
    // permission-checked GET endpoints instead of receiving raw data over the socket.
    broadcast(
      { type: 'entity_change', action: 'create', entityType: req.params.type, entityId: result.id },
      { excludeUserId: req.user.id },
    );
    res.status(201).json(result);
    // Auto-generate the booking's operational tasks (best-effort: never fail
    // the booking request itself). Only for Trips with a departure date.
    if (req.params.type === 'Trip') {
      try {
        generateTasksForBooking(result.id, req.user);
      } catch (err) {
        console.error('[tasks] generateTasksForBooking failed for', result.id, err);
      }
    }
  }),
);

router.post(
  '/:type/bulk-create',
  validate(schemas.bulkCreateEntity),
  catchAsync(async (req, res) => {
    const results = bulkCreateEntities(req.params.type, req.body.records, req.user);
    broadcast(
      { type: 'entity_change', action: 'bulk', entityType: req.params.type, entityIds: results.map((r) => r.id) },
      { excludeUserId: req.user.id },
    );
    res.status(201).json(results);
  }),
);

router.post(
  '/:type/bulk-update',
  validate(schemas.bulkUpdateEntity),
  catchAsync(async (req, res) => {
    const result = bulkUpdateEntities(req.params.type, req.body.ids, req.body.data, req.user);
    broadcast(
      {
        type: 'entity_change',
        action: 'bulk',
        entityType: req.params.type,
        entityIds: result.updated.map((r) => r.id),
      },
      { excludeUserId: req.user.id },
    );
    res.json(result);
  }),
);

router.post(
  '/:type/bulk-delete',
  validate(schemas.bulkDeleteEntity),
  catchAsync(async (req, res) => {
    const result = bulkDeleteEntities(req.params.type, req.body.ids, req.user);
    broadcast(
      { type: 'entity_change', action: 'bulk', entityType: req.params.type, entityIds: result.deleted },
      { excludeUserId: req.user.id },
    );
    res.json(result);
  }),
);

router.put(
  '/:type/:id',
  validate(schemas.entityData),
  catchAsync(async (req, res) => {
    const result = updateEntity(req.params.type, req.params.id, req.body, req.user);
    broadcast(
      { type: 'entity_change', action: 'update', entityType: req.params.type, entityId: req.params.id },
      { excludeUserId: req.user.id },
    );
    res.json(result);
    // If a Trip's departure date changed, resync its auto-generated tasks'
    // due dates (best-effort).
    if (req.params.type === 'Trip' && req.body && 'start_date' in req.body) {
      try {
        rescheduleTasksForBooking(req.params.id);
      } catch (err) {
        console.error('[tasks] rescheduleTasksForBooking failed for', req.params.id, err);
      }
    }
  }),
);

router.delete(
  '/:type/:id',
  catchAsync(async (req, res) => {
    const result = deleteEntity(req.params.type, req.params.id, req.user);
    broadcast(
      { type: 'entity_change', action: 'delete', entityType: req.params.type, entityId: req.params.id },
      { excludeUserId: req.user.id },
    );
    res.json(result);
  }),
);

export default router;
