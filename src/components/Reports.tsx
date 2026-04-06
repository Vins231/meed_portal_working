import { useState, useEffect } from 'react';
import { 
  BarChart3, PieChart, Shield, Search, Printer, 
  ChevronRight, ArrowRight, Clock, AlertCircle,
  FileText, TrendingUp, CheckCircle2, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

type ReportType = 'progress' | 'pipeline' | 'bg';

export default function Reports() {
  const navigate = useNavigate();
  const [activeReport, setActiveReport] = useState<ReportType>('progress');
  const [loading, setLoading] = useState(false);
  const [divisions, setDivisions] = useState<{ id: number, name: string }[]>([]);
  
  // Report 1 Filters
  const [filters, setFilters] = useState({
    division: '',
    section: '',
    status: 'All'
  });
  const [report1Data, setReport1Data] = useState<any[]>([]);
  const [report1Summary, setReport1Summary] = useState({
    total: 0,
    delayed: 0,
    completed: 0,
    totalValue: 0
  });

  // Report 2 Data
  const [report2Counts, setReport2Counts] = useState({
    planning: 0,
    approval: 0,
    tender: 0,
    awarded: 0,
    completed: 0
  });
  const [report2Breakdown, setReport2Breakdown] = useState<{ stage: string, count: number }[]>([]);

  // Report 3 Data
  const [report3Groups, setReport3Groups] = useState<{
    critical: any[],
    warning: any[],
    safe: any[]
  }>({ critical: [], warning: [], safe: [] });

  useEffect(() => {
    fetchDivisions();
    if (activeReport === 'pipeline') generateReport2();
    if (activeReport === 'bg') generateReport3();
  }, [activeReport]);

  const fetchDivisions = async () => {
    const { data } = await supabase.from('divisions').select('*').order('name');
    if (data) setDivisions(data);
  };

  const fmtCurrency = (n: number) => {
    if (!n) return 'Rs.0';
    if (n >= 10000000) return 'Rs.' + (n / 10000000).toFixed(2) + ' Cr';
    if (n >= 100000) return 'Rs.' + (n / 100000).toFixed(2) + ' L';
    return 'Rs.' + n.toLocaleString('en-IN');
  };

  const fmtDate = (d: string) => d ? format(new Date(d), 'dd-MMM-yyyy') : '-';

  // --- REPORT 1: WORKS PROGRESS ---
  const generateReport1 = async () => {
    setLoading(true);
    try {
      let query = supabase.from('awarded_works').select('*');
      
      if (filters.division) query = query.eq('division', filters.division);
      if (filters.section) query = query.ilike('section', `%${filters.section}%`);
      if (filters.status !== 'All') query = query.eq('overall_status', filters.status);

      const { data, error } = await query.order('added_on', { ascending: false });
      
      if (error) throw error;
      
      if (data) {
        setReport1Data(data);
        const summary = data.reduce((acc, curr) => {
          acc.total++;
          if ((Number(curr.delay_days) || 0) > 0) acc.delayed++;
          if (curr.overall_status === 'Completed') acc.completed++;
          acc.totalValue += (Number(curr.awarded_cost) || 0);
          return acc;
        }, { total: 0, delayed: 0, completed: 0, totalValue: 0 });
        setReport1Summary(summary);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- REPORT 2: PIPELINE STATUS ---
  const generateReport2 = async () => {
    setLoading(true);
    try {
      const [planning, approval, tender, awarded, completed, breakdown] = await Promise.all([
        supabase.from('planning').select('plan_id', { count: 'exact', head: true }).neq('status', 'Submitted'),
        supabase.from('under_approval').select('approval_id', { count: 'exact', head: true }).not('current_stage', 'in', '(Dropped,Tendered)'),
        supabase.from('tender').select('tender_id', { count: 'exact', head: true }).not('current_stage', 'in', '(Awarded,Cancelled)'),
        supabase.from('awarded_works').select('awarded_id', { count: 'exact', head: true }).neq('overall_status', 'Completed'),
        supabase.from('awarded_works').select('awarded_id', { count: 'exact', head: true }).eq('overall_status', 'Completed'),
        supabase.from('under_approval').select('current_stage')
      ]);

      setReport2Counts({
        planning: planning.count || 0,
        approval: approval.count || 0,
        tender: tender.count || 0,
        awarded: awarded.count || 0,
        completed: completed.count || 0
      });

      if (breakdown.data) {
        const stages = [
          'Estimate Pending', 'FC Pending', 'FC Received', 
          'CA Approval Pending', 'Ready to Tender', 'On Hold', 'Dropped'
        ];
        const grouped = stages.map(s => ({
          stage: s,
          count: breakdown.data.filter(item => item.current_stage === s).length
        }));
        setReport2Breakdown(grouped);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- REPORT 3: BG EXPIRY ---
  const generateReport3 = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('bg_tracker').select('*');
      if (error) throw error;

      if (data) {
        const processed = data.map(bg => {
          const expiryDate = bg.extended_expiry_date || bg.expiry_date;
          const days = Math.floor((new Date(expiryDate).getTime() - new Date().getTime()) / 86400000);
          return { ...bg, days_remaining: days };
        });

        const critical = processed.filter(bg => bg.days_remaining <= 30).sort((a, b) => a.days_remaining - b.days_remaining);
        const warning = processed.filter(bg => bg.days_remaining > 30 && bg.days_remaining <= 60).sort((a, b) => a.days_remaining - b.days_remaining);
        const safe = processed.filter(bg => bg.days_remaining > 60).sort((a, b) => a.days_remaining - b.days_remaining);

        setReport3Groups({ critical, warning, safe });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--navy)]">Reports</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Generate and export departmental engineering reports</p>
        </div>
      </div>

      {/* Report Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
        <ReportCard 
          active={activeReport === 'progress'}
          onClick={() => setActiveReport('progress')}
          icon={<BarChart3 size={20} />}
          title="Works Progress Report"
          subtitle="Filter by division, section and status"
        />
        <ReportCard 
          active={activeReport === 'pipeline'}
          onClick={() => setActiveReport('pipeline')}
          icon={<PieChart size={20} />}
          title="Pipeline Status Report"
          subtitle="Overview of all pipeline stages"
        />
        <ReportCard 
          active={activeReport === 'bg'}
          onClick={() => setActiveReport('bg')}
          icon={<Shield size={20} />}
          title="BG Expiry Report"
          subtitle="Bank guarantees grouped by expiry"
        />
      </div>

      {/* Results Panel */}
      <div className="bg-white rounded-[16px] border border-[var(--border)] shadow-sm overflow-hidden min-h-[400px]">
        {activeReport === 'progress' && (
          <div className="p-6 space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap items-end gap-4 no-print border-b border-slate-100 pb-6">
              <div className="space-y-1.5 flex-1 min-w-[200px]">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Division</label>
                <select 
                  value={filters.division}
                  onChange={e => setFilters({ ...filters, division: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] outline-none focus:border-[var(--teal)] transition-all"
                >
                  <option value="">All Divisions</option>
                  {divisions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 flex-1 min-w-[200px]">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Section</label>
                <input 
                  type="text"
                  placeholder="Enter section name..."
                  value={filters.section}
                  onChange={e => setFilters({ ...filters, section: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] outline-none focus:border-[var(--teal)] transition-all"
                />
              </div>
              <div className="space-y-1.5 flex-1 min-w-[200px]">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</label>
                <select 
                  value={filters.status}
                  onChange={e => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] outline-none focus:border-[var(--teal)] transition-all"
                >
                  <option value="All">All Status</option>
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Delayed">Delayed</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <button 
                onClick={generateReport1}
                disabled={loading}
                className="px-6 py-2 bg-[var(--teal)] text-white rounded-xl font-bold text-[13px] hover:bg-[var(--teal2)] transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <TrendingUp size={16} />}
                Generate Report
              </button>
            </div>

            {report1Data.length > 0 ? (
              <div className="space-y-8">
                {/* Summary Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
                  <SummaryBox label="Total Works" value={report1Summary.total} icon={<FileText size={18} />} color="bg-slate-50 text-slate-700" />
                  <SummaryBox label="Delayed" value={report1Summary.delayed} icon={<AlertCircle size={18} />} color="bg-rose-50 text-rose-700" />
                  <SummaryBox label="Completed" value={report1Summary.completed} icon={<CheckCircle2 size={18} />} color="bg-green-50 text-green-700" />
                  <SummaryBox label="Total Value" value={fmtCurrency(report1Summary.totalValue)} icon={<IndianRupee size={18} />} color="bg-teal-50 text-teal-700" />
                </div>

                {/* Results Table */}
                <div className="space-y-4 print-area">
                  <div className="flex items-center justify-between no-print">
                    <h3 className="font-bold text-[var(--navy)]">Report Results</h3>
                    <button 
                      onClick={() => window.print()}
                      className="flex items-center gap-2 px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:border-[var(--teal)] hover:text-[var(--teal)] transition-all"
                    >
                      <Printer size={14} />
                      Print Report
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full border-collapse text-[12px]">
                      <thead>
                        <tr className="bg-slate-50 text-left">
                          <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Sr</th>
                          <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Name of Work</th>
                          <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Division</th>
                          <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Section</th>
                          <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Contractor</th>
                          <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Awarded Cost</th>
                          <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Progress</th>
                          <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Status</th>
                          <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Delay</th>
                          <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Scheduled Comp.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {report1Data.map((r, i) => (
                          <tr key={r.awarded_id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-slate-400 font-medium">{i + 1}</td>
                            <td className="px-4 py-3 font-bold text-[var(--navy)] max-w-[200px]">{r.name_of_work}</td>
                            <td className="px-4 py-3 text-slate-600">{r.division}</td>
                            <td className="px-4 py-3 text-slate-600">{r.section}</td>
                            <td className="px-4 py-3 text-slate-600">{r.contractor_name}</td>
                            <td className="px-4 py-3 font-bold text-[var(--navy)]">{fmtCurrency(r.awarded_cost)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-[var(--teal)]" style={{ width: `${r.physical_progress_percent}%` }} />
                                </div>
                                <span className="font-bold">{r.physical_progress_percent}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize",
                                r.overall_status === 'Completed' ? "bg-green-50 text-green-700 border-green-100" :
                                r.overall_status === 'Delayed' ? "bg-rose-50 text-rose-700 border-rose-100" :
                                "bg-sky-50 text-sky-700 border-sky-100"
                              )}>
                                {r.overall_status}
                              </span>
                            </td>
                            <td className={cn("px-4 py-3 font-bold", (Number(r.delay_days) || 0) > 0 ? "text-[var(--rose)]" : "text-slate-400")}>
                              {r.delay_days || 0}d
                            </td>
                            <td className="px-4 py-3 text-slate-600">{fmtDate(r.scheduled_completion)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <FileText size={48} className="mb-4 opacity-10" />
                <p className="text-sm font-medium italic">Select filters and click 'Generate Report' to view results</p>
              </div>
            )}
          </div>
        )}

        {activeReport === 'pipeline' && (
          <div className="p-8 space-y-12">
            {/* Stage Boxes */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StageBox label="Planning" count={report2Counts.planning} onClick={() => navigate('/planning')} />
              <StageBox label="Under Approval" count={report2Counts.approval} onClick={() => navigate('/approval')} />
              <StageBox label="Tender" count={report2Counts.tender} onClick={() => navigate('/tender')} />
              <StageBox label="Awarded" count={report2Counts.awarded} onClick={() => navigate('/awarded')} />
              <StageBox label="Completed" count={report2Counts.completed} onClick={() => navigate('/awarded')} />
            </div>

            {/* Breakdown Section */}
            <div className="space-y-6 max-w-3xl">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="p-2 bg-teal-50 text-[var(--teal)] rounded-lg">
                  <PieChart size={20} />
                </div>
                <h3 className="font-bold text-[var(--navy)]">Approval Pipeline Breakdown</h3>
              </div>

              <div className="space-y-5">
                {report2Breakdown.map((item, i) => {
                  const maxCount = Math.max(...report2Breakdown.map(b => b.count), 1);
                  const width = (item.count / maxCount) * 100;
                  
                  return (
                    <div key={item.stage} className="flex items-center gap-4 group">
                      <span className="text-[12px] font-bold text-slate-500 w-[180px] shrink-0 group-hover:text-[var(--navy)] transition-colors">
                        {item.stage}
                      </span>
                      <div className="flex-1 h-3 bg-slate-50 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[var(--teal)] rounded-full transition-all duration-[600ms] ease-out shadow-sm"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <span className="text-sm font-black text-[var(--navy)] w-10 text-right">
                        {item.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeReport === 'bg' && (
          <div className="p-8 space-y-10">
            {report3Groups.critical.length === 0 && report3Groups.warning.length === 0 && report3Groups.safe.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Shield size={48} className="mb-4 opacity-10" />
                <p className="text-sm font-medium italic">No bank guarantees found in the system</p>
              </div>
            ) : (
              <>
                {report3Groups.critical.length > 0 && (
                  <BGSection 
                    title="Critical (≤30 days)" 
                    color="rose" 
                    data={report3Groups.critical} 
                    fmtCurrency={fmtCurrency}
                    fmtDate={fmtDate}
                  />
                )}
                {report3Groups.warning.length > 0 && (
                  <BGSection 
                    title="Warning (31-60 days)" 
                    color="amber" 
                    data={report3Groups.warning} 
                    fmtCurrency={fmtCurrency}
                    fmtDate={fmtDate}
                  />
                )}
                {report3Groups.safe.length > 0 && (
                  <BGSection 
                    title="Safe (>60 days)" 
                    color="teal" 
                    data={report3Groups.safe} 
                    fmtCurrency={fmtCurrency}
                    fmtDate={fmtDate}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}} />
    </div>
  );
}

// --- HELPER COMPONENTS ---

function ReportCard({ active, onClick, icon, title, subtitle }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-start p-5 rounded-[16px] border transition-all text-left group",
        active 
          ? "bg-white border-[var(--teal)] shadow-md ring-1 ring-[var(--teal)]/20" 
          : "bg-white border-[var(--border)] hover:border-slate-300 shadow-sm"
      )}
    >
      <div className={cn(
        "p-2.5 rounded-xl mb-4 transition-colors",
        active ? "bg-teal-50 text-[var(--teal)]" : "bg-slate-50 text-slate-400 group-hover:text-slate-600"
      )}>
        {icon}
      </div>
      <h3 className={cn(
        "text-sm font-bold mb-1 transition-colors",
        active ? "text-[var(--navy)]" : "text-slate-600"
      )}>{title}</h3>
      <p className="text-[11px] text-slate-400 font-medium leading-relaxed">{subtitle}</p>
    </button>
  );
}

function SummaryBox({ label, value, icon, color }: any) {
  return (
    <div className={cn("p-4 rounded-xl flex items-center gap-4 border border-transparent", color)}>
      <div className="p-2 bg-white/50 rounded-lg shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">{label}</p>
        <p className="text-lg font-black leading-none mt-1">{value}</p>
      </div>
    </div>
  );
}

function StageBox({ label, count, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className="bg-[var(--navy)] p-5 rounded-xl text-white text-center hover:bg-slate-800 transition-all group"
    >
      <div className="text-2xl font-black mb-1 group-hover:scale-110 transition-transform">{count}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">{label}</div>
    </button>
  );
}

function BGSection({ title, color, data, fmtCurrency, fmtDate }: any) {
  const headerClass = color === 'rose' ? 'bg-rose-50 text-rose-700' : color === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-700';
  
  return (
    <div className="space-y-4">
      <div className={cn("px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest", headerClass)}>
        {title}
      </div>
      <div className="overflow-x-auto border border-slate-100 rounded-xl">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">BG No</th>
              <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Agency/Contractor</th>
              <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Bank</th>
              <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">BG Amount</th>
              <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Expiry Date</th>
              <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Days Remaining</th>
              <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.map((bg: any) => {
              const days = bg.days_remaining;
              const daysColor = days < 0 ? "text-[var(--rose)]" : days <= 7 ? "text-[var(--rose)] font-bold" : days <= 30 ? "text-[var(--amber)] font-bold" : days <= 60 ? "text-[var(--amber)]" : "text-[var(--teal)]";
              
              return (
                <tr key={bg.bg_id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-bold text-[var(--navy)]">{bg.bg_number}</td>
                  <td className="px-4 py-3 text-slate-600">{bg.agency_name}</td>
                  <td className="px-4 py-3 text-slate-600">{bg.bank_name}</td>
                  <td className="px-4 py-3 font-bold text-[var(--navy)]">{fmtCurrency(bg.bg_amount)}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(bg.extended_expiry_date || bg.expiry_date)}</td>
                  <td className={cn("px-4 py-3", daysColor)}>
                    {days < 0 ? `${Math.abs(days)} days overdue` : `${days} days`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize",
                      bg.bg_status === 'Active' ? "bg-teal-50 text-teal-700 border-teal-100" :
                      bg.bg_status === 'Extended' ? "bg-amber-50 text-amber-700 border-amber-100" :
                      "bg-slate-50 text-slate-700 border-slate-100"
                    )}>
                      {bg.bg_status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IndianRupee({ size, className }: any) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M6 3h12" />
      <path d="M6 8h12" />
      <path d="m6 13 8.5 8" />
      <path d="M6 13h3" />
      <path d="M9 13c6.667 0 6.667-10 0-10" />
    </svg>
  );
}
