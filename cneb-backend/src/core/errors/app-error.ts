export abstract class AppError extends Error {
  public abstract readonly statusCode: number;
  public abstract readonly type: string;

  constructor(
    public readonly message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnauthorizedError extends AppError {
  public readonly statusCode = 401;
  public readonly type = "https://api.cneb-planner.pe/errors/unauthorized";
}

export class ForbiddenError extends AppError {
  public readonly statusCode = 403;
  public readonly type = "https://api.cneb-planner.pe/errors/forbidden";
}

export class NotFoundError extends AppError {
  public readonly statusCode = 404;
  public readonly type = "https://api.cneb-planner.pe/errors/not-found";
}

export class ConflictError extends AppError {
  public readonly statusCode = 409;
  public readonly type = "https://api.cneb-planner.pe/errors/conflict";
}

export class ValidationError extends AppError {
  public readonly statusCode = 422;
  public readonly type = "https://api.cneb-planner.pe/errors/validation-error";
}

export class PaymentRequiredError extends AppError {
  public readonly statusCode = 402;
  public readonly type =
    "https://api.cneb-planner.pe/errors/insufficient-credits";
}
