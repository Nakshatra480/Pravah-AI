export class PravahError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(`[Pravah]: ${message}`);
    this.name = "PravahError";
  }
}
