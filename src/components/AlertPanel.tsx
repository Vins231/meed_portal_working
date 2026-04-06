import { useEffect, useState } from 'react';
import { X, AlertCircle, AlertTriangle, Info, ArrowRight, Loader2, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { cn } from '../lib/utils';

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  path: string;
  date: string;
}

interface AlertPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AlertPanel({ isOpen, onClose }: AlertPanelProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
    }
  }, [isOpen]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const [awarded, bg] = await Promise.all([
        api.getAwardedRecords(),
        api.getBGRecords()
      ]);

      const newAlerts: Alert[] = [];

      // Awarded Works Alerts (Delayed)
      awarded.forEach(work => {
        if (work.overall_status === 'Delayed') {
          newAlerts.push({
            id: `work-${work.awarded_id}`,
            type: 'critical',
            title: 'Work Delayed',
            description: `${work.name_of_work} is currently behind schedule.`,
            path: '/awarded',
            date: new Date().toISOString()
          });
        }
      });

      // BG Alerts (Expiring soon)
      const today = new Date();
      const thirtyDays = new Date();
      thirtyDays.setDate(today.getDate() + 30);

      bg.forEach(record => {
        const expiry = new Date(record.expiry_date);
        if (record.bg_status !== 'Released' && expiry <= thirtyDays) {
          const isExpired = expiry < today;
          newAlerts.push({
            id: `bg-${record.bg_id}`,
            type: isExpired ? 'critical' : 'warning',
            title: isExpired ? 'BG Expired' : 'BG Expiring Soon',
            description: `BG No. ${record.bg_number} for ${record.remarks || 'Work'} ${isExpired ? 'has expired' : 'expires soon'}.`,
            path: '/bg',
            date: record.expiry_date
          });
        }
      });

      setAlerts(newAlerts.sort((a, b) => b.type === 'critical' ? 1 : -1));
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAlertClick = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[210] animate-[fadeIn_0.2s_ease]"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside className={cn(
        "fixed top-0 right-0 h-screen w-full max-w-[360px] bg-white shadow-2xl z-[220] transition-transform duration-300 ease-out flex flex-col",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-lg font-display font-bold text-[#0B1F3A]">Notifications</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">System alerts and updates</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200/50 flex items-center justify-center text-slate-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <Loader2 className="animate-spin" size={24} />
              <span className="text-xs font-bold uppercase tracking-widest">Fetching alerts...</span>
            </div>
          ) : alerts.length > 0 ? (
            alerts.map((alert) => (
              <div 
                key={alert.id}
                onClick={() => handleAlertClick(alert.path)}
                className={cn(
                  "p-4 rounded-2xl border transition-all cursor-pointer group hover:scale-[1.02] active:scale-[0.98]",
                  alert.type === 'critical' ? "bg-rose-50/50 border-rose-100 hover:border-rose-200" :
                  alert.type === 'warning' ? "bg-amber-50/50 border-amber-100 hover:border-amber-200" :
                  "bg-sky-50/50 border-sky-100 hover:border-sky-200"
                )}
              >
                <div className="flex gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    alert.type === 'critical' ? "bg-rose-100 text-rose-600" :
                    alert.type === 'warning' ? "bg-amber-100 text-amber-600" :
                    "bg-sky-100 text-sky-600"
                  )}>
                    {alert.type === 'critical' ? <AlertCircle size={16} /> :
                     alert.type === 'warning' ? <AlertTriangle size={16} /> :
                     <Info size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={cn(
                        "text-sm font-bold truncate",
                        alert.type === 'critical' ? "text-rose-900" :
                        alert.type === 'warning' ? "text-amber-900" :
                        "text-sky-900"
                      )}>
                        {alert.title}
                      </h3>
                      <ArrowRight size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                      {alert.description}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300 gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                <Bell className="opacity-20" size={32} />
              </div>
              <p className="text-sm font-medium">No new notifications</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/30">
          <button 
            onClick={onClose}
            className="w-full py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
          >
            Mark all as read
          </button>
        </div>
      </aside>
    </>
  );
}
