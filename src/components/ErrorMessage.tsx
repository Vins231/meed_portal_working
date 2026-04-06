import { AlertCircle, ExternalLink } from 'lucide-react';

interface ErrorMessageProps {
  error: string;
  onRetry?: () => void;
}

export default function ErrorMessage({ error, onRetry }: ErrorMessageProps) {
  const isSupabaseError = error.includes("Supabase") || error.includes("environment variables");

  return (
    <div className="p-10 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 shadow-sm border border-rose-100">
        <AlertCircle size={32} />
      </div>
      
      <div className="space-y-2 max-w-md">
        <h3 className="text-lg font-bold text-[var(--navy)]">Something went wrong</h3>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          {error}
        </p>
      </div>

      {isSupabaseError ? (
        <div className="max-w-md w-full p-6 bg-rose-50/50 border border-rose-100 rounded-2xl text-sm text-rose-700 space-y-4 shadow-sm">
          <div className="font-semibold flex items-center gap-2 justify-center">
            <AlertCircle size={16} />
            Supabase is not configured
          </div>
          <p className="text-xs opacity-80">
            Please ensure you have set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.
          </p>
          <a 
            href="https://supabase.com/dashboard" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            Open Supabase Dashboard
            <ExternalLink size={14} />
          </a>
        </div>
      ) : (
        onRetry && (
          <button 
            onClick={onRetry}
            className="px-6 py-2.5 bg-[var(--teal)] text-white rounded-xl font-bold hover:bg-[var(--teal2)] transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            Try Again
          </button>
        )
      )}
    </div>
  );
}
