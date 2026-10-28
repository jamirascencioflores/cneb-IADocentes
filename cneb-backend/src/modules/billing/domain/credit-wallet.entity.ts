import { PaymentRequiredError } from "../../../core/errors/app-error.js";

export type SubscriptionPlan =
  | "TRIAL"
  | "MONTHLY"
  | "BIMONTHLY"
  | "TRIMONTHLY"
  | "ANNUAL"
  | "LIFETIME_FREE";
export type TransactionType =
  | "SUBSCRIPTION_RECHARGE"
  | "SESSION_EXPORT_DEBIT"
  | "ADMIN_MANUAL_ADJUSTMENT"
  | "FAILED_REFUND";

export interface CreditWalletProps {
  id: string;
  userId: string;
  balance: number;
  isUnlimited: boolean;
  planType: SubscriptionPlan;
  startsAt: Date;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CreditWallet {
  private constructor(private readonly props: CreditWalletProps) {}

  public static reconstitute(props: CreditWalletProps): CreditWallet {
    return new CreditWallet(props);
  }

  public get id(): string {
    return this.props.id;
  }
  public get userId(): string {
    return this.props.userId;
  }
  public get balance(): number {
    return this.props.balance;
  }
  public get isUnlimited(): boolean {
    return this.props.isUnlimited;
  }
  public get planType(): SubscriptionPlan {
    return this.props.planType;
  }
  public get expiresAt(): Date | null {
    return this.props.expiresAt;
  }

  public canExportSession(now: Date = new Date()): boolean {
    if (this.props.isUnlimited) return true;
    if (this.props.expiresAt && this.props.expiresAt <= now) return false;
    return this.props.balance >= 1;
  }

  public debitForSessionExport(now: Date = new Date()): void {
    if (this.props.isUnlimited) {
      return; // Cuentas vitalicias no debitan
    }

    if (this.props.expiresAt && this.props.expiresAt <= now) {
      throw new PaymentRequiredError("El plan de suscripción ha expirado.");
    }

    if (this.props.balance < 1) {
      throw new PaymentRequiredError(
        "Créditos insuficientes para exportar la sesión.",
      );
    }

    this.props.balance -= 1;
    this.props.updatedAt = now;
  }

  public applyManualAdjustment(
    amount: number,
    planType?: SubscriptionPlan,
    expiresAt?: Date | null,
    isUnlimited?: boolean,
  ): void {
    this.props.balance = Math.max(0, this.props.balance + amount);
    if (planType !== undefined) this.props.planType = planType;
    if (expiresAt !== undefined) this.props.expiresAt = expiresAt;
    if (isUnlimited !== undefined) this.props.isUnlimited = isUnlimited;
    this.props.updatedAt = new Date();
  }
}
