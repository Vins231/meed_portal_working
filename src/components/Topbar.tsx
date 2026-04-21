import { useState, useEffect } from 'react';
import { Menu, Search, Bell, RotateCcw, Flame, Clock, Palette, Volume2, VolumeX } from 'lucide-react';
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
  alertCount?: number;
  hasCritical?: boolean;
}

export default function Topbar({ 
  title, 
  onToggleSidebar, 
  onRefresh, 
  onOpenSearch,
  onOpenAlerts,
  streak,
  sidebarCollapsed,
  alertCount = 0,
  hasCritical = false
}: TopbarProps) {
  const [time, setTime] = useState(new Date());
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(
    () => localStorage.getItem('meed_theme') || 'default'
  );
  const [soundOn, setSoundOn] = useState(
    () => localStorage.getItem('meed_sound') !== 'off'
  );

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('meed_theme') || 'default';
    if (saved !== 'default') {
      document.documentElement.setAttribute('data-theme', saved);
    }
    setCurrentTheme(saved);
  }, []);

  const applyTheme = (theme: string) => {
    if (theme === 'default') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem('meed_theme', theme);
    setCurrentTheme(theme);
    setShowThemePicker(false);
  };

  return (
    <header className={cn(
      "fixed top-0 right-0 h-[var(--topbar)] bg-white/80 backdrop-blur-xl border-b border-slate-200/60 flex items-center px-6 gap-4 z-[100] transition-all duration-300",
      "left-0",
      sidebarCollapsed ? "md:left-16" : "md:left-[268px]"
    )}>
      <button 
        className="w-10 h-10 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] grid place-items-center text-[var(--muted)] transition-all hover:border-[var(--teal)] hover:text-[var(--teal)] hover:bg-[var(--teal)]/5 md:hidden"
        onClick={onToggleSidebar}
      >
        <Menu size={20} />
      </button>

      <h1 className="font-display text-lg font-bold text-[var(--navy)] truncate tracking-tight">
        {title}
      </h1>

      <div className="ml-auto flex items-center gap-3">
        {/* Search Trigger */}
        <button 
          onClick={onOpenSearch}
          className="hidden lg:flex items-center gap-3 px-4 py-2 bg-[var(--paper)] border border-[var(--border)] rounded-xl text-[var(--muted)] text-[13px] transition-all hover:border-[var(--teal)] hover:bg-[var(--card-bg)] hover:text-[var(--teal)] cursor-pointer min-w-[180px] group"
        >
          <Search size={14} className="group-hover:scale-110 transition-transform" />
          <span className="font-medium">Search anything...</span>
          <div className="ml-auto flex items-center gap-1 opacity-60">
            <kbd className="text-[10px] bg-[var(--card-bg)] px-1.5 py-0.5 rounded border border-[var(--border)] font-sans font-bold">Ctrl</kbd>
            <kbd className="text-[10px] bg-[var(--card-bg)] px-1.5 py-0.5 rounded border border-[var(--border)] font-sans font-bold">K</kbd>
          </div>
        </button>

        {/* Streak Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--amber)]/10 border border-[var(--amber)]/20 rounded-xl cursor-pointer group hover:bg-[var(--amber)]/20 transition-colors">
          <Flame size={16} className="text-[var(--amber)] animate-bounce" />
          <span className="font-display text-sm font-bold text-[var(--amber)]">{streak}</span>
          <span className="hidden xl:inline text-[10px] text-[var(--amber)]/60 font-bold uppercase tracking-wider">Streak</span>
        </div>

        {/* Live Clock */}
        <div className="hidden sm:flex items-center gap-3 px-4 py-1.5 bg-[var(--paper)] border border-[var(--border)] rounded-xl">
          <Clock size={14} className="text-[var(--muted)]" />
          <div className="flex flex-col items-start leading-none">
            <span className="font-display text-[13px] font-bold text-[var(--navy)] tracking-wider">
              {format(time, 'HH:mm:ss')}
            </span>
            <span className="text-[9px] text-[var(--muted)] font-bold uppercase tracking-tighter mt-0.5">
              {format(time, 'EEE, d MMM')}
            </span>
          </div>
        </div>

        {/* Alert Bell */}
        <button 
          onClick={onOpenAlerts}
          className="w-10 h-10 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] grid place-items-center text-[var(--muted)] transition-all hover:border-[var(--teal)] hover:text-[var(--teal)] hover:bg-[var(--teal)]/5 relative group"
        >
          <Bell size={18} className="group-hover:rotate-12 transition-transform" />
          {alertCount > 0 && (
            <div className={cn(
              "absolute -top-1 -right-1 min-w-[20px] h-[20px] rounded-full border-2 border-[var(--card-bg)] flex items-center justify-center text-[10px] font-black text-white px-1 shadow-lg animate-in zoom-in duration-300",
              hasCritical ? "bg-[var(--rose)] animate-pulse" : "bg-[var(--amber)]"
            )}>
              {alertCount}
            </div>
          )}
        </button>

        {/* Theme Picker */}
        <div className="relative">
          <button
            onClick={() => setShowThemePicker(!showThemePicker)}
            className="w-10 h-10 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] grid place-items-center text-[var(--muted)] transition-all hover:border-[var(--teal)] hover:text-[var(--teal)] hover:bg-[var(--teal)]/5 group relative"
            title="Change Theme"
          >
            <Palette size={18} className="group-hover:rotate-12 transition-transform" />
            {/* Active theme dot */}
            <div className={cn(
              "absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white",
              currentTheme === 'default' ? "bg-[#00C9A7]" :
              currentTheme === 'midnight' ? "bg-[#E94560]" :
              "bg-[#6C63FF]"
            )} />
          </button>

          {/* Theme Picker Dropdown */}
          {showThemePicker && (
            <div className="absolute right-0 top-12 w-72 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-2xl z-[200] overflow-hidden animate-in zoom-in-95 slide-in-from-top-2 duration-200">
              
              {/* Header */}
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <p className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-widest">
                  Portal Theme
                </p>
              </div>

              {/* Theme Options */}
              <div className="p-3 space-y-2">
                
                {/* Theme 1 — Navy Command */}
                <button
                  onClick={() => applyTheme('default')}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border transition-all hover:scale-[1.02] text-left",
                    currentTheme === 'default'
                      ? "border-[#00C9A7] bg-[#00C9A7]/5"
                      : "border-[var(--border)] hover:border-[var(--border2)]"
                  )}
                >
                  {/* Color Preview */}
                  <div className="flex gap-1 shrink-0">
                    <div className="w-5 h-8 rounded-l-lg" style={{background:'#0B1F3A'}} />
                    <div className="w-5 h-8" style={{background:'#00C9A7'}} />
                    <div className="w-5 h-8 rounded-r-lg" style={{background:'#F5A623'}} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--ink)]">Navy Command</p>
                    <p className="text-[10px] text-[var(--muted)] font-medium mt-0.5">
                      Default · Professional · Maritime
                    </p>
                  </div>
                  {currentTheme === 'default' && (
                    <div className="w-5 h-5 rounded-full bg-[#00C9A7] flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  )}
                </button>

                {/* Theme 2 — Midnight Carbon */}
                <button
                  onClick={() => applyTheme('midnight')}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border transition-all hover:scale-[1.02] text-left",
                    currentTheme === 'midnight'
                      ? "border-[#E94560] bg-[#E94560]/5"
                      : "border-[var(--border)] hover:border-[var(--border2)]"
                  )}
                >
                  <div className="flex gap-1 shrink-0">
                    <div className="w-5 h-8 rounded-l-lg" style={{background:'#0F0F1A'}} />
                    <div className="w-5 h-8" style={{background:'#E94560'}} />
                    <div className="w-5 h-8 rounded-r-lg" style={{background:'#0F3460'}} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--ink)]">Midnight Carbon</p>
                    <p className="text-[10px] text-[var(--muted)] font-medium mt-0.5">
                      Dark · Futuristic · Glowing
                    </p>
                  </div>
                  {currentTheme === 'midnight' && (
                    <div className="w-5 h-5 rounded-full bg-[#E94560] flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  )}
                </button>

                {/* Theme 3 — Titanium Pro */}
                <button
                  onClick={() => applyTheme('titanium')}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border transition-all hover:scale-[1.02] text-left",
                    currentTheme === 'titanium'
                      ? "border-[#6C63FF] bg-[#6C63FF]/5"
                      : "border-[var(--border)] hover:border-[var(--border2)]"
                  )}
                >
                  <div className="flex gap-1 shrink-0">
                    <div className="w-5 h-8 rounded-l-lg" style={{background:'#1A1A2A'}} />
                    <div className="w-5 h-8" style={{background:'#6C63FF'}} />
                    <div className="w-5 h-8 rounded-r-lg" style={{background:'#FF6B6B'}} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--ink)]">Titanium Pro</p>
                    <p className="text-[10px] text-[var(--muted)] font-medium mt-0.5">
                      Premium · Sharp · Corporate
                    </p>
                  </div>
                  {currentTheme === 'titanium' && (
                    <div className="w-5 h-5 rounded-full bg-[#6C63FF] flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  )}
                </button>
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--paper)]/50">
                <p className="text-[10px] text-[var(--muted)] font-medium text-center">
                  Theme preference is saved automatically
                </p>
              </div>
            </div>
          )}

          {/* Close picker on outside click */}
          {showThemePicker && (
            <div 
              className="fixed inset-0 z-[199]"
              onClick={() => setShowThemePicker(false)}
            />
          )}
        </div>

        <button
          onClick={() => {
            const next = !soundOn;
            setSoundOn(next);
            localStorage.setItem('meed_sound', 
              next ? 'on' : 'off');
          }}
          title={soundOn ? 'Mute sounds' : 'Enable sounds'}
          className="w-10 h-10 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] grid place-items-center transition-all hover:border-[var(--teal)] hover:text-[var(--teal)] hover:bg-[var(--teal)]/5"
        >
          {soundOn
            ? <Volume2 size={16} className="text-[var(--teal)]" />
            : <VolumeX size={16} className="text-[var(--muted)]" />
          }
        </button>

        {/* Refresh */}
        <button 
          onClick={onRefresh}
          className="w-10 h-10 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] grid place-items-center text-[var(--muted)] transition-all hover:border-[var(--teal)] hover:text-[var(--teal)] hover:bg-[var(--teal)]/5 group"
        >
          <RotateCcw size={18} className="group-active:rotate-180 transition-transform duration-500" />
        </button>
      </div>
    </header>
  );
}
