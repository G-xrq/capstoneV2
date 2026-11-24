import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import DonorBadge from "./DonorBadge.jsx";
import "./LiveTrackerModal.css";
import { API_URL } from "../config";
import { useRealtimeSync } from "../hooks/useRealtimeSync";

const RAIL_CONFIG = {
  GCASH: { label: "GCash",       icon: "smartphone",             color: "#0ea5e9" },
  MAYA:  { label: "Maya",        icon: "account_balance_wallet", color: "#10b981" },
  CARD:  { label: "Card / Bank", icon: "credit_card",            color: "#a78bfa" },
};

const TIME_WINDOWS = [
  { id: "24h",    label: "Today (24h)", compactLabel: "Today",     shortLabel: "24h",       desc: "Last 24 Hours",       maxItems: 20, ms: 24 * 60 * 60 * 1000 },
  { id: "7d",     label: "7 Days",      compactLabel: "7 Days",    shortLabel: "7d",        desc: "Past 7 Days",         maxItems: 20, ms: 7 * 24 * 60 * 60 * 1000 },
  { id: "latest", label: "Latest 15",   compactLabel: "Latest 15", shortLabel: "Latest 15", desc: "Latest 15 Donations", maxItems: 15, ms: null },
];

function parseUtcDate(dateInput) {
  if (!dateInput) return null;
  try {
    if (typeof dateInput === "string") {
      const t = dateInput.trim();
      const d = (!t.endsWith("Z") && !t.includes("+") && !/-\d{2}:\d{2}$/.test(t))
        ? new Date(t.replace(" ", "T") + "Z")
        : new Date(t);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : d;
  } catch (_) {
    return null;
  }
}

function AnimatedNumber({ value, prefix = "", suffix = "", decimals = 0 }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef(null);
  const startRef = useRef(null);
  const fromRef = useRef(0);

  useEffect(() => {
    const target = Number(value) || 0;
    fromRef.current = display;
    startRef.current = null;
    if (raf.current) cancelAnimationFrame(raf.current);
    const step = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const prog = Math.min((ts - startRef.current) / 520, 1);
      const ease = 1 - Math.pow(1 - prog, 3);
      setDisplay(fromRef.current + (target - fromRef.current) * ease);
      if (prog < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value]);

  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString("en-US");
  return <>{prefix}{formatted}{suffix}</>;
}

export default function LiveTrackerModal({ isOpen, onClose, theme }) {
  const resolvedTheme = (theme && theme !== "default")
    ? theme
    : (typeof document !== "undefined" ? (document.documentElement.getAttribute("data-theme") || "dark") : "dark");

  const [donations, setDonations]     = useState([]);
  const [serverStats, setServerStats] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [timeWindow, setTimeWindow]   = useState("24h");
  const [railFilter, setRailFilter]   = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedHash, setCopiedHash]   = useState(null);
  const [isDocked, setIsDocked]       = useState(false);
  const [isPaused, setIsPaused]       = useState(false);
  const [newTxId, setNewTxId]         = useState(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const prevFirstIdRef                = useRef(null);

  // Floating dock draggable coordinates (desktop only)
  const [dockPos, setDockPos] = useState(() => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1200;
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    return {
      x: Math.max(16, w - 392 - 24),
      y: Math.max(16, h - 540 - 24),
    };
  });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });

  // Lock background page scroll cleanly while full modal is open (fixes mobile scroll fights!)
  useEffect(() => {
    if (!isOpen || isDocked || typeof document === "undefined") return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, isDocked]);

  // Auto-undock on mobile viewports & clamp dock on desktop resize
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth <= 780 && isDocked) {
        setIsDocked(false);
        return;
      }
      setDockPos((prev) => ({
        x: Math.min(Math.max(16, prev.x), Math.max(16, window.innerWidth - 392 - 16)),
        y: Math.min(Math.max(16, prev.y), Math.max(16, window.innerHeight - 540 - 16)),
      }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isDocked]);

  const handleHeaderMouseDown = (e) => {
    if (!isDocked) return;
    if (e.target.closest("button") || e.target.closest("input") || e.target.closest("a")) return;
    isDraggingRef.current = true;
    dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, posX: dockPos.x, posY: dockPos.y };
    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.mouseX;
      const dy = moveEvent.clientY - dragStartRef.current.mouseY;
      const maxX = Math.max(16, window.innerWidth - 392 - 16);
      const maxY = Math.max(16, window.innerHeight - 540 - 16);
      setDockPos({
        x: Math.min(Math.max(16, dragStartRef.current.posX + dx), maxX),
        y: Math.min(Math.max(16, dragStartRef.current.posY + dy), maxY),
      });
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Live 1-second clock
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  const fetchLiveStream = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/donations/live?limit=100&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        const rawList = Array.isArray(data) ? data : (data.donations || []);
        const list = rawList.filter((d) => {
          const r = String(d?.rail || "").toUpperCase();
          return r === "GCASH" || r === "MAYA" || r === "CARD";
        });
        const telemetry = (!Array.isArray(data) && data.stats) ? data.stats : null;
        if (list.length > 0) {
          if (prevFirstIdRef.current && list[0].id !== prevFirstIdRef.current) {
            setNewTxId(list[0].id);
            setTimeout(() => setNewTxId(null), 4000);
          }
          prevFirstIdRef.current = list[0].id;
        }
        setDonations(list);
        setServerStats(telemetry);
      }
    } catch (err) {
      console.warn("LiveTracker fetch failed:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchLiveStream(false);
  }, [isOpen, fetchLiveStream]);

  useEffect(() => {
    if (!isOpen || isPaused) return;
    const interval = setInterval(() => fetchLiveStream(true), 12000);
    const onDonation = () => fetchLiveStream(true);
    window.addEventListener("bbdrts_donation_success", onDonation);
    return () => {
      clearInterval(interval);
      window.removeEventListener("bbdrts_donation_success", onDonation);
    };
  }, [isOpen, isPaused, fetchLiveStream]);

  useRealtimeSync(
    ["donations", "manual_donations", "campaigns"],
    () => fetchLiveStream(true),
    { enabled: isOpen && !isPaused, debounceMs: 180 }
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape" && !isDocked) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, isDocked]);

  const copyHash = (e, hash) => {
    e.stopPropagation();
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 1800);
  };

  const formatLiveTimeAgo = (dateInput) => {
    const d = parseUtcDate(dateInput);
    if (!d) return "Just now";
    const diff = Math.floor((currentTime - d.getTime()) / 1000);
    if (isNaN(diff) || diff < 8) return "Just now";
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const formatExactTime = (dateInput) => {
    const d = parseUtcDate(dateInput);
    if (!d) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  // Pre-compute counts per window so tabs show live numbers at a glance
  const windowBuckets = useMemo(() => {
    const nowMs = Date.now();
    const cutoff24h = nowMs - 24 * 60 * 60 * 1000;
    const cutoff7d = nowMs - 7 * 24 * 60 * 60 * 1000;
    const list24h = [];
    const list7d = [];
    for (const d of donations) {
      const dt = parseUtcDate(d.createdAt);
      const ts = dt ? dt.getTime() : 0;
      if (ts >= cutoff24h) list24h.push(d);
      if (ts >= cutoff7d) list7d.push(d);
    }
    return {
      "24h": list24h,
      "7d": list7d,
      latest: donations.slice(0, 15),
    };
  }, [donations]);

  const activeWindowCfg = TIME_WINDOWS.find((w) => w.id === timeWindow) || TIME_WINDOWS[0];
  const windowedDonations = windowBuckets[timeWindow] || [];

  // All-time total context (subtle secondary reference)
  const allTimePhp = useMemo(() => {
    if (serverStats?.totalPhp) return Number(serverStats.totalPhp);
    return donations.reduce((s, d) => s + Number(d.amountPhp || 0), 0);
  }, [donations, serverStats]);

  // Window-scoped live telemetry
  const windowStats = useMemo(() => {
    let totalPhp = 0;
    const uniqueCauses = new Set();
    const byRail = { GCASH: 0, MAYA: 0, CARD: 0 };
    const causeCounts = new Map();

    windowedDonations.forEach((d) => {
      const amt = Number(d.amountPhp || 0);
      totalPhp += amt;
      if (d.campaignId) uniqueCauses.add(d.campaignId);
      if (byRail[d.rail] !== undefined) byRail[d.rail] += 1;
      if (d.campaignTitle) {
        const prev = causeCounts.get(d.campaignTitle) || { count: 0, php: 0 };
        causeCounts.set(d.campaignTitle, { count: prev.count + 1, php: prev.php + amt });
      }
    });

    let topCause = null;
    causeCounts.forEach((val, title) => {
      if (!topCause || val.php > topCause.php) {
        topCause = { title, ...val };
      }
    });

    const txCount = windowedDonations.length;
    return {
      totalPhp,
      txCount,
      avgPhp: txCount > 0 ? Math.round(totalPhp / txCount) : 0,
      activeCauses: uniqueCauses.size,
      byRail,
      topCause,
    };
  }, [windowedDonations]);

  // Apply channel + search filter, strictly capped so stream never becomes an endless scroll
  const { visibleDonations, totalMatched, isCapped } = useMemo(() => {
    const matched = windowedDonations.filter((d) => {
      if (railFilter !== "ALL" && d.rail !== railFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (
          !(d.donorName || "").toLowerCase().includes(q) &&
          !(d.campaignTitle || "").toLowerCase().includes(q) &&
          !(d.txHash || "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
    const cap = activeWindowCfg.maxItems || 20;
    return {
      visibleDonations: matched.slice(0, cap),
      totalMatched: matched.length,
      isCapped: matched.length > cap,
    };
  }, [windowedDonations, railFilter, searchQuery, activeWindowCfg]);

  if (!isOpen) return null;

  return createPortal(
    <div className={`ltm-root${isDocked ? " is-docked" : ""}`} data-theme={resolvedTheme}>
      {!isDocked && <div className="ltm-backdrop" onClick={onClose} />}

      <div
        className={`ltm-card${isDocked ? " ltm-card--docked" : ""}`}
        style={isDocked ? { left: `${dockPos.x}px`, top: `${dockPos.y}px` } : undefined}
        role="dialog"
        aria-modal={!isDocked}
        aria-label="Live Donation Tracker"
      >
        {/* ── FLUSH HEADER ── */}
        <div
          className={`ltm-header${isDocked ? " is-draggable" : ""}`}
          onMouseDown={handleHeaderMouseDown}
        >
          <div className="ltm-header-left">
            {isDocked && (
              <span className="material-symbols-outlined ltm-drag-handle" title="Drag widget">
                drag_indicator
              </span>
            )}
            <div className="ltm-icon-box">
              <span className="material-symbols-outlined">sensors</span>
            </div>
            <div className="ltm-title-block">
              <div className="ltm-title-row">
                <h3 className="ltm-title">{isDocked ? "Live Stream" : "Live Donation Tracker"}</h3>
                <span className={`ltm-status-pill${isPaused ? " is-paused" : ""}`}>
                  <span className="ltm-status-dot" />
                  <span>{isPaused ? "PAUSED" : "LIVE"}</span>
                </span>
              </div>
              {!isDocked && (
                <p className="ltm-subtitle">
                  Real-time incoming relief donations · Syncs every 4s on Sepolia EVM
                </p>
              )}
            </div>
          </div>

          <div className="ltm-header-right">
            {!isDocked && (
              <div className="ltm-clock-pill" title="Philippine Standard Time">
                <span className="ltm-mono">
                  {new Date(currentTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true,
                  })}
                </span>
              </div>
            )}

            <button
              type="button"
              className={`ltm-tool-btn${isPaused ? " is-active" : ""}`}
              onClick={(e) => { e.stopPropagation(); setIsPaused((p) => !p); }}
              title={isPaused ? "Resume live auto-sync" : "Pause live auto-sync"}
              aria-label={isPaused ? "Resume stream" : "Pause stream"}
            >
              <span className="material-symbols-outlined">{isPaused ? "play_arrow" : "pause"}</span>
            </button>

            <button
              type="button"
              className={`ltm-tool-btn ltm-pip-btn${isDocked ? " is-active" : ""}`}
              onClick={(e) => { e.stopPropagation(); setIsDocked((p) => !p); }}
              title={isDocked ? "Expand modal" : "Pop out mini live widget"}
              aria-label={isDocked ? "Expand" : "Mini widget"}
            >
              <span className="material-symbols-outlined">
                {isDocked ? "open_in_full" : "picture_in_picture_alt"}
              </span>
            </button>

            <button
              type="button"
              className="ltm-tool-btn"
              onClick={(e) => { e.stopPropagation(); fetchLiveStream(false); }}
              title="Sync now"
              aria-label="Sync now"
            >
              <span className="material-symbols-outlined">refresh</span>
            </button>

            <button
              type="button"
              className="ltm-tool-btn ltm-close-btn"
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* ── BODY (2-col on Desktop, Single Unified Scroll on Mobile) ── */}
        <div className="ltm-body">
          {/* LEFT TELEMETRY RAIL (Desktop Sidebar / Compact Top Band on Mobile) */}
          {!isDocked && (
            <aside className="ltm-left-rail">
              {/* Primary Window Volume */}
              <div className="ltm-rail-block ltm-rail-block--hero">
                <div className="ltm-eyebrow-row">
                  <span className="ltm-eyebrow">{activeWindowCfg.desc}</span>
                  <span className="ltm-window-tag">
                    {windowStats.txCount} {windowStats.txCount === 1 ? "donation" : "donations"}
                  </span>
                </div>
                <div className="ltm-hero-amt">
                  ₱<AnimatedNumber value={windowStats.totalPhp} />
                </div>
                <div className="ltm-hero-sub">
                  All-time verified: <strong>₱{Math.round(allTimePhp).toLocaleString("en-US")}</strong>
                </div>
              </div>

              {/* Inline 2-Col Mini Metrics */}
              <div className="ltm-mini-grid">
                <div className="ltm-mini-cell">
                  <span className="ltm-mini-val">
                    ₱<AnimatedNumber value={windowStats.avgPhp} />
                  </span>
                  <span className="ltm-mini-lbl">Avg Donation</span>
                </div>
                <div className="ltm-mini-cell">
                  <span className="ltm-mini-val">
                    <AnimatedNumber value={windowStats.activeCauses} />
                  </span>
                  <span className="ltm-mini-lbl">Active Drives</span>
                </div>
              </div>

              {/* Live Channel Mix (Click to Filter) */}
              <div className="ltm-rail-block ltm-rail-block--channels">
                <div className="ltm-eyebrow-row">
                  <span className="ltm-eyebrow">Payment Channels</span>
                  {railFilter !== "ALL" && (
                    <button
                      type="button"
                      className="ltm-clear-link"
                      onClick={() => setRailFilter("ALL")}
                    >
                      Show all
                    </button>
                  )}
                </div>

                <div className="ltm-channel-list">
                  {Object.entries(RAIL_CONFIG).map(([rail, cfg]) => {
                    const count = windowStats.byRail[rail] || 0;
                    const pct = windowStats.txCount > 0 ? Math.round((count / windowStats.txCount) * 100) : 0;
                    const isActive = railFilter === rail;
                    return (
                      <button
                        key={rail}
                        type="button"
                        className={`ltm-channel-btn${isActive ? " is-active" : ""}`}
                        onClick={() => setRailFilter(isActive ? "ALL" : rail)}
                      >
                        <div className="ltm-channel-top">
                          <span className="ltm-channel-left">
                            <span className="ltm-channel-dot" style={{ backgroundColor: cfg.color }} />
                            <span className="ltm-channel-name">{cfg.label}</span>
                          </span>
                          <span className="ltm-channel-right">
                            <span className="ltm-channel-count">{count}</span>
                            <span className="ltm-channel-pct">{pct}%</span>
                          </span>
                        </div>
                        <div className="ltm-channel-track">
                          <div
                            className="ltm-channel-fill"
                            style={{ width: `${pct}%`, backgroundColor: cfg.color }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>
          )}

          {/* RIGHT LIVE STREAM PANEL */}
          <div className="ltm-stream-col">
            {/* Toolbar: Time-Window Switcher + Search */}
            <div className={`ltm-toolbar${isDocked ? " ltm-toolbar--docked" : ""}`}>
              <div className="ltm-window-seg" role="tablist" aria-label="Live stream time window">
                {TIME_WINDOWS.map((win) => {
                  const winCount = (windowBuckets[win.id] || []).length;
                  return (
                    <button
                      key={win.id}
                      type="button"
                      role="tab"
                      aria-selected={timeWindow === win.id}
                      className={`ltm-window-btn${timeWindow === win.id ? " is-active" : ""}`}
                      onClick={() => setTimeWindow(win.id)}
                    >
                      {isDocked ? (
                        <span>{win.shortLabel}</span>
                      ) : (
                        <>
                          <span className="ltm-lbl-full">{win.label}</span>
                          <span className="ltm-lbl-compact">{win.compactLabel}</span>
                        </>
                      )}
                      {win.id !== "latest" && (
                        <span className="ltm-window-count">{winCount}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {!isDocked && (
                <div className="ltm-search-wrap">
                  <span className="material-symbols-outlined ltm-search-icon">search</span>
                  <input
                    type="text"
                    className="ltm-search-input"
                    placeholder="Filter donor, drive, hash..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="ltm-search-clear"
                      onClick={() => setSearchQuery("")}
                      aria-label="Clear search"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Active Channel Filter Banner (if filtered) */}
            {railFilter !== "ALL" && !isDocked && (
              <div className="ltm-active-filter-bar">
                <span className="ltm-active-filter-label">
                  <span className="ltm-channel-dot" style={{ backgroundColor: RAIL_CONFIG[railFilter]?.color }} />
                  <span>Filtered by <strong>{RAIL_CONFIG[railFilter]?.label}</strong> ({visibleDonations.length})</span>
                </span>
                <button
                  type="button"
                  className="ltm-clear-link"
                  onClick={() => setRailFilter("ALL")}
                >
                  Clear filter
                </button>
              </div>
            )}

            {/* Stream Feed */}
            <div className="ltm-feed-scroll">
              {loading ? (
                <div className="ltm-skel-list">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="ltm-skel-row">
                      <div className="ltm-skel ltm-skel--avatar" />
                      <div className="ltm-skel-lines">
                        <div className="ltm-skel ltm-skel--name" />
                        <div className="ltm-skel ltm-skel--sub" />
                      </div>
                      <div className="ltm-skel ltm-skel--amt" />
                    </div>
                  ))}
                </div>
              ) : visibleDonations.length === 0 ? (
                <div className="ltm-empty">
                  <div className="ltm-empty-icon-well">
                    <span className="material-symbols-outlined">
                      {searchQuery || railFilter !== "ALL" ? "filter_alt_off" : "sensors"}
                    </span>
                  </div>
                  <div className="ltm-empty-title">
                    {searchQuery || railFilter !== "ALL"
                      ? "No matching donations in this window"
                      : timeWindow === "24h"
                        ? "No incoming donations yet today"
                        : "No donations in this time window"}
                  </div>
                  <p className="ltm-empty-desc">
                    {searchQuery || railFilter !== "ALL"
                      ? "Try clearing your channel filter or switching to a wider time window."
                      : "The tracker is listening live every 4 seconds. New relief donations will appear here automatically."}
                  </p>
                  <div className="ltm-empty-actions">
                    {(searchQuery || railFilter !== "ALL") && (
                      <button
                        type="button"
                        className="ltm-action-btn"
                        onClick={() => { setRailFilter("ALL"); setSearchQuery(""); }}
                      >
                        Reset Filters
                      </button>
                    )}
                    {timeWindow !== "latest" && (
                      <button
                        type="button"
                        className="ltm-action-btn ltm-action-btn--primary"
                        onClick={() => setTimeWindow("latest")}
                      >
                        Show Latest 15
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="ltm-stream-list">
                    {visibleDonations.map((item, idx) => {
                      const railCfg = RAIL_CONFIG[item.rail] || { label: item.rail || "Card", color: "#a1a1aa" };
                      const isNew = newTxId === item.id;
                      const isAnon = Boolean(item.isAnonymous);
                      const isGuest = Boolean(item.isGuest);
                      const donorTitle = isAnon ? "Anonymous Donor" : (item.donorName || (isGuest ? "Guest Donor" : "Donor"));
                      const hasRealTx = item.txHash && item.txHash.startsWith("0x") && item.txHash.length === 66;

                      return (
                        <div
                          key={item.id || item.txHash || idx}
                          className={`ltm-row${isNew ? " is-new" : ""}`}
                        >
                          <div className="ltm-avatar">
                            {isAnon ? (
                              <span className="material-symbols-outlined" title="Anonymous">visibility_off</span>
                            ) : isGuest ? (
                              <span className="material-symbols-outlined" title="Guest">person</span>
                            ) : item.avatarUrl && item.avatarUrl !== "shield" ? (
                              <img src={item.avatarUrl} alt="" className="ltm-avatar-img" />
                            ) : (
                              <span>{donorTitle.charAt(0).toUpperCase()}</span>
                            )}
                          </div>

                          <div className="ltm-row-main">
                            <div className="ltm-row-top">
                              <div className="ltm-donor-wrap">
                                <span className="ltm-donor-name" title={donorTitle}>{donorTitle}</span>
                                {!isGuest && !isAnon && (
                                  <span className="material-symbols-outlined ltm-verified-check" title="Verified Donor">
                                    verified
                                  </span>
                                )}
                                {isNew && <span className="ltm-new-tag">NEW</span>}
                              </div>
                              <span className="ltm-row-amt">
                                ₱{Number(item.amountPhp || 0).toLocaleString("en-US")}
                              </span>
                            </div>

                            <div className="ltm-row-cause" title={item.campaignTitle}>
                              {item.campaignTitle}
                            </div>

                            <div className="ltm-row-meta">
                              <div className="ltm-row-meta-left">
                                <span className="ltm-meta-rail">
                                  <span className="ltm-channel-dot" style={{ backgroundColor: railCfg.color }} />
                                  <span>{railCfg.label}</span>
                                </span>
                                <span className="ltm-meta-sep">·</span>
                                <span className="ltm-meta-time">
                                  {formatLiveTimeAgo(item.createdAt)}
                                  {!isDocked && (
                                    <span className="ltm-exact-time"> ({formatExactTime(item.createdAt)})</span>
                                  )}
                                </span>
                              </div>

                              {!isDocked && item.txHash && (
                                <div className="ltm-row-proof">
                                  <button
                                    type="button"
                                    className={`ltm-hash-btn${copiedHash === item.txHash ? " is-copied" : ""}`}
                                    onClick={(e) => copyHash(e, item.txHash)}
                                    title="Copy transaction hash"
                                  >
                                    <span className="material-symbols-outlined">
                                      {copiedHash === item.txHash ? "check" : "content_copy"}
                                    </span>
                                    <span className="ltm-mono">
                                      {item.txHash.length > 14
                                        ? `${item.txHash.substring(0, 8)}…${item.txHash.slice(-4)}`
                                        : item.txHash}
                                    </span>
                                  </button>
                                  <a
                                    href={
                                      hasRealTx
                                        ? `https://sepolia.etherscan.io/tx/${item.txHash}`
                                        : "https://sepolia.etherscan.io/address/0xB8Effb4f0394946a01da9C5342fC2e70c1E99ddA"
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ltm-ext-link"
                                    title="Verify on Sepolia Etherscan"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span className="material-symbols-outlined">open_in_new</span>
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Clean Bounded Stream Cap Notice */}
                  <div className="ltm-stream-cap">
                    <span>
                      {isCapped
                        ? `Showing latest ${visibleDonations.length} of ${totalMatched} donations in ${activeWindowCfg.desc.toLowerCase()}`
                        : `Showing ${visibleDonations.length} ${visibleDonations.length === 1 ? "donation" : "donations"} · ${activeWindowCfg.desc}`}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── FLUSH RECESSED FOOTER ── */}
        <div className={`ltm-footer${isDocked ? " ltm-footer--docked" : ""}`}>
          <div className="ltm-footer-left">
            <span className={`ltm-status-dot${isPaused ? " is-paused" : ""}`} />
            <span>
              {isDocked
                ? "Sepolia + TiDB Live"
                : "0% BBDRTS Markup · Gasless Sepolia EVM · Direct Relief"}
            </span>
          </div>

          <button
            type="button"
            className="ltm-footer-cta"
            onClick={() => {
              onClose();
              setTimeout(() => {
                const el = document.getElementById("campaigns") || document.getElementById("tour-campaigns-container");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }, 200);
            }}
          >
            <span className="material-symbols-outlined">explore</span>
            <span>{isDocked ? "Drives" : "Browse Relief Drives"}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
