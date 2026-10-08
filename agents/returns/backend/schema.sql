-- Supabase SQL Migration: Returns Manager Agent Schema
-- Run this in your Supabase SQL Editor if you want foreign tables configured in postgres

CREATE TABLE IF NOT EXISTS inspections (
    id TEXT PRIMARY KEY,
    return_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    product_name TEXT,
    sku TEXT,
    serial_number TEXT,
    final_outcome TEXT NOT NULL, -- 'ACCEPT' | 'REJECT' | 'FURTHER_INSPECTION'
    condition_grade TEXT,
    overall_confidence FLOAT,
    is_uncertain BOOLEAN DEFAULT FALSE,
    reason TEXT,
    model_version TEXT,
    processing_time_ms INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    raw_payload JSONB
);

CREATE TABLE IF NOT EXISTS condition_checks (
    id TEXT PRIMARY KEY,
    inspection_id TEXT REFERENCES inspections(id) ON DELETE CASCADE,
    check_name TEXT NOT NULL, -- 'product_match' | 'packaging_integrity' | 'wear_defects' | 'completeness' | 'serial_traceability'
    result TEXT NOT NULL, -- 'PASS' | 'UNCERTAIN' | 'FAIL'
    confidence FLOAT NOT NULL,
    details TEXT,
    evidence JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    inspection_id TEXT,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    outcome TEXT,
    notes TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

CREATE TABLE IF NOT EXISTS evaluation_metrics (
    id TEXT PRIMARY KEY,
    suite_name TEXT NOT NULL,
    total_samples INT NOT NULL,
    accuracy FLOAT NOT NULL,
    false_positives INT NOT NULL,
    false_negatives INT NOT NULL,
    uncertain_count INT NOT NULL,
    uncertain_rate FLOAT NOT NULL,
    avg_latency_ms FLOAT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    summary JSONB
);
