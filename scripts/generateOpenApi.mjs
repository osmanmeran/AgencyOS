// Generates an OpenAPI 3.0 document from the shared Zod validation schemas
// (shared/schemas.js). The schema definitions are the single source of truth
// shared by server + client (see shared/schemas.js); this emits them as
// OpenAPI `components.schemas` so the API contract can be published/consumed
// by tooling. Route -> schema mapping is intentionally out of scope here; this
// produces the reusable schema definitions only.
//
// Run via `npm run openapi` (writes openapi.json). Importable as
// `buildOpenApiSpec()` for tests.

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { schemas } from '../shared/schemas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function isType(schema, name) {
  return schema?._def?.typeName === name;
}

// Recursively convert a Zod schema into a JSON Schema object. Zod v3 exposes
// the discriminated type under `schema._def.typeName`.
function toJsonSchema(schema) {
  const tn = schema?._def?.typeName;
  switch (tn) {
    case 'ZodString': {
      const out = { type: 'string' };
      for (const c of schema._def.checks || []) {
        if (c.kind === 'min') out.minLength = c.value;
        else if (c.kind === 'max') out.maxLength = c.value;
        else if (c.kind === 'length') {
          out.minLength = c.value;
          out.maxLength = c.value;
        } else if (c.kind === 'email') out.format = 'email';
        else if (c.kind === 'url') out.format = 'uri';
        else if (c.kind === 'regex' && c.regex) out.pattern = c.regex.source;
      }
      return out;
    }
    case 'ZodNumber': {
      const hasInt = (schema._def.checks || []).some((c) => c.kind === 'int');
      const out = { type: hasInt ? 'integer' : 'number' };
      for (const c of schema._def.checks || []) {
        if (c.kind === 'min') out.minimum = c.value;
        else if (c.kind === 'max') out.maximum = c.value;
        else if (c.kind === 'positive') {
          out.exclusiveMinimum = true;
          out.minimum = 0;
        } else if (c.kind === 'nonnegative') out.minimum = 0;
      }
      return out;
    }
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodEnum':
      return { type: 'string', enum: [...schema._def.values] };
    case 'ZodLiteral':
      return { enum: [schema._def.value] };
    case 'ZodArray': {
      const out = { type: 'array', items: toJsonSchema(schema._def.type) };
      if (schema._def.minLength != null) out.minItems = schema._def.minLength;
      if (schema._def.maxLength != null) out.maxItems = schema._def.maxLength;
      return out;
    }
    case 'ZodObject': {
      const shape = schema._def.shape();
      const properties = {};
      const required = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = toJsonSchema(value);
        if (!isType(value, 'ZodOptional') && !isType(value, 'ZodDefault')) {
          required.push(key);
        }
      }
      const out = { type: 'object', properties };
      if (required.length) out.required = required;
      return out;
    }
    case 'ZodRecord':
      return { type: 'object', additionalProperties: toJsonSchema(schema._def.valueType) };
    case 'ZodUnion':
      return { anyOf: schema._def.options.map(toJsonSchema) };
    case 'ZodNullable':
      return { anyOf: [toJsonSchema(schema._def.innerType), { type: 'null' }] };
    case 'ZodOptional':
    case 'ZodDefault':
      return toJsonSchema(schema._def.innerType);
    case 'ZodEffects':
      // .refine() / .coerce() / .preprocess() wrap an inner schema.
      return toJsonSchema(schema._def.schema);
    case 'ZodUnknown':
    case 'ZodAny':
    default:
      return {};
  }
}

export function buildOpenApiSpec() {
  const components = { schemas: {} };
  for (const [name, schema] of Object.entries(schemas)) {
    try {
      components.schemas[name] = toJsonSchema(schema);
    } catch (err) {
      // A schema the converter doesn't yet understand shouldn't blank the
      // whole spec; skip it and surface the name so it can be handled.
      console.warn(`[openapi] skipped schema "${name}": ${err.message}`);
    }
  }
  return {
    openapi: '3.0.3',
    info: { title: 'Marvelops TravelPro API', version: '0.0.0' },
    paths: {},
    components,
  };
}

// When invoked directly (npm run openapi), write the spec to openapi.json.
if (import.meta.url === `file://${process.argv[1]}`) {
  const spec = buildOpenApiSpec();
  const outPath = join(ROOT, 'openapi.json');
  writeFileSync(outPath, JSON.stringify(spec, null, 2));
  console.log(`Wrote ${Object.keys(spec.components.schemas).length} schemas to ${outPath}`);
}
