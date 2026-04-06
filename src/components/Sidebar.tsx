import { NavLink } from 'react-router-dom';
import { 
  Anchor, Gauge, Lightbulb, FileSignature, 
  FileText, Handshake, ShieldCheck, 
  BarChart3, History, Settings, LogOut, User as UserIcon
} from 'lucide-react';
import { User } from '../types';
import { cn } from '../lib/utils';

interface NavItem {
  id: string;
  label: string;
  icon: any;
  path: string;
  badge?: string;
  badgeColor?: 'amber' | 'rose' | 'sky';
  adminOnly?: boolean;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

interface SidebarProps {
  user: User;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ user, onLogout, isOpen, onClose }: SidebarProps) {
  const navItems: NavSection[] = [
    { section: 'Overview', items: [
      { id: 'dashboard', label: 'Dashboard', icon: Gauge, path: '/' },
    ]},
    { section: 'Tender Pipeline', items: [
      { id: 'planning', label: 'Planning', icon: Lightbulb, path: '/planning' },
      { id: 'approval', label: 'Under Approval', icon: FileSignature, path: '/approval' },
      { id: 'tender', label: 'Tender', icon: FileText, path: '/tender' },
      { id: 'awarded', label: 'Awarded Works', icon: Handshake, path: '/awarded' },
    ]},
    { section: 'Finance', items: [
      { id: 'bg', label: 'Bank Guarantee', icon: ShieldCheck, path: '/bg' },
    ]},
    { section: 'Reports', items: [
      { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
    ]},
    { section: 'System', items: [
      { id: 'activity', label: 'Activity Log', icon: History, path: '/activity' },
      { id: 'admin', label: 'Admin', icon: Settings, path: '/admin', adminOnly: true },
      { id: 'profile', label: 'Profile', icon: UserIcon, path: '/profile' },
    ]},
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[190] md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "fixed top-0 left-0 w-[var(--sidebar)] h-screen bg-[#0B1F3A] flex flex-col z-[200] transition-transform duration-300 shadow-[4px_0_24px_rgba(0,0,0,0.2)]",
        !isOpen && "-translate-x-full md:translate-x-0"
      )}>
        {/* Brand */}
        <div className="p-6 flex items-center gap-3 border-b border-white/5 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-[#00C9A7] grid place-items-center text-[#0B1F3A] shrink-0 shadow-[0_4px_12px_rgba(0,201,167,0.3)]">
            <Anchor size={20} />
          </div>
          <div>
            <h2 className="font-display text-sm font-extrabold text-white leading-tight tracking-tight">MbPA · MEED</h2>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mt-0.5">Management Portal</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide">
          {navItems.map((section, sIdx) => {
            const visibleItems = section.items.filter(item => !item.adminOnly || user.role === 'Admin');
            if (visibleItems.length === 0) return null;

            return (
              <div key={sIdx} className="mb-6 last:mb-0">
                <div className="px-6 mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/20">
                  {section.section}
                </div>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.id}
                      to={item.path}
                      onClick={() => window.innerWidth < 900 && onClose()}
                      className={({ isActive }) => cn(
                        "flex items-center gap-3 px-6 py-2.5 text-[13.5px] font-medium transition-all relative group",
                        isActive 
                          ? "text-white bg-[rgba(0,201,167,0.15)] before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-[#00C9A7]" 
                          : "text-white/50 hover:text-white hover:bg-white/5"
                      )}
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon size={16} className={cn("shrink-0 transition-colors", isActive ? "text-[#00C9A7]" : "text-white/30 group-hover:text-white/60")} />
                          <span>{item.label}</span>
                          {item.badge && (
                            <span className={cn(
                              "ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center",
                              item.badgeColor === 'amber' ? "bg-[#F5A623] text-white" : 
                              item.badgeColor === 'rose' ? "bg-[#E8445A] text-white animate-pulse" :
                              "bg-[#3B9EDA] text-white"
                            )}>
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User Chip */}
        <div className="p-4 border-t border-white/5 shrink-0">
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl transition-all hover:bg-white/10 group">
            <div className="w-9 h-9 rounded-xl bg-[#F5A623] grid place-items-center text-sm font-bold text-white shrink-0 shadow-lg shadow-amber-500/20">
              {user.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-white text-[13px] font-bold truncate tracking-tight">{user.name || 'User'}</h4>
              <p className="text-white/40 text-[10px] font-medium truncate uppercase tracking-wider">
                {user.role} · {user.section || user.division}
              </p>
            </div>
            <button 
              onClick={onLogout}
              className="text-white/20 hover:text-[#E8445A] transition-colors p-1.5 shrink-0"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
