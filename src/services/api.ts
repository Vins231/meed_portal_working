import { supabase } from "../lib/supabase";
import { 
  PlanningRecord, 
  AwardedRecord, 
  User, 
  TenderRecord, 
  BidderRecord, 
  ApprovalRecord, 
  BGRecord, 
  ActivityLog,
  MasterData,
  MasterReference,
  SectionMaster
} from "../types";

export const api = {
  // --- MASTER DATA ---
  async getDivisions(): Promise<MasterData[]> {
    const { data, error } = await supabase.from('divisions').select('*').order('name');
    if (error) throw error;
    return data || [];
  },

  async getSections(): Promise<SectionMaster[]> {
    const { data, error } = await supabase.from('sections').select('*').order('name');
    if (error) throw error;
    return data || [];
  },

  async getDesignations(): Promise<MasterData[]> {
    const { data, error } = await supabase.from('designations').select('*').order('name');
    if (error) throw error;
    return data || [];
  },

  async getPriorities(): Promise<MasterData[]> {
    const { data, error } = await supabase.from('priorities').select('*').order('id');
    if (error) throw error;
    return data || [];
  },

  async getRoles(): Promise<MasterData[]> {
    const { data, error } = await supabase.from('roles').select('*').order('id');
    if (error) throw error;
    return data || [];
  },

  async getWorkNatures(): Promise<MasterData[]> {
    const { data, error } = await supabase.from('work_natures').select('*').order('name');
    if (error) throw error;
    return data || [];
  },

  async getMasterReferences(): Promise<MasterReference[]> {
    const { data, error } = await supabase.from('master_references').select('*').order('id');
    if (error) throw error;
    return data || [];
  },

  // --- PLANNING ---
  async getPlanningRecords(): Promise<PlanningRecord[]> {
    const { data, error } = await supabase
      .from('planning')
      .select('*')
      .order('added_on', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createPlanningRecord(record: Partial<PlanningRecord>, user: User): Promise<PlanningRecord> {
    const { data, error } = await supabase
      .from('planning')
      .insert([{
        ...record,
        plan_id: `PLN-${Date.now()}`,
        added_on: new Date().toISOString(),
        last_updated: new Date().toISOString()
      }])
      .select()
      .single();
    if (error) throw error;
    
    await this.logActivity('CREATE', 'PLANNING', data.plan_id, `New work initiation: ${data.name_of_work} by ${user.name}`, user);
    return data;
  },

  async updatePlanningRecord(planId: string, record: Partial<PlanningRecord>, user: User): Promise<void> {
    const { error } = await supabase
      .from('planning')
      .update({ ...record, last_updated: new Date().toISOString() })
      .eq('plan_id', planId);
    if (error) throw error;

    await this.logActivity('UPDATE', 'PLANNING', planId, `Planning record updated by ${user.name}`, user);
  },

  async submitToApproval(plan: PlanningRecord, user: User): Promise<void> {
    // 1. Update planning status
    const { error: updateError } = await supabase
      .from('planning')
      .update({ status: 'Submitted', submitted_on: new Date().toISOString(), last_updated: new Date().toISOString() })
      .eq('plan_id', plan.plan_id);
    if (updateError) throw updateError;
    
    // 2. Add to under_approval
    const { error: insertError } = await supabase
      .from('under_approval')
      .insert([{
        approval_id: `APP-${Date.now()}`,
        plan_id: plan.plan_id,
        name_of_work: plan.name_of_work,
        division: plan.division,
        section: plan.section,
        priority: plan.priority,
        current_stage: 'Estimate Pending',
        ca_status: 'Pending',
        added_by: user.name,
        added_on: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        estimated_cost: 0,
        competent_authority: ''
      }]);
    if (insertError) throw insertError;
    
    await this.logActivity('SUBMIT', 'PLANNING', plan.plan_id, `Work submitted for approval by ${user.name}`, user);
  },

  // --- APPROVAL ---
  async getApprovalRecords(): Promise<ApprovalRecord[]> {
    const { data, error } = await supabase
      .from('under_approval')
      .select('*')
      .order('added_on', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async updateApprovalRecord(approvalId: string, record: Partial<ApprovalRecord>): Promise<void> {
    const { error } = await supabase
      .from('under_approval')
      .update({ ...record, last_updated: new Date().toISOString() })
      .eq('approval_id', approvalId);
    if (error) throw error;
  },

  async moveToTender(approval: ApprovalRecord, user: User): Promise<void> {
    // 1. Update under_approval
    const { error: updateError } = await supabase
      .from('under_approval')
      .update({ current_stage: 'Tendered', last_updated: new Date().toISOString() })
      .eq('approval_id', approval.approval_id);
    if (updateError) throw updateError;

    // 2. Generate Tender No
    const tenderNo = await this.generateTenderNo();

    // 3. Add to tender
    const { error: insertError } = await supabase
      .from('tender')
      .insert([{
        tender_id: `TND-${Date.now()}`,
        approval_id: approval.approval_id,
        plan_id: approval.plan_id,
        name_of_work: approval.name_of_work,
        division: approval.division,
        section: approval.section,
        estimated_cost: Number(approval.estimated_cost) || 0,
        competent_authority: approval.competent_authority || 'Chairman',
        tender_no: tenderNo,
        tender_type: 'Open Tender',
        current_stage: 'Floating',
        added_by: user.name,
        added_on: new Date().toISOString(),
        last_updated: new Date().toISOString()
      }]);
    if (insertError) throw insertError;

    await this.logActivity('TENDER_MOVE', 'APPROVAL', approval.approval_id, `Work moved to Tendering by ${user.name}`, user);
  },

  async generateTenderNo(): Promise<string> {
    const year = new Date().getFullYear();
    const pattern = `MEED-%/${year}`;
    
    const { data, error } = await supabase
      .from('tender')
      .select('tender_no')
      .like('tender_no', pattern);
    
    if (error) throw error;

    let maxSeq = 0;
    const regex = /MEED-(\d+)\//;
    
    if (data && data.length > 0) {
      data.forEach(item => {
        const match = item.tender_no?.match(regex);
        if (match) {
          const seq = parseInt(match[1]);
          if (seq > maxSeq) maxSeq = seq;
        }
      });
    }

    let nextSeq = maxSeq + 1;
    let candidate = `MEED-${String(nextSeq).padStart(3, '0')}/${year}`;

    // Verify uniqueness (extra safety)
    let exists = true;
    while(exists) {
      const { data: existingData } = await supabase
        .from('tender')
        .select('tender_no')
        .eq('tender_no', candidate)
        .maybeSingle();
      
      if (!existingData) {
        exists = false;
      } else {
        nextSeq++;
        candidate = `MEED-${String(nextSeq).padStart(3, '0')}/${year}`;
      }
    }

    return candidate;
  },

  // --- TENDER ---
  async getTenderRecords(): Promise<TenderRecord[]> {
    const { data, error } = await supabase
      .from('tender')
      .select('*')
      .neq('current_stage', 'Deleted')
      .order('added_on', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async updateTenderRecord(tenderId: string, record: Partial<TenderRecord>): Promise<void> {
    const { error } = await supabase
      .from('tender')
      .update({ ...record, last_updated: new Date().toISOString() })
      .eq('tender_id', tenderId);
    if (error) throw error;
  },

  async getBidders(tenderId: string): Promise<BidderRecord[]> {
    const { data, error } = await supabase
      .from('tender_bidders')
      .select('*')
      .eq('tender_id', tenderId)
      .order('sr_no');
    if (error) throw error;
    return data || [];
  },

  async addBidder(bidder: Partial<BidderRecord>, user: User): Promise<void> {
    const { error } = await supabase
      .from('tender_bidders')
      .insert([{ 
        ...bidder, 
        bidder_id: `BID-${Date.now()}`,
        added_by: user.name,
        added_on: new Date().toISOString()
      }]);
    if (error) throw error;
    
    await this.logActivity('ADD_BIDDER', 'TENDER', bidder.tender_id || '', `New bidder ${bidder.bidder_name} added by ${user.name}`, user);
  },

  async uploadTenderFile(file: File, tenderId: string, type: 'tender_document' | 'gem_contract_order'): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${tenderId}_${type}_${Date.now()}.${fileExt}`;
    const filePath = `tender/${tenderId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('meed-documents')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('meed-documents')
      .getPublicUrl(filePath);

    return publicUrl;
  },

  async reRankBidders(tenderId: string, estimatedCost: number): Promise<void> {
    // This logic is complex for SQL, so we do it in JS for now
    const { data: bidders, error: fetchError } = await supabase
      .from('tender_bidders')
      .select('*')
      .eq('tender_id', tenderId)
      .eq('technical_status', 'Qualified');
    
    if (fetchError) throw fetchError;
    
    const sorted = [...(bidders || [])].sort((a, b) => (a.bid_amount || 0) - (b.bid_amount || 0));
    
    for (let i = 0; i < sorted.length; i++) {
      const b = sorted[i];
      const rank = `L${i + 1}`;
      const bidAmount = Number(b.bid_amount) || 0;
      const perc = estimatedCost > 0 ? ((bidAmount - estimatedCost) / estimatedCost * 100).toFixed(2) + '%' : '0%';
      
      await supabase
        .from('tender_bidders')
        .update({ financial_rank: rank, percentage_vs_estimate: perc })
        .eq('bidder_id', b.bidder_id);
    }

    if (sorted.length > 0) {
      const l1 = sorted[0];
      const est = estimatedCost || 1;
      const perc = (((l1.bid_amount || 0) - est) / est * 100).toFixed(2);
      
      await supabase
        .from('tender')
        .update({
          l1_bidder_name: l1.bidder_name,
          l1_amount: l1.bid_amount,
          l1_percentage: `${perc}%`,
          last_updated: new Date().toISOString()
        })
        .eq('tender_id', tenderId);
    }
  },

  async moveToAwarded(tender: TenderRecord, user: User): Promise<void> {
    // 1. Check if already awarded
    const { data: existing } = await supabase
      .from('awarded_works')
      .select('awarded_id')
      .eq('tender_id', tender.tender_id)
      .maybeSingle();
    
    if (existing) return;

    // 2. Update tender
    await supabase
      .from('tender')
      .update({ current_stage: 'Awarded', last_updated: new Date().toISOString() })
      .eq('tender_id', tender.tender_id);
    
    // 3. Add to awarded_works
    const { error: insertError } = await supabase
      .from('awarded_works')
      .insert([{
        awarded_id: `AWD-${Date.now()}`,
        tender_id: tender.tender_id,
        approval_id: tender.approval_id,
        plan_id: tender.plan_id,
        name_of_work: tender.name_of_work,
        division: tender.division,
        section: tender.section,
        tender_no: tender.tender_no,
        tender_type: tender.tender_type,
        estimated_cost: tender.estimated_cost,
        l1_amount: tender.l1_amount,
        l1_percentage: tender.l1_percentage,
        competent_authority: tender.competent_authority,
        contractor_name: tender.l1_bidder_name,
        awarded_cost: tender.negotiated_amount || tender.l1_amount,
        awarded_date: new Date().toISOString().split('T')[0],
        overall_status: 'In Progress',
        physical_progress_percent: '0',
        added_by: user.name,
        added_on: new Date().toISOString(),
        last_updated: new Date().toISOString()
      }]);
    if (insertError) throw insertError;

    await this.logActivity('AWARD', 'TENDER', tender.tender_id, `Tender awarded to ${tender.l1_bidder_name} by ${user.name}`, user);
  },

  // --- AWARDED ---
  async getAwardedRecords(): Promise<AwardedRecord[]> {
    const { data, error } = await supabase
      .from('awarded_works')
      .select('*')
      .order('added_on', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async updateAwardedRecord(awardedId: string, record: Partial<AwardedRecord>): Promise<void> {
    const { error } = await supabase
      .from('awarded_works')
      .update({ ...record, last_updated: new Date().toISOString() })
      .eq('awarded_id', awardedId);
    if (error) throw error;
  },

  // --- BG TRACKER ---
  async getBGRecords(): Promise<BGRecord[]> {
    const { data, error } = await supabase
      .from('bg_tracker')
      .select('*')
      .order('added_on', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createBGRecord(record: Partial<BGRecord>, user: User): Promise<void> {
    const { error } = await supabase
      .from('bg_tracker')
      .insert([{
        ...record,
        bg_id: `BG-${Date.now()}`,
        added_by: user.name,
        added_on: new Date().toISOString(),
        last_updated: new Date().toISOString()
      }]);
    if (error) throw error;
  },

  async updateBGRecord(bgId: string, record: Partial<BGRecord>): Promise<void> {
    const { error } = await supabase
      .from('bg_tracker')
      .update({ ...record, last_updated: new Date().toISOString() })
      .eq('bg_id', bgId);
    if (error) throw error;
  },

  // --- UTILS ---
  async logActivity(action: string, module: string, recordId: string, description: string, user: User): Promise<void> {
    await supabase
      .from('activity_log')
      .insert([{
        log_id: `LOG-${Date.now()}`,
        action,
        module,
        description,
        record_id: recordId,
        user_id: user.user_id,
        user_name: user.name,
        user_email: user.email,
        timestamp: new Date().toISOString(),
        status: 'Success'
      }]);
  },

  async getDashboardData() {
    try {
      const [
        { data: awarded, error: awardedErr },
        { data: planning, error: planningErr },
        { data: approval, error: approvalErr },
        { data: tender, error: tenderErr },
        { data: bg, error: bgErr },
        { data: logs, error: logsErr }
      ] = await Promise.all([
        supabase.from('awarded_works').select('*'),
        supabase.from('planning').select('*'),
        supabase.from('under_approval').select('*'),
        supabase.from('tender').select('*'),
        supabase.from('bg_tracker').select('*'),
        supabase.from('activity_log').select('*').order('timestamp', { ascending: false }).limit(6)
      ]);

      if (awardedErr) console.error('Awarded fetch error:', awardedErr);
      if (planningErr) console.error('Planning fetch error:', planningErr);
      if (approvalErr) console.error('Approval fetch error:', approvalErr);
      if (tenderErr) console.error('Tender fetch error:', tenderErr);
      if (bgErr) console.error('BG fetch error:', bgErr);
      if (logsErr) console.error('Logs fetch error:', logsErr);

      const awardedActive = (awarded || []).filter((r: any) => r.overall_status !== 'Completed');
      const delayed = awardedActive.filter((r: any) => (Number(r.delay_days) || 0) > 0);
      
      const totalAwarded = awardedActive.reduce((sum: number, r: any) => sum + (Number(r.awarded_cost) || 0), 0);
      const totalReleased = (awarded || []).reduce((sum: number, r: any) => sum + (Number(r.payment_released) || 0), 0);
      const totalPending = awardedActive.reduce((sum: number, r: any) => sum + (Number(r.payment_pending) || 0), 0);

      // 1. BG Alerts
      const bgAlertsCount = (bg || []).filter((b: any) => b.bg_status !== 'Released' && Number(b.days_remaining) <= 30).length;
      const bgAlertsList = (bg || [])
        .filter((b: any) => b.bg_status !== 'Released' && Number(b.days_remaining) <= 30)
        .sort((a, b) => (Number(a.days_remaining) || 0) - (Number(b.days_remaining) || 0))
        .slice(0, 5);

      const bgActions = bgAlertsList.map(b => ({
        id: b.bg_id,
        type: 'bg',
        priority: Number(b.days_remaining) <= 7 ? 'critical' : 'warning',
        label: 'BG Expiring: ' + b.bg_number,
        sublabel: (b.days_remaining || 0) + ' days remaining'
      }));

      // 2. Delayed works
      const delayActions = awardedActive
        .filter((w: any) => (Number(w.delay_days) || 0) > 0)
        .sort((a, b) => (Number(b.delay_days) || 0) - (Number(a.delay_days) || 0))
        .slice(0, 5)
        .map(w => ({
          id: w.awarded_id,
          type: 'delay',
          priority: Number(w.delay_days) > 30 ? 'critical' : 'warning',
          label: 'Delayed: ' + (w.name_of_work?.substring(0, 35) || 'Unnamed Work'),
          sublabel: (w.delay_days || 0) + ' days behind'
        }));

      // 3. Approval items
      const approvalActions = (approval || [])
        .filter((a: any) => Number(a.days_in_pipeline) > 30 && !['Dropped', 'Tendered'].includes(a.current_stage))
        .sort((a, b) => (Number(b.days_in_pipeline) || 0) - (Number(a.days_in_pipeline) || 0))
        .slice(0, 5)
        .map(a => ({
          id: a.approval_id,
          type: 'approval',
          priority: 'warning',
          label: 'Approval Pending: ' + (a.name_of_work?.substring(0, 35) || 'Unnamed Work'),
          sublabel: (a.days_in_pipeline || 0) + ' days in pipeline'
        }));

      const allActions = [...bgActions, ...delayActions, ...approvalActions]
        .sort((a, b) => (a.priority === 'critical' ? -1 : 1))
        .slice(0, 5);

      return {
        planningCount: (planning || []).filter((p: any) => p.status !== 'Submitted').length,
        approvalCount: (approval || []).filter((a: any) => !['Dropped', 'Tendered'].includes(a.current_stage)).length,
        tenderCount: (tender || []).filter((t: any) => !['Awarded', 'Cancelled'].includes(t.current_stage)).length,
        awardedActive: awardedActive.length,
        delayed: delayed.length,
        completed: (awarded || []).filter((r: any) => r.overall_status === 'Completed').length,
        totalAwarded,
        totalReleased,
        totalPending,
        bgAlerts: bgAlertsCount,
        bgAlertsList: bgAlertsList,
        recentActivity: logs || [],
        pendingActions: allActions
      };
    } catch (error) {
      console.error('getDashboardData unexpected error:', error);
      throw error;
    }
  },

  async login(email: string, password?: string): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .eq('status', 'Active')
      .single();
    
    if (error || !data) {
      throw new Error('Invalid credentials or inactive account');
    }

    const now = new Date();
    let newStreak = data.streak || 0;

    if (!data.last_login) {
      newStreak = 1;
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const lastLoginDate = new Date(data.last_login);
      lastLoginDate.setHours(0, 0, 0, 0);
      
      const diffTime = today.getTime() - lastLoginDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        newStreak += 1;
      } else if (diffDays > 1) {
        newStreak = 1;
      }
      // if diffDays === 0, streak stays same
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        last_login: now.toISOString(),
        streak: newStreak
      })
      .eq('user_id', data.user_id);

    if (updateError) console.error("Failed to update login stats", updateError);

    return { ...data, last_login: now.toISOString(), streak: newStreak };
  },

  async getUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async testConnection() {
    const { data, error } = await supabase.from('divisions').select('count', { count: 'exact', head: true });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Supabase Connected" };
  }
};
