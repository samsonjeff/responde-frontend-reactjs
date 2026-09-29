import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
}

export default function DatePicker({ value, onChange, placeholder = 'Select date' }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [tempDate, setTempDate] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 12 }, (_, i) => currentYear - 6 + i);

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return (day + 6) % 7;
  };

  const toDateStr = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleDateClick = (day: number) => {
    setTempDate(toDateStr(viewDate.getFullYear(), viewDate.getMonth(), day));
  };

  const handleApply = () => {
    if (tempDate) onChange(tempDate);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setTempDate(null);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setTempDate(value || null);
    setIsOpen(false);
  };

  const handleOpen = () => {
    setIsOpen(true);
    if (value) {
      const [y, m] = value.split('-').map(Number);
      setViewDate(new Date(y, m - 1, 1));
    } else {
      setViewDate(new Date());
    }
    setTempDate(value || null);
  };

  const formatDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/${y}`;
  };

  const renderCalendar = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const cells = [];

    // Previous month filler days
    const prevDays = getDaysInMonth(year, month - 1);
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push(
        <div key={`prev-${i}`} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-xs sm:text-sm text-slate-300 dark:text-slate-600 select-none">
          {prevDays - i}
        </div>
      );
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = toDateStr(year, month, day);
      const isSelected = tempDate === dateStr || (!tempDate && value === dateStr);
      const todayStr = toDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
      const isToday = dateStr === todayStr;

      cells.push(
        <button
          key={day}
          type="button"
          onClick={() => handleDateClick(day)}
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs sm:text-sm flex items-center justify-center transition-colors
            ${isSelected
              ? 'bg-blue-600 dark:bg-blue-500 text-white font-medium shadow-sm'
              : isToday
                ? 'text-blue-600 dark:text-blue-400 font-semibold border border-blue-200 dark:border-blue-500/40 hover:bg-blue-50 dark:hover:bg-blue-950/50'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
        >
          {day}
        </button>
      );
    }

    // Next month filler days
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push(
        <div key={`next-${i}`} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-xs sm:text-sm text-slate-300 dark:text-slate-600 select-none">
          {i}
        </div>
      );
    }

    return cells;
  };

  return (
    <div ref={containerRef} className={`relative ${isOpen ? 'z-50' : 'z-10'}`}>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs sm:text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors w-full sm:min-w-[150px] sm:w-auto cursor-pointer"
      >
        <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 dark:text-slate-400 shrink-0" />
        <span className={`truncate ${value ? 'text-slate-800 dark:text-slate-100 font-medium' : 'text-slate-400 dark:text-slate-400'}`}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        {value && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                handleClear();
              }
            }}
            className="ml-auto p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            title="Clear date"
            aria-label="Clear date"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 sm:left-auto sm:right-0 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl dark:shadow-2xl dark:shadow-black/50 p-3 sm:p-5 w-[280px] sm:w-[340px] max-w-[calc(100vw-2rem)] z-50">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous month"
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 min-w-20 sm:min-w-22.5 text-center">
                {months[viewDate.getMonth()]}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Next month"
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <select
              value={viewDate.getFullYear()}
              onChange={(e) => setViewDate(new Date(parseInt(e.target.value), viewDate.getMonth(), 1))}
              className="px-2 sm:px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
            >
              {years.map(y => (
                <option key={y} value={y} className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-y-1 gap-x-0.5 mb-1 sm:mb-2">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
              <div key={d} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-y-1 gap-x-0.5 mb-4 sm:mb-5">
            {renderCalendar()}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-slate-100 dark:border-slate-700/80">
            <button
              type="button"
              onClick={handleClear}
              className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer"
            >
              Clear
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}