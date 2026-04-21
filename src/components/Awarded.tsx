import { useState, useEffect, useRef } from 'react';
import { 
  Search, Filter, MoreVertical, Calendar,
  IndianRupee, Tag, CheckCircle2, Clock,
  AlertCircle, TrendingUp, X, ChevronRight, ChevronLeft, Save, Loader2,
  Shield, PenLine, Plus, Upload, ExternalLink, Trash2,
  FileDown, Printer, Download, GitBranch
} from 'lucide-react';
import { cn } from '../lib/utils';
import { AwardedRecord, User, MasterData } from '../types';
import { format, addDays, addMonths, differenceInDays } from 'date-fns';
import { api } from '../services/api';
import { supabase } from '../lib/supabase';
import { playSound } from '../lib/sounds';
import { toast } from '../lib/toast';
import ErrorMessage from './ErrorMessage';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const EXPORT_FILENAME = 'Awarded_Works_Register';
const EXPORT_TITLE = 'Awarded Works Management Register';
const STATUS_COLUMN = 'overall_status';
const STATUS_OPTIONS = [
  'Not Started','In Progress','Delayed','Completed','On Hold'
];
const ALL_COLUMNS = [
  { key: 'awarded_id',         label: 'Awarded ID' },
  { key: 'tender_no',          label: 'Tender No' },
  { key: 'name_of_work',       label: 'Name of Work' },
  { key: 'division',           label: 'Division' },
  { key: 'section',            label: 'Section' },
  { key: 'contractor_name',    label: 'Contractor' },
  { key: 'awarded_cost',       label: 'Awarded Cost' },
  { key: 'work_order_no',      label: 'WO No' },
  { key: 'work_order_date',    label: 'WO Date' },
  { key: 'start_date',         label: 'Start Date' },
  { key: 'scheduled_completion', label: 'Scheduled Comp' },
  { key: 'revised_completion', label: 'Revised Comp' },
  { key: 'actual_completion',  label: 'Actual Comp' },
  { key: 'physical_progress_percent', label: 'Progress %' },
  { key: 'overall_status',     label: 'Status' },
  { key: 'payment_released',   label: 'Payment Released' },
  { key: 'payment_pending',    label: 'Payment Pending' },
  { key: 'last_updated',       label: 'Last Updated' },
];

export default function Awarded() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<AwardedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [divisions, setDivisions] = useState<MasterData[]>([]);

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    division: '',
    section: '',
    status: '',
    dateFrom: '',
    dateTo: ''
  });
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewed, setPreviewed] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Modals State
  const [editingRecord, setEditingRecord] = useState<AwardedRecord | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [editForm, setEditForm] = useState<Partial<AwardedRecord>>({});
  const [submitting, setSubmitting] = useState(false);

  const [paymentRecord, setPaymentRecord] = useState<AwardedRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [progressPopup, setProgressPopup] = useState<{ id: string, value: number, x: number, y: number } | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [timelineRecord, setTimelineRecord] = useState<any | null>(null);
  const [timelineData, setTimelineData] = useState<{
    planning: any | null;
    approval: any | null;
    tender: any | null;
    awarded: any | null;
  } | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const fetchData = () => {
    setLoading(true);
    api.getAwardedRecords()
      .then(setRecords)
      .catch(err => {
        playSound('error');
        toast.error('Error', err.message || "Failed to load awarded records");
        setError(err.message || "Failed to load awarded records");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const user = localStorage.getItem('meed_user');
    if (user) setCurrentUser(JSON.parse(user));
    api.getDivisions().then(setDivisions).catch(console.error);
  }, []);

  const previewQuery = async () => {
    setExporting(true);
    try {
      let query = supabase
        .from('awarded_works')
        .select('*', { count: 'exact', head: true });
      
      if (exportFilters.division) 
        query = query.eq('division', exportFilters.division);
      if (exportFilters.section) 
        query = query.ilike('section', `%${exportFilters.section}%`);
      if (exportFilters.status) 
        query = query.eq(STATUS_COLUMN, exportFilters.status);
      if (exportFilters.dateFrom) 
        query = query.gte('last_updated', exportFilters.dateFrom);
      if (exportFilters.dateTo) 
        query = query.lte('last_updated', exportFilters.dateTo + 'T23:59:59');
      
      const { count } = await query;
      setPreviewCount(count || 0);
      setPreviewed(true);
    } catch (err: any) {
      console.error("Preview failed", err);
    } finally {
      setExporting(false);
    }
  };

  const fetchExportData = async () => {
    let query = supabase
      .from('awarded_works')
      .select('*');
    
    if (exportFilters.division) 
      query = query.eq('division', exportFilters.division);
    if (exportFilters.section) 
      query = query.ilike('section', `%${exportFilters.section}%`);
    if (exportFilters.status) 
      query = query.eq(STATUS_COLUMN, exportFilters.status);
    if (exportFilters.dateFrom) 
      query = query.gte('last_updated', exportFilters.dateFrom);
    if (exportFilters.dateTo) 
      query = query.lte('last_updated', exportFilters.dateTo + 'T23:59:59');
    
    const { data } = await query.order('last_updated', { ascending: false });
    return data || [];
  };

  const handleExcelExport = async () => {
    setExporting(true);
    try {
      const data = await fetchExportData();
      const cols = ALL_COLUMNS.filter(c => selectedCols.includes(c.key));
      const headers = cols.map(c => c.label);
      const rows = data.map(row => cols.map(c => row[c.key] ?? ''));
      
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!ws[addr]) continue;
        ws[addr].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '0B1F3A' } },
          alignment: { horizontal: 'center' }
        };
      }
      
      ws['!cols'] = cols.map((c) => ({
        wch: Math.max(c.label.length, ...data.map(row => String(row[c.key] ?? '').length)) + 2
      }));
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      XLSX.writeFile(wb, `${EXPORT_FILENAME}.xlsx`);
    } catch (err) {
      console.error("Excel export failed", err);
    } finally {
      setExporting(false);
    }
  };

  const handlePDFExport = async () => {
    setExporting(true);
    try {
      const data = await fetchExportData();
      const cols = ALL_COLUMNS.filter(c => selectedCols.includes(c.key));
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      
      doc.setFillColor(11, 31, 58);
      doc.rect(0, 0, 297, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('MbPA MEED Portal', 10, 9);
      doc.setTextColor(0, 201, 167);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Mumbai Port Authority — Mechanical & Electrical Engineering Department', 10, 16);
      
      doc.setTextColor(11, 31, 58);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(EXPORT_TITLE, 10, 32);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      const now = new Date().toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      
      const filterParts = [];
      if (exportFilters.division) filterParts.push(`Division: ${exportFilters.division}`);
      if (exportFilters.section) filterParts.push(`Section: ${exportFilters.section}`);
      if (exportFilters.status) filterParts.push(`Status: ${exportFilters.status}`);
      if (exportFilters.dateFrom) filterParts.push(`From: ${exportFilters.dateFrom}`);
      if (exportFilters.dateTo) filterParts.push(`To: ${exportFilters.dateTo}`);
      const filterText = filterParts.length > 0 ? filterParts.join(' | ') : 'All records';
      
      doc.text(`Generated: ${now}  |  Records: ${data.length}  |  Filters: ${filterText}`, 10, 39);
      doc.setDrawColor(0, 201, 167);
      doc.setLineWidth(0.5);
      doc.line(10, 42, 287, 42);
      
      autoTable(doc, {
        startY: 46,
        head: [cols.map(c => c.label)],
        body: data.map(row => cols.map(c => String(row[c.key] ?? ''))),
        headStyles: { fillColor: [11, 31, 58], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'left' },
        bodyStyles: { fontSize: 7, textColor: [45, 55, 72] },
        alternateRowStyles: { fillColor: [240, 244, 248] },
        styles: { cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.1, overflow: 'linebreak' },
        margin: { left: 10, right: 10 }
      });
      
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${i} of ${pages}  |  MbPA MEED Portal  |  Confidential`, 148, 205, { align: 'center' });
      }
      
      doc.save(`${EXPORT_FILENAME}.pdf`);
    } catch (err) {
      console.error("PDF export failed", err);
    } finally {
      setExporting(false);
    }
  };

  const fetchTimeline = async (record: any) => {
    setTimelineRecord(record);
    window.dispatchEvent(new Event('modal-open'));
    setTimelineLoading(true);
    try {
      const [planning, approval, tender] = await Promise.all([
        record.plan_id 
          ? supabase.from('planning').select('*')
              .eq('plan_id', record.plan_id).single()
          : Promise.resolve({ data: null }),
        record.approval_id
          ? supabase.from('under_approval').select('*')
              .eq('approval_id', record.approval_id).single()
          : Promise.resolve({ data: null }),
        record.tender_id
          ? supabase.from('tender').select('*')
              .eq('tender_id', record.tender_id).single()
          : Promise.resolve({ data: null }),
      ]);
      
      setTimelineData({
        planning: planning.data,
        approval: approval.data,
        tender: tender.data,
        awarded: record
      });
    } catch (err) {
      console.error('Timeline fetch error:', err);
    } finally {
      setTimelineLoading(false);
    }
  };

  // --- AUTO CALCULATIONS ---
  const fmtCurrency = (n: number) => {
    if (!n) return 'Rs.0';
    if (n >= 10000000) return 'Rs.' + (n / 10000000).toFixed(2) + ' Cr';
    if (n >= 100000) return 'Rs.' + (n / 100000).toFixed(2) + ' L';
    return 'Rs.' + n.toLocaleString('en-IN');
  };

  const fmtDate = (d: string) => d ? format(new Date(d), 'dd MMM yyyy') : '-';

  const calcScheduled = (startDate: string, periodDays: number) => {
    if (!startDate || !periodDays) return '';
    return format(addDays(new Date(startDate), periodDays), 'yyyy-MM-dd');
  };

  const calcRevised = (scheduledDate: string, eotDays: number) => {
    if (!scheduledDate) return '';
    return format(addDays(new Date(scheduledDate), eotDays || 0), 'yyyy-MM-dd');
  };

  const calcDelayDays = (revisedDate: string, actualDate?: string) => {
    if (!revisedDate) return 0;
    const compareDate = actualDate ? new Date(actualDate) : new Date();
    const diff = Math.floor((compareDate.getTime() - new Date(revisedDate).getTime()) / 86400000);
    return Math.max(0, diff);
  };

  const calcDLP = (actualCompletionDate: string) => {
    if (!actualCompletionDate) return { start: '', end: '' };
    const start = actualCompletionDate;
    const end = format(addMonths(new Date(actualCompletionDate), 12), 'yyyy-MM-dd');
    return { start, end };
  };

  // --- HANDLERS ---
  const handleEdit = (record: AwardedRecord) => {
    setEditingRecord(record);
    window.dispatchEvent(new Event('modal-open'));
    setEditForm(record);
    setActiveTab(0);
  };

  const updateField = (field: keyof AwardedRecord, value: any) => {
    const updated = { ...editForm, [field]: value };

    // Auto-calcs
    if (field === 'start_date' || field === 'completion_period_days') {
      const start = field === 'start_date' ? value : updated.start_date;
      const period = field === 'completion_period_days' ? Number(value) : Number(updated.completion_period_days);
      if (start && period) {
        updated.scheduled_completion = calcScheduled(start, period);
        updated.revised_completion = calcRevised(updated.scheduled_completion, Number(updated.eot_days) || 0);
      }
    }

    if (field === 'eot_days') {
      if (updated.scheduled_completion) {
        updated.revised_completion = calcRevised(updated.scheduled_completion, Number(value));
      }
    }

    if (field === 'revised_completion' || field === 'actual_completion') {
      updated.delay_days = calcDelayDays(updated.revised_completion || '', updated.actual_completion);
    }

    if (field === 'actual_completion' && value) {
      const dlp = calcDLP(value);
      updated.dlp_end_date = dlp.end;
      updated.dlp_status = 'In Progress';
    }

    if (field === 'extra_amount' || field === 'awarded_cost') {
      updated.revised_contract_value = (Number(updated.awarded_cost) || 0) + (Number(updated.extra_amount) || 0);
    }

    // Deduction calculations removed per request

    if (field === 'total_bills_value' || field === 'payment_released') {
      updated.payment_pending = (Number(updated.total_bills_value) || 0) - (Number(updated.payment_released) || 0);
    }

    setEditForm(updated);
  };

  const handleSave = async () => {
    if (!editingRecord || !currentUser) return;
    setSubmitting(true);
    try {
      await api.updateAwardedRecord(editingRecord.awarded_id, {
        ...editForm,
        last_updated: new Date().toISOString()
      });
      
      await api.logActivity('UPDATE', 'AWARDED_WORKS', editingRecord.awarded_id, `Awarded work updated by ${currentUser.name}`, currentUser);
      
      playSound('save');
      toast.success('Saved', 'Record updated successfully');
      setEditingRecord(null);
      window.dispatchEvent(new Event('modal-close'));
      fetchData();
    } catch (err: any) {
      playSound('error');
      toast.error('Error', err.message);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSave = async () => {
    if (!paymentRecord || !paymentAmount || !currentUser) return;
    setSubmitting(true);
    try {
      const amount = Number(paymentAmount);
      const newReleased = (paymentRecord.payment_released || 0) + amount;
      const newPending = (paymentRecord.awarded_cost || 0) - newReleased;

      await api.updateAwardedRecord(paymentRecord.awarded_id, {
        payment_released: newReleased,
        payment_pending: newPending,
        last_bill_date: paymentDate,
        last_updated: new Date().toISOString()
      });

      await api.logActivity('PAYMENT_UPDATE', 'AWARDED_WORKS', paymentRecord.awarded_id, `Payment of ${fmtCurrency(amount)} released by ${currentUser.name}`, currentUser);

      playSound('save');
      toast.success('Payment Released', `Released ${fmtCurrency(amount)}`);
      setPaymentRecord(null);
      window.dispatchEvent(new Event('modal-close'));
      setPaymentAmount('');
      fetchData();
    } catch (err: any) {
      playSound('error');
      toast.error('Error', err.message);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleProgressSave = async () => {
    if (!progressPopup || !currentUser) return;
    try {
      const val = progressPopup.value;
      await api.updateAwardedRecord(progressPopup.id, {
        physical_progress_percent: String(val),
        overall_status: val >= 100 ? 'Completed' : 'In Progress',
        last_updated: new Date().toISOString()
      });

      playSound('save');
      toast.success('Progress Updated', `${val}% physical progress`);
      setProgressPopup(null);
      fetchData();
    } catch (err: any) {
      playSound('error');
      toast.error('Error', err.message);
      console.error(err);
    }
  };

  const handleFileUpload = async (file: File, field: 'work_order_document' | 'completion_certificate') => {
    if (!editingRecord) return;
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${editingRecord.awarded_id}_${field}_${Date.now()}.${fileExt}`;
      const filePath = `awarded_works/${editingRecord.awarded_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('meed-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('meed-documents')
        .getPublicUrl(filePath);

      updateField(field, publicUrl);
      playSound('save');
      toast.success('Upload Successful', 'Document attached to record');
    } catch (err: any) {
      playSound('error');
      toast.error('Upload Failed', err.message);
    }
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = (r.name_of_work?.toLowerCase() || '').includes(search.toLowerCase()) ||
                         (r.tender_no?.toLowerCase() || '').includes(search.toLowerCase()) ||
                         (r.contractor_name?.toLowerCase() || '').includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || r.overall_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="p-10 text-center">Loading awarded records...</div>;
  if (error) return <ErrorMessage error={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Filters */}
      <div className="bg-white rounded-[16px] p-6 border border-[var(--border)] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <h2 className="font-display text-lg font-bold text-[var(--navy)]">Awarded Works</h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">Manage contract execution, progress, and payments</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5">
            <button 
              onClick={() => {
                setSelectedCols(ALL_COLUMNS.map(c => c.key));
                setShowExportModal(true);
                window.dispatchEvent(new Event('modal-open'));
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#0B1F3A] text-white rounded-[12px] text-[13px] font-bold hover:bg-[#1a2f4d] transition-all shadow-lg shadow-[#0B1F3A]/20"
              title="Export Data"
            >
              <FileDown size={16} />
              Export
            </button>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input 
                type="text" 
                placeholder="Search works..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 bg-[var(--paper)] border border-[var(--border)] rounded-[12px] text-[13px] outline-none focus:border-[var(--teal)] focus:bg-white transition-all w-full md:w-[200px]"
              />
            </div>

            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-white border border-[var(--border)] rounded-[12px] text-[13px] font-semibold outline-none focus:border-[var(--teal)]"
            >
              <option value="All">All Status</option>
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Delayed">Delayed</option>
              <option value="Completed">Completed</option>
              <option value="On Hold">On Hold</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-[16px] border border-[var(--border)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-[var(--paper)]">
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Tender No.</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Name of Work</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Contractor</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Awarded Cost</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">WO Date</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Scheduled Comp.</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Delay</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Progress</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Payment</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Status</th>
                <th className="px-6 py-3 text-right text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredRecords.map((r) => {
                const daysLeft = Math.ceil((new Date(r.scheduled_completion).getTime() - new Date().getTime()) / 86400000);
                const delayDays = Number(r.delay_days) || 0;
                const delayColor = delayDays > 0 ? 'text-[var(--rose)]' : daysLeft < 30 ? 'text-[var(--amber)]' : 'text-[var(--teal)]';
                const prog = Number(r.physical_progress_percent) || 0;
                const progColor = prog >= 75 ? 'bg-[var(--teal)]' : prog >= 40 ? 'bg-[var(--amber)]' : 'bg-[var(--rose)]';
                const payPct = ((r.payment_released || 0) / (r.awarded_cost || 1)) * 100;

                return (
                  <tr key={r.awarded_id} className="hover:bg-[var(--teal)]/[0.02] transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <strong className="text-[12px] text-[var(--navy)]">{r.tender_no}</strong>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[12px] font-bold text-[var(--navy)] line-clamp-2 max-w-[200px] leading-tight">
                        {r.name_of_work}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[11px] font-semibold text-[var(--muted2)] truncate max-w-[120px]">{r.contractor_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-[12px] font-bold text-[var(--navy)]">
                      {fmtCurrency(r.awarded_cost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-[11px] font-medium text-[var(--muted2)]">
                      {r.work_order_date ? format(new Date(r.work_order_date), 'dd-MMM-yy') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-[11px] font-medium text-[var(--muted2)]">
                      {r.scheduled_completion ? format(new Date(r.scheduled_completion), 'dd-MMM-yy') : '-'}
                    </td>
                    <td className={cn("px-6 py-4 whitespace-nowrap text-[11px] font-bold", delayColor)}>
                      {delayDays > 0 ? `${delayDays}d late` : `${Math.max(0, daysLeft)}d left`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div 
                        className="cursor-pointer group/prog"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setProgressPopup({ id: r.awarded_id, value: prog, x: rect.left, y: rect.bottom + window.scrollY });
                        }}
                      >
                        <div className="w-20 h-1.5 bg-[var(--paper)] rounded-full overflow-hidden mb-1">
                          <div className={cn("h-full rounded-full transition-all duration-500", progColor)} style={{ width: `${prog}%` }} />
                        </div>
                        <div className="text-[10px] font-bold text-[var(--navy)]">{prog}%</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-20 h-1.5 bg-[var(--paper)] rounded-full overflow-hidden mb-1">
                        <div className="h-full bg-[var(--teal)] rounded-full" style={{ width: `${payPct}%` }} />
                      </div>
                      <div className="text-[9px] font-bold text-[var(--muted)]">{fmtCurrency(r.payment_released)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize",
                        r.overall_status === 'Completed' ? "bg-green-50 text-green-700 border-green-100" :
                        r.overall_status === 'Delayed' ? "bg-rose-50 text-rose-700 border-rose-100" :
                        r.overall_status === 'In Progress' ? "bg-sky-50 text-sky-700 border-sky-100" :
                        "bg-slate-50 text-slate-700 border-slate-100"
                      )}>
                        {r.overall_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleEdit(r)} className="p-1.5 text-[var(--muted)] hover:text-[var(--teal)] hover:bg-[var(--teal)]/10 rounded-lg transition-all">
                          <PenLine size={14} />
                        </button>
                        <button onClick={() => {
                          setPaymentRecord(r);
                          window.dispatchEvent(new Event('modal-open'));
                        }} className="p-1.5 text-[var(--muted)] hover:text-[var(--teal)] hover:bg-[var(--teal)]/10 rounded-lg transition-all">
                          <IndianRupee size={14} />
                        </button>
                        <button onClick={() => navigate('/bg')} className="p-1.5 text-[var(--muted)] hover:text-[var(--teal)] hover:bg-[var(--teal)]/10 rounded-lg transition-all">
                          <Shield size={14} />
                        </button>
                        <button
                          onClick={() => fetchTimeline(r)}
                          className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                          title="View Work Timeline"
                        >
                          <GitBranch size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Timeline Panel */}
      {timelineRecord && (
        <div className="fixed inset-0 z-[90] flex">
          {/* Backdrop */}
          <div 
            className="flex-1 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => { 
              setTimelineRecord(null); 
              setTimelineData(null); 
            }}
          />
          
          {/* Panel */}
          <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300">
            
            {/* Panel Header */}
            <div className="sticky top-0 bg-[var(--navy)] px-6 py-4 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">
                    Work Timeline
                  </h3>
                  <p className="text-white/50 text-[11px] mt-0.5 line-clamp-1">
                    {timelineRecord.name_of_work}
                  </p>
                </div>
                <button
                  onClick={() => { 
                    setTimelineRecord(null); 
                    setTimelineData(null); 
                  }}
                  className="p-2 hover:bg-white/10 rounded-xl transition-all"
                >
                  <X size={18} className="text-white/60" />
                </button>
              </div>
            </div>
            
            {/* Timeline Content */}
            <div className="p-6">
              {timelineLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                  <Loader2 size={32} className="animate-spin text-[var(--teal)]" />
                  <p className="text-sm font-medium">
                    Loading timeline...
                  </p>
                </div>
              ) : timelineData ? (
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-100" />
                  
                  <div className="space-y-0">
                  
                    {/* STAGE 1 — PLANNING */}
                    <TimelineStage
                      done={!!timelineData.planning}
                      active={!timelineData.approval}
                      icon="💡"
                      title="Planning"
                      date={timelineData.planning?.added_on}
                      details={timelineData.planning ? [
                        { label: 'Plan ID', value: timelineData.planning.plan_id },
                        { label: 'Priority', value: timelineData.planning.priority },
                        { label: 'Added by', value: timelineData.planning.added_by },
                      ] : []}
                      pending={!timelineData.planning}
                    />
                    
                    {/* STAGE 2 — UNDER APPROVAL */}
                    <TimelineStage
                      done={!!timelineData.approval?.ca_date}
                      active={!!timelineData.approval && !timelineData.tender}
                      icon="📋"
                      title="Under Approval"
                      date={timelineData.approval?.added_on}
                      details={timelineData.approval ? [
                        { label: 'Estimate No', value: timelineData.approval.estimate_no },
                        { label: 'Est. Cost', value: timelineData.approval.estimated_cost 
                          ? fmtCurrency(timelineData.approval.estimated_cost) : null },
                        { label: 'Work Type', value: timelineData.approval.work_type },
                        { label: 'Competent Authority', value: timelineData.approval.competent_authority },
                        { label: 'FC No', value: timelineData.approval.fc_no },
                        { label: 'FC Date', value: timelineData.approval.fc_date 
                          ? fmtDate(timelineData.approval.fc_date) : null },
                        { label: 'CA Approval', value: timelineData.approval.ca_date 
                          ? fmtDate(timelineData.approval.ca_date) : null },
                        { label: 'Stage', value: timelineData.approval.current_stage },
                      ] : []}
                      pending={!timelineData.approval}
                    />

                    {/* STAGE 3 — TENDER */}
                    <TimelineStage
                      done={timelineData.tender?.current_stage === 'Awarded'}
                      active={!!timelineData.tender && !timelineData.awarded?.work_order_no}
                      icon="📄"
                      title="Tender"
                      date={timelineData.tender?.added_on}
                      details={timelineData.tender ? [
                        { label: 'Tender No', value: timelineData.tender.tender_no },
                        { label: 'Tender Type', value: timelineData.tender.tender_type },
                        { label: 'Float Date', value: timelineData.tender.tender_float_date 
                          ? fmtDate(timelineData.tender.tender_float_date) : null },
                        { label: 'Bids Received', value: timelineData.tender.no_of_bids_received 
                          ? String(timelineData.tender.no_of_bids_received) : null },
                        { label: 'L1 Bidder', value: timelineData.tender.l1_bidder_name },
                        { label: 'L1 Amount', value: timelineData.tender.l1_amount 
                          ? fmtCurrency(timelineData.tender.l1_amount) : null },
                        { label: 'L1 %', value: timelineData.tender.l1_percentage },
                        { label: 'Award Status', value: timelineData.tender.award_status },
                      ] : []}
                      pending={!timelineData.tender}
                    />

                    {/* STAGE 4 — AWARDED */}
                    <TimelineStage
                      done={timelineData.awarded?.overall_status === 'Completed'}
                      active={!!timelineData.awarded?.work_order_no && timelineData.awarded?.overall_status !== 'Completed'}
                      icon="🤝"
                      title="Awarded"
                      date={timelineData.awarded?.work_order_date || timelineData.awarded?.added_on}
                      details={[
                        { label: 'WO No', value: timelineData.awarded.work_order_no || timelineData.awarded.gem_contract_no },
                        { label: 'WO Date', value: timelineData.awarded.work_order_date 
                          ? fmtDate(timelineData.awarded.work_order_date) : null },
                        { label: 'Contractor', value: timelineData.awarded.contractor_name },
                        { label: 'Awarded Cost', value: fmtCurrency(timelineData.awarded.awarded_cost) },
                        { label: 'Start Date', value: timelineData.awarded.start_date 
                          ? fmtDate(timelineData.awarded.start_date) : null },
                        { label: 'Progress', value: timelineData.awarded.physical_progress_percent 
                          ? `${timelineData.awarded.physical_progress_percent}%` : null },
                        { label: 'Delay', value: timelineData.awarded.delay_days 
                          ? `${timelineData.awarded.delay_days} days` : null },
                        { label: 'Status', value: timelineData.awarded.overall_status },
                      ]}
                      pending={!timelineData.awarded?.work_order_no}
                    />

                    {/* STAGE 5 — COMPLETION */}
                    <TimelineStage
                      done={timelineData.awarded?.overall_status === 'Completed'}
                      active={false}
                      icon="✅"
                      title="Completed"
                      date={timelineData.awarded?.actual_completion}
                      details={timelineData.awarded?.overall_status === 'Completed' ? [
                        { label: 'Completion Date', value: timelineData.awarded.actual_completion 
                          ? fmtDate(timelineData.awarded.actual_completion) : null },
                        { label: 'Payment Released', value: fmtCurrency(timelineData.awarded.payment_released) },
                        { label: 'DLP End', value: timelineData.awarded.dlp_end_date 
                          ? fmtDate(timelineData.awarded.dlp_end_date) : null },
                      ] : []}
                      pending={timelineData.awarded?.overall_status !== 'Completed'}
                    />

                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* 5-TAB EDIT MODAL */}
      {editingRecord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Title Bar */}
            <div className="bg-white px-6 py-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[var(--navy)]">Edit Awarded Work</h3>
                <button onClick={() => {
                  setEditingRecord(null);
                  window.dispatchEvent(new Event('modal-close'));
                }} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
            </div>

            {/* Info Strip */}
            <div className="bg-[var(--navy)] px-6 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-[10px] text-white/70 font-medium">
              <span>ID: <b className="text-white">{editingRecord.awarded_id}</b></span>
              <span>Tender: <b className="text-white">{editingRecord.tender_no}</b></span>
              <span>Division: <b className="text-white">{editingRecord.division}</b></span>
              <span>Section: <b className="text-white">{editingRecord.section}</b></span>
              <span>Authority: <b className="text-white">{editingRecord.competent_authority}</b></span>
            </div>

            {/* Financial Summary Bar */}
            <div className="bg-slate-50 border-b border-slate-100 px-4 py-2">
              <div className="flex flex-wrap items-center justify-between gap-y-1">
                <FinStat label="Awarded" value={editForm.awarded_cost} color="text-[var(--navy)]" />
                <FinStat label="Extra / Excess" value={editForm.extra_amount || 0} color="text-amber-600" />
                <FinStat 
                  label="Revised Contract" 
                  value={(Number(editForm.awarded_cost) || 0) + (Number(editForm.extra_amount) || 0)} 
                  color="text-[var(--navy)]"
                  bold
                />
                <FinStat label="Negotiated" value={editForm.negotiated_amount || 0} color="text-purple-600" />
                <FinStat label="Bills Submitted" value={editForm.total_bills_value || 0} color="text-sky-600" />
                <FinStat label="Released" value={editForm.payment_released || 0} color="text-[var(--teal)]" />
                <FinStat label="Pending" value={editForm.payment_pending || 0} color="text-rose-600" bold />
              </div>
            </div>

            {/* Tab Bar */}
            <div className="bg-white border-b border-slate-100 flex px-6 gap-8">
              {['Contract', 'Progress', 'Payments', 'BG/DLP', 'Closure'].map((tab, i) => (
                <button 
                  key={tab}
                  onClick={() => {
                    playSound('tick');
                    setActiveTab(i);
                  }}
                  className={cn(
                    "pb-3 pt-3 text-xs font-bold uppercase tracking-wider transition-all relative",
                    activeTab === i ? "text-[var(--teal)]" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {tab}
                  {activeTab === i && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--teal)] rounded-full" />}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
              {activeTab === 0 && (
                <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-[11px] font-bold text-[var(--teal)] uppercase tracking-widest border-b border-slate-100 pb-1">Contractor Details</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Contractor Name" value={editForm.contractor_name} onChange={v => updateField('contractor_name', v)} />
                        <Field label="Contact Person" value={editForm.contact_person} onChange={v => updateField('contact_person', v)} />
                        <Field label="Mobile" value={editForm.contractor_mobile} onChange={v => updateField('contractor_mobile', v)} />
                        <Field label="Address" value={editForm.contractor_address} onChange={v => updateField('contractor_address', v)} />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-[11px] font-bold text-[var(--teal)] uppercase tracking-widest border-b border-slate-100 pb-1">Work Order / Contract</h4>
                      
                      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                        <button 
                          onClick={() => updateField('is_gem', true)}
                          className={cn(
                            "px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all",
                            editForm.is_gem ? "bg-[var(--teal)] text-white" : "bg-white text-slate-500 border border-slate-200"
                          )}
                        >
                          GeM Work
                        </button>
                        <button 
                          onClick={() => updateField('is_gem', false)}
                          className={cn(
                            "px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all",
                            !editForm.is_gem ? "bg-[var(--teal)] text-white" : "bg-white text-slate-500 border border-slate-200"
                          )}
                        >
                          Non-GeM Work
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {editForm.is_gem ? (
                          <>
                            <Field label="GeM Contract No" value={editForm.gem_contract_no} onChange={v => updateField('gem_contract_no', v)} />
                            <Field label="GeM Contract Date" type="date" value={editForm.gem_contract_date} onChange={v => updateField('gem_contract_date', v)} />
                          </>
                        ) : (
                          <>
                            <Field label="Work Order No" value={editForm.work_order_no} onChange={v => updateField('work_order_no', v)} />
                            <Field label="Work Order Date" type="date" value={editForm.work_order_date} onChange={v => updateField('work_order_date', v)} />
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Post-Award Documents */}
                  <div className="space-y-4">
                    <h4 className="text-[11px] font-bold text-[var(--teal)] uppercase tracking-widest border-b border-slate-100 pb-1">Post-Award Documents</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <SelectField label="Agreement Status" value={editForm.agreement_status} options={['Not Submitted', 'Submitted', 'NA']} onChange={v => updateField('agreement_status', v)} />
                        {editForm.agreement_status === 'Submitted' && (
                          <Field label="Agreement Date" type="date" value={editForm.agreement_date} onChange={v => updateField('agreement_date', v)} />
                        )}
                      </div>
                      <div className="space-y-2">
                        <SelectField label="Integrity Pact" value={editForm.integrity_pact_status} options={['Not Submitted', 'Submitted', 'NA']} onChange={v => updateField('integrity_pact_status', v)} />
                        {editForm.integrity_pact_status === 'Submitted' && (
                          <Field label="Integrity Pact Date" type="date" value={editForm.integrity_pact_date} onChange={v => updateField('integrity_pact_date', v)} />
                        )}
                      </div>
                      <div className="space-y-2">
                        <SelectField label="NDA Agreement" value={editForm.nda_status} options={['Not Submitted', 'Submitted', 'NA']} onChange={v => updateField('nda_status', v)} />
                        {editForm.nda_status === 'Submitted' && (
                          <Field label="NDA Date" type="date" value={editForm.nda_date} onChange={v => updateField('nda_date', v)} />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-[11px] font-bold text-[var(--teal)] uppercase tracking-widest border-b border-slate-100 pb-1">Contract Value</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <DisplayField label="Estimated Cost" value={fmtCurrency(editForm.estimated_cost || 0)} />
                        <DisplayField label="Awarded Cost" value={fmtCurrency(editForm.awarded_cost || 0)} />
                        <DisplayField 
                          label="L1% vs Estimate" 
                          value={editForm.l1_percentage || '0%'} 
                          color={editForm.l1_percentage?.includes('-') ? 'text-[var(--teal)]' : 'text-[var(--rose)]'} 
                        />
                        <Field label="Negotiated Amount" type="number" value={editForm.negotiated_amount} onChange={v => updateField('negotiated_amount', v)} />
                        <Field label="Extra/Excess Amount" type="number" value={editForm.extra_amount} onChange={v => updateField('extra_amount', v)} />
                        <DisplayField label="Revised Contract Value" value={fmtCurrency(editForm.revised_contract_value || 0)} />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-[11px] font-bold text-[var(--teal)] uppercase tracking-widest border-b border-slate-100 pb-1">Mobilisation</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Mobilisation Adv." type="number" value={editForm.mobilisation_advance} onChange={v => updateField('mobilisation_advance', v)} />
                        <Field label="Advance Recovered" type="number" value={editForm.advance_recovered} onChange={v => updateField('advance_recovered', v)} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 1 && (
                <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-[11px] font-bold text-[var(--teal)] uppercase tracking-widest border-b border-slate-100 pb-1">Timeline</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Start Date" type="date" value={editForm.start_date} onChange={v => updateField('start_date', v)} />
                        <Field label="Contract Period (Days)" type="number" value={editForm.completion_period_days} onChange={v => updateField('completion_period_days', v)} />
                        <DisplayField label="Scheduled Completion" value={editForm.scheduled_completion ? format(new Date(editForm.scheduled_completion), 'dd-MMM-yyyy') : '-'} />
                        <Field label="Extension Count" type="number" value={editForm.extension_count} onChange={v => updateField('extension_count', v)} />
                        <Field label="EOT Days" type="number" value={editForm.eot_days} onChange={v => updateField('eot_days', v)} />
                        <DisplayField label="Revised Completion" value={editForm.revised_completion ? format(new Date(editForm.revised_completion), 'dd-MMM-yyyy') : '-'} />
                        <Field label="Actual Completion" type="date" value={editForm.actual_completion} onChange={v => updateField('actual_completion', v)} />
                        <DisplayField label="Delay Days" value={`${editForm.delay_days || 0} days`} color={(editForm.delay_days || 0) > 0 ? 'text-[var(--rose)]' : 'text-[var(--teal)]'} />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-[11px] font-bold text-[var(--teal)] uppercase tracking-widest border-b border-slate-100 pb-1">Progress & Status</h4>
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Physical Progress %</label>
                          <div className="flex items-center gap-4">
                            <input 
                              type="range" min="0" max="100" step="1"
                              value={Number(editForm.physical_progress_percent) || 0}
                              onChange={e => updateField('physical_progress_percent', e.target.value)}
                              className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[var(--teal)]"
                            />
                            <span className="text-sm font-bold text-[var(--navy)] w-10">{editForm.physical_progress_percent || 0}%</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <SelectField label="Overall Status" value={editForm.overall_status} options={['Not Started', 'In Progress', 'On Hold', 'Delayed', 'Completed']} onChange={v => updateField('overall_status', v)} />
                          <SelectField label="Delay Reason" value={editForm.delay_reason} options={['Site Clearance Pending', 'Material Delay', 'Contractor Default', 'Design Change', 'Monsoon', 'Statutory Approval Pending', 'Fund Constraint', 'Other']} onChange={v => updateField('delay_reason', v)} />
                          <SelectField label="LD Applicable" value={editForm.ld_applicable} options={['Yes', 'No', 'Waived']} onChange={v => updateField('ld_applicable', v)} />
                          <Field label="LD Amount" type="number" value={editForm.ld_amount} onChange={v => updateField('ld_amount', v)} />
                          <SelectField label="Performance Rating" value={editForm.performance_rating} options={['Excellent', 'Good', 'Satisfactory', 'Below Average', 'Poor']} onChange={v => updateField('performance_rating', v)} />
                          <Field label="Last Site Visit" type="date" value={editForm.last_site_visit} onChange={v => updateField('last_site_visit', v)} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 2 && (
                <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="grid grid-cols-4 gap-4">
                    <SummaryCard label="Awarded Cost" value={fmtCurrency(editForm.awarded_cost || 0)} color="bg-[var(--navy)]" />
                    <SummaryCard label="Bills Submitted" value={fmtCurrency(editForm.total_bills_value || 0)} color="bg-sky-600" />
                    <SummaryCard label="Released" value={fmtCurrency(editForm.payment_released || 0)} color="bg-[var(--teal)]" />
                    <SummaryCard label="Pending" value={fmtCurrency(editForm.payment_pending || 0)} color="bg-[var(--rose)]" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-[11px] font-bold text-[var(--teal)] uppercase tracking-widest border-b border-slate-100 pb-1">Payment Tracking Cabinet</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Total Bills Submitted" type="number" value={editForm.total_bills_value} onChange={v => updateField('total_bills_value', v)} />
                        <Field label="Date of Last Bill" type="date" value={editForm.last_bill_date} onChange={v => updateField('last_bill_date', v)} />
                        <div className="space-y-1">
                          <DisplayField label="Payment Released" value={fmtCurrency(editForm.payment_released || 0)} />
                          <p className="text-[9px] text-slate-400 font-medium italic px-1">Updated via Payment button</p>
                        </div>
                        <DisplayField label="Payment Pending" value={fmtCurrency(editForm.payment_pending || 0)} color="text-[var(--rose)]" />
                      </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="text-[11px] text-slate-500 font-medium">
                        Payment Release and bill details are tracked here. Use the Payment button in the list to record new releases.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 3 && (
                <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-[11px] font-bold text-[var(--teal)] uppercase tracking-widest border-b border-slate-100 pb-1">Defect Liability Period</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <DisplayField label="DLP Start Date" value={editForm.actual_completion ? format(new Date(editForm.actual_completion), 'dd-MMM-yyyy') : '-'} />
                        <DisplayField label="DLP End Date" value={editForm.dlp_end_date ? format(new Date(editForm.dlp_end_date), 'dd-MMM-yyyy') : '-'} />
                        <SelectField label="DLP Status" value={editForm.dlp_status} options={['Not Started', 'In Progress', 'Completed', 'Extended']} onChange={v => updateField('dlp_status', v)} />
                        <div className="col-span-2">
                          <Field label="DLP Remarks" value={editForm.dlp_remarks} onChange={v => updateField('dlp_remarks', v)} />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-[11px] font-bold text-[var(--teal)] uppercase tracking-widest border-b border-slate-100 pb-1">SD Refund / BG Release</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="SD Refund Date" type="date" value={editForm.sd_refund_date} onChange={v => updateField('sd_refund_date', v)} />
                        <Field label="SD Refund Amount" type="number" value={editForm.sd_refund_amount} onChange={v => updateField('sd_refund_amount', v)} />
                        <Field label="PBG Release Date" type="date" value={editForm.pbg_release_date} onChange={v => updateField('pbg_release_date', v)} />
                        <Field label="PBG Release Letter" value={editForm.pbg_release_letter} onChange={v => updateField('pbg_release_letter', v)} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 4 && (
                <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-[11px] font-bold text-[var(--teal)] uppercase tracking-widest border-b border-slate-100 pb-1">Testing & Handover</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <SelectField label="T&C Status" value={editForm.test_commissioning_status} options={['Pending', 'Done', 'Not Applicable']} onChange={v => updateField('test_commissioning_status', v)} />
                        <Field label="T&C Date" type="date" value={editForm.tc_date} onChange={v => updateField('tc_date', v)} />
                        <SelectField label="As-Built Drawing" value={editForm.as_built_drawing} options={['Pending', 'Submitted', 'Not Applicable']} onChange={v => updateField('as_built_drawing', v)} />
                        <SelectField label="Handing Over Status" value={editForm.handing_over_status} options={['Not Done', 'Partially Done', 'Done']} onChange={v => updateField('handing_over_status', v)} />
                        <Field label="Handing Over Date" type="date" value={editForm.handing_over_date} onChange={v => updateField('handing_over_date', v)} />
                        <SelectField label="Asset Capitalisation" value={editForm.asset_capitalisation} options={['Yes', 'No', 'Not Applicable']} onChange={v => updateField('asset_capitalisation', v)} />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-[11px] font-bold text-[var(--teal)] uppercase tracking-widest border-b border-slate-100 pb-1">Final Account</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Final Bill Amount" type="number" value={editForm.final_bill_amount} onChange={v => updateField('final_bill_amount', v)} />
                        <Field label="Final Bill Date" type="date" value={editForm.final_bill_date} onChange={v => updateField('final_bill_date', v)} />
                        <SelectField label="Final Account Status" value={editForm.final_account_status} options={['Pending', 'Under Review', 'Settled']} onChange={v => updateField('final_account_status', v)} />
                        <Field label="Closure Date" type="date" value={editForm.closure_date} onChange={v => updateField('closure_date', v)} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[11px] font-bold text-[var(--teal)] uppercase tracking-widest border-b border-slate-100 pb-1">Documents</h4>
                    <div className="grid grid-cols-2 gap-6">
                      <FileZone 
                        label="Work Order Document" 
                        url={editForm.work_order_document} 
                        onUpload={f => handleFileUpload(f, 'work_order_document')} 
                        onClear={() => updateField('work_order_document', '')}
                      />
                      <FileZone 
                        label="Completion Certificate" 
                        url={editForm.completion_certificate} 
                        onUpload={f => handleFileUpload(f, 'completion_certificate')} 
                        onClear={() => updateField('completion_certificate', '')}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Remarks</label>
                    <textarea 
                      value={editForm.remarks || ''}
                      onChange={e => updateField('remarks', e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-[var(--teal)] outline-none min-h-[100px]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-medium italic">
                Last saved: {editForm.last_updated ? format(new Date(editForm.last_updated), 'dd MMM yyyy HH:mm') : 'Never'}
              </span>
              <div className="flex gap-3">
                <button onClick={() => {
                  setEditingRecord(null);
                  window.dispatchEvent(new Event('modal-close'));
                }} className="px-5 py-2 text-slate-600 font-bold text-sm hover:bg-slate-100 rounded-xl transition-all">
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2 bg-[var(--teal)] text-white rounded-xl font-bold text-sm hover:bg-[var(--teal2)] transition-all shadow-md disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {paymentRecord && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-[var(--navy)]">Release Payment</h3>
              <button onClick={() => {
                setPaymentRecord(null);
                window.dispatchEvent(new Event('modal-close'));
              }} className="p-1 hover:bg-slate-100 rounded-full">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl space-y-2">
                <p className="text-xs font-bold text-[var(--navy)] line-clamp-2">{paymentRecord.name_of_work}</p>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-medium">
                  <div className="text-slate-500">Awarded Cost: <b className="text-[var(--navy)]">{fmtCurrency(paymentRecord.awarded_cost)}</b></div>
                  <div className="text-slate-500">Released: <b className="text-[var(--teal)]">{fmtCurrency(paymentRecord.payment_released)}</b></div>
                  <div className="text-slate-500">Pending: <b className="text-[var(--rose)]">{fmtCurrency(paymentRecord.payment_pending)}</b></div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Payment Amount (₹)</label>
                  <input 
                    type="number"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-[var(--teal)] outline-none font-mono font-bold"
                    placeholder="Enter amount..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bill Date</label>
                  <input 
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-[var(--teal)] outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => {
                setPaymentRecord(null);
                window.dispatchEvent(new Event('modal-close'));
              }} className="flex-1 py-2 text-slate-600 font-bold text-sm hover:bg-slate-200 rounded-xl transition-all">
                Cancel
              </button>
              <button 
                onClick={handlePaymentSave}
                disabled={submitting || !paymentAmount}
                className="flex-1 py-2 bg-[var(--teal)] text-white rounded-xl font-bold text-sm hover:bg-[var(--teal2)] transition-all shadow-md disabled:opacity-50"
              >
                {submitting ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INLINE PROGRESS POPUP */}
      {progressPopup && (
        <>
          <div className="fixed inset-0 z-[120]" onClick={() => setProgressPopup(null)} />
          <div 
            className="fixed z-[130] bg-white rounded-xl shadow-xl border border-slate-100 p-4 w-[200px] animate-in zoom-in-95 duration-150"
            style={{ left: progressPopup.x, top: progressPopup.y + 8 }}
          >
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Update Progress</p>
            <div className="flex flex-col items-center gap-4">
              <span className="text-3xl font-black text-[var(--teal)]">{progressPopup.value}%</span>
              <input 
                type="range" min="0" max="100" step="5"
                value={progressPopup.value}
                onChange={e => setProgressPopup({ ...progressPopup, value: Number(e.target.value) })}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[var(--teal)]"
              />
              <div className="flex gap-2 w-full">
                <button onClick={() => setProgressPopup(null)} className="flex-1 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button onClick={handleProgressSave} className="flex-1 py-1.5 text-[10px] font-bold bg-[var(--teal)] text-white rounded-lg shadow-sm">Save</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-[600px] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-[#0B1F3A] text-lg">Export {EXPORT_TITLE} Data</h3>
              <button 
                onClick={() => {
                  setShowExportModal(false);
                  setExportFilters({ division: '', section: '', status: '', dateFrom: '', dateTo: '' });
                  setPreviewCount(null);
                  setPreviewed(false);
                }} 
                className="w-10 h-10 rounded-full hover:bg-slate-200/50 flex items-center justify-center text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-8 max-h-[75vh] overflow-y-auto">
              {/* Step 1: Filters */}
              <div className="bg-slate-50 rounded-[24px] p-6 space-y-5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Step 1 — Filter Records</label>
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Division</label>
                    <select 
                      value={exportFilters.division}
                      onChange={(e) => setExportFilters({...exportFilters, division: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] font-medium"
                    >
                      <option value="">All Divisions</option>
                      {divisions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Section</label>
                    <input 
                      type="text"
                      placeholder="Search section..."
                      value={exportFilters.section}
                      onChange={(e) => setExportFilters({...exportFilters, section: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Status</label>
                    <select 
                      value={exportFilters.status}
                      onChange={(e) => setExportFilters({...exportFilters, status: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] font-medium"
                    >
                      <option value="">All Status</option>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">From</label>
                      <input 
                        type="date"
                        value={exportFilters.dateFrom}
                        onChange={(e) => setExportFilters({...exportFilters, dateFrom: e.target.value})}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">To</label>
                      <input 
                        type="date"
                        value={exportFilters.dateTo}
                        onChange={(e) => setExportFilters({...exportFilters, dateTo: e.target.value})}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] font-medium"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Columns */}
              <div className="bg-white border border-slate-100 rounded-[24px] p-6 space-y-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Step 2 — Select Columns</label>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setSelectedCols(ALL_COLUMNS.map(c => c.key))}
                      className="text-[10px] font-bold text-[#00C9A7] hover:underline uppercase tracking-widest"
                    >
                      Select All
                    </button>
                    <button 
                      onClick={() => setSelectedCols([])}
                      className="text-[10px] font-bold text-rose-500 hover:underline uppercase tracking-widest"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-y-3 gap-x-6">
                  {ALL_COLUMNS.map(col => (
                    <label key={col.key} className="flex items-center gap-2.5 cursor-pointer group">
                      <input 
                        type="checkbox"
                        checked={selectedCols.includes(col.key)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedCols([...selectedCols, col.key]);
                          else setSelectedCols(selectedCols.filter(k => k !== col.key));
                        }}
                        className="w-4 h-4 rounded-lg border-slate-200 text-[#00C9A7] focus:ring-[#00C9A7] transition-all"
                      />
                      <span className="text-[12px] font-medium text-slate-600 group-hover:text-[#0B1F3A] transition-colors">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Step 3: Preview & Export */}
              <div className="space-y-6">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Step 3 — Preview & Export</label>
                
                <button 
                  onClick={previewQuery}
                  disabled={exporting}
                  className="w-full py-4 bg-[#00C9A7] text-[#0B1F3A] rounded-[20px] font-bold text-sm uppercase tracking-widest hover:bg-[#00C9A7]/90 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg shadow-[#00C9A7]/10"
                >
                  {exporting ? <Loader2 size={18} className="animate-spin" /> : 'Preview Records'}
                </button>

                {previewed && (
                  <div className={cn(
                    "p-5 rounded-[20px] border flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-300",
                    previewCount && previewCount > 0 
                      ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                      : "bg-rose-50 border-rose-100 text-rose-700"
                  )}>
                    {previewCount && previewCount > 0 ? (
                      <>
                        <CheckCircle2 size={20} />
                        <p className="text-sm font-bold">Found <span className="text-lg">{previewCount}</span> records with <span className="text-lg">{selectedCols.length}</span> columns selected</p>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={20} />
                        <p className="text-sm font-bold">No records match these filters. Adjust and try again.</p>
                      </>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-5">
                  <button 
                    onClick={handleExcelExport}
                    disabled={!previewed || selectedCols.length === 0 || exporting || (previewCount === 0)}
                    className="py-4 bg-emerald-600 text-white rounded-[20px] font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400 shadow-lg shadow-emerald-500/10"
                  >
                    {exporting ? <Loader2 size={18} className="animate-spin" /> : <><Download size={18} /> Excel</>}
                  </button>
                  <button 
                    onClick={handlePDFExport}
                    disabled={!previewed || selectedCols.length === 0 || exporting || (previewCount === 0)}
                    className="py-4 bg-rose-600 text-white rounded-[20px] font-bold text-xs uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400 shadow-lg shadow-rose-500/10"
                  >
                    {exporting ? <Loader2 size={18} className="animate-spin" /> : <><Printer size={18} /> PDF</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- HELPER COMPONENTS ---

function Field({ label, value, type = 'text', onChange }: { label: string, value: any, type?: string, onChange: (v: any) => void }) {
  const val = type === 'date' && value ? format(new Date(value), 'yyyy-MM-dd') : value || '';
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
      <input 
        type={type}
        value={val}
        onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[13px] font-medium focus:border-[var(--teal)] outline-none transition-all"
      />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string, value: any, options: string[], onChange: (v: any) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
      <select 
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[13px] font-medium focus:border-[var(--teal)] outline-none transition-all"
      >
        <option value="">Select...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function DisplayField({ label, value, color = 'text-[var(--navy)]' }: { label: string, value: any, color?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
      <div className={cn("w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[13px] font-bold", color)}>
        {value}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className={cn("p-3 rounded-xl text-white shadow-sm", color)}>
      <p className="text-[9px] font-bold uppercase tracking-widest opacity-70">{label}</p>
      <p className="text-sm font-black mt-0.5">{value}</p>
    </div>
  );
}

function FileZone({ label, url, onUpload, onClear }: { label: string, url?: string, onUpload: (f: File) => void, onClear: () => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
      {url ? (
        <div className="flex items-center justify-between p-3 bg-teal-50 border border-teal-100 rounded-xl">
          <div className="flex items-center gap-2 overflow-hidden">
            <CheckCircle2 size={16} className="text-[var(--teal)] shrink-0" />
            <span className="text-[11px] font-bold text-[var(--teal)] truncate">Document Uploaded</span>
          </div>
          <div className="flex items-center gap-1">
            <a href={url} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-white rounded-lg text-[var(--teal)] transition-all">
              <ExternalLink size={14} />
            </a>
            <button onClick={onClear} className="p-1.5 hover:bg-white rounded-lg text-[var(--rose)] transition-all">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 rounded-xl hover:border-[var(--teal)] hover:bg-slate-50 transition-all cursor-pointer group">
          <Upload size={20} className="text-slate-300 group-hover:text-[var(--teal)] mb-1" />
          <span className="text-[10px] font-bold text-slate-400 group-hover:text-[var(--teal)]">Click to upload</span>
          <input type="file" className="hidden" onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} />
        </label>
      )}
    </div>
  );
}

function TimelineStage({ done, active, icon, title, date, details, pending }: {
  done: boolean;
  active: boolean;
  icon: string;
  title: string;
  date?: string;
  details: { label: string; value: string | null | undefined }[];
  pending: boolean;
}) {
  const [open, setOpen] = useState(true);
  
  return (
    <div className="relative flex gap-4 pb-8">
      {/* Circle indicator */}
      <div className={cn(
        "relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-base shrink-0 border-2 transition-all",
        done ? "bg-[var(--teal)] border-[var(--teal)] shadow-lg shadow-teal-200" :
        active ? "bg-white border-[var(--teal)] shadow-lg shadow-teal-100" :
        pending ? "bg-white border-slate-200" : "bg-slate-50 border-slate-200"
      )}>
        {done ? '✓' : icon}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => !pending && setOpen(!open)}
        >
          <div>
            <h4 className={cn(
              "text-sm font-bold",
              done ? "text-[var(--teal)]" :
              active ? "text-[var(--navy)]" :
              "text-slate-300"
            )}>
              {title}
            </h4>
            {date && (
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                {format(new Date(date), 'dd MMM yyyy')}
              </p>
            )}
          </div>
          <div className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full border",
            done ? "bg-teal-50 text-teal-600 border-teal-100" :
            active ? "bg-amber-50 text-amber-600 border-amber-100" :
            "bg-slate-50 text-slate-400 border-slate-100"
          )}>
            {done ? 'Done' : active ? 'Active' : 'Pending'}
          </div>
        </div>
        
        {/* Details */}
        {open && !pending && details.length > 0 && (
          <div className="mt-3 p-3 bg-slate-50 rounded-xl space-y-1.5">
            {details
              .filter(d => d.value)
              .map(d => (
                <div key={d.label} className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                    {d.label}
                  </span>
                  <span className="text-[11px] font-bold text-[var(--navy)] text-right">
                    {d.value}
                  </span>
                </div>
              ))
            }
          </div>
        )}
        
        {pending && (
          <p className="text-[11px] text-slate-300 italic mt-1">
            Not yet reached
          </p>
        )}
      </div>
    </div>
  );
}

function FinStat({ label, value, color, bold }: { 
  label: string; 
  value: number | string | undefined; 
  color: string;
  bold?: boolean;
}) {
  const fmtCurrency = (n: number) => {
    if (!n || n === 0) return '—';
    if (n >= 10000000) return '₹' + (n/10000000).toFixed(2) + ' Cr';
    if (n >= 100000) return '₹' + (n/100000).toFixed(2) + ' L';
    return '₹' + Number(n).toLocaleString('en-IN');
  };
  
  return (
    <div className="flex flex-col items-center px-3 py-1 min-w-[80px] flex-1">
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap mb-1">
        {label}
      </span>
      <span className={cn(
        "text-[13px] whitespace-nowrap",
        bold ? "font-black" : "font-bold",
        color
      )}>
        {fmtCurrency(Number(value) || 0)}
      </span>
    </div>
  );
}
