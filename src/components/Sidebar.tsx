import { NavLink } from 'react-router-dom';
import { 
  Anchor, Gauge, Lightbulb, FileSignature, 
  FileText, Handshake, ShieldCheck, 
  BarChart3, History, Settings, LogOut, User as UserIcon,
  ChevronLeft, ChevronRight, CalendarDays
} from 'lucide-react';
import { User } from '../types';
import { cn } from '../lib/utils';
import { canDo } from '../lib/permissions';

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
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ user, onLogout, isOpen, onClose, collapsed, onToggle }: SidebarProps) {
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
      { id: 'calendar', label: 'Calendar', icon: CalendarDays, path: '/calendar' },
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

      <aside 
        className={cn(
          "fixed top-0 left-0 h-screen flex flex-col z-[200] transition-all duration-300 ease-in-out shadow-[4px_0_24px_rgba(0,0,0,0.2)]",
          collapsed ? "w-16" : "w-[268px]",
          !isOpen && "-translate-x-full md:translate-x-0"
        )}
        style={{
          background: 'var(--sidebar-gradient, var(--sidebar-bg))',
          backgroundSize: '100% 300%',
          animation: document.documentElement.getAttribute('data-theme') === 'midnight' 
            ? 'gradientShift 8s ease infinite' 
            : 'none'
        }}
      >
        {/* Brand */}
        <div className={cn(
          "p-6 flex items-center border-b border-white/5 shrink-0",
          collapsed ? "justify-center" : "gap-3"
        )}>
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-1 shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.2)] overflow-hidden">
            <img 
              src="/mbpa_logo.png" 
              alt="MbPA Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          {!collapsed && (
            <div className="animate-in fade-in duration-300">
              <h2 className="font-display text-sm font-extrabold text-white leading-tight tracking-tight">MbPA · MEED</h2>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mt-0.5">Management Portal</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide">
          {navItems.map((section, sIdx) => {
            const visibleItems = section.items.filter(item => {
              if (item.id === 'profile') return true;
              if (item.id === 'dashboard') return true;
              if (item.id === 'admin') {
                return user?.role === 'SuperAdmin' || 
                       user?.role === 'Admin';
              }
              const moduleMap: Record<string,string> = {
                planning: 'planning',
                approval: 'approval',
                tender: 'tender',
                awarded: 'awarded',
                bg: 'bg',
                reports: 'reports',
                calendar: 'calendar',
                activity: 'activity',
              };
              const mod = moduleMap[item.id];
              if (mod) return canDo.viewModule(user, mod);
              return true;
            });
            if (visibleItems.length === 0) return null;

            return (
              <div key={sIdx} className="mb-6 last:mb-0">
                {!collapsed ? (
                  <div className="px-6 mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/20 animate-in fade-in duration-300">
                    {section.section}
                  </div>
                ) : (
                  <div className="h-px bg-white/5 mx-4 mb-4" />
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.id}
                      to={item.path}
                      title={collapsed ? item.label : ""}
                      onClick={() => window.innerWidth < 900 && onClose()}
                      className={({ isActive }) => cn(
                        "flex items-center py-2.5 text-[13.5px] font-medium transition-all relative group",
                        collapsed ? "justify-center px-0" : "px-6 gap-3",
                        isActive 
                          ? "text-white bg-[var(--teal)]/15 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-[var(--teal)]" 
                          : "text-white/50 hover:text-white hover:bg-white/5"
                      )}
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon size={16} className={cn("shrink-0 transition-colors", isActive ? "text-[var(--teal)]" : "text-white/30 group-hover:text-white/60")} />
                          {!collapsed && <span className="animate-in fade-in duration-300">{item.label}</span>}
                          {item.badge && (
                            collapsed ? (
                              <span className={cn(
                                "absolute top-2 right-2 w-2 h-2 rounded-full",
                                item.badgeColor === 'amber' ? "bg-[var(--amber)]" : 
                                item.badgeColor === 'rose' ? "bg-[var(--rose)]" :
                                "bg-[var(--sky)]"
                              )} />
                            ) : (
                              <span className={cn(
                                "ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center animate-in fade-in duration-300",
                                item.badgeColor === 'amber' ? "bg-[var(--amber)] text-white" : 
                                item.badgeColor === 'rose' ? "bg-[var(--rose)] text-white animate-pulse" :
                                "bg-[var(--sky)] text-white"
                              )}>
                                {item.badge}
                              </span>
                            )
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

        {/* Toggle Button */}
        <button 
          onClick={onToggle}
          className="hidden md:flex items-center justify-center w-full h-10 bg-white/5 border-t border-white/5 text-white/30 hover:text-[var(--teal)] transition-colors"
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        {/* User Chip */}
        <div className="p-4 border-t border-white/5 shrink-0">
          <div className={cn(
            "flex items-center bg-white/5 rounded-2xl transition-all hover:bg-white/10 group",
            collapsed ? "justify-center p-2" : "p-3 gap-3"
          )}>
            <div className="w-9 h-9 rounded-xl bg-[var(--amber)] grid place-items-center text-sm font-bold text-white shrink-0 shadow-lg shadow-amber-500/20">
              {user.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0 animate-in fade-in duration-300">
                  <h4 className="text-white text-[13px] font-bold truncate tracking-tight">{user.name || 'User'}</h4>
                  <p className="text-white/40 text-[10px] font-medium truncate uppercase tracking-wider">
                    {user.role} · {user.section || user.division}
                  </p>
                </div>
                <button 
                  onClick={onLogout}
                  className="text-white/20 hover:text-[var(--rose)] transition-colors p-1.5 shrink-0"
                  title="Logout"
                >
                  <LogOut size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
