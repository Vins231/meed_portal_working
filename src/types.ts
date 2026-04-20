export interface User {
  user_id: string;
  name: string;
  email: string;
  password?: string;
  role: 'Admin' | 'Manager' | 'Engineer' | 'Viewer' | 'Agency';
  designation?: string;
  division?: string;
  section?: string;
  intercom?: string;
  mobile?: string;
  status: 'Active' | 'Inactive';
  last_login?: string;
  created_on?: string;
  notes?: string;
  streak?: number;
}

export interface PlanningRecord {
  plan_id: string;
  name_of_work: string;
  division: string;
  section: string;
  priority: string;
  status: string;
  initiation_remarks: string;
  added_by: string;
  added_on: string;
  last_updated: string;
  submitted_on?: string;
}

export interface ApprovalRecord {
  approval_id: string;
  plan_id: string;
  name_of_work: string;
  division: string;
  section: string;
  priority: string;
  estimate_no: string;
  estimated_cost: number;
  work_type: string;
  competent_authority: string;
  prepared_by: string;
  fc_no: string;
  fc_date: string;
  ca_date: string;
  ca_status: string;
  current_stage: string;
  days_in_pipeline: number;
  on_hold_reason: string;
  estimate_document: string;
  added_by: string;
  added_on: string;
  last_updated: string;
}

export interface TenderRecord {
  tender_id: string;
  approval_id: string;
  plan_id: string;
  name_of_work: string;
  division: string;
  section: string;
  estimated_cost: number;
  competent_authority: string;
  tender_no: string;
  tender_type: string;
  procurement_mode: string;
  tender_float_date: string;
  bid_submission_deadline: string;
  bid_end_time?: string;
  bid_opening_date: string;
  bid_opening_time?: string;
  pre_bid_date?: string;
  pre_bid_time?: string;
  emd_amount: number;
  no_of_bids_received: number;
  tc_meeting_date: string;
  tc_qualified_count: number;
  tc_disqualified_count: number;
  tc_recommendation_approval_date: string;
  price_bid_opening_date: string;
  no_of_price_bids_opened: number;
  price_bid_tc_date?: string;
  price_bid_tc_approval_date?: string;
  shortfall_tc_applicable?: string;
  shortfall_tc_date?: string;
  shortfall_tc_approval_date?: string;
  l1_bidder_name: string;
  l1_amount: number;
  l1_percentage: string;
  negotiated_amount: number;
  award_recommendation_date: string;
  award_tc_date?: string;
  award_tc_approval_date?: string;
  ca_award_approval_date: string;
  award_status: string;
  cancellation_reason: string;
  tender_document: string;
  gem_bid_document?: string;
  gem_contract_order: string;
  current_stage: string;
  added_by: string;
  added_on: string;
  last_updated: string;
}

export interface AwardedRecord {
  awarded_id: string;
  tender_id: string;
  approval_id: string;
  plan_id: string;
  name_of_work: string;
  division: string;
  section: string;
  tender_no: string;
  tender_type: string;
  estimated_cost: number;
  l1_amount: number;
  l1_percentage: string;
  competent_authority: string;
  work_order_no: string;
  work_order_date: string;
  contractor_name: string;
  awarded_cost: number;
  awarded_date: string;
  agreement_execution_date: string;
  nda_agreement: string;
  integrity_pact: string;
  completion_period_days: number;
  start_date: string;
  scheduled_completion: string;
  actual_completion: string;
  delay_days: number;
  eot_days: number;
  revised_completion: string;
  delay_reason: string;
  security_deposit: number;
  payment_released: number;
  last_bill_date: string;
  payment_pending: number;
  dlp_end_date: string;
  physical_progress_percent: string;
  overall_status: string;
  completion_status: string;
  ee_proposal_amount: number;
  ee_approval_status: string;
  revised_contract_value: number;
  test_commissioning_status: string;
  as_built_drawing: string;
  handing_over_status: string;
  performance_rating: string;
  work_order_document: string;
  completion_certificate: string;
  added_by: string;
  added_on: string;
  last_updated: string;
  remarks: string;
  // New fields from user request
  loa_no: string;
  loa_date: string;
  agreement_no: string;
  agreement_date: string;
  nit_no: string;
  contact_person: string;
  contractor_mobile: string;
  contractor_address: string;
  negotiated_amount: number;
  extra_amount: number;
  emd_amount: number;
  mobilisation_advance: number;
  advance_recovered: number;
  extension_count: number;
  ee_proposal_no: string;
  ee_proposal_date: string;
  ee_proposal_status: string;
  ee_approval_date: string;
  income_tax_deducted: number;
  gst_tds_deducted: number;
  other_deductions: number;
  total_bills_value: number;
  net_payment_released: number;
  dlp_status: string;
  dlp_remarks: string;
  sd_refund_date: string;
  sd_refund_amount: number;
  pbg_release_date: string;
  pbg_release_letter: string;
  tc_date: string;
  asset_capitalisation: string;
  handing_over_date: string;
  final_bill_amount: number;
  final_bill_date: string;
  final_account_status: string;
  closure_date: string;
  last_site_visit: string;
  ld_applicable: string;
  ld_amount: number;
  is_gem?: boolean;
  gem_contract_no?: string;
  gem_contract_date?: string;
  agreement_status?: string;
  integrity_pact_status?: string;
  integrity_pact_date?: string;
  nda_status?: string;
  nda_date?: string;
}

export interface BGRecord {
  bg_id: string;
  tender_id: string;
  work_order_no: string;
  agency_name: string;
  bank_name: string;
  bg_number: string;
  bg_date: string;
  bg_type: string;
  bg_amount: number;
  expiry_date: string;
  days_remaining: number;
  bg_status: string;
  extended_expiry_date: string;
  claim_expiry_date: string;
  release_date: string;
  remarks: string;
  added_by: string;
  added_on: string;
  last_updated: string;
}

export interface BidderRecord {
  bidder_id: string;
  tender_id: string;
  sr_no: number;
  bidder_name: string;
  technical_status: string;
  disqualification_reason: string;
  price_bid_opened: string;
  bid_amount: number;
  financial_rank: string;
  percentage_vs_estimate: string;
  emd_status: string;
  remarks: string;
  added_by: string;
  added_on: string;
}

export interface ActivityLog {
  log_id: string;
  timestamp: string;
  user_id: string;
  action: string;
  module: string;
  description: string;
  status: string;
}

export interface MasterData {
  id: number;
  name: string;
}

export interface MasterReference {
  id: number;
  abbreviation: string;
  description: string;
}

export interface SectionMaster extends MasterData {
  category: string;
}
