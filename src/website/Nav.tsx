import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Home, Info, Sparkles, LogIn, Menu, X, ChevronRight } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'hero', label: 'Home', href: '#hero', icon: Home },
  { id: 'about', label: 'About', href: '#about', icon: Info },
  { id: 'features', label: 'Features', href: '#features', icon: Sparkles },
];

export default function Nav() {
  const shouldReduceMotion = useReducedMotion();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [activeSection, setActiveSection] = useState<string>('hero');
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const navRef = useRef<HTMLElement>(null);
  const logoRef = useRef<HTMLAnchorElement>(null);
  const navLinksRef = useRef<(HTMLLIElement | null)[]>([]);
  const signInRef = useRef<HTMLAnchorElement>(null);

  // GSAP Stagger Entrance Animation on Page Load
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        delay: 0.3,
      });

      // 1. Base navbar container slides down into natural position
      tl.fromTo(
        navRef.current,
        { opacity: 0, y: -20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
        }
      );

      // Label marking the moment immediately after the navbar container settles
      tl.addLabel('elements');

      // 2. Logo/brand appears first
      if (logoRef.current) {
        tl.fromTo(
          logoRef.current,
          { opacity: 0, y: -10 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: 'power3.out',
            clearProps: 'transform',
          },
          'elements'
        );
      }

      // 3. Nav links (Home, About, Features) appear one after another with 0.1s stagger
      const links = navLinksRef.current.filter(Boolean);
      links.forEach((link, idx) => {
        tl.fromTo(
          link,
          { opacity: 0, y: -10 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: 'power3.out',
            clearProps: 'transform',
          },
          `elements+=${0.1 * (idx + 1)}`
        );
      });

      // 4. Sign In button appears last with scale 0.8 to 1 combined with fade
      if (signInRef.current) {
        const signInDelay = 0.1 * (links.length + 1);
        tl.fromTo(
          signInRef.current,
          { opacity: 0, y: -10, scale: 0.8 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.5,
            ease: 'power3.out',
            clearProps: 'transform',
          },
          `elements+=${signInDelay}`
        );
      }
    }, navRef);

    return () => ctx.revert();
  }, []);

  // Handle scroll depth for elevation and directional scroll for smooth hide/show
  useEffect(() => {
    let ticking = false;
    let lastY = Math.max(0, window.scrollY);
    let accumulatedDelta = 0;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = Math.max(0, window.scrollY);

          // Update elevation backdrop blur & shadow
          setScrolled(currentY > 15);

          // Always stay visible if mobile menu is open
          if (isMenuOpen) {
            setIsVisible(true);
            lastY = currentY;
            accumulatedDelta = 0;
            ticking = false;
            return;
          }

          // Always visible in the hero / top zone of the page
          if (currentY <= 60) {
            setIsVisible(true);
            lastY = currentY;
            accumulatedDelta = 0;
            ticking = false;
            return;
          }

          // Prevent micro-jitter on page boundaries / overscroll bounce
          const isNearBottom =
            window.innerHeight + currentY >=
            document.documentElement.scrollHeight - 25;
          if (isNearBottom) {
            lastY = currentY;
            ticking = false;
            return;
          }

          const delta = currentY - lastY;

          // If scroll direction reversed, reset accumulated delta counter
          if (
            (delta > 0 && accumulatedDelta < 0) ||
            (delta < 0 && accumulatedDelta > 0)
          ) {
            accumulatedDelta = 0;
          }

          accumulatedDelta += delta;

          // Deliberate downward scroll: hide with smooth fade-out and upward glide
          if (accumulatedDelta > 20) {
            setIsVisible(false);
          }
          // Deliberate upward scroll: reveal with smooth fade-in and cushioned drop
          else if (accumulatedDelta < -16) {
            setIsVisible(true);
          }

          lastY = currentY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMenuOpen]);

  // Track active section via IntersectionObserver when on landing page
  useEffect(() => {
    if (location.pathname !== '/') return;

    const observerCallback: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0,
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    NAV_ITEMS.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [location.pathname]);

  // Handle smooth scroll navigation
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (location.pathname === '/' && href.startsWith('#')) {
      e.preventDefault();
      const targetId = href.replace('#', '');
      const elem = document.getElementById(targetId);
      if (elem) {
        elem.scrollIntoView({ behavior: 'smooth' });
        window.history.pushState(null, '', href);
        setActiveSection(targetId);
      }
    }
  };

  const closeMenu = () => setIsMenuOpen(false);

  // Close on Escape key and on resize to desktop
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMenuOpen) closeMenu();
    };
    const handleResize = () => {
      if (window.innerWidth >= 768 && isMenuOpen) closeMenu();
    };
    document.addEventListener('keydown', handleEscapeKey);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      window.removeEventListener('resize', handleResize);
    };
  }, [isMenuOpen]);

  return (
    <motion.header
      aria-hidden={!isVisible}
      initial={false}
      animate={
        shouldReduceMotion
          ? { opacity: isVisible ? 1 : 0 }
          : {
              y: isVisible ? 0 : -32,
              opacity: isVisible ? 1 : 0,
              scale: isVisible ? 1 : 0.985,
            }
      }
      transition={
        shouldReduceMotion
          ? { duration: 0.2, ease: 'easeInOut' }
          : {
              y: isVisible
                ? {
                    type: 'spring',
                    stiffness: 240,
                    damping: 26,
                    mass: 0.8,
                  }
                : {
                    duration: 0.3,
                    ease: [0.32, 0.72, 0, 1], // Apple iOS drawer/retract curve
                  },
              scale: isVisible
                ? {
                    type: 'spring',
                    stiffness: 240,
                    damping: 26,
                    mass: 0.8,
                  }
                : {
                    duration: 0.3,
                    ease: [0.32, 0.72, 0, 1],
                  },
              opacity: isVisible
                ? {
                    duration: 0.32,
                    ease: [0.16, 1, 0.3, 1], // Natural quick ramp up, smooth settle
                  }
                : {
                    duration: 0.28,
                    ease: [0.32, 0.72, 0, 1], // Coordinated smooth fade out along with the slide
                  },
            }
      }
      style={{
        transformOrigin: 'top center',
        willChange: 'transform, opacity',
      }}
      className="fixed top-3.5 sm:top-5 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none"
    >
      <nav
        ref={navRef}
        aria-label="Main navigation"
        className={`
          ${isVisible ? 'pointer-events-auto' : 'pointer-events-none select-none'}
          w-full max-w-4xl
          flex items-center justify-between
          px-3 sm:px-4 py-2 sm:py-2.5
          rounded-full
          bg-black/15 backdrop-blur-2xl backdrop-saturate-150
          border border-white/10
          transition-[background-color,box-shadow,border-color] duration-300
          ${scrolled
            ? 'shadow-[0_8px_32px_rgba(0,0,0,0.3)] bg-black/30'
            : 'shadow-[0_4px_20px_rgba(0,0,0,0.15)]'
          }
        `}
      >
        {/* ── Left Group: Brand Logo + Navigation Links ── */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Logo & Brand Name */}
          <Link
            ref={logoRef}
            to="/"
            onClick={() => {
              if (location.pathname === '/') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full text-white group focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 active:scale-95 transition-transform duration-100"
          >
            <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden ring-1 ring-white/20 bg-white/5 flex items-center justify-center shadow-inner group-hover:ring-white/40 transition-all">
              <img
                src="/Responde_Logo.png"
                alt="RESPONDE Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-xs sm:text-[13px] font-bold tracking-tight text-white/95 group-hover:text-white transition-colors">
              RESPONDE
            </span>
          </Link>

          {/* Apple Hairline Divider */}
          <div className="hidden md:block w-px h-4 bg-white/15 mx-1" aria-hidden="true" />

          {/* Left-Aligned Links: Home, About, Features with Apple Icons */}
          <ul className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item, index) => {
              const isActive = activeSection === item.id;
              const isHovered = hoveredTab === item.id;
              const showPill = hoveredTab ? isHovered : isActive;
              const Icon = item.icon;

              return (
                <li
                  key={item.id}
                  ref={(el) => {
                    navLinksRef.current[index] = el;
                  }}
                  className="relative"
                >
                  <a
                    href={location.pathname === '/' ? item.href : `/${item.href}`}
                    onClick={(e) => handleNavClick(e, item.href)}
                    onMouseEnter={() => setHoveredTab(item.id)}
                    onMouseLeave={() => setHoveredTab(null)}
                    className={`
                      relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs sm:text-[13px] font-medium tracking-tight
                      transition-colors duration-150 select-none
                      active:scale-95
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400
                      ${isActive || isHovered ? 'text-white' : 'text-white/70 hover:text-white'}
                    `}
                  >
                    {/* Apple Fluid Spring Pill Indicator */}
                    {showPill && (
                      <motion.div
                        layoutId="appleNavPill"
                        className="absolute inset-0 rounded-full bg-white/10 border border-white/15 shadow-sm backdrop-blur-md -z-10"
                        transition={{
                          type: 'spring',
                          stiffness: 450,
                          damping: 35,
                          mass: 0.8,
                        }}
                      />
                    )}
                    <Icon className={`w-3.5 h-3.5 transition-colors duration-150 ${isActive || isHovered ? 'text-white' : 'text-white/60'}`} />
                    <span className="relative z-10">{item.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── Right Group: Sign In Button + Mobile Menu ── */}
        <div className="flex items-center gap-2">
          {/* Apple-style Action Button */}
          <Link
            ref={signInRef}
            to="/login"
            className="
              relative inline-flex items-center justify-center gap-1.5
              px-3.5 py-1.5 rounded-full
              text-[12.5px] font-medium tracking-tight text-white
              bg-[#0071E3] hover:bg-[#0077ED]
              border border-white/10
              shadow-[0_2px_8px_rgba(0,113,227,0.3)]
              backdrop-blur-md
              active:scale-95 transition-all duration-150
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]/50
            "
          >
            <LogIn className="w-3.5 h-3.5 text-white/90" />
            <span>Sign In</span>
          </Link>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            aria-controls="mobileMenu"
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="
              md:hidden p-2 rounded-full
              text-white/75 hover:text-white
              hover:bg-white/10 active:scale-90
              transition-all duration-150
              focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400
            "
          >
            {isMenuOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </button>
        </div>
      </nav>

      {/* ── Apple-style Mobile Dropdown Sheet ── */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            id="mobileMenu"
            ref={menuRef}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 30,
            }}
            className="
              absolute top-[4.25rem] left-4 right-4 pointer-events-auto
              bg-slate-900/40 backdrop-blur-2xl backdrop-saturate-150
              border border-white/10
              rounded-2xl p-2.5
              shadow-[0_12px_32px_rgba(0,0,0,0.35)]
              outline-none md:hidden
            "
          >
            <ul className="flex flex-col gap-1.5">
              {NAV_ITEMS.map((item) => {
                const isActive = activeSection === item.id;
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <a
                      href={location.pathname === '/' ? item.href : `/${item.href}`}
                      onClick={(e) => {
                        handleNavClick(e, item.href);
                        closeMenu();
                      }}
                      className={`
                        flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl
                        text-xs font-medium tracking-tight
                        transition-all duration-150 active:scale-[0.98]
                        ${isActive
                          ? 'bg-white/[0.14] border border-white/15 text-white font-semibold shadow-sm'
                          : 'text-white/75 hover:text-white hover:bg-white/[0.08]'
                        }
                      `}
                    >
                      <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white/15 text-white' : 'bg-white/5 text-white/60'}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span>{item.label}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-white/30 ml-auto" />
                    </a>
                  </li>
                );
              })}
              <li className="pt-1.5 border-t border-white/10 mt-1">
                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="
                    flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                    text-xs font-semibold text-white
                    bg-violet-600 hover:bg-violet-500
                    border border-violet-400/30
                    shadow-[0_2px_12px_rgba(124,58,237,0.3)]
                    active:scale-[0.98] transition-all duration-150
                  "
                >
                  <LogIn className="w-3.5 h-3.5 text-violet-200" />
                  <span>Sign In</span>
                </Link>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
