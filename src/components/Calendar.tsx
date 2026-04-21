import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isToday,
  addMonths, 
  subMonths, 
  startOfWeek, 
  endOfWeek,
  isSameMonth 
} from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface CalendarEvent {
  id: string;
  date: Date;
  title: string;
  type: 'bg_expiry' | 'bid_deadline' | 'bid_opening' | 'tender_float' | 'scheduled_completion' | 'dlp_end' | 'work_order' | 'fc_date' | 'ca_date' | 'award_tc' | 'price_bid_tc';
  severity: 'critical' | 'warning' | 'info';
  module: string;
  subtitle?: string;
}

const EVENT_COLORS = {
  bg_expiry: { dot: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700 border-rose-200', label: 'BG Expiry' },
  bid_deadline: { dot: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Bid Deadline' },
  bid_opening: { dot: 'bg-sky-500', badge: 'bg-sky-50 text-sky-700 border-sky-200', label: 'Bid Opening' },
  tender_float: { dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Tender Float' },
  scheduled_completion: { dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Scheduled Completion' },
  dlp_end: { dot: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700 border-orange-200', label: 'DLP End' },
  work_order: { dot: 'bg-teal-500', badge: 'bg-teal-50 text-teal-700 border-teal-200', label: 'Work Order' },
  fc_date: { dot: 'bg-purple-500', badge: 'bg-purple-50 text-purple-700 border-purple-200', label: 'FC Date' },
  ca_date: { dot: 'bg-indigo-500', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', label: 'CA Approval' },
  award_tc: { dot: 'bg-green-500', badge: 'bg-green-50 text-green-700 border-green-200', label: 'Award TC' },
  price_bid_tc: { dot: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700 border-violet-200', label: 'Price Bid TC' },
};

export default function Calendar() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<CalendarEvent[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([
    'bg_expiry', 'bid_deadline', 'bid_opening', 'tender_float',
    'scheduled_completion', 'dlp_end', 'work_order', 'fc_date',
    'ca_date', 'award_tc', 'price_bid_tc'
  ]);

  const fetchEvents = async () => {
    setLoading(true);
    const allEvents: CalendarEvent[] = [];
    
    try {
      // BG Expiry
      const { data: bgs } = await supabase
        .from('bg_tracker')
        .select('bg_id, bg_number, agency_name, expiry_date, extended_expiry_date, bg_status')
        .neq('bg_status', 'Released');
      
      (bgs || []).forEach(bg => {
        const d = bg.extended_expiry_date || bg.expiry_date;
        if (!d) return;
        allEvents.push({
          id: bg.bg_id,
          date: new Date(d),
          title: `BG: ${bg.bg_number}`,
          subtitle: bg.agency_name,
          type: 'bg_expiry',
          severity: 'critical',
          module: '/bg'
        });
      });

      // Tender events
      const { data: tenders } = await supabase
        .from('tender')
        .select('tender_id, tender_no, name_of_work, bid_submission_deadline, bid_opening_date, tender_float_date, price_bid_tc_date, award_tc_date')
        .not('current_stage', 'in', '(Awarded,Cancelled)');
      
      (tenders || []).forEach(t => {
        const name = t.name_of_work?.substring(0, 35) || t.tender_no;
        if (t.tender_float_date) allEvents.push({
          id: t.tender_id + '_float',
          date: new Date(t.tender_float_date),
          title: `Float: ${t.tender_no}`,
          subtitle: name, type: 'tender_float',
          severity: 'info', module: '/tender'
        });
        if (t.bid_submission_deadline) allEvents.push({
          id: t.tender_id + '_bid',
          date: new Date(t.bid_submission_deadline),
          title: `Bid Deadline: ${t.tender_no}`,
          subtitle: name, type: 'bid_deadline',
          severity: 'critical', module: '/tender'
        });
        if (t.bid_opening_date) allEvents.push({
          id: t.tender_id + '_open',
          date: new Date(t.bid_opening_date),
          title: `Bid Opening: ${t.tender_no}`,
          subtitle: name, type: 'bid_opening',
          severity: 'warning', module: '/tender'
        });
        if (t.price_bid_tc_date) allEvents.push({
          id: t.tender_id + '_pbtc',
          date: new Date(t.price_bid_tc_date),
          title: `Price Bid TC: ${t.tender_no}`,
          subtitle: name, type: 'price_bid_tc',
          severity: 'info', module: '/tender'
        });
        if (t.award_tc_date) allEvents.push({
          id: t.tender_id + '_atc',
          date: new Date(t.award_tc_date),
          title: `Award TC: ${t.tender_no}`,
          subtitle: name, type: 'award_tc',
          severity: 'info', module: '/tender'
        });
      });

      // Under Approval events
      const { data: approvals } = await supabase
        .from('under_approval')
        .select('approval_id, name_of_work, fc_date, ca_date')
        .not('current_stage', 'in', '(Tendered,Dropped)');
      
      (approvals || []).forEach(a => {
        const name = a.name_of_work?.substring(0, 35) || '';
        if (a.fc_date) allEvents.push({
          id: a.approval_id + '_fc',
          date: new Date(a.fc_date),
          title: 'FC Received',
          subtitle: name, type: 'fc_date',
          severity: 'info', module: '/approval'
        });
        if (a.ca_date) allEvents.push({
          id: a.approval_id + '_ca',
          date: new Date(a.ca_date),
          title: 'CA Approval',
          subtitle: name, type: 'ca_date',
          severity: 'info', module: '/approval'
        });
      });

      // Awarded Works events
      const { data: awarded } = await supabase
        .from('awarded_works')
        .select('awarded_id, name_of_work, work_order_date, scheduled_completion, dlp_end_date')
        .neq('overall_status', 'Completed');
      
      (awarded || []).forEach(w => {
        const name = w.name_of_work?.substring(0, 35) || '';
        if (w.work_order_date) allEvents.push({
          id: w.awarded_id + '_wo',
          date: new Date(w.work_order_date),
          title: 'Work Order',
          subtitle: name, type: 'work_order',
          severity: 'info', module: '/awarded'
        });
        if (w.scheduled_completion) allEvents.push({
          id: w.awarded_id + '_sc',
          date: new Date(w.scheduled_completion),
          title: 'Scheduled Completion',
          subtitle: name, type: 'scheduled_completion',
          severity: 'warning', module: '/awarded'
        });
        if (w.dlp_end_date) allEvents.push({
          id: w.awarded_id + '_dlp',
          date: new Date(w.dlp_end_date),
          title: 'DLP End',
          subtitle: name, type: 'dlp_end',
          severity: 'warning', module: '/awarded'
        });
      });

      setEvents(allEvents);
    } catch (err) {
      console.error('Calendar fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const getEventsForDay = (day: Date) => 
    events.filter(e => 
      isSameDay(e.date, day) && 
      activeFilters.includes(e.type)
    );

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--navy)]">
            Calendar
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            All upcoming deadlines across modules
          </p>
        </div>
        {loading && <Loader2 size={20} className="animate-spin text-[var(--teal)]" />}
      </div>

      {/* Legend / Filter chips */}
      <div className="bg-white rounded-2xl p-4 border border-[var(--border)] shadow-sm">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
          Filter by Type (click to toggle)
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(EVENT_COLORS).map(([type, config]) => (
            <button
              key={type}
              onClick={() => setActiveFilters(prev =>
                prev.includes(type) 
                  ? prev.filter(f => f !== type)
                  : [...prev, type]
              )}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all",
                activeFilters.includes(type)
                  ? config.badge
                  : "bg-slate-50 text-slate-300 border-slate-100"
              )}
            >
              <div className={cn("w-2 h-2 rounded-full", 
                activeFilters.includes(type) 
                  ? config.dot : 'bg-slate-200')} />
              {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Calendar */}
      <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
        
        {/* Month Navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <button 
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-slate-100 rounded-xl transition-all">
            <ChevronLeft size={18} className="text-slate-500" />
          </button>
          <h2 className="font-display text-lg font-bold text-[var(--navy)]">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-slate-100 rounded-xl transition-all">
            <ChevronRight size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
            <div key={d} className="py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {calDays.map((day, idx) => {
            const dayEvents = getEventsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);
            
            return (
              <div
                key={idx}
                onClick={() => {
                  setSelectedDate(day);
                  setSelectedEvents(dayEvents);
                }}
                className={cn(
                  "min-h-[100px] p-2 border-b border-r border-slate-50 cursor-pointer transition-all",
                  !isCurrentMonth && "bg-slate-50/50",
                  isTodayDate && "bg-teal-50/30",
                  isSelected && "bg-teal-50 ring-2 ring-inset ring-[var(--teal)]",
                  "hover:bg-slate-50"
                )}
              >
                {/* Day Number */}
                <div className={cn(
                  "w-7 h-7 flex items-center justify-center rounded-full text-[13px] font-bold mb-1.5 transition-all",
                  isTodayDate 
                    ? "bg-[var(--teal)] text-white" 
                    : isCurrentMonth 
                    ? "text-[var(--navy)]" 
                    : "text-slate-300"
                )}>
                  {format(day, 'd')}
                </div>
                
                {/* Events on this day (max 3 shown) */}
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map(ev => (
                    <div 
                      key={ev.id}
                      className={cn(
                        "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold truncate border",
                        EVENT_COLORS[ev.type as keyof typeof EVENT_COLORS]?.badge || 'bg-slate-50 text-slate-600'
                      )}
                    >
                      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                        EVENT_COLORS[ev.type as keyof typeof EVENT_COLORS]?.dot)} />
                      <span className="truncate">{ev.title}</span>
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[9px] font-bold text-slate-400 pl-1">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Side Panel */}
      {selectedDate && (
        <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[var(--navy)]">
              {format(selectedDate, 'EEEE, d MMMM yyyy')}
            </h3>
            <button 
              onClick={() => setSelectedDate(null)}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-all">
              <X size={16} className="text-slate-400" />
            </button>
          </div>
          
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-slate-400 italic py-4 text-center">
              No events on this date
            </p>
          ) : (
            <div className="space-y-3">
              {selectedEvents.map(ev => (
                <div
                  key={ev.id}
                  onClick={() => navigate(ev.module)}
                  className={cn(
                    "flex items-start gap-4 p-4 rounded-xl border cursor-pointer hover:shadow-md transition-all",
                    EVENT_COLORS[ev.type as keyof typeof EVENT_COLORS]?.badge || ''
                  )}
                >
                  <div className={cn(
                    "w-3 h-3 rounded-full mt-1 shrink-0",
                    EVENT_COLORS[ev.type as keyof typeof EVENT_COLORS]?.dot
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">{ev.title}</p>
                    {ev.subtitle && (
                      <p className="text-[11px] mt-0.5 opacity-70 truncate">
                        {ev.subtitle}
                      </p>
                    )}
                    <p className="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-50">
                      {EVENT_COLORS[ev.type as keyof typeof EVENT_COLORS]?.label} — Click to open module
                    </p>
                  </div>
                  <ChevronRight size={16} className="opacity-40 shrink-0 mt-0.5" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
