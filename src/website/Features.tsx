import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowRight,
  BarChart3,
  Building2,
  FileText,
  Layers,
  MonitorSmartphone,
  Radio,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import SplitText from '../components/SplitText';

gsap.registerPlugin(ScrollTrigger);

interface FeatureCard {
  id: string;
  badge: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  bgColor: string;
  borderColor: string;
  textColor: string;
  descColor: string;
  iconColor: string;
  badgeClass: string;
  ctaColor: string;
}

const features: FeatureCard[] = [
  {
    id: '01',
    badge: 'Incident Intake',
    title: 'Real-time Incident Reporting',
    description:
      'Residents can report emergencies instantly through our Messenger Bot or web scraper — every report is captured, logged, and queued for officer review in real time, ensuring nothing slips through the cracks.',
    icon: MonitorSmartphone,
    bgColor: 'bg-[#FDFBF7]',
    borderColor: 'border-[#E6E1D6]',
    textColor: 'text-[#1D1D1F]',
    descColor: 'text-[#515154]',
    iconColor: 'text-[#1D1D1F]',
    badgeClass: 'bg-[#EDE8DE] text-[#3A3835] border-[#DDD5C7]',
    ctaColor: 'text-[#1D1D1F] hover:text-black',
  },
  {
    id: '02',
    badge: 'Geospatial Radar',
    title: 'Geo-mapped Incident Plotting',
    description:
      'Every verified incident is automatically plotted on a live geospatial map of Talisay Batangas, giving response teams an instant visual overview of where emergencies are happening across all barangays.',
    icon: FileText,
    bgColor: 'bg-[#E65330]',
    borderColor: 'border-white/20',
    textColor: 'text-white',
    descColor: 'text-white/90',
    iconColor: 'text-white',
    badgeClass: 'bg-white/20 text-white border-white/25',
    ctaColor: 'text-white hover:text-white/80',
  },
  {
    id: '03',
    badge: 'AI Coordination',
    title: 'AI-assisted Bot Coordination',
    description:
      'Our intelligent Messenger Bot guides residents through structured emergency reporting, collects critical details like location and incident type, and forwards verified data directly to officers on duty.',
    icon: Building2,
    bgColor: 'bg-[#10B981]',
    borderColor: 'border-white/20',
    textColor: 'text-white',
    descColor: 'text-white/90',
    iconColor: 'text-white',
    badgeClass: 'bg-white/20 text-white border-white/25',
    ctaColor: 'text-white hover:text-white/80',
  },
  {
    id: '04',
    badge: 'Command & Control',
    title: 'Officer Verification Dashboard',
    description:
      'Barangay officers review, verify, and act on every incoming report through a dedicated dashboard — filtering by urgency, type, and barangay to prioritize response and coordinate dispatch efficiently.',
    icon: Layers,
    bgColor: 'bg-[#2563EB]',
    borderColor: 'border-white/20',
    textColor: 'text-white',
    descColor: 'text-white/90',
    iconColor: 'text-white',
    badgeClass: 'bg-white/20 text-white border-white/25',
    ctaColor: 'text-white hover:text-white/80',
  },
  {
    id: '05',
    badge: 'Municipal Reach',
    title: 'Multi-barangay Coverage',
    description:
      'RESPONDE covers all barangays of Talisay Batangas including Leynes, Poblacion, Miranda, Sampaloc, Cawit, Buco, and more — ensuring unified emergency coordination across the entire municipality.',
    icon: ShieldCheck,
    bgColor: 'bg-[#7C3AED]',
    borderColor: 'border-white/20',
    textColor: 'text-white',
    descColor: 'text-white/90',
    iconColor: 'text-white',
    badgeClass: 'bg-white/20 text-white border-white/25',
    ctaColor: 'text-white hover:text-white/80',
  },
  {
    id: '06',
    badge: 'Early Warning',
    title: 'Automated Web & Social Scraper',
    description:
      'Continuously sweeps community social channels, local feeds, and official weather advisories — detecting emerging emergencies, rising flood levels, and road blockages before 911 calls even register.',
    icon: Radio,
    bgColor: 'bg-[#0D9488]',
    borderColor: 'border-white/20',
    textColor: 'text-white',
    descColor: 'text-white/90',
    iconColor: 'text-white',
    badgeClass: 'bg-white/20 text-white border-white/25',
    ctaColor: 'text-white hover:text-white/80',
  },
  {
    id: '07',
    badge: 'Actionable Insights',
    title: 'Disaster Analytics & Heatmaps',
    description:
      'Aggregates historical incident data into actionable response heatmaps, trend forecasts, and post-disaster audits — empowering municipal leadership to pre-deploy resources before disaster strikes.',
    icon: BarChart3,
    bgColor: 'bg-[#0F172A]',
    borderColor: 'border-white/15',
    textColor: 'text-white',
    descColor: 'text-slate-300',
    iconColor: 'text-cyan-400',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/25',
    ctaColor: 'text-cyan-400 hover:text-cyan-300',
  },
];

// Card dimensions and gap — single source of truth for both CSS and GSAP math
const CARD_WIDTH = 320;  // px
const CARD_HEIGHT = 380; // px (calibrated so bottom CTA & border remain fully visible on all viewports)
const CARD_GAP = 56;     // px gap between every card (increased for more breathing room)

export default function Features() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;

    // Scroll the track left until the last card's right edge is at the viewport's right edge.
    // Computed dynamically so it works correctly on any screen size.
    const getEndX = () => -(track.scrollWidth - window.innerWidth + CARD_GAP);

    // Scroll distance = how far we need to drag the track, plus a small buffer
    const getScrollDistance = () => Math.abs(getEndX()) * 1.1;

    const tween = gsap.to(track, {
      x: getEndX,          // function ref — GSAP calls it on refresh too
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${getScrollDistance()}`,
        pin: true,
        scrub: 1.2,          // buttery lag tied to scroll velocity
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, []);

  const renderCard = (card: FeatureCard, key: string) => {
    const IconComponent = card.icon;
    return (
      <div
        key={key}
        className={`shrink-0 flex flex-col justify-between rounded-[22px] p-5 sm:p-5.5 border ${card.bgColor} ${card.textColor} ${card.borderColor} shadow-[0_16px_40px_-10px_rgba(0,0,0,0.22),0_4px_12px_rgba(0,0,0,0.08)]`}
        style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
      >
        {/* Top row: icon + badge + id */}
        <div className="flex items-start justify-between">
          <div className={card.iconColor}>
            <IconComponent className="w-8 h-8 stroke-[1.5]" />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border backdrop-blur-md shadow-sm ${card.badgeClass}`}
            >
              {card.badge}
            </span>
            <span className="text-[10px] font-mono font-bold opacity-60">
              {card.id}
            </span>
          </div>
        </div>

        {/* Body: title + description */}
        <div className="space-y-2 pt-1 flex-1 flex flex-col justify-center">
          <h3 className="text-lg sm:text-[19px] font-bold tracking-tight leading-snug">
            {card.title}
          </h3>
          <p className={`text-[12px] sm:text-[12.5px] leading-relaxed font-normal ${card.descColor}`}>
            {card.description}
          </p>
        </div>

        {/* Bottom CTA */}
        <div className="pt-2.5 border-t border-current/15">
          <a
            href="#learn-more"
            className={`group/link inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold transition-opacity duration-200 ${card.ctaColor}`}
          >
            <span>Learn More</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 ease-out group-hover/link:translate-x-1" />
          </a>
        </div>
      </div>
    );
  };

  return (
    <section
      id="features"
      ref={sectionRef}
      className="relative w-full min-h-screen bg-white border-b border-[#E5E5EA] text-[#1D1D1F] overflow-hidden flex flex-col justify-center pt-8 sm:pt-10 lg:pt-12 pb-6 sm:pb-8 lg:pb-10 select-none"
    >
      {/* Ambient background blurs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[250px] bg-gradient-to-b from-[#F5F5F7] via-slate-50/30 to-transparent blur-3xl" />
        <div className="absolute top-1/3 -right-48 w-80 h-80 bg-blue-50/40 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-48 w-80 h-80 bg-[#F5F5F7] rounded-full blur-3xl" />
      </div>

      {/* ── 1. Section Header (moved higher with compact vertical spacing) ── */}
      <div className="relative z-10 text-center max-w-2xl mx-auto px-4 space-y-1.5 sm:space-y-2 mb-5 sm:mb-6 lg:mb-7">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold tracking-[0.14em] uppercase text-[#6E6E73] bg-[#F5F5F7] border border-[#E5E5EA] shadow-[0_1px_2px_rgba(0,0,0,0.02)] backdrop-blur-sm">
          <Sparkles className="w-3 h-3 text-[#6E6E73]" />
          <span>Features</span>
        </div>

        <SplitText
          text="Built for the Worst. Ready for Anything."
          tag="h2"
          splitType="words"
          from={{ opacity: 0, y: 30 }}
          to={{ opacity: 1, y: 0 }}
          duration={0.8}
          delay={80}
          ease="power3.out"
          textAlign="center"
          className="text-2xl sm:text-3xl lg:text-[34px] font-semibold text-[#1D1D1F] tracking-[-0.03em] leading-tight"
        />

        <SplitText
          text="From the first report to the final resolution — RESPONDE handles every step of disaster response automatically"
          tag="p"
          splitType="words"
          from={{ opacity: 0, y: 15 }}
          to={{ opacity: 1, y: 0 }}
          duration={0.6}
          delay={30}
          ease="power3.out"
          textAlign="center"
          className="text-[#6E6E73] text-xs sm:text-sm max-w-lg mx-auto font-normal leading-relaxed tracking-[-0.01em]"
        />
      </div>

      {/* ── 2. Infinite Horizontal Marquee ── */}
      <div className="relative w-full overflow-hidden">
        {/* Left fade-out mask */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 h-full w-24 sm:w-40 z-10"
          style={{
            background:
              'linear-gradient(to right, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)',
          }}
        />
        {/* Right fade-out mask */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 h-full w-24 sm:w-40 z-10"
          style={{
            background:
              'linear-gradient(to left, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)',
          }}
        />

        {/* Scrolling track — 7 cards, no loop, scrolls once and stops */}
        <div
          ref={trackRef}
          className="flex will-change-transform"
          style={{ gap: CARD_GAP, paddingTop: 8, paddingBottom: 16, paddingLeft: CARD_GAP, paddingRight: CARD_GAP }}
        >
          {features.map((card) => renderCard(card, card.id))}
        </div>
      </div>

      {/* ── 3. Scroll hint ── */}
      <p className="relative z-10 mt-3 sm:mt-4 text-center text-[10.5px] sm:text-xs text-slate-400 font-medium tracking-wide">
        Scroll to explore&nbsp;&middot;&nbsp;7 features
      </p>
    </section>
  );
}
