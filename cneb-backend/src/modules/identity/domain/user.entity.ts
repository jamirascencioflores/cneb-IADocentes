export type UserRole = "SUPERADMIN" | "TEACHER";

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword?: boolean;
  tokenVersion?: number;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  private constructor(private readonly props: UserProps) {}

  public static reconstitute(props: UserProps): User {
    return new User(props);
  }

  public get id(): string {
    return this.props.id;
  }
  public get email(): string {
    return this.props.email;
  }
  public get role(): UserRole {
    return this.props.role;
  }
  public get isActive(): boolean {
    return this.props.isActive;
  }
  public get passwordHash(): string {
    return this.props.passwordHash;
  }
  public get mustChangePassword(): boolean { return this.props.mustChangePassword ?? false; }
  public get tokenVersion(): number { return this.props.tokenVersion ?? 0; }

  public isSuperAdmin(): boolean {
    return this.props.role === "SUPERADMIN";
  }

  public canGenerateSessions(): boolean {
    return this.props.isActive;
  }
}
