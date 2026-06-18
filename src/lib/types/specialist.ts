export type ConsultationType = 'TELEADVICE' | 'VIRTUAL_CONSULT' | 'FULL_REFERRAL';

export interface SpecialistProfile {
  id: string;
  name: string;
  ava_rcvs_number?: string;
  clinic: string;
  email: string;
  phone?: string;
  specialty: string;
  leader_format_version: string;
  intake_requirements: {
    required_fields: IntakeField[];
    required_documents: string[];
    rejection_message: string;
  };
  virtual_practice: {
    team_emails: string[];
    response_sla_hours: number;
    consultation_type: ConsultationType;
    fee_per_consult: number;
    platform_cut_percent: number;
    stripe_account_id?: string;
  };
  cpd_module_ids: string[];
  created_at: string;
  status: 'ACTIVE' | 'PAUSED' | 'PENDING';
}

export interface IntakeField {
  field: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'date';
  required: boolean;
  unit?: string;
  maxLength?: number;
  options?: string[];
}

export interface SpecialistReferral {
  id: string;
  from_gp: { userId: string; clinic: string; name: string };
  to_specialist: { specialistId: string; clinic: string };
  patient: {
    signalment: Record<string, any>;
    clinical_history: Record<string, any>;
    diagnostics: Record<string, any>;
    attached_documents: string[];
    soap_note: Record<string, any>;
  };
  status: 'PENDING' | 'ACCEPTED' | 'TELEADVICE_COMPLETE' | 'REJECTED_INCOMPLETE' | 'COMPLETED';
  fee: number;
  platform_cut: number;
  specialist_net: number;
  created_at: string;
  responded_at?: string;
  completed_at?: string;
}

export interface ReferralValidationResult {
  blocked: boolean;
  missing_fields: string[];
  missing_documents: string[];
  rejection_message: string;
}
