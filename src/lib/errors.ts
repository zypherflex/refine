export class AppError extends Error {
  constructor(
    message: string,
    public status: number = 400,
  ) {
    super(message);
  }
}
export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do that") {
    super(message, 403);
  }
}
