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

  // Permission State
  const [editingPerms, setEditingPerms] = useState<UserRecord | null>(null);
  const [permForm, setPermForm] = useState<any>({
    can_add: false,
    can_edit: false,
    can_delete: false,
    can_move_to_tender: false,
    can_award: false,
    can_view_reports: false,
    can_view_all_divisions: false,
    own_division: '',
    modules: []
  });
  const [savingPerms, setSavingPerms] = useState(false);
  
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
    if (currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin') {
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

  const openPermissions = (u: UserRecord) => {
    const defaults = {
      SuperAdmin: { can_add:true, can_edit:true, 
        can_delete:true, can_move_to_tender:true,
        can_award:true, can_view_reports:true,
        can_view_all_divisions:true,
        modules:['planning','approval','tender',
          'awarded','bg','reports','activity',
           'admin','calendar'] },
      Admin: { can_add:true, can_edit:true,
        can_delete:true, can_move_to_tender:true,
        can_award:true, can_view_reports:true,
        can_view_all_divisions:true,
        modules:['planning','approval','tender',
          'awarded','bg','reports','activity',
          'admin','calendar'] },
      Manager: { can_add:true, can_edit:true,
        can_delete:false, can_move_to_tender:true,
        can_award:true, can_view_reports:true,
        can_view_all_divisions:false,
        modules:['planning','approval','tender',
          'awarded','bg','reports','calendar'] },
      Engineer: { can_add:true, can_edit:true,
        can_delete:false, can_move_to_tender:false,
        can_award:false, can_view_reports:true,
        can_view_all_divisions:false,
        modules:['planning','approval','tender',
          'awarded','bg','reports','calendar'] },
      Viewer: { can_add:false, can_edit:false,
        can_delete:false, can_move_to_tender:false,
        can_award:false, can_view_reports:true,
        can_view_all_divisions:true,
        modules:['planning','approval','tender',
          'awarded','bg','reports','calendar'] },
      Agency: { can_add:false, can_edit:false,
        can_delete:false, can_move_to_tender:false,
        can_award:false, can_view_reports:false,
        can_view_all_divisions:false,
        modules:['awarded'] }
    } as any;
    
    const roleDefault = defaults[u.role] || 
      defaults.Viewer;
    const merged = (u as any).permissions && 
      Object.keys((u as any).permissions).length > 0
      ? { ...roleDefault, ...(u as any).permissions }
      : roleDefault;
    
    setPermForm(merged);
    setEditingPerms(u);
    window.dispatchEvent(new Event('modal-open'));
  };

  const savePermissions = async () => {
    if (!editingPerms) return;
    setSavingPerms(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ permissions: permForm })
        .eq('user_id', editingPerms.user_id);
      if (error) throw error;
      if (currentUser) {
        await api.logActivity('UPDATE','ADMIN',
          editingPerms.user_id,
          `Permissions updated for ${editingPerms.name} by ${currentUser.name}`,
          currentUser);
      }
      setEditingPerms(null);
      window.dispatchEvent(new Event('modal-close'));
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to save permissions');
    } finally {
      setSavingPerms(false);
    }
  };

  const resetPermissions = async () => {
    if (!editingPerms) return;
    if (!confirm('Reset to role defaults? All custom permissions will be cleared.')) return;
    setSavingPerms(true);
    try {
      await supabase.from('users')
        .update({ permissions: {} })
        .eq('user_id', editingPerms.user_id);
      setEditingPerms(null);
      window.dispatchEvent(new Event('modal-close'));
      fetchData();
    } finally {
      setSavingPerms(false);
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

  if (currentUser?.role !== 'Admin' && currentUser?.role !== 'SuperAdmin') {
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
                    <select
                      value={u.role}
                      onChange={async (e) => {
                        const newRole = e.target.value;
                        if (u.role === 'SuperAdmin') {
                          alert('SuperAdmin role cannot be changed.');
                          return;
                        }
                        if (u.user_id === currentUser?.user_id) {
                          alert('You cannot change your own role.');
                          return;
                        }
                        if (!confirm(`Change ${u.name}'s role to ${newRole}?`)) 
                          return;
                        try {
                          const { error } = await supabase
                            .from('users')
                            .update({ role: newRole })
                            .eq('user_id', u.user_id);
                          if (error) throw error;
                          await api.logActivity('UPDATE','ADMIN',
                            u.user_id,
                            `Role changed to ${newRole} for ${u.name} by ${currentUser?.name}`,
                            currentUser!);
                          fetchData();
                        } catch (err) {
                          alert('Failed to change role');
                        }
                      }}
                      className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider cursor-pointer outline-none",
                        u.role === 'SuperAdmin' 
                          ? "bg-amber-100 text-amber-700 border-amber-300 cursor-not-allowed" :
                        u.role === 'Admin' 
                          ? "bg-rose-100 text-rose-700 border-rose-200" :
                        u.role === 'Manager' 
                          ? "bg-sky-100 text-sky-700 border-sky-200" :
                        u.role === 'Engineer' 
                          ? "bg-teal-100 text-teal-700 border-teal-200" :
                        u.role === 'Viewer'
                          ? "bg-purple-100 text-purple-700 border-purple-200" :
                          "bg-slate-100 text-slate-700 border-slate-200"
                      )}
                      disabled={u.role === 'SuperAdmin' || 
                                u.user_id === currentUser?.user_id}
                    >
                      {roles.map(r => (
                        <option key={r.id} value={r.name}>
                          {r.name}
                        </option>
                      ))}
                    </select>
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
                    <button
                      onClick={() => {
                        if (u.role === 'SuperAdmin') {
                          alert('SuperAdmin cannot be deactivated.');
                          return;
                        }
                        if (u.user_id === currentUser?.user_id) {
                          alert('You cannot deactivate yourself.');
                          return;
                        }
                        toggleStatus(u);
                      }}
                      disabled={u.role === 'SuperAdmin' || 
                                u.user_id === currentUser?.user_id}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border capitalize transition-all",
                        u.role === 'SuperAdmin' || 
                        u.user_id === currentUser?.user_id
                          ? "cursor-not-allowed opacity-60" : 
                          "cursor-pointer hover:opacity-80",
                        u.status === 'Active' 
                          ? "bg-green-50 text-green-700 border-green-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200" 
                          : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                      )}
                      title={u.status === 'Active' 
                        ? 'Click to Deactivate' 
                        : 'Click to Activate'}
                    >
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        u.status === 'Active' 
                          ? "bg-green-500" : "bg-rose-500"
                      )} />
                      {u.status}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {u.role === 'SuperAdmin' && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                        Full Access
                      </span>
                    )}
                    {u.role !== 'SuperAdmin' && u.user_id !== currentUser?.user_id && (
                      <button
                        onClick={() => openPermissions(u)}
                        className="px-3 py-1 rounded-lg text-[10px] font-bold border border-purple-200 text-purple-600 hover:bg-purple-50 transition-all"
                      >
                        Permissions
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

      {/* Permission Editing Modal */}
      {editingPerms && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-[var(--navy)] text-base">
                  Permissions — {editingPerms.name}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  {editingPerms.role} · {editingPerms.division}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => { setEditingPerms(null); window.dispatchEvent(new Event('modal-close')); }} 
                className="p-2 hover:bg-white hover:shadow-sm rounded-full transition-all text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* SECTION 1 Module Access */}
            <div className="p-6 border-b border-slate-100">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-4">Module Access</label>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                {[
                  { id: 'planning', label: 'Planning' },
                  { id: 'approval', label: 'Under Approval' },
                  { id: 'tender', label: 'Tender' },
                  { id: 'awarded', label: 'Awarded Works' },
                  { id: 'bg', label: 'Bank Guarantee' },
                  { id: 'reports', label: 'Reports' },
                  { id: 'calendar', label: 'Calendar' },
                  { id: 'activity', label: 'Activity Log' },
                ].map((mod) => (
                  <label key={mod.id} className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={permForm.modules?.includes(mod.id)}
                      onChange={(e) => {
                        const mods = permForm.modules || [];
                        setPermForm({
                          ...permForm,
                          modules: e.target.checked
                            ? [...mods, mod.id]
                            : mods.filter((m: string) => m !== mod.id)
                        });
                      }}
                      className="w-4 h-4 accent-[var(--teal)] transition-all"
                    />
                    <span className="text-xs font-bold text-slate-600">{mod.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* SECTION 2 Actions */}
            <div className="p-6 border-b border-slate-100 space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Actions</label>
              
              {[
                { key: 'can_add', label: 'Add Records', desc: 'Can create new records' },
                { key: 'can_edit', label: 'Edit Records', desc: 'Can modify existing records' },
                { key: 'can_delete', label: 'Delete Records', desc: 'Can permanently delete' },
                { key: 'can_move_to_tender', label: 'Move to Tender', desc: 'Can progress works to tender stage' },
                { key: 'can_award', label: 'Award Works', desc: 'Can award tenders to contractors' },
                { key: 'can_view_reports', label: 'View Reports', desc: 'Can access reports module' },
              ].map((p: any) => (
                <div key={p.key} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-bold text-slate-700">{p.label}</p>
                    <p className="text-[10px] text-slate-400">{p.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPermForm({ ...permForm, [p.key]: !permForm[p.key] })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      permForm[p.key] ? "bg-[var(--teal)]" : "bg-slate-200"
                    )}
                  >
                    <span className={cn(
                      "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all",
                      permForm[p.key] ? "left-6" : "left-0.5"
                    )} />
                  </button>
                </div>
              ))}
            </div>

            {/* SECTION 3 Data Access */}
            <div className="p-6 border-b border-slate-100">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-4">Data Access</label>
              <div className="space-y-4">
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="access" 
                      checked={permForm.can_view_all_divisions}
                      onChange={() => setPermForm({...permForm, can_view_all_divisions: true})}
                      className="accent-[var(--teal)]"
                    />
                    <span className="text-xs font-bold text-slate-600">All Divisions</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="access" 
                      checked={!permForm.can_view_all_divisions}
                      onChange={() => setPermForm({...permForm, can_view_all_divisions: false})}
                      className="accent-[var(--teal)]"
                    />
                    <span className="text-xs font-bold text-slate-600">Own Division Only</span>
                  </label>
                </div>

                {!permForm.can_view_all_divisions && (
                  <div className="space-y-2 animate-in slide-in-from-top-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Primary Division</label>
                    <select
                      value={permForm.own_division || ''}
                      onChange={(e) => setPermForm({...permForm, own_division: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                    >
                      <option value="">Select Division</option>
                      {divisions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* FOOTER */}
            <div className="p-6 flex items-center justify-between gap-4">
              <button 
                type="button"
                onClick={resetPermissions}
                className="text-[10px] font-bold text-rose-500 hover:bg-rose-50 px-3 py-2 rounded-lg transition-all uppercase tracking-wider"
              >
                Reset to Defaults
              </button>
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => { setEditingPerms(null); window.dispatchEvent(new Event('modal-close')); }}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={savePermissions}
                  disabled={savingPerms}
                  className="px-6 py-2 bg-[var(--teal)] text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {savingPerms ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                  Save Permissions
                </button>
              </div>
            </div>
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
