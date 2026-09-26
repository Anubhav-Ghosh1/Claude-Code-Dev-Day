export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.details && { details: this.details }),
    };
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, 'BAD_REQUEST', message, details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Invalid or missing authentication') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Insufficient permissions', details?: Record<string, unknown>) {
    super(403, 'FORBIDDEN', message, details);
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, id?: string) {
    super(404, 'NOT_FOUND', id ? `${resource} '${id}' not found` : `${resource} not found`);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

export class RateLimitError extends ApiError {
  constructor(message = 'Rate limit exceeded') {
    super(429, 'RATE_LIMIT_EXCEEDED', message);
  }
}

export class InternalError extends ApiError {
  constructor(message = 'Internal server error') {
    super(500, 'INTERNAL_ERROR', message);
  }
}
