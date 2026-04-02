import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Classify from './pages/Classify';
import Recommend from './pages/Recommend';
import ColorAnalysis from './pages/ColorAnalysis';
import { checkHealth } from './utils/api';
import './App.css';

export default function App() {
  const [backendStatus, setBackendStatus] = useState('checking');
  const [backendInfo, setBackendInfo] = useState(null);

  useEffect(() => {
    const ping = async () => {
      try {
        const res = await checkHealth();
        setBackendStatus('online');
        setBackendInfo(res.data);
      } catch {
        setBackendStatus('offline');
      }
    };
    ping();
    const interval = setInterval(ping, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Router>
      <div className="app">
        <Navbar backendStatus={backendStatus} />
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<Home backendStatus={backendStatus} backendInfo={backendInfo} />} />
            <Route path="/classify" element={<Classify />} />
            <Route path="/recommend" element={<Recommend />} />
            <Route path="/color-analysis" element={<ColorAnalysis />} />
          </Routes>
        </AnimatePresence>
      </div>
    </Router>
  );
}
