import React, { useState, useEffect } from 'react';
import { 
  UserPlus, Search, Shield, UserCheck, UserX, 
  Lock, Loader2, MoreVertical, X, CheckCircle2, 
  AlertCircle, Info, Mail, Phone, MapPin, Briefcase
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { User } from '../types';
import { api } from '../services/api';

interface AdminProps {
  user: User | null;
}

interface UserRecord {
  user_id: string;
  name: string;
  email: string;
  role: string;
  designation: string;
  division: string;
  section: string;
  intercom: string;
  mobile: string;
  status: string;
  streak: number;
  created_on: string;
  notes: string;
}

export default function Admin({ user: currentUser }: AdminProps) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Master data for dropdowns
  const [roles, setRoles] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);

  // New user form state
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: '',
    division: '',
    section: '',
    designation: '',
    mobile: '',
    intercom: '',
    notes: ''
  });

  useEffect(() => {
    if (currentUser?.role === 'Admin') {
      fetchData();
      fetchMasterData();
    }
  }, [currentUser]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_on', { ascending: false });
      
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMasterData = async () => {
    const [r, d, s, des] = await Promise.all([
      supabase.from('roles').select('*').order('name'),
      supabase.from('divisions').select('*').order('name'),
      supabase.from('sections').select('*').order('name'),
      supabase.from('designations').select('*').order('name')
    ]);
    
    if (r.data) setRoles(r.data);
    if (d.data) setDivisions(d.data);
    if (s.data) setSections(s.data);
    if (des.data) setDesignations(des.data);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.password || !newUser.role) {
      alert('Please fill all required fields');
      return;
    }
    if (newUser.password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    setSaving(true);
    try {
      // Check if email exists
      const { data: existing } = await supabase
        .from('users')
        .select('email')
        .eq('email', newUser.email)
        .single();
      
      if (existing) {
        alert('A user with this email already exists');
        setSaving(false);
        return;
      }

      const userId = 'USR-' + Date.now();
      const { error } = await supabase.from('users').insert({
        user_id: userId,
        ...newUser,
        status: 'Active',
        streak: 0,
        created_on: new Date().toISOString()
      });

      if (error) throw error;

      if (currentUser) {
        await api.logActivity(
          'CREATE',
          'ADMIN',
          userId,
          `New user ${newUser.name} created by ${currentUser.name}`,
          currentUser
        );
      }

      setShowAddModal(false);
      setNewUser({
        name: '', email: '', password: '', role: '',
        division: '', section: '', designation: '',
        mobile: '', intercom: '', notes: ''
      });
      fetchData();
    } catch (err) {
      console.error('Error adding user:', err);
      alert('Failed to add user');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (targetUser: UserRecord) => {
    const newStatus = targetUser.status === 'Active' ? 'Inactive' : 'Active';
    const actionLabel = newStatus === 'Active' ? 'Activate' : 'Deactivate';
    
    if (newStatus === 'Inactive') {
      if (!confirm(`Deactivate ${targetUser.name}? They will lose portal access immediately.`)) return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ status: newStatus })
        .eq('user_id', targetUser.user_id);
      
      if (error) throw error;

      if (currentUser) {
        await api.logActivity(
          'UPDATE',
          'ADMIN',
          targetUser.user_id,
          `User ${targetUser.name} status changed to ${newStatus} by ${currentUser.name}`,
          currentUser
        );
      }

      fetchData();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const filteredUsers = users.filter(u => {
    const s = search.toLowerCase();
    return u.name.toLowerCase().includes(s) ||
           u.email.toLowerCase().includes(s) ||
           u.role.toLowerCase().includes(s) ||
           u.division.toLowerCase().includes(s) ||
           u.section.toLowerCase().includes(s);
  });

  const stats = {
    total: users.length,
    active: users.filter(u => u.status === 'Active').length,
    inactive: users.filter(u => u.status === 'Inactive').length,
    admins: users.filter(u => u.role === 'Admin').length
  };

  if (currentUser?.role !== 'Admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-white p-10 rounded-[24px] border border-slate-200 shadow-xl max-w-md text-center space-y-6 animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto">
            <Lock size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-[var(--navy)]">Access Restricted</h2>
            <p className="text-slate-500 font-medium leading-relaxed">
              This section is only accessible to administrators. Please contact your department head for access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--navy)]">User Management</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Manage portal access, roles, and user profiles</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="px-6 py-2.5 bg-[var(--teal)] text-white rounded-xl font-bold text-sm hover:bg-[var(--teal2)] transition-all flex items-center gap-2 shadow-lg shadow-[var(--teal)]/20"
        >
          <UserPlus size={18} />
          Add New User
        </button>
      </div>

      {/* Stats Bar */}
      <div className="flex flex-wrap gap-3">
        <StatPill label="Total Users" value={stats.total} color="bg-slate-100 text-slate-700" />
        <StatPill label="Active" value={stats.active} color="bg-teal-50 text-teal-700" />
        <StatPill label="Inactive" value={stats.inactive} color="bg-rose-50 text-rose-700" />
        <StatPill label="Admins" value={stats.admins} color="bg-amber-50 text-amber-700" />
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-[16px] border border-[var(--border)] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name, email, role, division..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">User ID</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Name</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Email</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Role</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Division / Section</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Contact</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Status</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <Loader2 className="animate-spin mx-auto text-[var(--teal)]" size={32} />
                    <p className="text-sm text-slate-400 mt-4 font-bold uppercase tracking-widest">Loading users...</p>
                  </td>
                </tr>
              ) : filteredUsers.length > 0 ? filteredUsers.map((u, i) => (
                <tr key={u.user_id} className={cn(
                  "hover:bg-slate-50/50 transition-colors",
                  i % 2 === 1 ? "bg-slate-50/30" : "bg-white"
                )}>
                  <td className="px-6 py-4">
                    <code className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-mono text-slate-600 uppercase tracking-tighter">
                      {u.user_id}
                    </code>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[var(--navy)]">{u.name}</div>
                        <div className="text-[10px] font-medium text-slate-400">{u.designation}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider",
                      u.role === 'Admin' ? "bg-rose-100 text-rose-700 border-rose-200" :
                      u.role === 'Manager' ? "bg-sky-100 text-sky-700 border-sky-200" :
                      u.role === 'Engineer' ? "bg-teal-100 text-teal-700 border-teal-200" :
                      "bg-slate-100 text-slate-700 border-slate-200"
                    )}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs font-bold text-slate-700">{u.division}</div>
                    <div className="text-[10px] font-medium text-slate-400">{u.section}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs font-bold text-slate-700">{u.mobile}</div>
                    <div className="text-[10px] font-medium text-slate-400">Ext: {u.intercom}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize",
                      u.status === 'Active' ? "bg-green-50 text-green-700 border-green-100" : "bg-rose-50 text-rose-700 border-rose-100"
                    )}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {u.user_id !== currentUser?.user_id && (
                      <button 
                        onClick={() => toggleStatus(u)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-bold border transition-all",
                          u.status === 'Active' 
                            ? "border-rose-200 text-rose-600 hover:bg-rose-50" 
                            : "border-teal-200 text-teal-600 hover:bg-teal-50"
                        )}
                      >
                        {u.status === 'Active' ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-300">
                      <Info size={48} className="opacity-20" />
                      <p className="text-sm font-bold">No users found matching your search</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--navy)]/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--teal)] text-white rounded-xl">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-[var(--navy)]">Add New User</h2>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Create portal access credentials</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Full Name *</label>
                  <input 
                    required
                    type="text"
                    value={newUser.name}
                    onChange={e => setNewUser({...newUser, name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Email Address *</label>
                  <input 
                    required
                    type="email"
                    value={newUser.email}
                    onChange={e => setNewUser({...newUser, email: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
                    placeholder="john.doe@mumbaiport.gov.in"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Password * (min 6 chars)</label>
                  <input 
                    required
                    type="password"
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Role *</label>
                  <select 
                    required
                    value={newUser.role}
                    onChange={e => setNewUser({...newUser, role: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
                  >
                    <option value="">Select Role</option>
                    {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Division</label>
                  <select 
                    value={newUser.division}
                    onChange={e => setNewUser({...newUser, division: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
                  >
                    <option value="">Select Division</option>
                    {divisions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Section</label>
                  <select 
                    value={newUser.section}
                    onChange={e => setNewUser({...newUser, section: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
                  >
                    <option value="">Select Section</option>
                    {sections.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Designation</label>
                  <select 
                    value={newUser.designation}
                    onChange={e => setNewUser({...newUser, designation: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
                  >
                    <option value="">Select Designation</option>
                    {designations.map(des => <option key={des.id} value={des.name}>{des.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Mobile Number</label>
                  <input 
                    type="text"
                    value={newUser.mobile}
                    onChange={e => setNewUser({...newUser, mobile: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
                    placeholder="98XXXXXXXX"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Intercom</label>
                  <input 
                    type="text"
                    value={newUser.intercom}
                    onChange={e => setNewUser({...newUser, intercom: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all"
                    placeholder="XXXX"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Notes</label>
                <textarea 
                  value={newUser.notes}
                  onChange={e => setNewUser({...newUser, notes: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[var(--teal)] transition-all min-h-[80px]"
                  placeholder="Additional information..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="px-8 py-2.5 bg-[var(--teal)] text-white rounded-xl font-bold text-sm hover:bg-[var(--teal2)] transition-all flex items-center gap-2 shadow-lg shadow-[var(--teal)]/20 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                  Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className={cn("px-4 py-1.5 rounded-full border border-transparent flex items-center gap-2.5 shadow-sm", color)}>
      <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">{label}</span>
      <span className="text-[12px] font-black">{value}</span>
    </div>
  );
}
