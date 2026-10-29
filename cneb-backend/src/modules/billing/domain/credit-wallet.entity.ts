import { PaymentRequiredError, ValidationError } from "../../../core/errors/app-error.js";

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
  | "SESSION_GENERATION_DEBIT"
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

export function walletConfigurationErrors(
  wallet: Pick<CreditWalletProps, "balance" | "planType" | "isUnlimited" | "expiresAt">,
): string[] {
  const errors: string[] = [];
  if (!Number.isSafeInteger(wallet.balance) || wallet.balance < 0 || wallet.balance > 2147483647)
    errors.push("El saldo no puede ser negativo, fraccionario o fuera de rango.");
  if (wallet.isUnlimited && wallet.planType !== "LIFETIME_FREE")
    errors.push("is_unlimited=true exige plan LIFETIME_FREE.");
  if (wallet.planType === "LIFETIME_FREE" && !wallet.isUnlimited)
    errors.push("LIFETIME_FREE exige is_unlimited=true.");
  if (wallet.planType === "LIFETIME_FREE" && wallet.expiresAt !== null)
    errors.push("LIFETIME_FREE exige expires_at nulo.");
  if (wallet.expiresAt !== null
    && (!(wallet.expiresAt instanceof Date) || !Number.isFinite(wallet.expiresAt.getTime())))
    errors.push("expires_at debe ser una fecha finita válida o nulo.");
  return errors;
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

  public canGenerateSession(now: Date = new Date()): boolean {
    if (walletConfigurationErrors(this.props).length) return false;
    if (this.props.planType === "LIFETIME_FREE" && this.props.isUnlimited && !this.props.expiresAt) return true;
    if (this.props.isUnlimited || this.props.planType === "LIFETIME_FREE") return false;
    if (this.props.expiresAt && this.props.expiresAt <= now) return false;
    return this.props.balance >= 1;
  }

  public debitForSessionGeneration(now: Date = new Date()): void {
    if (this.props.planType === "LIFETIME_FREE" && this.props.isUnlimited && !this.props.expiresAt) {
      return; // Cuentas vitalicias no consumen saldo.
    }

    if (!this.canGenerateSession(now)) {
      throw new PaymentRequiredError(
        "No tienes créditos de generación o tu plan no está vigente.",
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
    if (!Number.isSafeInteger(amount) || this.props.balance + amount < 0
      || this.props.balance + amount > 2147483647)
      throw new ValidationError("El ajuste debe ser entero y no puede dejar un saldo negativo o fuera de rango.");
    const nextPlan = planType ?? this.props.planType;
    const nextUnlimited = isUnlimited ?? this.props.isUnlimited;
    const nextExpiry = expiresAt === undefined ? this.props.expiresAt : expiresAt;
    const errors = walletConfigurationErrors({
      balance: this.props.balance + amount, planType: nextPlan,
      isUnlimited: nextUnlimited, expiresAt: nextExpiry,
    });
    if (errors.length) throw new ValidationError(errors.join(" "));
    this.props.balance += amount;
    if (planType !== undefined) this.props.planType = planType;
    if (expiresAt !== undefined) this.props.expiresAt = expiresAt;
    if (isUnlimited !== undefined) this.props.isUnlimited = isUnlimited;
    this.props.updatedAt = new Date();
  }
}
