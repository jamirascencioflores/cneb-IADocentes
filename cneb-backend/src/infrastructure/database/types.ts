import { Generated } from "kysely";

export type UserRoleEnum = "SUPERADMIN" | "TEACHER";
export type SubscriptionPlanEnum =
  | "TRIAL"
  | "MONTHLY"
  | "BIMONTHLY"
  | "QUARTERLY"
  | "ANNUAL"
  | "LIFETIME_FREE";
export type TransactionTypeEnum =
  | "SUBSCRIPTION_RECHARGE"
  | "SESSION_EXPORT_DEBIT"
  | "SESSION_GENERATION_DEBIT"
  | "ADMIN_MANUAL_ADJUSTMENT"
  | "FAILED_REFUND";

export interface UsersTable {
  id: Generated<string>;
  email: string;
  password_hash: string;
  role: UserRoleEnum;
  is_active: Generated<boolean>;
  must_change_password: Generated<boolean>;
  token_version: Generated<number>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface InstitutionalProfilesTable {
  id: Generated<string>;
  user_id: string;
  teacher_full_name: string;
  specialty: string;
  school_name: string;
  ugel: string;
  dre: Generated<string>;
  principal_name: string | null;
  badge_url: string | null;
  signature_url: string | null;
  is_default: Generated<boolean>;
  created_at: Generated<Date>;
}

export interface CreditWalletsTable {
  id: Generated<string>;
  user_id: string;
  balance: Generated<number>;
  is_unlimited: Generated<boolean>;
  plan_type: Generated<SubscriptionPlanEnum>;
  starts_at: Generated<Date>;
  expires_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface WalletTransactionsTable {
  id: Generated<string>;
  wallet_id: string;
  amount: number;
  transaction_type: TransactionTypeEnum;
  reference_session_id: string | null;
  note: string | null;
  created_at: Generated<Date>;
  actor_user_id: string | null;
  balance_before: number | null;
  balance_after: number | null;
  plan_type_before: SubscriptionPlanEnum | null;
  plan_type_after: SubscriptionPlanEnum | null;
  expires_at_before: Date | null;
  expires_at_after: Date | null;
  is_unlimited_before: boolean | null;
  is_unlimited_after: boolean | null;
  generation_request_id: string | null;
  admin_audit_event_id: Generated<string | null>;
}

export interface AdminAuditEventsTable {
  id: string;
  actor_user_id: string;
  actor_role: "SUPERADMIN";
  action: string;
  entity_type: string;
  entity_id: string;
  reason: string;
  before_data: unknown;
  after_data: unknown;
  request_id: string | null;
  created_at: Generated<Date>;
}

export type GradeLevelEnum = "FIRST" | "SECOND" | "THIRD" | "FOURTH" | "FIFTH";

export interface AreasTable {
  id: string; // 'COM', 'EPT', 'MAT', etc.
  name: string;
  cycle: Generated<string>;
  is_active: Generated<boolean>;
}

export interface CompetenciesTable {
  id: string;
  area_id: string;
  title: string;
  description: string;
}

export interface CapacitiesTable {
  id: string;
  competency_id: string;
  title: string;
  order_index: number;
}

export interface PerformancesTable {
  id: string;
  competency_id: string;
  grade_level: GradeLevelEnum;
  standard_description: string;
}

export type PedagogicalDurationEnum = 'MINUTES_45' | 'MINUTES_90' | 'MINUTES_135';
export type DidacticMomentTypeEnum = 'START' | 'DEVELOPMENT' | 'CLOSING';
export type InstrumentTypeEnum = 'CHECKLIST' | 'RUBRIC' | 'SELF_EVALUATION' | 'OBSERVATION_GUIDE' | 'NONE';
export type CrossCuttingThemeEnum =
  | 'RIGHTS'
  | 'INCLUSIVE'
  | 'INTERCULTURAL'
  | 'GENDER_EQUALITY'
  | 'ENVIRONMENTAL'
  | 'COMMON_GOOD'
  | 'EXCELLENCE';

export interface LearningSessionsTable {
  id: Generated<string>;
  user_id: string;
  area_id: string;
  grade_level: GradeLevelEnum;
  sections: string;
  pedagogical_duration: PedagogicalDurationEnum;
  unit_title: string;
  session_title: string;
  learning_purpose: string;
  evidence_description: string;
  cross_cutting_theme: CrossCuttingThemeEnum;
  cross_cutting_values: string;
  has_dua_inclusion: Generated<boolean>;
  materials_and_resources: string[];
  evaluation_declaration: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  institutional_snapshot: Generated<unknown>;
}

export interface InstitutionalSnapshot {
  teacherFullName: string;
  specialty: string;
  schoolName: string;
  ugel: string;
  dre: string;
  principalName: string | null;
  badgeUrl: string | null;
  signatureUrl: string | null;
}

export interface AuthSessionsTable {
  id: string;
  user_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Generated<Date>;
}

export interface GenerationRequestsTable {
  id: string;
  user_id: string;
  idempotency_key: string;
  payload_hash: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  attempt_id: string;
  lease_expires_at: Date;
  session_id: string | null;
  response: unknown;
  error_code: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface SessionCompetenciesTable {
  id: Generated<string>;
  session_id: string;
  competency_id: string;
  performance_id: string;
  precised_performance: string;
  is_primary: Generated<boolean>;
}

export interface SessionMomentsTable {
  id: Generated<string>;
  session_id: string;
  moment_type: DidacticMomentTypeEnum;
  allocated_minutes: number;
  pedagogical_processes: string;
  activities_description: string;
  dua_notes: string | null;
  order_index: number;
}

export interface EvaluationInstrumentsTable {
  id: Generated<string>;
  session_id: string;
  instrument_type: InstrumentTypeEnum;
  evaluated_evidence: string;
  append_table_to_document: Generated<boolean>;
  created_at: Generated<Date>;
}

export interface EvaluationCriteriaTable {
  id: Generated<string>;
  instrument_id: string;
  criterion_number: number;
  description: string;
}

// Actualiza DatabaseSchema en src/infrastructure/database/types.ts:
export interface DatabaseSchema {
  admin_audit_events: AdminAuditEventsTable;
  auth_sessions: AuthSessionsTable;
  generation_requests: GenerationRequestsTable;
  users: UsersTable;
  institutional_profiles: InstitutionalProfilesTable;
  credit_wallets: CreditWalletsTable;
  wallet_transactions: WalletTransactionsTable;
  areas: AreasTable;
  competencies: CompetenciesTable;
  capacities: CapacitiesTable;
  performances: PerformancesTable;
  learning_sessions: LearningSessionsTable;
  session_competencies: SessionCompetenciesTable;
  session_moments: SessionMomentsTable;
  evaluation_instruments: EvaluationInstrumentsTable;
  evaluation_criteria: EvaluationCriteriaTable;
}
