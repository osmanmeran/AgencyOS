import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { requireTier } from '../middleware/permissions.js';
import { catchAsync, BadRequestError, NotFoundError, ForbiddenError } from '../middleware/errors.js';
import { validate, schemas } from '../middleware/validate.js';
import { authenticateLocal, authenticateMicrosoft, authenticateGoogle, safeUser, setTokenCookie, getUserById, getUserPassword, updateUser, deleteUser, getAllUsers, createUser, inviteUser, acceptInvite } from '../services/auth.js';
import { sendEmail } from '../services/email.js';
import logger from '../lib/logger.js';

const router = Router();

router.post('/microsoft', validate(schemas.microsoftAuth), catchAsync(async (req, res) => {
  const user = await authenticateMicrosoft(req.body.idToken);
  const token = generateToken(user);
  setTokenCookie(res, token);
  res.json({ token, user });
}));

router.post('/google', validate(schemas.googleAuth), catchAsync(async (req, res) => {
  const user = await authenticateGoogle(req.body.idToken);
  const token = generateToken(user);
  setTokenCookie(res, token);
  res.json({ token, user });
}));

router.post('/login', validate(schemas.login), catchAsync(async (req, res) => {
  const user = authenticateLocal(req.body.email, req.body.password);
  const token = generateToken(user);
  setTokenCookie(res, token);
  res.json({ token, user });
}));

router.get('/me', authMiddleware, (req, res) => {
  const user = getUserById(req.user.id);
  if (!user) throw new NotFoundError('User not found');
  res.json(safeUser(user));
});

router.put('/me', authMiddleware, validate(schemas.updateMe), catchAsync(async (req, res) => {
  const { name, phone, language, default_currency, current_password, new_password } = req.body;
  const updates = {};

  if (new_password) {
    if (!current_password) throw new BadRequestError('Current password required to set new password');
    const user = getUserPassword(req.user.id);
    if (!user || !bcrypt.compareSync(current_password, user.password)) {
      throw new BadRequestError('Current password is incorrect');
    }
    updates.password = new_password;
  }

  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (language !== undefined) updates.language = language;
  if (default_currency !== undefined) updates.default_currency = default_currency;

  const updated = updateUser(req.user.id, updates);
  if (!updated) throw new BadRequestError('No fields to update');
  res.json(safeUser(updated));
}));

router.get('/users', authMiddleware, requireTier('admin'), (req, res) => {
  res.json(getAllUsers().map(u => safeUser(u)));
});

router.post('/users', authMiddleware, requireTier('admin'), validate(schemas.createUser), catchAsync(async (req, res) => {
  const user = createUser(req.body);
  res.status(201).json(safeUser(user));
}));

router.put('/users/:id', authMiddleware, requireTier('admin'), validate(schemas.updateUser), catchAsync(async (req, res) => {
  const { id } = req.params;
  const existing = getUserById(id);
  if (!existing) throw new NotFoundError('User not found');

  if (existing.user_tier === 'admin' && existing.id !== req.user.id && req.body.user_tier && req.body.user_tier !== 'admin') {
    throw new ForbiddenError('Cannot demote another admin');
  }

  const updated = updateUser(id, req.body);
  res.json(safeUser(updated));
}));

router.delete('/users/:id', authMiddleware, requireTier('admin'), catchAsync(async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) throw new BadRequestError('Cannot delete your own account');

  const existing = getUserById(id);
  if (!existing) throw new NotFoundError('User not found');
  if (existing.user_tier === 'admin') throw new ForbiddenError('Cannot delete another admin. Demote them first.');

  deleteUser(id);
  res.json({ success: true, message: 'User deleted' });
}));

router.post('/invite', authMiddleware, requireTier('admin'), validate(schemas.inviteUser), catchAsync(async (req, res) => {
  const result = inviteUser({ ...req.body, invited_by: req.user.id });

  const inviter = getUserById(req.user.id);
  const inviterName = inviter?.name || req.user.email;
  const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const inviteUrl = `${appUrl}/accept-invite?token=${result.token}`;

  sendEmail({
    to: result.email,
    subject: "You've been invited to Marvelops TravelPro",
    template: 'invite_user',
    templateData: { inviteUrl, inviterName },
  }).catch(err => logger.warn({ err: err.message, email: result.email }, 'Failed to send invite email'));

  res.status(201).json(result);
}));

router.post('/accept-invite', validate(schemas.acceptInvite), catchAsync(async (req, res) => {
  const user = acceptInvite(req.body);
  const token = generateToken(user);
  setTokenCookie(res, token);
  res.json({ token, user });
}));

router.post('/logout', authMiddleware, (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ success: true, message: 'Logged out' });
});

export default router;
