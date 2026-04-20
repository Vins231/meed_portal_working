import { useEffect, useState, useMemo } from 'react';
import { 
  X, AlertCircle, AlertTriangle, Info, ArrowRight, 
  Loader2, Bell, Shield, Clock, Calendar, Hourglass,
  RefreshCcw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

interface Notification {
  id: string;
  type: 'bg_expired' | 'bg_critical' | 'bg_warning' |
    'delay_critical' | 'delay_warning' | 'bid_deadline_critical' |
    'bid_deadline_warning' | 'approval_overdue' | 
    'dlp_ending' | 'work_completed';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  module: string;
  record_id: string;
  timeAgo?: string;
}

interface AlertPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AlertPanel({ isOpen, onClose }: AlertPanelProps) {
  const [alerts, setAlerts] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
    }
  }, [isOpen]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const notifications: Notification[] = [];

      // 1. BG Alerts
      const { data: bgs } = await supabase
        .from('bg_tracker')
        .select('*')
        .neq('bg_status', 'Released');
      
      (bgs || []).forEach(bg => {
        const expiry = new Date(
          bg.extended_expiry_date || bg.expiry_date
        );
        const days = Math.floor(
          (expiry.getTime() - today.getTime()) / 86400000
        );
        
        if (days < 0) {
          notifications.push({
            id: `bg-exp-${bg.bg_id}`,
            type: 'bg_expired',
            severity: 'critical',
            title: `BG Expired: ${bg.bg_number}`,
            message: `${bg.agency_name} — expired ${Math.abs(days)} days ago`,
            module: '/bg',
            record_id: bg.bg_id
          });
        } else if (days <= 7) {
          notifications.push({
            id: `bg-crit-${bg.bg_id}`,
            type: 'bg_critical',
            severity: 'critical',
            title: `BG Expiring in ${days} days`,
            message: `${bg.bg_number} — ${bg.agency_name}`,
            module: '/bg',
            record_id: bg.bg_id
          });
        } else if (days <= 30) {
          notifications.push({
            id: `bg-warn-${bg.bg_id}`,
            type: 'bg_warning',
            severity: 'warning',
            title: `BG Expiring in ${days} days`,
            message: `${bg.bg_number} — ${bg.agency_name}`,
            module: '/bg',
            record_id: bg.bg_id
          });
        }
      });

      // 2. Delayed Works
      const { data: works } = await supabase
        .from('awarded_works')
        .select('awarded_id, name_of_work, delay_days, overall_status')
        .gt('delay_days', 0)
        .neq('overall_status', 'Completed');
      
      (works || []).forEach(w => {
        const days = Number(w.delay_days) || 0;
        notifications.push({
          id: `delay-${w.awarded_id}`,
          type: days > 30 ? 'delay_critical' : 'delay_warning',
          severity: days > 30 ? 'critical' : 'warning',
          title: `Work Delayed by ${days} days`,
          message: w.name_of_work?.substring(0, 50) || '',
          module: '/awarded',
          record_id: w.awarded_id
        });
      });

      // 3. Tender Bid Deadlines
      const { data: tenders } = await supabase
        .from('tender')
        .select('tender_id, tender_no, name_of_work, bid_submission_deadline, current_stage')
        .not('current_stage', 'in', '("Awarded","Cancelled")')
        .not('bid_submission_deadline', 'is', null);
      
      (tenders || []).forEach(t => {
        if (!t.bid_submission_deadline) return;
        const deadline = new Date(t.bid_submission_deadline);
        const days = Math.floor(
          (deadline.getTime() - today.getTime()) / 86400000
        );
        if (days === 1) {
          notifications.push({
            id: `bid-crit-${t.tender_id}`,
            type: 'bid_deadline_critical',
            severity: 'critical',
            title: 'Bid Deadline Tomorrow!',
            message: `${t.tender_no} — ${t.name_of_work?.substring(0, 40)}`,
            module: '/tender',
            record_id: t.tender_id
          });
        } else if (days > 1 && days <= 7) {
          notifications.push({
            id: `bid-warn-${t.tender_id}`,
            type: 'bid_deadline_warning',
            severity: 'warning',
            title: `Bid Deadline in ${days} days`,
            message: `${t.tender_no} — ${t.name_of_work?.substring(0, 40)}`,
            module: '/tender',
            record_id: t.tender_id
          });
        }
      });

      // 4. Overdue Approvals > 60 days
      const { data: approvals } = await supabase
        .from('under_approval')
        .select('approval_id, name_of_work, days_in_pipeline, current_stage')
        .gt('days_in_pipeline', 60)
        .not('current_stage', 'in', '("Tendered","Dropped")');
      
      (approvals || []).forEach(a => {
        notifications.push({
          id: `app-overdue-${a.approval_id}`,
          type: 'approval_overdue',
          severity: 'warning',
          title: `Approval Pending ${a.days_in_pipeline} days`,
          message: a.name_of_work?.substring(0, 50) || '',
          module: '/approval',
          record_id: a.approval_id
        });
      });

      // 5. DLP Ending in 30 days
      const in30 = new Date();
      in30.setDate(in30.getDate() + 30);
      const { data: dlpWorks } = await supabase
        .from('awarded_works')
        .select('awarded_id, name_of_work, dlp_end_date')
        .not('dlp_end_date', 'is', null)
        .lte('dlp_end_date', in30.toISOString().split('T')[0])
        .gte('dlp_end_date', today.toISOString().split('T')[0]);
      
      (dlpWorks || []).forEach(w => {
        notifications.push({
          id: `dlp-${w.awarded_id}`,
          type: 'dlp_ending',
          severity: 'info',
          title: 'DLP Period Ending Soon',
          message: w.name_of_work?.substring(0, 50) || '',
          module: '/awarded',
          record_id: w.awarded_id
        });
      });

      // Sort: critical first, then warning, then info
      notifications.sort((a, b) => {
        const order = { critical: 0, warning: 1, info: 2 };
        return order[a.severity] - order[b.severity];
      });

      setAlerts(notifications);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredAlerts = useMemo(() => {
    if (filter === 'all') return alerts;
    return alerts.filter(a => a.severity === filter);
  }, [alerts, filter]);

  const handleAlertClick = (module: string) => {
    navigate(module);
    onClose();
  };

  const getIcon = (type: string, severity: string) => {
    const className = cn(
      "shrink-0",
      severity === 'critical' ? "text-rose-500" :
      severity === 'warning' ? "text-amber-500" : "text-teal-500"
    );

    if (type.startsWith('bg_')) return <Shield size={18} className={className} />;
    if (type.startsWith('delay_')) return <Clock size={18} className={className} />;
    if (type.startsWith('bid_deadline_')) return <Calendar size={18} className={className} />;
    if (type === 'approval_overdue') return <Hourglass size={18} className={className} />;
    return <AlertCircle size={18} className={className} />;
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[210] animate-in fade-in duration-200"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside className={cn(
        "fixed top-0 right-0 h-screen w-full max-w-[380px] bg-white shadow-2xl z-[220] transition-transform duration-300 ease-out flex flex-col",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}>
        {/* Header */}
        <div className="p-6 bg-slate-50/80 border-b border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#0B1F3A]">Notifications</h2>
              <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full text-[10px] font-black tracking-widest">
                {alerts.length}
              </span>
            </div>
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 transition-all"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex p-1 bg-slate-200/50 rounded-xl">
            {(['all', 'critical', 'warning', 'info'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={cn(
                  "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
                  filter === t 
                    ? "bg-white text-[var(--navy)] shadow-sm" 
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <Loader2 className="animate-spin" size={24} />
              <span className="text-xs font-bold uppercase tracking-widest">Scanning modules...</span>
            </div>
          ) : filteredAlerts.length > 0 ? (
            filteredAlerts.map((alert) => (
              <div 
                key={alert.id}
                onClick={() => handleAlertClick(alert.module)}
                className={cn(
                  "relative p-4 rounded-2xl border transition-all cursor-pointer hover:border-slate-300 group overflow-hidden",
                  "bg-white hover:bg-slate-50/50"
                )}
              >
                {/* Severity Bar */}
                <div className={cn(
                  "absolute left-0 top-0 bottom-0 w-1",
                  alert.severity === 'critical' ? "bg-rose-500" :
                  alert.severity === 'warning' ? "bg-amber-500" : "bg-teal-500"
                )} />

                <div className="flex gap-4">
                  {getIcon(alert.type, alert.severity)}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[13px] font-bold text-slate-900 leading-tight">
                      {alert.title}
                    </h3>
                    <p className="text-[12px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {alert.message}
                    </p>
                  </div>
                  <ArrowRight size={14} className="text-slate-200 group-hover:text-slate-400 transition-all self-center" />
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-slate-300 gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                <Bell className="opacity-20" size={32} />
              </div>
              <p className="text-sm font-medium">No new notifications</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <RefreshCcw size={10} />
            Refreshed just now
          </div>
          <button 
            onClick={fetchAlerts}
            className="p-2 text-slate-400 hover:text-[var(--teal)] transition-colors"
          >
            <RefreshCcw size={16} />
          </button>
        </div>
      </aside>
    </>
  );
}
