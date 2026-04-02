import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Navbar({ backendStatus }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location]);

  const links = [
    { path: '/', label: 'Home' },
    { path: '/classify', label: 'Classify' },
    { path: '/recommend', label: 'Recommend' },
    { path: '/color-analysis', label: 'Colour Analysis' },
  ];

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      padding: '1.1rem 2rem',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: scrolled ? 'rgba(250,248,245,0.96)' : 'transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: scrolled ? '1px solid #E4DDD4' : '1px solid transparent',
      transition: 'all 0.3s ease'
    }}>
      {/* Logo */}
      <Link to="/" style={{ textDecoration: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 32, height: 32, border: '1.5px solid #B5674D',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.65rem', color: '#B5674D', letterSpacing: '0.08em',
            fontFamily: 'Jost, sans-serif', fontWeight: 500, borderRadius: 2
          }}>FA</div>
          <span style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: '1.1rem', fontWeight: 400, color: '#1C1917',
            letterSpacing: '0.06em'
          }}>Fashion AI</span>
        </div>
      </Link>

      {/* Desktop Links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}
           className="desktop-nav">
        {links.map(({ path, label }) => (
          <Link key={path} to={path} style={{
            textDecoration: 'none',
            fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase',
            color: location.pathname === path ? '#B5674D' : '#78716C',
            transition: 'color 0.3s ease', position: 'relative', paddingBottom: '2px',
            fontWeight: 500
          }}>
            {label}
            {location.pathname === path && (
              <motion.div layoutId="nav-underline" style={{
                position: 'absolute', bottom: -2, left: 0, right: 0,
                height: '1.5px', background: '#B5674D', borderRadius: 999
              }} />
            )}
          </Link>
        ))}

        {/* Status indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={`status-dot ${backendStatus}`} />
          <span style={{ fontSize: '0.62rem', color: '#A8A29E', letterSpacing: '0.1em', fontWeight: 500 }}>
            {backendStatus === 'online' ? 'AI ONLINE' : backendStatus === 'offline' ? 'OFFLINE' : 'CONNECTING'}
          </span>
        </div>
      </div>

      {/* Mobile Menu Button */}
      <button onClick={() => setMenuOpen(!menuOpen)} style={{
        display: 'none', background: 'none', border: 'none',
        cursor: 'pointer', color: '#1C1917', padding: '0.5rem'
      }} className="mobile-menu-btn">
        <div style={{ width: 20, display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <span style={{ display: 'block', height: 1.5, background: menuOpen ? '#B5674D' : '#1C1917', transition: '0.3s', borderRadius: 999 }} />
          <span style={{ display: 'block', height: 1.5, background: menuOpen ? '#B5674D' : '#1C1917', transition: '0.3s', width: menuOpen ? '60%' : '100%', borderRadius: 999 }} />
          <span style={{ display: 'block', height: 1.5, background: menuOpen ? '#B5674D' : '#1C1917', transition: '0.3s', borderRadius: 999 }} />
        </div>
      </button>

      {/* Mobile Menu */}
      {menuOpen && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: 'rgba(250,248,245,0.98)', backdropFilter: 'blur(12px)',
            borderBottom: '1px solid #E4DDD4', padding: '1.5rem 2rem',
            display: 'flex', flexDirection: 'column', gap: '1.25rem'
          }}>
          {links.map(({ path, label }) => (
            <Link key={path} to={path} style={{
              textDecoration: 'none', fontSize: '0.8rem', letterSpacing: '0.1em',
              textTransform: 'uppercase', color: location.pathname === path ? '#B5674D' : '#78716C',
              fontWeight: 500
            }}>{label}</Link>
          ))}
        </motion.div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: block !important; }
        }
      `}</style>
    </nav>
  );
}
