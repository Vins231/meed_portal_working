import { useState, useEffect } from 'react';
import { 
  Handshake, AlertTriangle, Hourglass, 
  ShieldCheck, CheckCircle2, IndianRupee,
  Lightbulb, FileSignature, FileText, 
  ArrowRight, Clock, Bell, RefreshCw,
  Calendar, CheckSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { api } from '../services/api';
import { supabase } from '../lib/supabase';
import { User, ActivityLog, BGRecord } from '../types';
import ErrorMessage from './ErrorMessage';

import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [completionData, setCompletionData] = useState<{
    approval: { total: number; avgCompletion: number; missing: string[] };
    tender: { total: number; avgCompletion: number; missing: string[] };
    awarded: { total: number; avgCompletion: number; missing: string[] };
  } | null>(null);
  const [completionLoading, setCompletionLoading] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('meed_user');
    if (savedUser) setUser(JSON.parse(savedUser));
    fetchData();
    fetchCompletionData();
  }, []);

  const fetchCompletionData = async () => {
    setCompletionLoading(true);
    try {
      // ── UNDER APPROVAL ──
      const { data: approvals } = await supabase
        .from('under_approval')
        .select('*')
        .not('current_stage', 'in', ['Tendered', 'Dropped']);

      const approvalScores = (approvals || []).map(r => {
        let score = 0;
        const missing: string[] = [];
        if (r.estimate_no) score += 20; 
        else missing.push('Estimate No');
        if (r.estimated_cost && Number(r.estimated_cost) > 0) score += 20; 
        else missing.push('Estimated Cost');
        if (r.work_type) score += 10; 
        else missing.push('Work Type');
        if (r.fc_no && r.fc_date) score += 20; 
        else missing.push('Finance Concurrence');
        if (r.ca_date) score += 20; 
        else missing.push('CA Approval Date');
        if (r.estimate_document) score += 10; 
        else missing.push('Estimate Document');
        return { score, missing };
      });

      const approvalAvg = approvalScores.length > 0
        ? Math.round(approvalScores.reduce((a, b) => a + b.score, 0) / approvalScores.length)
        : 0;

      const approvalMissingCount: Record<string, number> = {};
      approvalScores.forEach(r => r.missing.forEach(m => {
        approvalMissingCount[m] = (approvalMissingCount[m] || 0) + 1;
      }));
      const approvalTopMissing = Object.entries(approvalMissingCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([field, count]) => `${field} (${count} records)`);

      // ── TENDER ──
      const { data: tenders } = await supabase
        .from('tender')
        .select('*')
        .not('current_stage', 'in', ['Awarded', 'Cancelled']);

      const tenderScores = (tenders || []).map(r => {
        let score = 0;
        const missing: string[] = [];
        if (r.tender_float_date) score += 15; 
        else missing.push('Publish Date');
        if (r.bid_submission_deadline) score += 10; 
        else missing.push('Bid Deadline');
        if (r.bid_opening_date) score += 5; 
        else missing.push('Bid Opening Date');
        if (r.estimated_cost && Number(r.estimated_cost) > 0) score += 10; 
        else missing.push('Estimated Cost');
        if (r.tender_document) score += 5; 
        else missing.push('NIT Document');
        if (r.no_of_bids_received && Number(r.no_of_bids_received) > 0) score += 15; 
        else missing.push('Bids Received Count');
        if (r.price_bid_tc_date) score += 10; 
        else missing.push('TC for Price Bid');
        if (r.l1_bidder_name) score += 15; 
        else missing.push('L1 Bidder');
        if (r.award_tc_date) score += 10; 
        else missing.push('TC for Award');
        if (r.award_status && r.award_status !== 'Pending') score += 5; 
        else missing.push('Award Decision');
        return { score, missing };
      });

      const tenderAvg = tenderScores.length > 0
        ? Math.round(tenderScores.reduce((a, b) => a + b.score, 0) / tenderScores.length)
        : 0;

      const tenderMissingCount: Record<string, number> = {};
      tenderScores.forEach(r => r.missing.forEach(m => {
        tenderMissingCount[m] = (tenderMissingCount[m] || 0) + 1;
      }));
      const tenderTopMissing = Object.entries(tenderMissingCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([field, count]) => `${field} (${count} records)`);

      // ── AWARDED WORKS ──
      const { data: awarded } = await supabase
        .from('awarded_works')
        .select('*')
        .neq('overall_status', 'Completed');

      const awardedScores = (awarded || []).map(r => {
        let score = 0;
        const missing: string[] = [];
        if (r.work_order_no || r.gem_contract_no) score += 15; 
        else missing.push('Work Order / Contract');
        if (r.work_order_date || r.gem_contract_date) score += 10; 
        else missing.push('WO / Contract Date');
        if (r.contractor_name) score += 5; 
        else missing.push('Contractor Name');
        if (r.start_date) score += 10; 
        else missing.push('Start Date');
        if (r.completion_period_days) score += 5; 
        else missing.push('Contract Period');
        if (Number(r.physical_progress_percent) > 0) score += 20; 
        else missing.push('Progress %');
        if (r.total_bills_value) score += 15; 
        else missing.push('Bills Submitted');
        if (r.dlp_end_date) score += 10; 
        else missing.push('DLP End Date');
        if (r.scheduled_completion) score += 10; 
        else missing.push('Scheduled Completion');
        return { score, missing };
      });

      const awardedAvg = awardedScores.length > 0
        ? Math.round(awardedScores.reduce((a, b) => a + b.score, 0) / awardedScores.length)
        : 0;

      const awardedMissingCount: Record<string, number> = {};
      awardedScores.forEach(r => r.missing.forEach(m => {
        awardedMissingCount[m] = (awardedMissingCount[m] || 0) + 1;
      }));
      const awardedTopMissing = Object.entries(awardedMissingCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([field, count]) => `${field} (${count} records)`);

      setCompletionData({
        approval: {
          total: approvals?.length || 0,
          avgCompletion: approvalAvg,
          missing: approvalTopMissing
        },
        tender: {
          total: tenders?.length || 0,
          avgCompletion: tenderAvg,
          missing: tenderTopMissing
        },
        awarded: {
          total: awarded?.length || 0,
          avgCompletion: awardedAvg,
          missing: awardedTopMissing
        }
      });
    } catch (err) {
      console.error('Completion fetch failed:', err);
    } finally {
      setCompletionLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const dashboardData = await api.getDashboardData();
      if (!dashboardData) {
        throw new Error("Dashboard data received was empty");
      }
      setData(dashboardData);
    } catch (err: any) {
      console.error("Dashboard Load Error:", err);
      // More descriptive error for common Supabase failures
      if (err.message?.includes('JWT')) {
        setError("Your session has expired. Please log in again.");
      } else if (err.message?.includes('fetch')) {
        setError("Network error. Please check your internet connection.");
      } else {
        setError(err.message || "Failed to load dashboard data");
      }
    } finally {
      setLoading(false);
    }
  };

  const fmtCurrency = (n: number) => {
    if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr';
    if (n >= 100000) return '₹' + (n / 100000).toFixed(2) + ' L';
    return '₹' + n.toLocaleString('en-IN');
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
      <div className="w-10 h-10 border-4 border-slate-100 border-t-[var(--teal)] rounded-full animate-spin" />
      <p className="text-xs font-bold uppercase tracking-widest">Initializing Dashboard...</p>
    </div>
  );

  if (error) return <ErrorMessage error={error} onRetry={fetchData} />;
  if (!data) return <div className="p-10 text-center text-rose-500">Error loading data</div>;

  return (
    <div className="space-y-8 animate-[fadeUp_0.4s_ease-out]">
      {/* Daily Digest */}
      <div className="bg-gradient-to-br from-[var(--navy)] to-[var(--navy2)] rounded-[24px] p-8 relative overflow-hidden shadow-xl border border-white/5">
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="font-display text-3xl font-bold text-white mb-2">
                {getGreeting()}, {user?.name?.split(' ')[0] || 'Officer'}!
              </h2>
              <div className="flex items-center gap-3 text-white/50 text-sm font-medium">
                <div className="flex items-center gap-1.5">
                  <Calendar size={14} />
                  {format(new Date(), 'EEEE, d MMMM yyyy')}
                </div>
                <span className="opacity-30">|</span>
                <div className="flex items-center gap-1.5">
                  <Clock size={14} />
                  {format(new Date(), 'hh:mm a')}
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3">
              {data.pendingActions.map((action: any) => (
                <div 
                  key={action.id}
                  onClick={() => {
                    if (action.type === 'bg') navigate('/bg');
                    else if (action.type === 'delay') navigate('/awarded');
                    else if (action.type === 'approval') navigate('/approval');
                  }}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 rounded-xl text-xs transition-all cursor-pointer hover:scale-105 active:scale-95 border",
                    action.priority === 'critical' 
                      ? "bg-rose-500/10 text-rose-400 border-rose-500/20" 
                      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  )}
                >
                  <AlertTriangle size={14} className={action.priority === 'critical' ? "animate-pulse" : ""} />
                  <div className="flex flex-col">
                    <span className="font-bold leading-tight">{action.label}</span>
                    <span className="text-[10px] opacity-70 font-medium">{action.sublabel}</span>
                  </div>
                </div>
              ))}
              {data.pendingActions.length === 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold">
                  <CheckSquare size={14} />
                  All actions completed
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Animated Background Element */}
        <div className="absolute bottom-0 left-0 right-0 h-32 overflow-hidden opacity-[0.05] pointer-events-none">
          <svg className="w-[200%] h-full animate-[wave_12s_linear_infinite]" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M0,60 C150,100 350,0 600,60 C850,120 1050,20 1200,60 L1200,120 L0,120 Z" fill="white" />
          </svg>
        </div>
      </div>

      {/* Pipeline Strip */}
      <div className="bg-white rounded-[20px] p-6 border border-[var(--border)] shadow-sm flex items-center justify-between overflow-x-auto scrollbar-hide gap-4">
        <PipelineNode icon={Lightbulb} label="Planning" count={data.planningCount} active />
        <PipelineLine active />
        <PipelineNode icon={FileSignature} label="Approval" count={data.approvalCount} active />
        <PipelineLine active />
        <PipelineNode icon={FileText} label="Tender" count={data.tenderCount} active />
        <PipelineLine active />
        <PipelineNode icon={Handshake} label="Awarded" count={data.awardedActive} alert={data.delayed > 0} active />
        <PipelineLine active={data.completed > 0} />
        <PipelineNode icon={CheckCircle2} label="Completed" count={data.completed} active={data.completed > 0} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard 
          color="teal" 
          icon={Handshake} 
          value={data.awardedActive} 
          label="Works In Progress" 
          sub={`Total Value: ${fmtCurrency(data.totalAwarded)}`} 
        />
        <StatCard 
          color="rose" 
          icon={AlertTriangle} 
          value={data.delayed} 
          label="Delayed Works" 
          sub="Requires immediate review" 
        />
        <StatCard 
          color="amber" 
          icon={Hourglass} 
          value={data.approvalCount} 
          label="Pending Approvals" 
          sub="Awaiting administrative sanction" 
        />
        <StatCard 
          color="sky" 
          icon={ShieldCheck} 
          value={data.bgAlerts} 
          label="BG Alerts" 
          sub="Expiring within 30 days" 
          onClick={() => navigate('/bg')}
        />
        <StatCard 
          color="green" 
          icon={CheckCircle2} 
          value={data.completed} 
          label="Completed Works" 
          sub="Successfully handed over" 
        />
        <StatCard 
          color="purple" 
          icon={IndianRupee} 
          value={fmtCurrency(data.totalReleased).replace('₹', '')} 
          label="Payments Released" 
          sub={`Pending: ${fmtCurrency(data.totalPending)}`} 
        />
      </div>

      {/* Record Completion Status */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-[var(--navy)] flex items-center gap-2">
            <CheckSquare size={20} className="text-[var(--teal)]" />
            Record Completion Status
          </h3>
          <p className="text-[11px] text-slate-400 font-medium">
            Shows what information is missing across active records
          </p>
        </div>

        {completionLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-[20px] p-6 border border-slate-100 shadow-sm animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-2/3 mb-4" />
                <div className="h-8 bg-slate-100 rounded w-1/3 mb-4" />
                <div className="h-2 bg-slate-100 rounded w-full mb-6" />
                <div className="space-y-2">
                  <div className="h-3 bg-slate-100 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-2/3" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : completionData ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <CompletionCard
              title="Under Approval"
              total={completionData.approval.total}
              avgCompletion={completionData.approval.avgCompletion}
              missing={completionData.approval.missing}
              color="purple"
              onClick={() => navigate('/approval')}
            />
            <CompletionCard
              title="Tender"
              total={completionData.tender.total}
              avgCompletion={completionData.tender.avgCompletion}
              missing={completionData.tender.missing}
              color="sky"
              onClick={() => navigate('/tender')}
            />
            <CompletionCard
              title="Awarded Works"
              total={completionData.awarded.total}
              avgCompletion={completionData.awarded.avgCompletion}
              missing={completionData.awarded.missing}
              color="teal"
              onClick={() => navigate('/awarded')}
            />
          </div>
        ) : null}
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* BG Expiry Alerts */}
        <div className="bg-white rounded-[20px] p-6 border border-[var(--border)] shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display text-lg font-bold text-[var(--navy)] flex items-center gap-2">
              <ShieldCheck size={20} className="text-[var(--teal)]" />
              BG Expiry Alerts
            </h3>
            <span className="px-2.5 py-1 bg-rose-50 text-rose-600 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-rose-100">
              {data.bgAlerts} Critical
            </span>
          </div>
          
          <div className="space-y-3 flex-1">
            {data.bgAlertsList.length > 0 ? data.bgAlertsList.map((bg: BGRecord) => (
              <div key={bg.bg_id} className="group flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-slate-50/30 hover:bg-white hover:border-[var(--teal)] hover:shadow-md transition-all cursor-pointer">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                  bg.days_remaining <= 7 ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
                )}>
                  <AlertTriangle size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-[var(--navy)] truncate">BG No. {bg.bg_number}</h4>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{bg.work_order_no || 'Work Order Not Specified'}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn(
                    "text-sm font-extrabold",
                    bg.days_remaining <= 7 ? "text-rose-600" : "text-amber-600"
                  )}>
                    {bg.days_remaining} Days
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Left</div>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-300 gap-3">
                <ShieldCheck size={40} className="opacity-20" />
                <p className="text-sm font-medium">No imminent BG expiries</p>
              </div>
            )}
          </div>
          
          <button 
            onClick={() => navigate('/bg')}
            className="mt-6 w-full py-3 text-xs font-bold text-slate-400 hover:text-[var(--teal)] transition-colors uppercase tracking-[0.2em]"
          >
            View All Guarantees
          </button>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-[20px] p-6 border border-[var(--border)] shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display text-lg font-bold text-[var(--navy)] flex items-center gap-2">
              <RefreshCw size={20} className="text-[var(--teal)]" />
              Recent Activity
            </h3>
            <button className="text-[10px] font-bold text-slate-400 hover:text-[var(--navy)] uppercase tracking-widest transition-colors">
              View Log
            </button>
          </div>

          <div className="space-y-6 flex-1 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-px before:bg-slate-100">
            {data.recentActivity.length > 0 ? data.recentActivity.map((log: ActivityLog, idx: number) => (
              <div key={log.log_id || idx} className="relative flex gap-4 pl-10 group">
                <div className="absolute left-0 top-1 w-10 h-10 rounded-full bg-white border-2 border-slate-50 flex items-center justify-center z-10 group-hover:border-[var(--teal)] transition-colors shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-[var(--teal)] transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-[var(--navy)] truncate">{log.action}</h4>
                    <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                      {log.timestamp ? format(new Date(log.timestamp), 'HH:mm') : 'Just now'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {log.description}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                    By {log.user_id || 'System'}
                  </p>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-300 gap-3">
                <RefreshCw size={40} className="opacity-20" />
                <p className="text-sm font-medium">No recent activity recorded</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompletionCard({ 
  title, total, avgCompletion, missing, color, onClick 
}: {
  title: string;
  total: number;
  avgCompletion: number;
  missing: string[];
  color: string;
  onClick: () => void;
}) {
  const barColor = avgCompletion >= 80 
    ? '#00C9A7' 
    : avgCompletion >= 40 
    ? '#F5A623' 
    : '#E8445A';

  const bgColors: Record<string, string> = {
    purple: 'bg-purple-50 border-purple-100 text-purple-700',
    sky: 'bg-sky-50 border-sky-100 text-sky-700',
    teal: 'bg-teal-50 border-teal-100 text-teal-700',
  };

  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-[20px] p-6 border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-bold text-[var(--navy)]">{title}</h4>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
            {total} active records
          </p>
        </div>
        <div className={cn(
          "px-3 py-1.5 rounded-xl text-[11px] font-bold border",
          bgColors[color]
        )}>
          {avgCompletion}% avg
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Average Completion
          </span>
          <span className="text-[11px] font-bold" style={{ color: barColor }}>
            {avgCompletion >= 80 ? 'Good' : avgCompletion >= 40 ? 'Needs Attention' : 'Incomplete'}
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${avgCompletion}%`, backgroundColor: barColor }}
          />
        </div>
      </div>

      {/* Missing Fields */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
          Most Common Missing Fields
        </p>
        {missing.length > 0 ? missing.map((field, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
            <span className="text-[11px] text-slate-500 font-medium leading-tight">
              {field}
            </span>
          </div>
        )) : (
          <div className="flex items-center gap-2 text-teal-600">
            <CheckCircle2 size={14} />
            <span className="text-[11px] font-bold">All records complete</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
          Click to open module
        </span>
        <ArrowRight size={14} className="text-slate-300 group-hover:text-[var(--teal)] group-hover:translate-x-1 transition-all" />
      </div>
    </div>
  );
}

function PipelineNode({ icon: Icon, label, count, active, alert }: any) {
  return (
    <div className="flex flex-col items-center gap-3 min-w-[100px] group cursor-pointer">
      <div className={cn(
        "w-14 h-14 rounded-full grid place-items-center text-xl border-2 transition-all relative",
        active ? "border-[var(--teal)] bg-[var(--teal)]/10 text-[var(--teal)] shadow-[0_0_20px_rgba(0,201,167,0.2)] animate-[glow_3s_ease_infinite]" : "border-slate-100 bg-slate-50 text-slate-300",
        alert && "border-rose-500 bg-rose-50 text-rose-500 animate-[dotPulse_2s_ease_infinite]"
      )}>
        <Icon size={20} />
        {count > 0 && (
          <div className={cn(
            "absolute -top-1 -right-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-extrabold",
            active ? "bg-[var(--teal)] text-white" : "bg-slate-300 text-white"
          )}>
            {count}
          </div>
        )}
      </div>
      <div className={cn(
        "text-[11px] font-bold uppercase tracking-widest transition-colors",
        active ? "text-[var(--navy)]" : "text-slate-300"
      )}>
        {label}
      </div>
    </div>
  );
}

function PipelineLine({ active }: { active?: boolean }) {
  return (
    <div className="flex-1 min-w-[20px] h-0.5 bg-slate-100 relative -top-5">
      {active && <div className="absolute inset-0 bg-gradient-to-r from-[var(--teal)] to-[var(--teal3)] animate-[shimmer_2s_infinite]" />}
    </div>
  );
}

function StatCard({ color, icon: Icon, value, label, sub }: any) {
  const colors: any = {
    teal: "text-[var(--teal)] bg-[var(--teal)]/10 border-[var(--teal)]/20",
    amber: "text-[var(--amber)] bg-[var(--amber)]/10 border-[var(--amber)]/20",
    rose: "text-[var(--rose)] bg-[var(--rose)]/10 border-[var(--rose)]/20",
    sky: "text-[var(--sky)] bg-[var(--sky)]/10 border-[var(--sky)]/20",
    green: "text-[var(--green)] bg-[var(--green)]/10 border-[var(--green)]/20",
    purple: "text-[var(--purple)] bg-[var(--purple)]/10 border-[var(--purple)]/20",
  };

  return (
    <div className="bg-white rounded-[20px] p-6 border border-slate-100 shadow-sm flex items-start gap-5 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl hover:border-slate-200 animate-[breathe_5s_ease-in-out_infinite] group relative overflow-hidden">
      <div className={cn("w-14 h-14 rounded-2xl grid place-items-center shrink-0 border transition-transform group-hover:scale-110 group-hover:rotate-3", colors[color])}>
        <Icon size={24} />
      </div>
      <div className="flex-1 min-w-0 relative z-10">
        <div className="font-display text-[32px] font-extrabold text-[var(--navy)] leading-none mb-2">{value}</div>
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</div>
        <div className="text-[10px] font-medium text-slate-400 truncate">{sub}</div>
      </div>
      
      {/* Decorative background shape */}
      <div className={cn(
        "absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-[0.03] group-hover:opacity-[0.06] transition-opacity",
        colors[color].split(' ')[1]
      )} />
    </div>
  );
}
