import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoginUseCase } from "./login.use-case.js";
import { IUserRepository } from "../domain/user.repository.interface.js";
import { IHashService } from "../infrastructure/security/hash.service.js";
import { ITokenService } from "../infrastructure/security/token.service.js";
import { User } from "../domain/user.entity.js";
import { UnauthorizedError } from "../../../core/errors/app-error.js";

describe("LoginUseCase", () => {
  let userRepository: IUserRepository;
  let hashService: IHashService;
  let tokenService: ITokenService;
  let useCase: LoginUseCase;

  beforeEach(() => {
    userRepository = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };
    hashService = {
      hash: vi.fn(),
      compare: vi.fn(),
    };
    tokenService = {
      generateAccessToken: vi.fn().mockReturnValue("mock-access-token"),
      generateRefreshToken: vi.fn().mockReturnValue("mock-refresh-token"),
      verifyAccessToken: vi.fn(),
      verifyRefreshToken: vi.fn(),
    };
    useCase = new LoginUseCase(userRepository, hashService, tokenService);
  });

  it("debe autenticar exitosamente y retornar tokens para credenciales correctas", async () => {
    const mockUser = User.reconstitute({
      id: "user-123",
      email: "profesor@colegio.edu.pe",
      passwordHash: "hashed_secret",
      role: "TEACHER",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(userRepository, "findByEmail").mockResolvedValue(mockUser);
    vi.spyOn(hashService, "compare").mockResolvedValue(true);

    const result = await useCase.execute({
      email: "profesor@colegio.edu.pe",
      password: "Password123!",
    });

    expect(result.accessToken).toBe("mock-access-token");
    expect(result.refreshToken).toBe("mock-refresh-token");
    expect(result.user.id).toBe("user-123");
  });

  it("debe arrojar UnauthorizedError si el usuario no existe", async () => {
    vi.spyOn(userRepository, "findByEmail").mockResolvedValue(null);

    await expect(
      useCase.execute({ email: "inexistente@colegio.edu.pe", password: "123" }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("debe arrojar UnauthorizedError si la contraseña no coincide", async () => {
    const mockUser = User.reconstitute({
      id: "user-123",
      email: "profesor@colegio.edu.pe",
      passwordHash: "hashed_secret",
      role: "TEACHER",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(userRepository, "findByEmail").mockResolvedValue(mockUser);
    vi.spyOn(hashService, "compare").mockResolvedValue(false);

    await expect(
      useCase.execute({ email: "profesor@colegio.edu.pe", password: "wrong" }),
    ).rejects.toThrow(UnauthorizedError);
  });
});
