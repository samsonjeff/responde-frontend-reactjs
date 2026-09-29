import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Layers,
  MonitorSmartphone,
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
  icon: typeof MonitorSmartphone;
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
];

export default function Features() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stackWrapperRef = useRef<HTMLDivElement | null>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const scrollTriggerInstanceRef = useRef<ScrollTrigger | null>(null);

  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [inspectedIndex, setInspectedIndex] = useState<number | null>(null);

  useEffect(() => {
    const cards = cardsRef.current.filter(Boolean) as HTMLDivElement[];
    if (!cards.length || !sectionRef.current) return;

    // Responsive GSAP matchMedia ensuring flawless layout on Phone, Tablet, and Desktop
    const mm = gsap.matchMedia(sectionRef);

    // Helper to build the sequential card deal timeline
    const buildTimeline = (config: {
      scaleFactor?: number;
      baseY: number;
      transformOrigin: string;
      scrollPerCard: number;
    }) => {
      const { scaleFactor = 1, baseY, transformOrigin, scrollPerCard } = config;

      // Fixed resting positions for each card in the messy table stack:
      // Cards 0..3 are the cards underneath with organic tossed angles & offsets
      // Card 4 is the front card on top (0deg, centered, level and fully readable)
      const cardPositions = [
        { rot: 15, x: 16, y: -12 },   // Card 0 (bottom of pile)
        { rot: -5, x: -10, y: 14 },   // Card 1 (3rd behind)
        { rot: 8, x: 20, y: 8 },      // Card 2 (2nd behind)
        { rot: -12, x: -18, y: -10 }, // Card 3 (1st behind)
        { rot: 0, x: 0, y: 0 },       // Card 4 (front card on top: 0deg, centered)
      ];

      // Initial clean state for all cards: off-screen below, zero rotation, zero offset
      cards.forEach((card, i) => {
        gsap.set(card, {
          x: 0,
          y: baseY,
          rotation: 0,
          yPercent: 135,
          opacity: 0,
          zIndex: i + 1,
          transformOrigin,
        });
      });

      const slideDuration = 1.0;
      const settleDuration = 0.6;
      const cycleDuration = slideDuration + settleDuration;
      const totalTimelineDuration =
        (cards.length - 1) * cycleDuration + slideDuration + 0.6;

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: () => `+=${cards.length * scrollPerCard}`,
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const currentTime = self.progress * totalTimelineDuration;
            const rawIndex = Math.floor(currentTime / cycleDuration);
            const progressIndex = Math.min(
              cards.length - 1,
              Math.max(0, rawIndex)
            );
            setActiveIndex(progressIndex);
          },
        },
      });

      // Store reference to ScrollTrigger for programmatic pill navigation
      scrollTriggerInstanceRef.current = tl.scrollTrigger || null;

      // ── Sequential Individual 2-Phase Animation per Card ──
      // Card s slides up straight into view, then immediately settles into its messy angle & offset.
      // The next card only starts after Card s finishes both phases.
      // Card 5 (top card) slides up last and stays at 0deg rotation with no mess phase.
      for (let s = 0; s < cards.length; s++) {
        const startTime = s * cycleDuration;
        const pos = cardPositions[s];
        const targetX = pos.x * scaleFactor;
        const targetRot = pos.rot * scaleFactor;
        const targetY = baseY + pos.y * scaleFactor;
        const isLastCard = s === cards.length - 1;

        // Phase 1 for this card: Slide up straight into view (0deg rotation, 0 offset)
        tl.fromTo(
          cards[s],
          {
            yPercent: 135,
            opacity: 0,
            rotation: 0,
            x: 0,
            y: baseY,
          },
          {
            yPercent: 0,
            opacity: 1,
            rotation: 0,
            x: 0,
            y: baseY,
            ease: 'power2.out',
            duration: slideDuration,
          },
          startTime
        );

        // Phase 2 for this card: Immediately settles into its final messy rotation & offset
        // (Skipped for the last card so it stays at 0deg rotation centered as the front card)
        if (!isLastCard) {
          tl.to(
            cards[s],
            {
              x: targetX,
              y: targetY,
              rotation: targetRot,
              ease: 'power2.out',
              duration: settleDuration,
            },
            startTime + slideDuration
          );
        }
      }

      // Settle buffer so the final messy stack can be viewed comfortably before unpinning
      tl.to({}, { duration: 0.6 });
    };

    // ── 1. Mobile Phones (< 640px) ──
    mm.add('(max-width: 639px)', () => {
      buildTimeline({
        scaleFactor: 0.75,
        baseY: 18,
        transformOrigin: '50% 50%',
        scrollPerCard: 360,
      });
    });

    // ── 2. Tablets (640px - 1023px) ──
    mm.add('(min-width: 640px) and (max-width: 1023px)', () => {
      buildTimeline({
        scaleFactor: 0.88,
        baseY: 26,
        transformOrigin: '50% 50%',
        scrollPerCard: 480,
      });
    });

    // ── 3. Desktop (>= 1024px) ──
    mm.add('(min-width: 1024px)', () => {
      buildTimeline({
        scaleFactor: 1,
        baseY: 36,
        transformOrigin: '50% 50%',
        scrollPerCard: 600,
      });
    });

    return () => {
      mm.revert();
      scrollTriggerInstanceRef.current = null;
    };
  }, []);

  // Programmatic smooth scroll to card when tapping indicator pills
  const scrollToCard = (index: number) => {
    setInspectedIndex(index);
    const st = scrollTriggerInstanceRef.current;
    if (st) {
      const cycleDuration = 1.6;
      const slideDuration = 1.0;
      const totalDuration =
        (features.length - 1) * cycleDuration + slideDuration + 0.6;
      const targetTime =
        index === features.length - 1
          ? totalDuration - 0.3
          : index * cycleDuration + slideDuration;
      const targetProgress = targetTime / totalDuration;
      const scrollTarget =
        st.start + targetProgress * (st.end - st.start);
      window.scrollTo({
        top: scrollTarget,
        behavior: 'smooth',
      });
    }
  };

  const handlePrevCard = () => {
    const nextIdx = Math.max(0, activeIndex - 1);
    scrollToCard(nextIdx);
  };

  const handleNextCard = () => {
    const nextIdx = Math.min(features.length - 1, activeIndex + 1);
    scrollToCard(nextIdx);
  };

  return (
    <section
      id="features"
      ref={sectionRef}
      className="relative w-full min-h-[100dvh] bg-white border-b border-[#E5E5EA] text-[#1D1D1F] overflow-x-clip flex flex-col justify-between py-6 sm:py-8 lg:py-10 select-none"
    >
      {/* ── Apple Ambient Background Accents ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[300px] bg-gradient-to-b from-[#F5F5F7] via-slate-50/30 to-transparent blur-3xl" />
        <div className="absolute top-1/3 -right-48 w-80 h-80 bg-blue-50/40 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-48 w-80 h-80 bg-[#F5F5F7] rounded-full blur-3xl" />
      </div>

      {/* ── 1. Top Section Header (Compact & Crisp on all screens) ── */}
      <div className="relative z-10 text-center max-w-3xl mx-auto px-4 space-y-1.5 sm:space-y-2.5 shrink-0">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 sm:px-3.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold tracking-[0.14em] uppercase text-[#6E6E73] bg-[#F5F5F7] border border-[#E5E5EA] shadow-[0_1px_2px_rgba(0,0,0,0.02)] backdrop-blur-sm">
          <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#6E6E73]" />
          <span>Features</span>
        </div>

        <SplitText
          text="Built for the Worst. Ready for Anything."
          tag="h2"
          splitType="words"
          from={{ opacity: 0, y: 40 }}
          to={{ opacity: 1, y: 0 }}
          duration={0.8}
          delay={80}
          ease="power3.out"
          textAlign="center"
          className="text-xl sm:text-3xl lg:text-4xl font-semibold text-[#1D1D1F] tracking-[-0.03em] leading-tight"
        />

        <SplitText
          text="From the first report to the final resolution — RESPONDE handles every step of disaster response automatically"
          tag="p"
          splitType="words"
          from={{ opacity: 0, y: 20 }}
          to={{ opacity: 1, y: 0 }}
          duration={0.6}
          delay={30}
          ease="power3.out"
          textAlign="center"
          className="text-[#6E6E73] text-xs sm:text-sm lg:text-base max-w-xl mx-auto font-normal leading-relaxed tracking-[-0.01em]"
        />
      </div>

      {/* ── 2. Middle Playing Card Fanned Deck Stage (Balanced Top & Bottom Clearance) ── */}
      <div
        ref={stackWrapperRef}
        className="relative w-full flex-1 min-h-[380px] sm:min-h-[450px] lg:min-h-[510px] flex items-center justify-center mt-6 sm:mt-8 lg:mt-10 mb-4 sm:mb-6 lg:mb-8"
      >
        {features.map((card, index) => {
          const IconComponent = card.icon;
          const isInspected = inspectedIndex === index;

          return (
            <div
              key={card.id}
              ref={(el) => {
                cardsRef.current[index] = el;
              }}
              onClick={() => scrollToCard(index)}
              className={`card-item absolute w-[min(82vw,275px)] sm:w-[330px] lg:w-[390px] h-[370px] sm:h-[430px] lg:h-[490px] rounded-[22px] sm:rounded-[28px] lg:rounded-[34px] p-4 sm:p-6 lg:p-8 flex flex-col justify-between ${card.bgColor} ${card.textColor} border ${card.borderColor} shadow-[0_16px_40px_-10px_rgba(0,0,0,0.22),0_4px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_24px_50px_-10px_rgba(0,0,0,0.28)] hover:-translate-y-2 transition-shadow duration-200 cursor-pointer ${isInspected ? 'ring-2 ring-white/60 shadow-2xl z-50' : ''
                }`}
            >
              {/* ── Card Top Row: Outline Icon, Badge & ID ── */}
              <div className="flex items-start justify-between">
                <div className={`${card.iconColor}`}>
                  <IconComponent className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 stroke-[1.5]" />
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider border backdrop-blur-md shadow-sm ${card.badgeClass}`}
                  >
                    {card.badge}
                  </span>
                  <span className="text-[10px] sm:text-xs font-mono font-bold opacity-60">
                    {card.id}
                  </span>
                </div>
              </div>

              {/* ── Card Body: Title & Full Description ── */}
              <div className="space-y-1 sm:space-y-2.5 pt-1 sm:pt-2">
                <h3 className="text-base sm:text-xl lg:text-2xl font-bold tracking-tight leading-snug">
                  {card.title}
                </h3>

                <p
                  className={`text-[11px] sm:text-xs lg:text-[13.5px] leading-relaxed font-normal ${card.descColor}`}
                >
                  {card.description}
                </p>
              </div>

              {/* ── Card Bottom CTA Link ── */}
              <div className="pt-2 sm:pt-3 border-t border-current/15">
                <a
                  href="#learn-more"
                  onClick={(e) => e.stopPropagation()}
                  className={`group/link inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold transition-opacity duration-200 ${card.ctaColor}`}
                >
                  <span>Learn More</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-300 ease-out group-hover/link:translate-x-1" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 3. Bottom Interactive Navigator & Device Indicator Bar (With Generous Top Gap) ── */}
      <div className="relative z-10 shrink-0 max-w-lg mx-auto px-4 pt-4 sm:pt-6 pb-2 sm:pb-3 flex flex-col items-center gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Previous Card Button */}
          <button
            type="button"
            onClick={handlePrevCard}
            disabled={activeIndex === 0}
            aria-label="Previous Feature Card"
            className="p-1.5 rounded-full text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200/80 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all duration-150"
          >
            <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Interactive Feature Pills (Responsive: compact numbers on phone, labels on tablet/desktop) */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100/90 border border-slate-200/80 rounded-full shadow-sm backdrop-blur-md">
            {features.map((item, i) => {
              const isActive = activeIndex === i;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToCard(i)}
                  className={`px-2.5 py-1 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${isActive
                    ? 'bg-[#1d1d1f] text-white shadow-sm font-semibold scale-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                >
                  <span>{item.id}</span>
                  <span className="hidden md:inline text-[11px] opacity-80">
                    {item.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Next Card Button */}
          <button
            type="button"
            onClick={handleNextCard}
            disabled={activeIndex === features.length - 1}
            aria-label="Next Feature Card"
            className="p-1.5 rounded-full text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200/80 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all duration-150"
          >
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* Micro Scroll Hint */}
        <p className="text-[10px] sm:text-xs text-slate-400 font-medium tracking-wide">
          Scroll or tap pills to deal cards
        </p>
      </div>
    </section>
  );
}
