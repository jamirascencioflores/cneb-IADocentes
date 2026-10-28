import { ValidationError } from "../../../core/errors/app-error.js";

export type PedagogicalDurationType =
  | "MINUTES_45"
  | "MINUTES_90"
  | "MINUTES_135";

export interface MomentDistribution {
  start: { min: number; max: number };
  development: { min: number; max: number };
  closing: { min: number; max: number };
  total: number;
}

export class PedagogicalDuration {
  private static readonly RULES: Record<
    PedagogicalDurationType,
    MomentDistribution
  > = {
    MINUTES_45: {
      start: { min: 5, max: 10 },
      development: { min: 30, max: 30 },
      closing: { min: 5, max: 10 },
      total: 45,
    },
    MINUTES_90: {
      start: { min: 10, max: 15 },
      development: { min: 65, max: 70 },
      closing: { min: 10, max: 15 },
      total: 90,
    },
    MINUTES_135: {
      start: { min: 15, max: 15 },
      development: { min: 105, max: 110 },
      closing: { min: 10, max: 15 },
      total: 135,
    },
  };

  private constructor(public readonly type: PedagogicalDurationType) {}

  public static from(type: PedagogicalDurationType): PedagogicalDuration {
    if (!this.RULES[type]) {
      throw new ValidationError(`Duración pedagógica no soportada: ${type}`);
    }
    return new PedagogicalDuration(type);
  }

  public getDistribution(): MomentDistribution {
    return PedagogicalDuration.RULES[this.type];
  }

  public validateDistribution(
    startMin: number,
    devMin: number,
    closeMin: number,
  ): boolean {
    const rule = this.getDistribution();
    const sum = startMin + devMin + closeMin;
    if (sum !== rule.total) return false;
    return (
      startMin >= rule.start.min &&
      startMin <= rule.start.max &&
      devMin >= rule.development.min &&
      devMin <= rule.development.max &&
      closeMin >= rule.closing.min &&
      closeMin <= rule.closing.max
    );
  }
}
