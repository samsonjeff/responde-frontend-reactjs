import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Activity,
  Bot,
  CheckCircle2,
  Compass,
  MapPin,
  Radio,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import SplitText from '../components/SplitText';

gsap.registerPlugin(ScrollTrigger);

export default function About() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const row1Ref = useRef<HTMLDivElement>(null);
  const row1ImageRef = useRef<HTMLDivElement>(null);
  const row1TextRef = useRef<HTMLDivElement>(null);

  const row2Ref = useRef<HTMLDivElement>(null);
  const row2ImageRef = useRef<HTMLDivElement>(null);
  const row2TextRef = useRef<HTMLDivElement>(null);

  const row3Ref = useRef<HTMLDivElement>(null);
  const row3ImageRef = useRef<HTMLDivElement>(null);
  const row3TextRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Header entrance
      if (headerRef.current) {
        gsap.fromTo(
          headerRef.current,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 1.2,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: headerRef.current,
              start: 'top 85%',
              once: true,
            },
          }
        );
      }

      // Row 1: Image from left (-80), Text from right (+80)
      if (row1Ref.current && row1ImageRef.current && row1TextRef.current) {
        gsap.fromTo(
          row1ImageRef.current,
          { x: -80, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 1.4,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: row1Ref.current,
              start: 'top 85%',
              once: true,
            },
          }
        );

        gsap.fromTo(
          row1TextRef.current,
          { x: 80, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 1.4,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: row1Ref.current,
              start: 'top 85%',
              once: true,
            },
          }
        );
      }

      // Row 2: Text from left (-80), Image from right (+80)
      if (row2Ref.current && row2TextRef.current && row2ImageRef.current) {
        gsap.fromTo(
          row2TextRef.current,
          { x: -80, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 1.4,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: row2Ref.current,
              start: 'top 85%',
              once: true,
            },
          }
        );

        gsap.fromTo(
          row2ImageRef.current,
          { x: 80, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 1.4,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: row2Ref.current,
              start: 'top 85%',
              once: true,
            },
          }
        );
      }

      // Row 3: Image from left (-80), Text from right (+80)
      if (row3Ref.current && row3ImageRef.current && row3TextRef.current) {
        gsap.fromTo(
          row3ImageRef.current,
          { x: -80, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 1.4,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: row3Ref.current,
              start: 'top 85%',
              once: true,
            },
          }
        );

        gsap.fromTo(
          row3TextRef.current,
          { x: 80, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 1.4,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: row3Ref.current,
              start: 'top 85%',
              once: true,
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="about"
      className="relative pt-10 sm:pt-14 lg:pt-16 pb-24 sm:pb-32 px-6 bg-white border-b border-[#E5E5EA] text-[#1D1D1F] overflow-hidden"
    >
      {/* ── Apple-style Ambient Background Accents ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[350px] bg-gradient-to-b from-[#F5F5F7] via-slate-50/40 to-transparent blur-3xl" />
        <div className="absolute top-1/3 -right-48 w-96 h-96 bg-blue-50/40 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-48 w-96 h-96 bg-[#F5F5F7] rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto space-y-28 sm:space-y-36">
        {/* ── Top Section Header ── */}
        <div ref={headerRef} className="text-center max-w-3xl mx-auto space-y-3 sm:space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold tracking-[0.14em] uppercase text-[#6E6E73] bg-[#F5F5F7] border border-[#E5E5EA] shadow-[0_1px_2px_rgba(0,0,0,0.02)] backdrop-blur-sm">
            <Compass className="w-3.5 h-3.5 text-[#6E6E73]" />
            <span>About</span>
          </div>

          <SplitText
            text="Not Just a System. A Lifeline."
            tag="h2"
            splitType="words"
            from={{ opacity: 0, y: 40 }}
            to={{ opacity: 1, y: 0 }}
            duration={0.8}
            delay={80}
            ease="power3.out"
            textAlign="left"
            className="text-3xl sm:text-5xl lg:text-[54px] font-semibold tracking-[-0.03em] text-[#1D1D1F] leading-[1.12]"
          />

          <p className="text-base sm:text-lg lg:text-[19px] text-[#6E6E73] max-w-2xl mx-auto font-normal leading-relaxed tracking-[-0.01em]">
            Empowering citizens and responders with immediate coordination, automated mapping, and verified reporting.
          </p>
        </div>

        {/* ── Row 1: Image Left, Text Right ── */}
        <div ref={row1Ref} className="flex flex-col md:flex-row items-center gap-12 lg:gap-16">
          {/* Card Mockup */}
          <div ref={row1ImageRef} className="w-full md:w-1/2">
            <div className="group relative rounded-[28px] p-2.5 sm:p-3 bg-gradient-to-b from-[#F5F5F7] via-[#FAFAFC] to-[#F5F5F7] border border-[#E5E5EA] shadow-[0_20px_45px_-12px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.02)] hover:shadow-[0_28px_56px_-12px_rgba(0,0,0,0.12)] transition-all duration-500 ease-out">
              <div className="relative rounded-[20px] overflow-hidden bg-[#0c121e] border border-slate-800/80 text-slate-100 aspect-[16/11] sm:aspect-[4/3] flex flex-col">
                {/* macOS Style Window Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-[#0f172a]/90 border-b border-slate-800/80 backdrop-blur-md">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]/90 inline-block shadow-sm" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]/90 inline-block shadow-sm" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]/90 inline-block shadow-sm" />
                  </div>
                  <span className="text-[11px] font-mono text-[#86868B] tracking-wide">
                    responde.gov.ph • talisay-command
                  </span>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE
                  </div>
                </div>

                {/* Window Canvas */}
                <div className="relative flex-1 p-5 flex flex-col justify-between bg-radial from-slate-900/60 to-[#0c121e]">
                  {/* Subtle Grid Lines */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

                  {/* Top Status Strip */}
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                        <Radio className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white tracking-tight">Barangay Disaster Grid</div>
                        <div className="text-[11px] text-slate-400">Talisay, Batangas Command</div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
                      14.0956° N, 120.9880° E
                    </span>
                  </div>

                  {/* Center Radar / Geographic Ping */}
                  <div className="relative z-10 my-auto py-3">
                    <div className="relative w-full h-28 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-center overflow-hidden">
                      {/* Concentric rings */}
                      <div className="absolute w-40 h-40 rounded-full border border-blue-500/15" />
                      <div className="absolute w-24 h-24 rounded-full border border-blue-500/25" />
                      <div className="absolute w-12 h-12 rounded-full border border-blue-400/40 bg-blue-500/10" />

                      {/* Active Nodes */}
                      <div className="absolute top-6 left-12 flex items-center gap-1.5 bg-slate-900/90 border border-slate-700 px-2 py-0.5 rounded-full text-[10px] text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Brgy. Poblacion
                      </div>
                      <div className="absolute bottom-5 right-10 flex items-center gap-1.5 bg-slate-900/90 border border-slate-700 px-2 py-0.5 rounded-full text-[10px] text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                        Brgy. Banga
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-blue-200">
                        <MapPin className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
                        Active Incident Plotting
                      </div>
                    </div>
                  </div>

                  {/* Bottom Stats Footer */}
                  <div className="relative z-10 grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
                      <div className="text-[10px] uppercase text-slate-400 font-medium">Coverage</div>
                      <div className="text-xs font-semibold text-white mt-0.5">21 Barangays</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
                      <div className="text-[10px] uppercase text-slate-400 font-medium">Dispatch</div>
                      <div className="text-xs font-semibold text-emerald-400 mt-0.5">&lt; 30s Latency</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
                      <div className="text-[10px] uppercase text-slate-400 font-medium">Reliability</div>
                      <div className="text-xs font-semibold text-sky-400 mt-0.5">99.9% Uptime</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Text Content */}
          <div ref={row1TextRef} className="w-full md:w-1/2 space-y-4 sm:space-y-5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-[0.12em] uppercase text-[#0071E3] bg-[#0071E3]/[0.08] border border-[#0071E3]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3]" />
              Overview
            </div>

            <SplitText
              text="What is RESPONDE?"
              tag="h3"
              splitType="words"
              from={{ opacity: 0, y: 30 }}
              to={{ opacity: 1, y: 0 }}
              duration={0.7}
              delay={60}
              ease="power3.out"
              textAlign="left"
              className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-[#1D1D1F] tracking-[-0.028em] leading-[1.2]"
            />

            <SplitText
              text="RESPONDE is a barangay-level disaster management and incident reporting system built for Talisay, Batangas. It bridges the gap between residents in distress and the response teams who protect them."
              tag="p"
              splitType="words"
              from={{ opacity: 0, y: 20 }}
              to={{ opacity: 1, y: 0 }}
              duration={0.6}
              delay={30}
              ease="power3.out"
              textAlign="left"
              className="text-[15px] sm:text-[16px] text-[#515154] leading-[1.65] font-normal tracking-[-0.008em]"
            />

            {/* Apple-style Micro Highlights */}
            <div className="pt-2 space-y-2.5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-4 h-4 rounded-full bg-blue-50 flex items-center justify-center text-[#0071E3] shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <p className="text-[13.5px] sm:text-[14px] text-[#424245] font-normal leading-normal">
                  Built specifically for the topography and disaster needs of Talisay, Batangas.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-4 h-4 rounded-full bg-blue-50 flex items-center justify-center text-[#0071E3] shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <p className="text-[13.5px] sm:text-[14px] text-[#424245] font-normal leading-normal">
                  Direct digital bridge connecting barangay halls and municipal emergency units.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 2: Text Left, Image Right (flex-row-reverse) ── */}
        <div ref={row2Ref} className="flex flex-col md:flex-row-reverse items-center gap-12 lg:gap-16">
          {/* Card Mockup */}
          <div ref={row2ImageRef} className="w-full md:w-1/2">
            <div className="group relative rounded-[28px] p-2.5 sm:p-3 bg-gradient-to-b from-[#F5F5F7] via-[#FAFAFC] to-[#F5F5F7] border border-[#E5E5EA] shadow-[0_20px_45px_-12px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.02)] hover:shadow-[0_28px_56px_-12px_rgba(0,0,0,0.12)] transition-all duration-500 ease-out">
              <div className="relative rounded-[20px] overflow-hidden bg-[#0c121e] border border-slate-800/80 text-slate-100 aspect-[16/11] sm:aspect-[4/3] flex flex-col">
                {/* macOS Style Window Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-[#0f172a]/90 border-b border-slate-800/80 backdrop-blur-md">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]/90 inline-block shadow-sm" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]/90 inline-block shadow-sm" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]/90 inline-block shadow-sm" />
                  </div>
                  <span className="text-[11px] font-mono text-[#86868B] tracking-wide">
                    responde.gov.ph • coordination-pipeline
                  </span>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-medium">
                    <Zap className="w-3 h-3 text-sky-400" />
                    AUTO-ROUTE
                  </div>
                </div>

                {/* Window Canvas */}
                <div className="relative flex-1 p-5 flex flex-col justify-between bg-radial from-slate-900/60 to-[#0c121e]">
                  {/* Pipeline Steps Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <span className="text-xs font-semibold text-white tracking-tight">3-Stage Response Pipeline</span>
                    <span className="text-[10px] font-mono text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                      Verified Dispatch
                    </span>
                  </div>

                  {/* 3 Step Pipeline Showcase */}
                  <div className="space-y-2.5 my-auto py-2">
                    {/* Step 1: Messenger Intake */}
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                      <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-white truncate">1. Messenger &amp; Scraper Intake</span>
                          <span className="text-[10px] text-slate-400 font-mono">0.2s</span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">Citizen reports flash flooding in Brgy. Tumaway</p>
                      </div>
                    </div>

                    {/* Step 2: Officer Verification */}
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-white truncate">2. Live Officer Verification</span>
                          <span className="text-[10px] text-emerald-400 font-mono">Verified</span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">Geospatial coordinates plotted on live hazard map</p>
                      </div>
                    </div>

                    {/* Step 3: Dispatch Coordination */}
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                        <Radio className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-white truncate">3. Instant Barangay Dispatch</span>
                          <span className="text-[10px] text-indigo-400 font-mono">En Route</span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">Rescue Unit 04 dispatched to zone coordinates</p>
                      </div>
                    </div>
                  </div>

                  {/* Pipeline Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                    <span>Average triage-to-dispatch turnaround</span>
                    <span className="font-semibold text-white font-mono">&lt; 2 minutes</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Text Content */}
          <div ref={row2TextRef} className="w-full md:w-1/2 space-y-4 sm:space-y-5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-[0.12em] uppercase text-[#0071E3] bg-[#0071E3]/[0.08] border border-[#0071E3]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3]" />
              Workflow
            </div>

            <SplitText
              text="How Does It Work?"
              tag="h3"
              splitType="words"
              from={{ opacity: 0, y: 30 }}
              to={{ opacity: 1, y: 0 }}
              duration={0.7}
              delay={60}
              ease="power3.out"
              textAlign="left"
              className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-[#1D1D1F] tracking-[-0.028em] leading-[1.2]"
            />

            <SplitText
              text="Residents report incidents through a Messenger Bot or community scrapers. Officers verify each report, plot it on a live geo-map, and coordinate immediate dispatch to the right barangay."
              tag="p"
              splitType="words"
              from={{ opacity: 0, y: 20 }}
              to={{ opacity: 1, y: 0 }}
              duration={0.6}
              delay={30}
              ease="power3.out"
              textAlign="left"
              className="text-[15px] sm:text-[16px] text-[#515154] leading-[1.65] font-normal tracking-[-0.008em]"
            />

            {/* Apple-style Micro Highlights */}
            <div className="pt-2 space-y-2.5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-4 h-4 rounded-full bg-sky-50 flex items-center justify-center text-[#0071E3] shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <p className="text-[13.5px] sm:text-[14px] text-[#424245] font-normal leading-normal">
                  Zero barrier reporting via Facebook Messenger without needing app downloads.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-4 h-4 rounded-full bg-sky-50 flex items-center justify-center text-[#0071E3] shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <p className="text-[13.5px] sm:text-[14px] text-[#424245] font-normal leading-normal">
                  Live officer geo-verification eliminates false alarms and routes teams directly.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 3: Image Left, Text Right ── */}
        <div ref={row3Ref} className="flex flex-col md:flex-row items-center gap-12 lg:gap-16">
          {/* Card Mockup */}
          <div ref={row3ImageRef} className="w-full md:w-1/2">
            <div className="group relative rounded-[28px] p-2.5 sm:p-3 bg-gradient-to-b from-[#F5F5F7] via-[#FAFAFC] to-[#F5F5F7] border border-[#E5E5EA] shadow-[0_20px_45px_-12px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.02)] hover:shadow-[0_28px_56px_-12px_rgba(0,0,0,0.12)] transition-all duration-500 ease-out">
              <div className="relative rounded-[20px] overflow-hidden bg-[#0c121e] border border-slate-800/80 text-slate-100 aspect-[16/11] sm:aspect-[4/3] flex flex-col">
                {/* macOS Style Window Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-[#0f172a]/90 border-b border-slate-800/80 backdrop-blur-md">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]/90 inline-block shadow-sm" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]/90 inline-block shadow-sm" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]/90 inline-block shadow-sm" />
                  </div>
                  <span className="text-[11px] font-mono text-[#86868B] tracking-wide">
                    responde.gov.ph • community-impact
                  </span>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                    <Activity className="w-3 h-3 text-emerald-400" />
                    MEASURED IMPACT
                  </div>
                </div>

                {/* Window Canvas */}
                <div className="relative flex-1 p-5 flex flex-col justify-between bg-radial from-slate-900/60 to-[#0c121e]">
                  {/* Top Metric Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white tracking-tight">Talisay Disaster Intelligence Benchmark</div>
                      <div className="text-[11px] text-slate-400">Automated multi-channel intake vs manual logbooks</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-bold font-mono">
                      REAL-TIME INTAKE
                    </span>
                  </div>

                  {/* Impact Statistics Cards */}
                  <div className="grid grid-cols-2 gap-3 my-auto py-2">
                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1">
                      <div className="text-[11px] text-slate-400 font-medium">Automated Intake</div>
                      <div className="text-2xl font-bold text-white tracking-tight font-mono">24/7</div>
                      <div className="text-[10px] text-emerald-400 font-medium">Continuous bot &amp; social feed monitoring</div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1">
                      <div className="text-[11px] text-slate-400 font-medium">Barangay Coverage</div>
                      <div className="text-2xl font-bold text-white tracking-tight font-mono">100%</div>
                      <div className="text-[10px] text-sky-400 font-medium">All 21 zones mapped &amp; active</div>
                    </div>
                  </div>

                  {/* Mission Quote Bar */}
                  <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-transparent border border-emerald-500/20 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-slate-200 font-medium leading-snug">
                      &ldquo;No resident is left unheard, and no barangay faces disaster alone.&rdquo;
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Text Content */}
          <div ref={row3TextRef} className="w-full md:w-1/2 space-y-4 sm:space-y-5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-[0.12em] uppercase text-[#10B981] bg-[#10B981]/[0.08] border border-[#10B981]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              Impact
            </div>

            <SplitText
              text="Why It Matters?"
              tag="h3"
              splitType="words"
              from={{ opacity: 0, y: 30 }}
              to={{ opacity: 1, y: 0 }}
              duration={0.7}
              delay={60}
              ease="power3.out"
              textAlign="left"
              className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-[#1D1D1F] tracking-[-0.028em] leading-[1.2]"
            />

            <SplitText
              text="Before RESPONDE, emergency coordination in Talisay relied on manual calls and delayed communication. Now every barangay has a direct line to help — because no family should face disaster alone."
              tag="p"
              splitType="words"
              from={{ opacity: 0, y: 20 }}
              to={{ opacity: 1, y: 0 }}
              duration={0.6}
              delay={30}
              ease="power3.out"
              textAlign="left"
              className="text-[15px] sm:text-[16px] text-[#515154] leading-[1.65] font-normal tracking-[-0.008em]"
            />

            {/* Apple-style Micro Highlights */}
            <div className="pt-2 space-y-2.5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center text-[#10B981] shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <p className="text-[13.5px] sm:text-[14px] text-[#424245] font-normal leading-normal">
                  Eliminates chaotic telephone trees and lost distress reports during disasters.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center text-[#10B981] shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <p className="text-[13.5px] sm:text-[14px] text-[#424245] font-normal leading-normal">
                  Guarantees transparent incident logging and rapid geospatial verification.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
