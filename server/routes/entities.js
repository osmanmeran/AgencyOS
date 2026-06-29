import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { catchAsync } from '../middleware/errors.js';
import { findEntities, findEntityById, createEntity, updateEntity, deleteEntity } from '../services/entities.js';

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
  res.status(201).json(result);
}));

router.put('/:type/:id', catchAsync(async (req, res) => {
  const result = updateEntity(req.params.type, req.params.id, req.body, req.user);
  res.json(result);
}));

router.delete('/:type/:id', catchAsync(async (req, res) => {
  const result = deleteEntity(req.params.type, req.params.id, req.user);
  res.json(result);
}));

export default router;
