import { useState, useEffect } from 'react';
import { Menu, Search, Bell, RotateCcw, Flame, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface TopbarProps {
  title: string;
  onToggleSidebar: () => void;
  onRefresh: () => void;
  onOpenSearch: () => void;
  onOpenAlerts: () => void;
  streak: number;
  sidebarCollapsed: boolean;
}

export default function Topbar({ 
  title, 
  onToggleSidebar, 
  onRefresh, 
  onOpenSearch,
  onOpenAlerts,
  streak,
  sidebarCollapsed
}: TopbarProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className={cn(
      "fixed top-0 right-0 h-[var(--topbar)] bg-white/80 backdrop-blur-xl border-b border-slate-200/60 flex items-center px-6 gap-4 z-[100] transition-all duration-300",
      "left-0",
      sidebarCollapsed ? "md:left-16" : "md:left-[268px]"
    )}>
      <button 
        className="w-10 h-10 rounded-xl border border-slate-200 bg-white grid place-items-center text-slate-500 transition-all hover:border-[#00C9A7] hover:text-[#00C9A7] hover:bg-[#00C9A7]/5 md:hidden"
        onClick={onToggleSidebar}
      >
        <Menu size={20} />
      </button>

      <h1 className="font-display text-lg font-bold text-[#0B1F3A] truncate tracking-tight">
        {title}
      </h1>

      <div className="ml-auto flex items-center gap-3">
        {/* Search Trigger */}
        <button 
          onClick={onOpenSearch}
          className="hidden lg:flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 text-[13px] transition-all hover:border-[#00C9A7] hover:bg-white hover:text-[#00C9A7] cursor-pointer min-w-[180px] group"
        >
          <Search size={14} className="group-hover:scale-110 transition-transform" />
          <span className="font-medium">Search anything...</span>
          <div className="ml-auto flex items-center gap-1 opacity-60">
            <kbd className="text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-200 font-sans font-bold">Ctrl</kbd>
            <kbd className="text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-200 font-sans font-bold">K</kbd>
          </div>
        </button>

        {/* Streak Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-xl cursor-pointer group hover:bg-amber-100 transition-colors">
          <Flame size={16} className="text-[#F5A623] animate-bounce" />
          <span className="font-display text-sm font-bold text-[#F5A623]">{streak}</span>
          <span className="hidden xl:inline text-[10px] text-amber-600/60 font-bold uppercase tracking-wider">Streak</span>
        </div>

        {/* Live Clock */}
        <div className="hidden sm:flex items-center gap-3 px-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
          <Clock size={14} className="text-slate-400" />
          <div className="flex flex-col items-start leading-none">
            <span className="font-display text-[13px] font-bold text-[#0B1F3A] tracking-wider">
              {format(time, 'HH:mm:ss')}
            </span>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">
              {format(time, 'EEE, d MMM')}
            </span>
          </div>
        </div>

        {/* Alert Bell */}
        <button 
          onClick={onOpenAlerts}
          className="w-10 h-10 rounded-xl border border-slate-200 bg-white grid place-items-center text-slate-500 transition-all hover:border-[#00C9A7] hover:text-[#00C9A7] hover:bg-[#00C9A7]/5 relative group"
        >
          <Bell size={18} className="group-hover:rotate-12 transition-transform" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#E8445A] border-2 border-white" />
        </button>

        {/* Refresh */}
        <button 
          onClick={onRefresh}
          className="w-10 h-10 rounded-xl border border-slate-200 bg-white grid place-items-center text-slate-500 transition-all hover:border-[#00C9A7] hover:text-[#00C9A7] hover:bg-[#00C9A7]/5 group"
        >
          <RotateCcw size={18} className="group-active:rotate-180 transition-transform duration-500" />
        </button>
      </div>
    </header>
  );
}
