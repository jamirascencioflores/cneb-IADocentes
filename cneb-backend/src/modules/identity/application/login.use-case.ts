import { UnauthorizedError } from "../../../core/errors/app-error.js";
import { IUserRepository } from "../domain/user.repository.interface.js";
import { IHashService } from "../infrastructure/security/hash.service.js";
import { ISessionIssuer } from "./auth-session.service.js";

export interface LoginDTO {
  email: string;
  password: string;
}

export interface LoginOutput {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    mustChangePassword: boolean;
  };
}

export class LoginUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hashService: IHashService,
    private readonly sessions: ISessionIssuer,
  ) {}

  public async execute(dto: LoginDTO): Promise<LoginOutput> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("Credenciales inválidas.");
    }

    const isPasswordValid = await this.hashService.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedError("Credenciales inválidas.");
    }

    return this.sessions.issue(user);
  }
}
