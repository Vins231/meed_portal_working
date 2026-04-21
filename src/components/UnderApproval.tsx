import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, CheckCircle2, Clock, Loader2,
  Pencil, X, Save, ArrowRight, AlertCircle,
  FileText, Upload, ChevronRight, ChevronLeft,
  Check, FileDown, Printer, Download, TrendingUp
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { api } from '../services/api';
import { playSound } from '../lib/sounds';
import { toast } from '../lib/toast';
import { ApprovalRecord, User, MasterData } from '../types';
import ErrorMessage from './ErrorMessage';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const EXPORT_FILENAME = 'Under_Approval_Register';
const EXPORT_TITLE = 'Under Approval Register';
const STATUS_COLUMN = 'current_stage';
const STATUS_OPTIONS = [
  'Estimate Pending','FC Pending','FC Received',
  'CA Approval Pending','Ready to Tender',
  'On Hold','Dropped','Tendered'
];
const ALL_COLUMNS = [
  { key: 'approval_id',        label: 'Approval ID' },
  { key: 'plan_id',            label: 'Plan ID' },
  { key: 'name_of_work',       label: 'Name of Work' },
  { key: 'division',           label: 'Division' },
  { key: 'section',            label: 'Section' },
  { key: 'priority',           label: 'Priority' },
  { key: 'estimate_no',        label: 'Estimate No' },
  { key: 'estimated_cost',     label: 'Estimated Cost' },
  { key: 'work_type',          label: 'Work Type' },
  { key: 'competent_authority',label: 'Competent Authority' },
  { key: 'prepared_by',        label: 'Prepared By' },
  { key: 'fc_no',              label: 'FC No' },
  { key: 'fc_date',            label: 'FC Date' },
  { key: 'ca_date',            label: 'CA Date' },
  { key: 'ca_status',          label: 'CA Status' },
  { key: 'current_stage',      label: 'Current Stage' },
  { key: 'days_in_pipeline',   label: 'Days in Pipeline' },
  { key: 'on_hold_reason',     label: 'On Hold Reason' },
  { key: 'added_by',           label: 'Added By' },
  { key: 'added_on',           label: 'Added On' },
];

export default function UnderApproval() {
  const [records, setRecords] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [divisions, setDivisions] = useState<MasterData[]>([]);

  // Quick Update State
  const [quickUpdate, setQuickUpdate] = useState<{
    record: ApprovalRecord;
    type: 'approval';
  } | null>(null);
  const [quickForm, setQuickForm] = useState<Record<string, any>>({});
  const [quickSaving, setQuickSaving] = useState(false);

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

  // Modals
  const [showEditModal, setShowEditModal] = useState<ApprovalRecord | null>(null);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showMoveConfirm, setShowMoveConfirm] = useState<ApprovalRecord | null>(null);

  // DOP Lookup State
  const [dopResult, setDopResult] = useState<{ authority: string; designation: string } | null>(null);
  const [dopLoading, setDopLoading] = useState(false);

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getApprovalRecords();
      setRecords(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load records");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const userStr = localStorage.getItem('meed_user');
    if (userStr) setCurrentUser(JSON.parse(userStr));
    fetchData();
    api.getDivisions().then(setDivisions).catch(console.error);
  }, [fetchData]);

  const previewQuery = async () => {
    setExporting(true);
    try {
      let query = supabase
        .from('under_approval')
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
      .from('under_approval')
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

  // DOP Lookup Logic
  useEffect(() => {
    if (!showEditModal || !showEditModal.estimated_cost || !showEditModal.work_type) {
      setDopResult(null);
      return;
    }

    const timer = setTimeout(async () => {
      setDopLoading(true);
      try {
        const { data, error } = await supabase
          .from('dop_master')
          .select('competent_authority, authority_designation')
          .eq('work_type', showEditModal.work_type)
          .lte('cost_from', showEditModal.estimated_cost)
          .gte('cost_to', showEditModal.estimated_cost)
          .eq('status', 'Active')
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setDopResult({
            authority: data.competent_authority,
            designation: data.authority_designation
          });
          setShowEditModal(prev => prev ? ({ ...prev, competent_authority: data.competent_authority }) : null);
        } else {
          setDopResult(null);
        }
      } catch (err) {
        console.error('DOP Lookup failed:', err);
      } finally {
        setDopLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [showEditModal?.estimated_cost, showEditModal?.work_type]);

  const handleFileUpload = async (approvalId: string): Promise<string | null> => {
    if (!selectedFile) return null;
    
    setUploading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `under_approval/${approvalId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('meed-documents')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('meed-documents')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (err) {
      console.error('File upload failed:', err);
      throw err;
    } finally {
      setUploading(false);
    }
  };

  const calcApprovalStage = (record: Partial<ApprovalRecord>): string => {
    if (record.on_hold_reason && record.on_hold_reason.trim() !== '') 
      return 'On Hold';
    if (record.ca_status === 'Approved') 
      return 'Ready to Tender';
    if (record.ca_date && record.ca_date.trim() !== '') 
      return 'CA Approval Pending';
    if (record.fc_no && record.fc_no.trim() !== '' && 
        record.fc_date && record.fc_date.trim() !== '') 
      return 'FC Received';
    if (record.estimated_cost && Number(record.estimated_cost) > 0) 
      return 'FC Pending';
    return 'Estimate Pending';
  };

  const handleSaveRecord = async () => {
    if (!showEditModal || !currentUser) return;
    setSubmitting(true);
    try {
      let fileUrl = showEditModal.estimate_document;
      if (selectedFile) {
        fileUrl = await handleFileUpload(showEditModal.approval_id) || fileUrl;
      }

      const autoStage = calcApprovalStage(showEditModal);

      // Remove on_hold_reason from payload as per requirements
      const { on_hold_reason, ...rest } = showEditModal;

      const updateData = {
        ...rest,
        current_stage: autoStage,
        estimate_document: fileUrl,
        last_updated: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('under_approval')
        .update(updateData)
        .eq('approval_id', showEditModal.approval_id);

      if (updateError) throw updateError;

      // Activity Log
      await supabase.from('activity_log').insert([{
        log_id: `LOG-${Date.now()}`,
        action: 'UPDATE',
        module: 'UNDER_APPROVAL',
        record_id: showEditModal.approval_id,
        user_id: currentUser.user_id,
        description: `Approval record updated by ${currentUser.name}`,
        timestamp: new Date().toISOString(),
        status: 'Success'
      }]);

      playSound('save');
      toast.success('Saved', "Record updated successfully");
      setSuccessMessage("Record updated successfully");
      setShowEditModal(null);
      setCurrentStep(1);
      setSelectedFile(null);
      fetchData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      playSound('error');
      toast.error('Error', err.message);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmMoveToTender = async () => {
    if (!showMoveConfirm || !currentUser) return;

    setSubmitting(true);
    try {
      // 1. Update under_approval
      const { error: updateError } = await supabase
        .from('under_approval')
        .update({ 
          current_stage: 'Tendered', 
          last_updated: new Date().toISOString() 
        })
        .eq('approval_id', showMoveConfirm.approval_id);
      
      if (updateError) throw updateError;
      
      // 2. Generate Tender No
      const tenderNo = await api.generateTenderNo();

      // 3. Insert into tender
      const { error: insertError } = await supabase
        .from('tender')
        .insert([{
          tender_id: `TND-${Date.now()}`,
          approval_id: showMoveConfirm.approval_id,
          plan_id: showMoveConfirm.plan_id,
          name_of_work: showMoveConfirm.name_of_work,
          division: showMoveConfirm.division,
          section: showMoveConfirm.section,
          estimated_cost: showMoveConfirm.estimated_cost,
          competent_authority: showMoveConfirm.competent_authority,
          tender_no: tenderNo,
          tender_type: 'Open Tender',
          current_stage: 'Tender Initiated',
          added_by: currentUser.name,
          added_on: new Date().toISOString(),
          last_updated: new Date().toISOString()
        }]);
      
      if (insertError) throw insertError;

      // 3. Activity Log
      await supabase.from('activity_log').insert([{
        log_id: `LOG-${Date.now()}`,
        action: 'MOVE_TO_TENDER',
        module: 'UNDER_APPROVAL',
        record_id: showMoveConfirm.approval_id,
        user_id: currentUser.user_id,
        description: `Work moved to Tender stage by ${currentUser.name}`,
        timestamp: new Date().toISOString(),
        status: 'Success'
      }]);

      playSound('move');
      toast.success('Moved to Tender', "Work moved to Tender stage successfully!");
      setSuccessMessage("Work moved to Tender stage successfully!");
      setShowMoveConfirm(null);
      fetchData();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      playSound('error');
      toast.error('Error', err.message);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickSave = async () => {
    if (!quickUpdate || !currentUser) return;
    setQuickSaving(true);
    try {
      const mergedRecord = { ...quickUpdate.record, ...quickForm };
      const autoStage = calcApprovalStage(mergedRecord);
      
      const updateData = {
        ...quickForm,
        current_stage: autoStage,
        last_updated: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('under_approval')
        .update(updateData)
        .eq('approval_id', quickUpdate.record.approval_id);

      if (updateError) throw updateError;

      await supabase.from('activity_log').insert([{
        log_id: `LOG-${Date.now()}`,
        action: 'QUICK_UPDATE',
        module: 'UNDER_APPROVAL',
        record_id: quickUpdate.record.approval_id,
        user_id: currentUser.user_id,
        description: `Quick update performed by ${currentUser.name}. Stage advanced to ${autoStage}`,
        timestamp: new Date().toISOString(),
        status: 'Success'
      }]);

      setQuickUpdate(null);
      setQuickForm({});
      fetchData();
      playSound('save');
      toast.success('Quick Updated', `Stage advanced to ${autoStage}`);
      setSuccessMessage(`Record updated. New stage: ${autoStage}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      playSound('error');
      toast.error('Error', err.message);
      setError(err.message);
    } finally {
      setQuickSaving(false);
    }
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = (r.name_of_work?.toLowerCase() || '').includes(search.toLowerCase()) || 
                         (r.approval_id?.toLowerCase() || '').includes(search.toLowerCase()) ||
                         (r.estimate_no?.toLowerCase() || '').includes(search.toLowerCase());
    const matchesStatus = !filterStatus || r.ca_status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const fmtCurrency = (n: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(n);
  };

  const getStageBadge = (stage: string) => {
    const colors: Record<string, string> = {
      'Estimate Pending': 'bg-purple-100 text-purple-700 border-purple-200',
      'FC Pending': 'bg-amber-100 text-amber-700 border-amber-200',
      'FC Received': 'bg-sky-100 text-sky-700 border-sky-200',
      'CA Approval Pending': 'bg-rose-100 text-rose-700 border-rose-200',
      'Ready to Tender': 'bg-teal-100 text-teal-700 border-teal-200',
      'On Hold': 'bg-slate-100 text-slate-700 border-slate-200',
      'Dropped': 'bg-slate-100 text-slate-700 border-slate-200',
      'Tendered': 'bg-green-100 text-green-700 border-green-200'
    };
    return colors[stage] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  if (loading && records.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
      <Loader2 className="animate-spin" size={32} />
      <p className="text-sm font-bold uppercase tracking-widest">Loading approval records...</p>
    </div>
  );

  if (error) return <ErrorMessage error={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[24px] p-8 border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-6 mb-8">
          <div className="flex-1">
            <h2 className="font-display text-2xl font-bold text-[#0B1F3A]">Under Approval</h2>
            <p className="text-sm text-slate-400 mt-1">Track and manage work estimates through the approval pipeline</p>
          </div>

          {successMessage && (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-xs font-bold animate-in slide-in-from-top-2 duration-300">
              <CheckCircle2 size={14} />
              {successMessage}
            </div>
          )}
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search approvals..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all w-full md:w-[240px]"
              />
            </div>

            <button 
              onClick={() => {
                setSelectedCols(ALL_COLUMNS.map(c => c.key));
                setShowExportModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0B1F3A] text-white rounded-xl text-sm font-bold hover:bg-[#1a2f4d] transition-all shadow-lg shadow-[#0B1F3A]/20"
              title="Export Data"
            >
              <FileDown size={18} />
              Export
            </button>

            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] cursor-pointer font-medium"
            >
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Deferred">Deferred</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto -mx-8">
          <table className="w-full border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">Approval ID</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">Name of Work</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">Division / Section</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">Estimate No</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">Est. Cost</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">Authority</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">FC Date</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">Stage</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">Pipeline</th>
                <th className="px-8 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredRecords.length > 0 ? filteredRecords.map((r) => (
                <tr key={r.approval_id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5 whitespace-nowrap">
                    <code className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">{r.approval_id}</code>
                  </td>
                  <td className="px-8 py-5">
                    <div className="text-[13px] font-bold text-[#0B1F3A] line-clamp-2 max-w-[240px] leading-relaxed">
                      {r.name_of_work}
                    </div>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap">
                    <div className="text-[12px] font-bold text-slate-600">{r.division}</div>
                    <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{r.section}</div>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap text-[12px] font-medium text-slate-500">
                    {r.estimate_no || '—'}
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap text-[13px] font-bold text-[#0B1F3A]">
                    {r.estimated_cost ? fmtCurrency(r.estimated_cost) : '—'}
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap">
                    <div className="text-[12px] font-bold text-slate-600">{r.competent_authority || '—'}</div>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap text-[12px] font-medium text-slate-500">
                    {r.fc_date ? format(new Date(r.fc_date), 'dd MMM yyyy') : '—'}
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap">
                    <span 
                      className={cn(
                        "inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold border shadow-sm cursor-pointer hover:opacity-80 transition-opacity", 
                        getStageBadge(r.current_stage)
                      )}
                      onClick={() => {
                        setQuickUpdate({ record: r, type: 'approval' });
                        setQuickForm({});
                      }}
                      title="Click to quick update"
                    >
                      {r.current_stage}
                    </span>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap">
                    <div className={cn(
                      "text-[13px] font-extrabold",
                      r.days_in_pipeline > 60 ? "text-[#E8445A]" : 
                      r.days_in_pipeline > 30 ? "text-[#F5A623]" : "text-slate-600"
                    )}>
                      {r.days_in_pipeline} Days
                    </div>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => {
                          setShowEditModal(r);
                          setCurrentStep(1);
                        }}
                        className="p-2.5 text-slate-400 hover:text-[#00C9A7] hover:bg-[#00C9A7]/10 rounded-xl transition-all" 
                        title="Edit Record"
                      >
                        <Pencil size={16} />
                      </button>
                      {r.current_stage === 'Ready to Tender' && (
                        <button 
                          onClick={() => setShowMoveConfirm(r)}
                          className="flex items-center gap-2 px-4 py-2 bg-[#00C9A7] text-[#0B1F3A] rounded-xl text-[11px] font-bold hover:bg-[#00C9A7]/90 shadow-lg shadow-[#00C9A7]/20 transition-all animate-pulse"
                        >
                          → Tender
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={10} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-300">
                      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                        <Search size={32} className="opacity-20" />
                      </div>
                      <p className="text-sm font-medium">No approval records found matching your criteria</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Stage</label>
                      <select 
                        value={exportFilters.status}
                        onChange={(e) => setExportFilters({...exportFilters, status: e.target.value})}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] font-medium"
                      >
                        <option value="">All Stages</option>
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

      {/* Edit Modal - 3 Step Form */}
      {showEditModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-[#0B1F3A]/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-[#0B1F3A]">Update Approval Record</h3>
                <p className="text-xs text-slate-400 font-medium mt-1">ID: {showEditModal.approval_id} • {showEditModal.name_of_work}</p>
              </div>
              <button 
                onClick={() => {
                  setShowEditModal(null);
                  setSelectedFile(null);
                }} 
                className="w-10 h-10 rounded-full hover:bg-slate-200/50 flex items-center justify-center text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="px-10 pt-8">
              <div className="relative h-1 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="absolute top-0 left-0 h-full bg-[#00C9A7] transition-all duration-500"
                  style={{ width: `${(currentStep / 3) * 100}%` }}
                />
              </div>
              <div className="flex justify-between mt-6 relative">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex flex-col items-center gap-2 z-10">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300",
                      currentStep === step ? "bg-[#00C9A7]/10 border-[#00C9A7] text-[#00C9A7] scale-110 shadow-lg shadow-[#00C9A7]/10" :
                      currentStep > step ? "bg-[#00C9A7] border-[#00C9A7] text-white" :
                      "bg-white border-slate-200 text-slate-300"
                    )}>
                      {currentStep > step ? <Check size={18} /> : step}
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-widest",
                      currentStep === step ? "text-[#0B1F3A]" : "text-slate-300"
                    )}>
                      {step === 1 ? 'Estimate' : step === 2 ? 'Finance' : 'CA Approval'}
                    </span>
                  </div>
                ))}
                {/* Connecting Line Background */}
                <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-100 -z-0" />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10">
              {currentStep === 1 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Estimate Number</label>
                      <input 
                        type="text"
                        value={showEditModal.estimate_no || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, estimate_no: e.target.value})}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all font-medium"
                        placeholder="e.g. EST/2024/001"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Estimated Cost (Rs.)</label>
                      <input 
                        type="number"
                        value={showEditModal.estimated_cost || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, estimated_cost: Number(e.target.value)})}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all font-bold text-[#0B1F3A]"
                        placeholder="Enter cost in Rupees"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Work Type</label>
                      <select 
                        value={showEditModal.work_type || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, work_type: e.target.value})}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all font-medium cursor-pointer"
                      >
                        <option value="">Select Work Type</option>
                        <option value="Capital Work">Capital Work</option>
                        <option value="Revenue Work-Tender">Revenue Work-Tender</option>
                        <option value="Repair and Maintenance-AMC">Repair and Maintenance-AMC</option>
                        <option value="Single Tender-Proprietary">Single Tender-Proprietary</option>
                        <option value="Emergency Work-Nomination">Emergency Work-Nomination</option>
                        <option value="SPC Without Tender">SPC Without Tender</option>
                        <option value="Excess-Extra Work">Excess-Extra Work</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Competent Authority (DOP)</label>
                      <div className={cn(
                        "w-full px-5 py-3.5 rounded-2xl text-sm font-bold border transition-all flex items-center gap-3",
                        dopLoading ? "bg-slate-50 border-slate-200 text-slate-400" :
                        dopResult ? "bg-[#00C9A7]/5 border-[#00C9A7]/20 text-[#00C9A7]" :
                        (!showEditModal.estimated_cost || !showEditModal.work_type) ? "bg-slate-50 border-slate-200 text-slate-300" :
                        "bg-rose-50 border-rose-100 text-[#E8445A]"
                      )}>
                        {dopLoading ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Looking up DOP...</span>
                          </>
                        ) : dopResult ? (
                          <>
                            <CheckCircle2 size={16} />
                            <span>{dopResult.authority} <span className="text-[10px] opacity-60 font-medium">({dopResult.designation})</span></span>
                          </>
                        ) : (!showEditModal.estimated_cost || !showEditModal.work_type) ? (
                          <span>Enter cost and work type above</span>
                        ) : (
                          <>
                            <AlertCircle size={16} />
                            <span>No DOP match found</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Estimate Document</label>
                    <div className="flex flex-col gap-4">
                      {showEditModal.estimate_document && !selectedFile && (
                        <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-[#00C9A7]">
                              <FileText size={20} />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#0B1F3A]">Existing Document</p>
                              <a 
                                href={showEditModal.estimate_document} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-[10px] font-bold text-[#00C9A7] hover:underline"
                              >
                                View Current File
                              </a>
                            </div>
                          </div>
                          <button 
                            type="button"
                            onClick={() => setSelectedFile(null)}
                            className="text-[10px] font-bold text-slate-400 hover:text-[#E8445A] uppercase tracking-widest"
                          >
                            Replace
                          </button>
                        </div>
                      )}

                      <div 
                        className={cn(
                          "relative border-2 border-dashed rounded-[24px] p-10 transition-all group flex flex-col items-center justify-center gap-4 cursor-pointer",
                          selectedFile ? "border-[#00C9A7] bg-[#00C9A7]/5" : "border-slate-200 hover:border-[#00C9A7] hover:bg-slate-50"
                        )}
                        onClick={() => document.getElementById('file-upload')?.click()}
                      >
                        <input 
                          id="file-upload"
                          type="file" 
                          className="hidden" 
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        />
                        <div className={cn(
                          "w-16 h-16 rounded-3xl flex items-center justify-center transition-all",
                          selectedFile ? "bg-[#00C9A7] text-white" : "bg-slate-100 text-slate-400 group-hover:bg-[#00C9A7]/10 group-hover:text-[#00C9A7]"
                        )}>
                          <Upload size={28} />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-[#0B1F3A]">
                            {selectedFile ? selectedFile.name : 'Click to upload estimate document'}
                          </p>
                          <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-widest">
                            {selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : 'PDF, DOCX or Image (Max 10MB)'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">FC Number</label>
                      <input 
                        type="text"
                        value={showEditModal.fc_no || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, fc_no: e.target.value})}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all font-medium"
                        placeholder="FC/2024/001"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">FC Date</label>
                      <input 
                        type="date"
                        value={showEditModal.fc_date || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, fc_date: e.target.value})}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">CA Approval Date</label>
                      <input 
                        type="date"
                        value={showEditModal.ca_date || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, ca_date: e.target.value})}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all font-medium"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">CA Status</label>
                      <select 
                        value={showEditModal.ca_status || 'Pending'}
                        onChange={(e) => setShowEditModal({...showEditModal, ca_status: e.target.value})}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all font-medium cursor-pointer"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Deferred">Deferred</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-10 py-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <button 
                type="button"
                onClick={() => {
                  playSound('tick');
                  currentStep > 1 ? setCurrentStep(prev => (prev - 1) as any) : setShowEditModal(null);
                }}
                className="flex items-center gap-2 px-6 py-3 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-[#0B1F3A] transition-colors"
              >
                <ChevronLeft size={16} />
                {currentStep === 1 ? 'Cancel' : 'Back'}
              </button>

              <div className="flex gap-4">
                {currentStep < 3 ? (
                  <button 
                    type="button"
                    onClick={() => {
                      playSound('tick');
                      setCurrentStep(prev => (prev + 1) as any);
                    }}
                    className="flex items-center gap-2 px-8 py-3.5 bg-[#0B1F3A] text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-[#0B1F3A]/90 transition-all shadow-lg shadow-[#0B1F3A]/20"
                  >
                    Continue
                    <ChevronRight size={16} />
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={handleSaveRecord}
                    disabled={submitting || uploading}
                    className="flex items-center gap-2 px-10 py-3.5 bg-[#00C9A7] text-[#0B1F3A] rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-[#00C9A7]/90 transition-all shadow-lg shadow-[#00C9A7]/20 disabled:opacity-50"
                  >
                    {submitting || uploading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Save Record
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Move to Tender Confirmation Modal */}
      {showMoveConfirm && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-[#0B1F3A]/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10 text-center">
              <div className="w-24 h-24 bg-[#00C9A7]/10 text-[#00C9A7] rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-inner">
                <FileText size={40} />
              </div>
              <h3 className="text-2xl font-bold text-[#0B1F3A] mb-3">Move to Tender?</h3>
              <p className="text-sm text-slate-500 mb-10 leading-relaxed">
                A new Tender record will be created for <br/>
                <span className="font-bold text-[#0B1F3A]">"{showMoveConfirm.name_of_work}"</span>.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={confirmMoveToTender}
                  disabled={submitting}
                  className="w-full py-4 bg-[#00C9A7] text-[#0B1F3A] rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-[#00C9A7]/90 shadow-xl shadow-[#00C9A7]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : 'Yes, Move to Tender'}
                </button>
                <button 
                  onClick={() => setShowMoveConfirm(null)}
                  className="w-full py-4 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-[#0B1F3A] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
