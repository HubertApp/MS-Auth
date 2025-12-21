export class UnauthorizedException extends Error {
  constructor(message?: string) {
    super(message || 'Unauthorized');
    this.name = 'UnauthorizedException';
  }
}
