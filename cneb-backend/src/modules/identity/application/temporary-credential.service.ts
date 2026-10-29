import { randomBytes } from "node:crypto";
import type { IHashService } from "../infrastructure/security/hash.service.js";

// Prepared for stage 2 account creation/reset. No HTTP endpoint exposes it yet.
export class TemporaryCredentialService {
  constructor(private readonly hashService: IHashService) {}
  async create(): Promise<{ temporaryPassword: string; passwordHash: string }> {
    const temporaryPassword = randomBytes(24).toString("base64url");
    return { temporaryPassword, passwordHash: await this.hashService.hash(temporaryPassword) };
  }
}
