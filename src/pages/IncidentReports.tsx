import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Filter, X, Eye, ChevronLeft, ChevronRight,
  Clock, User, Phone, MessageSquare,
  CheckCircle2, AlertTriangle, RotateCcw, Send,
  ShieldCheck, FileText, AlertOctagon, MapPinned,
} from 'lucide-react';
import DatePicker from '../components/DatePicker';
import FilterDropdown from '../components/DropDown';
import { StaggerContainer, StaggerItem } from '../components/Stagger';
import PageLoader from '../components/PageLoader';
import PageTransition from '../components/Transition';

// ── Status Type ──
type ReportStatus = 'pending' | 'under_review' | 'verified' | 'rejected' | 'resolved';

// ── Type Definition ──
interface Report {
  id: string;
  barangay: string;
  type: string;
  urgency: string;
  source: string;
  time: string;
  status: ReportStatus;
  description: string;
  originalText: string;
  reporter: string;
  contact: string;
  coordinates: string;
  landmark: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  possibleDuplicateOf: string | null;
}

const sampleReports: Report[] = [
  { id: '011', barangay: 'Leynes', type: 'Search & Rescue', urgency: 'Low', source: 'Scraper', time: '10/24 10:57', status: 'pending', description: 'Missing person reported near the riverbank. Last seen wearing a red shirt.', originalText: 'May nawawala daw malapit sa ilog, naka pula daw ang damit.', reporter: 'Juan Dela Cruz', contact: '0912-345-6789', coordinates: '14.0951, 121.0203', landmark: 'Near riverbank', verifiedBy: null, verifiedAt: null, rejectionReason: null, possibleDuplicateOf: null },
  { id: '012', barangay: 'Poblacion', type: 'Medical', urgency: 'High', source: 'Bot', time: '10/24 10:57', status: 'under_review', description: 'Elderly resident collapsed at the market. Needs immediate medical attention.', originalText: 'May matandang natumba sa palengke, kailangan ng tulong medikal.', reporter: 'Maria Santos', contact: '0918-234-5678', coordinates: '14.0923, 121.0187', landmark: 'Public market', verifiedBy: null, verifiedAt: null, rejectionReason: null, possibleDuplicateOf: null },
  { id: '013', barangay: 'Leynes', type: 'Food & Water', urgency: 'Low', source: 'Scraper', time: '10/24 10:57', status: 'verified', description: 'Request for water supply delivery due to pipe maintenance.', originalText: 'Kailangan ng tubig dito, sira daw ang tubo.', reporter: 'Pedro Reyes', contact: '0917-876-5432', coordinates: '14.0945, 121.0210', landmark: 'Barangay hall', verifiedBy: 'Officer Cruz', verifiedAt: '10/24 11:15', rejectionReason: null, possibleDuplicateOf: null },
  { id: '014', barangay: 'Cawit', type: 'Infrastructure', urgency: 'Moderate', source: 'Scraper', time: '10/24 10:57', status: 'resolved', description: 'Road partially blocked by fallen tree after heavy rains.', originalText: 'May punong bumagsak sa daan, hindi makadaan ang mga sasakyan.', reporter: 'Ana Lim', contact: '0919-123-4567', coordinates: '14.0987, 121.0156', landmark: 'Main road Cawit', verifiedBy: 'Officer Cruz', verifiedAt: '10/24 11:00', rejectionReason: null, possibleDuplicateOf: null },
  { id: '015', barangay: 'Leynes', type: 'Search & Rescue', urgency: 'Low', source: 'Scraper', time: '10/24 10:57', status: 'rejected', description: 'Stranded dog on rooftop during flooding. Owner requesting assistance.', originalText: 'May aso na stranded sa bubong, tulungan nyo po.', reporter: 'Carlos Tan', contact: '0915-987-6543', coordinates: '14.0934, 121.0221', landmark: 'Rooftop', verifiedBy: null, verifiedAt: null, rejectionReason: 'not_disaster_related', possibleDuplicateOf: null },
  { id: '016', barangay: 'San Isidro', type: 'Medical', urgency: 'Low', source: 'Bot', time: '10/24 10:57', status: 'pending', description: 'Child with high fever, parents requesting transport to health center.', originalText: 'Anak ko may lagnat, paabot po sa health center.', reporter: 'Elena Cruz', contact: '0916-456-7890', coordinates: '14.0912, 121.0254', landmark: 'Health center', verifiedBy: null, verifiedAt: null, rejectionReason: null, possibleDuplicateOf: null },
  { id: '017', barangay: 'Leynes', type: 'Search & Rescue', urgency: 'Low', source: 'Scraper', time: '10/24 10:57', status: 'pending', description: 'Boat capsized near the shore. Two fishermen accounted for, one missing.', originalText: 'May bumagsak na bangka, may nawawalang isda.', reporter: 'Ramon Garcia', contact: '0913-222-3333', coordinates: '14.0967, 121.0198', landmark: 'Shoreline', verifiedBy: null, verifiedAt: null, rejectionReason: null, possibleDuplicateOf: '011' },
  { id: '018', barangay: 'Leynes', type: 'Food & Water', urgency: 'Low', source: 'Bot', time: '10/24 10:57', status: 'under_review', description: 'Relief goods distribution needed for 15 families affected by flash flood.', originalText: 'Kailangan ng relief goods para sa 15 pamilya.', reporter: 'Liza Mendoza', contact: '0914-555-6666', coordinates: '14.0941, 121.0234', landmark: 'Evacuation center', verifiedBy: null, verifiedAt: null, rejectionReason: null, possibleDuplicateOf: null },
  { id: '019', barangay: 'Banga', type: 'Medical', urgency: 'High', source: 'Bot', time: '10/24 11:15', status: 'verified', description: 'Pregnant woman in labor needing immediate transport to hospital.', originalText: 'Manganganak na po, kailangan ng ambulansya papuntang ospital.', reporter: 'Josefina Reyes', contact: '0920-111-2222', coordinates: '14.0891, 121.0284', landmark: 'Banga health center', verifiedBy: 'Officer Samson', verifiedAt: '10/24 11:20', rejectionReason: null, possibleDuplicateOf: null },
  { id: '020', barangay: 'Banadero', type: 'Infrastructure', urgency: 'High', source: 'Scraper', time: '10/24 11:30', status: 'pending', description: 'Bridge collapsed due to heavy rainfall. Alternative route needed.', originalText: 'Bumagsak ang tulay, kailangan ng ibang daanan.', reporter: 'Miguel Santos', contact: '0921-333-4444', coordinates: '14.1012, 121.0123', landmark: 'Banadero bridge', verifiedBy: null, verifiedAt: null, rejectionReason: null, possibleDuplicateOf: null },
  { id: '021', barangay: 'Sampaloc', type: 'Search & Rescue', urgency: 'Moderate', source: 'Bot', time: '10/24 11:45', status: 'under_review', description: 'Family trapped on second floor due to flash flooding.', originalText: 'May pamilyang nakaipit sa second floor, baha na po.', reporter: 'Carmen Villanueva', contact: '0922-555-6666', coordinates: '14.0876, 121.0312', landmark: 'Residential area', verifiedBy: null, verifiedAt: null, rejectionReason: null, possibleDuplicateOf: null },
  { id: '022', barangay: 'Poblacion', type: 'Food & Water', urgency: 'Moderate', source: 'Scraper', time: '10/24 12:00', status: 'verified', description: 'Evacuation center needs 50 food packs and clean drinking water.', originalText: 'Kailangan ng pagkain at tubig sa evacuation center, 50 pamilya.', reporter: 'Antonio dela Cruz', contact: '0923-777-8888', coordinates: '14.0925, 121.0190', landmark: 'Poblacion gym', verifiedBy: 'Officer Cruz', verifiedAt: '10/24 12:10', rejectionReason: null, possibleDuplicateOf: null },
  { id: '023', barangay: 'Banga', type: 'Search & Rescue', urgency: 'Moderate', source: 'Scraper', time: '10/24 12:15', status: 'rejected', description: 'Trapped residents on rooftop after sudden rise in water level.', originalText: 'Nakaipit sa bubong, tumataas na ang tubig.', reporter: 'Rodelio Cruz', contact: '0924-888-9999', coordinates: '14.0885, 121.0295', landmark: 'Rooftop', verifiedBy: null, verifiedAt: null, rejectionReason: 'duplicate', possibleDuplicateOf: '021' },
  { id: '024', barangay: 'Banadero', type: 'Medical', urgency: 'Low', source: 'Bot', time: '10/24 12:30', status: 'resolved', description: 'Senior citizen with hypertension needs maintenance medication.', originalText: 'Matandang may high blood, kailangan ng gamot.', reporter: 'Lourdes Reyes', contact: '0925-111-2223', coordinates: '14.1005, 121.0135', landmark: 'Barangay health station', verifiedBy: 'Officer Samson', verifiedAt: '10/24 12:35', rejectionReason: null, possibleDuplicateOf: null },
  { id: '025', barangay: 'Sampaloc', type: 'Infrastructure', urgency: 'High', source: 'Scraper', time: '10/24 12:45', status: 'pending', description: 'Power lines down near elementary school. Area needs immediate clearing.', originalText: 'May poste ng kuryenteng bumagsak malapit sa school.', reporter: 'Fernando Lim', contact: '0926-444-5555', coordinates: '14.0865, 121.0325', landmark: 'Sampaloc elementary', verifiedBy: null, verifiedAt: null, rejectionReason: null, possibleDuplicateOf: null },
  { id: '026', barangay: 'Poblacion', type: 'Search & Rescue', urgency: 'High', source: 'Bot', time: '10/24 13:00', status: 'verified', description: 'Vehicle swept away by flash flood near the bridge. Driver still inside.', originalText: 'May sasakyang inanod, may tao pa loob, kailangan ng rescue.', reporter: 'Gloria Santos', contact: '0927-666-7777', coordinates: '14.0915, 121.0205', landmark: 'Poblacion bridge', verifiedBy: 'Officer Cruz', verifiedAt: '10/24 13:05', rejectionReason: null, possibleDuplicateOf: null },
  { id: '027', barangay: 'Cawit', type: 'Food & Water', urgency: 'Low', source: 'Scraper', time: '10/24 13:15', status: 'pending', description: 'Barangay hall requesting additional water containers for evacuation center.', originalText: 'Kailangan ng lagayan ng tubig sa evacuation.', reporter: 'Ricardo Tan', contact: '0928-888-9990', coordinates: '14.0995, 121.0145', landmark: 'Cawit barangay hall', verifiedBy: null, verifiedAt: null, rejectionReason: null, possibleDuplicateOf: null },
  { id: '028', barangay: 'San Isidro', type: 'Infrastructure', urgency: 'Moderate', source: 'Bot', time: '10/24 13:30', status: 'under_review', description: 'Barangay road eroded after continuous rain. Motorcycles can no longer pass.', originalText: 'Nasira ang daan, hindi na makadaan ang motor.', reporter: 'Marites Garcia', contact: '0929-000-1111', coordinates: '14.0905, 121.0265', landmark: 'San Isidro road', verifiedBy: null, verifiedAt: null, rejectionReason: null, possibleDuplicateOf: null },
  { id: '029', barangay: 'Leynes', type: 'Medical', urgency: 'High', source: 'Scraper', time: '10/24 13:45', status: 'pending', description: 'Multiple residents showing symptoms of leptospirosis after wading through floodwater.', originalText: 'Maraming may sakit sa leptospirosis, lumusong sa baha.', reporter: 'Dr. Emmanuel Cruz', contact: '0930-222-3334', coordinates: '14.0955, 121.0215', landmark: 'Leynes clinic', verifiedBy: null, verifiedAt: null, rejectionReason: null, possibleDuplicateOf: null },
  { id: '030', barangay: 'Banga', type: 'Food & Water', urgency: 'Moderate', source: 'Bot', time: '10/24 14:00', status: 'verified', description: '20 families in temporary shelter need hot meals and blankets.', originalText: '20 pamilya sa temporary shelter, kailangan ng pagkain at kumot.', reporter: 'Helena Mendoza', contact: '0931-444-5556', coordinates: '14.0895, 121.0275', landmark: 'Banga shelter', verifiedBy: 'Officer Samson', verifiedAt: '10/24 14:10', rejectionReason: null, possibleDuplicateOf: null },
  { id: '031', barangay: 'Banadero', type: 'Search & Rescue', urgency: 'Low', source: 'Scraper', time: '10/24 14:15', status: 'rejected', description: 'Livestock stranded in flooded pasture.', originalText: 'Naiwan ang mga hayop sa baha, tulungan nyo po.', reporter: 'Domingo Reyes', contact: '0932-666-7778', coordinates: '14.1025, 121.0115', landmark: 'Pasture', verifiedBy: null, verifiedAt: null, rejectionReason: 'not_disaster_related', possibleDuplicateOf: null },
  { id: '032', barangay: 'Sampaloc', type: 'Medical', urgency: 'Moderate', source: 'Bot', time: '10/24 14:30', status: 'resolved', description: 'Child with asthma attack, inhaler supply depleted.', originalText: 'Anak ko hinika, wala nang inhaler.', reporter: 'Cecilia Villanueva', contact: '0933-888-9991', coordinates: '14.0875, 121.0305', landmark: 'Sampaloc health center', verifiedBy: 'Officer Cruz', verifiedAt: '10/24 14:40', rejectionReason: null, possibleDuplicateOf: null },
  { id: '033', barangay: 'Poblacion', type: 'Infrastructure', urgency: 'Low', source: 'Scraper', time: '10/24 14:45', status: 'pending', description: 'Drainage system clogged with debris causing minor flooding.', originalText: 'Barado ang kanal, bumabaha sa kalsada.', reporter: 'Alberto dela Cruz', contact: '0934-000-1112', coordinates: '14.0935, 121.0185', landmark: 'Main street', verifiedBy: null, verifiedAt: null, rejectionReason: null, possibleDuplicateOf: null },
  { id: '034', barangay: 'Cawit', type: 'Search & Rescue', urgency: 'High', source: 'Bot', time: '10/24 15:00', status: 'under_review', description: 'Landslide reported near hillside residences. Three houses affected.', originalText: 'May landslide, tatlong bahay naapektuhan.', reporter: 'Patricia Lim', contact: '0935-222-3335', coordinates: '14.0975, 121.0165', landmark: 'Hillside Cawit', verifiedBy: null, verifiedAt: null, rejectionReason: null, possibleDuplicateOf: null },
  { id: '035', barangay: 'San Isidro', type: 'Food & Water', urgency: 'Low', source: 'Scraper', time: '10/24 15:15', status: 'pending', description: 'Request for hygiene kits and potable water for 30 families.', originalText: 'Kailangan ng hygiene kits at tubig para sa 30 pamilya.', reporter: 'Roberto Garcia', contact: '0936-444-5557', coordinates: '14.0925, 121.0245', landmark: 'San Isidro tent area', verifiedBy: null, verifiedAt: null, rejectionReason: null, possibleDuplicateOf: null },
];

// ── Apple Design Spring Physics & Ease curves ──
const APPLE_SPRING = { type: 'spring', stiffness: 340, damping: 34, mass: 0.8 } as const;
const APPLE_SLIDE_SPRING = { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 } as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

// ── Animation presets (Apple HIG & Emil Kowalski craft bar) ──
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.98, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 10 },
};

// ── Bulk bar: hardware-accelerated transform + opacity only ──
const barActionVariants = {
  hidden: { opacity: 0, y: -8, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.98 },
};

// ── Shake animation for validation errors ──
export const shakeVariants = {
  shake: {
    x: [0, -6, 6, -6, 6, -3, 3, 0],
    transition: { duration: 0.4, ease: 'easeInOut' },
  },
};

// ── Toast Type ──
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

// ── Pagination Component (Apple Pager Style) ──
function Pagination({ currentPage, totalPages, onPageChange }: { currentPage: number; totalPages: number; onPageChange: (page: number) => void }) {
  const getPages = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages - 1, totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, 2, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1.5 py-3 shrink-0">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 rounded-xl hover:bg-slate-100/70 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all bg-white/80 dark:bg-slate-800/80 backdrop-blur-md active:scale-[0.96] shadow-2xs"
      >
        <ChevronLeft className="w-3.5 h-3.5" /> Previous
      </button>

      <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 backdrop-blur-md">
        {getPages().map((page, i) =>
          page === '...' ? (
            <span key={`dots-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">...</span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page as number)}
              className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-semibold transition-all active:scale-[0.94] ${currentPage === page
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              {page}
            </button>
          )
        )}
      </div>

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 rounded-xl hover:bg-slate-100/70 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all bg-white/80 dark:bg-slate-800/80 backdrop-blur-md active:scale-[0.96] shadow-2xs"
      >
        Next <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Toast Item Component (Apple Floating Notification) ──
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icon = toast.type === 'success'
    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    : toast.type === 'error'
      ? <AlertOctagon className="w-4 h-4 text-red-500" />
      : <AlertTriangle className="w-4 h-4 text-blue-500" />;

  const borderTint = toast.type === 'success'
    ? 'border-emerald-500/20'
    : toast.type === 'error'
      ? 'border-red-500/20'
      : 'border-blue-500/20';

  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.96 }}
      transition={APPLE_SPRING}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${borderTint} shadow-[0_10px_30px_rgba(0,0,0,0.12)] bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl min-w-70 max-w-95`}
    >
      {icon}
      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 flex-1 leading-snug">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-90"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

export default function IncidentReports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>(sampleReports);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<ReportStatus>('under_review');
  const [reviewingReport, setReviewingReport] = useState<Report | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 280);
    return () => clearTimeout(timer);
  }, []);

  // ── Toast State ──
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useState(0);
  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = ++toastIdRef[0];
    setToasts(prev => [...prev, { id, message, type }]);
  };
  const dismissToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Filters
  const [filterBarangay, setFilterBarangay] = useState('All Barangays');
  const [filterType, setFilterType] = useState('All Types');
  const [filterUrgency, setFilterUrgency] = useState('All Urgency');

  // Edit form state inside modal
  const [editForm, setEditForm] = useState<Partial<Report>>({});
  const [checklist, setChecklist] = useState({
    barangayCorrect: false,
    typeAccurate: false,
    locationReal: false,
    notDuplicate: false,
    urgencyAppropriate: false,
  });
  const [showRejectPanel, setShowRejectPanel] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // ── Validation State ──
  const [coordError, setCoordError] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const itemsPerPage = 10;

  const tabs = [
    { key: 'under_review' as const, label: 'Under Review', count: reports.filter(r => r.status === 'under_review').length },
    { key: 'verified' as const, label: 'Verified', count: reports.filter(r => r.status === 'verified').length },
    { key: 'resolved' as const, label: 'Resolved', count: reports.filter(r => r.status === 'resolved').length },
    { key: 'rejected' as const, label: 'Rejected', count: reports.filter(r => r.status === 'rejected').length },
  ];

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [activeTab, filterBarangay, filterType, filterUrgency]);

  const openReview = (report: Report) => {
    setReviewingReport(report);
    setEditForm({ ...report });
    setChecklist({
      barangayCorrect: false,
      typeAccurate: false,
      locationReal: false,
      notDuplicate: false,
      urgencyAppropriate: false,
    });
    setShowRejectPanel(false);
    setRejectReason('');
    setCoordError(false);
    if (report.status === 'pending') {
      setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: 'under_review' } : r));
    }
  };

  const closeReview = () => {
    setReviewingReport(null);
    setEditForm({});
    setShowRejectPanel(false);
    setCoordError(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const visibleIds = paginatedReports.map(r => r.id);
    const allSelected = visibleIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...visibleIds])]);
    }
  };

  const validateCoordinates = (coords: string): boolean => {
    const pattern = /^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/;
    return pattern.test(coords.trim());
  };

  const formatCoordinates = (value: string): string => {
    return value.replace(/[^0-9.,\-\s]/g, '');
  };

  const handleSaveDraft = () => {
    if (!reviewingReport || !editForm) return;
    setReports(prev => prev.map(r => r.id === reviewingReport.id ? { ...r, ...editForm } as Report : r));
    showToast(`Report #${reviewingReport.id} draft saved`, 'info');
    closeReview();
  };

  const handleVerify = () => {
    if (!reviewingReport || !editForm) return;
    const coords = editForm.coordinates || '';
    if (!validateCoordinates(coords)) {
      setCoordError(true);
      setShakeKey(prev => prev + 1);
      showToast('Invalid coordinates format. Use: lat, lng', 'error');
      return;
    }
    setCoordError(false);
    const now = new Date().toLocaleString('en-US', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    setReports(prev => prev.map(r => r.id === reviewingReport.id ? {
      ...r,
      ...editForm,
      status: 'verified',
      verifiedBy: 'Current Officer',
      verifiedAt: now,
      rejectionReason: null,
    } as Report : r));
    showToast(`Report #${reviewingReport.id} verified and plotted on map`, 'success');
    closeReview();
  };

  const handleResolve = () => {
    if (!reviewingReport) return;
    setReports(prev => prev.map(r => r.id === reviewingReport.id ? { ...r, status: 'resolved' } : r));
    showToast(`Report #${reviewingReport.id} marked as resolved`, 'success');
    closeReview();
  };

  const handleReject = () => {
    if (!reviewingReport || !rejectReason) return;
    setReports(prev => prev.map(r => r.id === reviewingReport.id ? {
      ...r,
      status: 'rejected',
      rejectionReason: rejectReason,
      verifiedBy: null,
      verifiedAt: null,
    } as Report : r));
    showToast(`Report #${reviewingReport.id} rejected: ${getRejectionLabel(rejectReason)}`, 'error');
    closeReview();
  };

  const handleRestore = (id: string) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'pending', rejectionReason: null } : r));
    setSelectedIds(prev => prev.filter(i => i !== id));
    showToast(`Report #${id} restored to pending`, 'info');
  };

  const handleBulkStartReview = () => {
    setReports(prev => prev.map(r => selectedIds.includes(r.id) && r.status === 'pending' ? { ...r, status: 'under_review' } : r));
    showToast(`${selectedIds.length} reports moved to Under Review`, 'info');
    setSelectedIds([]);
  };

  const handleBulkResolve = () => {
    setReports(prev => prev.map(r => selectedIds.includes(r.id) && r.status === 'verified' ? { ...r, status: 'resolved' } : r));
    showToast(`${selectedIds.length} reports marked as resolved`, 'success');
    setSelectedIds([]);
  };

  const handleBulkRestore = () => {
    setReports(prev => prev.map(r => selectedIds.includes(r.id) && r.status === 'rejected' ? { ...r, status: 'pending', rejectionReason: null } : r));
    showToast(`${selectedIds.length} reports restored to pending`, 'info');
    setSelectedIds([]);
  };

  const allChecklistChecked = Object.values(checklist).every(Boolean);

  const filteredReports = reports.filter(r => {
    if (r.status !== activeTab) return false;
    if (filterBarangay !== 'All Barangays' && r.barangay !== filterBarangay) return false;
    if (filterType !== 'All Types' && r.type !== filterType) return false;
    if (filterUrgency !== 'All Urgency' && r.urgency !== filterUrgency) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const paginatedReports = filteredReports.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'High':
        return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20';
      case 'Moderate':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
      case 'Low':
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20';
      default:
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Search & Rescue': return 'text-orange-600 dark:text-orange-400';
      case 'Medical': return 'text-emerald-600 dark:text-emerald-400';
      case 'Food & Water': return 'text-blue-600 dark:text-blue-400';
      case 'Infrastructure': return 'text-purple-600 dark:text-purple-400';
      default: return 'text-slate-600 dark:text-slate-400';
    }
  };

  const getStatusColor = (status: ReportStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
      case 'under_review':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
      case 'verified':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
      case 'resolved':
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
      case 'rejected':
        return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20';
    }
  };

  const getStatusLabel = (status: ReportStatus) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'under_review': return 'Under Review';
      case 'verified': return 'Verified';
      case 'resolved': return 'Resolved';
      case 'rejected': return 'Rejected';
    }
  };

  const getRejectionLabel = (reason: string | null) => {
    switch (reason) {
      case 'spam_or_fake': return 'Spam / Fake';
      case 'duplicate': return 'Duplicate';
      case 'outside_jurisdiction': return 'Outside Jurisdiction';
      case 'not_disaster_related': return 'Not Disaster-Related';
      case 'insufficient_info': return 'Insufficient Info';
      default: return reason || '';
    }
  };

  if (loading) return <PageLoader variant="incidents" />;

  return (
    <PageTransition>
      <div className="flex flex-col flex-1 min-h-0 gap-6 relative">
        {/* Toast Notifications */}
        <div className="fixed top-4 right-4 z-250 flex flex-col gap-2 pointer-events-none">
          <AnimatePresence>
            {toasts.map(toast => (
              <div key={toast.id} className="pointer-events-auto">
                <ToastItem toast={toast} onDismiss={dismissToast} />
              </div>
            ))}
          </AnimatePresence>
        </div>

        <StaggerContainer className="flex flex-col flex-1 min-h-0 gap-6">
          {/* Tabs — Apple macOS Segmented Control */}
          <StaggerItem>
            <div className="p-1 bg-slate-200/60 dark:bg-slate-800/60 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-white/5 inline-flex items-center gap-1 shrink-0 self-start shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors duration-150 flex items-center gap-2 select-none active:scale-[0.98] ${isActive
                      ? 'text-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTabPill"
                        transition={APPLE_SLIDE_SPRING}
                        className="absolute inset-0 bg-white dark:bg-slate-700/90 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] border border-black/4 dark:border-white/10"
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                    <span
                      className={`relative z-10 text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors ${isActive
                        ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                        : 'bg-slate-300/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400'
                        }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </StaggerItem>

          {/* Filter Bar & Bulk Selection */}
          <StaggerItem className="relative z-30 flex flex-col gap-3">
            {/* Filter Bar — Apple Frosted Glass Toolbar */}
            <div className="relative z-30 backdrop-blur-xl bg-white/80 dark:bg-[#111827]/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-4 shrink-0 border-t border-t-white/80 dark:border-t-white/10">
              <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 text-xs font-semibold shrink-0 uppercase tracking-wider">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                    <Filter className="w-3.5 h-3.5" />
                  </div>
                  <span>Filters</span>
                </div>

                <FilterDropdown
                  value={filterBarangay}
                  options={['All Barangays', 'Leynes', 'Poblacion', 'Cawit', 'San Isidro', 'Sampaloc', 'Banga', 'Banadero']}
                  onChange={setFilterBarangay}
                />

                <FilterDropdown
                  value={filterType}
                  options={['All Types', 'Search & Rescue', 'Medical', 'Food & Water', 'Infrastructure']}
                  onChange={setFilterType}
                />

                <FilterDropdown
                  value={filterUrgency}
                  options={['All Urgency', 'High', 'Moderate', 'Low']}
                  onChange={setFilterUrgency}
                />

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 lg:ml-auto w-full lg:w-auto">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">From:</span>
                    <DatePicker value={fromDate} onChange={setFromDate} placeholder="Select Date" />
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">To:</span>
                    <DatePicker value={toDate} onChange={setToDate} placeholder="Select Date" />
                  </div>
                </div>
              </div>
            </div>

            {/* Bulk Actions — Apple Floating Island */}
            <AnimatePresence mode="wait">
              {selectedIds.length > 0 && (
                <motion.div
                  key="bulk-actions"
                  variants={barActionVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={APPLE_SPRING}
                  className="relative z-20 flex items-center justify-between gap-3 bg-blue-50/90 dark:bg-blue-950/40 backdrop-blur-md border border-blue-200/80 dark:border-blue-800/60 rounded-2xl px-5 py-3 shrink-0 shadow-sm"
                >
                  <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                    {selectedIds.length} report{selectedIds.length > 1 ? 's' : ''} selected
                  </span>
                  <div className="flex items-center gap-2">
                    {activeTab === 'pending' && (
                      <button
                        type="button"
                        onClick={handleBulkStartReview}
                        className="px-3.5 py-1.5 text-xs font-semibold text-amber-700 bg-white dark:bg-slate-800 border border-amber-200/80 dark:border-amber-700/80 dark:text-amber-300 rounded-xl hover:bg-amber-50 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 active:scale-[0.96] shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" /> Start Review
                      </button>
                    )}
                    {activeTab === 'verified' && (
                      <button
                        type="button"
                        onClick={handleBulkResolve}
                        className="px-3.5 py-1.5 text-xs font-semibold text-emerald-700 bg-white dark:bg-slate-800 border border-emerald-200/80 dark:border-emerald-700/80 dark:text-emerald-300 rounded-xl hover:bg-emerald-50 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 active:scale-[0.96] shadow-2xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Resolved
                      </button>
                    )}
                    {activeTab === 'rejected' && (
                      <button
                        type="button"
                        onClick={handleBulkRestore}
                        className="px-3.5 py-1.5 text-xs font-semibold text-blue-700 bg-white dark:bg-slate-800 border border-blue-200/80 dark:border-blue-700/80 dark:text-blue-300 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 active:scale-[0.96] shadow-2xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore to Pending
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </StaggerItem>

          {/* Table — Apple Pro Data Table */}
          <StaggerItem className="flex flex-col flex-1 min-h-0">
            <div className="relative z-10 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col flex-1 min-h-0">
              <div className="overflow-auto flex-1">
                <table className="w-full min-w-200 text-sm text-left">
                  <thead className="bg-slate-50/90 dark:bg-slate-800/60 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-800 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3.5 w-10">
                        <input
                          type="checkbox"
                          checked={paginatedReports.length > 0 && paginatedReports.every(r => selectedIds.includes(r.id))}
                          onChange={toggleSelectAll}
                          className="rounded-md border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer transition-all"
                        />
                      </th>
                      <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">ID</th>
                      <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Barangay</th>
                      <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Type</th>
                      <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Urgency</th>
                      <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Status</th>
                      <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Source</th>
                      <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Time</th>
                      <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {paginatedReports.length === 0 ? (
                      <tr className="h-full">
                        <td colSpan={9} className="h-full px-4 text-center text-slate-400 dark:text-slate-500 align-middle">
                          <div className="flex flex-col items-center justify-center py-20">
                            <span className="text-sm font-medium">No reports found.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedReports.map((report, index) => (
                        <motion.tr
                          key={report.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.25,
                            ease: EASE_OUT,
                            delay: Math.min(index * 0.025, 0.2),
                          }}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors border-b border-slate-100 dark:border-slate-800/80 group ${selectedIds.includes(report.id)
                            ? 'bg-blue-50/40 dark:bg-blue-900/15'
                            : report.status === 'pending'
                              ? 'bg-blue-50/20 dark:bg-blue-900/5'
                              : ''
                            }`}
                        >
                          <td className="px-4 py-3.5">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(report.id)}
                              onChange={() => toggleSelect(report.id)}
                              className="rounded-md border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer transition-all"
                            />
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              {report.status === 'pending' && (
                                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 ring-4 ring-blue-500/20 animate-pulse" title="Pending" />
                              )}
                              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700">
                                #{report.id}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-slate-900 dark:text-slate-100 font-medium whitespace-nowrap">
                            {report.barangay}
                          </td>
                          <td className={`px-4 py-3.5 whitespace-nowrap font-medium text-xs ${getTypeColor(report.type)}`}>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {report.type}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getUrgencyColor(report.urgency)}`}>
                              {report.urgency}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(report.status)}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {getStatusLabel(report.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                              {report.source}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap font-mono">
                            {report.time}
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {(report.status === 'pending' || report.status === 'under_review') && (
                                <button
                                  type="button"
                                  onClick={() => openReview(report)}
                                  className="px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.96] shadow-2xs"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" /> Review
                                </button>
                              )}

                              {report.status === 'verified' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openReview(report)}
                                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.96] shadow-2xs"
                                  >
                                    <Eye className="w-3.5 h-3.5" /> View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/geospatial?focus=${report.id}`)}
                                    className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.96] shadow-2xs"
                                  >
                                    <MapPinned className="w-3.5 h-3.5" /> Map
                                  </button>
                                </>
                              )}

                              {(report.status === 'resolved' || report.status === 'rejected') && (
                                <button
                                  type="button"
                                  onClick={() => openReview(report)}
                                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.96] shadow-2xs"
                                >
                                  <Eye className="w-3.5 h-3.5" /> View
                                </button>
                              )}

                              {report.status === 'rejected' && (
                                <button
                                  type="button"
                                  onClick={() => handleRestore(report.id)}
                                  className="px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.96] shadow-2xs"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" /> Restore
                                </button>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </StaggerItem>

          <StaggerItem>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </StaggerItem>
        </StaggerContainer>

        {/* Review & Verify Modal — Apple macOS Pro Sheet */}
        <AnimatePresence>
          {reviewingReport && editForm && (
            <motion.div
              key="review-modal-backdrop"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-200 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-md"
              onClick={closeReview}
            >
              <motion.div
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={APPLE_SPRING}
                className="bg-white/95 dark:bg-[#111827]/95 backdrop-blur-2xl rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col transform-gpu will-change-transform"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-md shrink-0 rounded-t-3xl z-10">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                      #{reviewingReport.id}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(reviewingReport.status)}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {getStatusLabel(reviewingReport.status)}
                    </span>
                    {reviewingReport.possibleDuplicateOf && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                        <AlertTriangle className="w-3 h-3" /> Duplicate #{reviewingReport.possibleDuplicateOf}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={closeReview}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all active:scale-90"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-6 overflow-y-auto" style={{ maxHeight: 'calc(88vh - 140px)' }}>
                  <StaggerContainer className="space-y-6">
                    <StaggerItem>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* LEFT: Original Report */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            <FileText className="w-3.5 h-3.5" /> Original Report
                          </div>

                          <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl p-4.5 border border-slate-200/60 dark:border-slate-700/60 space-y-3.5">
                            <p className="text-sm text-slate-700 dark:text-slate-200 italic leading-relaxed">
                              &quot;{reviewingReport.originalText}&quot;
                            </p>
                            <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 grid grid-cols-2 gap-2.5 text-xs">
                              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                <span className="truncate">{reviewingReport.reporter}</span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                <Phone className="w-3.5 h-3.5 text-slate-400" />
                                <span className="truncate">{reviewingReport.contact}</span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                                <span className="truncate">{reviewingReport.source}</span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span className="truncate">{reviewingReport.time}</span>
                              </div>
                            </div>
                          </div>

                          {reviewingReport.verifiedBy && (
                            <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
                              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Verified by {reviewingReport.verifiedBy} at {reviewingReport.verifiedAt}
                              </p>
                            </div>
                          )}

                          {reviewingReport.rejectionReason && (
                            <div className="bg-rose-500/10 rounded-xl p-3 border border-rose-500/20">
                              <p className="text-xs text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1.5">
                                <AlertOctagon className="w-3.5 h-3.5" />
                                Rejected: {getRejectionLabel(reviewingReport.rejectionReason)}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* RIGHT: Officer Edit Form */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            <ShieldCheck className="w-3.5 h-3.5" /> Officer Review
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-1">Barangay</label>
                              <select
                                value={editForm.barangay || ''}
                                onChange={e => setEditForm(prev => ({ ...prev, barangay: e.target.value }))}
                                className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all"
                              >
                                {['Leynes', 'Poblacion', 'Cawit', 'San Isidro', 'Sampaloc', 'Banga', 'Banadero'].map(b => (
                                  <option key={b} value={b}>{b}</option>
                                ))}
                              </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-1">Type</label>
                                <select
                                  value={editForm.type || ''}
                                  onChange={e => setEditForm(prev => ({ ...prev, type: e.target.value }))}
                                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all"
                                >
                                  {['Search & Rescue', 'Medical', 'Food & Water', 'Infrastructure'].map(t => (
                                    <option key={t} value={t}>{t}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-1">Urgency</label>
                                <select
                                  value={editForm.urgency || ''}
                                  onChange={e => setEditForm(prev => ({ ...prev, urgency: e.target.value }))}
                                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all"
                                >
                                  {['High', 'Moderate', 'Low'].map(u => (
                                    <option key={u} value={u}>{u}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-1">Landmark</label>
                              <input
                                type="text"
                                value={editForm.landmark || ''}
                                onChange={e => setEditForm(prev => ({ ...prev, landmark: e.target.value }))}
                                className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all"
                                placeholder="e.g. Near 7-Eleven, in front of school..."
                              />
                            </div>

                            <motion.div
                              key={shakeKey}
                              animate={coordError ? { x: [0, -6, 6, -6, 6, -3, 3, 0] } : { x: 0 }}
                              transition={{ duration: 0.4, ease: 'easeInOut' }}
                            >
                              <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-1">
                                Coordinates (lat, lng)
                                {coordError && (
                                  <span className="ml-2 text-rose-500 font-normal lowercase">— invalid format</span>
                                )}
                              </label>
                              <input
                                type="text"
                                value={editForm.coordinates || ''}
                                onChange={e => {
                                  const formatted = formatCoordinates(e.target.value);
                                  setEditForm(prev => ({ ...prev, coordinates: formatted }));
                                  if (coordError && validateCoordinates(formatted)) {
                                    setCoordError(false);
                                  }
                                }}
                                className={`w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none font-mono transition-all ${coordError
                                  ? 'border-rose-400 dark:border-rose-600 bg-rose-50 dark:bg-rose-900/10'
                                  : 'border-slate-200 dark:border-slate-700'
                                  }`}
                                placeholder="14.0951, 121.0203"
                              />
                            </motion.div>
                          </div>
                        </div>
                      </div>
                    </StaggerItem>

                    {/* Verification Checklist — Apple Interactive Setting Cards */}
                    {(reviewingReport.status === 'pending' || reviewingReport.status === 'under_review') && (
                      <StaggerItem>
                        <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl p-4.5 border border-slate-200/60 dark:border-slate-700/60">
                          <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-blue-500" /> Verification Checklist
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {[
                              { key: 'barangayCorrect', label: 'Barangay & coordinates verified' },
                              { key: 'typeAccurate', label: 'Incident type is accurate' },
                              { key: 'locationReal', label: 'Location / landmark is real' },
                              { key: 'notDuplicate', label: 'Not a duplicate report' },
                              { key: 'urgencyAppropriate', label: 'Urgency level is appropriate' },
                            ].map((item) => (
                              <label
                                key={item.key}
                                className={`p-3 rounded-xl border transition-all flex items-center gap-3 cursor-pointer select-none active:scale-[0.98] ${checklist[item.key as keyof typeof checklist]
                                  ? 'bg-blue-50/70 dark:bg-blue-900/25 border-blue-200 dark:border-blue-800/80 text-blue-950 dark:text-blue-200'
                                  : 'bg-white/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-700/70 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                                  }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checklist[item.key as keyof typeof checklist]}
                                  onChange={(e) => setChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                                  className="rounded-md border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer"
                                />
                                <span className="text-xs font-medium leading-snug">
                                  {item.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </StaggerItem>
                    )}

                    {/* Rejection Panel */}
                    <AnimatePresence>
                      {showRejectPanel && (
                        <motion.div
                          initial={{ opacity: 0, scaleY: 0.95 }}
                          animate={{ opacity: 1, scaleY: 1 }}
                          exit={{ opacity: 0, scaleY: 0.95 }}
                          transition={{ duration: 0.2, ease: EASE_OUT }}
                          style={{ originY: 0 }}
                          className="bg-rose-500/10 rounded-2xl p-4.5 border border-rose-500/20 space-y-3"
                        >
                          <label className="block text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                            Rejection Reason
                          </label>
                          <select
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 outline-none"
                          >
                            <option value="">Select a reason...</option>
                            <option value="spam_or_fake">Spam / Fake Report</option>
                            <option value="duplicate">Duplicate Report</option>
                            <option value="outside_jurisdiction">Outside Talisay Jurisdiction</option>
                            <option value="not_disaster_related">Not Disaster-Related</option>
                            <option value="insufficient_info">Insufficient Information</option>
                          </select>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleReject}
                              disabled={!rejectReason}
                              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all active:scale-[0.97]"
                            >
                              Confirm Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowRejectPanel(false)}
                              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-[0.97]"
                            >
                              Cancel
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </StaggerContainer>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 backdrop-blur-md shrink-0 rounded-b-3xl">
                  <div className="flex items-center gap-2">
                    {(reviewingReport.status === 'pending' || reviewingReport.status === 'under_review') && (
                      <>
                        <button
                          type="button"
                          onClick={handleSaveDraft}
                          className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl transition-all active:scale-[0.97]"
                        >
                          Save Draft
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowRejectPanel(true)}
                          className="px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.97]"
                        >
                          <AlertOctagon className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    )}

                    {reviewingReport.status === 'verified' && (
                      <button
                        type="button"
                        onClick={handleResolve}
                        className="px-4 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.97]"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Resolved
                      </button>
                    )}

                    {reviewingReport.status === 'rejected' && (
                      <button
                        type="button"
                        onClick={() => {
                          setReports(prev => prev.map(r => r.id === reviewingReport.id ? { ...r, status: 'pending', rejectionReason: null } : r));
                          showToast(`Report #${reviewingReport.id} restored to pending`, 'info');
                          closeReview();
                        }}
                        className="px-4 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl transition-all flex items-center gap-1.5 active:scale-[0.97]"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore to Pending
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={closeReview}
                      className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl transition-all active:scale-[0.97]"
                    >
                      Close
                    </button>

                    {(reviewingReport.status === 'pending' || reviewingReport.status === 'under_review') && (
                      <button
                        type="button"
                        onClick={handleVerify}
                        disabled={!allChecklistChecked}
                        title={!allChecklistChecked ? 'Complete the checklist first' : ''}
                        className="px-5 py-2 text-xs font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-[0_2px_8px_rgba(0,113,227,0.25)] flex items-center gap-1.5 active:scale-[0.97]"
                      >
                        <Send className="w-3.5 h-3.5" /> Verify & Plot
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}