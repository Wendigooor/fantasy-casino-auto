-- Migration 004: KYC (Know Your Customer) module
-- Required for Phase 6: bonus-kyc

CREATE TABLE IF NOT EXISTS kyc_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected')),
    document_type VARCHAR(50) NOT NULL,
    document_reference VARCHAR(255),
    admin_notes TEXT,
    reviewed_by UUID REFERENCES users(id),
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kyc_user_id ON kyc_verifications(user_id);
CREATE INDEX idx_kyc_status ON kyc_verifications(status);
