import { z } from "zod";

export const adjustSubscriptionSchema = z.object({
  planType: z
    .enum([
      "TRIAL",
      "MONTHLY",
      "QUARTERLY",
      "ANNUAL",
      "LIFETIME_FREE",
    ])
    .optional(),
  balanceAdjustment: z.number().int().optional(),
  isUnlimited: z.boolean().optional(),
  expiresAt: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .transform((val): Date | null | undefined => {
      if (val === undefined) return undefined;
      if (val === null) return null;
      return new Date(val);
    }),
  note: z.string().trim().min(1).max(255),
}).strict();

export const userIdParamSchema = z.object({
  id: z.string().uuid("El ID debe ser un UUID válido"),
});

export type AdjustSubscriptionInput = z.infer<typeof adjustSubscriptionSchema>;
