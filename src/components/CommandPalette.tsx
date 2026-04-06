import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, Command, FileText, Handshake, ShieldCheck, Lightbulb, FileSignature, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

interface SearchResult {
  id: string;
  type: 'planning' | 'approval' | 'tender' | 'awarded' | 'bg';
  title: string;
  subtitle: string;
  path: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        performSearch();
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const [planning, approval, tender, awarded, bg] = await Promise.all([
        supabase.from('planning').select('plan_id, name_of_work').ilike('name_of_work', `%${query}%`).limit(3),
        supabase.from('under_approval').select('approval_id, name_of_work').ilike('name_of_work', `%${query}%`).limit(3),
        supabase.from('tender').select('tender_id, name_of_work').ilike('name_of_work', `%${query}%`).limit(3),
        supabase.from('awarded_works').select('awarded_id, name_of_work').ilike('name_of_work', `%${query}%`).limit(3),
        supabase.from('bg_tracker').select('bg_id, bg_number').ilike('bg_number', `%${query}%`).limit(3)
      ]);

      const allResults: SearchResult[] = [
        ...(planning.data || []).map(r => ({ id: r.plan_id, type: 'planning' as const, title: r.name_of_work, subtitle: 'Planning Phase', path: '/planning' })),
        ...(approval.data || []).map(r => ({ id: r.approval_id, type: 'approval' as const, title: r.name_of_work, subtitle: 'Under Approval', path: '/approval' })),
        ...(tender.data || []).map(r => ({ id: r.tender_id, type: 'tender' as const, title: r.name_of_work, subtitle: 'Tender Stage', path: '/tender' })),
        ...(awarded.data || []).map(r => ({ id: r.awarded_id, type: 'awarded' as const, title: r.name_of_work, subtitle: 'Awarded Work', path: '/awarded' })),
        ...(bg.data || []).map(r => ({ id: r.bg_id, type: 'bg' as const, title: `BG No. ${r.bg_number}`, subtitle: 'Bank Guarantee', path: '/bg' }))
      ];

      setResults(allResults);
      setSelectedIndex(0);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSelect = (result: SearchResult) => {
    navigate(result.path);
    onClose();
  };

  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'planning': return <Lightbulb size={16} className="text-amber-500" />;
      case 'approval': return <FileSignature size={16} className="text-sky-500" />;
      case 'tender': return <FileText size={16} className="text-teal-500" />;
      case 'awarded': return <Handshake size={16} className="text-green-500" />;
      case 'bg': return <ShieldCheck size={16} className="text-rose-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#0B1F3A]/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease]"
        onClick={onClose}
      />

      {/* Palette Box */}
      <div className="relative w-full max-w-[600px] bg-white rounded-[24px] shadow-[0_32px_80px_rgba(11,31,58,0.4)] overflow-hidden animate-[slideUp_0.3s_ease-out]">
        <div className="flex items-center px-6 py-5 border-b border-slate-100 gap-4">
          <Search size={22} className={cn("transition-colors", loading ? "text-[#00C9A7] animate-pulse" : "text-slate-400")} />
          <input 
            ref={inputRef}
            type="text" 
            placeholder="Search planning, tenders, works, or BGs..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-none outline-none text-lg font-medium text-[#0B1F3A] placeholder:text-slate-300"
          />
          {loading ? (
            <Loader2 size={18} className="animate-spin text-[#00C9A7]" />
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Esc</span>
            </div>
          )}
        </div>

        <div className="max-h-[400px] overflow-y-auto scrollbar-hide">
          {results.length > 0 ? (
            <div className="p-2">
              {results.map((result, idx) => (
                <div 
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3.5 rounded-xl cursor-pointer transition-all group",
                    idx === selectedIndex ? "bg-[#00C9A7]/10" : "hover:bg-slate-50"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all shadow-sm",
                    idx === selectedIndex ? "bg-white scale-110" : "bg-slate-50"
                  )}>
                    {getTypeIcon(result.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={cn(
                      "text-sm font-bold truncate transition-colors",
                      idx === selectedIndex ? "text-[#00C9A7]" : "text-[#0B1F3A]"
                    )}>
                      {result.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      {result.subtitle}
                    </p>
                  </div>
                  <div className={cn(
                    "flex items-center gap-2 opacity-0 transition-all",
                    idx === selectedIndex && "opacity-100 translate-x-0"
                  )}>
                    <span className="text-[10px] font-bold text-[#00C9A7] uppercase tracking-widest">Open</span>
                    <ArrowRight size={14} className="text-[#00C9A7]" />
                  </div>
                </div>
              ))}
            </div>
          ) : query.length >= 2 && !loading ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm font-medium">No results found for "{query}"</p>
            </div>
          ) : (
            <div className="p-6">
              <div className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] mb-4">Quick Actions</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'New Planning', path: '/planning', icon: Lightbulb },
                  { label: 'View Tenders', path: '/tender', icon: FileText },
                  { label: 'Awarded Works', path: '/awarded', icon: Handshake },
                  { label: 'BG Tracker', path: '/bg', icon: ShieldCheck }
                ].map((action) => (
                  <button 
                    key={action.label}
                    onClick={() => { navigate(action.path); onClose(); }}
                    className="flex items-center gap-3 p-3.5 bg-slate-50/50 border border-slate-100 rounded-xl hover:border-[#00C9A7] hover:bg-white transition-all text-left group"
                  >
                    <action.icon size={16} className="text-slate-400 group-hover:text-[#00C9A7]" />
                    <span className="text-xs font-bold text-slate-600 group-hover:text-[#0B1F3A]">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <div className="flex items-center gap-1.5">
            <kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-200">Enter</kbd>
            <span>Select</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-200">↑↓</kbd>
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-200">Esc</kbd>
            <span>Close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
