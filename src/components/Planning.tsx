import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Pencil, 
  Send, CheckCircle2, X, Loader2,
  ChevronRight, ChevronLeft, AlertCircle,
  Download, Trash2, Eye, FileDown, Printer
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PlanningRecord, User, MasterData, SectionMaster } from '../types';
import { format } from 'date-fns';
import { api } from '../services/api';
import { supabase } from '../lib/supabase';
import ErrorMessage from './ErrorMessage';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const EXPORT_FILENAME = 'Planning_Register';
const EXPORT_TITLE = 'Planning Register';
const STATUS_COLUMN = 'status';
const STATUS_OPTIONS = [
  'Planning','Ready to Submit','Submitted'
];
const ALL_COLUMNS = [
  { key: 'plan_id',            label: 'Plan ID' },
  { key: 'name_of_work',       label: 'Name of Work' },
  { key: 'division',           label: 'Division' },
  { key: 'section',            label: 'Section' },
  { key: 'priority',           label: 'Priority' },
  { key: 'status',             label: 'Status' },
  { key: 'initiation_remarks', label: 'Initiation Remarks' },
  { key: 'added_by',           label: 'Added By' },
  { key: 'added_on',           label: 'Added On' },
  { key: 'last_updated',       label: 'Last Updated' },
  { key: 'submitted_on',       label: 'Submitted On' },
];

const DIVISIONS = [
  { id: 'elec', name: 'Electrical Division', sections: ['EEWA', 'EESD', 'EEM', 'EEW'] },
  { id: 'mech', name: 'Mechanical Division', sections: ['MEW', 'MESD', 'MEM'] },
  { id: 'pr', name: 'Planning & Research', sections: ['PRD', 'STAT'] },
  { id: 'civil', name: 'Civil Engineering', sections: ['CEW', 'CESD'] }
];

const STATUS_BADGES: Record<string, string> = {
  'Planning': 'bg-amber-100 text-amber-700 border-amber-200',
  'Ready to Submit': 'bg-teal-100 text-teal-700 border-teal-200',
  'Submitted': 'bg-green-100 text-green-700 border-green-200',
  'Deleted': 'bg-rose-100 text-rose-700 border-rose-200'
};

interface PlanningProps {
  user: User;
}

export default function Planning({ user }: PlanningProps) {
  const [records, setRecords] = useState<PlanningRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState<{ record: PlanningRecord, type: 'submit' | 'delete' } | null>(null);
  const [viewingRecord, setViewingRecord] = useState<PlanningRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
  
  // Master Data
  const [divisions, setDivisions] = useState<MasterData[]>([]);
  const [sections, setSections] = useState<SectionMaster[]>([]);
  const [priorities, setPriorities] = useState<MasterData[]>([]);

  // Modal State
  const [modalStep, setModalStep] = useState(1);
  const [editingRecord, setEditingRecord] = useState<PlanningRecord | null>(null);
  const [formData, setFormData] = useState({
    name_of_work: '',
    division: '',
    section: '',
    priority: 'Medium',
    status: 'Planning',
    initiation_remarks: ''
  });

  useEffect(() => {
    fetchData();
    fetchMasterData();
  }, []);

  const fetchMasterData = async () => {
    try {
      const [divs, secs, prios] = await Promise.all([
        api.getDivisions(),
        api.getSections(),
        api.getPriorities()
      ]);
      setDivisions(divs);
      setSections(secs);
      setPriorities(prios);
    } catch (err) {
      console.error("Failed to fetch master data", err);
    }
  };

  const fetchData = () => {
    setLoading(true);
    setError(null);
    api.getPlanningRecords()
      .then(setRecords)
      .catch(err => {
        console.error(err);
        setError(err.message || "Failed to load records");
      })
      .finally(() => setLoading(false));
  };

  const previewQuery = async () => {
    setExporting(true);
    try {
      let query = supabase
        .from('planning')
        .select('*', { count: 'exact', head: true });
      
      if (exportFilters.division) 
        query = query.eq('division', exportFilters.division);
      if (exportFilters.section) 
        query = query.ilike('section', `%${exportFilters.section}%`);
      if (exportFilters.status) 
        query = query.eq(STATUS_COLUMN, exportFilters.status);
      if (exportFilters.dateFrom) 
        query = query.gte('added_on', exportFilters.dateFrom);
      if (exportFilters.dateTo) 
        query = query.lte('added_on', exportFilters.dateTo + 'T23:59:59');
      
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
      .from('planning')
      .select('*');
    
    if (exportFilters.division) 
      query = query.eq('division', exportFilters.division);
    if (exportFilters.section) 
      query = query.ilike('section', `%${exportFilters.section}%`);
    if (exportFilters.status) 
      query = query.eq(STATUS_COLUMN, exportFilters.status);
    if (exportFilters.dateFrom) 
      query = query.gte('added_on', exportFilters.dateFrom);
    if (exportFilters.dateTo) 
      query = query.lte('added_on', exportFilters.dateTo + 'T23:59:59');
    
    const { data } = await query.order('added_on', { ascending: false });
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

  const handleOpenModal = (record?: PlanningRecord) => {
    if (record) {
      setEditingRecord(record);
      setFormData({
        name_of_work: record.name_of_work,
        division: record.division,
        section: record.section,
        priority: record.priority,
        status: record.status,
        initiation_remarks: record.initiation_remarks
      });
    } else {
      setEditingRecord(null);
      setFormData({
        name_of_work: '',
        division: user?.division || '',
        section: user?.section || '',
        priority: 'Medium',
        status: 'Planning',
        initiation_remarks: ''
      });
    }
    setModalStep(1);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalStep === 1) {
      setModalStep(2);
      return;
    }

    setSubmitting(true);
    try {
      if (editingRecord) {
        await api.updatePlanningRecord(editingRecord.plan_id, {
          ...formData,
          last_updated: new Date().toISOString()
        }, user);
        setSuccessMessage("Record updated successfully");
      } else {
        await api.createPlanningRecord({
          ...formData,
          added_by: user?.name || 'System',
          added_on: new Date().toISOString(),
          last_updated: new Date().toISOString()
        }, user);
        setSuccessMessage("New work initiated successfully");
      }
      setShowModal(false);
      window.dispatchEvent(new Event('modal-close'));
      fetchData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || "Operation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmAction = async () => {
    if (!showConfirm || !user) return;
    setSubmitting(true);
    try {
      if (showConfirm.type === 'submit') {
        await api.submitToApproval(showConfirm.record, user);
        setSuccessMessage(`"${showConfirm.record.name_of_work}" submitted to approval pipeline.`);
      } else {
        await api.updatePlanningRecord(showConfirm.record.plan_id, { status: 'Deleted' }, user);
        setSuccessMessage(`"${showConfirm.record.name_of_work}" has been archived.`);
      }
      setShowConfirm(null);
      window.dispatchEvent(new Event('modal-close'));
      fetchData();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(`${showConfirm.type === 'submit' ? 'Submission' : 'Deletion'} failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Plan ID', 'Name of Work', 'Division', 'Section', 'Priority', 'Status', 'Added By', 'Added On'];
    const rows = filteredRecords.map(r => [
      r.plan_id,
      `"${r.name_of_work.replace(/"/g, '""')}"`,
      r.division,
      r.section,
      r.priority,
      r.status,
      r.added_by,
      format(new Date(r.added_on), 'yyyy-MM-dd')
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `planning_register_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRecords = records.filter(r => {
    const searchStr = search.toLowerCase();
    const matchesSearch = 
      (r.name_of_work?.toLowerCase() || '').includes(searchStr) || 
      (r.plan_id?.toLowerCase() || '').includes(searchStr) ||
      (r.division?.toLowerCase() || '').includes(searchStr) ||
      (r.section?.toLowerCase() || '').includes(searchStr);
    const matchesStatus = !filterStatus || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'Medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Low': return 'bg-sky-100 text-sky-700 border-sky-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const availableSections = sections.filter(s => s.category === divisions.find(d => d.name === formData.division)?.name);

  const stats = {
    total: records.filter(r => r.status !== 'Deleted').length,
    planning: records.filter(r => r.status === 'Planning').length,
    ready: records.filter(r => r.status === 'Ready to Submit').length,
    submitted: records.filter(r => r.status === 'Submitted').length
  };

  if (loading && records.length === 0) return <div className="p-10 text-center">Loading planning records...</div>;
  if (error) return <ErrorMessage error={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Active', value: stats.total, color: 'text-[var(--navy)]', bg: 'bg-white' },
          { label: 'In Planning', value: stats.planning, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Ready to Submit', value: stats.ready, color: 'text-teal-600', bg: 'bg-teal-50' },
          { label: 'Submitted', value: stats.submitted, color: 'text-green-600', bg: 'bg-green-50' }
        ].map((s, i) => (
          <div key={i} className={cn("p-4 rounded-2xl border border-[var(--border)] shadow-sm", s.bg)}>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
            <p className={cn("text-2xl font-display font-bold", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[16px] p-6 border border-[var(--border)] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
          <div className="flex-1">
            <h2 className="font-display text-xl font-bold text-[var(--navy)]">Planning Register</h2>
            <p className="text-sm text-[var(--muted)] mt-0.5">Track and manage new work initiations</p>
          </div>
          
          {successMessage && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-100 rounded-xl text-xs font-bold animate-in slide-in-from-top-2 duration-300">
              <CheckCircle2 size={14} />
              {successMessage}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input 
                type="text" 
                placeholder="Search all columns..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 bg-[var(--paper)] border border-[var(--border)] rounded-[12px] text-[13px] outline-none focus:border-[var(--teal)] focus:bg-white transition-all w-full md:w-[240px]"
              />
            </div>

            <select 
              value={filterStatus || ''}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-white border border-[var(--border)] rounded-[12px] text-[13px] outline-none focus:border-[var(--teal)] cursor-pointer"
            >
              <option value="">All Status</option>
              {Object.keys(STATUS_BADGES).map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <button 
              onClick={() => {
                setSelectedCols(ALL_COLUMNS.map(c => c.key));
                setShowExportModal(true);
                window.dispatchEvent(new Event('modal-open'));
              }}
              className="flex items-center gap-2 px-3 py-2 bg-[#0B1F3A] text-white rounded-[12px] text-[13px] font-semibold hover:bg-[#1a2f4d] transition-all"
              title="Export Data"
            >
              <FileDown size={16} />
              Export
            </button>

            <button 
              onClick={() => {
                handleOpenModal();
                window.dispatchEvent(new Event('modal-open'));
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--teal)] text-white rounded-[12px] text-[13px] font-semibold hover:bg-[var(--teal2)] transition-all shadow-sm hover:shadow-md"
            >
              <Plus size={16} />
              Initiate Work
            </button>
          </div>
        </div>

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[600px] overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-800">Export {EXPORT_TITLE} Data</h3>
                <button 
                  onClick={() => {
                    setShowExportModal(false);
                    window.dispatchEvent(new Event('modal-close'));
                    setExportFilters({ division: '', section: '', status: '', dateFrom: '', dateTo: '' });
                    setPreviewCount(null);
                    setPreviewed(false);
                  }} 
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={18} className="text-slate-400" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                {/* Step 1: Filters */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-4">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Step 1 — Filter Records</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Division</label>
                      <select 
                        value={exportFilters.division}
                        onChange={(e) => setExportFilters({...exportFilters, division: e.target.value})}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--teal)]"
                      >
                        <option value="">All Divisions</option>
                        {divisions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Section</label>
                      <input 
                        type="text"
                        placeholder="Search section..."
                        value={exportFilters.section}
                        onChange={(e) => setExportFilters({...exportFilters, section: e.target.value})}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--teal)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Status</label>
                      <select 
                        value={exportFilters.status}
                        onChange={(e) => setExportFilters({...exportFilters, status: e.target.value})}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--teal)]"
                      >
                        <option value="">All Status</option>
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">From</label>
                        <input 
                          type="date"
                          value={exportFilters.dateFrom}
                          onChange={(e) => setExportFilters({...exportFilters, dateFrom: e.target.value})}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--teal)]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">To</label>
                        <input 
                          type="date"
                          value={exportFilters.dateTo}
                          onChange={(e) => setExportFilters({...exportFilters, dateTo: e.target.value})}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-[var(--teal)]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 2: Columns */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Step 2 — Select Columns to Export</label>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setSelectedCols(ALL_COLUMNS.map(c => c.key))}
                        className="text-[10px] font-bold text-[var(--teal)] hover:underline"
                      >
                        Select All
                      </button>
                      <button 
                        onClick={() => setSelectedCols([])}
                        className="text-[10px] font-bold text-rose-500 hover:underline"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-y-2 gap-x-4">
                    {ALL_COLUMNS.map(col => (
                      <label key={col.key} className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox"
                          checked={selectedCols.includes(col.key)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedCols([...selectedCols, col.key]);
                            else setSelectedCols(selectedCols.filter(k => k !== col.key));
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-[var(--teal)] focus:ring-[var(--teal)]"
                        />
                        <span className="text-[12px] text-slate-600 group-hover:text-slate-900 transition-colors">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Step 3: Preview & Export */}
                <div className="space-y-4">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Step 3 — Preview & Export</label>
                  
                  <button 
                    onClick={previewQuery}
                    disabled={exporting}
                    className="w-full py-3 bg-[var(--teal)] text-white rounded-xl font-bold text-sm hover:bg-[var(--teal2)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {exporting ? <Loader2 size={18} className="animate-spin" /> : 'Preview Records'}
                  </button>

                  {previewed && (
                    <div className={cn(
                      "p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300",
                      previewCount && previewCount > 0 
                        ? "bg-teal-50 border-teal-100 text-teal-700" 
                        : "bg-rose-50 border-rose-100 text-rose-700"
                    )}>
                      {previewCount && previewCount > 0 ? (
                        <>
                          <CheckCircle2 size={18} />
                          <p className="text-sm font-medium">Found <span className="font-bold">{previewCount}</span> records with <span className="font-bold">{selectedCols.length}</span> columns selected</p>
                        </>
                      ) : (
                        <>
                          <AlertCircle size={18} />
                          <p className="text-sm font-medium">No records match these filters. Adjust and try again.</p>
                        </>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={handleExcelExport}
                      disabled={!previewed || selectedCols.length === 0 || exporting || (previewCount === 0)}
                      className="py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {exporting ? <Loader2 size={18} className="animate-spin" /> : <><Download size={18} /> Download Excel</>}
                    </button>
                    <button 
                      onClick={handlePDFExport}
                      disabled={!previewed || selectedCols.length === 0 || exporting || (previewCount === 0)}
                      className="py-3 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {exporting ? <Loader2 size={18} className="animate-spin" /> : <><Printer size={18} /> Save as PDF</>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="font-bold text-slate-800">{editingRecord ? 'Edit Work Plan' : 'Initiate New Work'}</h3>
                  <div className="flex items-center gap-1 mt-1">
                    <div className={cn("h-1 w-8 rounded-full transition-all", modalStep >= 1 ? "bg-[var(--teal)]" : "bg-slate-200")} />
                    <div className={cn("h-1 w-8 rounded-full transition-all", modalStep >= 2 ? "bg-[var(--teal)]" : "bg-slate-200")} />
                    <span className="text-[10px] font-bold text-slate-400 uppercase ml-2">Step {modalStep} of 2</span>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={18} className="text-slate-400" />
                </button>
              </div>
              
              <form onSubmit={handleSave} className="p-6 space-y-5">
                {modalStep === 1 ? (
                  <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Name of Work</label>
                      <textarea 
                        required
                        value={formData.name_of_work || ''}
                        onChange={(e) => setFormData({...formData, name_of_work: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-[var(--teal)] focus:bg-white outline-none transition-all min-h-[100px]"
                        placeholder="Enter full description of the proposed work..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Division</label>
                        <select 
                          required
                          value={formData.division || ''}
                          onChange={(e) => setFormData({...formData, division: e.target.value, section: ''})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-[var(--teal)] outline-none"
                        >
                          <option value="">Select Division</option>
                          {divisions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Section</label>
                        <select 
                          required
                          disabled={!formData.division}
                          value={formData.section || ''}
                          onChange={(e) => setFormData({...formData, section: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-[var(--teal)] outline-none disabled:opacity-50"
                        >
                          <option value="">Select Section</option>
                          {availableSections.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Priority</label>
                        <select 
                          value={formData.priority || 'Medium'}
                          onChange={(e) => setFormData({...formData, priority: e.target.value as any})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-[var(--teal)] outline-none"
                        >
                          {priorities.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</label>
                        <select 
                          value={formData.status || 'Planning'}
                          onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-[var(--teal)] outline-none"
                        >
                          <option value="Planning">Planning</option>
                          <option value="Ready to Submit">Ready to Submit</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Initiation Remarks</label>
                      <textarea 
                        required
                        value={formData.initiation_remarks || ''}
                        onChange={(e) => setFormData({...formData, initiation_remarks: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-[var(--teal)] focus:bg-white outline-none transition-all min-h-[100px]"
                        placeholder="Justification or initial notes for this work..."
                      />
                    </div>
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  {modalStep === 2 && (
                    <button 
                      type="button"
                      onClick={() => setModalStep(1)}
                      className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center gap-2"
                    >
                      <ChevronLeft size={16} />
                      Back
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-[var(--teal)] text-white rounded-xl font-bold text-sm hover:bg-[var(--teal2)] transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : modalStep === 1 ? (
                      <>Next <ChevronRight size={16} /></>
                    ) : (
                      <>{editingRecord ? 'Update Record' : 'Create Record'}</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View Details Modal */}
        {viewingRecord && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-800 text-lg">Work Plan Details</h3>
                <button onClick={() => {
                  setViewingRecord(null);
                  window.dispatchEvent(new Event('modal-close'));
                }} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={18} className="text-slate-400" />
                </button>
              </div>
              <div className="p-8 space-y-8 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Plan ID</p>
                    <p className="text-sm font-mono font-bold text-[var(--teal)]">{viewingRecord.plan_id}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</p>
                    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border", STATUS_BADGES[viewingRecord.status] || 'bg-slate-100')}>
                      {viewingRecord.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Name of Work</p>
                  <p className="text-base font-semibold text-[var(--navy)] leading-relaxed">{viewingRecord.name_of_work}</p>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Division</p>
                    <p className="text-sm font-medium text-slate-700">{viewingRecord.division}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Section</p>
                    <p className="text-sm font-medium text-slate-700">{viewingRecord.section}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Priority</p>
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border", getPriorityColor(viewingRecord.priority))}>
                      {viewingRecord.priority}
                    </span>
                  </div>
                </div>

                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Initiation Remarks</p>
                  <p className="text-sm text-slate-600 leading-relaxed italic">
                    "{viewingRecord.initiation_remarks || 'No remarks provided.'}"
                  </p>
                </div>

                <div className="pt-6 border-t border-slate-100 grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Added By</p>
                    <p className="text-sm font-medium text-slate-700">{viewingRecord.added_by}</p>
                    <p className="text-[10px] text-slate-400">{format(new Date(viewingRecord.added_on), 'dd MMM yyyy, hh:mm a')}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Updated</p>
                    <p className="text-sm font-medium text-slate-700">{format(new Date(viewingRecord.last_updated), 'dd MMM yyyy, hh:mm a')}</p>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
                <button 
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-[var(--navy)] font-bold text-sm transition-all"
                >
                  <Download size={16} />
                  Print Record
                </button>
                <button 
                  onClick={() => {
                    setViewingRecord(null);
                    window.dispatchEvent(new Event('modal-close'));
                  }}
                  className="px-6 py-2.5 bg-[var(--navy)] text-white rounded-xl font-bold text-sm hover:bg-[var(--navy2)] transition-all shadow-md"
                >
                  Close Detail View
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Confirmation Modal */}
        {showConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-8 text-center">
                <div className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6",
                  showConfirm.type === 'submit' ? "bg-teal-50 text-[var(--teal)]" : "bg-rose-50 text-rose-500"
                )}>
                  {showConfirm.type === 'submit' ? <Send size={40} /> : <Trash2 size={40} />}
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-3">
                  {showConfirm.type === 'submit' ? 'Submit to Approval?' : 'Archive this Record?'}
                </h3>
                <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                  {showConfirm.type === 'submit' ? (
                    <>This will move <span className="font-bold text-slate-700">"{showConfirm.record.name_of_work}"</span> to the Under Approval pipeline. You won't be able to edit it after submission.</>
                  ) : (
                    <>Are you sure you want to archive <span className="font-bold text-slate-700">"{showConfirm.record.name_of_work}"</span>? This will remove it from the active planning register.</>
                  )}
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      setShowConfirm(null);
                      window.dispatchEvent(new Event('modal-close'));
                    }}
                    className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmAction}
                    disabled={submitting}
                    className={cn(
                      "flex-1 px-6 py-3 text-white rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50",
                      showConfirm.type === 'submit' ? "bg-[var(--teal)] hover:bg-[var(--teal2)]" : "bg-rose-500 hover:bg-rose-600"
                    )}
                  >
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : (showConfirm.type === 'submit' ? 'Yes, Submit' : 'Yes, Archive')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto -mx-6">
          <table className="w-full border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-[var(--paper)]">
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Plan ID</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Name of Work</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Division / Section</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Priority</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Status</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Remarks</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Added By</th>
                <th className="px-6 py-3 text-right text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredRecords.length > 0 ? filteredRecords.map((r) => (
                <tr key={r.plan_id} className="hover:bg-[var(--teal)]/[0.02] transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <code className="text-[11px] text-[var(--muted)] bg-[var(--paper)] px-1.5 py-0.5 rounded border border-[var(--border)]">{r.plan_id}</code>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[13px] font-semibold text-[var(--navy)] line-clamp-2 max-w-[300px] leading-snug">
                      {r.name_of_work}
                    </div>
                    <div className="text-[10px] text-[var(--muted)] mt-1">
                      Added: {format(new Date(r.added_on), 'dd MMM yyyy')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-[13px] text-[var(--ink)] font-medium">{r.division}</div>
                    <div className="text-[11px] text-[var(--muted)]">{r.section}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border", getPriorityColor(r.priority))}>
                      {r.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border", STATUS_BADGES[r.status] || 'bg-slate-100')}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[12px] text-[var(--muted)] line-clamp-2 max-w-[200px]">
                      {r.initiation_remarks || 'No remarks'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-[12px] text-[var(--ink)]">
                    {r.added_by}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => {
                          setViewingRecord(r);
                          window.dispatchEvent(new Event('modal-open'));
                        }}
                        className="p-2 text-slate-400 hover:text-[var(--navy)] hover:bg-slate-100 rounded-lg transition-all"
                        title="View Details"
                      >
                        <Eye size={14} />
                      </button>

                      {r.status !== 'Submitted' && r.status !== 'Deleted' ? (
                        <>
                          <button 
                            onClick={() => {
                              handleOpenModal(r);
                              window.dispatchEvent(new Event('modal-open'));
                            }}
                            className="p-2 text-slate-400 hover:text-[var(--teal)] hover:bg-teal-50 rounded-lg transition-all"
                            title="Edit Record"
                          >
                            <Pencil size={14} />
                          </button>
                          
                          <button 
                            onClick={() => {
                              setShowConfirm({ record: r, type: 'delete' });
                              window.dispatchEvent(new Event('modal-open'));
                            }}
                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                            title="Archive Record"
                          >
                            <Trash2 size={14} />
                          </button>

                          <button 
                            onClick={() => {
                              setShowConfirm({ record: r, type: 'submit' });
                              window.dispatchEvent(new Event('modal-open'));
                            }}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all",
                              r.status === 'Ready to Submit' 
                                ? "bg-[var(--teal)] text-white hover:bg-[var(--teal2)] shadow-sm" 
                                : "bg-slate-100 text-slate-400 cursor-not-allowed"
                            )}
                            disabled={r.status !== 'Ready to Submit' || submitting}
                          >
                            <Send size={12} />
                            Submit
                          </button>
                        </>
                      ) : r.status === 'Submitted' ? (
                        <div className="flex items-center gap-1.5 text-green-600 font-bold text-[11px] px-3 py-1.5 bg-green-50 rounded-lg border border-green-100">
                          <CheckCircle2 size={12} />
                          SUBMITTED
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-rose-600 font-bold text-[11px] px-3 py-1.5 bg-rose-50 rounded-lg border border-rose-100">
                          <AlertCircle size={12} />
                          ARCHIVED
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-[var(--muted)]">
                      <Search size={40} className="opacity-20" />
                      <p>No planning records found.</p>
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
