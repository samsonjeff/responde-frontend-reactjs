import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MapPin, Phone, Mail } from 'lucide-react';
import { TALISAY_BARANGAYS } from '../data/talisay-barangays';

gsap.registerPlugin(ScrollTrigger);

export default function Footer() {
  const footerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (!contentRef.current) return;
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 1.3,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: footerRef.current,
            start: 'top 85%',
            once: true,
          },
        }
      );
    }, footerRef);

    return () => ctx.revert();
  }, []);

  const barangaysCol1 = TALISAY_BARANGAYS.slice(0, 11);
  const barangaysCol2 = TALISAY_BARANGAYS.slice(11);

  return (
    <footer
      ref={footerRef}
      id="footer"
      className="relative w-full bg-[#080B11] text-[#A1A1A6] border-t border-white/8 selection:bg-slate-700 selection:text-white select-none"
    >
      {/* ── Apple Ambient Subtle Gradient Horizon ── */}
      <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-white/2 to-transparent pointer-events-none" />

      <div
        ref={contentRef}
        className="relative max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pt-16 pb-12 sm:pt-20 sm:pb-16"
      >
        {/* ── Four Column Layout ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-14">
          {/* Column 1: Brand & Identity */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-xl ring-1 ring-white/15 bg-white/4 p-1 flex items-center justify-center shadow-inner">
                <img
                  src="/Responde_Logo.png"
                  alt="RESPONDE Logo"
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
              <div>
                <span className="text-[17px] font-semibold tracking-tight text-[#F5F5F7] block leading-none">
                  RESPONDE
                </span>
                <span className="text-[10px] uppercase font-semibold tracking-[0.14em] text-[#86868B] block mt-1">
                  Municipality of Talisay
                </span>
              </div>
            </div>

            <p className="text-[13px] text-[#A1A1A6] leading-relaxed">
              RESPONDE is a barangay-level disaster management and emergency incident reporting system built for the Municipality of Talisay, Batangas.
            </p>

            <div className="pt-1">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="RESPONDE on Facebook"
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/12 border border-white/8 hover:border-white/20 text-[#A1A1A6] hover:text-[#F5F5F7] transition-all duration-150 shadow-sm"
              >
                <svg
                  className="w-4 h-4 fill-current"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Column 2: Quick Navigation */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F5F5F7] mb-4">
              Quick Links
            </h4>
            <ul className="space-y-2.5 text-[13px]">
              <li>
                <a
                  href="#hero"
                  className="text-[#A1A1A6] hover:text-[#F5F5F7] transition-colors duration-150 block"
                >
                  Home
                </a>
              </li>
              <li>
                <a
                  href="#about"
                  className="text-[#A1A1A6] hover:text-[#F5F5F7] transition-colors duration-150 block"
                >
                  About
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  className="text-[#A1A1A6] hover:text-[#F5F5F7] transition-colors duration-150 block"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="/login"
                  className="text-[#A1A1A6] hover:text-[#F5F5F7] transition-colors duration-150 block"
                >
                  Sign In
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Barangays Directory (Two Sub-Columns) */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F5F5F7] mb-4">
              Barangays
            </h4>
            <div className="grid grid-cols-2 gap-x-5 text-[12.5px]">
              <ul className="space-y-2">
                {barangaysCol1.map((bgry) => (
                  <li
                    key={bgry}
                    className="text-[#A1A1A6] hover:text-[#F5F5F7] transition-colors duration-150 cursor-default select-none"
                  >
                    {bgry}
                  </li>
                ))}
              </ul>
              <ul className="space-y-2">
                {barangaysCol2.map((bgry) => (
                  <li
                    key={bgry}
                    className="text-[#A1A1A6] hover:text-[#F5F5F7] transition-colors duration-150 cursor-default select-none"
                  >
                    {bgry}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Column 4: Contact & Monitoring */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F5F5F7] mb-4">
              Contact Us
            </h4>
            <ul className="space-y-3.5 text-[13px] text-[#A1A1A6]">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#86868B] shrink-0 mt-0.5 stroke-[1.5]" />
                <span className="leading-snug">Talisay, Batangas, Philippines</span>
              </li>

              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-[#86868B] shrink-0 stroke-[1.5]" />
                <a
                  href="tel:911"
                  className="hover:text-[#F5F5F7] transition-colors duration-150 font-mono text-[12.5px]"
                >
                  (043) 773-0248 / 911
                </a>
              </li>

              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-[#86868B] shrink-0 stroke-[1.5]" />
                <a
                  href="mailto:responde@talisay.gov.ph"
                  className="hover:text-[#F5F5F7] transition-colors duration-150 break-all text-[12.5px]"
                >
                  responde@talisay.gov.ph
                </a>
              </li>

              <li className="pt-1.5">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/8 border border-emerald-500/20 text-[11px] font-medium text-emerald-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                  </span>
                  <span>24/7 Monitoring Active</span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* ── Hairline Divider ── */}
        <div className="border-t border-white/[0.07] my-10 sm:my-12" />

        {/* ── Bottom Bar ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-[#86868B]">
          <p className="text-center sm:text-left font-normal">
            © 2026 RESPONDE. All rights reserved. Municipality of Talisay, Batangas.
          </p>

          <div className="flex items-center gap-3 flex-wrap justify-center font-normal">
            <a
              href="#privacy"
              className="text-[#A1A1A6] hover:text-[#F5F5F7] transition-colors duration-150"
            >
              Privacy Policy
            </a>
            <span className="text-white/15" aria-hidden="true">
              •
            </span>
            <a
              href="#terms"
              className="text-[#A1A1A6] hover:text-[#F5F5F7] transition-colors duration-150"
            >
              Terms of Use
            </a>
            <span className="text-white/15" aria-hidden="true">
              •
            </span>
            <a
              href="#contact"
              className="text-[#A1A1A6] hover:text-[#F5F5F7] transition-colors duration-150"
            >
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
