import { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AlertPanel from './AlertPanel';
import CommandPalette from './CommandPalette';
import ToastContainer from './ToastContainer';
import { User } from '../types';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface LayoutProps {
  user: User;
  onLogout: () => void;
}

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/planning': 'Planning Register',
  '/approval': 'Under Approval',
  '/tender': 'Tender Management',
  '/awarded': 'Awarded Works',
  '/bg': 'Bank Guarantee Tracker',
  '/reports': 'Reports',
  '/activity': 'Activity Log',
  '/admin': 'Admin - User Management',
  '/profile': 'My Profile'
};

export default function Layout({ user, onLogout }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [alertCounts, setAlertCounts] = useState({ critical: 0, warning: 0 });
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const location = useLocation();

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const handleModalOpen = () => {
      // Only auto-collapse on md+ screens
      // On mobile sidebar is already hidden
      if (window.innerWidth >= 768) {
        setSidebarCollapsed(true);
      }
    };

    const handleModalClose = () => {
      // Restore to user's saved preference on close
      const saved = localStorage.getItem('sidebar_collapsed');
      if (window.innerWidth >= 768) {
        setSidebarCollapsed(saved === 'true');
      }
    };

    window.addEventListener('modal-open', handleModalOpen);
    window.addEventListener('modal-close', handleModalClose);

    return () => {
      window.removeEventListener('modal-open', handleModalOpen);
      window.removeEventListener('modal-close', handleModalClose);
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('meed_theme');
    if (saved && saved !== 'default') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // PART 2 — BROWSER PUSH and Badge Counting
  const checkCriticalAlerts = useCallback(async () => {
    const today = new Date();
    let crit = 0;
    let warn = 0;

    // 1. BG Alerts
    const { data: bgs } = await supabase
      .from('bg_tracker')
      .select('bg_number, agency_name, expiry_date, extended_expiry_date')
      .neq('bg_status', 'Released');
    
    (bgs || []).forEach(bg => {
      const expiry = new Date(bg.extended_expiry_date || bg.expiry_date);
      const days = Math.floor((expiry.getTime() - today.getTime()) / 86400000);
      
      if (days < 0 || days <= 7) {
        crit++;
        if (Notification.permission === 'granted' && days >= 0 && days <= 7) {
          new Notification('⚠️ BG Expiring Soon — MbPA MEED', {
            body: `BG ${bg.bg_number} (${bg.agency_name}) expires in ${days} days`,
            icon: '/favicon.ico',
            tag: bg.bg_number
          });
        }
      } else if (days <= 30) {
        warn++;
      }
    });

    // 2. Delayed Works
    const { data: delayed } = await supabase
      .from('awarded_works')
      .select('name_of_work, delay_days')
      .gt('delay_days', 0)
      .neq('overall_status', 'Completed');
    
    (delayed || []).forEach(w => {
      const days = Number(w.delay_days);
      if (days > 30) {
        crit++;
      } else {
        warn++;
      }
    });

    // Specific Push for Delayed Works
    const seriousDelayed = (delayed || []).filter(w => Number(w.delay_days) > 30);
    if (Notification.permission === 'granted' && seriousDelayed.length > 0) {
      new Notification(`🔴 ${seriousDelayed.length} Works Critically Delayed — MbPA MEED`, {
        body: seriousDelayed.slice(0, 3).map(w => 
          `${w.name_of_work?.substring(0,30)}: ${w.delay_days}d`
        ).join('\n'),
        icon: '/favicon.ico',
        tag: 'delayed-works'
      });
    }

    // 3. Bid Deadlines
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const { data: deadlines } = await supabase
      .from('tender')
      .select('tender_no, name_of_work, bid_submission_deadline')
      .not('current_stage', 'in', '("Awarded","Cancelled")');
    
    (deadlines || []).forEach(t => {
      if (!t.bid_submission_deadline) return;
      const deadline = new Date(t.bid_submission_deadline);
      const days = Math.floor((deadline.getTime() - today.getTime()) / 86400000);
      
      if (days === 1) {
        crit++;
        if (Notification.permission === 'granted' && t.bid_submission_deadline === tomorrowStr) {
          new Notification('📅 Bid Deadline Tomorrow — MbPA MEED', {
            body: `${t.tender_no}: ${t.name_of_work?.substring(0,50)}`,
            icon: '/favicon.ico',
            tag: t.tender_no
          });
        }
      } else if (days > 1 && days <= 7) {
        warn++;
      }
    });

    // 4. Overdue Approvals
    const { data: approvals } = await supabase
      .from('under_approval')
      .select('days_in_pipeline')
      .gt('days_in_pipeline', 60)
      .not('current_stage', 'in', '("Tendered","Dropped")');
    
    warn += (approvals || []).length;

    setAlertCounts({ critical: crit, warning: warn });
  }, []);

  useEffect(() => {
    // Request push notification permission
    const requestPermission = async () => {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification('MbPA MEED Portal', {
            body: 'Notifications enabled. You will receive alerts for BG expiry and delays.',
            icon: '/favicon.ico'
          });
        }
      }
    };
    
    requestPermission();

    // Run immediately on login then every 30 minutes
    checkCriticalAlerts();
    const interval = setInterval(checkCriticalAlerts, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [checkCriticalAlerts]);

  const title = PAGE_TITLES[location.pathname] || 'MbPA MEED Portal';

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <Sidebar 
        user={user} 
        onLogout={onLogout} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      <Topbar 
        title={title} 
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
        onRefresh={() => window.location.reload()}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        streak={user.streak || 0}
        sidebarCollapsed={sidebarCollapsed}
        alertCount={alertCounts.critical + alertCounts.warning}
        hasCritical={alertCounts.critical > 0}
      />

      <AlertPanel 
        isOpen={isAlertsOpen} 
        onClose={() => setIsAlertsOpen(false)} 
      />

      <CommandPalette 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
      />

      <ToastContainer />

      <main className={cn(
        "pt-[var(--topbar)] min-h-screen transition-all duration-300",
        sidebarCollapsed ? "md:ml-16" : "md:ml-[268px]"
      )}>
        <div className="p-6 animate-[fadeUp_0.3s_ease]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
