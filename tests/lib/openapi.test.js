import { describe, it, expect } from 'vitest';
import { buildOpenApiSpec } from '../../scripts/generateOpenApi.mjs';
import { schemas } from '../../shared/schemas.js';

describe('OpenAPI spec generation', () => {
  const spec = buildOpenApiSpec();

  it('produces a valid OpenAPI 3 document', () => {
    expect(spec.openapi).toBe('3.0.3');
    expect(spec).toHaveProperty('components.schemas');
    expect(spec.paths).toBeDefined();
  });

  it('emits a schema entry for every shared validation schema', () => {
    const names = Object.keys(spec.components.schemas);
    for (const name of Object.keys(schemas)) {
      expect(names, `missing generated schema: ${name}`).toContain(name);
    }
  });

  it('converts representative schema shapes correctly', () => {
    expect(spec.components.schemas.login).toEqual({
      type: 'object',
      properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 1 } },
      required: ['email', 'password'],
    });
    // refinements aren't representable in JSON Schema; the object shape still is.
    expect(spec.components.schemas.createUser.type).toBe('object');
    expect(spec.components.schemas.createUser.properties.email).toEqual({ type: 'string', format: 'email' });
    // enum endpoint
    expect(spec.components.schemas.b2bRespondToQuote.properties.status).toEqual({
      type: 'string',
      enum: ['reviewing', 'quoted', 'accepted', 'declined'],
    });
  });
});
