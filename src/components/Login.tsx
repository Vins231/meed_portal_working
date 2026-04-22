import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Anchor, Loader2, Lock, Mail, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { cn } from '../lib/utils';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);

    try {
      const user = await api.login(email, password);
      localStorage.setItem('meed_user', JSON.stringify(user));
      onLogin(user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials or inactive account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans">
      {/* LEFT PANEL */}
      <div className="flex-1 bg-[#0B1F3A] text-white p-8 md:p-16 flex flex-col justify-between relative overflow-hidden">
        {/* Animated Wave Background */}
        <div className="absolute bottom-0 left-0 w-full opacity-[0.06] pointer-events-none">
          <svg 
            viewBox="0 0 1440 320" 
            className="w-full h-auto animate-[wave_10s_linear_infinite]"
            preserveAspectRatio="none"
          >
            <path 
              fill="#00C9A7" 
              d="M0,160L48,176C96,192,192,224,288,224C384,224,480,192,576,165.3C672,139,768,117,864,128C960,139,1056,181,1152,197.3C1248,213,1344,203,1392,197.3L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            ></path>
          </svg>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-12">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.2)] p-1 overflow-hidden">
              <img 
                src="/mbpa_logo.png" 
                alt="MbPA Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold tracking-tight text-white">MbPA MEED Portal</h1>
              <p className="text-xs text-[#00C9A7] font-bold uppercase tracking-[0.2em]">Mumbai Port Authority</p>
            </div>
          </div>

          <div className="max-w-md space-y-6">
            <h2 className="text-4xl md:text-5xl font-display font-bold leading-tight">
              Command Center for <span className="text-[#00C9A7]">MEED</span> Department
            </h2>
            <p className="text-lg text-slate-400 leading-relaxed">
              Manage tenders, track works, monitor assets, and streamline departmental operations in one unified platform.
            </p>
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4 text-sm font-medium border-t border-white/10 pt-8">
            <div className="flex items-center gap-2">
              <span className="text-[#00C9A7] text-xl font-bold">57</span>
              <span className="text-slate-400">Officers Connected</span>
            </div>
            <div className="w-px h-4 bg-white/10 hidden sm:block"></div>
            <div className="flex items-center gap-2">
              <span className="text-[#00C9A7] text-xl font-bold">4</span>
              <span className="text-slate-400">Divisions</span>
            </div>
            <div className="w-px h-4 bg-white/10 hidden sm:block"></div>
            <div className="flex items-center gap-2">
              <span className="text-[#00C9A7] text-xl font-bold">10</span>
              <span className="text-slate-400">Sections</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-full md:w-[480px] bg-[#F0F4F8] flex flex-col items-center justify-center p-8 relative">
        <div className="w-full max-w-sm bg-white rounded-[24px] shadow-[0_8px_40px_rgba(11,31,58,0.1)] p-8 md:p-10 animate-[slideUp_0.5s_ease-out]">
          <div className="mb-8">
            <h3 className="text-2xl font-display font-bold text-[#0B1F3A] flex items-center gap-2">
              Welcome back <span className="animate-[streak_2s_ease-in-out_infinite]">👋</span>
            </h3>
            <p className="text-slate-500 text-sm mt-1">Please enter your credentials to continue</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 text-rose-700 text-sm animate-[fadeIn_0.3s_ease]">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Email Address</label>
              <div className="relative group">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#00C9A7] transition-colors" />
                <input 
                  type="email" 
                  autoComplete="email"
                  required
                  value={email || ''}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@mumbaiport.gov.in"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Password</label>
              <div className="relative group">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#00C9A7] transition-colors" />
                <input 
                  type="password" 
                  required
                  value={password || ''}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00C9A7] focus:bg-white transition-all"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-[#00C9A7] to-[#3B9EDA] text-white rounded-xl font-bold text-sm shadow-[0_4px_15px_rgba(0,201,167,0.3)] hover:shadow-[0_8px_25px_rgba(0,201,167,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>Sign in to Portal</>
              )}
            </button>
          </form>
        </div>

        <div className="mt-12 text-center">
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
            Mumbai Port Authority · MEED Department<br />
            For access issues contact <span className="text-[#0B1F3A] font-bold cursor-pointer hover:underline">Admin</span>
          </p>
        </div>
      </div>
    </div>
  );
}
