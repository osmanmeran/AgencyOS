import { z } from 'zod';

/**
 * Single source of truth for request-validation schemas, shared by the server
 * (`server/middleware/validate.js`) and available to the frontend. These were
 * previously colocated in the server-only validate.js; moving them here lets
 * both sides import the same Zod definitions so the API contract can't drift,
 * and lets `scripts/generateOpenApi.mjs` emit an OpenAPI spec from them.
 */
export const schemas = {
  login: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),

  microsoftAuth: z.object({
    idToken: z.string().min(1, 'idToken is required'),
  }),

  // Self-serve workspace signup (Phase 3). The slug is re-validated server-side
  // against the reserved-word list; this regex is just a fast first pass.
  // Either an admin password OR a Microsoft id token provisions the first admin.
  signup: z
    .object({
      agencyName: z.string().min(1, 'Agency name is required').max(120, 'Agency name is too long'),
      slug: z
        .string()
        .min(1, 'Workspace address is required')
        .max(63, 'Workspace address is too long')
        .regex(/^[a-z0-9-]+$/, 'Workspace address may only contain lowercase letters, numbers, and hyphens'),
      adminEmail: z.string().email('Invalid email format').optional(),
      adminPassword: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain an uppercase letter')
        .regex(/[a-z]/, 'Password must contain a lowercase letter')
        .regex(/[0-9]/, 'Password must contain a number')
        .optional(),
      adminName: z.string().max(120).optional(),
      idToken: z.string().min(1, 'idToken is required').optional(),
    })
    .refine((d) => !!d.idToken || (!!d.adminEmail && !!d.adminPassword), {
      message: 'Provide adminEmail + adminPassword, or a Microsoft idToken',
      path: ['adminPassword'],
    }),

  // Self-serve workspace control plane (Phase 4). Only `name` and
  // `azureTenantId` are editable; `slug`/`status` are immutable. `azureTenantId`
  // may be set to '' / null to clear (disabling per-workspace Microsoft SSO).
  updateTenant: z
    .object({
      name: z.string().min(1, 'Workspace name is required').max(120).optional(),
      azureTenantId: z.string().max(36).nullable().optional(),
    })
    .refine((d) => Object.keys(d).length > 0, {
      message: 'Provide at least one field to update',
      path: ['name'],
    }),

  // Platform-operator workspace lifecycle actions (server/routes/platform.js).
  setWorkspaceStatus: z.object({
    status: z.enum(['trial', 'active', 'suspended']),
  }),

  extendTrial: z.object({
    days: z.coerce.number().int().positive().max(365).optional(),
  }),

  // Deleting a workspace is irreversible: the caller must echo back its slug.
  deleteWorkspace: z.object({
    confirmSlug: z.string().min(1, 'Type the workspace address to confirm'),
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
      // Who this user's escalations (server/services/tasks.js's
      // checkEscalations) go to, in addition to the assignee. Nullable/optional:
      // no manager set falls back to notifying every admin/manager in the tenant.
      manager_id: z.string().nullable().optional(),
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
      manager_id: z.string().nullable().optional(),
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
      manager_id: z.string().nullable().optional(),
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

  forgotPassword: z.object({
    email: z.string().email('Invalid email format'),
  }),

  resetPassword: z.object({
    token: z.string().min(1, 'Token is required'),
    newPassword: z
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
  clientPortalAction: z.object({
    clientId: z.string().min(1, 'clientId is required'),
  }),

  supplierPortalAction: z.object({
    supplierId: z.string().min(1, 'supplierId is required'),
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

  createInvoiceCheckoutSession: z.object({
    invoiceId: z.string().min(1, 'invoiceId is required'),
  }),

  // Bring-your-own-key Stripe settings: a workspace pastes its own secret key
  // and/or webhook signing secret directly from its own Stripe Dashboard.
  // Either field may be sent independently (the secret key typically arrives
  // first, the webhook secret once the tenant has created their own endpoint).
  saveStripeSettings: z
    .object({
      secretKey: z.string().regex(/^sk_/, 'Must be a Stripe secret key (starts with "sk_")').optional(),
      webhookSecret: z
        .string()
        .regex(/^whsec_/, 'Must be a Stripe webhook signing secret (starts with "whsec_")')
        .optional(),
    })
    .refine((d) => d.secretKey !== undefined || d.webhookSecret !== undefined, {
      message: 'Provide a secretKey and/or a webhookSecret',
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
    // Compulsory contact details, captured in the client cart before submit.
    contact_passenger: z.string().optional(),
    contact_phone: z.string().optional(),
    // Attaches this request to one of the client's own existing trips
    // instead of it being a standalone request — ownership is re-checked
    // server-side (server/routes/b2b.js), this id is never trusted as-is.
    trip_id: z.string().optional(),
    items: z
      .array(
        z
          .object({
            pricing_id: z.string().optional(),
            // Guided-tour catalog items (the curated GuidedTour entity) are added
            // by tour_id rather than a B2B pricing_id; pricing is resolved
            // server-side from the tour's participant tiers + active special offer.
            tour_id: z.string().optional(),
            tour_name: z.string().optional(),
            tour_mode: z.string().optional(),
            quantity: z.number().positive().optional().default(1),
            // Total children (across all rooms) on a lodging line — priced via
            // the pricing row's child supplement, infants excluded client-side.
            children_count: z.number().nonnegative().optional().default(0),
            // Optional per-line trip details (lodging nights, transfer logistics).
            start_date: z.string().optional(),
            end_date: z.string().optional(),
            service_date: z.string().optional(),
            room_type: z.string().optional(),
            pickup_location: z.string().optional(),
            dropoff_location: z.string().optional(),
            flight_number: z.string().optional(),
            service_time: z.string().optional(),
            adults: z.number().nonnegative().optional(),
            children: z.number().nonnegative().optional(),
            infants: z.number().nonnegative().optional(),
            details: z.string().optional(),
            // Car rental specifics — were missing here even though b2b.js reads
            // them off the request body (server/routes/b2b.js), so Zod silently
            // stripped them before the route ever saw them: every car rental
            // quote was priced as a 1-day rental with no insurance regardless
            // of what the client actually selected.
            car_category: z.string().optional(),
            car_rental_days: z.number().positive().optional(),
            car_insurance: z.boolean().optional(),
          })
          .refine((item) => !!item.pricing_id || !!item.tour_id, {
            message: 'Each item must have either pricing_id or tour_id',
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
