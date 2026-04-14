import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Pencil, Users, 
  FileText, Upload, CheckCircle2, 
  X, Loader2, ExternalLink, ArrowRight,
  TrendingDown, TrendingUp, AlertCircle,
  FileDown, Printer, Download, Save, Lock
} from 'lucide-react';
import { cn } from '../lib/utils';
import { TenderRecord, BidderRecord, User, MasterData } from '../types';
import { format } from 'date-fns';
import { api } from '../services/api';
import { supabase } from '../lib/supabase';
import ErrorMessage from './ErrorMessage';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const EXPORT_FILENAME = 'Tender_Register';
const EXPORT_TITLE = 'Tender Management Register';
const STATUS_COLUMN = 'current_stage';
const STATUS_OPTIONS = [
  'Floating','Technical Evaluation','Financial Opening',
  'Award Approved','Awarded','Cancelled'
];
const ALL_COLUMNS = [
  { key: 'tender_id',          label: 'Tender ID' },
  { key: 'tender_no',          label: 'Tender No' },
  { key: 'name_of_work',       label: 'Name of Work' },
  { key: 'division',           label: 'Division' },
  { key: 'section',            label: 'Section' },
  { key: 'estimated_cost',     label: 'Estimated Cost' },
  { key: 'tender_type',        label: 'Tender Type' },
  { key: 'current_stage',      label: 'Current Stage' },
  { key: 'award_status',       label: 'Award Status' },
  { key: 'l1_bidder_name',     label: 'L1 Bidder' },
  { key: 'l1_amount',          label: 'L1 Amount' },
  { key: 'l1_percentage',      label: 'L1 Percentage' },
  { key: 'tender_float_date',  label: 'Float Date' },
  { key: 'bid_submission_deadline', label: 'Deadline' },
  { key: 'added_by',           label: 'Added By' },
  { key: 'added_on',           label: 'Added On' },
];

const STAGE_BADGES: Record<string, string> = {
  'Floating': 'bg-sky-100 text-sky-700 border-sky-200',
  'Technical Evaluation': 'bg-amber-100 text-amber-700 border-amber-200',
  'Financial Opening': 'bg-purple-100 text-purple-700 border-purple-200',
  'Award Approved': 'bg-green-100 text-green-700 border-green-200',
  'Awarded': 'bg-teal-100 text-teal-700 border-teal-200',
  'Cancelled': 'bg-rose-100 text-rose-700 border-rose-200'
};

const fmtCurrency = (n: number) => {
  if (!n) return 'Rs. 0';
  if (n >= 10000000) return `${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(2)} L`;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(n);
};

export default function Tender() {
  const [records, setRecords] = useState<TenderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [divisions, setDivisions] = useState<MasterData[]>([]);

  // Quick Update State
  const [quickUpdate, setQuickUpdate] = useState<{
    record: TenderRecord;
    type: 'tender';
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
  const [showEditModal, setShowEditModal] = useState<TenderRecord | null>(null);
  const [showBidderModal, setShowBidderModal] = useState<TenderRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Bidder Modal State
  const [bidders, setBidders] = useState<BidderRecord[]>([]);
  const [loadingBidders, setLoadingBidders] = useState(false);
  const [newBidder, setNewBidder] = useState({
    bidder_name: '',
    technical_status: 'Qualified' as const,
    bid_amount: '',
    disqualification_reason: ''
  });

  const [showAwardConfirm, setShowAwardConfirm] = useState<TenderRecord | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('meed_user');
    if (userStr) setCurrentUser(JSON.parse(userStr));
    fetchData();
    api.getDivisions().then(setDivisions).catch(console.error);
  }, []);

  const previewQuery = async () => {
    setExporting(true);
    try {
      let query = supabase
        .from('tender')
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
      .from('tender')
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

  const fetchData = () => {
    setLoading(true);
    api.getTenderRecords()
      .then(setRecords)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  const calcTenderStage = (record: Partial<TenderRecord>): string => {
    if (record.ca_award_approval_date && 
        record.ca_award_approval_date.trim() !== '') 
      return 'Award Approved';
    if (record.award_recommendation_date && 
        record.award_recommendation_date.trim() !== '') 
      return 'Award Recommended';
    if (record.price_bid_opening_date && 
        record.price_bid_opening_date.trim() !== '') 
      return 'Price Bid Opened';
    if (record.tc_meeting_date && 
        record.tc_meeting_date.trim() !== '') 
      return 'Technical Evaluation';
    if (record.no_of_bids_received && 
        Number(record.no_of_bids_received) > 0) 
      return 'Bids Received';
    if (record.tender_float_date && 
        record.tender_float_date.trim() !== '') 
      return 'Floating';
    return 'Tender Initiated';
  };

  const handleEditTender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;
    setSubmitting(true);
    try {
      const autoStage = calcTenderStage(showEditModal);
      const updateData = { ...showEditModal, current_stage: autoStage };

      // If status is changed to Awarded manually, trigger the award logic
      if (updateData.current_stage === 'Awarded') {
        const db = await api.getTenderRecords();
        const originalTender = db.find(t => t.tender_id === updateData.tender_id);
        if (originalTender && originalTender.current_stage !== 'Awarded') {
          // Check if it has an L1 bidder, if not, we might need to warn or handle it
          if (!updateData.l1_bidder_name) {
            throw new Error("Cannot move to Awarded without an L1 Bidder. Please use the 'Award' button in the table actions to properly award the tender.");
          }
          await api.moveToAwarded(updateData, currentUser!);
        } else {
          await api.updateTenderRecord(updateData.tender_id, updateData);
        }
      } else {
        await api.updateTenderRecord(updateData.tender_id, updateData);
      }
      
      setSuccessMessage("Tender updated successfully");
      setShowEditModal(null);
      fetchData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (tenderId: string, file: File, field: 'tender_document' | 'gem_contract_order') => {
    try {
      setSubmitting(true);
      const url = await api.uploadTenderFile(file, tenderId, field);
      if (showEditModal) {
        setShowEditModal({ ...showEditModal, [field]: url });
      }
      setSuccessMessage(`${field.replace('_', ' ')} uploaded!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const loadBidders = async (tenderId: string) => {
    setLoadingBidders(true);
    try {
      const data = await api.getBidders(tenderId);
      setBidders(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingBidders(false);
    }
  };

  const handleAddBidder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showBidderModal || !currentUser) return;
    setSubmitting(true);
    try {
      await api.addBidder({
        ...newBidder,
        tender_id: showBidderModal.tender_id,
        bid_amount: newBidder.technical_status === 'Qualified' ? Number(newBidder.bid_amount) : undefined,
      }, currentUser);
      
      // Re-rank
      await api.reRankBidders(showBidderModal.tender_id, showBidderModal.estimated_cost);
      
      setNewBidder({ bidder_name: '', technical_status: 'Qualified', bid_amount: '', disqualification_reason: '' });
      loadBidders(showBidderModal.tender_id);
      fetchData(); // Refresh main table for L1 info
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmAward = async () => {
    if (!showAwardConfirm || !currentUser) return;
    
    setSubmitting(true);
    try {
      await api.moveToAwarded(showAwardConfirm, currentUser);
      setSuccessMessage("Tender moved to Awarded Works successfully!");
      setShowAwardConfirm(null);
      fetchData();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
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
      const autoStage = calcTenderStage(mergedRecord);
      
      const updateData = {
        ...quickForm,
        current_stage: autoStage,
        last_updated: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('tender')
        .update(updateData)
        .eq('tender_id', quickUpdate.record.tender_id);

      if (updateError) throw updateError;

      await supabase.from('activity_log').insert([{
        log_id: `LOG-${Date.now()}`,
        action: 'QUICK_UPDATE',
        module: 'TENDER',
        record_id: quickUpdate.record.tender_id,
        user_id: currentUser.user_id,
        description: `Quick update performed by ${currentUser.name}. Stage advanced to ${autoStage}`,
        timestamp: new Date().toISOString(),
        status: 'Success'
      }]);

      setQuickUpdate(null);
      setQuickForm({});
      fetchData();
      setSuccessMessage(`Tender updated. New stage: ${autoStage}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setQuickSaving(false);
    }
  };

  const filteredRecords = records.filter(r => 
    (r.name_of_work?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (r.tender_no?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (r.l1_bidder_name?.toLowerCase() || '').includes(search.toLowerCase())
  );

  if (loading && records.length === 0) return <div className="p-10 text-center">Loading tender records...</div>;
  if (error) return <ErrorMessage error={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-[16px] p-6 border border-[var(--border)] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
          <div className="flex-1">
            <h2 className="font-display text-xl font-bold text-[var(--navy)]">Tender Management</h2>
            <p className="text-sm text-[var(--muted)] mt-0.5">Monitor bids, evaluate technicals, and award contracts</p>
          </div>

          {successMessage && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-100 rounded-xl text-xs font-bold animate-in slide-in-from-top-2 duration-300">
              <CheckCircle2 size={14} />
              {successMessage}
            </div>
          )}

          <div className="flex items-center gap-2.5">
            <button 
              onClick={() => {
                setSelectedCols(ALL_COLUMNS.map(c => c.key));
                setShowExportModal(true);
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
                placeholder="Search tenders, bidders..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 bg-[var(--paper)] border border-[var(--border)] rounded-[12px] text-[13px] outline-none focus:border-[var(--teal)] focus:bg-white transition-all w-full md:w-[280px]"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto -mx-6">
          <table className="w-full border-collapse min-w-[1800px]">
            <thead>
              <tr className="bg-[var(--paper)]">
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Tender Details</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Estimated Cost</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Division / Section</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">L1 Bidder / Amount</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Bids / TC</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Diff %</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Negotiated Amt</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Current Stage</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Competent Authority</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Deadlines</th>
                <th className="px-6 py-3 text-right text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredRecords.map((r) => {
                const isBelow = (r.l1_percentage || '').startsWith('-');
                return (
                  <tr key={r.tender_id} className="hover:bg-[var(--teal)]/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="text-[13px] font-bold text-[var(--navy)] line-clamp-1">{r.name_of_work}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-[var(--muted)] bg-slate-100 px-1.5 py-0.5 rounded uppercase">{r.tender_no}</span>
                        <span className="text-[10px] text-[var(--muted)]">{r.tender_type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-[13px] font-semibold text-[var(--ink)]">
                      {fmtCurrency(r.estimated_cost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-[12px] font-bold text-[var(--navy)]">{r.division}</div>
                      <div className="text-[11px] text-[var(--muted)]">{r.section}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {r.l1_bidder_name ? (
                        <>
                           <div className="text-[13px] font-bold text-[var(--navy)]">{r.l1_bidder_name}</div>
                           <div className="text-[11px] text-[var(--muted)]">{fmtCurrency(r.l1_amount)}</div>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No bids yet</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {r.no_of_bids_received ? (
                        <>
                          <div className="text-[12px] font-bold text-[var(--navy)]">{r.no_of_bids_received} bids</div>
                          <div className="text-[10px] text-[var(--muted)]">Q: {r.tc_qualified_count || 0} / DQ: {r.tc_disqualified_count || 0}</div>
                        </>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {r.l1_percentage ? (
                        <div className={cn(
                          "flex items-center gap-1 text-[12px] font-bold",
                          isBelow ? "text-teal-600" : "text-rose-600"
                        )}>
                          {isBelow ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                          {r.l1_percentage}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-[13px] font-semibold text-[var(--ink)]">
                      {r.negotiated_amount ? fmtCurrency(r.negotiated_amount) : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span 
                          className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider cursor-pointer hover:opacity-80 transition-opacity", 
                            STAGE_BADGES[r.current_stage] || 'bg-slate-100'
                          )}
                          onClick={() => {
                            setQuickUpdate({ record: r, type: 'tender' });
                            setQuickForm({});
                          }}
                          title="Click to quick update"
                        >
                          {r.current_stage}
                        </span>
                        {r.award_status && (
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider",
                            r.award_status === 'Approved' ? "bg-green-50 text-green-700 border-green-100" : "bg-amber-50 text-amber-700 border-amber-100"
                          )}>
                            Award: {r.award_status}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-[12px] font-medium text-[var(--muted)]">
                      {r.competent_authority || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-[11px] text-[var(--muted)]">
                        Float: {r.tender_float_date ? format(new Date(r.tender_float_date), 'dd MMM yy') : '-'}
                      </div>
                      <div className="text-[11px] font-bold text-rose-600 mt-0.5">
                        Due: {r.bid_submission_deadline ? format(new Date(r.bid_submission_deadline), 'dd MMM yy') : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => { setShowBidderModal(r); loadBidders(r.tender_id); }}
                          className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                          title="Manage Bidders"
                        >
                          <Users size={16} />
                        </button>
                        <button 
                          onClick={() => setShowEditModal(r)}
                          className="p-2 text-slate-400 hover:text-[var(--teal)] hover:bg-teal-50 rounded-lg transition-all"
                          title="Edit Tender"
                        >
                          <Pencil size={16} />
                        </button>
                        {r.award_status === 'Approved' && r.current_stage !== 'Awarded' && (
                          <button 
                            onClick={() => setShowAwardConfirm(r)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-[11px] font-bold hover:bg-teal-700 shadow-sm transition-all"
                          >
                            Award <ArrowRight size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
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

      {/* Edit Tender Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-800">Edit Tender: {showEditModal.tender_no}</h3>
              <button onClick={() => setShowEditModal(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={handleEditTender} className="flex-1 overflow-y-auto p-6">
              <div className="space-y-10">
                {/* SECTION 1 — General */}
                <div className="space-y-4">
                  <h4 className="text-[12px] font-bold text-[var(--teal)] uppercase tracking-[0.2em] border-b border-teal-100 pb-2">SECTION 1 — General</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Name of Work</label>
                      <textarea 
                        value={showEditModal.name_of_work || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, name_of_work: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-[var(--teal)] outline-none min-h-[100px] transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tender No</label>
                      <div className="flex items-center gap-3 px-4 py-3 bg-teal-50/50 border border-teal-100 rounded-xl text-sm font-bold text-teal-700">
                        <Lock size={14} className="text-teal-400" />
                        {showEditModal.tender_no}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Competent Authority</label>
                      <div className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-600">
                        {showEditModal.competent_authority || '—'}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Division</label>
                      <div className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-600">
                        {showEditModal.division}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Section</label>
                      <div className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-600">
                        {showEditModal.section}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 2 — Classification */}
                <div className="space-y-4">
                  <h4 className="text-[12px] font-bold text-[var(--teal)] uppercase tracking-[0.2em] border-b border-teal-100 pb-2">SECTION 2 — Classification</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tender Type</label>
                      <select 
                        value={showEditModal.tender_type || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, tender_type: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
                      >
                        <option value="Open Tender">Open Tender</option>
                        <option value="Limited Tender">Limited Tender</option>
                        <option value="Single Tender">Single Tender</option>
                        <option value="GeM Procurement">GeM Procurement</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Procurement Mode</label>
                      <select 
                        value={showEditModal.procurement_mode || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, procurement_mode: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
                      >
                        <option value="">Select Mode</option>
                        <option value="e-Tender">e-Tender</option>
                        <option value="GeM Portal">GeM Portal</option>
                        <option value="Manual">Manual</option>
                        <option value="Rate Contract">Rate Contract</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Current Stage</label>
                      <div className="p-4 bg-teal-50 border border-teal-100 rounded-2xl">
                        <div className={cn("inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider shadow-sm", STAGE_BADGES[calcTenderStage(showEditModal)] || 'bg-slate-100')}>
                          {calcTenderStage(showEditModal)}
                        </div>
                        <p className="text-[10px] text-teal-600 mt-2 font-medium uppercase tracking-widest">Auto-calculated based on data</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Award Status</label>
                      <select 
                        value={showEditModal.award_status || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, award_status: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
                      >
                        <option value="">Pending</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                    {showEditModal.award_status === 'Cancelled' && (
                      <div className="md:col-span-2 space-y-1.5 animate-in zoom-in-95 duration-200">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cancellation Reason</label>
                        <input 
                          type="text"
                          value={showEditModal.cancellation_reason || ''}
                          onChange={(e) => setShowEditModal({...showEditModal, cancellation_reason: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-rose-500 transition-all"
                          placeholder="Enter reason for cancellation..."
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION 3 — Key Dates */}
                <div className="space-y-4">
                  <h4 className="text-[12px] font-bold text-[var(--teal)] uppercase tracking-[0.2em] border-b border-teal-100 pb-2">SECTION 3 — Key Dates</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tender Float Date</label>
                      <input 
                        type="date"
                        value={showEditModal.tender_float_date?.split('T')[0] || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, tender_float_date: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bid Submission Deadline</label>
                      <input 
                        type="date"
                        value={showEditModal.bid_submission_deadline?.split('T')[0] || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, bid_submission_deadline: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bid Opening Date</label>
                      <input 
                        type="date"
                        value={showEditModal.bid_opening_date?.split('T')[0] || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, bid_opening_date: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">TC Meeting Date</label>
                      <input 
                        type="date"
                        value={showEditModal.tc_meeting_date?.split('T')[0] || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, tc_meeting_date: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">TC Recommendation Approval Date</label>
                      <input 
                        type="date"
                        value={showEditModal.tc_recommendation_approval_date?.split('T')[0] || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, tc_recommendation_approval_date: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Price Bid Opening Date</label>
                      <input 
                        type="date"
                        value={showEditModal.price_bid_opening_date?.split('T')[0] || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, price_bid_opening_date: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Award Recommendation Date</label>
                      <input 
                        type="date"
                        value={showEditModal.award_recommendation_date?.split('T')[0] || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, award_recommendation_date: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">CA Award Approval Date</label>
                      <input 
                        type="date"
                        value={showEditModal.ca_award_approval_date?.split('T')[0] || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, ca_award_approval_date: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 4 — Financials & Bid Info */}
                <div className="space-y-4">
                  <h4 className="text-[12px] font-bold text-[var(--teal)] uppercase tracking-[0.2em] border-b border-teal-100 pb-2">SECTION 4 — Financials & Bid Info</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Estimated Cost</label>
                      <input 
                        type="number"
                        value={showEditModal.estimated_cost || 0}
                        onChange={(e) => setShowEditModal({...showEditModal, estimated_cost: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all font-bold text-[#0B1F3A]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">EMD Amount</label>
                      <input 
                        type="number"
                        value={showEditModal.emd_amount || 0}
                        onChange={(e) => setShowEditModal({...showEditModal, emd_amount: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">No. of Bids Received</label>
                      <input 
                        type="number"
                        value={showEditModal.no_of_bids_received || 0}
                        onChange={(e) => setShowEditModal({...showEditModal, no_of_bids_received: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">No. of Price Bids Opened</label>
                      <input 
                        type="number"
                        value={showEditModal.no_of_price_bids_opened || 0}
                        onChange={(e) => setShowEditModal({...showEditModal, no_of_price_bids_opened: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">TC Qualified Count</label>
                      <input 
                        type="number"
                        value={showEditModal.tc_qualified_count || 0}
                        onChange={(e) => setShowEditModal({...showEditModal, tc_qualified_count: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500 transition-all font-bold text-emerald-600"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">TC Disqualified Count</label>
                      <input 
                        type="number"
                        value={showEditModal.tc_disqualified_count || 0}
                        onChange={(e) => setShowEditModal({...showEditModal, tc_disqualified_count: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-rose-500 transition-all font-bold text-rose-600"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">L1 Bidder Name</label>
                      <div className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-[#0B1F3A]">
                        {showEditModal.l1_bidder_name || '—'}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">L1 Amount</label>
                      <div className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-[#0B1F3A]">
                        {showEditModal.l1_amount ? fmtCurrency(showEditModal.l1_amount) : '—'}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">L1 Percentage</label>
                      <div className={cn(
                        "px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold",
                        (showEditModal.l1_percentage || '').startsWith('-') ? "text-teal-600" : "text-rose-600"
                      )}>
                        {showEditModal.l1_percentage || '—'}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Negotiated Amount</label>
                      <input 
                        type="number"
                        value={showEditModal.negotiated_amount || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, negotiated_amount: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all font-bold text-[#0B1F3A]"
                        placeholder="Enter negotiated amount if any..."
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 5 — Documents */}
                <div className="space-y-4">
                  <h4 className="text-[12px] font-bold text-[var(--teal)] uppercase tracking-[0.2em] border-b border-teal-100 pb-2">SECTION 5 — Documents</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tender Document (NIT)</label>
                      <div className="flex items-center gap-3">
                        <label className="flex-1 cursor-pointer group">
                          <div className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-slate-200 rounded-2xl group-hover:border-[var(--teal)] group-hover:bg-teal-50/30 transition-all">
                            <Upload size={20} className="text-slate-400 group-hover:text-[var(--teal)]" />
                            <span className="text-xs font-bold text-slate-500 group-hover:text-[var(--teal)]">Click to upload NIT</span>
                          </div>
                          <input 
                            type="file" 
                            className="hidden" 
                            onChange={(e) => e.target.files?.[0] && handleFileUpload(showEditModal.tender_id, e.target.files[0], 'tender_document')} 
                          />
                        </label>
                        {showEditModal.tender_document && (
                          <a href={showEditModal.tender_document} target="_blank" rel="noreferrer" className="p-3 bg-teal-50 text-[var(--teal)] rounded-xl hover:bg-teal-100 transition-all">
                            <FileText size={20} />
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">GeM Contract Order</label>
                      <div className="flex items-center gap-3">
                        <label className="flex-1 cursor-pointer group">
                          <div className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-slate-200 rounded-2xl group-hover:border-[var(--teal)] group-hover:bg-teal-50/30 transition-all">
                            <Upload size={20} className="text-slate-400 group-hover:text-[var(--teal)]" />
                            <span className="text-xs font-bold text-slate-500 group-hover:text-[var(--teal)]">Click to upload Order</span>
                          </div>
                          <input 
                            type="file" 
                            className="hidden" 
                            onChange={(e) => e.target.files?.[0] && handleFileUpload(showEditModal.tender_id, e.target.files[0], 'gem_contract_order')} 
                          />
                        </label>
                        {showEditModal.gem_contract_order && (
                          <a href={showEditModal.gem_contract_order} target="_blank" rel="noreferrer" className="p-3 bg-sky-50 text-sky-600 rounded-xl hover:bg-sky-100 transition-all">
                            <FileText size={20} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowEditModal(null)}
                  className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-[var(--teal)] text-white rounded-xl font-bold text-sm hover:bg-[var(--teal2)] transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bidder Management Modal */}
      {showBidderModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-800">Bidder Management</h3>
                <p className="text-[11px] text-slate-500 font-medium">{showBidderModal.name_of_work}</p>
              </div>
              <button onClick={() => setShowBidderModal(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* Add Bidder Form */}
              <div className="w-full md:w-80 border-r border-slate-100 p-6 bg-slate-50/30">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Add New Bidder</h4>
                <form onSubmit={handleAddBidder} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bidder Name</label>
                    <input 
                      required
                      type="text"
                      value={newBidder.bidder_name || ''}
                      onChange={(e) => setNewBidder({...newBidder, bidder_name: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]"
                      placeholder="e.g. L&T Construction"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Technical Status</label>
                    <div className="flex p-1 bg-slate-100 rounded-xl">
                      <button 
                        type="button"
                        onClick={() => setNewBidder({...newBidder, technical_status: 'Qualified'})}
                        className={cn(
                          "flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all",
                          newBidder.technical_status === 'Qualified' ? "bg-white text-teal-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        Qualified
                      </button>
                      <button 
                        type="button"
                        onClick={() => setNewBidder({...newBidder, technical_status: 'Disqualified'})}
                        className={cn(
                          "flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all",
                          newBidder.technical_status === 'Disqualified' ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        Disqualified
                      </button>
                    </div>
                  </div>

                  {newBidder.technical_status === 'Qualified' ? (
                    <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bid Amount (Rs.)</label>
                      <input 
                        required
                        type="number"
                        value={newBidder.bid_amount || ''}
                        onChange={(e) => setNewBidder({...newBidder, bid_amount: e.target.value})}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]"
                        placeholder="0.00"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Disqualification Reason</label>
                      <textarea 
                        required
                        value={newBidder.disqualification_reason || ''}
                        onChange={(e) => setNewBidder({...newBidder, disqualification_reason: e.target.value})}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] min-h-[80px]"
                        placeholder="e.g. Missing EMD, Invalid License"
                      />
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 bg-[var(--navy)] text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    Add Bidder
                  </button>
                </form>
              </div>

              {/* Bidders List */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Participating Bidders</h4>
                  <div className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase">
                    Estimate: {fmtCurrency(showBidderModal.estimated_cost)}
                  </div>
                </div>

                {loadingBidders ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Loader2 size={32} className="animate-spin mb-2" />
                    <span className="text-sm font-medium">Loading bidders...</span>
                  </div>
                ) : bidders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                    <Users size={48} className="mb-2 opacity-20" />
                    <span className="text-sm font-medium italic">No bidders added yet</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bidders.map((b) => (
                      <div key={b.bidder_id} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between hover:border-slate-200 transition-all shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm",
                            b.financial_rank === 'L1' ? "bg-teal-50 text-teal-600" : "bg-slate-50 text-slate-500"
                          )}>
                            {b.technical_status === 'Qualified' ? b.financial_rank || '-' : 'DQ'}
                          </div>
                          <div>
                            <div className="text-[13px] font-bold text-[var(--navy)]">{b.bidder_name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={cn(
                                "text-[10px] font-bold uppercase tracking-wider",
                                b.technical_status === 'Qualified' ? "text-teal-600" : "text-rose-600"
                              )}>
                                {b.technical_status}
                              </span>
                              {b.technical_status === 'Disqualified' && (
                                <span className="text-[10px] text-slate-400 italic">— {b.disqualification_reason}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {b.technical_status === 'Qualified' && (
                          <div className="text-right">
                            <div className="text-[13px] font-bold text-[var(--navy)]">{fmtCurrency(b.bid_amount || 0)}</div>
                            <div className={cn(
                              "text-[10px] font-bold flex items-center justify-end gap-1",
                              (b.percentage_vs_estimate || 0) < 0 ? "text-teal-600" : "text-rose-600"
                            )}>
                              {(b.percentage_vs_estimate || 0) < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                              {Math.abs(b.percentage_vs_estimate || 0).toFixed(2)}% vs Est.
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

        {/* Quick Update Modal */}
        {quickUpdate && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-[400px] overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-8 py-6 bg-[#0B1F3A] text-white flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">Quick Update</h3>
                  <p className="text-[10px] text-white/60 uppercase tracking-widest font-bold">{quickUpdate.record.current_stage}</p>
                </div>
                <button 
                  onClick={() => setQuickUpdate(null)} 
                  className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Fill the next required fields to advance this tender record.
                </p>

                <div className="space-y-5">
                  {quickUpdate.record.current_stage === 'Tender Initiated' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Tender Float Date</label>
                        <input 
                          type="date"
                          value={quickForm.tender_float_date ?? quickUpdate.record.tender_float_date}
                          onChange={(e) => setQuickForm({...quickForm, tender_float_date: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all font-medium"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Procurement Mode</label>
                        <select 
                          value={quickForm.procurement_mode ?? quickUpdate.record.procurement_mode}
                          onChange={(e) => setQuickForm({...quickForm, procurement_mode: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all font-medium"
                        >
                          <option value="">Select Mode</option>
                          <option value="e-Tender">e-Tender</option>
                          <option value="GeM Portal">GeM Portal</option>
                          <option value="Manual">Manual</option>
                          <option value="Rate Contract">Rate Contract</option>
                        </select>
                      </div>
                    </>
                  )}

                  {quickUpdate.record.current_stage === 'Floating' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Bid Submission Deadline</label>
                        <input 
                          type="date"
                          value={quickForm.bid_submission_deadline ?? quickUpdate.record.bid_submission_deadline}
                          onChange={(e) => setQuickForm({...quickForm, bid_submission_deadline: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all font-medium"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Bid Opening Date</label>
                        <input 
                          type="date"
                          value={quickForm.bid_opening_date ?? quickUpdate.record.bid_opening_date}
                          onChange={(e) => setQuickForm({...quickForm, bid_opening_date: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all font-medium"
                        />
                      </div>
                      <p className="text-[10px] text-amber-600 font-bold bg-amber-50 p-2 rounded-lg">
                        Note: Add bidders via the "Manage Bidders" icon to advance to "Bids Received" stage.
                      </p>
                    </>
                  )}

                  {quickUpdate.record.current_stage === 'Bids Received' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">No. of Bids Received</label>
                        <input 
                          type="number"
                          value={quickForm.no_of_bids_received ?? quickUpdate.record.no_of_bids_received}
                          onChange={(e) => setQuickForm({...quickForm, no_of_bids_received: Number(e.target.value)})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all font-bold text-[#0B1F3A]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">TC Meeting Date</label>
                        <input 
                          type="date"
                          value={quickForm.tc_meeting_date ?? quickUpdate.record.tc_meeting_date}
                          onChange={(e) => setQuickForm({...quickForm, tc_meeting_date: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all font-medium"
                        />
                      </div>
                    </>
                  )}

                  {quickUpdate.record.current_stage === 'Technical Evaluation' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">TC Qualified</label>
                          <input 
                            type="number"
                            value={quickForm.tc_qualified_count ?? quickUpdate.record.tc_qualified_count}
                            onChange={(e) => setQuickForm({...quickForm, tc_qualified_count: Number(e.target.value)})}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all font-bold text-emerald-600"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">TC Disqualified</label>
                          <input 
                            type="number"
                            value={quickForm.tc_disqualified_count ?? quickUpdate.record.tc_disqualified_count}
                            onChange={(e) => setQuickForm({...quickForm, tc_disqualified_count: Number(e.target.value)})}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all font-bold text-rose-600"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">TC Approval Date</label>
                        <input 
                          type="date"
                          value={quickForm.tc_recommendation_approval_date ?? quickUpdate.record.tc_recommendation_approval_date}
                          onChange={(e) => setQuickForm({...quickForm, tc_recommendation_approval_date: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all font-medium"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Price Bid Opening Date</label>
                        <input 
                          type="date"
                          value={quickForm.price_bid_opening_date ?? quickUpdate.record.price_bid_opening_date}
                          onChange={(e) => setQuickForm({...quickForm, price_bid_opening_date: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all font-medium"
                        />
                      </div>
                    </>
                  )}

                  {quickUpdate.record.current_stage === 'Price Bid Opened' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">No. of Price Bids Opened</label>
                        <input 
                          type="number"
                          value={quickForm.no_of_price_bids_opened ?? quickUpdate.record.no_of_price_bids_opened}
                          onChange={(e) => setQuickForm({...quickForm, no_of_price_bids_opened: Number(e.target.value)})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all font-bold text-[#0B1F3A]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Award Recommendation Date</label>
                        <input 
                          type="date"
                          value={quickForm.award_recommendation_date ?? quickUpdate.record.award_recommendation_date}
                          onChange={(e) => setQuickForm({...quickForm, award_recommendation_date: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all font-medium"
                        />
                      </div>
                    </>
                  )}

                  {quickUpdate.record.current_stage === 'Award Recommended' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">CA Award Approval Date</label>
                        <input 
                          type="date"
                          value={quickForm.ca_award_approval_date ?? quickUpdate.record.ca_award_approval_date}
                          onChange={(e) => setQuickForm({...quickForm, ca_award_approval_date: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all font-medium"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Award Status</label>
                        <select 
                          value={quickForm.award_status ?? quickUpdate.record.award_status}
                          onChange={(e) => setQuickForm({...quickForm, award_status: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all font-medium"
                        >
                          <option value="">Select Status</option>
                          <option value="Approved">Approved</option>
                          <option value="Rejected">Rejected</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>
                    </>
                  )}

                  {quickUpdate.record.current_stage === 'Award Approved' && (
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-4">
                      <div className="flex items-center gap-3 text-emerald-700">
                        <CheckCircle2 size={20} />
                        <p className="text-sm font-bold uppercase tracking-wider">Ready to Award</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-emerald-600/60 uppercase tracking-widest font-bold">L1 Bidder</p>
                        <p className="text-sm font-bold text-[#0B1F3A]">{quickUpdate.record.l1_bidder_name || 'Not set'}</p>
                      </div>
                      <button 
                        onClick={() => {
                          setShowAwardConfirm(quickUpdate.record);
                          setQuickUpdate(null);
                        }}
                        className="w-full py-3 bg-[#00C9A7] text-[#0B1F3A] rounded-xl font-bold text-sm hover:bg-[#00C9A7]/90 transition-all shadow-lg shadow-[#00C9A7]/20 flex items-center justify-center gap-2"
                      >
                        Award Work <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {quickUpdate.record.current_stage !== 'Award Approved' && (
                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    <div className="flex items-center gap-2 text-[#00C9A7]">
                      <TrendingUp size={14} />
                      <p className="text-[10px] font-bold uppercase tracking-wider">
                        Next Stage: <span className="text-[#0B1F3A]">{calcTenderStage({...quickUpdate.record, ...quickForm})}</span>
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setQuickUpdate(null)}
                        className="flex-1 py-3 text-slate-400 font-bold text-sm hover:bg-slate-50 rounded-xl transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleQuickSave}
                        disabled={quickSaving}
                        className="flex-[2] py-3 bg-[#00C9A7] text-[#0B1F3A] rounded-xl font-bold text-sm hover:bg-[#00C9A7]/90 transition-all shadow-lg shadow-[#00C9A7]/20 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {quickSaving ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18} /> Save Update</>}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {/* Award Confirmation Modal */}
      {showAwardConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Award this Tender?</h3>
              <p className="text-sm text-slate-500 mb-6">
                This will move <span className="font-bold text-slate-700">"{showAwardConfirm.name_of_work}"</span> to the Awarded Works module. 
                The contract will be officially initiated.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowAwardConfirm(null)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmAward}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-xl font-bold text-sm hover:bg-teal-700 shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Yes, Award Work'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
