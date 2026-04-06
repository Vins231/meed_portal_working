import { useState, useEffect } from 'react';
import { 
  Search, Filter, Clock, User, Activity, 
  Database, Hash, Info, Loader2, Calendar,
  CheckCircle2, AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { format, isToday, isWithinInterval, subDays } from 'date-fns';

interface ActivityLogEntry {
  log_id: string;
  timestamp: string;
  user_id: string;
  action: string;
  module: string;
  description: string;
  status: string;
  record_id: string;
  user_name: string;
  user_email: string;
}

export default function ActivityLog() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('All');
  const [moduleFilter, setModuleFilter] = useState('All');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const searchLower = search.toLowerCase();
    const matchesSearch = 
      (log.user_name?.toLowerCase() || '').includes(searchLower) ||
      (log.user_email?.toLowerCase() || '').includes(searchLower) ||
      (log.action?.toLowerCase() || '').includes(searchLower) ||
      (log.module?.toLowerCase() || '').includes(searchLower) ||
      (log.record_id?.toLowerCase() || '').includes(searchLower) ||
      (log.description?.toLowerCase() || '').includes(searchLower);

    const matchesAction = actionFilter === 'All' || log.action === actionFilter;
    const matchesModule = moduleFilter === 'All' || log.module === moduleFilter;

    return matchesSearch && matchesAction && matchesModule;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-700 border-green-200';
      case 'UPDATE': return 'bg-sky-100 text-sky-700 border-sky-200';
      case 'LOGIN': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'UPLOAD': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'SUBMIT': return 'bg-teal-100 text-teal-700 border-teal-200';
      case 'MOVE_TO_TENDER': return 'bg-sky-100 text-sky-700 border-sky-200';
      case 'MOVE_TO_AWARDED': return 'bg-green-100 text-green-700 border-green-200';
      case 'PAYMENT_UPDATE': return 'bg-teal-100 text-teal-700 border-teal-200';
      case 'PROGRESS_UPDATE': return 'bg-sky-100 text-sky-700 border-sky-200';
      case 'AWARD': return 'bg-green-100 text-green-700 border-green-200';
      case 'ADD_BIDDER': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'TENDER_MOVE': return 'bg-sky-100 text-sky-700 border-sky-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getModuleBadge = (module: string) => {
    switch (module) {
      case 'PLANNING': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'UNDER_APPROVAL': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'TENDER': return 'bg-sky-100 text-sky-700 border-sky-200';
      case 'AWARDED_WORKS': return 'bg-teal-100 text-teal-700 border-teal-200';
      case 'BG_TRACKER': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'SYSTEM': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Stats
  const totalActions = logs.length;
  const todayActions = logs.filter(l => isToday(new Date(l.timestamp))).length;
  const weekActions = logs.filter(l => {
    const date = new Date(l.timestamp);
    return isWithinInterval(date, {
      start: subDays(new Date(), 7),
      end: new Date()
    });
  }).length;
  const uniqueUsers = new Set(logs.map(l => l.user_email)).size;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
        <Loader2 className="animate-spin" size={32} />
        <p className="text-sm font-bold uppercase tracking-widest">Loading activity log...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--navy)]">Activity Log</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Complete audit trail of all portal actions</p>
        </div>
        <div className="px-4 py-1.5 bg-slate-100 border border-slate-200 rounded-full text-[11px] font-bold text-slate-600">
          Showing {filteredLogs.length} of {logs.length} entries
        </div>
      </div>

      {/* Filters & Stats */}
      <div className="bg-white rounded-[16px] p-6 border border-[var(--border)] shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by user, action, module..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] focus:bg-white transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select 
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] cursor-pointer font-medium"
            >
              <option value="All">All Actions</option>
              {['CREATE', 'UPDATE', 'LOGIN', 'UPLOAD', 'SUBMIT', 'MOVE_TO_TENDER', 'MOVE_TO_AWARDED', 'PAYMENT_UPDATE', 'PROGRESS_UPDATE', 'ADD_BIDDER', 'AWARD', 'TENDER_MOVE'].map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            <select 
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] cursor-pointer font-medium"
            >
              <option value="All">All Modules</option>
              {['PLANNING', 'UNDER_APPROVAL', 'TENDER', 'AWARDED_WORKS', 'BG_TRACKER', 'SYSTEM'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex flex-wrap gap-3">
          <StatPill label="Total Actions" value={totalActions} />
          <StatPill label="Today" value={todayActions} />
          <StatPill label="This Week" value={weekActions} />
          <StatPill label="Unique Users" value={uniqueUsers} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[16px] border border-[var(--border)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[1000px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50">
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">Timestamp</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">User</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">Action</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">Module</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">Record ID</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredLogs.length > 0 ? filteredLogs.map((log, i) => (
                <tr key={log.log_id} className={cn(
                  "hover:bg-slate-50/50 transition-colors group",
                  i % 2 === 1 ? "bg-slate-50/30" : "bg-white"
                )}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-[12px] font-bold text-[#0B1F3A]">{format(new Date(log.timestamp), 'dd-MMM-yyyy')}</div>
                    <div className="text-[10px] font-medium text-slate-400 mt-0.5">{format(new Date(log.timestamp), 'HH:mm:ss')}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-[12px] font-bold text-[#0B1F3A]">
                      {log.user_name || log.user_email?.split('@')[0]}
                    </div>
                    <div className="text-[10px] font-medium text-slate-400 mt-0.5">{log.user_email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                      getActionBadge(log.action)
                    )}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                      getModuleBadge(log.module)
                    )}>
                      {log.module}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {log.record_id ? (
                      <code className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono text-slate-600">
                        {log.record_id}
                      </code>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div 
                      className={cn(
                        "text-[12px] leading-relaxed max-w-[300px] truncate",
                        log.description ? "text-slate-600" : "text-slate-300 italic"
                      )}
                      title={log.description || ''}
                    >
                      {log.description || '—'}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-300">
                      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                        <Clock size={32} className="opacity-20" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-400">No activity records found</p>
                        <p className="text-xs">Actions across all modules will appear here</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string, value: number | string }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-1.5 bg-[#0B1F3A] rounded-full border border-[#0B1F3A] shadow-sm">
      <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{label}</span>
      <span className="text-[12px] font-black text-[var(--teal)]">{value}</span>
    </div>
  );
}
