import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface FilterDropdownProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  className?: string;
}

export default function FilterDropdown({ value, options, onChange, className }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const hide = () => setIsOpen(false);

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

  // Scroll active item into view on open
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const activeEl = menuRef.current.querySelector('[aria-selected="true"]') as HTMLElement | null;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
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

  return (
    <div className={`relative ${isOpen ? 'z-50' : 'z-10'}`}>
      <button
        ref={toggleRef}
        onClick={handleToggle}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full lg:w-auto px-3 py-1.5 sm:px-3 sm:py-2 text-xs font-medium rounded-xl flex items-center justify-between gap-2 cursor-pointer bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-w-0 sm:min-w-32.5 ${className || ''}`}
      >
        <span className="truncate">{value}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="dropdown-scroll absolute left-0 mt-1.5 py-1 min-w-full sm:min-w-[140px] max-w-[min(260px,calc(100vw-2rem))] max-h-44 sm:max-h-52 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl shadow-xl z-50 text-xs scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700"
          role="listbox"
        >
          {options.map((option) => (
            <button
              key={option}
              onClick={() => handleSelect(option)}
              role="option"
              aria-selected={value === option}
              title={option}
              className={`w-full text-left px-3 py-1.5 sm:py-2 text-xs transition-colors cursor-pointer truncate ${value === option
                ? 'bg-slate-100 dark:bg-slate-600 text-slate-900 dark:text-white font-semibold'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
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