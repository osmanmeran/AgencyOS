import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { catchAsync } from '../middleware/errors.js';
import { validate, schemas } from '../middleware/validate.js';
import { findEntities, findEntityById, createEntity, updateEntity, deleteEntity, bulkCreateEntities, bulkUpdateEntities, bulkDeleteEntities } from '../services/entities.js';
import { broadcast } from '../lib/ws.js';

const router = Router();

router.use(authMiddleware);

router.get('/:type', validate(schemas.entityListQuery, 'query'), catchAsync(async (req, res) => {
  const results = findEntities(req.params.type, {
    sort: req.query.sort,
    filter: req.query.filter,
    search: req.query.search,
    limit: req.query.limit,
    offset: req.query.offset,
    user: req.user,
  });
  res.json(results);
}));

router.get('/:type/:id', catchAsync(async (req, res) => {
  const data = findEntityById(req.params.type, req.params.id, req.user);
  res.json(data);
}));

router.post('/:type', catchAsync(async (req, res) => {
  const result = createEntity(req.params.type, req.body, req.user);
  // Signal only — no entity data — so clients refetch through the normal,
  // permission-checked GET endpoints instead of receiving raw data over the socket.
  broadcast({ type: 'entity_change', action: 'create', entityType: req.params.type, entityId: result.id }, { excludeUserId: req.user.id });
  res.status(201).json(result);
}));

router.post('/:type/bulk-create', validate(schemas.bulkCreateEntity), catchAsync(async (req, res) => {
  const results = bulkCreateEntities(req.params.type, req.body.records, req.user);
  broadcast({ type: 'entity_change', action: 'bulk', entityType: req.params.type, entityIds: results.map(r => r.id) }, { excludeUserId: req.user.id });
  res.status(201).json(results);
}));

router.post('/:type/bulk-update', validate(schemas.bulkUpdateEntity), catchAsync(async (req, res) => {
  const result = bulkUpdateEntities(req.params.type, req.body.ids, req.body.data, req.user);
  broadcast({ type: 'entity_change', action: 'bulk', entityType: req.params.type, entityIds: result.updated.map(r => r.id) }, { excludeUserId: req.user.id });
  res.json(result);
}));

router.post('/:type/bulk-delete', validate(schemas.bulkDeleteEntity), catchAsync(async (req, res) => {
  const result = bulkDeleteEntities(req.params.type, req.body.ids, req.user);
  broadcast({ type: 'entity_change', action: 'bulk', entityType: req.params.type, entityIds: result.deleted }, { excludeUserId: req.user.id });
  res.json(result);
}));

router.put('/:type/:id', catchAsync(async (req, res) => {
  const result = updateEntity(req.params.type, req.params.id, req.body, req.user);
  broadcast({ type: 'entity_change', action: 'update', entityType: req.params.type, entityId: req.params.id }, { excludeUserId: req.user.id });
  res.json(result);
}));

router.delete('/:type/:id', catchAsync(async (req, res) => {
  const result = deleteEntity(req.params.type, req.params.id, req.user);
  broadcast({ type: 'entity_change', action: 'delete', entityType: req.params.type, entityId: req.params.id }, { excludeUserId: req.user.id });
  res.json(result);
}));

export default router;
