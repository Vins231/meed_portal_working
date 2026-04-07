import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AlertPanel from './AlertPanel';
import CommandPalette from './CommandPalette';
import { User } from '../types';
import { cn } from '../lib/utils';

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const location = useLocation();

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

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
      />

      <AlertPanel 
        isOpen={isAlertsOpen} 
        onClose={() => setIsAlertsOpen(false)} 
      />

      <CommandPalette 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
      />

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
