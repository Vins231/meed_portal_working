import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Pencil, Users, 
  FileText, Upload, CheckCircle2, 
  X, Loader2, ExternalLink, ArrowRight,
  TrendingDown, TrendingUp, AlertCircle,
  FileDown, Printer, Download, Save, Lock,
  Trash2, Calendar, Clock, CloudUpload,
  Hash, Layout, Award, ArrowRightCircle, CircleDashed,
  Info, Check, Trophy
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
  'Tender Initiated': 'bg-slate-100 text-slate-700 border-slate-200',
  'Floating': 'bg-sky-100 text-sky-700 border-sky-200',
  'Bids Received': 'bg-blue-100 text-blue-700 border-blue-200',
  'Technical Evaluation': 'bg-amber-100 text-amber-700 border-amber-200',
  'Price Bid Opened': 'bg-purple-100 text-purple-700 border-purple-200',
  'Award Recommended': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Award Approved': 'bg-green-100 text-green-700 border-green-200',
  'Awarded': 'bg-teal-100 text-teal-700 border-teal-200',
  'Cancelled': 'bg-rose-100 text-rose-700 border-rose-200'
};

const TENDER_TABS = [
  { id: 0, label: 'Published', icon: Layout },
  { id: 1, label: 'Bids', icon: Users },
  { id: 2, label: 'Technical', icon: CircleDashed },
  { id: 3, label: 'Price Bids', icon: Hash },
  { id: 4, label: 'Award', icon: Award },
];

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
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // New Edit Modal State
  const [activeTab, setActiveTab] = useState(0);
  const [editForm, setEditForm] = useState<Partial<TenderRecord>>({});
  const [bidders, setBidders] = useState<BidderRecord[]>([]);
  const [loadingBidders, setLoadingBidders] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newBidder, setNewBidder] = useState({
    bidder_name: '',
    emd_status: 'Submitted'
  });

  const [uploading, setUploading] = useState<string | null>(null);
  const [editingReason, setEditingReason] = useState<{id: string, value: string} | null>(null);

  const [showAwardConfirm, setShowAwardConfirm] = useState<TenderRecord | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('meed_user');
    if (userStr) setCurrentUser(JSON.parse(userStr));
    fetchData();
    api.getDivisions().then(setDivisions).catch(console.error);
  }, []);

  const openEditModal = (record: TenderRecord) => {
    setEditForm(record);
    setShowEditModal(record);
    setActiveTab(0);
    fetchBidders(record.tender_id);
  };

  const fetchBidders = async (tenderId: string) => {
    setLoadingBidders(true);
    try {
      const data = await api.getBidders(tenderId);
      setBidders(data);
    } catch (err: any) {
      console.error("Error fetching bidders:", err);
    } finally {
      setLoadingBidders(false);
    }
  };

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

  const calculateRanks = (allBidders: BidderRecord[]) => {
    const withAmounts = allBidders
      .filter(b => b.bid_amount && b.bid_amount > 0)
      .sort((a, b) => (a.bid_amount || 0) - (b.bid_amount || 0));
    
    return allBidders.map(b => {
      if (!b.bid_amount || b.bid_amount <= 0) return { ...b, financial_rank: null };
      const rank = withAmounts.findIndex(w => w.bidder_id === b.bidder_id) + 1;
      return { ...b, financial_rank: rank > 0 ? `L${rank}` : null };
    });
  };

  const handleTabSave = async () => {
    if (!showEditModal || !editForm.tender_id || !currentUser) return;
    setSaving(true);
    try {
      const autoStage = calcTenderStage(editForm);
      const updateData: any = { 
        ...editForm, 
        current_stage: autoStage,
        last_updated: new Date().toISOString()
      };

      // Tab 4: Price Bids - Calculate Ranks and L1 summary
      if (activeTab === 3) {
        const qualifiedBidders = bidders.filter(b => b.technical_status === 'Qualified');
        const sorted = [...qualifiedBidders]
          .filter(b => (b.bid_amount || 0) > 0)
          .sort((a, b) => (a.bid_amount || 0) - (b.bid_amount || 0));
        
        if (sorted.length > 0) {
          const l1 = sorted[0];
          updateData.l1_bidder_name = l1.bidder_name;
          updateData.l1_amount = l1.bid_amount;
          
          const est = editForm.estimated_cost || 0;
          if (est > 0) {
            const diff = (((l1.bid_amount || 0) - est) / est) * 100;
            updateData.l1_percentage = `${diff > 0 ? '+' : ''}${diff.toFixed(2)}%`;
          }
        }

        // Save bidder ranks and prices
        for (const b of bidders) {
           if (b.technical_status === 'Qualified' && (b.bid_amount || 0) > 0) {
              const rank = sorted.findIndex(s => s.bidder_id === b.bidder_id) + 1;
              const financial_rank = rank > 0 ? `L${rank}` : null;
              await supabase.from('tender_bidders').update({ 
                bid_amount: b.bid_amount,
                financial_rank,
                percentage_vs_estimate: b.percentage_vs_estimate 
              }).eq('bidder_id', b.bidder_id);
           }
        }
      }

      // Tab 3: Technical Evaluation - Save bidder technical status
      if (activeTab === 2) {
        for (const b of bidders) {
          await supabase.from('tender_bidders').update({
            technical_status: b.technical_status,
            disqualification_reason: b.disqualification_reason
          }).eq('bidder_id', b.bidder_id);
        }
        updateData.tc_qualified_count = bidders.filter(b => b.technical_status === 'Qualified').length;
        updateData.tc_disqualified_count = bidders.filter(b => b.technical_status === 'Disqualified').length;
      }

      const { error } = await supabase
        .from('tender')
        .update(updateData)
        .eq('tender_id', editForm.tender_id);

      if (error) throw error;

      await api.logActivity('UPDATE', 'TENDER', editForm.tender_id, `Updated Tender Tab ${activeTab + 1}: Stage advanced to ${autoStage}`, currentUser);

      setLastSaved(new Date().toLocaleTimeString());
      setSuccessMessage(`Tab ${activeTab + 1} saved successfully`);
      fetchData();
      
      // Sync local form state
      setEditForm(prev => ({ 
        ...prev, 
        ...updateData
      }));

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditTender = async (e: React.FormEvent) => {
    e.preventDefault();
    handleTabSave();
  };

  const handleFileUpload = async (
    file: File,
    field: string, 
    pathSuffix: string
  ) => {
    if (!showEditModal?.tender_id) return;
    try {
      setUploading(field);
      const fileExt = file.name.split('.').pop();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `tender/${showEditModal.tender_id}/${pathSuffix}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('meed-documents')
        .upload(filePath, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('meed-documents')
        .getPublicUrl(filePath);
      
      setEditForm(prev => ({ ...prev, [field]: publicUrl }));
      setSuccessMessage(`${field.replace(/_/g,' ')} uploaded successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setUploading(null);
    }
  };

  const handleAddBidder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal || !currentUser || !newBidder.bidder_name) return;
    
    // Count limit check
    const maxBidders = editForm.no_of_bids_received || 0;
    if (maxBidders > 0 && bidders.length >= maxBidders) {
      setError(`Maximum ${maxBidders} bidders allowed as per bids received count`);
      return;
    }

    setSaving(true);
    try {
      const bidderId = `BID-${Date.now()}`;
      const srNo = bidders.length + 1;

      const { data, error } = await supabase
        .from('tender_bidders')
        .insert([{
          bidder_id: bidderId,
          tender_id: showEditModal.tender_id,
          bidder_name: newBidder.bidder_name,
          emd_status: newBidder.emd_status,
          sr_no: srNo,
          technical_status: null,
          added_by: currentUser.name,
          added_on: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      
      setBidders([...bidders, data]);
      setNewBidder({ bidder_name: '', emd_status: 'Submitted' });
      setSuccessMessage("Bidder added successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteBidder = async (bidderId: string) => {
    if (!window.confirm("Remove this bidder?")) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('tender_bidders')
        .delete()
        .eq('bidder_id', bidderId);

      if (error) throw error;
      
      setBidders(bidders.filter(b => b.bidder_id !== bidderId));
      setSuccessMessage("Bidder removed");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateBidderStatus = async (bidderId: string, status: string | null, reason: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('tender_bidders')
        .update({ 
          technical_status: status, 
          disqualification_reason: reason 
        })
        .eq('bidder_id', bidderId);

      if (error) throw error;
      
      setBidders(bidders.map(b => 
        b.bidder_id === bidderId 
          ? { ...b, technical_status: status, disqualification_reason: reason } 
          : b
      ));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveAllBiddersStatus = async () => {
    setSaving(true);
    try {
      for (const b of bidders) {
        await supabase
          .from('tender_bidders')
          .update({ 
            technical_status: b.technical_status, 
            disqualification_reason: b.disqualification_reason 
          })
          .eq('bidder_id', b.bidder_id);
      }
      setSuccessMessage("All bidder statuses updated");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePriceEntry = (bidderId: string, amount: number) => {
    const updated = bidders.map(b => {
      if (b.bidder_id === bidderId) {
        const est = editForm.estimated_cost || 0;
        const pct = est > 0 ? ((amount - est) / est) * 100 : 0;
        return { 
          ...b, 
          bid_amount: amount,
          percentage_vs_estimate: pct.toFixed(2)
        };
      }
      return b;
    });

    // Re-rank
    const qualifiedWithPrice = updated
      .filter(b => b.technical_status === 'Qualified' && b.bid_amount)
      .sort((a, b) => (a.bid_amount || 0) - (b.bid_amount || 0));

    const final = updated.map(b => {
      if (b.technical_status === 'Qualified' && b.bid_amount) {
        const rankIdx = qualifiedWithPrice.findIndex(q => q.bidder_id === b.bidder_id);
        return { ...b, financial_rank: `L${rankIdx + 1}` };
      }
      return b;
    });

    setBidders(final);
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
                      <div className="flex flex-col gap-1">
                        {fmtCurrency(r.estimated_cost)}
                        <span className={cn(
                          "inline-flex w-fit px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                          r.gst_inclusive ? "bg-amber-50 text-amber-600 border border-amber-100" : "bg-slate-50 text-slate-500 border border-slate-100"
                        )}>
                          {r.gst_inclusive ? 'Incl. GST' : 'Excl. GST'}
                        </span>
                      </div>
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
                          onClick={() => { setShowBidderModal(r); fetchBidders(r.tender_id); }}
                          className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                          title="Manage Bidders"
                        >
                          <Users size={16} />
                        </button>
                        <button 
                          onClick={() => openEditModal(r)}
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

      {/* Edit Tender Modal - Refactored to 5 Tabs */}
      {showEditModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-[var(--navy)] text-base">
                  {showEditModal.name_of_work?.substring(0, 50)}
                </h3>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tender No: {showEditModal.tender_no}</span>
                  <div className="h-1 w-1 rounded-full bg-slate-300"></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stage: {calcTenderStage(editForm as TenderRecord)}</span>
                </div>
              </div>
              <button onClick={() => setShowEditModal(null)} className="p-2 hover:bg-white hover:shadow-sm rounded-full transition-all text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            {/* Sub-Header / Status Bar */}
            <div className="px-6 py-3 bg-white border-b border-slate-50 flex items-center justify-between flex-wrap gap-y-4">
              <div className="flex gap-6">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Division</span>
                  <span className="text-xs font-semibold text-slate-700">{editForm.division}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Authority</span>
                  <span className="text-xs font-semibold text-slate-700">{editForm.competent_authority}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Est. Cost</span>
                  <span className="text-xs font-bold text-[var(--navy)]">{fmtCurrency(editForm.estimated_cost || 0)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {lastSaved && (
                  <span className="text-[10px] text-teal-600 font-medium bg-teal-50 px-2 py-1 rounded-md">
                    Last saved: {lastSaved}
                  </span>
                )}
                <button 
                  onClick={handleTabSave}
                  disabled={saving}
                  className="px-4 py-2 bg-[var(--navy)] text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save Tab
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-100 bg-white overflow-x-auto scrollbar-hide">
              {TENDER_TABS.map((tab, i) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(i)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1 py-3 px-2 text-[10px] font-bold uppercase tracking-wider transition-all relative whitespace-nowrap min-w-0",
                    activeTab === i
                      ? "text-[var(--teal)]"
                      : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <tab.icon size={16} className="shrink-0" />
                  <span className="truncate w-full text-center text-[9px]">
                    {tab.label}
                  </span>
                  {activeTab === i && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--teal)] rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content Area */}
            <div className="flex-1 overflow-y-auto p-8 bg-white">
              <div className="max-w-5xl mx-auto">
                
                {/* 1. PUBLISHED TAB */}
                {activeTab === 0 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <Layout size={12} className="text-[var(--teal)]" />
                          Name of Work
                        </label>
                        <textarea
                          value={editForm.name_of_work || ''}
                          onChange={(e) => setEditForm({ ...editForm, name_of_work: e.target.value })}
                          className="w-full h-24 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-[var(--teal)] outline-none transition-all resize-none font-medium leading-relaxed"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Tender Type</label>
                        <select
                          value={editForm.tender_type || ''}
                          onChange={(e) => setEditForm({ ...editForm, tender_type: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]"
                        >
                          <option value="Open Tender">Open Tender</option>
                          <option value="Limited Tender">Limited Tender</option>
                          <option value="Single Tender">Single Tender</option>
                          <option value="GeM Procurement">GeM Procurement</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Procurement Mode</label>
                        <select
                          value={editForm.procurement_mode || ''}
                          onChange={(e) => setEditForm({ ...editForm, procurement_mode: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]"
                        >
                          <option value="e-Tender">e-Tender</option>
                          <option value="GeM Portal">GeM Portal</option>
                          <option value="Manual">Manual</option>
                        </select>
                      </div>
                      <div className="space-y-2 leading-tight">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Float Date</label>
                        <input
                          type="date"
                          value={editForm.tender_float_date?.split('T')[0] || ''}
                          onChange={(e) => setEditForm({ ...editForm, tender_float_date: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]"
                        />
                      </div>

                      <div className="space-y-4 md:col-span-2 p-6 bg-slate-50 border border-slate-200 rounded-2xl">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                          <div className="space-y-2 flex-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                              Estimated Cost (Rs.)
                              <span className="text-[10px] text-[var(--teal)] font-medium normal-case flex items-center gap-1">
                                <Info size={10} />
                                {editForm.gst_inclusive ? 'Inclusive of GST' : 'Exclusive of GST'}
                              </span>
                            </label>
                            <input
                              type="number"
                              value={editForm.estimated_cost || ''}
                              onChange={(e) => setEditForm({ ...editForm, estimated_cost: Number(e.target.value) })}
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-[var(--teal)] shadow-sm"
                            />
                            {editForm.estimated_cost > 0 && (
                              <p className="text-[11px] font-bold text-[var(--teal)] px-1">
                                {fmtCurrency(editForm.estimated_cost)}
                              </p>
                            )}
                          </div>
                          
                          <div className="space-y-3 min-w-[240px]">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block">GST Toggle</label>
                            <div className="flex items-center gap-4 bg-white p-1.5 rounded-xl border border-slate-100 shadow-sm">
                              <button
                                type="button"
                                onClick={() => setEditForm({ ...editForm, gst_inclusive: false })}
                                className={cn(
                                  "flex-1 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                                  !editForm.gst_inclusive ? "bg-slate-100 text-slate-700 shadow-inner" : "text-slate-400 hover:text-slate-600"
                                )}
                              >
                                Exclusive
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditForm({ ...editForm, gst_inclusive: true })}
                                className={cn(
                                  "flex-1 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                                  editForm.gst_inclusive ? "bg-amber-100 text-amber-700 shadow-inner" : "text-slate-400 hover:text-slate-600"
                                )}
                              >
                                Inclusive
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Pre-Bid Date & Time</label>
                        <div className="flex gap-2">
                          <input 
                            type="date" 
                            value={editForm.pre_bid_date?.split('T')[0] || ''}
                            onChange={(e) => setEditForm({...editForm, pre_bid_date: e.target.value})}
                            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]" 
                          />
                          <input 
                            type="time" 
                            value={editForm.pre_bid_time || ''}
                            onChange={(e) => setEditForm({...editForm, pre_bid_time: e.target.value})}
                            className="w-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]" 
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Bid End Date & Time</label>
                        <div className="flex gap-2">
                          <input 
                            type="date" 
                            value={editForm.bid_submission_deadline?.split('T')[0] || ''}
                            onChange={(e) => setEditForm({...editForm, bid_submission_deadline: e.target.value})}
                            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]" 
                          />
                          <input 
                            type="time" 
                            value={editForm.bid_end_time || ''}
                            onChange={(e) => setEditForm({...editForm, bid_end_time: e.target.value})}
                            className="w-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]" 
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Bid Opening Date & Time</label>
                        <div className="flex gap-2">
                          <input 
                            type="date" 
                            value={editForm.bid_opening_date?.split('T')[0] || ''}
                            onChange={(e) => setEditForm({...editForm, bid_opening_date: e.target.value})}
                            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]" 
                          />
                          <input 
                            type="time" 
                            value={editForm.bid_opening_time || ''}
                            onChange={(e) => setEditForm({...editForm, bid_opening_time: e.target.value})}
                            className="w-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]" 
                          />
                        </div>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="space-y-4">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">1. Official Tender Document (NIT)</h4>
                            {uploading === 'tender_document' ? (
                              <div className="flex flex-col items-center justify-center p-6 bg-white border-2 border-dashed border-teal-100 rounded-xl">
                                <Loader2 size={24} className="text-[var(--teal)] animate-spin mb-2" />
                                <span className="text-xs font-bold text-teal-600">Uploading NIT...</span>
                              </div>
                            ) : !editForm.tender_document ? (
                              <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-200 rounded-xl hover:border-[var(--teal)] hover:bg-teal-50/30 transition-all cursor-pointer group">
                                <Upload size={24} className="text-slate-300 group-hover:text-[var(--teal)]" />
                                <span className="text-xs font-bold text-slate-400 group-hover:text-[var(--teal)]">
                                  Click to upload NIT Document
                                </span>
                                <span className="text-[10px] text-slate-300">
                                  PDF, DOCX, JPG (Max 10MB)
                                </span>
                                <input type="file" className="hidden" 
                                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'tender_document', 'nit')}
                                />
                              </label>
                            ) : (
                              <div className="flex items-center justify-between p-4 bg-teal-50 border border-teal-200 rounded-xl">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center text-teal-600">
                                    <FileText size={20} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-teal-700">✓ Document Uploaded</p>
                                    <a href={editForm.tender_document} target="_blank" rel="noreferrer" className="text-[10px] text-teal-500 hover:underline font-medium">
                                      View Document →
                                    </a>
                                  </div>
                                </div>
                                <label className="cursor-pointer text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors">
                                  Replace
                                  <input type="file" className="hidden"
                                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'tender_document', 'nit')}
                                  />
                                </label>
                              </div>
                            )}
                         </div>

                         <div className="space-y-4">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">2. GeM Bid Document</h4>
                            {uploading === 'gem_bid_document' ? (
                              <div className="flex flex-col items-center justify-center p-6 bg-white border-2 border-dashed border-teal-100 rounded-xl">
                                <Loader2 size={24} className="text-[var(--teal)] animate-spin mb-2" />
                                <span className="text-xs font-bold text-teal-600">Uploading GeM Bid...</span>
                              </div>
                            ) : !editForm.gem_bid_document ? (
                              <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-200 rounded-xl hover:border-[var(--teal)] hover:bg-teal-50/30 transition-all cursor-pointer group">
                                <Upload size={24} className="text-slate-300 group-hover:text-[var(--teal)]" />
                                <span className="text-xs font-bold text-slate-400 group-hover:text-[var(--teal)]">
                                  Click to upload GeM Bid Document
                                </span>
                                <span className="text-[10px] text-slate-300">
                                  PDF, DOCX, JPG (Max 10MB)
                                </span>
                                <input type="file" className="hidden" 
                                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'gem_bid_document', 'gem_bid')}
                                />
                              </label>
                            ) : (
                              <div className="flex items-center justify-between p-4 bg-teal-50 border border-teal-200 rounded-xl">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center text-teal-600">
                                    <FileText size={20} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-teal-700">✓ Document Uploaded</p>
                                    <a href={editForm.gem_bid_document} target="_blank" rel="noreferrer" className="text-[10px] text-teal-500 hover:underline font-medium">
                                      View Document →
                                    </a>
                                  </div>
                                </div>
                                <label className="cursor-pointer text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors">
                                  Replace
                                  <input type="file" className="hidden"
                                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'gem_bid_document', 'gem_bid')}
                                  />
                                </label>
                              </div>
                            )}
                         </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. BIDS RECEIVED TAB */}
                {activeTab === 1 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 pb-8 border-b border-slate-100">
                       <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Opening Date</label>
                        <input
                          type="date"
                          value={editForm.bid_opening_date?.split('T')[0] || ''}
                          onChange={(e) => setEditForm({ ...editForm, bid_opening_date: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">No. of Bids Received</label>
                        <input
                          type="number"
                          value={editForm.no_of_bids_received || 0}
                          onChange={(e) => setEditForm({ ...editForm, no_of_bids_received: Number(e.target.value) })}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700"
                        />
                      </div>
                    </div>

                    <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100">
                      <h4 className="flex items-center gap-3 text-sm font-bold text-[var(--navy)] mb-6 border-b border-slate-200 pb-3">
                        <Users size={18} className="text-[var(--teal)]" />
                        Participating Bidders
                      </h4>
                      
                      {/* Bidder Addition Form */}
                      <div className="space-y-3 mb-6">
                        <form onSubmit={handleAddBidder} className="flex gap-4">
                          <input
                            type="text"
                            placeholder="Bidder Agency Name..."
                            value={newBidder.bidder_name}
                            onChange={(e) => setNewBidder({ ...newBidder, bidder_name: e.target.value })}
                            className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]"
                          />
                          <select
                            value={newBidder.emd_status}
                            onChange={(e) => setNewBidder({ ...newBidder, emd_status: e.target.value })}
                            className="w-40 px-3 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none"
                          >
                            <option value="Submitted">EMD Submitted</option>
                            <option value="Exempted">Exempted</option>
                            <option value="Pending">Pending</option>
                          </select>
                          <button 
                            type="submit" 
                            disabled={editForm.no_of_bids_received > 0 && bidders.length >= editForm.no_of_bids_received}
                            className="p-3 bg-[var(--teal)] text-white rounded-xl hover:bg-teal-700 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Plus size={20} />
                          </button>
                        </form>
                        <div className="flex items-center justify-between px-2">
                          <span className={cn(
                            "text-[10px] font-bold flex items-center gap-1.5",
                            editForm.no_of_bids_received > 0 && bidders.length >= editForm.no_of_bids_received ? "text-rose-500" : "text-slate-400"
                          )}>
                            <Users size={12} />
                            Added: {bidders.length} of {editForm.no_of_bids_received || '∞'}
                            {editForm.no_of_bids_received > 0 && bidders.length >= editForm.no_of_bids_received && " (Limit reached)"}
                          </span>
                        </div>
                      </div>

                      {/* Bidders Table */}
                      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-[0.1em] border-b border-slate-100">
                              <th className="px-5 py-4 w-16">Sr</th>
                              <th className="px-5 py-4">Bidder Name</th>
                              <th className="px-5 py-4">EMD Status</th>
                              <th className="px-5 py-4 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {bidders.map((bidder, idx) => (
                              <tr key={bidder.bidder_id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-5 py-4 font-bold text-slate-400">{idx + 1}</td>
                                <td className="px-5 py-4 font-bold text-slate-700">{bidder.bidder_name}</td>
                                <td className="px-5 py-4">
                                  <span className={cn(
                                    "px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest",
                                    bidder.emd_status === 'Submitted' ? "bg-emerald-50 text-emerald-600" :
                                    bidder.emd_status === 'Exempted' ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                                  )}>
                                    {bidder.emd_status}
                                  </span>
                                </td>
                                <td className="px-5 py-4 text-center">
                                  <button
                                    onClick={() => deleteBidder(bidder.bidder_id)}
                                    className="p-2 lg:opacity-0 group-hover:opacity-100 transition-all text-slate-300 hover:text-rose-600"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {bidders.length === 0 && (
                              <tr>
                                <td colSpan={4} className="px-5 py-12 text-center">
                                  <div className="flex flex-col items-center gap-2">
                                    <Users size={32} className="text-slate-200" />
                                    <p className="text-slate-400 font-medium italic">No bidders added yet</p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. TECHNICAL EVALUATION TAB */}
                {activeTab === 2 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 pb-8 border-b border-slate-100">
                      <div className="md:col-span-2">
                        <h4 className="flex items-center gap-2 text-[10px] font-bold text-[var(--teal)] uppercase tracking-widest mb-4">
                          3A — TC for Shortfall Documents
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Shortfall TC Applicable</label>
                            <select
                              value={editForm.shortfall_tc_applicable || 'No'}
                              onChange={(e) => setEditForm({ ...editForm, shortfall_tc_applicable: e.target.value })}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]"
                            >
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </div>
                          {editForm.shortfall_tc_applicable === 'Yes' ? (
                            <>
                              <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">TC Held Date</label>
                                <input
                                  type="date"
                                  value={editForm.shortfall_tc_date?.split('T')[0] || ''}
                                  onChange={(e) => setEditForm({ ...editForm, shortfall_tc_date: e.target.value })}
                                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">TC Approval Date</label>
                                <input
                                  type="date"
                                  value={editForm.shortfall_tc_approval_date?.split('T')[0] || ''}
                                  onChange={(e) => setEditForm({ ...editForm, shortfall_tc_approval_date: e.target.value })}
                                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]"
                                />
                              </div>
                            </>
                          ) : (
                            <div className="md:col-span-2 flex items-center px-6 bg-slate-100 rounded-xl border border-slate-200 text-slate-400 italic text-[11px]">
                              No shortfall TC applicable for this tender
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="md:col-span-2 pt-4">
                        <h4 className="flex items-center gap-2 text-[10px] font-bold text-[var(--teal)] uppercase tracking-widest mb-4">
                          3B — TC for Price Bid Opening
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">TC Held Date</label>
                            <input
                              type="date"
                              value={editForm.price_bid_tc_date?.split('T')[0] || ''}
                              onChange={(e) => setEditForm({ ...editForm, price_bid_tc_date: e.target.value })}
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">TC Approval Date</label>
                            <input
                              type="date"
                              value={editForm.price_bid_tc_approval_date?.split('T')[0] || ''}
                              onChange={(e) => setEditForm({ ...editForm, price_bid_tc_approval_date: e.target.value })}
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="flex items-center gap-3 text-sm font-bold text-[var(--navy)]">
                          <CircleDashed size={18} className="text-[var(--teal)]" />
                          3C — Technical Qualification of Bidders
                        </h4>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                            <span className="text-[10px] font-bold text-emerald-600 uppercase">Qualified</span>
                            <span className="text-sm font-black text-emerald-700">{bidders.filter(b => b.technical_status === 'Qualified').length}</span>
                          </div>
                          <div className="flex items-center gap-2 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100">
                            <span className="text-[10px] font-bold text-rose-600 uppercase">Disqualified</span>
                            <span className="text-sm font-black text-rose-700">{bidders.filter(b => b.technical_status === 'Disqualified').length}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        {bidders.map((bidder) => (
                          <div key={bidder.bidder_id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-[var(--teal)] transition-all">
                            <div className="flex-1">
                              <p className="text-sm font-bold text-slate-700">{bidder.bidder_name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={cn(
                                  "text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded",
                                  bidder.technical_status === 'Qualified' ? "bg-emerald-50 text-emerald-600" :
                                  bidder.technical_status === 'Disqualified' ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-400"
                                )}>
                                  {bidder.technical_status || 'NOT EVALUATED'}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <div className="flex bg-slate-100 p-1 rounded-lg">
                                <button
                                  onClick={() => updateBidderStatus(bidder.bidder_id, 'Qualified', '')}
                                  className={cn(
                                    "px-4 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all",
                                    bidder.technical_status === 'Qualified' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                  )}
                                >
                                  Qualified
                                </button>
                                <button
                                  onClick={() => updateBidderStatus(bidder.bidder_id, 'Disqualified', bidder.disqualification_reason || '')}
                                  className={cn(
                                    "px-4 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all",
                                    bidder.technical_status === 'Disqualified' ? "bg-white text-rose-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                  )}
                                >
                                  Disqualified
                                </button>
                              </div>
                              
                              {bidder.technical_status === 'Disqualified' && (
                                <input
                                  type="text"
                                  placeholder="Reason..."
                                  value={editingReason?.id === bidder.bidder_id ? editingReason.value : bidder.disqualification_reason || ''}
                                  onChange={(e) => setEditingReason({ id: bidder.bidder_id, value: e.target.value })}
                                  onBlur={() => {
                                    if (editingReason?.id === bidder.bidder_id) {
                                      setBidders(prev => prev.map(b => 
                                        b.bidder_id === bidder.bidder_id 
                                          ? {...b, disqualification_reason: editingReason.value} 
                                          : b
                                      ));
                                      setEditingReason(null);
                                    }
                                  }}
                                  className="w-40 px-3 py-1.5 border border-rose-100 rounded-lg text-[11px] outline-none focus:border-rose-400 transition-all shadow-sm"
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. PRICE BIDS TAB */}
                {activeTab === 3 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 pb-8 border-b border-slate-100">
                       <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Price Bid Opening Date</label>
                        <input
                          type="date"
                          value={editForm.price_bid_opening_date?.split('T')[0] || ''}
                          onChange={(e) => setEditForm({ ...editForm, price_bid_opening_date: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]"
                        />
                      </div>
                       <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">No. of Price Bids Opened</label>
                        <input
                          type="number"
                          value={editForm.tc_qualified_count || 0}
                          readOnly
                          className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                       <div className="bg-slate-50 py-4 px-6 border-b border-slate-100">
                          <h4 className="flex items-center gap-3 text-sm font-bold [var(--navy)]">
                            <Hash size={18} className="text-[var(--teal)]" />
                            Financial Ranking Table
                          </h4>
                       </div>
                       <div className="p-0">
                          <table className="w-full text-left text-xs">
                             <thead>
                                <tr className="text-slate-400 font-bold uppercase tracking-[0.1em] border-b border-slate-50">
                                   <th className="px-6 py-4">Bidder Name</th>
                                   <th className="px-6 py-4">Qualification</th>
                                   <th className="px-6 py-4">Bid Amount (Rs)</th>
                                   <th className="px-6 py-4 text-center">Estimate %</th>
                                   <th className="px-6 py-4 text-center">Rank</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-50">
                                {bidders.map((bidder) => {
                                  const isQualified = bidder.technical_status === 'Qualified';
                                  return (
                                    <tr key={bidder.bidder_id} className={cn(!isQualified && "opacity-50 bg-slate-50/50")}>
                                      <td className="px-6 py-4">
                                        <div className="font-bold text-slate-700">{bidder.bidder_name}</div>
                                      </td>
                                      <td className="px-6 py-4">
                                        <span className={cn(
                                          "px-2 py-0.5 rounded text-[9px] font-black uppercase inline-flex items-center gap-1",
                                          isQualified ? "text-emerald-500 bg-emerald-50" : "text-rose-400 bg-rose-50"
                                        )}>
                                          {isQualified ? <Check size={10} /> : <X size={10} />}
                                          {isQualified ? 'QUALIFIED' : 'REJECTED'}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4">
                                        {isQualified ? (
                                          <input
                                            type="number"
                                            value={bidder.bid_amount || ''}
                                            placeholder="0.00"
                                            onChange={(e) => {
                                              const amt = Number(e.target.value);
                                              const est = editForm.estimated_cost || 0;
                                              
                                              // 1. Update this bidder's amount
                                              const updatedBidders = bidders.map(b => 
                                                b.bidder_id === bidder.bidder_id ? { ...b, bid_amount: amt } : b
                                              );

                                              // 2. Recalculate all ranks live
                                              const qualified = updatedBidders.filter(b => b.technical_status === 'Qualified');
                                              const priced = [...qualified]
                                                .filter(b => (b.bid_amount || 0) > 0)
                                                .sort((a, b) => (a.bid_amount || 0) - (b.bid_amount || 0));

                                              const finalBidders = updatedBidders.map(b => {
                                                if (b.technical_status === 'Qualified' && (b.bid_amount || 0) > 0) {
                                                  const idx = priced.findIndex(s => s.bidder_id === b.bidder_id);
                                                  const rank = idx >= 0 ? `L${idx + 1}` : null;
                                                  
                                                  const diff = est > 0 ? (((b.bid_amount || 0) - est) / est) * 100 : 0;
                                                  const pct = `${diff > 0 ? '+' : ''}${diff.toFixed(2)}%`;
                                                  
                                                  return { ...b, financial_rank: rank, percentage_vs_estimate: pct };
                                                }
                                                return { ...b, financial_rank: null, percentage_vs_estimate: null };
                                              });

                                              setBidders(finalBidders);
                                              
                                              // 3. Update L1 summary in form state if we have a top bidder
                                              if (priced.length > 0) {
                                                const l1 = priced[0];
                                                const l1_diff = est > 0 ? (((l1.bid_amount || 0) - est) / est) * 100 : 0;
                                                setEditForm(prev => ({
                                                  ...prev,
                                                  l1_bidder_name: l1.bidder_name,
                                                  l1_amount: l1.bid_amount,
                                                  l1_percentage: `${l1_diff > 0 ? '+' : ''}${l1_diff.toFixed(2)}%`
                                                }));
                                              }
                                            }}
                                            className="w-40 px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold bg-white focus:border-[var(--teal)] outline-none transition-all shadow-sm"
                                          />
                                        ) : (
                                          <span className="text-slate-400 font-medium italic">N/A</span>
                                        )}
                                      </td>
                                      <td className="px-6 py-4 text-center">
                                        {isQualified && bidder.bid_amount ? (
                                          <span className={cn(
                                            "font-bold text-[11px]",
                                            (bidder.percentage_vs_estimate || '').startsWith('-') ? "text-teal-600" : "text-rose-600"
                                          )}>
                                            {bidder.percentage_vs_estimate}
                                          </span>
                                        ) : '—'}
                                      </td>
                                      <td className="px-6 py-4 text-center">
                                         {isQualified && bidder.financial_rank ? (
                                           <span className={cn(
                                             "inline-flex w-8 h-8 items-center justify-center rounded-full font-black text-[10px] shadow-sm transition-all",
                                             bidder.financial_rank === 'L1' ? "bg-[var(--teal)] text-white scale-110" : "bg-slate-100 text-slate-500"
                                           )}>
                                             {bidder.financial_rank}
                                           </span>
                                         ) : <span className="text-slate-300">—</span>}
                                      </td>
                                    </tr>
                                  );
                                })}
                             </tbody>
                          </table>
                       </div>
                    </div>

                    {/* L1 SUMMARY CARD */}
                    {bidders.some(b => b.financial_rank === 'L1') && (
                      <div className="bg-teal-50 border border-teal-100 rounded-2xl p-6 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between mb-4">
                           <h4 className="flex items-center gap-2 text-sm font-bold text-teal-800 uppercase tracking-wider">
                             <Trophy size={18} className="text-amber-500" />
                             Financial Standing Summary (L1)
                           </h4>
                           <span className="px-3 py-1 bg-white border border-teal-200 rounded-full text-[10px] font-black text-teal-600 uppercase tracking-widest shadow-sm">
                             Rankings Calculated
                           </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           <div className="bg-white p-4 rounded-xl shadow-sm border border-teal-100/50">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Lowest Bidder (L1)</label>
                              <div className="text-sm font-black text-slate-800 truncate">
                                {bidders.find(b => b.financial_rank === 'L1')?.bidder_name}
                              </div>
                           </div>
                           <div className="bg-white p-4 rounded-xl shadow-sm border border-teal-100/50">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Bid Amount</label>
                              <div className="text-sm font-black text-teal-600">
                                {fmtCurrency(bidders.find(b => b.financial_rank === 'L1')?.bid_amount || 0)}
                              </div>
                           </div>
                           <div className="bg-white p-4 rounded-xl shadow-sm border border-teal-100/50">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Vs Estimate %</label>
                              <div className={cn(
                                "text-sm font-black",
                                (bidders.find(b => b.financial_rank === 'L1')?.percentage_vs_estimate || '').startsWith('-') ? "text-teal-600" : "text-rose-600"
                              )}>
                                {bidders.find(b => b.financial_rank === 'L1')?.percentage_vs_estimate || '0.00%'}
                              </div>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. AWARD TAB */}
                {activeTab === 4 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-8">
                      <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200">
                        <h4 className="flex items-center gap-2 text-[10px] font-bold text-[var(--teal)] uppercase tracking-widest mb-6">
                          5A — TC for Award Recommendation
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">TC Held Date</label>
                            <input
                              type="date"
                              value={editForm.award_tc_date?.split('T')[0] || ''}
                              onChange={(e) => setEditForm({ ...editForm, award_tc_date: e.target.value })}
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]"
                            />
                          </div>
                           <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">TC Approval by CA Date</label>
                            <input
                              type="date"
                              value={editForm.award_tc_approval_date?.split('T')[0] || ''}
                              onChange={(e) => setEditForm({ ...editForm, award_tc_approval_date: e.target.value })}
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Negotiated Amount</label>
                            <input
                              type="number"
                              value={editForm.negotiated_amount || ''}
                              onChange={(e) => setEditForm({ ...editForm, negotiated_amount: Number(e.target.value) })}
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]"
                            />
                            <p className="text-[9px] text-slate-400 italic">Leave blank if L1 rate accepted as is</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="md:col-span-2">
                          <h4 className="flex items-center gap-2 text-[10px] font-bold text-[var(--teal)] uppercase tracking-widest mb-2">
                            5B — Award Decision
                          </h4>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Award Status</label>
                          <select
                            value={editForm.award_status || ''}
                            onChange={(e) => setEditForm({ ...editForm, award_status: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[var(--teal)]"
                          >
                            <option value="">Select Status</option>
                            <option value="Approved">Approved / Awarded</option>
                            <option value="Cancelled">Tender Cancelled</option>
                            <option value="Rejected">Rejected</option>
                          </select>
                        </div>

                        <div className="p-8 bg-teal-50 border border-teal-100 rounded-2xl md:col-span-2 flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="flex items-center gap-3 text-sm font-bold text-teal-800 mb-2">
                              <Award size={20} className="text-teal-600" />
                              Award Information Summary
                            </h4>
                            {editForm.l1_bidder_name ? (
                              <div className="space-y-1">
                                <p className="text-xs text-teal-600 font-medium tracking-tight">System determined L1 bidder based on Price Bids Tab.</p>
                                <div className="flex items-baseline gap-2 mt-4">
                                  <span className="text-sm font-black text-teal-700">{editForm.l1_bidder_name}</span>
                                  <span className="text-xs font-bold text-teal-500">at {fmtCurrency(editForm.l1_amount || 0)}</span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic">No price bids entered yet. System cannot determine L1.</p>
                            )}
                          </div>
                          {editForm.award_status === 'Approved' && editForm.l1_bidder_name && (
                            <div className="flex flex-col gap-2">
                              <button 
                                onClick={() => setShowAwardConfirm(editForm as TenderRecord)}
                                className="px-6 py-3 bg-[var(--teal)] text-white text-[11px] font-bold uppercase tracking-widest rounded-xl hover:bg-teal-700 shadow-lg shadow-teal-200 transition-all flex items-center gap-2"
                              >
                                Confirm Award Move
                                <ArrowRightCircle size={14} />
                              </button>
                              <p className="text-[9px] text-teal-500 font-bold uppercase text-center">Moves to Awarded Module</p>
                            </div>
                          )}
                        </div>

                        <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl md:col-span-2">
                          <h4 className="text-[10px] font-bold text-[var(--teal)] uppercase tracking-widest mb-6">5C — GeM Contract Order</h4>
                          <div className="space-y-6">
                            {uploading === 'gem_contract_order' ? (
                              <div className="flex flex-col items-center justify-center p-8 bg-white border-2 border-dashed border-teal-100 rounded-xl">
                                <Loader2 size={24} className="text-[var(--teal)] animate-spin mb-2" />
                                <span className="text-sm font-bold text-teal-600">Uploading GeM Contract...</span>
                              </div>
                            ) : !editForm.gem_contract_order ? (
                              <label className="flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-slate-200 rounded-xl hover:border-[var(--teal)] hover:bg-teal-50/30 transition-all cursor-pointer group">
                                <Upload size={32} className="text-slate-300 group-hover:text-[var(--teal)]" />
                                <span className="text-sm font-bold text-slate-400 group-hover:text-[var(--teal)]">
                                  Click to upload GeM Contract Order
                                </span>
                                <span className="text-xs text-slate-300">
                                  PDF, DOCX, JPG (Max 10MB)
                                </span>
                                <input type="file" className="hidden" 
                                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'gem_contract_order', 'gem_contract')}
                                />
                              </label>
                            ) : (
                              <div className="flex items-center justify-between p-5 bg-teal-50 border border-teal-200 rounded-xl">
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center text-teal-600 shadow-sm">
                                    <FileText size={24} />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-teal-700">✓ Contract Uploaded</p>
                                    <a href={editForm.gem_contract_order} target="_blank" rel="noreferrer" className="text-xs text-teal-500 hover:underline font-medium">
                                      View GeM Contract Order →
                                    </a>
                                  </div>
                                </div>
                                <label className="cursor-pointer px-4 py-2 bg-white border border-teal-200 rounded-lg text-xs font-bold text-teal-600 hover:bg-teal-100 transition-colors shadow-sm">
                                  Replace
                                  <input type="file" className="hidden"
                                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'gem_contract_order', 'gem_contract')}
                                  />
                                </label>
                              </div>
                            )}

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                               <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">GeM Contract Date</label>
                                  <input 
                                    type="date"
                                    value={editForm.gem_contract_date?.split('T')[0] || ''}
                                    onChange={(e) => setEditForm({...editForm, gem_contract_date: e.target.value})}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] shadow-sm"
                                  />
                               </div>
                             </div>
                          </div>
                        </div>

                        {editForm.award_status === 'Cancelled' && (
                          <div className="md:col-span-2 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                             <label className="text-[11px] font-bold text-rose-600 uppercase tracking-widest">Reason for Cancellation</label>
                             <textarea
                               value={editForm.cancellation_reason || ''}
                               onChange={(e) => setEditForm({ ...editForm, cancellation_reason: e.target.value })}
                               className="w-full h-20 px-4 py-3 bg-rose-50 border border-rose-100 rounded-xl text-sm focus:border-rose-300 outline-none"
                               placeholder="Provide reason for cancellation..."
                             />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="flex -space-x-2">
                  <div className={cn("w-3 h-3 rounded-full border-2 border-white", activeTab >= 0 ? "bg-[var(--teal)]" : "bg-slate-300")}></div>
                  <div className={cn("w-3 h-3 rounded-full border-2 border-white", activeTab >= 1 ? "bg-[var(--teal)]" : "bg-slate-300")}></div>
                  <div className={cn("w-3 h-3 rounded-full border-2 border-white", activeTab >= 2 ? "bg-[var(--teal)]" : "bg-slate-300")}></div>
                  <div className={cn("w-3 h-3 rounded-full border-2 border-white", activeTab >= 3 ? "bg-[var(--teal)]" : "bg-slate-300")}></div>
                  <div className={cn("w-3 h-3 rounded-full border-2 border-white", activeTab >= 4 ? "bg-[var(--teal)]" : "bg-slate-300")}></div>
                </div>
                <span className="text-[10px] font-bold text-slate-400">TAB {activeTab + 1} OF 5</span>
              </div>
              <div className="flex gap-4">
                {activeTab > 0 && (
                  <button onClick={() => setActiveTab(activeTab - 1)} className="px-5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-all uppercase tracking-widest">
                    Previous
                  </button>
                )}
                {activeTab < 4 ? (
                  <button 
                    onClick={() => {
                       handleTabSave();
                       setActiveTab(activeTab + 1);
                    }}
                    disabled={saving}
                    className="px-6 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-black transition-all uppercase tracking-widest"
                  >
                    Save & Next
                  </button>
                ) : (
                  <button 
                    onClick={() => setShowEditModal(null)}
                    className="px-6 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-all uppercase tracking-widest shadow-lg shadow-emerald-100"
                  >
                    Finish
                  </button>
                )}
              </div>
            </div>
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
