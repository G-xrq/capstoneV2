import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import DonorBadge from "./DonorBadge.jsx";
import "./LiveTrackerModal.css";

import { API_URL } from "../config";

const RAIL_CONFIG = {
  ONCHAIN: { label: "Sepolia EVM",  icon: "token",                 color: "#f59e0b", dim: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
  GCASH:   { label: "GCash",        icon: "account_balance_wallet", color: "#0ea5e9", dim: "rgba(14,165,233,0.12)", border: "rgba(14,165,233,0.3)" },
  MAYA:    { label: "Maya",          icon: "wallet",                 color: "#00D68F", dim: "rgba(0,214,143,0.12)",  border: "rgba(0,214,143,0.3)"  },
  CARD:    { label: "Card / Bank",  icon: "credit_card",            color: "#a78bfa", dim: "rgba(167,139,250,0.12)",border: "rgba(167,139,250,0.3)"},
};

function AnimatedNumber({ value, prefix, suffix, decimals }) {
  prefix = prefix || "";
  suffix = suffix || "";
  decimals = decimals || 0;
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
      const prog = Math.min((ts - startRef.current) / 780, 1);
      const ease = 1 - Math.pow(1 - prog, 3);
      setDisplay(fromRef.current + (target - fromRef.current) * ease);
      if (prog < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value]);

  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString();
  return React.createElement(React.Fragment, null, prefix, formatted, suffix);
}

export default function LiveTrackerModal({ isOpen, onClose, theme }) {
  theme = theme || "default";
  const [donations, setDonations]     = useState([]);
  const [serverStats, setServerStats] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [railFilter, setRailFilter]   = useState("ALL");
  const [railLoading, setRailLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedHash, setCopiedHash]   = useState(null);
  const [isDocked, setIsDocked]       = useState(false);
  const [newTxId, setNewTxId]         = useState(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const prevFirstIdRef                = useRef(null);
  const railTimerRef                  = useRef(null);

  // Clean up rail transition timer
  useEffect(() => {
    return () => {
      if (railTimerRef.current) clearTimeout(railTimerRef.current);
    };
  }, []);

  // Tactile loading transition when changing payment rail filter (same as Leaderboard)
  const handleRailFilterChange = useCallback((targetRail) => {
    if (targetRail === railFilter) return;
    if (railTimerRef.current) clearTimeout(railTimerRef.current);
    setRailLoading(true);
    setRailFilter(targetRail);
    railTimerRef.current = setTimeout(() => {
      setRailLoading(false);
    }, 320);
  }, [railFilter]);

  // Floating dock draggable coordinates
  const [dockPos, setDockPos] = useState(() => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1200;
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    return {
      x: Math.max(16, w - 424 - 24),
      y: Math.max(16, h - 560 - 24)
    };
  });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });

  // Clamp dock on window resize
  useEffect(() => {
    const onResize = () => {
      setDockPos(prev => ({
        x: Math.min(Math.max(16, prev.x), Math.max(16, window.innerWidth - 424 - 16)),
        y: Math.min(Math.max(16, prev.y), Math.max(16, window.innerHeight - 560 - 16))
      }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleHeaderMouseDown = (e) => {
    if (!isDocked) return;
    if (e.target.closest("button") || e.target.closest("input") || e.target.closest("a")) return;
    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: dockPos.x,
      posY: dockPos.y
    };
    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.mouseX;
      const dy = moveEvent.clientY - dragStartRef.current.mouseY;
      const maxX = Math.max(16, window.innerWidth - 424 - 16);
      const maxY = Math.max(16, window.innerHeight - 560 - 16);
      setDockPos({
        x: Math.min(Math.max(16, dragStartRef.current.posX + dx), maxX),
        y: Math.min(Math.max(16, dragStartRef.current.posY + dy), maxY)
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

  const handleHeaderTouchStart = (e) => {
    if (!isDocked || !e.touches || e.touches.length === 0) return;
    if (e.target.closest("button") || e.target.closest("input") || e.target.closest("a")) return;
    const touch = e.touches[0];
    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: touch.clientX,
      mouseY: touch.clientY,
      posX: dockPos.x,
      posY: dockPos.y
    };

    const onTouchMove = (moveEvent) => {
      if (!isDraggingRef.current || !moveEvent.touches || moveEvent.touches.length === 0) return;
      const t = moveEvent.touches[0];
      const dx = t.clientX - dragStartRef.current.mouseX;
      const dy = t.clientY - dragStartRef.current.mouseY;
      const maxX = Math.max(16, window.innerWidth - 424 - 16);
      const maxY = Math.max(16, window.innerHeight - 560 - 16);
      setDockPos({
        x: Math.min(Math.max(16, dragStartRef.current.posX + dx), maxX),
        y: Math.min(Math.max(16, dragStartRef.current.posY + dy), maxY)
      });
    };

    const onTouchEnd = () => {
      isDraggingRef.current = false;
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };

    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
  };

  // Live 1-second clock ticking for real-time live timestamps
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  const fetchLiveStream = useCallback(async (silent) => {
    silent = silent || false;
    if (!silent) setLoading(true);
    const minDelay = !silent ? new Promise((resolve) => setTimeout(resolve, 380)) : Promise.resolve();
    try {
      const fetchPromise = fetch(`${API_URL}/api/donations/live?limit=100&_t=${Date.now()}`);
      const [res] = await Promise.all([fetchPromise, minDelay]);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.donations || []);
        const telemetry = (!Array.isArray(data) && data.stats) ? data.stats : null;
        if (list.length > 0) {
          if (prevFirstIdRef.current && list[0].id !== prevFirstIdRef.current) {
            setNewTxId(list[0].id);
            setTimeout(() => setNewTxId(null), 3800);
          }
          prevFirstIdRef.current = list[0].id;
          setDonations(list);
          if (telemetry) setServerStats(telemetry);
        }
      }
    } catch (err) {
      console.warn("LiveTracker fetch failed:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchLiveStream();
    const interval = setInterval(() => fetchLiveStream(true), 4000);
    const onDonation = () => fetchLiveStream(true);
    window.addEventListener("bbdrts_donation_success", onDonation);
    return () => {
      clearInterval(interval);
      window.removeEventListener("bbdrts_donation_success", onDonation);
    };
  }, [isOpen, fetchLiveStream]);

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
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const formatLiveTimeAgo = (dateInput) => {
    if (!dateInput) return "Just now";
    let d;
    if (typeof dateInput === "string") {
      const t = dateInput.trim();
      d = (!t.endsWith("Z") && !t.includes("+") && !/-\d{2}:\d{2}$/.test(t))
        ? new Date(t.replace(" ", "T") + "Z") : new Date(t);
    } else { d = new Date(dateInput); }
    const diff = Math.floor((currentTime - d.getTime()) / 1000);
    if (isNaN(diff) || diff < 8) return "Just now";
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const formatExactTime = (dateInput) => {
    if (!dateInput) return "";
    try {
      let d;
      if (typeof dateInput === "string") {
        const t = dateInput.trim();
        d = (!t.endsWith("Z") && !t.includes("+") && !/-\d{2}:\d{2}$/.test(t))
          ? new Date(t.replace(" ", "T") + "Z") : new Date(t);
      } else { d = new Date(dateInput); }
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    } catch (_) { return ""; }
  };

  const stats = useMemo(() => {
    if (serverStats) return serverStats;
    let totalPhp = 0, totalEth = 0;
    const uniqueCauses = new Set();
    const byRail = { ONCHAIN: 0, GCASH: 0, MAYA: 0, CARD: 0 };
    donations.forEach(d => {
      totalPhp += Number(d.amountPhp || 0);
      totalEth += Number(d.amountEth || 0);
      if (d.campaignId) uniqueCauses.add(d.campaignId);
      if (byRail[d.rail] !== undefined) byRail[d.rail]++;
    });
    return {
      totalPhp, totalEth,
      txCount: donations.length,
      avgPhp: donations.length > 0 ? Math.round(totalPhp / donations.length) : 0,
      activeCauses: uniqueCauses.size,
      byRail,
    };
  }, [donations, serverStats]);

  const filteredDonations = useMemo(() => {
    return donations.filter(d => {
      if (railFilter !== "ALL" && d.rail !== railFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !(d.donorName || "").toLowerCase().includes(q) &&
          !(d.campaignTitle || "").toLowerCase().includes(q) &&
          !(d.txHash || "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [donations, railFilter, searchQuery]);

  if (!isOpen) return null;


  return createPortal(
    React.createElement("div", { className: `ltm-root${isDocked ? " is-docked" : ""}`, "data-theme": theme },
      !isDocked && React.createElement("div", { className: "ltm-backdrop", onClick: onClose }),

      React.createElement("div", {
        className: `ltm-card${isDocked ? " ltm-card--docked" : ""}`,
        style: isDocked ? { left: `${dockPos.x}px`, top: `${dockPos.y}px` } : undefined
      },

        /* HEADER */
        React.createElement("div", {
          className: `ltm-header${isDocked ? " is-draggable" : ""}`,
          onMouseDown: handleHeaderMouseDown,
          onTouchStart: handleHeaderTouchStart
        },
          React.createElement("div", { className: "ltm-header-ambient" }),
          React.createElement("div", { className: "ltm-header-left" },
            isDocked && React.createElement("span", {
              className: "material-symbols-outlined ltm-drag-handle",
              title: "Click and drag anywhere to move widget"
            }, "drag_indicator"),
            React.createElement("div", { className: "ltm-beacon-wrap" },
              React.createElement("span", { className: "ltm-beacon-ring ltm-beacon-ring--1" }),
              React.createElement("span", { className: "ltm-beacon-ring ltm-beacon-ring--2" }),
              React.createElement("span", { className: "material-symbols-outlined ltm-radar-icon" }, "radar")
            ),
            React.createElement("div", { className: "ltm-title-block" },
              React.createElement("div", { className: "ltm-title-row" },
                React.createElement("h3", { className: "ltm-title" }, isDocked ? "Live Tracker" : "Live Donation Tracker"),
                React.createElement("span", { className: "ltm-live-chip" },
                  React.createElement("span", { className: "ltm-live-dot" }),
                  "REAL-TIME"
                )
              ),
              !isDocked && React.createElement("p", { className: "ltm-subtitle" },
                `Real-time donations across ${stats.activeCauses > 0 ? stats.activeCauses : "active"} disaster relief campaigns \u00b7 All payment methods`
              )
            )
          ),
          React.createElement("div", { className: "ltm-header-right" },
            !isDocked && React.createElement("div", { className: "ltm-live-clock-chip", title: "Current time" },
              React.createElement("span", { className: "ltm-live-clock-dot" }),
              React.createElement("span", { className: "ltm-live-clock-text" },
                new Date(currentTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })
              )
            ),
            React.createElement("button", {
              type: "button",
              className: `ltm-tool-btn${isDocked ? " is-active" : ""}`,
              onClick: (e) => { e.stopPropagation(); setIsDocked(p => !p); },
              title: isDocked ? "Expand full center view" : "Minimize to floating widget",
              "aria-label": isDocked ? "Expand" : "Minimize"
            },
              React.createElement("span", { className: "material-symbols-outlined" }, isDocked ? "open_in_full" : "picture_in_picture_alt")
            ),
            React.createElement("button", {
              type: "button",
              className: "ltm-tool-btn",
              onClick: (e) => { e.stopPropagation(); fetchLiveStream(false); },
              title: "Refresh stream",
              "aria-label": "Refresh"
            },
              React.createElement("span", { className: "material-symbols-outlined" }, "refresh")
            ),
            React.createElement("button", {
              type: "button",
              className: "ltm-tool-btn ltm-close-btn",
              onClick: onClose,
              title: "Close live stream",
              "aria-label": "Close"
            },
              React.createElement("span", { className: "material-symbols-outlined" }, "close")
            )
          )
        ),

        /* BODY */
        React.createElement("div", { className: "ltm-body" },

          /* LEFT PANEL */
          !isDocked && React.createElement("aside", { className: "ltm-left-panel" },

            React.createElement("div", { className: "ltm-kpi-stack" },
              React.createElement("div", { className: "ltm-kpi-card ltm-kpi-card--accent" },
                React.createElement("div", { className: "ltm-kpi-accent-glow" }),
                React.createElement("div", { className: "ltm-kpi-icon ltm-kpi-icon--green" },
                  React.createElement("span", { className: "material-symbols-outlined" }, "payments")
                ),
                React.createElement("div", { className: "ltm-kpi-body" },
                  React.createElement("span", { className: "ltm-kpi-label" }, "Total Donations"),
                  React.createElement("span", { className: "ltm-kpi-value" },
                    "\u20B1", React.createElement(AnimatedNumber, { value: stats.totalPhp })
                  ),
                  React.createElement("span", { className: "ltm-kpi-sub" },
                    React.createElement(AnimatedNumber, { value: stats.totalEth, decimals: 4 }), " in ETH"
                  )
                )
              ),
              React.createElement("div", { className: "ltm-kpi-card" },
                React.createElement("div", { className: "ltm-kpi-icon ltm-kpi-icon--blue" },
                  React.createElement("span", { className: "material-symbols-outlined" }, "receipt_long")
                ),
                React.createElement("div", { className: "ltm-kpi-body" },
                  React.createElement("span", { className: "ltm-kpi-label" }, "Total Transactions"),
                  React.createElement("span", { className: "ltm-kpi-value" },
                    React.createElement(AnimatedNumber, { value: stats.txCount }), " ",
                    React.createElement("span", { className: "ltm-kpi-unit" }, "donations")
                  ),
                  React.createElement("span", { className: "ltm-kpi-sub" }, "Crypto, GCash, Maya & Cards")
                )
              ),
              React.createElement("div", { className: "ltm-kpi-card" },
                React.createElement("div", { className: "ltm-kpi-icon ltm-kpi-icon--purple" },
                  React.createElement("span", { className: "material-symbols-outlined" }, "campaign")
                ),
                React.createElement("div", { className: "ltm-kpi-body" },
                  React.createElement("span", { className: "ltm-kpi-label" }, "Active Relief Drives"),
                  React.createElement("span", { className: "ltm-kpi-value" },
                    React.createElement(AnimatedNumber, { value: stats.activeCauses }), " ",
                    React.createElement("span", { className: "ltm-kpi-unit" }, "campaigns")
                  ),
                  React.createElement("span", { className: "ltm-kpi-sub" }, "Verified Disaster Relief")
                )
              )
            ),

            React.createElement("div", { className: "ltm-rail-section" },
              React.createElement("div", { className: "ltm-section-hdr" },
                React.createElement("span", { className: "material-symbols-outlined" }, "hub"),
                "Payment Methods"
              ),
              Object.entries(RAIL_CONFIG).map(([rail, cfg]) => {
                const count = stats.byRail[rail] || 0;
                const pct = stats.txCount > 0 ? Math.round((count / stats.txCount) * 100) : 0;
                const isActive = railFilter === rail;
                return React.createElement("button", {
                  key: rail, type: "button",
                  className: `ltm-rail-row${isActive ? " is-active" : ""}`,
                  style: { "--rail-color": cfg.color, "--rail-dim": cfg.dim, "--rail-border": cfg.border },
                  onClick: () => handleRailFilterChange(isActive ? "ALL" : rail)
                },
                  React.createElement("span", { className: "material-symbols-outlined ltm-rail-icon" }, cfg.icon),
                  React.createElement("div", { className: "ltm-rail-meta" },
                    React.createElement("span", { className: "ltm-rail-name" }, cfg.label),
                    React.createElement("div", { className: "ltm-rail-stats" },
                      React.createElement("span", { className: "ltm-rail-count" }, `${count} ${count === 1 ? "donation" : "donations"}`),
                      React.createElement("span", { className: "ltm-rail-pct" }, `${pct}%`)
                    )
                  )
                );
              })
            )
          ),

          /* RIGHT PANEL */
          React.createElement("div", { className: "ltm-right-panel" },

            /* Toolbar */
            React.createElement("div", { className: `ltm-toolbar${isDocked ? " ltm-toolbar--docked" : ""}` },
              isDocked
                ? React.createElement("div", { className: "ltm-pills-compact" },
                  ["ALL", ...Object.keys(RAIL_CONFIG)].map(rail => {
                    const cfg = RAIL_CONFIG[rail];
                    const count = rail === "ALL" ? donations.length : (stats.byRail[rail] || 0);
                    return React.createElement("button", {
                      key: rail, type: "button",
                      className: `ltm-pill${railFilter === rail ? " is-active" : ""}`,
                      style: cfg ? { "--rail-color": cfg.color } : {},
                      onClick: () => handleRailFilterChange(rail)
                    },
                      rail === "ALL" ? "All" : cfg.label,
                      React.createElement("span", { className: "ltm-pill-count" }, count)
                    );
                  })
                )
                : React.createElement("div", { className: "ltm-feed-hdr" },
                  React.createElement("span", { className: "ltm-live-dot ltm-live-dot--sm" }),
                  React.createElement("span", { className: "ltm-feed-hdr-text" }, "Recent Donations"),
                  React.createElement("span", { className: "ltm-feed-count" }, filteredDonations.length)
                ),

              React.createElement("div", { className: "ltm-search-wrap" },
                React.createElement("span", { className: "material-symbols-outlined ltm-search-icon" }, "search"),
                React.createElement("input", {
                  type: "text", className: "ltm-search-input",
                  placeholder: "Search donor, campaign, hash...",
                  value: searchQuery, onChange: (e) => setSearchQuery(e.target.value)
                }),
                searchQuery && React.createElement("button", { type: "button", className: "ltm-search-clear", onClick: () => setSearchQuery("") }, "\u00d7")
              )
            ),

            /* Feed */
            React.createElement("div", { className: "ltm-feed-scroll" },
              (loading || railLoading)
                ? React.createElement("div", { className: "ltm-skeleton-list" },
                  [1, 2, 3, 4, 5].map(i =>
                    React.createElement("div", { key: i, className: "ltm-skeleton-card" },
                      React.createElement("div", { className: "ltm-skeleton-avatar" }),
                      React.createElement("div", { className: "ltm-skeleton-content" },
                        React.createElement("div", { className: "ltm-skeleton-row ltm-skeleton-row--top" },
                          React.createElement("div", { className: "ltm-skeleton-pill ltm-skeleton-pill--name" }),
                          React.createElement("div", { className: "ltm-skeleton-pill ltm-skeleton-pill--badge" }),
                          React.createElement("div", { className: "ltm-skeleton-pill ltm-skeleton-pill--amt" })
                        ),
                        React.createElement("div", { className: "ltm-skeleton-row ltm-skeleton-row--mid" },
                          React.createElement("div", { className: "ltm-skeleton-pill ltm-skeleton-pill--cause" })
                        ),
                        React.createElement("div", { className: "ltm-skeleton-row ltm-skeleton-row--btm" },
                          React.createElement("div", { className: "ltm-skeleton-pill ltm-skeleton-pill--rail" }),
                          React.createElement("div", { className: "ltm-skeleton-pill ltm-skeleton-pill--time" }),
                          React.createElement("div", { className: "ltm-skeleton-pill ltm-skeleton-pill--proof" })
                        )
                      )
                    )
                  )
                )
                : filteredDonations.length === 0
                  ? React.createElement("div", { className: "ltm-empty-state" },
                    React.createElement("span", { className: "material-symbols-outlined ltm-empty-icon" }, "filter_alt_off"),
                    React.createElement("p", { className: "ltm-empty-text" }, "No donations match your filters"),
                    React.createElement("button", {
                      type: "button", className: "ltm-reset-btn",
                      onClick: () => { handleRailFilterChange("ALL"); setSearchQuery(""); }
                    }, "Reset Search")
                  )
                  : React.createElement("div", {
                      className: "ltm-cards-list ltm-data-fade-in",
                      key: `rail-${railFilter}-${donations.length}`
                    },
                    filteredDonations.map((item, idx) => {
                      const railCfg = RAIL_CONFIG[item.rail] || {};
                      const isNew = newTxId === item.id;
                      const isAnon = Boolean(item.isAnonymous);
                      const isGuest = Boolean(item.isGuest);
                      const donorTitle = isAnon ? "Anonymous Donor" : (item.donorName || (isGuest ? "Guest Donor" : "Donor"));

                      return React.createElement("div", {
                        key: item.id || item.txHash || idx,
                        className: `ltm-tx-card${isNew ? " ltm-tx-card--new" : ""}`,
                        style: {
                          "--rail-color": railCfg.color || "var(--accent,#22c55e)",
                          "--rail-dim": railCfg.dim || "rgba(34,197,94,0.12)",
                          "--rail-border": railCfg.border || "rgba(34,197,94,0.3)",
                          animationDelay: `${idx * 32}ms`
                        }
                      },
                        React.createElement("div", { className: "ltm-tx-avatar-col" },
                          React.createElement("div", { className: `ltm-tx-avatar ${item.isAnonymous ? "is-anon" : item.isGuest ? "is-guest" : "is-named"}` },
                            item.isAnonymous
                              ? React.createElement("span", { className: "material-symbols-outlined ltm-anon-icon", title: "Anonymous" }, "visibility_off")
                              : item.isGuest
                                ? React.createElement("span", { className: "material-symbols-outlined ltm-guest-icon", title: "Guest" }, "person")
                                : item.avatarUrl && item.avatarUrl !== "shield"
                                  ? React.createElement("img", { src: item.avatarUrl, alt: "", className: "ltm-tx-avatar-img" })
                                  : item.avatarUrl === "shield"
                                    ? React.createElement("span", { className: "material-symbols-outlined" }, "shield")
                                    : React.createElement("span", null, item.donorName ? item.donorName.charAt(0).toUpperCase() : "V")
                          ),
                          isNew && React.createElement("span", { className: "ltm-new-badge" }, "NEW")
                        ),

                        React.createElement("div", { className: "ltm-tx-content" },
                          React.createElement("div", { className: "ltm-tx-row ltm-tx-row--top" },
                            React.createElement("div", { className: "ltm-tx-donor-group" },
                              React.createElement("div", { className: "ltm-tx-name-row" },
                                React.createElement("span", { className: "ltm-tx-donor", title: donorTitle }, donorTitle),
                                !isGuest && !isAnon && item.tierAtTime && React.createElement(DonorBadge, {
                                  tier: item.tierAtTime,
                                  donorId: item.donorId,
                                  walletAddress: item.wallet,
                                  amountEth: item.cumulativeEthAtTime || item.amountEth,
                                  amountPhp: item.cumulativePhpAtTime || item.amountPhp,
                                  size: "xs",
                                  interactive: true,
                                  showTooltip: true
                                }),
                                !isGuest && !isAnon && !item.tierAtTime && React.createElement("span", { className: "material-symbols-outlined ltm-tx-verified", title: "Verified Donor" }, "verified")
                              )
                            ),
                            React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end" } },
                              React.createElement("span", { className: "ltm-tx-amount" },
                                item.rail === "ONCHAIN" && item.amountEth > 0
                                  ? `${Number(item.amountEth).toFixed(4)} ETH`
                                  : `\u20B1${Number(item.amountPhp || 0).toLocaleString()}`
                              ),
                              item.rail === "ONCHAIN" && item.amountPhp > 0 && React.createElement("span", {
                                style: { fontSize: "0.68rem", color: "var(--text-muted, #94a3b8)", fontWeight: 600 }
                              }, `\u2248 \u20B1${Number(item.amountPhp).toLocaleString()}`)
                            )
                          ),
                          React.createElement("div", { className: "ltm-tx-row ltm-tx-row--mid" },
                            React.createElement("span", { className: "material-symbols-outlined ltm-cause-icon" }, "flag"),
                            React.createElement("span", { className: "ltm-tx-cause", title: item.campaignTitle }, item.campaignTitle)
                          ),
                          React.createElement("div", { className: "ltm-tx-row ltm-tx-row--btm" },
                            React.createElement("span", { className: `ltm-tx-rail ltm-tx-rail--${(item.rail || "").toLowerCase()}` },
                              React.createElement("span", { className: "material-symbols-outlined" }, railCfg.icon || "payments"),
                              item.rail === "ONCHAIN" ? "Sepolia EVM" : item.rail
                            ),
                            React.createElement("span", { className: "ltm-tx-time" },
                              `${formatExactTime(item.createdAt)} \u00b7 ${formatLiveTimeAgo(item.createdAt)}`
                            ),
                            item.txHash && React.createElement("div", { className: "ltm-tx-proof" },
                              React.createElement("button", {
                                type: "button",
                                className: `ltm-copy-btn${copiedHash === item.txHash ? " is-copied" : ""}`,
                                onClick: (e) => copyHash(e, item.txHash),
                                title: "Copy proof hash"
                              },
                                React.createElement("span", { className: "material-symbols-outlined" }, copiedHash === item.txHash ? "check" : "content_copy"),
                                React.createElement("span", { className: "ltm-hash-mono" },
                                  item.txHash.length > 14 ? `${item.txHash.substring(0, 8)}\u2026${item.txHash.slice(-4)}` : item.txHash
                                )
                              ),
                              item.txHash && React.createElement("a", {
                                href: item.txHash.startsWith("0x") && item.txHash.length === 66
                                  ? `https://sepolia.etherscan.io/tx/${item.txHash}`
                                  : `https://sepolia.etherscan.io/address/0xB8Effb4f0394946a01da9C5342fC2e70c1E99ddA`,
                                target: "_blank", rel: "noopener noreferrer",
                                className: "ltm-explorer-link",
                                title: item.txHash.startsWith("0x") && item.txHash.length === 66
                                  ? "View on Sepolia Etherscan"
                                  : "View Smart Contract on Sepolia Etherscan",
                                onClick: (e) => e.stopPropagation()
                              },
                                React.createElement("span", { className: "material-symbols-outlined" }, "open_in_new")
                              )
                            )
                          )
                        )
                      );
                    })
                  )
            )
          )
        ),

        /* FOOTER */
        React.createElement("div", { className: `ltm-footer${isDocked ? " ltm-footer--docked" : ""}` },
          React.createElement("div", { className: "ltm-footer-left" },
            React.createElement("span", { className: "ltm-footer-beacon" }),
            isDocked
              ? React.createElement("span", { className: "ltm-footer-node-short" }, "Sepolia + TiDB Live")
              : React.createElement("span", { className: "ltm-footer-node-desc" }, "0% Intermediary Fee \u00b7 Direct Node Sync \u00b7 TiDB Cloud + Sepolia EVM")
          ),
          React.createElement("button", {
            type: "button", className: "ltm-ledger-btn",
            onClick: () => { onClose(); setTimeout(() => { const el = document.getElementById("campaigns"); if (el) el.scrollIntoView({ behavior: "smooth" }); }, 200); }
          },
            React.createElement("span", { className: "material-symbols-outlined" }, "receipt_long"),
            isDocked ? "Ledger" : "Open Campaign Ledger"
          )
        )
      )
    ),
    document.body
  );
}
