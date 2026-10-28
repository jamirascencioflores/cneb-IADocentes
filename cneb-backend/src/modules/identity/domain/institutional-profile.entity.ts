import crypto from "node:crypto";

export interface InstitutionalProfileProps {
  id: string;
  userId: string;
  teacherFullName: string;
  specialty: string;
  schoolName: string;
  ugel: string;
  dre: string;
  principalName: string | null;
  badgeUrl: string | null;
  signatureUrl: string | null;
  isDefault: boolean;
  createdAt: Date;
}

export interface CreateInstitutionalProfileProps {
  userId: string;
  teacherFullName: string;
  specialty: string;
  schoolName: string;
  ugel: string;
  dre?: string;
  principalName?: string | null;
  badgeUrl?: string | null;
  signatureUrl?: string | null;
}

export class InstitutionalProfile {
  private constructor(private readonly props: InstitutionalProfileProps) {}

  public static create(
    props: CreateInstitutionalProfileProps,
  ): InstitutionalProfile {
    return new InstitutionalProfile({
      id: crypto.randomUUID(),
      userId: props.userId,
      teacherFullName: props.teacherFullName,
      specialty: props.specialty,
      schoolName: props.schoolName,
      ugel: props.ugel,
      dre: props.dre ?? "DRELM",
      principalName: props.principalName ?? null,
      badgeUrl: props.badgeUrl ?? null,
      signatureUrl: props.signatureUrl ?? null,
      isDefault: true,
      createdAt: new Date(),
    });
  }

  public static reconstitute(
    props: InstitutionalProfileProps,
  ): InstitutionalProfile {
    return new InstitutionalProfile(props);
  }

  public get id(): string {
    return this.props.id;
  }
  public get userId(): string {
    return this.props.userId;
  }
  public get teacherFullName(): string {
    return this.props.teacherFullName;
  }
  public get specialty(): string {
    return this.props.specialty;
  }
  public get schoolName(): string {
    return this.props.schoolName;
  }
  public get ugel(): string {
    return this.props.ugel;
  }
  public get dre(): string {
    return this.props.dre;
  }
  public get principalName(): string | null {
    return this.props.principalName;
  }
  public get badgeUrl(): string | null {
    return this.props.badgeUrl;
  }
  public get signatureUrl(): string | null {
    return this.props.signatureUrl;
  }
  public get isDefault(): boolean {
    return this.props.isDefault;
  }
  public get createdAt(): Date {
    return this.props.createdAt;
  }
}
