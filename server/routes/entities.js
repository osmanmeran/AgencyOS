import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { catchAsync } from '../middleware/errors.js';
import { findEntities, findEntityById, createEntity, updateEntity, deleteEntity } from '../services/entities.js';
import { broadcast } from '../lib/ws.js';

const router = Router();

router.use(authMiddleware);

router.get('/:type', catchAsync(async (req, res) => {
  const results = findEntities(req.params.type, {
    sort: req.query.sort,
    filter: req.query.filter,
    user: req.user,
  });
  res.json(results);
}));

router.get('/:type/:id', catchAsync(async (req, res) => {
  const data = findEntityById(req.params.type, req.params.id, req.user);
  res.json(data);
}));

router.post('/:type', catchAsync(async (req, res) => {
  const result = createEntity(req.params.type, req.body, req.user.id);
  // Signal only — no entity data — so clients refetch through the normal,
  // permission-checked GET endpoints instead of receiving raw data over the socket.
  broadcast({ type: 'entity_change', action: 'create', entityType: req.params.type, entityId: result.id }, { excludeUserId: req.user.id });
  res.status(201).json(result);
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
