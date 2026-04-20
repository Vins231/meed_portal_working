import { useState, useEffect } from 'react';
import { 
  BarChart3, PieChart, Shield, Search, Printer, 
  ChevronRight, ArrowRight, Clock, AlertCircle,
  FileText, TrendingUp, CheckCircle2, Loader2,
  FileSignature, Hash, Layout, Download, Filter, 
  X, Calendar, MapPin, Layers, Building2, User
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

type ReportType = 'approval' | 'tender' | 'awarded' | 'bg' | 'pipeline';

export default function Reports() {
  const [activeReport, setActiveReport] = useState<ReportType>('approval');
  const [loading, setLoading] = useState(false);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Combined PDF state
  const [showCombinedPDF, setShowCombinedPDF] = useState(false);
  const [combinedLoading, setCombinedLoading] = useState(false);
  const [combinedFilters, setCombinedFilters] = useState({
    division: '', dateFrom: '', dateTo: ''
  });
  const [combinedData, setCombinedData] = useState<{
    approvals: any[], tenders: any[], awarded: any[]
  }>({ approvals: [], tenders: [], awarded: [] });

  // Report 1 - Under Approval
  const [r1Filters, setR1Filters] = useState({
    division: '', section: '', stage: '', 
    dateFrom: '', dateTo: ''
  });
  const [r1Data, setR1Data] = useState<any[]>([]);

  // Report 2 - Tender
  const [r2Filters, setR2Filters] = useState({
    division: '', section: '', tender_type: '',
    dateFrom: '', dateTo: ''
  });
  const [r2Data, setR2Data] = useState<any[]>([]);

  // Report 3 - Awarded
  const [r3Filters, setR3Filters] = useState({
    division: '', section: '', status: '',
    delayedOnly: false, dateFrom: '', dateTo: ''
  });
  const [r3Data, setR3Data] = useState<any[]>([]);

  // Report 4 - BG Data
  const [bgGroups, setBgGroups] = useState<{
    critical: any[], warning: any[], safe: any[]
  }>({ critical: [], warning: [], safe: [] });

  // Report 5 - Pipeline Data
  const [pipelineCounts, setPipelineCounts] = useState<any>({
    planning: 0, approval: 0, tender: 0, awarded: 0, completed: 0
  });
  const [pipelineBreakdown, setPipelineBreakdown] = useState<any[]>([]);

  useEffect(() => {
    fetchDivisions();
    const user = localStorage.getItem('meed_user');
    if (user) setCurrentUser(JSON.parse(user));
  }, []);

  useEffect(() => {
    if (activeReport === 'bg') fetchBgData();
    if (activeReport === 'pipeline') fetchPipelineData();
  }, [activeReport]);

  const fetchDivisions = async () => {
    const { data } = await supabase.from('divisions').select('*').order('name');
    if (data) setDivisions(data);
  };

  const fmtCurrency = (n: number) => {
    if (!n) return 'Rs. 0';
    if (n >= 10000000) return 'Rs. ' + (n / 10000000).toFixed(2) + ' Cr';
    if (n >= 100000) return 'Rs. ' + (n / 100000).toFixed(2) + ' L';
    return 'Rs. ' + n.toLocaleString('en-IN');
  };

  const fmtDate = (d: string) => d ? format(new Date(d), 'dd-MMM-yyyy') : '-';

  // --- REPORT 1: UNDER APPROVAL ---
  const fetchApprovalReport = async () => {
    setLoading(true);
    try {
      let query = supabase.from('under_approval').select('*');
      
      if (r1Filters.division) query = query.eq('division', r1Filters.division);
      if (r1Filters.section) query = query.ilike('section', `%${r1Filters.section}%`);
      if (r1Filters.stage && r1Filters.stage !== 'All') query = query.eq('current_stage', r1Filters.stage);
      if (r1Filters.dateFrom) query = query.gte('added_on', r1Filters.dateFrom);
      if (r1Filters.dateTo) query = query.lte('added_on', r1Filters.dateTo);

      const { data, error } = await query.order('added_on', { ascending: false });
      if (error) throw error;
      setR1Data(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- REPORT 2: TENDER ---
  const fetchTenderReport = async () => {
    setLoading(true);
    try {
      let query = supabase.from('tender').select('*');
      
      if (r2Filters.division) query = query.eq('division', r2Filters.division);
      if (r2Filters.section) query = query.ilike('section', `%${r2Filters.section}%`);
      if (r2Filters.tender_type) query = query.eq('tender_type', r2Filters.tender_type);
      if (r2Filters.dateFrom) query = query.gte('added_on', r2Filters.dateFrom);
      if (r2Filters.dateTo) query = query.lte('added_on', r2Filters.dateTo);

      const { data, error } = await query.order('added_on', { ascending: false });
      if (error) throw error;
      setR2Data(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- REPORT 3: AWARDED ---
  const fetchAwardedReport = async () => {
    setLoading(true);
    try {
      let query = supabase.from('awarded_works').select('*');
      
      if (r3Filters.division) query = query.eq('division', r3Filters.division);
      if (r3Filters.section) query = query.ilike('section', `%${r3Filters.section}%`);
      if (r3Filters.status) query = query.eq('overall_status', r3Filters.status);
      if (r3Filters.delayedOnly) query = query.gt('delay_days', 0);
      if (r3Filters.dateFrom) query = query.gte('added_on', r3Filters.dateFrom);
      if (r3Filters.dateTo) query = query.lte('added_on', r3Filters.dateTo);

      const { data, error } = await query.order('added_on', { ascending: false });
      if (error) throw error;
      setR3Data(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- REPORT 4: BG EXPIRY ---
  const fetchBgData = async () => {
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

        setBgGroups({
          critical: processed.filter(bg => bg.days_remaining <= 30).sort((a, b) => a.days_remaining - b.days_remaining),
          warning: processed.filter(bg => bg.days_remaining > 30 && bg.days_remaining <= 60).sort((a, b) => a.days_remaining - b.days_remaining),
          safe: processed.filter(bg => bg.days_remaining > 60).sort((a, b) => a.days_remaining - b.days_remaining)
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- REPORT 5: PIPELINE STATUS ---
  const fetchPipelineData = async () => {
    setLoading(true);
    try {
      const [planning, approval, tender, awarded, completed, breakdown] = await Promise.all([
        supabase.from('planning').select('plan_id', { count: 'exact', head: true }).neq('status', 'Submitted'),
        supabase.from('under_approval').select('approval_id', { count: 'exact', head: true }).not('current_stage', 'in', ['Dropped', 'Tendered']),
        supabase.from('tender').select('tender_id', { count: 'exact', head: true }).not('current_stage', 'in', ['Awarded', 'Cancelled']),
        supabase.from('awarded_works').select('awarded_id', { count: 'exact', head: true }).neq('overall_status', 'Completed'),
        supabase.from('awarded_works').select('awarded_id', { count: 'exact', head: true }).eq('overall_status', 'Completed'),
        supabase.from('under_approval').select('current_stage')
      ]);

      setPipelineCounts({
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
        setPipelineBreakdown(stages.map(s => ({
          stage: s,
          count: breakdown.data.filter(item => item.current_stage === s).length
        })));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- COMBINED PDF GENERATION ---
  const generateCombinedPDF = async () => {
    setCombinedLoading(true);
    try {
      // 1. Fetch all data with current filters
      const [appRes, tenRes, awdRes] = await Promise.all([
        supabase.from('under_approval').select('*')
          .match(combinedFilters.division ? { division: combinedFilters.division } : {})
          .gte(combinedFilters.dateFrom || '2000-01-01', combinedFilters.dateFrom || '2000-01-01')
          .lte(combinedFilters.dateTo || '2100-01-01', combinedFilters.dateTo || '2100-01-01'),
        supabase.from('tender').select('*')
          .match(combinedFilters.division ? { division: combinedFilters.division } : {})
          .gte(combinedFilters.dateFrom || '2000-01-01', combinedFilters.dateFrom || '2000-01-01')
          .lte(combinedFilters.dateTo || '2100-01-01', combinedFilters.dateTo || '2100-01-01'),
        supabase.from('awarded_works').select('*')
          .match(combinedFilters.division ? { division: combinedFilters.division } : {})
          .gte(combinedFilters.dateFrom || '2000-01-01', combinedFilters.dateFrom || '2000-01-01')
          .lte(combinedFilters.dateTo || '2100-01-01', combinedFilters.dateTo || '2100-01-01')
      ]);

      const doc = new jsPDF('l', 'mm', 'a4');
      const time = format(new Date(), 'dd MMM yyyy HH:mm');
      
      // Helper for header
      const addHeader = (title: string) => {
        doc.setFillColor(11, 31, 58);
        doc.rect(0, 0, 297, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.text('MEED - Engineering Monitoring Portal', 14, 12);
        doc.setFontSize(10);
        doc.text(`${title} | Generated: ${time}`, 14, 18);
        if (combinedFilters.division) doc.text(`Division: ${combinedFilters.division}`, 240, 18);
      };

      // PAGE 1 — APPROVALS
      addHeader('UNDER APPROVAL REGISTER');
      autoTable(doc, {
        startY: 30,
        head: [['Sr', 'Name of Work', 'Division', 'Section', 'Estimated Cost', 'Stage', 'Date Added']],
        body: (appRes.data || []).map((r, i) => [
          i + 1, r.name_of_work, r.division, r.section, 
          fmtCurrency(r.estimated_cost), r.current_stage, fmtDate(r.added_on)
        ]),
        theme: 'striped', headStyles: { fillColor: [11, 31, 58] }, styles: { fontSize: 8 }
      });

      // PAGE 2 — TENDERS
      doc.addPage();
      addHeader('TENDER REGISTER');
      autoTable(doc, {
        startY: 30,
        head: [['Sr', 'Name of Work', 'Tender No', 'Division', 'Amount', 'Type', 'Status']],
        body: (tenRes.data || []).map((r, i) => [
          i + 1, r.name_of_work, r.tender_no || '-', r.division,
          fmtCurrency(r.estimated_cost), r.tender_type, r.current_stage || 'Floating'
        ]),
        theme: 'striped', headStyles: { fillColor: [18, 43, 80] }, styles: { fontSize: 8 }
      });

      // PAGE 3 — AWARDED
      doc.addPage();
      addHeader('AWARDED WORKS PROGRESS');
      autoTable(doc, {
        startY: 30,
        head: [['Sr', 'Name of Work', 'Contractor', 'Awarded Cost', 'Progress', 'Status', 'Delay']],
        body: (awdRes.data || []).map((r, i) => [
          i + 1, r.name_of_work, r.contractor_name, fmtCurrency(r.awarded_cost),
          `${r.physical_progress_percent}%`, r.overall_status, `${r.delay_days}d`
        ]),
        theme: 'striped', headStyles: { fillColor: [0, 201, 167] }, styles: { fontSize: 8 }
      });

      doc.save(`MEED_Combined_Report_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setCombinedLoading(false);
    }
  };

  // --- EXPORT TO EXCEL ---
  const exportToExcel = (data: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${fileName}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--navy)]">Reports</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Generate MIS registers and progress reports</p>
        </div>
        <button 
          onClick={() => setShowCombinedPDF(true)}
          className="px-6 py-3 bg-[var(--navy)] text-white rounded-xl font-bold text-[13px] hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-lg shadow-slate-200"
        >
          <FileText size={18} />
          Generate Full Report
        </button>
      </div>

      {/* Report Selector Cards */}
      <div className="flex overflow-x-auto gap-4 pb-2 no-scrollbar md:grid md:grid-cols-5">
        <ReportCard 
          active={activeReport === 'approval'}
          onClick={() => setActiveReport('approval')}
          icon={<FileSignature size={20} />}
          title="Under Approval Register"
          color="purple"
        />
        <ReportCard 
          active={activeReport === 'tender'}
          onClick={() => setActiveReport('tender')}
          icon={<Layout size={20} />}
          title="Tender Register"
          color="sky"
        />
        <ReportCard 
          active={activeReport === 'awarded'}
          onClick={() => setActiveReport('awarded')}
          icon={<TrendingUp size={20} />}
          title="Awarded Works Progress"
          color="teal"
        />
        <ReportCard 
          active={activeReport === 'bg'}
          onClick={() => setActiveReport('bg')}
          icon={<Shield size={20} />}
          title="BG Expiry Report"
          color="rose"
        />
        <ReportCard 
          active={activeReport === 'pipeline'}
          onClick={() => setActiveReport('pipeline')}
          icon={<BarChart3 size={20} />}
          title="Pipeline Status Report"
          color="indigo"
        />
      </div>

      {/* Active Report Area */}
      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden min-h-[500px]">
        {/* FILTERS FOR REGISTERS */}
        {['approval', 'tender', 'awarded'].includes(activeReport) && (
          <div className="p-6 border-b border-slate-50 bg-slate-50/30">
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Building2 size={12} className="text-[var(--teal)]" />
                  Division
                </label>
                <select 
                  value={activeReport === 'approval' ? r1Filters.division : activeReport === 'tender' ? r2Filters.division : r3Filters.division}
                  onChange={e => {
                    const val = e.target.value;
                    if (activeReport === 'approval') setR1Filters({ ...r1Filters, division: val });
                    else if (activeReport === 'tender') setR2Filters({ ...r2Filters, division: val });
                    else setR3Filters({ ...r3Filters, division: val });
                  }}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-[var(--teal)] outline-none transition-all"
                >
                  <option value="">All Divisions</option>
                  {divisions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <MapPin size={12} className="text-[var(--teal)]" />
                  Section
                </label>
                <input 
                  type="text"
                  placeholder="Enter section..."
                  value={activeReport === 'approval' ? r1Filters.section : activeReport === 'tender' ? r2Filters.section : r3Filters.section}
                  onChange={e => {
                    const val = e.target.value;
                    if (activeReport === 'approval') setR1Filters({ ...r1Filters, section: val });
                    else if (activeReport === 'tender') setR2Filters({ ...r2Filters, section: val });
                    else setR3Filters({ ...r3Filters, section: val });
                  }}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-[var(--teal)] outline-none transition-all"
                />
              </div>

              {activeReport === 'approval' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Layers size={12} className="text-[var(--teal)]" />
                    Stage
                  </label>
                  <select 
                    value={r1Filters.stage}
                    onChange={e => setR1Filters({ ...r1Filters, stage: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-[var(--teal)] outline-none transition-all"
                  >
                    <option value="">All Stages</option>
                    <option value="Estimate Pending">Estimate Pending</option>
                    <option value="FC Pending">FC Pending</option>
                    <option value="CA Approval Pending">CA Approval Pending</option>
                    <option value="Ready to Tender">Ready to Tender</option>
                  </select>
                </div>
              )}

              {activeReport === 'tender' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Hash size={12} className="text-[var(--teal)]" />
                    Type
                  </label>
                  <select 
                    value={r2Filters.tender_type}
                    onChange={e => setR2Filters({ ...r2Filters, tender_type: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-[var(--teal)] outline-none transition-all"
                  >
                    <option value="">All Types</option>
                    <option value="Open Tender">Open Tender</option>
                    <option value="Limited Tender">Limited Tender</option>
                    <option value="Single Tender">Single Tender</option>
                  </select>
                </div>
              )}

              {activeReport === 'awarded' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-[var(--teal)]" />
                    Status
                  </label>
                  <select 
                    value={r3Filters.status}
                    onChange={e => setR3Filters({ ...r3Filters, status: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-[var(--teal)] outline-none transition-all"
                  >
                    <option value="">All Status</option>
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Delayed">Delayed</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Calendar size={12} className="text-[var(--teal)]" />
                  From Date
                </label>
                <input 
                  type="date"
                  value={activeReport === 'approval' ? r1Filters.dateFrom : activeReport === 'tender' ? r2Filters.dateFrom : r3Filters.dateFrom}
                  onChange={e => {
                    const val = e.target.value;
                    if (activeReport === 'approval') setR1Filters({ ...r1Filters, dateFrom: val });
                    else if (activeReport === 'tender') setR2Filters({ ...r2Filters, dateFrom: val });
                    else setR3Filters({ ...r3Filters, dateFrom: val });
                  }}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-[var(--teal)] outline-none transition-all"
                />
              </div>

              <div className="flex items-end pt-2">
                <button 
                  onClick={() => {
                    if (activeReport === 'approval') fetchApprovalReport();
                    else if (activeReport === 'tender') fetchTenderReport();
                    else fetchAwardedReport();
                  }}
                  disabled={loading}
                  className="w-full py-2.5 bg-[var(--teal)] text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-[var(--teal2)] transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-500/10 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  Run Filter
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RESULTS TABLE: APPROVAL */}
        {activeReport === 'approval' && (
          <div className="p-6">
            <ResultsHeader 
              title="Under Approval Register"
              count={r1Data.length}
              onExcel={() => exportToExcel(r1Data, 'Under_Approval_Register')}
              onPDF={() => window.print()}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-400 font-bold uppercase tracking-widest">
                    <th className="py-4 px-4">Sr</th>
                    <th className="py-4 px-4">Name of Work</th>
                    <th className="py-4 px-4">Division</th>
                    <th className="py-4 px-4">Est. Cost</th>
                    <th className="py-4 px-4">Stage</th>
                    <th className="py-4 px-4">Authority</th>
                    <th className="py-4 px-4">Added On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {r1Data.map((r, i) => (
                    <tr key={r.approval_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 font-bold text-slate-400">{i+1}</td>
                      <td className="py-4 px-4 font-bold text-[var(--navy)] max-w-[300px] leading-relaxed">{r.name_of_work}</td>
                      <td className="py-4 px-4 text-slate-600">{r.division}</td>
                      <td className="py-4 px-4 font-black">{fmtCurrency(r.estimated_cost)}</td>
                      <td className="py-4 px-4">
                        <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-md font-bold text-[10px]">
                          {r.current_stage}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-slate-500">{r.competent_authority}</td>
                      <td className="py-4 px-4 text-slate-500 font-mono">{fmtDate(r.added_on)}</td>
                    </tr>
                  ))}
                  {r1Data.length === 0 && !loading && <TableEmptyState icon={<FileSignature size={48} />} text="No approval records found matching filters." colSpan={7} />}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RESULTS TABLE: TENDER */}
        {activeReport === 'tender' && (
          <div className="p-6">
            <ResultsHeader 
              title="Tender & Bidding Register"
              count={r2Data.length}
              onExcel={() => exportToExcel(r2Data, 'Tender_Register')}
              onPDF={() => window.print()}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-400 font-bold uppercase tracking-widest">
                    <th className="py-4 px-4">Sr</th>
                    <th className="py-4 px-4">Tender Info</th>
                    <th className="py-4 px-4">Division</th>
                    <th className="py-4 px-4">Amount</th>
                    <th className="py-4 px-4">Type</th>
                    <th className="py-4 px-4">No. of Bids</th>
                    <th className="py-4 px-4">Float Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {r2Data.map((r, i) => (
                    <tr key={r.tender_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 font-bold text-slate-400">{i+1}</td>
                      <td className="py-4 px-4 max-w-[300px]">
                        <div className="font-bold text-[var(--navy)] leading-relaxed">{r.name_of_work}</div>
                        <div className="text-[10px] font-bold text-[var(--teal)] mt-1">{r.tender_no || 'NO_TENDER_ID'}</div>
                      </td>
                      <td className="py-4 px-4 text-slate-600">{r.division}</td>
                      <td className="py-4 px-4 font-black">{fmtCurrency(r.estimated_cost)}</td>
                      <td className="py-4 px-4 text-slate-500 font-bold uppercase">{r.tender_type}</td>
                      <td className="py-4 px-4 font-bold text-center">
                        <span className="px-2 py-1 bg-slate-100 rounded-full text-slate-600">{r.no_of_bids_received || 0}</span>
                      </td>
                      <td className="py-4 px-4 text-slate-500 font-mono">{fmtDate(r.tender_float_date)}</td>
                    </tr>
                  ))}
                  {r2Data.length === 0 && !loading && <TableEmptyState icon={<Layout size={48} />} text="No tender records found matching filters." colSpan={7} />}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RESULTS TABLE: AWARDED */}
        {activeReport === 'awarded' && (
          <div className="p-6">
            <ResultsHeader 
              title="Awarded Works Progress Report"
              count={r3Data.length}
              onExcel={() => exportToExcel(r3Data, 'Awarded_Works_Progress')}
              onPDF={() => window.print()}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-400 font-bold uppercase tracking-widest">
                    <th className="py-4 px-4">Sr</th>
                    <th className="py-4 px-4">Name of Work</th>
                    <th className="py-4 px-4">Contractor</th>
                    <th className="py-4 px-4">Award Amount</th>
                    <th className="py-4 px-4">Progress</th>
                    <th className="py-4 px-4">Status</th>
                    <th className="py-4 px-4">Delay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {r3Data.map((r, i) => (
                    <tr key={r.awarded_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 font-bold text-slate-400">{i+1}</td>
                      <td className="py-4 px-4 max-w-[300px] leading-relaxed font-bold text-[var(--navy)]">{r.name_of_work}</td>
                      <td className="py-4 px-4 text-slate-600 font-medium">{r.contractor_name}</td>
                      <td className="py-4 px-4 font-black text-teal-700">{fmtCurrency(r.awarded_cost)}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--teal)]" style={{ width: `${r.physical_progress_percent}%` }} />
                          </div>
                          <span className="font-black text-[10px]">{r.physical_progress_percent}%</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize",
                          r.overall_status === 'Completed' ? "bg-green-50 text-green-700 border-green-100" :
                          r.overall_status === 'Delayed' ? "bg-rose-50 text-rose-700 border-rose-100" :
                          "bg-sky-50 text-sky-700 border-sky-100"
                        )}>
                          {r.overall_status}
                        </span>
                      </td>
                      <td className={cn("py-4 px-4 font-bold", (r.delay_days || 0) > 0 ? "text-[var(--rose)]" : "text-slate-400")}>
                        {r.delay_days || 0}d
                      </td>
                    </tr>
                  ))}
                  {r3Data.length === 0 && !loading && <TableEmptyState icon={<TrendingUp size={48} />} text="No awarded work records found matching filters." colSpan={7} />}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORT 4: BG EXPIRY (UNCHANGED LOGIC) */}
        {activeReport === 'bg' && (
          <div className="p-8 space-y-10">
            <ResultsHeader title="Bank Guarantee Expiry Tracker" count={bgGroups.critical.length + bgGroups.warning.length + bgGroups.safe.length} hideQuickActions />
            {bgGroups.critical.length === 0 && bgGroups.warning.length === 0 && bgGroups.safe.length === 0 ? (
              <EmptyState icon={<Shield size={48} />} text="No bank guarantees found in the system." />
            ) : (
              <>
                <BGSection title="Critical (≤30 days)" color="rose" data={bgGroups.critical} fmtCurrency={fmtCurrency} fmtDate={fmtDate} />
                <BGSection title="Warning (31-60 days)" color="amber" data={bgGroups.warning} fmtCurrency={fmtCurrency} fmtDate={fmtDate} />
                <BGSection title="Safe (>60 days)" color="teal" data={bgGroups.safe} fmtCurrency={fmtCurrency} fmtDate={fmtDate} />
              </>
            )}
          </div>
        )}

        {/* REPORT 5: PIPELINE STATUS (UNCHANGED LOGIC) */}
        {activeReport === 'pipeline' && (
          <div className="p-8 space-y-12">
            <ResultsHeader title="MEED Engineering Pipeline Overview" hideQuickActions />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StageBox label="Planning" count={pipelineCounts.planning} />
              <StageBox label="Approval" count={pipelineCounts.approval} />
              <StageBox label="Tender" count={pipelineCounts.tender} />
              <StageBox label="Awarded" count={pipelineCounts.awarded} />
              <StageBox label="Completed" count={pipelineCounts.completed} />
            </div>

            <div className="space-y-6 max-w-3xl">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <PieChart size={20} />
                </div>
                <h3 className="font-bold text-[var(--navy)]">Approval Stages Breakdown</h3>
              </div>
              <div className="space-y-5">
                {pipelineBreakdown.map((item) => {
                  const maxCount = Math.max(...pipelineBreakdown.map(b => b.count), 1);
                  const width = (item.count / maxCount) * 100;
                  return (
                    <div key={item.stage} className="flex items-center gap-4 group">
                      <span className="text-[12px] font-bold text-slate-500 w-[180px] shrink-0 group-hover:text-[var(--navy)] transition-colors">{item.stage}</span>
                      <div className="flex-1 h-3 bg-slate-50 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all duration-[600ms] shadow-sm" style={{ width: `${width}%` }} />
                      </div>
                      <span className="text-sm font-black text-[var(--navy)] w-10 text-right">{item.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* COMBINED PDF PANEL MODAL */}
      {showCombinedPDF && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-6 bg-[var(--navy)] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Generate Full Report</h3>
                  <p className="text-xs text-slate-400">Combined MIS Register across all stages</p>
                </div>
              </div>
              <button onClick={() => setShowCombinedPDF(false)} className="p-2 hover:bg-white/10 rounded-full transition-all">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Filter by Division (Optional)</label>
                  <select 
                    value={combinedFilters.division}
                    onChange={e => setCombinedFilters({ ...combinedFilters, division: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:border-[var(--teal)] outline-none"
                  >
                    <option value="">All Divisions</option>
                    {divisions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">From Date</label>
                    <input 
                      type="date"
                      value={combinedFilters.dateFrom}
                      onChange={e => setCombinedFilters({ ...combinedFilters, dateFrom: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:border-[var(--teal)] outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">To Date</label>
                    <input 
                      type="date"
                      value={combinedFilters.dateTo}
                      onChange={e => setCombinedFilters({ ...combinedFilters, dateTo: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:border-[var(--teal)] outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                <AlertCircle size={20} className="text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  This will generate a comprehensive multi-page PDF covering **Under Approval**, **Tender**, and **Awarded** progress. Large datasets may take a few seconds to process.
                </p>
              </div>

              <button 
                onClick={generateCombinedPDF}
                disabled={combinedLoading}
                className="w-full py-4 bg-[var(--navy)] text-white rounded-2xl font-bold uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
              >
                {combinedLoading ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
                Download Full MIS PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #root, #root * { visibility: hidden; }
          .bg-white.rounded-\[24px\] { visibility: visible; position: absolute; left: 0; top: 0; width: 100%; }
          .bg-white.rounded-\[24px\] * { visibility: visible; }
          .no-print, button, .filters-area { display: none !important; }
        }
      `}} />
    </div>
  );
}

// --- SUB-COMPONENTS ---

function ReportCard({ active, onClick, icon, title, color }: any) {
  const colors: any = {
    purple: "text-purple-600 bg-purple-50",
    sky: "text-sky-600 bg-sky-50",
    teal: "text-teal-600 bg-teal-50",
    rose: "text-rose-600 bg-rose-50",
    indigo: "text-indigo-600 bg-indigo-50"
  };

  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex-1 min-w-[160px] p-5 rounded-[24px] border transition-all text-left flex flex-col group",
        active 
          ? "bg-white border-[var(--navy)] shadow-xl shadow-slate-100 -translate-y-1" 
          : "bg-white border-slate-100 hover:border-slate-200 shadow-sm"
      )}
    >
      <div className={cn("p-2.5 rounded-xl mb-4 self-start transition-colors", active ? colors[color] : "bg-slate-50 text-slate-400 group-hover:text-slate-500")}>
        {icon}
      </div>
      <h3 className={cn("text-[12px] font-bold leading-tight", active ? "text-[var(--navy)]" : "text-slate-500")}>
        {title}
      </h3>
      <div className={cn("mt-auto pt-4 flex items-center gap-1 transition-all", active ? "opacity-100" : "opacity-0 transform translate-x-2")}>
        <span className="text-[10px] font-bold text-[var(--teal)] uppercase tracking-wider">Viewing</span>
        <ArrowRight size={12} className="text-[var(--teal)]" />
      </div>
    </button>
  );
}

function ResultsHeader({ title, count, onExcel, onPDF, hideQuickActions }: any) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-slate-50 pb-6">
      <div className="flex items-center gap-3">
        <h2 className="font-bold text-[var(--navy)] text-lg">{title}</h2>
        {count !== undefined && <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md text-[10px] font-bold">{count} Records</span>}
      </div>
      {!hideQuickActions && (
        <div className="flex items-center gap-2">
          <button onClick={onExcel} className="p-2 bg-white border border-slate-100 rounded-xl text-slate-500 hover:text-[var(--teal)] hover:border-[var(--teal)] transition-all flex items-center gap-2 px-4 shadow-sm">
            <Download size={16} />
            <span className="text-xs font-bold">Excel</span>
          </button>
          <button onClick={onPDF} className="p-2 bg-white border border-slate-100 rounded-xl text-slate-500 hover:text-rose-500 hover:border-rose-500 transition-all flex items-center gap-2 px-4 shadow-sm">
            <Printer size={16} />
            <span className="text-xs font-bold">Print</span>
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, text }: any) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center opacity-20 text-slate-400">
      {icon}
      <p className="mt-4 text-sm font-medium">{text}</p>
    </div>
  );
}

function TableEmptyState({ icon, text, colSpan = 10 }: any) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <EmptyState icon={icon} text={text} />
      </td>
    </tr>
  );
}

function IndianRupee({ size, className }: any) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 3h12" /><path d="M6 8h12" /><path d="m6 13 8.5 8" /><path d="M6 13h3" /><path d="M9 13c6.667 0 6.667-10 0-10" />
    </svg>
  );
}

function BGSection({ title, color, data, fmtCurrency, fmtDate }: any) {
  const headerClass = color === 'rose' ? 'bg-rose-50 text-rose-700 border-rose-100' : color === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-teal-50 text-teal-700 border-teal-100';
  return (
    <div className="space-y-4">
      <div className={cn("px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest border inline-block", headerClass)}>{title}</div>
      <div className="overflow-x-auto border border-slate-100 rounded-[20px]">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-slate-50/50 text-left text-slate-400 font-bold uppercase tracking-widest">
              <th className="px-5 py-4 border-b border-slate-100">BG No</th>
              <th className="px-5 py-4 border-b border-slate-100">Contractor</th>
              <th className="px-5 py-4 border-b border-slate-100">Amount</th>
              <th className="px-5 py-4 border-b border-slate-100">Expiry</th>
              <th className="px-5 py-4 border-b border-slate-100">Days</th>
              <th className="px-5 py-4 border-b border-slate-100">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.map((bg: any) => {
              const days = bg.days_remaining;
              const daysColor = days < 0 ? "text-rose-500" : days <= 30 ? "text-amber-600 font-bold" : "text-teal-600";
              return (
                <tr key={bg.bg_id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-5 py-4 font-black text-[var(--navy)]">{bg.bg_number}</td>
                  <td className="px-5 py-4 text-slate-600 font-medium">{bg.agency_name}</td>
                  <td className="px-5 py-4 font-black text-[var(--navy)]">{fmtCurrency(bg.bg_amount)}</td>
                  <td className="px-5 py-4 text-slate-500">{fmtDate(bg.extended_expiry_date || bg.expiry_date)}</td>
                  <td className={cn("px-5 py-4", daysColor)}>{days < 0 ? `Overdue` : `${days} days`}</td>
                  <td className="px-5 py-4">
                    <span className={cn("px-2 py-1 rounded-md text-[10px] font-bold border", bg.bg_status === 'Active' ? "bg-teal-50 text-teal-700 border-teal-100" : "bg-slate-50 text-slate-600")}>{bg.bg_status}</span>
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

function StageBox({ label, count }: any) {
  return (
    <div className="bg-[var(--navy)] p-6 rounded-[24px] text-white text-center shadow-xl shadow-slate-100">
      <div className="text-3xl font-black mb-1">{count}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest opacity-50">{label}</div>
    </div>
  );
}
