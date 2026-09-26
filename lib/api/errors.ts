/** Thrown by the API client in both mock and real mode. Mirrors the backend's { error: { code, message } }. */
export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}
