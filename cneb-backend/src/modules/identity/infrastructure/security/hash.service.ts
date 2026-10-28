import argon2 from "argon2";

export interface IHashService {
  hash(plainText: string): Promise<string>;
  compare(plainText: string, hash: string): Promise<boolean>;
}

export class Argon2HashService implements IHashService {
  public async hash(plainText: string): Promise<string> {
    return argon2.hash(plainText, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,
      parallelism: 1,
    });
  }

  public async compare(plainText: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, plainText);
  }
}
