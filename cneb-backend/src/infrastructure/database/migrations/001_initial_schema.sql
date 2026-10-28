CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enumeraciones
CREATE TYPE user_role AS ENUM ('SUPERADMIN', 'TEACHER');
CREATE TYPE subscription_plan AS ENUM ('TRIAL', 'MONTHLY', 'BIMONTHLY', 'TRIMONTHLY', 'ANNUAL', 'LIFETIME_FREE');
CREATE TYPE grade_level AS ENUM ('FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH');
CREATE TYPE pedagogical_duration AS ENUM ('MINUTES_45', 'MINUTES_90', 'MINUTES_135');
CREATE TYPE didactic_moment_type AS ENUM ('START', 'DEVELOPMENT', 'CLOSING');
CREATE TYPE instrument_type AS ENUM ('CHECKLIST', 'RUBRIC', 'SELF_EVALUATION', 'OBSERVATION_GUIDE', 'NONE');
CREATE TYPE cross_cutting_theme AS ENUM (
    'RIGHTS', 'INCLUSIVE', 'INTERCULTURAL', 'GENDER_EQUALITY', 
    'ENVIRONMENTAL', 'COMMON_GOOD', 'EXCELLENCE'
);
CREATE TYPE transaction_type AS ENUM (
    'SUBSCRIPTION_RECHARGE', 'SESSION_EXPORT_DEBIT', 
    'ADMIN_MANUAL_ADJUSTMENT', 'FAILED_REFUND'
);

-- Tablas de Usuario y Billetera
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'TEACHER',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE institutional_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    teacher_full_name VARCHAR(150) NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    school_name VARCHAR(200) NOT NULL,
    ugel VARCHAR(50) NOT NULL,
    dre VARCHAR(100) NOT NULL DEFAULT 'DRELM',
    principal_name VARCHAR(150),
    badge_url TEXT,
    signature_url TEXT,
    is_default BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE credit_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    is_unlimited BOOLEAN NOT NULL DEFAULT FALSE,
    plan_type subscription_plan NOT NULL DEFAULT 'TRIAL',
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES credit_wallets(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    transaction_type transaction_type NOT NULL,
    reference_session_id UUID,
    note VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Catálogo Curricular
CREATE TABLE areas (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    cycle VARCHAR(10) NOT NULL DEFAULT 'VI-VII',
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE competencies (
    id VARCHAR(30) PRIMARY KEY,
    area_id VARCHAR(20) NOT NULL REFERENCES areas(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL
);

CREATE TABLE capacities (
    id VARCHAR(30) PRIMARY KEY,
    competency_id VARCHAR(30) NOT NULL REFERENCES competencies(id),
    title VARCHAR(255) NOT NULL,
    order_index SMALLINT NOT NULL
);

CREATE TABLE performances (
    id VARCHAR(40) PRIMARY KEY,
    competency_id VARCHAR(30) NOT NULL REFERENCES competencies(id),
    grade_level grade_level NOT NULL,
    standard_description TEXT NOT NULL
);

-- Sesiones e Instrumentos
CREATE TABLE learning_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    area_id VARCHAR(20) NOT NULL REFERENCES areas(id),
    grade_level grade_level NOT NULL,
    sections VARCHAR(50) NOT NULL,
    pedagogical_duration pedagogical_duration NOT NULL,
    unit_title VARCHAR(255) NOT NULL,
    session_title VARCHAR(255) NOT NULL,
    learning_purpose TEXT NOT NULL,
    evidence_description TEXT NOT NULL,
    cross_cutting_theme cross_cutting_theme NOT NULL,
    cross_cutting_values TEXT NOT NULL,
    has_dua_inclusion BOOLEAN NOT NULL DEFAULT FALSE,
    materials_and_resources TEXT[] NOT NULL,
    evaluation_declaration TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE session_competencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES learning_sessions(id) ON DELETE CASCADE,
    competency_id VARCHAR(30) NOT NULL REFERENCES competencies(id),
    performance_id VARCHAR(40) NOT NULL REFERENCES performances(id),
    precised_performance TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE session_moments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES learning_sessions(id) ON DELETE CASCADE,
    moment_type didactic_moment_type NOT NULL,
    allocated_minutes SMALLINT NOT NULL,
    pedagogical_processes TEXT NOT NULL,
    activities_description TEXT NOT NULL,
    dua_notes TEXT,
    order_index SMALLINT NOT NULL,
    CONSTRAINT uq_session_moment UNIQUE(session_id, moment_type)
);

CREATE TABLE evaluation_instruments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID UNIQUE NOT NULL REFERENCES learning_sessions(id) ON DELETE CASCADE,
    instrument_type instrument_type NOT NULL,
    evaluated_evidence VARCHAR(255) NOT NULL,
    append_table_to_document BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE evaluation_criteria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instrument_id UUID NOT NULL REFERENCES evaluation_instruments(id) ON DELETE CASCADE,
    criterion_number SMALLINT NOT NULL CHECK (criterion_number BETWEEN 1 AND 5),
    description TEXT NOT NULL,
    CONSTRAINT uq_instrument_criterion UNIQUE(instrument_id, criterion_number)
);