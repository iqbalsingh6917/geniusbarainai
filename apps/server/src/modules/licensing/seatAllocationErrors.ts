export class SeatAllocationError extends Error {
  code: string;
  meta?: any;

  constructor(code: string, meta?: any) {
    super(code);
    this.code = code;
    this.meta = meta;
  }
}
