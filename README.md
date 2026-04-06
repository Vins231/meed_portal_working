# MbPA MEED Portal - Supabase Setup

This application has been migrated from Google Sheets to **Supabase** for better performance and reliability.

## Setup Instructions

### 1. Create a Supabase Project
1. Go to [Supabase](https://supabase.com/) and create a new project.
2. Once the project is ready, go to **Project Settings > API**.
3. Copy the **Project URL** and **anon public key**.

### 2. Configure Secrets in AI Studio
In the AI Studio **Settings > Secrets** panel, add the following:
- `VITE_SUPABASE_URL`: Your Supabase Project URL.
- `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key.

### 3. Initialize Database Tables
Go to the **SQL Editor** in your Supabase dashboard and run the following SQL to create the necessary tables. **Note: We recommend using lowercase for all table and column names to ensure maximum compatibility with PostgreSQL's default behavior.**

```sql
-- 1. Users Table
CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  password TEXT,
  role TEXT,
  designation TEXT,
  division TEXT,
  section TEXT,
  intercom TEXT,
  mobile TEXT,
  status TEXT DEFAULT 'Active',
  last_login TIMESTAMP WITH TIME ZONE,
  created_on TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  streak INTEGER DEFAULT 0
);

-- 2. Planning Table
CREATE TABLE planning (
  plan_id TEXT PRIMARY KEY,
  name_of_work TEXT NOT NULL,
  division TEXT,
  section TEXT,
  priority TEXT,
  status TEXT DEFAULT 'Planning',
  initiation_remarks TEXT,
  added_by TEXT REFERENCES users(user_id),
  added_on TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_on TIMESTAMP WITH TIME ZONE
);

-- 3. Under Approval Table
CREATE TABLE under_approval (
  approval_id TEXT PRIMARY KEY,
  plan_id TEXT REFERENCES planning(plan_id),
  name_of_work TEXT,
  division TEXT,
  section TEXT,
  priority TEXT,
  estimate_no TEXT,
  estimated_cost NUMERIC,
  work_type TEXT,
  competent_authority TEXT,
  prepared_by TEXT REFERENCES users(user_id),
  fc_no TEXT,
  fc_date DATE,
  ca_date DATE,
  ca_status TEXT,
  current_stage TEXT,
  days_in_pipeline INTEGER,
  on_hold_reason TEXT,
  estimate_document TEXT,
  added_by TEXT REFERENCES users(user_id),
  added_on TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tender Table
CREATE TABLE tender (
  tender_id TEXT PRIMARY KEY,
  approval_id TEXT REFERENCES under_approval(approval_id),
  plan_id TEXT REFERENCES planning(plan_id),
  name_of_work TEXT,
  division TEXT,
  section TEXT,
  estimated_cost NUMERIC,
  competent_authority TEXT,
  tender_no TEXT,
  tender_type TEXT,
  procurement_mode TEXT,
  tender_float_date DATE,
  bid_submission_deadline TIMESTAMP WITH TIME ZONE,
  emd_amount NUMERIC,
  bid_opening_date TIMESTAMP WITH TIME ZONE,
  no_of_bids_received INTEGER DEFAULT 0,
  tc_meeting_date DATE,
  tc_qualified_count INTEGER,
  tc_disqualified_count INTEGER,
  tc_recommendation_approval_date DATE,
  price_bid_opening_date DATE,
  no_of_price_bids_opened INTEGER,
  l1_bidder_name TEXT,
  l1_amount NUMERIC,
  l1_percentage NUMERIC,
  negotiated_amount NUMERIC,
  award_recommendation_date DATE,
  ca_award_approval_date DATE,
  award_status TEXT,
  cancellation_reason TEXT,
  tender_document TEXT,
  gem_contract_order TEXT,
  current_stage TEXT,
  added_by TEXT REFERENCES users(user_id),
  added_on TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Awarded Works Table
CREATE TABLE awarded_works (
  awarded_id TEXT PRIMARY KEY,
  tender_id TEXT REFERENCES tender(tender_id),
  approval_id TEXT REFERENCES under_approval(approval_id),
  plan_id TEXT REFERENCES planning(plan_id),
  name_of_work TEXT,
  division TEXT,
  section TEXT,
  tender_no TEXT,
  tender_type TEXT,
  estimated_cost NUMERIC,
  l1_amount NUMERIC,
  l1_percentage NUMERIC,
  competent_authority TEXT,
  work_order_no TEXT,
  work_order_date DATE,
  contractor_name TEXT,
  awarded_cost NUMERIC,
  awarded_date DATE,
  agreement_execution_date DATE,
  nda_agreement BOOLEAN DEFAULT FALSE,
  integrity_pact BOOLEAN DEFAULT FALSE,
  completion_period_days INTEGER,
  start_date DATE,
  scheduled_completion DATE,
  actual_completion DATE,
  delay_days INTEGER,
  eot_days INTEGER,
  revised_completion DATE,
  delay_reason TEXT,
  security_deposit NUMERIC,
  payment_released NUMERIC DEFAULT 0,
  last_bill_date DATE,
  payment_pending NUMERIC,
  dlp_end_date DATE,
  physical_progress_percent NUMERIC DEFAULT 0,
  overall_status TEXT,
  completion_status TEXT,
  ee_proposal_amount NUMERIC,
  ee_approval_status TEXT,
  revised_contract_value NUMERIC,
  test_commissioning_status TEXT,
  as_built_drawing TEXT,
  handing_over_status TEXT,
  performance_rating NUMERIC,
  work_order_document TEXT,
  completion_certificate TEXT,
  added_by TEXT REFERENCES users(user_id),
  added_on TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  remarks TEXT
);

-- 6. BG Tracker Table
CREATE TABLE bg_tracker (
  bg_id TEXT PRIMARY KEY,
  awarded_id TEXT REFERENCES awarded_works(awarded_id),
  bg_no TEXT,
  bg_date DATE,
  bank_name TEXT,
  bg_amount NUMERIC,
  valid_upto DATE,
  bg_status TEXT,
  extension_date DATE,
  extended_valid_upto DATE,
  release_date DATE,
  remarks TEXT,
  added_by TEXT REFERENCES users(user_id),
  added_on TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Logs Table
CREATE TABLE logs (
  log_id TEXT PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id TEXT REFERENCES users(user_id),
  action TEXT,
  module TEXT,
  description TEXT,
  status TEXT
);
```

### 4. Import Data
You can export your Google Sheets as CSV files and use the **Import** feature in the Supabase Table Editor to populate your new tables.
