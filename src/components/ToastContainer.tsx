import { useState, useEffect } from 'react';
import { toastBus, ToastItem } from '../lib/toast';
import { CheckCircle2, XCircle, Info, 
  AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toastBus.subscribe((t) => {
      setToasts(prev => [...prev, t]);
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id));
      }, t.duration || 3000);
    });
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed top-20 right-4 z-[500] 
      flex flex-col gap-2 w-80 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={cn(
            "relative flex items-start gap-3 px-4 py-3",
            "rounded-2xl border shadow-lg overflow-hidden",
            "pointer-events-auto",
            "animate-in slide-in-from-right-4 duration-300",
            t.type === 'success' 
              ? "bg-white border-teal-200" :
            t.type === 'error'   
              ? "bg-white border-rose-200" :
            t.type === 'warning' 
              ? "bg-white border-amber-200" :
              "bg-white border-sky-200"
          )}
        >
          {/* Left color bar */}
          <div className={cn(
            "absolute left-0 top-0 bottom-0 w-1",
            t.type === 'success' ? "bg-[var(--teal)]" :
            t.type === 'error'   ? "bg-[var(--rose)]" :
            t.type === 'warning' ? "bg-[var(--amber)]" :
            "bg-[var(--sky)]"
          )} />

          {/* Icon */}
          <div className="shrink-0 mt-0.5 ml-1">
            {t.type === 'success' && 
              <CheckCircle2 size={16} 
                className="text-[var(--teal)]" />}
            {t.type === 'error' && 
              <XCircle size={16} 
                className="text-[var(--rose)]" />}
            {t.type === 'warning' && 
              <AlertTriangle size={16} 
                className="text-[var(--amber)]" />}
            {t.type === 'info' && 
              <Info size={16} 
                className="text-[var(--sky)]" />}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold 
              text-[var(--navy)] leading-snug">
              {t.title}
            </p>
            {t.message && (
              <p className="text-[11px] text-[var(--muted)] 
                font-medium mt-0.5 leading-snug">
                {t.message}
              </p>
            )}
          </div>

          {/* Shrinking progress bar at bottom */}
          <div className="absolute bottom-0 left-0 
            right-0 h-[2px] bg-slate-100">
            <div
              className={cn(
                "h-full",
                t.type === 'success' ? "bg-[var(--teal)]" :
                t.type === 'error'   ? "bg-[var(--rose)]" :
                t.type === 'warning' ? "bg-[var(--amber)]" :
                "bg-[var(--sky)]"
              )}
              style={{
                animation: `toastShrink ${t.duration || 3000}ms linear forwards`
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
