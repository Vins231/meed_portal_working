import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AlertPanel from './AlertPanel';
import CommandPalette from './CommandPalette';
import { User } from '../types';

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
  const location = useLocation();

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
      />
      
      <Topbar 
        title={title} 
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
        onRefresh={() => window.location.reload()}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        streak={user.streak || 0}
      />

      <AlertPanel 
        isOpen={isAlertsOpen} 
        onClose={() => setIsAlertsOpen(false)} 
      />

      <CommandPalette 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
      />

      <main className="md:ml-[var(--sidebar)] pt-[var(--topbar)] min-h-screen">
        <div className="p-6 animate-[fadeUp_0.3s_ease]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
