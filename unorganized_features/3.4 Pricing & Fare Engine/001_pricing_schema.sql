-- migrations/001_pricing_schema.sql
-- Reference schema for the in-memory repositories in src/services/*.
-- Swap each InMemory*Repository for a Postgres-backed implementation
-- using these tables when moving to production.

CREATE TABLE zone_pricing_configs (
    id              VARCHAR(64) PRIMARY KEY,
    county_code     VARCHAR(8) NOT NULL,
    zone_name       VARCHAR(128) NOT NULL,
    vehicle_type    VARCHAR(32) NOT NULL,
    base_fare       NUMERIC(10,2) NOT NULL CHECK (base_fare >= 0),
    per_km_rate     NUMERIC(10,2) NOT NULL CHECK (per_km_rate >= 0),
    per_minute_rate NUMERIC(10,2) NOT NULL CHECK (per_minute_rate >= 0),
    minimum_fare    NUMERIC(10,2) NOT NULL CHECK (minimum_fare >= 0),
    booking_fee     NUMERIC(10,2) NOT NULL CHECK (booking_fee >= 0),
    currency        VARCHAR(3) NOT NULL DEFAULT 'KES',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from  TIMESTAMPTZ NOT NULL,
    effective_to    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_zone_pricing_county_vehicle ON zone_pricing_configs (county_code, vehicle_type, is_active);

CREATE TABLE surge_rules (
    id               VARCHAR(64) PRIMARY KEY,
    zone_id          VARCHAR(64) NOT NULL REFERENCES zone_pricing_configs(id),
    trigger_type     VARCHAR(32) NOT NULL CHECK (trigger_type IN ('time_window','weather','demand_ratio','manual')),
    multiplier       NUMERIC(4,2) NOT NULL CHECK (multiplier >= 1.0),
    days_of_week     SMALLINT[],
    start_time       TIME,
    end_time         TIME,
    weather_condition VARCHAR(32),
    demand_threshold NUMERIC(5,2),
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    priority         INTEGER NOT NULL DEFAULT 0,
    created_by       VARCHAR(64),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_surge_rules_zone_active ON surge_rules (zone_id, is_active, priority DESC);

CREATE TABLE surge_global_config (
    id                     SMALLINT PRIMARY KEY DEFAULT 1,
    max_allowed_multiplier NUMERIC(4,2) NOT NULL DEFAULT 3.0 CHECK (max_allowed_multiplier >= 1.0),
    enabled                BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT single_row CHECK (id = 1)
);

CREATE TABLE promo_codes (
    code                 VARCHAR(32) PRIMARY KEY,
    type                 VARCHAR(32) NOT NULL CHECK (type IN ('percentage','fixed_amount','free_booking_fee')),
    value                NUMERIC(10,2) NOT NULL,
    max_discount_amount  NUMERIC(10,2),
    min_fare_threshold   NUMERIC(10,2),
    county_restrictions  VARCHAR(8)[],
    vehicle_type_restrictions VARCHAR(32)[],
    usage_limit_per_user INTEGER,
    total_usage_limit    INTEGER,
    current_usage_count  INTEGER NOT NULL DEFAULT 0,
    valid_from           TIMESTAMPTZ NOT NULL,
    valid_to             TIMESTAMPTZ NOT NULL,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE promo_code_usages (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(32) NOT NULL REFERENCES promo_codes(code),
    rider_id    VARCHAR(64) NOT NULL,
    trip_id     VARCHAR(64) NOT NULL,
    used_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_promo_usage_code_rider ON promo_code_usages (code, rider_id);

CREATE TABLE referral_credit_balances (
    rider_id VARCHAR(64) PRIMARY KEY,
    balance  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'KES',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cancellation_fee_rules (
    id                          VARCHAR(64) PRIMARY KEY,
    vehicle_type                VARCHAR(32) NOT NULL UNIQUE,
    grace_period_seconds        INTEGER NOT NULL CHECK (grace_period_seconds >= 0),
    driver_en_route_fee         NUMERIC(10,2) NOT NULL CHECK (driver_en_route_fee >= 0),
    driver_arrived_fee          NUMERIC(10,2) NOT NULL CHECK (driver_arrived_fee >= 0),
    rider_no_show_fee           NUMERIC(10,2) NOT NULL CHECK (rider_no_show_fee >= 0),
    waive_fee_if_driver_delayed_seconds INTEGER,
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE fare_negotiations (
    id           VARCHAR(64) PRIMARY KEY,
    estimate_id  VARCHAR(64) NOT NULL,
    trip_id      VARCHAR(64),
    status       VARCHAR(16) NOT NULL CHECK (status IN ('pending','accepted','rejected','expired','countered')),
    final_fare   NUMERIC(10,2),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fare_negotiation_rounds (
    id              BIGSERIAL PRIMARY KEY,
    negotiation_id  VARCHAR(64) NOT NULL REFERENCES fare_negotiations(id),
    round_number    INTEGER NOT NULL,
    actor           VARCHAR(8) NOT NULL CHECK (actor IN ('rider','driver')),
    proposed_fare   NUMERIC(10,2) NOT NULL CHECK (proposed_fare > 0),
    status          VARCHAR(16) NOT NULL CHECK (status IN ('pending','accepted','rejected','expired','countered')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (negotiation_id, round_number)
);

-- Fare estimates persisted for audit / negotiation lookup beyond the in-memory cache.
CREATE TABLE fare_estimates (
    estimate_id      VARCHAR(64) PRIMARY KEY,
    rider_id         VARCHAR(64) NOT NULL,
    zone_id          VARCHAR(64) NOT NULL REFERENCES zone_pricing_configs(id),
    vehicle_type     VARCHAR(32) NOT NULL,
    distance_km      NUMERIC(8,2) NOT NULL,
    duration_minutes NUMERIC(8,2) NOT NULL,
    breakdown_json   JSONB NOT NULL,
    negotiable       BOOLEAN NOT NULL DEFAULT FALSE,
    negotiation_bounds_json JSONB,
    route_polyline   TEXT NOT NULL,
    route_provider   VARCHAR(16) NOT NULL,
    expires_at       TIMESTAMPTZ NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fare_estimates_expires ON fare_estimates (expires_at);
