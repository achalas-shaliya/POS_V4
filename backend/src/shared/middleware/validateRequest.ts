import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { StatusCodes } from 'http-status-codes';

// ---------------------------------------------------------------------------
// Schemas to validate different parts of a request
// ---------------------------------------------------------------------------
interface ValidateSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

// ---------------------------------------------------------------------------
// validateRequest — Express middleware factory
//
// Usage in a router:
//   router.post('/', validateRequest({ body: createUserSchema }), controller.create)
//   router.get('/',  validateRequest({ query: paginationSchema }), controller.list)
// ---------------------------------------------------------------------------
export const validateRequest =
  (schemas: ValidateSchemas) =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        // Express 5 exposes req.query via getter-only property, so validate without reassigning.
        schemas.query.parse(req.query);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
          success: false,
          message: 'Validation failed',
          errors: err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(err);
    }
  };
