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
import { User, ActivityLog, BGRecord } from '../types';
import ErrorMessage from './ErrorMessage';

import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('meed_user');
    if (savedUser) setUser(JSON.parse(savedUser));
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const dashboardData = await api.getDashboardData();
      setData(dashboardData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load dashboard data");
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
