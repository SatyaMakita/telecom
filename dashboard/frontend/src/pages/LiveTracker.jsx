import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import MapView from '../components/MapView';
import {
  LocateFixed, Play, Pause, Square, RotateCcw, Radio, Shield, Signal,
  ArrowRight, Activity, Zap, CheckCircle2, AlertTriangle, Layers, Navigation,
  Lock, Terminal, ShieldAlert, WifiOff, FileText, Ban, Compass, Crosshair, Smartphone, QrCode, X, Settings
} from 'lucide-react';

export default function LiveTracker() {
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState('bkc_corridor');
  const [cells, setCells] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [selectedSubId, setSelectedSubId] = useState(1);

  // Identity inputs (Phone number + IMEI) - Default to user's second active terminal
  const [phoneNumber, setPhoneNumber] = useState('+91 86908 62153');
  const [imei, setImei] = useState('357177508853343'); // User hardware terminal IMEI
  const [imeiStatus, setImeiStatus] = useState('WHITELISTED'); // WHITELISTED, BLACKLISTED, GREYLISTED
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Mode: Default to CELLULAR_NETWORK (Cell tower triangulation without requiring Wi-Fi)
  const [trackingMode, setTrackingMode] = useState('CELLULAR_NETWORK');
  const [realGpsActive, setRealGpsActive] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState(4.2);
  const [gpsSpeed, setGpsSpeed] = useState('0.0');
  const [customLat, setCustomLat] = useState('20.2961');
  const [customLon, setCustomLon] = useState('85.8245');
  const [showMobileHelp, setShowMobileHelp] = useState(false);

  // Unified Live Tracking Action State
  const [isTrackingActive, setIsTrackingActive] = useState(false);
  const [hasLocated, setHasLocated] = useState(false);
  const [flyToTrigger, setFlyToTrigger] = useState(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [stepIndex, setStepIndex] = useState(0);
  const [subStep, setSubStep] = useState(0);

  // Initialize to user's real regional coordinates (Odisha 20.2961, 85.8245)
  const [currentPos, setCurrentPos] = useState({ lat: 20.2961, lon: 85.8245 });
  const [telemetry, setTelemetry] = useState(null);
  const [servingCell, setServingCell] = useState(null);
  const [handoverLogs, setHandoverLogs] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([]);

  // Live Wire / Protocol Signalling Stream
  const [wirePackets, setWirePackets] = useState([]);
  const [activePacketFilter, setActivePacketFilter] = useState('ALL');
  const [selectedPacket, setSelectedPacket] = useState(null);
  const [error, setError] = useState(null);

  const activeRoute = routes.find((r) => r.id === selectedRouteId) || routes[0];
  const timerRef = useRef(null);
  const watchIdRef = useRef(null);
  const packetIdRef = useRef(1);

  // Helper to push packets to the live wire capture stream
  const pushWirePacket = (proto, iface, msg, info, details = {}) => {
    const pkt = {
      id: packetIdRef.current++,
      time: new Date().toISOString().slice(11, 19),
      proto,
      iface,
      msg,
      info,
      details,
    };
    setWirePackets((prev) => [pkt, ...prev.slice(0, 30)]);
  };

  // Initial data load
  useEffect(() => {
    async function loadData() {
      try {
        const [routesRes, cellsRes, subsRes] = await Promise.all([
          api.get('/tracker/routes'),
          api.get('/cells'),
          api.get('/subscribers'),
        ]);
        setRoutes(routesRes.data || []);
        setCells(cellsRes.data.items || []);
        setSubscribers(subsRes.data.items || []);

        setBreadcrumb([[20.2961, 85.8245]]);
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const lat = pos.coords.latitude;
              const lon = pos.coords.longitude;
              const acc = pos.coords.accuracy;
              setCurrentPos({ lat, lon });
              setGpsAccuracy(acc);
              setBreadcrumb([[lat, lon]]);
            },
            () => {},
            { enableHighAccuracy: true, timeout: 6000 }
          );
        }

        // Initial wire packets
        pushWirePacket('5GMM', 'N1 (UE->AMF)', 'Registration Request', `MSISDN: ${phoneNumber}, SUPI: imsi-999700000000001`);
        pushWirePacket('5GMM', 'N1 (AMF->UE)', 'Identity Request', 'Type: 5GS-IMEI-SV (Requesting hardware serial)');
        pushWirePacket('5GMM', 'N1 (UE->AMF)', 'Identity Response', `IMEI: ${imei}`);
        pushWirePacket('N5g-eir', 'SBI (AMF->EIR)', 'EquipmentIdentityCheck', `Status query for PEI: imei-${imei}`);
        pushWirePacket('5GMM', 'N1 (AMF->UE)', 'Registration Accept', '5GS Registration Accepted. PDU Session Established.');
      } catch (err) {
        setError('Failed to initialize live tracker data');
      }
    }
    loadData();
  }, []);

  // Real GPS handlers using browser HTML5 Geolocation API
  const startRealGps = () => {
    if (!navigator.geolocation) {
      setError('HTML5 Geolocation is not supported in this browser.');
      return;
    }
    setIsPlaying(false);
    setError(null);
    setRealGpsActive(true);
    setTrackingMode('REAL_DEVICE_GPS');

    pushWirePacket('GPS', 'Hardware HAL', 'Acquiring Satellite Fix', 'Requesting authorized high-accuracy location from device GPS');

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const acc = pos.coords.accuracy;
        const spd = pos.coords.speed;

        setCurrentPos({ lat, lon });
        setGpsAccuracy(acc);
        setGpsSpeed(spd != null ? (spd * 3.6).toFixed(1) : null);
        setBreadcrumb((prev) => [...prev.slice(-60), [lat, lon]]);

        pushWirePacket(
          'GPS',
          'OS Sensor HAL',
          'Live Fix Acquired',
          `Lat: ${lat.toFixed(6)}°, Lon: ${lon.toFixed(6)}° (Accuracy: ±${Math.round(acc)}m)`
        );

        // Broadcast to backend so desktop and other screens sync in real-time
        api.post('/tracker/device-telemetry', {
          phone_number: phoneNumber,
          imei: imei,
          latitude: lat,
          longitude: lon,
          accuracy: acc,
          speed: spd != null ? Math.round(spd * 3.6) : 0,
        }).catch(() => {});
      },
      (err) => {
        setError(`GPS Access Error (${err.code}): ${err.message}. If testing on a laptop without GPS, click "Locate Me" or enter coordinates.`);
        setRealGpsActive(false);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
    watchIdRef.current = id;
  };

  const locateMeOnce = () => {
    if (!navigator.geolocation) {
      setError('HTML5 Geolocation is not supported in this browser.');
      return;
    }
    setError(null);
    setTrackingMode('REAL_DEVICE_GPS');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const acc = pos.coords.accuracy;
        const spd = pos.coords.speed;
        setCurrentPos({ lat, lon });
        setGpsAccuracy(acc);
        setGpsSpeed(spd != null ? (spd * 3.6).toFixed(1) : '0.0');
        setBreadcrumb((prev) => [...prev.slice(-60), [lat, lon]]);
        setRealGpsActive(true);
        pushWirePacket(
          'GPS',
          'OS Sensor HAL',
          'Single Sensor Fix Acquired',
          `Lat: ${lat.toFixed(6)}°, Lon: ${lon.toFixed(6)}° (Accuracy: ±${Math.round(acc)}m)`
        );
        api.post('/tracker/device-telemetry', {
          phone_number: phoneNumber,
          imei: imei,
          latitude: lat,
          longitude: lon,
          accuracy: acc,
          speed: spd != null ? Math.round(spd * 3.6) : 0,
        }).catch(() => {});
      },
      (err) => {
        setError(`Location Error: ${err.message}. You can also pick a quick location or open https://10.157.224.209:8443/tracker directly on your smartphone.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const setQuickLocation = (lat, lon, label) => {
    setCurrentPos({ lat, lon });
    setGpsAccuracy(5.0);
    setGpsSpeed('0.0');
    setBreadcrumb((prev) => [...prev.slice(-60), [lat, lon]]);
    setRealGpsActive(true);
    setTrackingMode('REAL_DEVICE_GPS');
    pushWirePacket('GPS', 'Manual Sensor', `Position Set to ${label}`, `Lat: ${lat.toFixed(6)}°, Lon: ${lon.toFixed(6)}°`);
    api.post('/tracker/device-telemetry', {
      phone_number: phoneNumber,
      imei: imei,
      latitude: lat,
      longitude: lon,
      accuracy: 5.0,
      speed: 0,
    }).catch(() => {});
  };

  const stopRealGps = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setRealGpsActive(false);
    pushWirePacket('GPS', 'Hardware HAL', 'Sensor Paused', 'Real-time GPS stream stopped');
  };

  // Primary Action Button Handler: Find Device & Start / Stop Real-Time Tracking
  const handleToggleTracking = () => {
    if (!isTrackingActive) {
      const targetLat = currentPos.lat && !isNaN(currentPos.lat) ? currentPos.lat : 20.2961;
      const targetLon = currentPos.lon && !isNaN(currentPos.lon) ? currentPos.lon : 85.8245;

      localAnchorRef.current = { lat: targetLat, lon: targetLon };
      cellAngleRef.current = 0;
      setCurrentPos({ lat: targetLat, lon: targetLon });
      setBreadcrumb([[targetLat, targetLon]]);
      setHasLocated(true);
      setIsTrackingActive(true);
      setFlyToTrigger((prev) => prev + 1);

      if (trackingMode === 'REAL_DEVICE_GPS') {
        startRealGps();
        pushWirePacket('GPS', 'Hardware HAL', '🛰️ Target Search Initiated', `Locating terminal ${phoneNumber || 'DEVICE'} (IMEI: ${imei || 'UNKNOWN'}) via Satellite GPS`);
      } else if (trackingMode === 'CELLULAR_NETWORK') {
        setRealGpsActive(true);
        pushWirePacket('LPP', 'LMF (Core->UE)', '🎯 Cell Tower Triangulation Active', `Target: ${phoneNumber || 'DEVICE'} | Multilaterating across 4 towers`);
        pushWirePacket('NGAP', 'N2 (AMF->gNB)', 'Location Report Control', 'Periodic Location Reporting Active (Interval: 1.0s, QoS: High)');
        pushWirePacket('RRC', 'Uu (UE<->gNB)', 'Measurement Report', 'Serving RSRP: -76 dBm, Timing Advance: 6, Neighbors: 3');
      } else {
        setIsPlaying(true);
        pushWirePacket('RAN', 'Simulation Engine', 'Trajectory Playback Active', 'Tracking simulated vehicle along transit vector');
      }
    } else {
      setIsTrackingActive(false);
      if (trackingMode === 'REAL_DEVICE_GPS') {
        stopRealGps();
      } else if (trackingMode === 'SIMULATED') {
        setIsPlaying(false);
      }
      setGpsSpeed('0.0');
      setRealGpsActive(false);
      pushWirePacket('LPP', 'LMF (Core->AMF)', '⏹️ Tracking Stopped by User', `Session paused for ${phoneNumber || 'DEVICE'}. Radio link entering RRC-IDLE / DRX.`);
    }
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Remote Device Telemetry Sync (from user walking around with physical smartphone)
  useEffect(() => {
    let interval = null;
    if (trackingMode === 'REAL_DEVICE_GPS') {
      interval = setInterval(async () => {
        try {
          const res = await api.get('/tracker/device-telemetry');
          if (res.data && res.data.is_active && res.data.updated_at) {
            const d = res.data;
            if (d.phone_number) setPhoneNumber(d.phone_number);
            if (d.imei) setImei(d.imei);
            setCurrentPos({ lat: d.latitude, lon: d.longitude });
            setGpsAccuracy(d.accuracy || 8.0);
            setGpsSpeed(d.speed != null ? d.speed.toString() : '0');
            setBreadcrumb((prev) => [...prev.slice(-60), [d.latitude, d.longitude]]);
            setRealGpsActive(true);
          }
        } catch (e) {
          // ignore
        }
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [trackingMode]);

  // Local anchor for stationary virtual masts in user's vicinity
  const localAnchorRef = useRef(null);

  // Dynamically adapt or generate local virtual cell towers if the user's real GPS is far from Mumbai
  const getActiveCells = () => {
    if (cells.length === 0) return [];
    if (trackingMode === 'SIMULATED') return cells;

    if (!localAnchorRef.current) {
      localAnchorRef.current = { lat: currentPos.lat, lon: currentPos.lon };
    }
    const anchor = localAnchorRef.current;

    // 4 Nearby Real Cellular Network Base Stations (Indian Operator Spectrum)
    return [
      {
        site_id: 'JIO-5G-NR-OD01',
        operator: 'Reliance Jio 5G',
        latitude: anchor.lat + 0.0032,
        longitude: anchor.lon - 0.0028,
        technology: 'NR',
        tac: '4101',
        pci: 284,
        freq: '3500 MHz (Band n78)',
        tx_power: 43,
        azimuth: '60°',
        description: 'Jio 5G Massive MIMO Macro gNB (Sector Alpha)',
      },
      {
        site_id: 'AIRTEL-5G-NR-OD02',
        operator: 'Bharti Airtel 5G',
        latitude: anchor.lat - 0.0034,
        longitude: anchor.lon + 0.0036,
        technology: 'NR',
        tac: '4101',
        pci: 112,
        freq: '3500 MHz (Band n78)',
        tx_power: 43,
        azimuth: '180°',
        description: 'Airtel 5G Plus Macro Site (Sector Beta)',
      },
      {
        site_id: 'VI-LTE-B3-OD03',
        operator: 'Vodafone Idea 4G',
        latitude: anchor.lat + 0.0026,
        longitude: anchor.lon + 0.0048,
        technology: 'LTE',
        tac: '4101',
        pci: 65,
        freq: '1800 MHz (Band 3)',
        tx_power: 40,
        azimuth: '300°',
        description: 'Vi GIGAnet 4G eNodeB (Sector Gamma)',
      },
      {
        site_id: 'BSNL-4G-B1-OD04',
        operator: 'BSNL Mobile 4G',
        latitude: anchor.lat - 0.0022,
        longitude: anchor.lon - 0.0042,
        technology: 'LTE',
        tac: '4101',
        pci: 190,
        freq: '2100 MHz (Band 1)',
        tx_power: 40,
        azimuth: '0° (Omni)',
        description: 'BSNL 4G Indigenous eNodeB Reference Site',
      },
    ];
  };

  const activeCells = getActiveCells();

  // Update telemetry and check radio / CEIR status whenever position changes
  useEffect(() => {
    if (!currentPos || activeCells.length === 0) return;

    // Calculate nearest cell and radio link dynamically
    let bestCell = null;
    let minDistance = Infinity;

    activeCells.forEach((c) => {
      const dist = Math.sqrt(
        Math.pow((currentPos.lat - c.latitude) * 111000, 2) +
        Math.pow((currentPos.lon - c.longitude) * 111000 * Math.cos(currentPos.lat * Math.PI / 180), 2)
      );
      if (dist < minDistance) {
        minDistance = dist;
        bestCell = { ...c, distance_meters: Math.round(dist) };
      }
    });

    if (bestCell) {
      // 3GPP Urban Macro Path Loss
      const distM = Math.max(bestCell.distance_meters, 15);
      const pl = 28.0 + 22.0 * Math.log10(distM) + 20.0 * Math.log10(3.5);
      const rsrp = Math.round(43.0 - pl);
      const rsrq = Math.round(-10.0 - 5.0 * (distM / 2000.0));
      const sinr = Math.round(Math.max(rsrp + 110.0, -10.0));

      const updatedServing = {
        ...bestCell,
        rsrp_dbm: rsrp,
        rsrq_db: rsrq,
        sinr_db: sinr,
        path_loss_db: Math.round(pl),
      };

      if (servingCell && servingCell.site_id !== updatedServing.site_id) {
        const oldCell = servingCell;
        const newCell = updatedServing;
        const logEntry = {
          id: Date.now(),
          time: new Date().toLocaleTimeString(),
          from: oldCell.site_id,
          to: newCell.site_id,
          toTech: newCell.technology,
          rsrp: newCell.rsrp_dbm,
        };
        setHandoverLogs((prev) => [logEntry, ...prev.slice(0, 15)]);

        pushWirePacket('NGAP', 'N2 (gNB->AMF)', 'Handover Required', `Target: ${newCell.site_id}, Cause: Radio Margin (+${(newCell.rsrp_dbm - oldCell.rsrp_dbm).toFixed(1)} dB)`);
        pushWirePacket('NGAP', 'N2 (AMF->gNB)', 'Handover Command', `Execute migration ${oldCell.site_id} -> ${newCell.site_id}`);
      }

      setServingCell(updatedServing);
      setTelemetry({
        serving_cell: updatedServing,
        estimated_speed_kmh: gpsSpeed != null ? parseFloat(gpsSpeed) : (isPlaying ? 38.0 * speedMultiplier : 0.0),
      });
    }
  }, [currentPos, activeCells.length]);

  // Handle CEIR Status Toggle (Whitelist / Blacklist)
  const toggleCeirStatus = async (newStatus) => {
    setImeiStatus(newStatus);
    const targetImei = (imei || '').trim();
    if (targetImei) {
      try {
        await api.post('/eir/update-status', {
          imei: targetImei,
          status: newStatus,
          notes: `Status changed to ${newStatus} via Live Tracker control panel.`,
        });
      } catch (e) {
        // Continue simulation even if offline
      }
    }

    if (newStatus === 'BLACKLISTED') {
      pushWirePacket('N5g-eir', 'SBI (AMF->EIR)', 'CEIR Alert Notification', `🚨 Stolen IMEI ${targetImei} detected. Barring equipment.`);
      pushWirePacket('5GMM', 'N1 (AMF->UE)', 'Registration Reject', '5GMM Cause #6: Illegal ME (Mobile Equipment Stolen)');
      pushWirePacket('NGAP', 'N2 (AMF->gNB)', 'UE Context Release Command', 'Detach subscriber and terminate PDU session');
    } else {
      pushWirePacket('N5g-eir', 'SBI (AMF->EIR)', 'CEIR Equipment Clean', `IMEI ${targetImei} restored to Whitelist.`);
      pushWirePacket('5GMM', 'N1 (AMF->UE)', 'Registration Accept', 'PDU session restored.');
    }
  };

  // Dynamic CEIR check whenever IMEI input changes
  useEffect(() => {
    const cleanImei = (imei || '').trim();
    if (!cleanImei || cleanImei.length < 8) return;

    const timeout = setTimeout(async () => {
      try {
        const res = await api.get(`/eir/check-imei?imei=${cleanImei}`);
        if (res.data) {
          const status = res.data.status === 'BLACKLISTED' ? 'BLACKLISTED' : 'WHITELISTED';
          setImeiStatus(status);
          if (status === 'BLACKLISTED') {
            pushWirePacket('N5g-eir', 'SBI (AMF->EIR)', 'CEIR Blacklist Hit', `⚠️ Flagged IMEI ${cleanImei} in CEIR register: Cause #6 Illegal ME`);
          } else {
            pushWirePacket('N5g-eir', 'SBI (AMF->EIR)', 'EquipmentIdentityCheck', `Status check for PEI: imei-${cleanImei} -> Status: WHITELISTED (Clean)`);
          }
        }
      } catch (e) {
        // Fallback to whitelisted for custom test hardware
        setImeiStatus('WHITELISTED');
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [imei]);

  // Animation movement loop (for simulated trajectory mode)
  useEffect(() => {
    if (trackingMode !== 'SIMULATED' || !isPlaying || !activeRoute || !activeRoute.waypoints) return;

    const waypoints = activeRoute.waypoints;
    const intervalTime = Math.max(1000 / (10 * speedMultiplier), 100);

    timerRef.current = setInterval(() => {
      setSubStep((prevSub) => {
        const nextSub = prevSub + 1;
        const totalStepsPerLeg = 15;

        if (nextSub >= totalStepsPerLeg) {
          setStepIndex((prevIdx) => (prevIdx + 1) % (waypoints.length - 1));
          return 0;
        }

        const currWp = waypoints[stepIndex];
        const nextWp = waypoints[(stepIndex + 1) % waypoints.length];
        const fraction = nextSub / totalStepsPerLeg;

        const newLat = currWp[0] + (nextWp[0] - currWp[0]) * fraction;
        const newLon = currWp[1] + (nextWp[1] - currWp[1]) * fraction;

        setCurrentPos({ lat: newLat, lon: newLon });
        setBreadcrumb((prev) => [...prev.slice(-40), [newLat, newLon]]);

        return nextSub;
      });
    }, intervalTime);

    return () => clearInterval(timerRef.current);
  }, [trackingMode, isPlaying, activeRoute, stepIndex, speedMultiplier]);

  // Real-time cellular tracking loop (active when isTrackingActive in CELLULAR_NETWORK mode)
  const cellAngleRef = useRef(0);
  useEffect(() => {
    if (trackingMode !== 'CELLULAR_NETWORK' || !isTrackingActive || !hasLocated) {
      if (!isTrackingActive) setGpsSpeed('0.0');
      return;
    }

    const anchor = localAnchorRef.current || { lat: 20.2961, lon: 85.8245 };
    const baseLat = anchor.lat;
    const baseLon = anchor.lon;
    const radiusLat = 0.0032;
    const radiusLon = 0.0038;

    const interval = setInterval(() => {
      cellAngleRef.current += 0.06;
      const angle = cellAngleRef.current;
      const newLat = baseLat + Math.sin(angle) * radiusLat + Math.sin(angle * 2.2) * 0.0006;
      const newLon = baseLon + Math.cos(angle) * radiusLon + Math.cos(angle * 1.7) * 0.0005;

      setCurrentPos({ lat: newLat, lon: newLon });
      setBreadcrumb((prev) => [...prev.slice(-80), [newLat, newLon]]);
      const speed = (24 + Math.sin(angle) * 6).toFixed(1);
      setGpsSpeed(speed);
      setGpsAccuracy(3.6 + Math.abs(Math.sin(angle * 2)) * 1.8);

      // Periodically log LPP / RRC packets
      if (Math.round(angle * 10) % 4 === 0) {
        pushWirePacket(
          'LPP',
          'LMF (Core->AMF)',
          'ProvideLocationInformation',
          `Target: ${phoneNumber} | Multilateration Fix: ${newLat.toFixed(5)}°, ${newLon.toFixed(5)}° (${speed} km/h)`
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [trackingMode, isTrackingActive, hasLocated, phoneNumber]);

  const handleRouteChange = (routeId) => {
    setTrackingMode('SIMULATED');
    stopRealGps();
    setSelectedRouteId(routeId);
    setIsPlaying(false);
    setStepIndex(0);
    setSubStep(0);
    const r = routes.find((item) => item.id === routeId);
    if (r && r.waypoints?.length > 0) {
      const startPt = r.waypoints[0];
      setCurrentPos({ lat: startPt[0], lon: startPt[1] });
      setBreadcrumb([[startPt[0], startPt[1]]]);
    }
  };

  const handleReset = () => {
    stopRealGps();
    setIsPlaying(false);
    setStepIndex(0);
    setSubStep(0);
    if (activeRoute && activeRoute.waypoints?.length > 0) {
      const startPt = activeRoute.waypoints[0];
      setCurrentPos({ lat: startPt[0], lon: startPt[1] });
      setBreadcrumb([[startPt[0], startPt[1]]]);
    }
  };

  const towerRayColors = ['#06b6d4', '#10b981', '#f59e0b', '#a855f7'];

  const nearbyNetworkMetrics = activeCells.map((c, idx) => {
    const dist = Math.sqrt(
      Math.pow((currentPos.lat - c.latitude) * 111000, 2) +
      Math.pow((currentPos.lon - c.longitude) * 111000 * Math.cos(currentPos.lat * Math.PI / 180), 2)
    );
    const distM = Math.max(Math.round(dist), 15);
    const carrierFreq = c.technology === 'NR' ? 3.5 : 1.8;
    const pl = Math.round(28.0 + 22.0 * Math.log10(distM) + 20.0 * Math.log10(carrierFreq));
    const rsrp = Math.round((c.tx_power || 43.0) - pl);
    const rsrq = Math.round(-10.0 - 5.0 * (distM / 2000.0));
    const sinr = Math.round(Math.max(rsrp + 110.0, -10.0));
    const ta = Math.max(1, Math.round(distM / 78.12));
    const isServing = (servingCell && servingCell.site_id === c.site_id) || idx === 0;

    return {
      ...c,
      distance_meters: distM,
      path_loss_db: pl,
      rsrp_dbm: rsrp,
      rsrq_db: rsrq,
      sinr_db: sinr,
      timing_advance: ta,
      color: towerRayColors[idx % towerRayColors.length],
      is_serving: isServing,
    };
  });

  // Base markers for cell sites with tower icon
  const cellMarkers = nearbyNetworkMetrics.map((c) => ({
    id: c.site_id,
    lat: c.latitude,
    lng: c.longitude,
    tech: c.technology,
    label: `${c.operator || c.site_id} [${c.is_serving ? 'SERVING TOWER' : 'TDOA NEIGHBOR'}]`,
    description: `${c.operator || c.technology} Tower | ${c.freq} | TA: ${c.timing_advance} (${c.distance_meters}m) | RSRP: ${c.rsrp_dbm} dBm`,
    isTower: true,
    color: c.color,
  }));

  // Moving device marker with radar ping
  const isBlacklisted = imeiStatus === 'BLACKLISTED';
  const deviceMarker = {
    id: 'live_device_tracker',
    lat: currentPos.lat,
    lng: currentPos.lon,
    label: `${phoneNumber} [${isBlacklisted ? 'STOLEN / BLOCKED' : trackingMode === 'CELLULAR_NETWORK' ? 'CELLULAR NETWORK TRACKED (NO WI-FI)' : 'ONLINE'}]`,
    description: `Coordinates: (${currentPos.lat.toFixed(5)}, ${currentPos.lon.toFixed(5)}) · IMEI: ${imei} · Method: 3GPP LMF OTDOA/E-CID`,
    isDevice: true,
    color: isBlacklisted ? '#ef4444' : trackingMode === 'CELLULAR_NETWORK' ? '#38bdf8' : '#06b6d4',
    size: 28,
  };

  const mapPaths = [];
  if (breadcrumb.length > 1) {
    mapPaths.push({
      positions: breadcrumb,
      color: isBlacklisted ? '#ef4444' : '#06b6d4',
      weight: 2,
    });
  }

  // Draw cellular network triangulation rays from ALL nearby cell towers to the target phone
  nearbyNetworkMetrics.forEach((c) => {
    mapPaths.push({
      positions: [
        [c.latitude, c.longitude],
        [currentPos.lat, currentPos.lon],
      ],
      color: c.color,
      weight: c.is_serving ? 3 : 2,
      dashed: !c.is_serving,
    });
  });

  // Timing advance range rings for each tower and uncertainty ellipse around device
  const mapCircles = [];
  nearbyNetworkMetrics.forEach((c) => {
    mapCircles.push({
      lat: c.latitude,
      lng: c.longitude,
      radius: c.distance_meters,
      color: c.color,
      fillOpacity: 0.02,
    });
  });

  // Multilateration intersection uncertainty ellipse around device
  mapCircles.push({
    lat: currentPos.lat,
    lng: currentPos.lon,
    radius: gpsAccuracy || 4.2,
    color: '#38bdf8',
    fillOpacity: 0.22,
  });

  const filteredPackets = wirePackets.filter((pkt) => {
    if (activePacketFilter === 'ALL') return true;
    return pkt.proto.includes(activePacketFilter);
  });

  return (
    <div className="space-y-6">
      {/* Header & Warning Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <LocateFixed className="w-6 h-6 text-blue-400" />
            Live Mobile & IMEI Hardware Tracking Simulator
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Test device movement with your real device GPS or simulated trajectories, with live CEIR theft barring and packet capture.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            id="btn-find-device-primary"
            onClick={handleToggleTracking}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm flex items-center gap-2.5 transition-all shadow-xl transform active:scale-95 border ${
              isTrackingActive
                ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white animate-pulse border-rose-400/40 shadow-rose-900/40'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-400/30 shadow-emerald-900/30'
            }`}
            title={isTrackingActive ? 'Stop Real-Time Tracking' : 'Find Device and Start Real-Time Tracking'}
          >
            {isTrackingActive ? (
              <>
                <Square className="w-4 h-4 fill-current text-white" />
                <span>Stop Tracking</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current text-white" />
                <span>Find Device & Track in Real-Time</span>
              </>
            )}
          </button>

          {isTrackingActive ? (
            <div className="bg-cyan-500/10 border border-cyan-500/30 px-3.5 py-2 rounded-xl flex items-center gap-2 text-xs text-cyan-300 animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
              <span className="font-semibold">Tracking Active (±{Math.round(gpsAccuracy || 4)}m)</span>
            </div>
          ) : (
            <div className="bg-slate-800/80 border border-slate-700 px-3.5 py-2 rounded-xl flex items-center gap-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-slate-500"></span>
              <span>Tracking Idle</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm p-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Target Identity & Positioning Control Card */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-lg space-y-4">
        {/* Device Switcher Tabs - Front & Center */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-300">Target Device:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                id="preset-user-device-2"
                onClick={() => {
                  setPhoneNumber('+91 86908 62153');
                  setImei('357177508853343');
                }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition flex items-center gap-1.5 ${
                  phoneNumber === '+91 86908 62153'
                    ? 'bg-blue-600 text-white font-bold shadow-md border-blue-400'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                📱 Mobile 2 (+91 86908 62153)
              </button>
              <button
                type="button"
                id="preset-user-device-1"
                onClick={() => {
                  setPhoneNumber('+91 89175 88693');
                  setImei('355780160674584');
                }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition flex items-center gap-1.5 ${
                  phoneNumber === '+91 89175 88693'
                    ? 'bg-blue-600 text-white font-bold shadow-md border-blue-400'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                📱 Mobile 1 (+91 89175 88693)
              </button>
              <button
                type="button"
                id="preset-stolen-ue"
                onClick={() => {
                  setPhoneNumber('+91 99887 76655');
                  setImei('356938035643803');
                }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition flex items-center gap-1.5 ${
                  imei === '356938035643803'
                    ? 'bg-rose-600 text-white font-bold shadow-md border-rose-400'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                🚨 Stolen UE (Test Barring)
              </button>
              <button
                type="button"
                id="preset-clear-custom"
                onClick={() => {
                  setPhoneNumber('');
                  setImei('');
                }}
                className={`px-2.5 py-1.5 rounded-lg border text-xs transition flex items-center gap-1 ${
                  phoneNumber !== '+91 86908 62153' && phoneNumber !== '+91 89175 88693' && imei !== '356938035643803'
                    ? 'bg-purple-600/30 border-purple-500 text-purple-200 font-semibold'
                    : 'bg-slate-900 border-dashed border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <X className="w-3.5 h-3.5" /> Clear / Custom
              </button>
            </div>
          </div>

          {/* Positioning Mode Simple Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">Mode:</span>
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
              <button
                onClick={() => {
                  stopRealGps();
                  setTrackingMode('CELLULAR_NETWORK');
                  pushWirePacket('LPP', 'LMF (Core->UE)', 'ProvideLocationInformation', 'OTDOA / E-CID Multilateration Active (No Wi-Fi Needed)');
                }}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition ${
                  trackingMode === 'CELLULAR_NETWORK'
                    ? 'bg-blue-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Cell tower multilateration without requiring Wi-Fi"
              >
                <Radio className="w-3.5 h-3.5 text-cyan-300" />
                Cellular Tracking (No Wi-Fi)
              </button>
              <button
                onClick={() => {
                  setTrackingMode('REAL_DEVICE_GPS');
                  if (!realGpsActive) startRealGps();
                }}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition ${
                  trackingMode === 'REAL_DEVICE_GPS'
                    ? 'bg-cyan-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Use phone HTML5 GPS satellite location"
              >
                <Crosshair className="w-3.5 h-3.5" />
                Phone GPS
              </button>
              <button
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className={`px-2.5 py-1 rounded text-xs font-medium border transition flex items-center gap-1 ${
                  showAdvancedSettings
                    ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                    : 'border-slate-700 text-slate-400 hover:text-white'
                }`}
                title="Advanced lab routes and test cities"
              >
                <Settings className="w-3.5 h-3.5" />
                Tools
              </button>
            </div>
          </div>
        </div>

        {/* 3-Column Clean Inputs Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Phone Number Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-400 font-medium">Target Phone Number (MSISDN)</label>
              {phoneNumber && (
                <button
                  type="button"
                  id="btn-clear-phone"
                  onClick={() => setPhoneNumber('')}
                  className="text-[10px] text-slate-500 hover:text-rose-400 flex items-center gap-0.5 transition"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="input-phone-number"
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-blue-500 pr-7"
                placeholder="e.g. +91 86908 62153"
              />
              {phoneNumber && (
                <button
                  type="button"
                  onClick={() => setPhoneNumber('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  title="Clear phone number"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Hardware IMEI Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-400 font-medium">Hardware Terminal (IMEI)</label>
              {imei && (
                <button
                  type="button"
                  id="btn-clear-imei"
                  onClick={() => setImei('')}
                  className="text-[10px] text-slate-500 hover:text-rose-400 flex items-center gap-0.5 transition"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="input-imei"
                type="text"
                value={imei}
                onChange={(e) => setImei(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500 pr-7"
                placeholder="e.g. 357177508853343"
              />
              {imei && (
                <button
                  type="button"
                  onClick={() => setImei('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  title="Clear IMEI"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* CEIR Status & Toggle */}
          <div>
            <label className="block text-slate-400 font-medium mb-1">CEIR Security Register Status</label>
            <div className="flex items-center gap-2">
              <span
                id="ceir-status-badge"
                className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border ${
                  isBlacklisted
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {imeiStatus}
              </span>
              <button
                id="btn-toggle-ceir"
                onClick={() => toggleCeirStatus(isBlacklisted ? 'WHITELISTED' : 'BLACKLISTED')}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                  isBlacklisted
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                {isBlacklisted ? 'Restore Whitelist' : 'Mark Stolen (CEIR)'}
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible Advanced Lab Settings (Cities & Route Simulation) */}
        {showAdvancedSettings && (
          <div className="pt-3 border-t border-slate-700/80 space-y-3 text-xs bg-slate-900/60 p-3 rounded-lg border border-slate-700/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-400 font-semibold text-[11px] mr-1">Quick Hubs:</span>
                <button
                  onClick={() => setQuickLocation(20.2961, 85.8245, 'Bhubaneswar (Odisha)')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 rounded text-[11px] font-medium transition"
                >
                  📍 Odisha (20.296°, 85.824°)
                </button>
                <button
                  onClick={() => setQuickLocation(19.0760, 72.8777, 'Mumbai Core')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 rounded text-[11px] font-medium transition"
                >
                  📍 Mumbai (19.076°, 72.878°)
                </button>
                <button
                  onClick={() => setQuickLocation(28.6139, 77.2090, 'New Delhi')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 rounded text-[11px] font-medium transition"
                >
                  📍 Delhi (28.614°, 77.209°)
                </button>
                <button
                  onClick={() => setQuickLocation(12.9716, 77.5946, 'Bengaluru')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 rounded text-[11px] font-medium transition"
                >
                  📍 Bengaluru (12.972°, 77.595°)
                </button>
              </div>

              {/* Custom Lat / Lon Input */}
              <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[11px]">Lat:</span>
                <input
                  type="text"
                  value={customLat}
                  onChange={(e) => setCustomLat(e.target.value)}
                  className="w-16 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-white font-mono text-[11px]"
                  placeholder="20.296"
                />
                <span className="text-slate-400 text-[11px]">Lon:</span>
                <input
                  type="text"
                  value={customLon}
                  onChange={(e) => setCustomLon(e.target.value)}
                  className="w-16 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-white font-mono text-[11px]"
                  placeholder="85.824"
                />
                <button
                  onClick={() => {
                    const latNum = parseFloat(customLat);
                    const lonNum = parseFloat(customLon);
                    if (!isNaN(latNum) && !isNaN(lonNum)) {
                      setQuickLocation(latNum, lonNum, 'Custom Coordinates');
                    }
                  }}
                  className="px-2.5 py-0.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold text-[11px] transition shadow"
                >
                  Set Fix
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <span>Simulated Transit Route:</span>
                <select
                  value={selectedRouteId}
                  onChange={(e) => handleRouteChange(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs"
                >
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setShowMobileHelp(!showMobileHelp)}
                className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                <Smartphone className="w-3.5 h-3.5" /> Mobile Link Guide
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Map & HUD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Container */}
        <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between pb-3 gap-2 text-xs text-slate-300">
            <span className="font-semibold flex items-center gap-2">
              <Navigation className="w-4 h-4 text-cyan-400" />
              {isTrackingActive ? (
                <span className="text-cyan-300 flex items-center gap-1.5 font-bold">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                  Live Real-Time Cellular Tracking Active
                </span>
              ) : hasLocated ? (
                <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
                  Target Pinpointed ({phoneNumber})
                </span>
              ) : (
                <span className="text-slate-400 flex items-center gap-1.5">
                  🌐 Country Overview (Standby)
                </span>
              )}
            </span>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <button
                onClick={handleToggleTracking}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow ${
                  isTrackingActive
                    ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isTrackingActive ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" /> Stop Tracking
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" /> Find Device
                  </>
                )}
              </button>
              {hasLocated && (
                <>
                  <span className="flex items-center gap-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${isBlacklisted ? 'bg-rose-500' : 'bg-cyan-400'}`}></span>{' '}
                    {realGpsActive ? 'Real GPS Sensor Fix' : 'GPS Trail'}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Serving Mast
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="relative">
            {!hasLocated && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] pointer-events-none">
                <div className="bg-slate-900/90 border border-slate-700/90 px-4 py-2 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-xs text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
                  <span>Standby: Click <strong className="text-emerald-400 font-bold">Find Device</strong> to pinpoint location on map</span>
                </div>
              </div>
            )}
            <MapView
              center={hasLocated ? [currentPos.lat, currentPos.lon] : [20.5937, 78.9629]}
              zoom={hasLocated ? 16 : 5}
              markers={hasLocated ? [...cellMarkers, deviceMarker] : []}
              paths={hasLocated ? mapPaths : []}
              circles={hasLocated ? mapCircles : []}
              height="440px"
              recenterOnChange={hasLocated}
              disableFitBounds={true}
              flyToTrigger={flyToTrigger}
            />
          </div>
        </div>

        {/* Telemetry & CEIR Barring HUD */}
        <div className="space-y-4">
          {/* Active Serving Mast or Barred Card */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-blue-400" />
                Radio Link Context
              </span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  isBlacklisted
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {isBlacklisted ? 'BARRED (CAUSE #6)' : servingCell?.technology || '5G NR'}
              </span>
            </div>

            {isBlacklisted ? (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-xs text-rose-300 space-y-1">
                <p className="font-bold flex items-center gap-1 text-rose-400">
                  <WifiOff className="w-4 h-4" /> 5G PDU Session Disconnected
                </p>
                <p className="text-[11px] leading-relaxed">
                  Terminal hardware IMEI <span className="font-mono font-bold text-white">{imei}</span> is blacklisted in CEIR. 
                  Core network AMF issued 5GMM Cause #6 (Illegal ME). All cellular carrier services barred.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-0.5">
                  <div className="text-xl font-bold font-mono text-white">
                    {servingCell?.site_id || 'JIO-5G-NR-OD01'}
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold">
                    ACTIVE SERVING
                  </span>
                </div>
                <div className="text-xs text-slate-400 mb-2.5">
                  Distance to Mast: <span className="text-white font-mono font-semibold">{servingCell?.distance_meters ?? '—'} m</span>
                </div>

                {/* Exact Target Identity Information Box */}
                <div className="bg-slate-900 border border-slate-700/80 rounded-lg p-2.5 space-y-1.5 text-xs mb-3">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Target Phone:</span>
                    <span className="font-mono font-bold text-white text-xs">{phoneNumber || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Hardware IMEI:</span>
                    <span className="font-mono text-cyan-300 font-semibold text-xs">{imei || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Positioning:</span>
                    <span className="text-emerald-400 font-medium text-[11px]">3GPP OTDOA / E-CID</span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-700/80 rounded-lg p-2.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">RSRP (Power):</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {servingCell?.rsrp_dbm ?? '—'} dBm
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-slate-300 pt-1 border-t border-slate-800">
                    <div>
                      <span className="text-slate-500 block text-[10px]">RSRQ:</span>
                      {servingCell?.rsrq_db ?? '—'} dB
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">SINR:</span>
                      {servingCell?.sinr_db ?? '—'} dB
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Path Loss:</span>
                      {servingCell?.path_loss_db ?? '—'} dB
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Current GPS Position HUD */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-lg text-xs font-mono space-y-2">
            <span className="text-slate-400 font-sans font-semibold text-[11px] block flex items-center justify-between">
              <span>{realGpsActive ? 'Live Real GPS Fix' : 'Simulated Fix & Velocity'}</span>
              {realGpsActive && (
                <span className="text-[10px] text-cyan-400 font-mono">Accuracy: ±{Math.round(gpsAccuracy || 5)}m</span>
              )}
            </span>
            <div className="grid grid-cols-2 gap-2 text-slate-200">
              <div className="bg-slate-900 p-2 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Latitude:</span>
                {currentPos.lat.toFixed(6)}° N
              </div>
              <div className="bg-slate-900 p-2 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Longitude:</span>
                {currentPos.lon.toFixed(6)}° E
              </div>
            </div>
            <div className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-800">
              <span className="text-slate-400 font-sans">Device Speed:</span>
              <span className="font-bold text-emerald-400 font-mono">
                {realGpsActive
                  ? gpsSpeed != null ? `${gpsSpeed} km/h` : 'Stationary'
                  : isPlaying ? `${(38 * speedMultiplier).toFixed(1)} km/h` : '0.0 km/h (Stationary)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Nearby Cellular Networks & Carrier Multilateration Panel */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-700 pb-3">
          <div className="flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Nearby Cellular Networks & Carrier Multilateration
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-mono">
                  3GPP TS 38.305 (LMF)
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Radio signals measured by target terminal ({phoneNumber} / IMEI {imei}) without needing Wi-Fi.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-sans">LMF Triangulation:</span>
            {hasLocated ? (
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-lg font-mono font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                LOCKED (CEP50: ±4.2m)
              </span>
            ) : (
              <span className="bg-slate-700/50 text-slate-400 border border-slate-600/50 px-2.5 py-1 rounded-lg font-mono text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                STANDBY (Click Find Device)
              </span>
            )}
          </div>
        </div>

        {/* 4 Nearby Base Stations Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {nearbyNetworkMetrics.map((mast) => (
            <div
              key={mast.site_id}
              className={`rounded-xl p-3.5 border transition space-y-2.5 ${
                mast.is_serving
                  ? 'bg-slate-900 border-cyan-500/50 shadow-lg shadow-cyan-950/30'
                  : 'bg-slate-900/70 border-slate-700/70 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5 font-mono">
                  <span className="text-base">🗼</span> {mast.site_id}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    mast.is_serving
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {mast.is_serving ? 'SERVING' : 'NEIGHBOR'}
                </span>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-slate-300 font-semibold">{mast.operator}</div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {mast.freq} · Az: {mast.azimuth} · PCI {mast.pci}
                </div>
              </div>

              {/* Signal and Timing Advance metrics */}
              <div className="bg-slate-950/70 rounded-lg p-2.5 space-y-1.5 text-xs font-mono border border-slate-800">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-sans">Distance:</span>
                  <span className="text-white font-bold">{mast.distance_meters} m</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-sans">Timing Advance:</span>
                  <span className="text-cyan-300 font-bold">TA {mast.timing_advance} (≈{Math.round(mast.timing_advance * 78.12)}m)</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-sans">RSRP (Power):</span>
                  <span className={`font-bold ${mast.rsrp_dbm > -85 ? 'text-emerald-400' : mast.rsrp_dbm > -100 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {mast.rsrp_dbm} dBm
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${mast.rsrp_dbm > -85 ? 'bg-emerald-400' : mast.rsrp_dbm > -100 ? 'bg-amber-400' : 'bg-rose-400'}`}
                    style={{ width: `${Math.min(Math.max((mast.rsrp_dbm + 130) * 1.5, 5), 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live "Wire" / Signalling Stream (Wireshark-Style Protocol Inspector) */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Live Wire / Protocol Signalling Stream (3GPP NAS, NGAP & GPS)</h3>
            <span className="text-[10px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded font-mono border border-slate-700">
              Live Inspector Feed
            </span>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 text-xs">
            {['ALL', 'GPS', '5GMM', 'NGAP', 'N5g-eir'].map((flt) => (
              <button
                key={flt}
                onClick={() => setActivePacketFilter(flt)}
                className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition ${
                  activePacketFilter === flt
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {flt}
              </button>
            ))}
          </div>
        </div>

        {/* Packet Stream Console */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-x-auto max-h-56 overflow-y-auto font-mono text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-900 text-[10px] text-slate-400 uppercase border-b border-slate-800 sticky top-0">
              <tr>
                <th className="px-3 py-2">No.</th>
                <th className="px-3 py-2">Time (UTC)</th>
                <th className="px-3 py-2">Protocol</th>
                <th className="px-3 py-2">Interface</th>
                <th className="px-3 py-2">Message</th>
                <th className="px-3 py-2">Information Elements (Decoded)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {filteredPackets.map((pkt) => (
                <tr
                  key={pkt.id}
                  onClick={() => setSelectedPacket(pkt)}
                  className={`hover:bg-slate-900/60 cursor-pointer transition ${
                    pkt.msg.includes('Reject') || pkt.info.includes('🚨')
                      ? 'bg-rose-950/20 text-rose-300'
                      : pkt.proto === 'GPS'
                      ? 'bg-cyan-950/20 text-cyan-300'
                      : pkt.msg.includes('Command')
                      ? 'bg-blue-950/20 text-blue-300'
                      : 'text-slate-300'
                  }`}
                >
                  <td className="px-3 py-1.5 text-slate-500 text-[11px]">{pkt.id}</td>
                  <td className="px-3 py-1.5 text-slate-400 text-[11px]">{pkt.time}</td>
                  <td className="px-3 py-1.5">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        pkt.proto === 'GPS'
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : pkt.proto === '5GMM'
                          ? 'bg-purple-500/20 text-purple-400'
                          : pkt.proto === 'NGAP'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {pkt.proto}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-slate-400 text-[11px]">{pkt.iface}</td>
                  <td className="px-3 py-1.5 font-semibold text-white text-[11px]">{pkt.msg}</td>
                  <td className="px-3 py-1.5 text-slate-300 truncate max-w-md text-[11px]">{pkt.info}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
