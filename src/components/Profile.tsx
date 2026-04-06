import React, { useState } from 'react';
import { User as UserIcon, Mail, Building2, Layers, Smartphone, Phone, Shield, Loader2 } from 'lucide-react';
import { User } from '../types';
import { supabase } from '../lib/supabase';

interface ProfileProps {
  user: User;
}

export default function Profile({ user }: ProfileProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const handleChangePassword = async () => {
    setPwError(null);
    setPwSuccess(false);
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError('All fields are required');
      return;
    }
    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match');
      return;
    }

    setPwLoading(true);
    try {
      // Verify current password
      const { data, error } = await supabase
        .from('users')
        .select('user_id')
        .eq('user_id', user.user_id)
        .eq('password', currentPassword)
        .single();

      if (error || !data) {
        setPwError('Current password is incorrect');
        return;
      }

      // Update password
      const { error: updateError } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('user_id', user.user_id);

      if (updateError) throw updateError;

      setPwSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwError(err.message || 'Failed to update password');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-[16px] p-8 border border-[var(--border)] shadow-sm text-center">
        <div className="w-24 h-24 rounded-[24px] bg-gradient-to-br from-[var(--amber)] to-[#e07820] grid place-items-center text-3xl font-extrabold text-white mx-auto mb-5 font-display shadow-lg">
          {user.name?.charAt(0).toUpperCase() || 'U'}
        </div>
        <h2 className="font-display text-2xl font-bold text-[var(--navy)]">{user.name || 'User'}</h2>
        <p className="text-[var(--muted)] mt-1 font-medium">{user.designation || user.role} · {user.section || user.division}</p>
        <div className="mt-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--teal)]/10 text-[var(--teal)] rounded-full text-xs font-bold uppercase tracking-wider border border-[var(--teal)]/20">
            <Shield size={12} />
            {user.role}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-[16px] p-6 border border-[var(--border)] shadow-sm">
        <h3 className="font-display text-base font-bold text-[var(--navy)] mb-6">Contact Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoCard icon={Mail} label="Email Address" value={user.email} />
          <InfoCard icon={Building2} label="Division" value={user.division} />
          <InfoCard icon={Layers} label="Section" value={user.section} />
          <InfoCard icon={Smartphone} label="Mobile" value={user.mobile || 'Not provided'} />
          <InfoCard icon={Phone} label="Intercom" value={user.intercom || 'Not provided'} />
        </div>
      </div>

      <div className="bg-white rounded-[16px] p-6 border border-[var(--border)] shadow-sm">
        <h3 className="font-display text-base font-bold text-[var(--navy)] mb-6">Account Security</h3>
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-[var(--muted2)] uppercase tracking-wider">Current Password</label>
            <input 
              type="password" 
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full p-3 border border-[var(--border)] rounded-[12px] bg-[var(--paper)] outline-none focus:border-[var(--teal)] focus:bg-white transition-all text-sm"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-[var(--muted2)] uppercase tracking-wider">New Password</label>
              <input 
                type="password" 
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-3 border border-[var(--border)] rounded-[12px] bg-[var(--paper)] outline-none focus:border-[var(--teal)] focus:bg-white transition-all text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-[var(--muted2)] uppercase tracking-wider">Confirm New Password</label>
              <input 
                type="password" 
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-3 border border-[var(--border)] rounded-[12px] bg-[var(--paper)] outline-none focus:border-[var(--teal)] focus:bg-white transition-all text-sm"
              />
            </div>
          </div>

          {pwError && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-600 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={14} />
              {pwError}
            </div>
          )}

          {pwSuccess && (
            <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-green-600 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={14} />
              Password updated successfully!
            </div>
          )}

          <button 
            onClick={handleChangePassword}
            disabled={pwLoading}
            className="w-full py-3 bg-[var(--teal)] text-white rounded-[12px] text-sm font-bold hover:bg-[var(--teal2)] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {pwLoading && <Loader2 size={16} className="animate-spin" />}
            {pwLoading ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-4 p-4 bg-[var(--paper)] rounded-[12px] border border-[var(--border)]/50">
      <div className="w-10 h-10 rounded-[10px] bg-white border border-[var(--border)] grid place-items-center text-[var(--teal)] shrink-0">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider leading-none">{label}</div>
        <div className="text-[13.5px] font-semibold text-[var(--navy)] mt-1.5 truncate">{value}</div>
      </div>
    </div>
  );
}

function AlertCircle({ size, className }: any) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function CheckCircle2({ size, className }: any) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
