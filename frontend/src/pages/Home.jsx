import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Scan, Sparkles, Palette, ArrowRight, Cpu, Zap, Eye } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.11, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } })
};

export default function Home({ backendStatus, backendInfo }) {
  const features = [
    {
      icon: <Scan size={18} />,
      title: 'Garment Classification',
      desc: '',
      link: '/classify', label: 'Classify a Garment', accent: '#B5674D'
    },
    {
      icon: <Sparkles size={18} />,
      title: 'Outfit Recommendations',
      desc: '.',
      link: '/recommend', label: 'Get Recommendations', accent: '#6B8C74'
    },
    {
      icon: <Palette size={18} />,
      title: 'Colour Analysis',
      desc: 'Upload a selfie or select your skin tone for science-backed colour palette recommendations that genuinely enhance your complexion.',
      link: '/color-analysis', label: 'Analyse Colours', accent: '#C8AE8A'
    }
  ];

  const models = [
    { name: 'CLIP ViT-L/14', role: 'Zero-shot visual classification', org: 'OpenAI' },
    { name: 'ViT-base-patch16', role: 'Fashion attribute detection', org: 'Google' },
    { name: 'Sentence-BERT mpnet', role: 'Semantic style matching', org: 'HuggingFace' }
  ];

  return (
    <motion.div className="page" initial="hidden" animate="show" exit={{ opacity: 0 }}>
      <section style={{ padding: '3rem 0 5.5rem', textAlign: 'center' }}>
        <div className="container">
          
          <motion.h1 variants={fadeUp} custom={1} style={{ maxWidth: 780, margin: '0 auto', color: '#1C1917' }}>
            Fashion intelligence,{' '}<span style={{ color: '#B5674D', fontStyle: 'italic' }}>redefined.</span>
          </motion.h1>
          <motion.div className="gold-line center" variants={fadeUp} custom={2} />
          <motion.p variants={fadeUp} custom={3} style={{ maxWidth: 560, margin: '0 auto 3rem', fontSize: '1rem', color: '#796555', lineHeight: 1.8 }}>
           The fashion system that knows your wardrobe — reads every piece you own, builds outfits made for you, and finds colours that feel like they were always yours.
          </motion.p>
          <motion.div variants={fadeUp} custom={4} style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/classify" className="btn btn-gold"><Scan size={15} /> Classify a Garment</Link>
            <Link to="/recommend" className="btn btn-outline"><Sparkles size={15} /> Get Recommendations</Link>
          </motion.div>
          {backendStatus === 'online' && (
            <motion.div variants={fadeUp} custom={5} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', marginTop: '2.5rem', padding: '0.45rem 1.1rem', border: '1px solid rgba(74,124,89,0.25)', borderRadius: 999, background: 'rgba(74,124,89,0.07)' }}>
              <span className="status-dot online" />
              <span style={{ fontSize: '0.68rem', letterSpacing: '0.1em', color: '#6B8C74', fontWeight: 500 }}>AI BACKEND ONLINE · {backendInfo?.device?.toUpperCase() || 'GPU'}</span>
            </motion.div>
          )}
          {backendStatus === 'offline' && (
            <motion.div variants={fadeUp} custom={5} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', marginTop: '2.5rem', padding: '0.45rem 1.1rem', border: '1px solid rgba(155,60,60,0.25)', borderRadius: 999, background: 'rgba(155,60,60,0.06)' }}>
              <span className="status-dot offline" />
              <span style={{ fontSize: '0.68rem', letterSpacing: '0.1em', color: '#9B3C3C', fontWeight: 500 }}>BACKEND OFFLINE · Start the Colab notebook</span>
            </motion.div>
          )}
        </div>
      </section>

      

      

      
    </motion.div>
  );
}
