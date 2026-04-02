/**
 * Classify.jsx  —  Garment classification page
 *
 * Bug-fixes vs original:
 *  1. URL.revokeObjectURL called on cleanup (memory leak).
 *  2. Grid div now has className="classify-grid" (media-query was broken).
 *  3. Loading guard prevents double-submit.
 *  4. imageToBase64 error surfaced to UI instead of silently failing.
 *  5. ConfidenceBar max=0 guard (division by zero when all scores are 0).
 *  6. result.styling_tip fallback when backend omits the field.
 *  7. all_items optional-chaining guard (?. slice).
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Scan, X, ChevronDown, Sparkles } from 'lucide-react';
import { classifyImage, imageToBase64 } from '../utils/api';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5 } }),
};

// FIX 5: guard max against 0
function ConfidenceBar({ label, value, max = 1 }) {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.min(100, Math.round((value / safeMax) * 100));
  return (
    <div className="confidence-item">
      <div className="confidence-row">
        <span className="confidence-label">{label}</span>
        <span className="confidence-value">{pct}%</span>
      </div>
      <div className="progress-bar">
        <motion.div
          className="progress-fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: 0.2 }}
        />
      </div>
    </div>
  );
}

function ResultSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="result-panel" style={{ marginBottom: '1rem' }}>
      <div
        className="result-panel-header"
        style={{ cursor: 'pointer' }}
        onClick={() => setOpen((o) => !o)}
        role="button"
        aria-expanded={open}
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setOpen((o) => !o)}
      >
        <span style={{ fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
          {title}
        </span>
        <ChevronDown
          size={14}
          style={{ color: 'var(--ink-muted)', transition: 'transform 0.3s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="result-panel-body">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Classify() {
  const [image, setImage]       = useState(null);
  const [imageB64, setImageB64] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();
  // FIX 1: track object URL so we can revoke it
  const objectUrlRef = useRef(null);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const handleFile = useCallback(async (file) => {
    if (!file?.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPG, PNG, or WebP).');
      return;
    }
    // FIX 1: revoke previous object URL before creating new one
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setImage(url);
    setResult(null);
    setError(null);

    try {
      const b64 = await imageToBase64(file);
      setImageB64(b64);
    } catch {
      setError('Failed to read the image file. Please try again.');
      setImage(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // FIX 3: guard against double-submit with loading check
  const handleAnalyze = async () => {
    if (!imageB64 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await classifyImage(imageB64);
      setResult(res.data);
    } catch (err) {
      setError(err.message || 'Classification failed. Check backend status.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setImage(null);
    setImageB64(null);
    setResult(null);
    setError(null);
  };

  const cls = result?.classification;
  const maxStyleVal = cls ? Math.max(0.001, ...Object.values(cls.style  || {})) : 1;
  const maxOccVal   = cls ? Math.max(0.001, ...Object.values(cls.occasions || {})) : 1;
  const maxBodyVal  = cls ? Math.max(0.001, ...Object.values(cls.body_types || {})) : 1;

  return (
    <motion.div className="page" initial="hidden" animate="show" exit={{ opacity: 0 }}>
      <div className="container">
        {/* Header */}
        <motion.div variants={fadeUp} custom={0} style={{ marginBottom: '3rem' }}>
          <span className="section-eyebrow"></span>
          <h1>Garment Classifier</h1>
          <div className="gold-line" />
          <p style={{ maxWidth: 560 }}>
           Spot something. Save it. Upload it. We'll tell you everything about it..
          </p>
        </motion.div>

        {/* FIX 2: className="classify-grid" added so media query works */}
        <div
          className="classify-grid"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}
        >
          {/* Left: Upload */}
          <motion.div variants={fadeUp} custom={1}>
            {!image ? (
              <div
                className={`upload-zone ${dragging ? 'dragging' : ''}`}
                style={{ minHeight: 320 }}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Upload garment image"
                onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleFile(e.target.files[0])}
                  style={{ display: 'none' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', pointerEvents: 'none' }}>
                  <div style={{
                    width: 60, height: 60, border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: dragging ? 'var(--gold)' : 'var(--grey)',
                  }}>
                    <Upload size={24} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--ink)', marginBottom: '0.25rem', fontSize: '0.95rem' }}>Drop your garment image</p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>or click to browse · JPG, PNG, WEBP</p>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <img
                  src={image}
                  alt="uploaded garment"
                  style={{
                    width: '100%', borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)', maxHeight: 400,
                    objectFit: 'contain', background: 'var(--bg-subtle)',
                  }}
                />
                <button
                  onClick={reset}
                  aria-label="Remove image"
                  style={{
                    position: 'absolute', top: '0.75rem', right: '0.75rem',
                    width: 32, height: 32, background: 'rgba(250,248,245,0.9)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    cursor: 'pointer', color: 'var(--ink-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={14} />
                </button>
                <button
                  className="btn btn-gold"
                  style={{ marginTop: '1rem', width: '100%', justifyContent: 'center' }}
                  onClick={handleAnalyze}
                  disabled={loading || !imageB64}
                >
                  {loading
                    ? <><span className="spinner" /> Analysing…</>
                    : <><Scan size={16} /> Analyse Garment</>}
                </button>
              </div>
            )}

            {error && (
              <div style={{
                marginTop: '1rem', padding: '1rem',
                background: 'rgba(196,84,74,0.1)', border: '1px solid rgba(196,84,74,0.3)',
                borderRadius: 'var(--radius)', color: 'var(--error)', fontSize: '0.85rem',
              }}>
                {error}
              </div>
            )}
          </motion.div>

          {/* Right: Results */}
          <motion.div variants={fadeUp} custom={2}>
            {!result && !loading && (
              <div style={{
                height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px dashed var(--border)', borderRadius: 'var(--radius)',
                color: 'var(--ink-muted)', flexDirection: 'column', gap: '0.75rem',
              }}>
                <Sparkles size={24} style={{ color: 'var(--border)' }} />
                <span style={{ fontSize: '0.8rem', letterSpacing: '0.08em' }}>Results appear here</span>
              </div>
            )}

            {loading && (
              <div style={{
                height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                flexDirection: 'column', gap: '1.25rem',
              }}>
                <div style={{
                  width: 48, height: 48, border: '2px solid var(--border)',
                  borderTop: '2px solid var(--gold)', borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }} />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: 'var(--ink)', marginBottom: '0.25rem' }}>Ensemble AI Processing</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>CLIP + ViT + SBERT analysing…</p>
                </div>
              </div>
            )}

            {result && cls && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <ResultSection title="Primary Detection">
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <span className="tag gold" style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}>
                      {cls.primary_item}
                    </span>
                    <span className="tag">{cls.category}</span>
                  </div>
                  {/* FIX 7: optional chaining */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {cls.all_items?.slice(1, 4).map(([item]) => (
                      <span key={item} className="tag" style={{ fontSize: '0.72rem' }}>{item}</span>
                    ))}
                  </div>
                </ResultSection>

                <ResultSection title="Garment Attributes">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    {[
                      ['Pattern',   cls.attributes?.pattern],
                      ['Material',  cls.attributes?.material],
                      ['Fit',       cls.attributes?.fit],
                      ['Top Color', Object.keys(cls.attributes?.colors || {})[0]],
                    ].map(([k, v]) => (
                      <div key={k} style={{ padding: '0.75rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius)' }}>
                        <div style={{ fontSize: '0.6rem', color: 'var(--ink-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{k}</div>
                        <div style={{ fontSize: '0.88rem', color: 'var(--ink)' }}>{v || '—'}</div>
                      </div>
                    ))}
                  </div>
                </ResultSection>

                <ResultSection title="Style Profile" defaultOpen={false}>
                  {Object.entries(cls.style || {}).slice(0, 4).map(([k, v]) => (
                    <ConfidenceBar key={k} label={k} value={v} max={maxStyleVal} />
                  ))}
                </ResultSection>

                <ResultSection title="Best Occasions" defaultOpen={false}>
                  {Object.entries(cls.occasions || {}).slice(0, 4).map(([k, v]) => (
                    <ConfidenceBar key={k} label={k} value={v} max={maxOccVal} />
                  ))}
                </ResultSection>

                <ResultSection title="Body Type Suitability" defaultOpen={false}>
                  {Object.entries(cls.body_types || {}).slice(0, 5).map(([k, v]) => (
                    <ConfidenceBar key={k} label={k.replace('_', ' ')} value={v} max={maxBodyVal} />
                  ))}
                </ResultSection>

                {/* FIX 6: guard when styling_tip is absent */}
                {result.styling_tip && (
                  <div style={{
                    marginTop: '0.5rem', padding: '1.25rem',
                    background: 'rgba(181,103,77,0.06)', border: '1px solid rgba(181,103,77,0.2)',
                    borderRadius: 'var(--radius)',
                  }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--terracotta)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      ✦ AI Styling Insight
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', fontStyle: 'italic', lineHeight: 1.7 }}>
                      {result.styling_tip}
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .classify-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </motion.div>
  );
}
