import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import {
  Radio, Smartphone, MapPin, Signal, Shield, ShieldAlert,
  Play, Pause, ArrowLeft, RefreshCw, CheckCircle, Wifi, Compass
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function MobileGps() {
  const [phoneNumber, setPhoneNumber] = useState('+91 89175 88693');
  const [imei, setImei] = useState('355780160674584');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [coords, setCoords] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [speed, setSpeed] = useState(null);
  const [heading, setHeading] = useState(null);
  const [altitude, setAltitude] = useState(null);
  const [lastTxTime, setLastTxTime] = useState(null);
  const [txCount, setTxCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Idle. Tap "Start Live Broadcast" to begin.');
  const [error, setError] = useState(null);

  const watchIdRef = useRef(null);
  const txCountRef = useRef(0);

  const sendTelemetry = async (latitude, longitude, acc, spd, hdg, alt) => {
    try {
      const payload = {
        phone_number: phoneNumber,
        imei: imei,
        latitude,
        longitude,
        accuracy: acc || 10.0,
        speed: spd != null ? Math.round(spd * 3.6) : 0.0,
        heading: hdg || 0.0,
        altitude: alt || 0.0,
        network_type: '5G-NR-Standalone',
      };
      await api.post('/tracker/device-telemetry', payload);
      setLastTxTime(new Date().toLocaleTimeString());
      txCountRef.current += 1;
      setTxCount(txCountRef.current);
      setStatusMessage(`Broadcasting live fix #${txCountRef.current} to 5G Core`);
    } catch (err) {
      console.error('Failed to transmit telemetry', err);
    }
  };

  const startBroadcasting = () => {
    if (!navigator.geolocation) {
      setError('HTML5 Geolocation is not supported on this device/browser.');
      return;
    }

    setError(null);
    setIsBroadcasting(true);
    setStatusMessage('Acquiring high-accuracy satellite GPS fix...');

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const acc = pos.coords.accuracy;
        const spd = pos.coords.speed;
        const hdg = pos.coords.heading;
        const alt = pos.coords.altitude;

        setCoords({ lat, lon });
        setAccuracy(acc);
        setSpeed(spd != null ? (spd * 3.6).toFixed(1) : '0.0');
        setHeading(hdg != null ? Math.round(hdg) : null);
        setAltitude(alt != null ? Math.round(alt) : null);

        sendTelemetry(lat, lon, acc, spd, hdg, alt);
      },
      (err) => {
        setError(`GPS Error (${err.code}): ${err.message}. Please allow location access in your browser settings.`);
        setIsBroadcasting(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );

    watchIdRef.current = id;
  };

  const stopBroadcasting = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsBroadcasting(false);
    setStatusMessage('Broadcasting stopped.');
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return (
    <div className="max-w-md mx-auto p-4 space-y-4 font-sans text-slate-100">
      {/* Top Banner */}
      <div className="flex items-center justify-between border-b border-slate-700 pb-3">
        <Link to="/tracker" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Return to Map
        </Link>
        <span className="text-[11px] bg-blue-500/10 border border-blue-500/30 text-blue-300 px-2.5 py-0.5 rounded-full font-mono">
          5G UE Mobile Beacon
        </span>
      </div>

      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold text-white flex items-center justify-center gap-2">
          <Smartphone className="w-5 h-5 text-cyan-400" />
          Real Device Live GPS Uplink
        </h1>
        <p className="text-xs text-slate-400">
          Stream your physical phone's GPS telemetry directly into the 5G Core & CEIR tracking system.
        </p>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Identity Configuration */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3 shadow-md">
        <div>
          <label className="block text-[11px] text-slate-400 font-semibold mb-1">
            Device Phone Number (MSISDN)
          </label>
          <input
            type="text"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            disabled={isBroadcasting}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-cyan-300 font-mono font-bold focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 font-semibold mb-1">
            Hardware Terminal (IMEI)
          </label>
          <input
            type="text"
            value={imei}
            onChange={(e) => setImei(e.target.value)}
            disabled={isBroadcasting}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Broadcast Control Button */}
      <div>
        {isBroadcasting ? (
          <button
            onClick={stopBroadcasting}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-rose-600 hover:bg-rose-500 text-white shadow-lg flex items-center justify-center gap-2 transition active:scale-98"
          >
            <Pause className="w-5 h-5" /> Stop Live Broadcast
          </button>
        ) : (
          <button
            onClick={startBroadcasting}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/30 flex items-center justify-center gap-2 transition active:scale-98"
          >
            <Play className="w-5 h-5 fill-current" /> Start Live Broadcast
          </button>
        )}
      </div>

      {/* Live Status Card */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between text-xs border-b border-slate-700/60 pb-2">
          <span className="text-slate-400">Stream Status:</span>
          <span className={`font-semibold flex items-center gap-1.5 ${isBroadcasting ? 'text-emerald-400' : 'text-slate-400'}`}>
            <span className={`w-2 h-2 rounded-full ${isBroadcasting ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
            {isBroadcasting ? 'TRANSMITTING' : 'DISCONNECTED'}
          </span>
        </div>

        <p className="text-xs text-slate-300 italic">{statusMessage}</p>

        {coords ? (
          <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2">
            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/50">
              <span className="text-slate-500 block text-[10px]">LATITUDE</span>
              <span className="text-white font-bold">{coords.lat.toFixed(6)}°</span>
            </div>
            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/50">
              <span className="text-slate-500 block text-[10px]">LONGITUDE</span>
              <span className="text-white font-bold">{coords.lon.toFixed(6)}°</span>
            </div>
            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/50">
              <span className="text-slate-500 block text-[10px]">ACCURACY</span>
              <span className="text-cyan-300 font-bold">±{Math.round(accuracy || 0)} meters</span>
            </div>
            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/50">
              <span className="text-slate-500 block text-[10px]">SPEED</span>
              <span className="text-emerald-300 font-bold">{speed || 0} km/h</span>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-900/50 rounded-lg text-center text-xs text-slate-500">
            Waiting for GPS satellite fix...
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <span>Packets Sent: <strong className="text-white font-mono">{txCount}</strong></span>
          <span>Last Uplink: <strong className="text-white font-mono">{lastTxTime || 'None'}</strong></span>
        </div>
      </div>

      {/* Information Box */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 space-y-1">
        <p className="font-semibold text-slate-300 flex items-center gap-1">
          <Shield className="w-3.5 h-3.5 text-blue-400" /> Real Device Verification
        </p>
        <p>
          This browser page reads your device's actual GPS receiver and uploads coordinates directly to the private telecom lab core. You can move around and watch the position update live on the desktop map.
        </p>
      </div>
    </div>
  );
}
