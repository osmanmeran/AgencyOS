import { z } from 'zod';

export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: result.error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
      });
    }
    req[source] = result.data;
    next();
  };
}

export const schemas = {
  login: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),

  microsoftAuth: z.object({
    idToken: z.string().min(1, 'idToken is required'),
  }),


  createUser: z.object({
    email: z.string().email('Invalid email format'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain an uppercase letter')
      .regex(/[a-z]/, 'Password must contain a lowercase letter')
      .regex(/[0-9]/, 'Password must contain a number'),
    name: z.string().min(1, 'Name is required'),
    user_tier: z.enum(['admin', 'manager', 'accounting', 'agent']).optional().default('agent'),
    custom_permissions: z.array(z.string()).optional(),
    departments: z.array(z.string()).optional(),
    is_active: z.boolean().optional(),
  }),

  updateUser: z.object({
    name: z.string().optional(),
    email: z.string().email('Invalid email format').optional(),
    user_tier: z.enum(['admin', 'manager', 'accounting', 'agent']).optional(),
    language: z.string().optional(),
    custom_permissions: z.array(z.string()).optional(),
    departments: z.array(z.string()).optional(),
    is_active: z.boolean().optional(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain an uppercase letter')
      .regex(/[a-z]/, 'Password must contain a lowercase letter')
      .regex(/[0-9]/, 'Password must contain a number')
      .optional(),
  }).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  }),

  updateMe: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    language: z.string().optional(),
    default_currency: z.string().optional(),
    avatar_url: z.string().url().optional().or(z.literal('')),
    current_password: z.string().optional(),
    new_password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain an uppercase letter')
      .regex(/[a-z]/, 'Password must contain a lowercase letter')
      .regex(/[0-9]/, 'Password must contain a number')
      .optional(),
  }),

  inviteUser: z.object({
    email: z.string().email('Invalid email format'),
    name: z.string().optional(),
    user_tier: z.enum(['admin', 'manager', 'accounting', 'agent']).optional().default('agent'),
    custom_permissions: z.array(z.string()).optional(),
    departments: z.array(z.string()).optional(),
  }),

  acceptInvite: z.object({
    token: z.string().min(1, 'Token is required'),
    name: z.string().min(1, 'Name is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain an uppercase letter')
      .regex(/[a-z]/, 'Password must contain a lowercase letter')
      .regex(/[0-9]/, 'Password must contain a number'),
  }),

  entityType: z.object({
    type: z.string().min(1, 'Entity type is required'),
  }),

  entityTypeAndId: z.object({
    type: z.string().min(1, 'Entity type is required'),
    id: z.string().min(1, 'Entity id is required'),
  }),

  createEntity: z.object({
    type: z.string().min(1, 'Entity type is required'),
  }),

  entityFilter: z.object({
    type: z.string().min(1, 'Entity type is required'),
    sort: z.string().optional(),
    filter: z.string().optional(),
  }),

  sendEmail: z.object({
    to: z.union([z.string().email(), z.array(z.string().email())]),
    subject: z.string().min(1, 'Subject is required'),
    body: z.string().optional(),
    cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
    bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  }),

  sendEmailTemplate: z.object({
    to: z.union([z.string().email(), z.array(z.string().email())]),
    subject: z.string().min(1, 'Subject is required'),
    template: z.enum(['generic', 'proposal', 'booking_confirmation', 'invoice', 'invite_user']),
    templateData: z.record(z.unknown()).optional(),
    cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
    bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  }),

  sendSms: z.object({
    to: z.string().min(1, 'Recipient is required'),
    message: z.string().min(1, 'Message is required'),
  }),

  exchangeRate: z.object({
    from: z.string().length(3, 'Currency code must be 3 characters'),
    to: z.string().length(3, 'Currency code must be 3 characters'),
  }),

  outlookConnect: z.object({
    code: z.string().min(1, 'Authorization code is required'),
    code_verifier: z.string().min(1, 'Code verifier is required'),
    redirect_uri: z.string().url('Valid redirect URI is required'),
  }),

  supplierWebSearch: z.object({
    name: z.string().min(1, 'Supplier name is required'),
    city: z.string().optional(),
  }),

  entityData: z.record(z.unknown()).refine(
    data => {
      for (const key of Object.keys(data)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') return false;
        if (key.startsWith('$') || key.includes('.')) return false;
      }
      return true;
    },
    { message: 'Invalid entity data: contains prohibited keys' }
  ),
};
