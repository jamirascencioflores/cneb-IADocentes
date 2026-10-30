import { randomBytes } from "node:crypto";
import type { IHashService } from "../infrastructure/security/hash.service.js";
import { ValidationError } from "../../../core/errors/app-error.js";

// Never persist or log the plaintext returned to the caller.
export class TemporaryCredentialService {
  constructor(private readonly hashService: IHashService) {}
  async create(provided?: string): Promise<{ temporaryPassword: string; passwordHash: string }> {
    if (provided !== undefined && (provided.length < 12 || provided.length > 256))
      throw new ValidationError("La contraseña temporal requiere entre 12 y 256 caracteres.");
    const temporaryPassword = provided ?? randomBytes(24).toString("base64url");
    return { temporaryPassword, passwordHash: await this.hashService.hash(temporaryPassword) };
  }
}
