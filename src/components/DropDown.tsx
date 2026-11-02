import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

interface FilterDropdownProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  className?: string;
  labelPrefix?: string;
}

export default function FilterDropdown({ value, options, onChange, className }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const hide = () => setIsOpen(false);

  useEffect(() => {
    if (isOpen && toggleRef.current) {
      const rect = toggleRef.current.getBoundingClientRect();
      if (window.innerWidth - rect.left < 200) {
        setAlignRight(true);
      } else {
        setAlignRight(false);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        hide();
        toggleRef.current?.focus();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        toggleRef.current &&
        !toggleRef.current.contains(e.target as Node)
      ) {
        hide();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Scroll active item into view on open (only within the dropdown menu itself, avoiding ancestor scrolling)
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const activeEl = menuRef.current.querySelector('[aria-selected="true"]') as HTMLElement | null;
      if (activeEl) {
        const menu = menuRef.current;
        const top = activeEl.offsetTop - menu.offsetTop;
        menu.scrollTop = Math.max(0, top - menu.clientHeight / 2 + activeEl.clientHeight / 2);
      }
    }
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(prev => !prev);
  };

  const handleSelect = (option: string) => {
    onChange(option);
    hide();
  };

  const isCustomValue = useMemo(() => {
    if (!value) return false;
    const lowerVal = value.toLowerCase().trim();
    if (lowerVal.startsWith('all ') || lowerVal === 'all') return false;
    if (options && options.length > 0 && options[0].toLowerCase().trim() === lowerVal) return false;
    return true;
  }, [value, options]);

  return (
    <div className={`relative ${isOpen ? 'z-50' : 'z-10'}`}>
      <button
        ref={toggleRef}
        onClick={handleToggle}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={value}
        className={`group w-full md:w-auto px-3 py-1.5 sm:px-3 sm:py-2 text-xs font-medium rounded-xl flex items-center justify-between gap-2 cursor-pointer bg-white/90 dark:bg-slate-800/80 backdrop-blur-md border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-blue-400/80 dark:hover:border-blue-500/60 hover:bg-slate-50/90 dark:hover:bg-slate-700/80 hover:text-slate-900 dark:hover:text-white shadow-[0_1px_3px_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.9)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_14px_rgba(0,113,227,0.14)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-w-0 sm:min-w-32.5 ${className || ''}`}
      >
        <span className={isCustomValue ? "font-semibold text-slate-900 dark:text-white truncate" : "truncate"}>
          {value}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-400 group-hover:text-[#0071E3] dark:group-hover:text-sky-400 transition-all duration-150 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className={`dropdown-scroll absolute ${alignRight ? 'right-0' : 'left-0'} mt-1.5 p-1.5 min-w-full sm:min-w-[140px] max-w-[min(260px,calc(100vw-2rem))] max-h-44 sm:max-h-52 overflow-y-auto bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.14)] z-50 text-xs scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700`}
          role="listbox"
        >
          {options.map((option) => (
            <button
              key={option}
              onClick={() => handleSelect(option)}
              role="option"
              aria-selected={value === option}
              title={option}
              className={`w-full text-left px-3 py-1.5 sm:py-2 rounded-xl text-xs transition-all duration-150 cursor-pointer truncate ${value === option
                ? 'bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-sky-400 font-semibold'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
