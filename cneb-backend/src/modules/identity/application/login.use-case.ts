import { UnauthorizedError } from "../../../core/errors/app-error.js";
import { IUserRepository } from "../domain/user.repository.interface.js";
import { IHashService } from "../infrastructure/security/hash.service.js";
import { ITokenService } from "../infrastructure/security/token.service.js";

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
  };
}

export class LoginUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hashService: IHashService,
    private readonly tokenService: ITokenService,
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

    const tokenPayload = {
      sub: user.id,
      role: user.role,
      email: user.email,
    };

    const accessToken = this.tokenService.generateAccessToken(tokenPayload);
    const refreshToken = this.tokenService.generateRefreshToken(tokenPayload);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
}
