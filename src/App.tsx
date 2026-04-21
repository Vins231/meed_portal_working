/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { User } from './types';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Planning from './components/Planning';
import UnderApproval from './components/UnderApproval';
import Profile from './components/Profile';
import Tender from './components/Tender';
import Awarded from './components/Awarded';
import BGTracker from './components/BGTracker';
import Reports from './components/Reports';
import ActivityLog from './components/ActivityLog';
import Admin from './components/Admin';
import Calendar from './components/Calendar';
import { supabase } from './lib/supabase';
import { api } from './services/api';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session in localStorage
    const savedUser = localStorage.getItem('meed_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('meed_user');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--navy)]">
        <div className="w-10 h-10 border-4 border-white/10 border-t-[var(--teal)] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={user ? <Navigate to="/" /> : <Login onLogin={setUser} />} 
        />
        
        <Route element={user ? <Layout user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/planning" element={<Planning user={user} />} />
          <Route path="/approval" element={<UnderApproval />} />
          <Route path="/tender" element={<Tender />} />
          <Route path="/awarded" element={<Awarded />} />
          <Route path="/bg" element={<BGTracker user={user} />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/activity" element={<ActivityLog />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/admin" element={<Admin user={user} />} />
          <Route path="/profile" element={<Profile user={user} />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
