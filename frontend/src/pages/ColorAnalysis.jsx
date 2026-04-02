import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Palette, Check } from 'lucide-react';
import { analyzeColors, imageToBase64 } from '../utils/api';

const SKIN_TONES = [
  { key: 'fair_cool', label: 'Fair · Cool', hex: '#F5E6D8', sub: 'Pink/rosy undertones' },
  { key: 'fair_warm', label: 'Fair · Warm', hex: '#F0D5B0', sub: 'Peachy/golden undertones' },
  { key: 'medium_cool', label: 'Medium · Cool', hex: '#C8956C', sub: 'Olive/neutral undertones' },
  { key: 'medium_warm', label: 'Medium · Warm', hex: '#C07B4A', sub: 'Golden/warm undertones' },
  { key: 'dark_cool', label: 'Deep · Cool', hex: '#7B4F35', sub: 'Blue/cool undertones' },
  { key: 'dark_warm', label: 'Deep · Warm', hex: '#6B3A28', sub: 'Red/warm undertones' },
];

const COLOR_NAMES_TO_HEX = {
  navy: '#1a237e', 'royal blue': '#4169e1', 'emerald green': '#009b77',
  burgundy: '#800020', charcoal: '#36454f', lavender: '#b57bee',
  rose: '#ff007f', 'icy pink': '#ffd1dc', orange: '#ff6600',
  'warm yellow': '#ffd700', gold: '#ffd700', rust: '#b7410e',
  coral: '#ff6b6b', peach: '#ffb347', 'warm red': '#c41e3a',
  'golden yellow': '#ffc200', camel: '#c19a6b', 'warm brown': '#964b00',
  'olive green': '#808000', black: '#1a1a1a', 'stark white': '#f8f8f8',
  cream: '#fffdd0', ivory: '#fffff0', 'warm beige': '#f5e6c8',
  'jewel tones': '#4b0082', cobalt: '#0047ab', fuchsia: '#ff00ff',
  'deep purple': '#673ab7', teal: '#008080', emerald: '#50c878',
  'cool pink': '#ff69b4', 'warm terracotta': '#c24a2a', mustard: '#e3aa2c',
  'forest green': '#228b22', caramel: '#c68642', 'bright cobalt': '#0047ab',
  white: '#ffffff', red: '#dc143c', 'royal purple': '#6b3fa0',
  'electric blue': '#7df9ff', 'bright yellow': '#ffff00',
  'burnt orange': '#cc5500', 'earth tones': '#a0522d',
  'warm ivory': '#fffff0', tan: '#d2b48c', grey: '#808080',
  'soft lavender': '#e6e6fa', 'bright white': '#ffffff',
  'light grey': '#d3d3d3', 'cool pastels': '#b0e0e6',
  'icy blues': '#b0c4de', 'ashy greys': '#708090',
  'warm white': '#fdf5e6', 'cool greys': '#a9a9a9',
  'muted earth tones': '#8b7355', 'dull khaki': '#bdb76b',
  'dark navy': '#000080'
};

const getHex = (colorName) => {
  const lower = colorName?.toLowerCase().trim();
  return COLOR_NAMES_TO_HEX[lower] || '#888888';
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } })
};

function ColorPill({ color, avoid }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.6rem',
      padding: '0.45rem 0.85rem',
      border: `1px solid ${avoid ? 'rgba(196,84,74,0.3)' : 'var(--border)'}`,
      borderRadius: 999, background: 'var(--bg-subtle)'
    }}>
      <div style={{
        width: 14, height: 14, borderRadius: '50%',
        background: getHex(color), border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0
      }} />
      <span style={{ fontSize: '0.78rem', color: avoid ? 'var(--error)' : 'var(--grey-light)' }}>
        {color}
      </span>
    </div>
  );
}

export default function ColorAnalysis() {
  const [mode, setMode] = useState('manual'); // 'manual' | 'selfie'
  const [selectedTone, setSelectedTone] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [selfieB64, setSelfieB64] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  const handleSelfie = useCallback(async (file) => {
    if (!file?.type.startsWith('image/')) return;
    setSelfie(URL.createObjectURL(file));
    const b64 = await imageToBase64(file);
    setSelfieB64(b64);
    setResult(null);
  }, []);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await analyzeColors(
        mode === 'selfie' ? selfieB64 : null,
        mode === 'manual' ? selectedTone : null
      );
      setResult(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || 'Analysis failed. Check backend.');
    } finally {
      setLoading(false);
    }
  };

  const canAnalyze = (mode === 'manual' && selectedTone) || (mode === 'selfie' && selfieB64);
  const colourRec = result?.color_recommendations;
  const skinAnalysis = result?.skin_analysis;

  return (
    <motion.div className="page" initial="hidden" animate="show" exit={{ opacity: 0 }}>
      <div className="container">
        <motion.div variants={fadeUp} custom={0} style={{ marginBottom: '3rem' }}>
          <span className="section-eyebrow"></span>
          <h1>Colour Analysis</h1>
          <div className="gold-line" />
          <p style={{ maxWidth: 560 }}>
            Discover which colours genuinely enhance your natural complexion.
            Upload a selfie for AI-powered skin tone detection, or manually select your tone.
          </p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '2rem', alignItems: 'start' }}>

          {/* Input Panel */}
          <motion.div variants={fadeUp} custom={1}>
            {/* Mode Toggle */}
            <div style={{
              display: 'flex', background: 'var(--bg-subtle)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              padding: '0.25rem', marginBottom: '2rem'
            }}>
              {['manual', 'selfie'].map(m => (
                <button key={m} onClick={() => { setMode(m); setResult(null); }}
                  style={{
                    flex: 1, padding: '0.65rem', background: mode === m ? 'var(--gold)' : 'transparent',
                    color: mode === m ? '#000' : 'var(--grey)',
                    border: 'none', borderRadius: 'var(--radius)',
                    fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase',
                    cursor: 'pointer', transition: 'all 0.3s', fontFamily: 'var(--font-body)'
                  }}>
                  {m === 'manual' ? '📊 Manual Select' : '📸 Upload Selfie'}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {mode === 'manual' && (
                <motion.div key="manual" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label className="input-label" style={{ marginBottom: '1rem', display: 'block' }}>
                      Select your skin tone
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {SKIN_TONES.map(tone => (
                        <div key={tone.key}
                          onClick={() => setSelectedTone(tone.key)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '1rem',
                            padding: '0.85rem 1rem', cursor: 'pointer',
                            border: `1px solid ${selectedTone === tone.key ? 'var(--gold)' : 'var(--border)'}`,
                            borderRadius: 'var(--radius)', background: 'var(--bg-subtle)',
                            transition: 'all 0.2s'
                          }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: tone.hex, flexShrink: 0,
                            border: selectedTone === tone.key ? '2px solid var(--gold)' : '2px solid transparent'
                          }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--ink)' }}>{tone.label}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>{tone.sub}</div>
                          </div>
                          {selectedTone === tone.key && <Check size={14} style={{ color: 'var(--terracotta)' }} />}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {mode === 'selfie' && (
                <motion.div key="selfie" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {!selfie ? (
                    <div className="upload-zone" style={{ minHeight: 240 }}
                      onClick={() => fileRef.current?.click()}>
                      <input ref={fileRef} type="file" accept="image/*"
                        onChange={e => handleSelfie(e.target.files[0])} style={{ display: 'none' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', pointerEvents: 'none' }}>
                        <Upload size={24} style={{ color: 'var(--ink-muted)' }} />
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ color: 'var(--ink)', marginBottom: '0.25rem' }}>Upload a clear selfie</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                            Face clearly visible · Natural lighting · No filters
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <img src={selfie} alt="selfie" style={{
                        width: '100%', maxHeight: 280, objectFit: 'cover',
                        borderRadius: 'var(--radius)', border: '1px solid var(--border)'
                      }} />
                      <button onClick={() => { setSelfie(null); setSelfieB64(null); setResult(null); }}
                        style={{
                          position: 'absolute', top: '0.5rem', right: '0.5rem',
                          background: 'rgba(8,8,8,0.8)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)', color: 'var(--ink-muted)', cursor: 'pointer',
                          padding: '0.3rem 0.6rem', fontSize: '0.7rem'
                        }}>Change</button>
                    </div>
                  )}

                  {selfieB64 && skinAnalysis && (
                    <div style={{
                      marginTop: '1rem', padding: '1rem',
                      background: 'rgba(181,103,77,0.06)', border: '1px solid rgba(181,103,77,0.2)',
                      borderRadius: 'var(--radius)'
                    }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--terracotta)', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>
                        DETECTED SKIN TONE
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: `rgb(${skinAnalysis.rgb_average?.join(',')})`,
                          border: '2px solid var(--gold)'
                        }} />
                        <span style={{ fontSize: '0.9rem' }}>{skinAnalysis.detected_tone}</span>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <div style={{
                marginTop: '1rem', padding: '0.85rem 1rem',
                background: 'rgba(196,84,74,0.08)', border: '1px solid rgba(196,84,74,0.25)',
                borderRadius: 'var(--radius)', color: 'var(--error)', fontSize: '0.82rem'
              }}>{error}</div>
            )}

            <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center', marginTop: '1.5rem' }}
              onClick={handleAnalyze} disabled={loading || !canAnalyze}>
              {loading
                ? <><span className="spinner" style={{ borderColor: 'rgba(0,0,0,0.2)', borderTopColor: '#000' }} /> Analysing...</>
                : <><Palette size={16} /> Analyse My Palette</>}
            </button>
          </motion.div>

          {/* Results Panel */}
          <motion.div variants={fadeUp} custom={2}>
            {!result && !loading && (
              <div style={{
                minHeight: 400, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                border: '1px dashed var(--border)', borderRadius: 'var(--radius)',
                color: 'var(--ink-muted)', gap: '1rem', textAlign: 'center', padding: '2rem'
              }}>
                <Palette size={32} style={{ color: 'var(--border)' }} />
                <p style={{ fontSize: '0.85rem' }}>Your personalised colour palette<br />will appear here</p>
              </div>
            )}

            {loading && (
              <div style={{
                minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                flexDirection: 'column', gap: '1.5rem'
              }}>
                <div style={{
                  width: 52, height: 52, border: '2px solid var(--border)',
                  borderTop: '2px solid var(--gold)', borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <p style={{ color: 'var(--ink-muted)' }}>Analysing your complexion...</p>
              </div>
            )}

            {colourRec && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* Tone Header */}
                <div style={{
                  padding: '1.5rem 2rem', background: 'var(--bg-card)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)'
                }}>
                  <span style={{ fontSize: '0.6rem', color: 'var(--terracotta)', letterSpacing: '0.15em', display: 'block', marginBottom: '0.5rem' }}>
                    YOUR SEASON
                  </span>
                  <h2 style={{ marginBottom: '0.5rem' }}>{colourRec.skin_tone}</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>{colourRec.description}</p>
                  {colourRec.styling_tip && (
                    <p style={{
                      marginTop: '1rem', padding: '1rem', background: 'rgba(181,103,77,0.06)',
                      border: '1px solid rgba(181,103,77,0.12)', borderRadius: 'var(--radius)',
                      fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--ink-soft)', lineHeight: 1.7
                    }}>✦ {colourRec.styling_tip}</p>
                  )}
                </div>

                {/* Best Colors */}
                <div style={{
                  padding: '1.5rem', background: 'var(--bg-card)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)'
                }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--success)', letterSpacing: '0.15em', marginBottom: '1rem' }}>
                    ✓ WEAR THESE · They enhance your natural glow
                  </div>
                  {/* Big swatches */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                    {colourRec.best_colors?.slice(0, 6).map(c => (
                      <div key={c} style={{ textAlign: 'center' }}>
                        <div style={{
                          width: 48, height: 48, borderRadius: '50%',
                          background: getHex(c), border: '2px solid var(--border)',
                          marginBottom: '0.4rem'
                        }} />
                        <span style={{ fontSize: '0.6rem', color: 'var(--ink-muted)' }}>{c}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {colourRec.best_colors?.map(c => <ColorPill key={c} color={c} />)}
                  </div>
                </div>

                {/* Neutrals */}
                <div style={{
                  padding: '1.25rem 1.5rem', background: 'var(--bg-card)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)'
                }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--ink-muted)', letterSpacing: '0.15em', marginBottom: '1rem' }}>
                    ◈ YOUR POWER NEUTRALS
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {colourRec.neutral_colors?.map(c => (
                      <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.85rem', border: '1px solid var(--border)', borderRadius: 999 }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: getHex(c) }} />
                        <span style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Avoid Colors */}
                <div style={{
                  padding: '1.25rem 1.5rem', background: 'rgba(196,84,74,0.04)',
                  border: '1px solid rgba(196,84,74,0.2)', borderRadius: 'var(--radius)'
                }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--error)', letterSpacing: '0.15em', marginBottom: '1rem' }}>
                    ✕ MINIMISE THESE · Can clash with your undertone
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {colourRec.avoid_colors?.map(c => <ColorPill key={c} color={c} avoid />)}
                  </div>
                </div>

              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
