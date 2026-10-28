import { User } from "./user.entity.js";
import { InstitutionalProfile } from "./institutional-profile.entity.js";

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: User): Promise<void>;
  update(user: User): Promise<void>;
}

export interface IInstitutionalProfileRepository {
  findByUserId(userId: string): Promise<InstitutionalProfile | null>;
  upsert(profile: InstitutionalProfile): Promise<void>;
}
