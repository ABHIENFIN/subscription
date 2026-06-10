export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestException extends AppError {
  constructor(message = 'Bad request', code?: string) {
    super(400, message, code ?? 'BAD_REQUEST');
  }
}

export class UnauthorizedException extends AppError {
  constructor(message = 'Unauthorized', code?: string) {
    super(401, message, code ?? 'UNAUTHORIZED');
  }
}

export class ForbiddenException extends AppError {
  constructor(message = 'Forbidden', code?: string) {
    super(403, message, code ?? 'FORBIDDEN');
  }
}

export class NotFoundException extends AppError {
  constructor(message = 'Resource not found', code?: string) {
    super(404, message, code ?? 'NOT_FOUND');
  }
}

export class ConflictException extends AppError {
  constructor(message = 'Resource already exists', code?: string) {
    super(409, message, code ?? 'CONFLICT');
  }
}
