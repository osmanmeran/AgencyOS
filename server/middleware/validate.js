import { schemas } from '../../shared/schemas.js';

export { schemas };

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
