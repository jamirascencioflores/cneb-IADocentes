import { ValidationError } from "../errors/app-error.js";

export class UUID {
  private static readonly REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private constructor(private readonly value: string) {}

  public static create(value: string): UUID {
    if (!this.REGEX.test(value)) {
      throw new ValidationError(`Identificador UUID inválido: ${value}`);
    }
    return new UUID(value.toLowerCase());
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other: UUID): boolean {
    return this.value === other.value;
  }
}
