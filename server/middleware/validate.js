import { z } from 'zod';

export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: result.error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
          request_id: req.id,
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

  createUser: z
    .object({
      email: z.string().email('Invalid email format'),
      password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain an uppercase letter')
        .regex(/[a-z]/, 'Password must contain a lowercase letter')
        .regex(/[0-9]/, 'Password must contain a number'),
      name: z.string().min(1, 'Name is required'),
      user_tier: z.enum(['admin', 'manager', 'accounting', 'agent', 'client']).optional().default('agent'),
      custom_permissions: z.array(z.string()).optional(),
      departments: z.array(z.string()).optional(),
      is_active: z.boolean().optional(),
      client_id: z.string().optional(),
    })
    .refine((data) => data.user_tier !== 'client' || !!data.client_id, {
      message: 'client_id is required when user_tier is "client"',
      path: ['client_id'],
    }),

  updateUser: z
    .object({
      name: z.string().optional(),
      email: z.string().email('Invalid email format').optional(),
      user_tier: z.enum(['admin', 'manager', 'accounting', 'agent', 'client']).optional(),
      language: z.string().optional(),
      custom_permissions: z.array(z.string()).optional(),
      departments: z.array(z.string()).optional(),
      is_active: z.boolean().optional(),
      // Nullable: the Edit User form always sends client_id (null when the
      // tier isn't 'client', to clear a stale link on tier change) rather
      // than omitting the key.
      client_id: z.string().nullable().optional(),
      password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain an uppercase letter')
        .regex(/[a-z]/, 'Password must contain a lowercase letter')
        .regex(/[0-9]/, 'Password must contain a number')
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided for update',
    })
    .refine((data) => data.user_tier !== 'client' || !!data.client_id, {
      message: 'client_id is required when setting user_tier to "client"',
      path: ['client_id'],
    }),

  updateMe: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    language: z.string().optional(),
    default_currency: z.string().optional(),
    avatar_url: z.string().url().optional().or(z.literal('')),
    email_notifications: z.boolean().optional(),
    current_password: z.string().optional(),
    new_password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain an uppercase letter')
      .regex(/[a-z]/, 'Password must contain a lowercase letter')
      .regex(/[0-9]/, 'Password must contain a number')
      .optional(),
  }),

  inviteUser: z
    .object({
      email: z.string().email('Invalid email format'),
      name: z.string().optional(),
      user_tier: z.enum(['admin', 'manager', 'accounting', 'agent', 'client']).optional().default('agent'),
      custom_permissions: z.array(z.string()).optional(),
      departments: z.array(z.string()).optional(),
      client_id: z.string().optional(),
    })
    .refine((data) => data.user_tier !== 'client' || !!data.client_id, {
      message: 'client_id is required when inviting a client-tier user',
      path: ['client_id'],
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

  entityListQuery: z.object({
    sort: z.string().optional(),
    filter: z.string().optional(),
    search: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  }),

  bulkCreateEntity: z.object({
    records: z.array(z.record(z.unknown())).min(1, 'records must be a non-empty array'),
  }),

  bulkUpdateEntity: z.object({
    ids: z.array(z.string().min(1)).min(1, 'ids must be a non-empty array'),
    data: z.record(z.unknown()),
  }),

  bulkDeleteEntity: z.object({
    ids: z.array(z.string().min(1)).min(1, 'ids must be a non-empty array'),
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
    template: z.enum(['generic', 'proposal', 'booking_confirmation', 'invoice', 'invite_user', 'quote_response']),
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
    token_data: z.object({
      access_token: z.string().min(1),
      refresh_token: z.string().optional(),
      expires_in: z.number().optional(),
    }),
  }),

  supplierWebSearch: z.object({
    name: z.string().min(1, 'Supplier name is required'),
    city: z.string().optional(),
  }),

  b2bSubmitQuote: z.object({
    title: z.string().min(1, 'Title is required'),
    // Optional reservation-style trip context from the client quote builder.
    // `destination` is a display string derived client-side by joining the
    // structured `destinations` stops (each independently geocoded).
    destination: z.string().optional(),
    destinations: z
      .array(
        z.object({
          label: z.string(),
          lat: z.number().nullable().optional(),
          lon: z.number().nullable().optional(),
        }),
      )
      .optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    passengers: z.array(z.record(z.unknown())).optional(),
    items: z
      .array(
        z.object({
          pricing_id: z.string().min(1, 'pricing_id is required'),
          quantity: z.number().positive().optional().default(1),
          // Total children (across all rooms) on a lodging line — priced via
          // the pricing row's child supplement, infants excluded client-side.
          children_count: z.number().nonnegative().optional().default(0),
          // Optional per-line trip details (lodging nights, transfer logistics).
          start_date: z.string().optional(),
          end_date: z.string().optional(),
          room_type: z.string().optional(),
          pickup_location: z.string().optional(),
          dropoff_location: z.string().optional(),
          flight_number: z.string().optional(),
          service_time: z.string().optional(),
          details: z.string().optional(),
        }),
      )
      .min(1, 'At least one item is required'),
    notes: z.string().optional(),
  }),

  b2bRespondToQuote: z.object({
    status: z.enum(['reviewing', 'quoted', 'accepted', 'declined']),
    response_notes: z.string().optional(),
  }),

  entityData: z.record(z.unknown()).refine(
    (data) => {
      for (const key of Object.keys(data)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') return false;
        if (key.startsWith('$') || key.includes('.')) return false;
      }
      return true;
    },
    { message: 'Invalid entity data: contains prohibited keys' },
  ),
};
