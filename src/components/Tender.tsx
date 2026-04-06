import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Pencil, Users, 
  FileText, Upload, CheckCircle2, 
  X, Loader2, ExternalLink, ArrowRight,
  TrendingDown, TrendingUp, AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { TenderRecord, BidderRecord, User } from '../types';
import { format } from 'date-fns';
import { api } from '../services/api';
import ErrorMessage from './ErrorMessage';

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
  }, []);

  const fetchData = () => {
    setLoading(true);
    api.getTenderRecords()
      .then(setRecords)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  const handleEditTender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;
    setSubmitting(true);
    try {
      // If status is changed to Awarded manually, trigger the award logic
      if (showEditModal.current_stage === 'Awarded') {
        const db = await api.getTenderRecords();
        const originalTender = db.find(t => t.tender_id === showEditModal.tender_id);
        if (originalTender && originalTender.current_stage !== 'Awarded') {
          // Check if it has an L1 bidder, if not, we might need to warn or handle it
          if (!showEditModal.l1_bidder_name) {
            throw new Error("Cannot move to Awarded without an L1 Bidder. Please use the 'Award' button in the table actions to properly award the tender.");
          }
          await api.moveToAwarded(showEditModal, currentUser!);
        } else {
          await api.updateTenderRecord(showEditModal.tender_id, showEditModal);
        }
      } else {
        await api.updateTenderRecord(showEditModal.tender_id, showEditModal);
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
          <table className="w-full border-collapse min-w-[1400px]">
            <thead>
              <tr className="bg-[var(--paper)]">
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Tender Details</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Estimated Cost</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">L1 Bidder / Amount</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Diff %</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Current Stage</th>
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider", STAGE_BADGES[r.current_stage] || 'bg-slate-100')}>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b pb-1">General Information</h4>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Name of Work</label>
                    <textarea 
                      value={showEditModal.name_of_work || ''}
                      onChange={(e) => setShowEditModal({...showEditModal, name_of_work: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-[var(--teal)] outline-none min-h-[80px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tender Type</label>
                      <select 
                        value={showEditModal.tender_type || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, tender_type: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]"
                      >
                        <option>Open Tender</option>
                        <option>Limited Tender</option>
                        <option>Single Tender</option>
                        <option>GeM Procurement</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Current Stage</label>
                      <select 
                        value={showEditModal.current_stage || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, current_stage: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]"
                      >
                        {Object.keys(STAGE_BADGES).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Award Approval Status</label>
                      <select 
                        value={showEditModal.award_status || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, award_status: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]"
                      >
                        <option value="">Pending</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Financials & Dates */}
                <div className="space-y-4">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b pb-1">Financials & Timeline</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Estimated Cost</label>
                      <input 
                        type="number"
                        value={showEditModal.estimated_cost || 0}
                        onChange={(e) => setShowEditModal({...showEditModal, estimated_cost: Number(e.target.value)})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">EMD Amount</label>
                      <input 
                        type="number"
                        value={showEditModal.emd_amount || 0}
                        onChange={(e) => setShowEditModal({...showEditModal, emd_amount: Number(e.target.value)})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Float Date</label>
                      <input 
                        type="date"
                        value={showEditModal.tender_float_date?.split('T')[0] || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, tender_float_date: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Submission Deadline</label>
                      <input 
                        type="date"
                        value={showEditModal.bid_submission_deadline?.split('T')[0] || ''}
                        onChange={(e) => setShowEditModal({...showEditModal, bid_submission_deadline: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)]"
                      />
                    </div>
                  </div>
                </div>

                {/* File Uploads */}
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
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
