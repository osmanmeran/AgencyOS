import { describe, it, expect } from 'vitest';
import {
  AppError, BadRequestError, UnauthorizedError, ForbiddenError,
  NotFoundError, ConflictError, catchAsync
} from '../../server/middleware/errors.js';

describe('Error classes', () => {
  it('should create AppError with defaults', () => {
    const err = new AppError('Something went wrong');
    expect(err.message).toBe('Something went wrong');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.isOperational).toBe(true);
  });

  it('should create BadRequestError', () => {
    const err = new BadRequestError('Invalid input');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
  });

  it('should create UnauthorizedError', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('Unauthorized');
  });

  it('should create ForbiddenError', () => {
    const err = new ForbiddenError('Access denied');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('should create NotFoundError', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });

  it('should create ConflictError', () => {
    const err = new ConflictError('Already exists');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });

  it('should support custom codes', () => {
    const err = new BadRequestError('test', 'CUSTOM_CODE');
    expect(err.code).toBe('CUSTOM_CODE');
  });
});

describe('catchAsync', () => {
  it('should catch thrown errors and pass to next', async () => {
    const fn = catchAsync(async () => {
      throw new Error('async error');
    });

    const next = (err) => {
      expect(err.message).toBe('async error');
    };

    await fn(null, null, next);
  });

  it('should call next with no error on success', async () => {
    let called = false;
    const fn = catchAsync(async (req, res, next) => {
      called = true;
    });

    const next = () => {};
    await fn(null, null, next);
    expect(called).toBe(true);
  });
});
