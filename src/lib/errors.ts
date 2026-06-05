export class ValidationError extends Error {
  status = 400;
  details: string[];

  constructor(message: string, details: string[] = [message]) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

export class NotFoundError extends Error {
  status = 404;

  constructor(message = "Resource not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  status = 409;

  constructor(message = "Resource conflict") {
    super(message);
    this.name = "ConflictError";
  }
}
