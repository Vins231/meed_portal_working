import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, ShieldCheck, Calendar,
  IndianRupee, AlertTriangle, MoreVertical,
  CheckCircle2, Clock, X, Save, Edit, Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { BGRecord, AwardedRecord, User } from '../types';
import { format, differenceInDays } from 'date-fns';
import { api } from '../services/api';
import ErrorMessage from './ErrorMessage';

interface BGTrackerProps {
  user: User;
}

export default function BGTracker({ user }: BGTrackerProps) {
  const [records, setRecords] = useState<BGRecord[]>([]);
  const [awardedWorks, setAwardedWorks] = useState<AwardedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Partial<BGRecord> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [bgData, awardedData] = await Promise.all([
        api.getBGRecords(),
        api.getAwardedRecords()
      ]);
      setRecords(bgData);
      setAwardedWorks(awardedData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load BG records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (record: Partial<BGRecord> | null = null) => {
    setEditingRecord(record || {
      bg_number: '',
      bg_amount: 0,
      expiry_date: '',
      bg_status: 'Active',
      bank_name: '',
      contractor_name: '',
      name_of_work: '',
      remarks: ''
    });
    setShowModal(true);
    window.dispatchEvent(new Event('modal-open'));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    setIsSubmitting(true);
    try {
      if (editingRecord.bg_id) {
        await api.updateBGRecord(editingRecord.bg_id, editingRecord);
      } else {
        await api.createBGRecord(editingRecord, user);
      }
      setShowModal(false);
      window.dispatchEvent(new Event('modal-close'));
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to save BG record");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExtend = (record: BGRecord) => {
    setEditingRecord({
      ...record,
      bg_status: 'Extended',
      remarks: record.remarks ? `${record.remarks}\nExtended on ${format(new Date(), 'dd/MM/yyyy')}` : `Extended on ${format(new Date(), 'dd/MM/yyyy')}`
    });
    setShowModal(true);
    window.dispatchEvent(new Event('modal-open'));
  };

  const handleRelease = async (record: BGRecord) => {
    if (!confirm(`Are you sure you want to release BG No. ${record.bg_number}?`)) return;
    try {
      await api.updateBGRecord(record.bg_id, { 
        bg_status: 'Released', 
        release_date: new Date().toISOString() 
      });
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to release BG");
    }
  };

  const handleWorkSelect = (workName: string) => {
    const work = awardedWorks.find(w => w.name_of_work === workName);
    if (work && editingRecord) {
      setEditingRecord({
        ...editingRecord,
        name_of_work: work.name_of_work,
        contractor_name: work.contractor_name,
        awarded_id: work.awarded_id
      });
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
      <div className="w-10 h-10 border-4 border-slate-100 border-t-[var(--teal)] rounded-full animate-spin" />
      <p className="text-xs font-bold uppercase tracking-widest">Loading BG Tracker...</p>
    </div>
  );
  if (error) return <ErrorMessage error={error} onRetry={fetchData} />;

  const fmtCurrency = (n: number) => {
    return '₹' + n.toLocaleString('en-IN');
  };

  const filteredRecords = records.filter(r => 
    (r.bg_number?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (r.contractor_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (r.name_of_work?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (r.bank_name?.toLowerCase() || '').includes(search.toLowerCase())
  );  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[16px] p-6 border border-[var(--border)] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
          <div className="flex-1">
            <h2 className="font-display text-lg font-bold text-[var(--navy)]">Bank Guarantee Tracker</h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">Monitor and manage bank guarantees and their validity</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input 
                type="text" 
                placeholder="Search BG..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 bg-[var(--paper)] border border-[var(--border)] rounded-[12px] text-[13px] outline-none focus:border-[var(--teal)] focus:bg-white transition-all w-full md:w-[200px] lg:w-[240px]"
              />
            </div>

            <button 
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--teal)] text-white rounded-[12px] text-[13px] font-semibold hover:bg-[var(--teal2)] transition-all shadow-sm"
            >
              <Plus size={16} />
              Add BG
            </button>
          </div>
        </div>

        {/* Expiry Alert */}
        {records.some(r => differenceInDays(new Date(r.expiry_date), new Date()) <= 7 && r.bg_status === 'Active') && (
          <div className="bg-[rgba(232,68,90,0.07)] border border-[rgba(232,68,90,0.15)] rounded-[12px] p-4 flex items-center gap-3 mb-6">
            <AlertTriangle size={18} className="text-[var(--rose)]" />
            <div className="flex-1">
              <strong className="text-[var(--rose)] text-[13px]">BG Expiry Alert</strong>
              <span className="text-[var(--rose2)] text-[13px] ml-2">
                {records.filter(r => differenceInDays(new Date(r.expiry_date), new Date()) <= 7 && r.bg_status === 'Active').length} BG expiring within 7 days. Action required.
              </span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto -mx-6">
          <table className="w-full border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-[var(--paper)]">
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">BG No.</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Work / Contractor</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Bank</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Amount</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Valid Upto</th>
                <th className="px-6 py-3 text-left text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Status</th>
                <th className="px-6 py-3 text-right text-[10.5px] font-bold text-[var(--muted2)] uppercase tracking-wider border-b border-[var(--border)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <ShieldCheck size={48} className="mb-2 opacity-20" />
                      <p className="text-sm font-medium italic">No Bank Guarantees found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const validDate = r.expiry_date ? new Date(r.expiry_date) : null;
                  const daysLeft = validDate ? differenceInDays(validDate, new Date()) : 0;
                  const daysColor = daysLeft <= 7 ? 'text-[var(--rose)]' : daysLeft <= 30 ? 'text-[var(--amber)]' : 'text-[var(--teal)]';
                  
                  return (
                    <tr key={r.bg_id} className="hover:bg-[var(--teal)]/[0.02] transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <strong className="text-[13px] text-[var(--navy)]">{r.bg_number}</strong>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[12px] font-bold text-[var(--navy)] line-clamp-1 max-w-[250px]">{r.name_of_work || 'N/A'}</div>
                        <div className="text-[10px] text-[var(--muted)] mt-0.5 uppercase font-semibold tracking-wider">{r.contractor_name || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-[12px] text-[var(--ink)]">
                        {r.bank_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-[13px] font-bold text-[var(--navy)]">{fmtCurrency(r.bg_amount || 0)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-[12px] font-semibold text-[var(--ink)]">{validDate ? format(validDate, 'dd MMM yyyy') : 'N/A'}</div>
                        <div className={cn("text-[11px] font-bold mt-0.5 flex items-center gap-1", daysColor)}>
                          <Clock size={10} />
                          {daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days left`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
                          r.bg_status === 'Active' ? "bg-green-50 text-green-700 border-green-100" : "bg-slate-50 text-slate-700 border-slate-100"
                        )}>
                          {r.bg_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => handleExtend(r)}
                            className="px-3 py-1.5 bg-white border border-[var(--border)] text-[var(--navy)] rounded-lg text-[11px] font-bold hover:border-[var(--teal)] hover:text-[var(--teal)] transition-all"
                          >
                            Extend
                          </button>
                          <div className="relative group/menu">
                            <button className="p-2 text-[var(--muted2)] hover:text-[var(--teal)] hover:bg-[var(--teal)]/10 rounded-lg transition-all">
                              <MoreVertical size={14} />
                            </button>
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-[var(--border)] rounded-xl shadow-xl py-1 z-50 hidden group-hover/menu:block animate-in fade-in zoom-in-95 duration-100">
                              <button 
                                onClick={() => handleOpenModal(r)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-[12px] text-[var(--navy)] hover:bg-slate-50 font-medium"
                              >
                                <Edit size={14} className="text-[var(--teal)]" />
                                Edit Details
                              </button>
                              <button 
                                onClick={() => handleRelease(r)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-[12px] text-[var(--navy)] hover:bg-slate-50 font-medium"
                              >
                                <CheckCircle2 size={14} className="text-emerald-500" />
                                Release BG
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit BG Modal */}
      {showModal && editingRecord && (
        <div className="fixed inset-0 bg-[var(--navy)]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] w-full max-w-lg shadow-2xl border border-white/20 overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-display text-xl font-bold text-[var(--navy)]">
                  {editingRecord.bg_id ? 'Update Bank Guarantee' : 'Add New Bank Guarantee'}
                </h3>
                <p className="text-xs text-[var(--muted)] mt-0.5">Enter the details of the bank guarantee document</p>
              </div>
              <button 
                onClick={() => {
                  setShowModal(false);
                  window.dispatchEvent(new Event('modal-close'));
                }}
                className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-[var(--rose)] transition-all shadow-sm hover:shadow-md"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[var(--muted2)] uppercase tracking-wider ml-1">BG Number</label>
                  <input 
                    required
                    type="text" 
                    value={editingRecord.bg_number || ''}
                    onChange={(e) => setEditingRecord({...editingRecord, bg_number: e.target.value})}
                    className="w-full px-4 py-2.5 bg-[var(--paper)] border border-[var(--border)] rounded-xl text-[13px] outline-none focus:border-[var(--teal)] focus:bg-white transition-all"
                    placeholder="e.g. BG/2024/001"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[var(--muted2)] uppercase tracking-wider ml-1">BG Amount (₹)</label>
                  <input 
                    required
                    type="number" 
                    value={editingRecord.bg_amount || ''}
                    onChange={(e) => setEditingRecord({...editingRecord, bg_amount: Number(e.target.value)})}
                    className="w-full px-4 py-2.5 bg-[var(--paper)] border border-[var(--border)] rounded-xl text-[13px] outline-none focus:border-[var(--teal)] focus:bg-white transition-all"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[var(--muted2)] uppercase tracking-wider ml-1">Select Awarded Work</label>
                <select 
                  required
                  value={editingRecord.name_of_work || ''}
                  onChange={(e) => handleWorkSelect(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--paper)] border border-[var(--border)] rounded-xl text-[13px] outline-none focus:border-[var(--teal)] focus:bg-white transition-all appearance-none"
                >
                  <option value="">-- Select Work --</option>
                  {awardedWorks.map(work => (
                    <option key={work.awarded_id} value={work.name_of_work}>{work.name_of_work}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[var(--muted2)] uppercase tracking-wider ml-1">Contractor Name</label>
                <input 
                  readOnly
                  type="text" 
                  value={editingRecord.contractor_name || ''}
                  className="w-full px-4 py-2.5 bg-slate-100 border border-[var(--border)] rounded-xl text-[13px] text-slate-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[var(--muted2)] uppercase tracking-wider ml-1">Bank Name</label>
                  <input 
                    required
                    type="text" 
                    value={editingRecord.bank_name || ''}
                    onChange={(e) => setEditingRecord({...editingRecord, bank_name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-[var(--paper)] border border-[var(--border)] rounded-xl text-[13px] outline-none focus:border-[var(--teal)] focus:bg-white transition-all"
                    placeholder="e.g. State Bank of India"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[var(--muted2)] uppercase tracking-wider ml-1">Valid Upto</label>
                  <input 
                    required
                    type="date" 
                    value={editingRecord.expiry_date ? editingRecord.expiry_date.split('T')[0] : ''}
                    onChange={(e) => setEditingRecord({...editingRecord, expiry_date: e.target.value})}
                    className="w-full px-4 py-2.5 bg-[var(--paper)] border border-[var(--border)] rounded-xl text-[13px] outline-none focus:border-[var(--teal)] focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[var(--muted2)] uppercase tracking-wider ml-1">Remarks</label>
                <textarea 
                  value={editingRecord.remarks || ''}
                  onChange={(e) => setEditingRecord({...editingRecord, remarks: e.target.value})}
                  className="w-full px-4 py-2.5 bg-[var(--paper)] border border-[var(--border)] rounded-xl text-[13px] outline-none focus:border-[var(--teal)] focus:bg-white transition-all h-20 resize-none"
                  placeholder="Any additional notes..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    window.dispatchEvent(new Event('modal-close'));
                  }}
                  className="px-6 py-2.5 text-[13px] font-bold text-slate-500 hover:text-[var(--navy)] transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-8 py-2.5 bg-[var(--teal)] text-white rounded-xl text-[13px] font-bold hover:bg-[var(--teal2)] transition-all shadow-lg shadow-[var(--teal)]/20 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {editingRecord.bg_id ? 'Update BG' : 'Save BG'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
