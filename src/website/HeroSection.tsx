import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import BlurText from '../components/BlurText';

gsap.registerPlugin(ScrollTrigger);

export default function HeroSection() {
  const heroSectionRef = useRef<HTMLElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (!heroContentRef.current) return;
      const elements = Array.from(heroContentRef.current.children);
      gsap.fromTo(
        elements,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power3.out',
          stagger: 0.15,
          scrollTrigger: {
            trigger: heroSectionRef.current,
            start: 'top 80%',
            once: true,
          },
        }
      );
    }, heroSectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={heroSectionRef}
      id="hero"
      className="relative min-h-screen flex flex-col justify-center items-center text-center px-6 pt-32 pb-20 bg-[#0B0F17] border-b border-white/8 text-[#F5F5F7] overflow-hidden select-none"
    >
      {/* ── Background Image with Atmospheric Overlays ── */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
        <img
          src="/RespondeBG.jpg"
          alt="Emergency disaster response"
          className="w-full h-full object-cover object-center lg:object-[center_30%] filter brightness-95 contrast-100"
        />
        {/* Apple-grade soft atmospheric gradient overlays */}
        <div className="absolute inset-0 bg-linear-to-b from-[#0B0F17]/70 via-black/30 to-[#0B0F17]/90" />
      </div>

      {/* ── Hero Content ── */}
      <div ref={heroContentRef} className="relative z-10 max-w-3xl mx-auto space-y-6">
        {/* ── Headline with BlurText & Apple Optical Sizing ── */}
        <h1 className="text-4xl sm:text-6xl lg:text-[68px] font-semibold tracking-[-0.035em] text-[#F5F5F7] leading-[1.08] drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)] flex flex-col items-center justify-center gap-1 sm:gap-2">
          <BlurText
            text="The Line Between"
            delay={140}
            animateBy="words"
            direction="top"
            className="justify-center text-[#F5F5F7]"
            as="span"
          />
          <BlurText
            text="Crisis and Coordination."
            delay={140}
            animateBy="words"
            direction="bottom"
            className="justify-center"
            childClassName="bg-gradient-to-b from-white via-[#F5F5F7] to-[#D2D2D7] bg-clip-text text-transparent"
            as="span"
          />
        </h1>

        {/* ── Apple-tuned Body Copy ── */}
        <BlurText
          text="When chaos strikes a barangay, seconds become the difference between loss and rescue. RESPONDE ensures every cry for help reaches the right hands — instantly, accurately, and without fail."
          delay={40}
          animateBy="words"
          direction="top"
          className="justify-center text-base sm:text-lg lg:text-[19px] text-[#D2D2D7] leading-[1.55] max-w-2xl mx-auto font-normal tracking-[-0.012em] drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)]"
          as="p"
        />

        {/* ── Apple Action Button with Spring Feedback ── */}
        <div className="flex justify-center pt-3 sm:pt-4">
          <a
            href="#about"
            className="px-7 py-3 rounded-full bg-white/10 hover:bg-white/15 text-white font-medium text-sm sm:text-[14.5px] tracking-[-0.01em] border border-white/20 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.3)] hover:shadow-[0_6px_22px_rgba(0,0,0,0.4)] transition-all active:scale-[0.98]"
          >
            Learn More
          </a>
        </div>
      </div>
    </section>
  );
}
