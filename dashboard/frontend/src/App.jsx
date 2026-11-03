import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import LiveTracker from './pages/LiveTracker';
import MobileGps from './pages/MobileGps';
import EirDemo from './pages/EirDemo';
import Subscribers from './pages/Subscribers';
import Cells from './pages/Cells';
import Mobility from './pages/Mobility';
import Positioning from './pages/Positioning';
import Protocols from './pages/Protocols';
import Audit from './pages/Audit';
import Reports from './pages/Reports';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tracker" element={<LiveTracker />} />
        <Route path="/mobile-gps" element={<MobileGps />} />
        <Route path="/eir-demo" element={<EirDemo />} />
        <Route path="/subscribers" element={<Subscribers />} />
        <Route path="/cells" element={<Cells />} />
        <Route path="/mobility" element={<Mobility />} />
        <Route path="/positioning" element={<Positioning />} />
        <Route path="/protocols" element={<Protocols />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/reports" element={<Reports />} />
      </Route>
    </Routes>
  );
}
