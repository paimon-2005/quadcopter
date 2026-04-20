import { useEffect, useState, useRef } from 'react';
import { db } from './firebase';
import { ref, onValue } from 'firebase/database';
import {
  Activity,
  Camera,
  Flame,
  Radio,
  Volume2,
  Wifi,
  WifiOff,
  Clock,
  Shield,
  Zap,
  Eye,
  Signal,
  CircleDot,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { motion } from 'framer-motion';

// ─── Camera IP ────────────────────────────────────────────
const CAM_IP = "/cam";

// ─── Types ───────────────────────────────────────────────
interface DroneData {
  distance: number;
  smoke: boolean;
  sound: boolean;
  image: string;
  timestamp: number;
}

interface HistoryItem {
  time: string;
  distance: number;
}

// ─── Animated floating particles ─────────────────────────
const Particles = () => (
  <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
    {Array.from({ length: 30 }).map((_, i) => (
      <motion.div
        key={i}
        className="absolute rounded-full"
        style={{
          width: Math.random() * 3 + 1,
          height: Math.random() * 3 + 1,
          background: `rgba(${Math.random() > 0.5 ? '59,130,246' : '139,92,246'}, ${Math.random() * 0.3 + 0.1})`,
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
        }}
        animate={{
          y: [0, -40, 0],
          x: [0, Math.random() * 20 - 10, 0],
          opacity: [0.2, 0.6, 0.2],
        }}
        transition={{
          duration: Math.random() * 6 + 4,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: Math.random() * 3,
        }}
      />
    ))}
  </div>
);

// ─── Stagger animation container ─────────────────────────
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 100, damping: 15 },
  },
};

// ─── Sensor Card Component ───────────────────────────────
const SensorCard = ({
  label,
  value,
  icon: Icon,
  alert,
  description,
  accentColor,
}: {
  label: string;
  value: string;
  icon: any;
  alert: boolean;
  description: string;
  accentColor: string;
}) => {
  const colors: Record<string, { ring: string; bg: string; text: string; glow: string }> = {
    red: {
      ring: 'ring-red-500/20',
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      glow: 'shadow-[0_0_30px_-5px_rgba(239,68,68,0.3)]',
    },
    green: {
      ring: 'ring-emerald-500/20',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      glow: 'shadow-[0_0_30px_-5px_rgba(16,185,129,0.2)]',
    },
  };
  const c = colors[accentColor] || colors.green;

  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`glass-card p-5 sm:p-6 rounded-2xl flex flex-col gap-4 relative overflow-hidden cursor-default ${alert ? 'alert-glow' : ''
        }`}
    >
      {/* Background glow */}
      <div
        className={`absolute -right-8 -top-8 w-32 h-32 rounded-full blur-3xl opacity-20 transition-opacity duration-700 ${c.bg}`}
      />

      <div className="flex justify-between items-start relative z-10">
        <motion.div
          className={`p-3 rounded-xl ring-1 ${c.ring} ${c.bg} ${c.text}`}
          whileHover={{ rotate: 10 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <Icon size={22} strokeWidth={1.8} />
        </motion.div>
        {alert && (
          <motion.span
            className="flex h-3 w-3 relative"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500 }}
          >
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </motion.span>
        )}
      </div>

      <div className="relative z-10">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-1">
          {label}
        </p>
        <motion.h3
          key={value}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-2xl sm:text-3xl font-bold tracking-tight ${alert ? 'text-red-400' : 'text-slate-100'
            }`}
        >
          {value}
        </motion.h3>
        <p className="text-slate-600 text-xs mt-1">{description}</p>
      </div>
    </motion.div>
  );
};

// ─── Main App ────────────────────────────────────────────
const App = () => {
  const [data, setData] = useState<DroneData>({
    distance: 0,
    smoke: false,
    sound: false,
    image: '',
    timestamp: Date.now(),
  });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('—');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Refs for tracking previous values & offline detection
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateCountRef = useRef(0);

  useEffect(() => {
    const droneRef = ref(db, '/drone');
    updateCountRef.current = 0; // Reset on subscribe

    const unsubscribe = onValue(
      droneRef,
      (snapshot) => {
        const val = snapshot.val();
        if (val) {
          updateCountRef.current += 1;
          const isFirstLoad = updateCountRef.current === 1;

          setData(val);

          // On first load, don't mark online — wait for a 2nd update
          // This prevents stale Firebase data from showing "online"
          if (!isFirstLoad) {
            setIsOnline(true);
          }

          const time = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          setLastUpdate(time);

          setHistory((prev) => {
            const newHistory = [...prev, { time, distance: val.distance || 0 }];
            return newHistory.slice(-30);
          });


          // Reset the offline timer — if no new update in 10s, go offline
          if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
          offlineTimerRef.current = setTimeout(() => {
            setIsOnline(false);
          }, 10_000);
        } else {
          setIsOnline(false);
        }
      },
      () => setIsOnline(false),
    );

    return () => {
      unsubscribe();
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const distPercent = Math.min((data.distance / 400) * 100, 100);

  return (
    <>
      {/* Ambient background */}
      <div className="grid-bg" />
      <div className="glow-orb glow-orb-1" />
      <div className="glow-orb glow-orb-2" />
      <div className="glow-orb glow-orb-3" />
      <Particles />

      <div className="relative z-10 min-h-screen px-4 py-6 sm:px-6 md:px-8 lg:px-12 max-w-[1400px] mx-auto">
        {/* ═══ HEADER ═══ */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8"
        >
          <div className="flex items-center gap-4">
            <motion.div
              className="p-3 rounded-2xl bg-blue-500/10 ring-1 ring-blue-500/20 hidden sm:block"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Shield size={28} className="text-blue-400" strokeWidth={1.5} />
            </motion.div>
            <div>
              <h1 className="gradient-text text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
                Aranya Shield
              </h1>
              <p className="text-slate-500 text-sm flex items-center gap-2 mt-1">
                <Clock size={13} />
                <span>
                  {currentTime.toLocaleDateString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                  {' · '}
                  {currentTime.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Last transmission */}
            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs text-slate-400">
              <Signal size={12} />
              Last sync: {lastUpdate}
            </div>

            {/* Status badge */}
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className={`status-chip px-4 py-2 rounded-full border flex items-center gap-2 text-sm font-semibold ${isOnline
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-red-500/30 bg-red-500/10 text-red-400'
                }`}
            >
              {isOnline ? (
                <>
                  <motion.div
                    className="w-2 h-2 rounded-full bg-emerald-400"
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <Wifi size={15} />
                  <span className="hidden sm:inline">System Online</span>
                </>
              ) : (
                <>
                  <motion.div
                    className="w-2 h-2 rounded-full bg-red-400"
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <WifiOff size={15} />
                  <span className="hidden sm:inline">Offline</span>
                </>
              )}
            </motion.div>
          </div>
        </motion.header>

        {/* ═══ SENSOR CARDS ROW ═══ */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6"
        >
          <SensorCard
            label="Smoke Sensor"
            value={!isOnline ? 'No Data' : data.smoke ? 'DETECTED' : 'Clear'}
            icon={Flame}
            alert={isOnline && data.smoke}
            description={!isOnline ? 'Board disconnected' : data.smoke ? 'Smoke particles in airspace' : 'Airspace clear — no smoke'}
            accentColor={!isOnline ? 'green' : data.smoke ? 'red' : 'green'}
          />
          <SensorCard
            label="Sound Sensor"
            value={!isOnline ? 'No Data' : data.sound ? 'DETECTED' : 'Clear'}
            icon={Volume2}
            alert={isOnline && data.sound}
            description={!isOnline ? 'Board disconnected' : data.sound ? 'Anomalous audio detected' : 'Audio feed normal'}
            accentColor={!isOnline ? 'green' : data.sound ? 'red' : 'green'}
          />

          {/* Ultrasonic Range Card (spans 2 cols) */}
          <motion.div
            variants={staggerItem}
            whileHover={{ y: -4 }}
            className="sm:col-span-2 glass-card p-5 sm:p-6 rounded-2xl relative overflow-hidden"
          >
            <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full bg-blue-500/5 blur-3xl" />

            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4 relative z-10">
              <div className="flex items-center gap-3">
                <motion.div
                  className="p-3 rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20 text-blue-400"
                  whileHover={{ rotate: 10 }}
                >
                  <Radio size={20} strokeWidth={1.8} />
                </motion.div>
                <div>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">
                    Ultrasonic Range
                  </p>
                  <p className="text-slate-600 text-xs">Proximity distance sensor</p>
                </div>
              </div>
              <motion.div
                key={data.distance}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-baseline gap-1"
              >
                <span className={`text-3xl sm:text-4xl font-bold tabular-nums ${isOnline ? 'text-slate-100' : 'text-slate-600'}`}>
                  {isOnline ? data.distance.toFixed(1) : '—'}
                </span>
                <span className="text-sm text-slate-500 font-medium">{isOnline ? 'cm' : ''}</span>
              </motion.div>
            </div>

            {/* Progress bar */}
            <div className="relative z-10">
              <div className="w-full bg-slate-800/80 rounded-full h-3 overflow-hidden ring-1 ring-slate-700/50">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: isOnline ? `${distPercent}%` : '0%' }}
                  transition={{ type: 'spring', stiffness: 50, damping: 20 }}
                  className={`h-full rounded-full relative ${!isOnline
                      ? 'bg-slate-700'
                      : data.distance < 20
                        ? 'bg-gradient-to-r from-red-600 to-red-400 progress-danger'
                        : data.distance < 50
                          ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                          : 'bg-gradient-to-r from-blue-600 to-blue-400 progress-glow'
                    }`}
                />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-slate-600 uppercase tracking-wider">0 cm</span>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider ${!isOnline ? 'text-slate-600' : data.distance < 20 ? 'text-red-500' : data.distance < 50 ? 'text-amber-500' : 'text-blue-500'
                    }`}
                >
                  {!isOnline ? '⏸ NO SIGNAL' : data.distance < 20 ? '⚠ DANGER ZONE' : data.distance < 50 ? '⚡ CAUTION' : '✓ SAFE RANGE'}
                </span>
                <span className="text-[10px] text-slate-600 uppercase tracking-wider">400 cm</span>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* ═══ CAMERA & CHART ROW ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5 mb-6"
        >
          {/* Camera Feed */}
          <motion.div
            whileHover={{ y: -2 }}
            className="lg:col-span-3 glass-card rounded-2xl overflow-hidden relative group"
          >
            {/* Camera Header Bar */}
            <div className="absolute top-0 left-0 right-0 z-20 p-3 sm:p-4 flex justify-between items-start">
              <div className="flex gap-2 flex-wrap">
                <div className="px-3 py-1.5 bg-black/70 backdrop-blur-xl rounded-lg border border-white/10 flex items-center gap-2">
                  <Eye size={13} className="text-blue-400" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-white">
                    ESP-CAM Feed
                  </span>
                </div>
                {isOnline && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="px-3 py-1.5 bg-red-600/90 backdrop-blur-xl rounded-lg flex items-center gap-2"
                  >
                    <div className="live-dot" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white ml-1">LIVE</span>
                  </motion.div>
                )}
              </div>
              <div className="px-3 py-1.5 bg-black/70 backdrop-blur-xl rounded-lg border border-white/10 flex items-center gap-2">
                <CircleDot size={13} className="text-emerald-400" />
                <span className="text-[10px] font-semibold text-slate-300 tabular-nums">
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>

            {/* Video Area — Live IP Cam (always attempts connection) */}
            <div className="aspect-video bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 flex items-center justify-center relative overflow-hidden">
              {/* Live MJPEG stream from ESP-CAM */}
              <img
                src={CAM_IP}
                alt="Drone Live Feed"
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  // Show the fallback placeholder
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              {/* Fallback placeholder (hidden when stream is active) */}
              <div className="text-center flex-col items-center gap-3 px-4 hidden" style={{ display: 'none' }}>
                <motion.div
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Camera size={56} strokeWidth={0.8} className="text-slate-700" />
                </motion.div>
                <p className="text-slate-600 text-sm font-medium">Waiting for video signal...</p>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-blue-500/40"
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                    />
                  ))}
                </div>
              </div>

              {/* Scanning line */}
              <div className="scan-line" />

              {/* Corner brackets */}
              <div className="corner-bracket tl" />
              <div className="corner-bracket tr" />
              <div className="corner-bracket bl" />
              <div className="corner-bracket br" />

              {/* Center reticle */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-5 opacity-30">
                <div className="w-16 h-16 sm:w-24 sm:h-24 border border-white/10 rounded-full" />
                <div className="absolute w-[1px] h-4 bg-white/30" />
                <div className="absolute w-4 h-[1px] bg-white/30" />
              </div>
            </div>
          </motion.div>

          {/* Distance History Chart */}
          <motion.div
            whileHover={{ y: -2 }}
            className="lg:col-span-2 glass-card rounded-2xl p-5 sm:p-6 flex flex-col"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/10 ring-1 ring-blue-500/20 text-blue-400">
                  <Activity size={16} strokeWidth={2} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-200">Distance History</h3>
                  <p className="text-[10px] text-slate-600">Last 30 readings</p>
                </div>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800/60 border border-slate-700/50">
                <Zap size={10} className="text-blue-400" />
                <span className="text-[10px] text-slate-400 font-medium">REAL-TIME</span>
              </div>
            </div>

            <div className="flex-1 min-h-[250px] sm:min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorDist" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="50%" stopColor="#6366f1" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="time"
                    stroke="#334155"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#334155"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15,23,42,0.95)',
                      border: '1px solid rgba(59,130,246,0.2)',
                      borderRadius: '12px',
                      backdropFilter: 'blur(12px)',
                      fontSize: '12px',
                    }}
                    itemStyle={{ color: '#60a5fa' }}
                    labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="distance"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorDist)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{
                      r: 5,
                      stroke: '#3b82f6',
                      strokeWidth: 2,
                      fill: '#0f172a',
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </motion.div>

        {/* ═══ BOTTOM STATUS BAR ═══ */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-400'
                  }`}
              />
              <span className="text-xs text-slate-400">
                Firebase {isOnline ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Shield size={12} />
              <span>Aegis Surveillance v1.0</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span>Region: Asia-SE1</span>
            <span>·</span>
            <span>Protocol: RTDB</span>
            <span>·</span>
            <span>Latency: {isOnline ? '<50ms' : 'N/A'}</span>
          </div>
        </motion.footer>
      </div>

    </>
  );
};

export default App;
