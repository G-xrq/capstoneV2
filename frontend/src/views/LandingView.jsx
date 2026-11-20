import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import CampaignCard, {
  getCampaignCoverData,
  getCampaignCategoryInfo,
  getOrgDisplayName,
  progressPct
} from '../components/CampaignCard';
import DisasterRadarHeatmap from '../components/DisasterRadarHeatmap';
import { contractAddress } from '../contractConfig';
import { API_URL } from '../config';
import { getPaginationItems } from '../utils/pagination';
import './LandingView.css';

// ── Curated Fallback Slides Matching Live BBDRTS Database Campaigns ──
const HERO_FALLBACK_CAMPAIGNS = [
  {
    id: 1,
    title: 'Typhoon Kristine Emergency Relief & Food Packs',
    orgName: 'Philippine Red Cross - Southern Leyte',
    category: 'TYPHOON',
    locationRegion: 'Magsaysay Avenue, Naga City, Camarines Sur, Philippines',
    description: 'Immediate emergency financial assistance and clean drinking water distribution for typhoon victims in Leyte & Bicol.',
    currentAmountPhp: 399517,
    targetAmountPhp: 2550000,
    disbursementStatus: 'FUNDRAISING'
  },
  {
    id: 6,
    title: 'Tagnipa Flood Relief & Community Recovery Campaign',
    orgName: 'Philippine Red Cross',
    category: 'DR',
    locationRegion: 'C. Laraga Street, Tagnipa, Maasin City, Southern Leyte, Philippines',
    description: 'Emergency disaster response, relief distribution, and rehabilitation operation.',
    currentAmountPhp: 201500,
    targetAmountPhp: 340000,
    disbursementStatus: 'FUNDRAISING'
  },
  {
    id: 2,
    title: 'Flash Flood Rescue & Medical Aid Ops',
    orgName: 'Caritas Philippines (NASSA)',
    category: 'FLOOD',
    locationRegion: 'Southern Leyte Coastal Municipalities',
    description: 'Providing direct medical assistance, sanitation kits, and emergency shelter kits for flooded barangays.',
    currentAmountPhp: 204000,
    targetAmountPhp: 1700000,
    disbursementStatus: 'FUNDRAISING'
  },
  {
    id: 9,
    title: 'Sogod Community Emergency Relief Campaign',
    orgName: 'ReliefLink PH',
    category: 'DR',
    locationRegion: 'Maharlika Highway, Sogod, Southern Leyte, Philippines',
    description: 'Emergency disaster response, relief distribution, and rehabilitation operation.',
    currentAmountPhp: 168830,
    targetAmountPhp: 306000,
    disbursementStatus: 'FUNDRAISING'
  },
  {
    id: 90009,
    title: 'Yolanda (Haiyan) Emergency Relief and Recovery – Tacloban',
    orgName: 'ReliefLink PH',
    category: 'DR',
    locationRegion: 'Magsaysay Boulevard, Tacloban City, Leyte, Philippines',
    description: 'Emergency food distribution, clean drinking water, medical aid, and temporary shelter for affected families.',
    currentAmountPhp: 9000,
    targetAmountPhp: 4999700,
    disbursementStatus: 'FUNDRAISING'
  }
];

const formatShortLocation = (rawLoc) => {
  if (!rawLoc || typeof rawLoc !== 'string') return 'Southern Leyte, PH';
  const cleaned = rawLoc
    .replace(/\([^)]*\)/g, '')
    .replace(/,\s*\d{4}/g, '')
    .replace(/,\s*Philippines/i, '')
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);
  if (cleaned.length >= 2) return cleaned.slice(-2).join(', ');
  return cleaned[0] || 'Southern Leyte, PH';
};

const getHeroStepDetails = (step, camp, raisedPhp, targetPhp, pct) => {
  const orgName = getOrgDisplayName(camp?.orgAddress, camp?.orgName, camp?.id);
  const shortLoc = formatShortLocation(camp?.locationRegion || camp?.location_region);

  switch (step) {
    case 'donate':
      return {
        title: 'Multi-Rail Donation',
        stage: 'Step 1',
        status: 'Received',
        field1Label: 'Payment Rails',
        field1Value: 'GCash · Maya · Bank · Card',
        field2Label: 'Recipient NGO',
        field2Value: orgName,
        isLedgerLink: false
      };
    case 'verify':
      return {
        title: 'AI Receipt Check',
        stage: 'Step 2',
        status: 'Verified',
        field1Label: 'Verification',
        field1Value: 'AI OCR Receipt & Ref No.',
        field2Label: 'Escrow Rule',
        field2Value: 'Checked Before Release',
        isLedgerLink: false
      };
    case 'track':
      return {
        title: 'Relief Progress',
        stage: 'Step 4',
        status: camp?.disbursementStatus === 'COMPLETED' ? 'Completed' : 'Live',
        field1Label: 'Location',
        field1Value: shortLoc,
        field2Label: 'Raised so far',
        field2Value: `₱${raisedPhp.toLocaleString()} (${pct}%)`,
        isLedgerLink: false
      };
    case 'record':
    default:
      return {
        title: 'Blockchain Record',
        stage: 'Step 3',
        status: 'Verified',
        field1Label: 'Transaction Hash',
        field1Value: '0x8f32...c41e',
        field2Label: 'Network Ledger',
        field2Value: 'Sepolia Public Ledger',
        isLedgerLink: true
      };
  }
};

const HERO_SLIDE_INTERVAL_MS = 6500;
const HERO_SLIDE_ANIM_MS = 380;

const getValidHeroPool = (rawList) => {
  const filtered = Array.isArray(rawList)
    ? rawList.filter((c) => {
        if (!c || !c.title) return false;
        if (/testing/i.test(c.title)) return false;
        const tgtPhp =
          parseFloat(c.targetAmountPhp || c.target_amount_php || 0) ||
          parseFloat(c.targetAmount || 0) * 170000;
        return tgtPhp >= 1000;
      })
    : [];
  return filtered.length > 0 ? filtered : HERO_FALLBACK_CAMPAIGNS;
};

const shuffleCampaigns = (pool, avoidFirstId = null) => {
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  if (avoidFirstId != null && copy.length > 1 && Number(copy[0]?.id) === Number(avoidFirstId)) {
    const swapIdx = 1 + Math.floor(Math.random() * (copy.length - 1));
    [copy[0], copy[swapIdx]] = [copy[swapIdx], copy[0]];
  }
  return copy;
};

const computeNextHeroState = (prev, dir, pool) => {
  if (!pool || pool.length <= 1) return prev;
  const curr = prev.queue[prev.cursor] || pool[0];
  const exiting = curr ? { camp: curr, seq: prev.seq, direction: dir } : null;

  if (dir === 'prev') {
    if (prev.cursor > 0) {
      return {
        ...prev,
        cursor: prev.cursor - 1,
        direction: 'prev',
        seq: prev.seq + 1,
        exiting
      };
    }
    const candidates = pool.filter((c) => Number(c.id) !== Number(curr?.id));
    const randomPrev =
      shuffleCampaigns(candidates.length > 0 ? candidates : pool)[0] || curr;
    return {
      queue: [randomPrev, ...prev.queue].slice(0, 45),
      cursor: 0,
      direction: 'prev',
      seq: prev.seq + 1,
      exiting
    };
  }

  if (prev.cursor + 1 < prev.queue.length) {
    return {
      ...prev,
      cursor: prev.cursor + 1,
      direction: 'next',
      seq: prev.seq + 1,
      exiting
    };
  }

  const keepBack = prev.queue.slice(Math.max(0, prev.cursor - 15), prev.cursor + 1);
  const nextBatch = shuffleCampaigns(pool, curr?.id);
  return {
    queue: [...keepBack, ...nextBatch],
    cursor: keepBack.length,
    direction: 'next',
    seq: prev.seq + 1,
    exiting
  };
};

const computeHeroCampaignDisplay = (camp) => {
  const cover = getCampaignCoverData(camp);
  const rawImg = cover?.imageUrl || '/hero_relief_command.jpg';
  const imageUrl = rawImg.startsWith('/uploads') ? `${API_URL}${rawImg}` : rawImg;
  const cat = getCampaignCategoryInfo(camp);
  const orgName = getOrgDisplayName(camp?.orgAddress, camp?.orgName, camp?.id);

  const rb = camp?.railBreakdown;
  const rbPhp = rb
    ? Math.round((rb.gcash?.php || 0) + (rb.maya?.php || 0) + (rb.bank?.php || 0) + (rb.eth?.php || 0))
    : 0;
  const raisedPhp = Math.round(
    rbPhp > 0
      ? rbPhp
      : parseFloat(camp?.currentAmountPhp || camp?.current_amount_php || 0) ||
          Math.round(parseFloat(camp?.currentAmount || 0) * 170000)
  );
  const targetPhp = Math.round(
    parseFloat(camp?.targetAmountPhp || camp?.target_amount_php || 0) ||
      Math.round(parseFloat(camp?.targetAmount || 0) * 170000)
  );
  const pct =
    targetPhp > 0 && raisedPhp > 0
      ? raisedPhp >= targetPhp
        ? '100'
        : progressPct(raisedPhp, targetPhp)
      : progressPct(camp?.currentAmount || raisedPhp, camp?.targetAmount || targetPhp);

  return {
    imageUrl,
    categoryLabel: cat.label,
    orgName,
    raisedPhp,
    targetPhp,
    pct
  };
};

function HeroCampaignTextPane({ camp, categoryLabel, orgName }) {
  return (
    <>
      <div className="bdr-campaign-badge-row">
        <span className="bdr-campaign-pill">{categoryLabel}</span>
        <span className="bdr-campaign-network-tag" title={orgName}>{orgName}</span>
      </div>
      <h3 className="bdr-campaign-title" title={camp?.title}>{camp?.title}</h3>
      <p className="bdr-campaign-desc">{camp?.description || 'Verified disaster response and community relief operation.'}</p>
    </>
  );
}

function HeroMetricRow({ metrics }) {
  return (
    <>
      <span className="bdr-campaign-amount">
        ₱{metrics.raisedPhp.toLocaleString()}{' '}
        <span className="bdr-campaign-target">/ ₱{metrics.targetPhp.toLocaleString()}</span>
      </span>
      <span className="bdr-campaign-pct">{metrics.pct}%</span>
    </>
  );
}

function useSmoothCounter(targetValue, durationMs = 950) {
  const safeTarget = Number.isFinite(Number(targetValue)) ? Math.round(Number(targetValue)) : 0;
  const [displayValue, setDisplayValue] = useState(safeTarget);
  const [isBumping, setIsBumping] = useState(false);
  const prevTargetRef = useRef(safeTarget);
  const displayRef = useRef(safeTarget);

  useEffect(() => {
    const startVal = displayRef.current;
    const endVal = safeTarget;
    if (startVal === endVal) return;

    const didIncrease = endVal > prevTargetRef.current && prevTargetRef.current > 0;
    prevTargetRef.current = endVal;
    if (didIncrease) setIsBumping(true);

    let rafId = null;
    const startTime = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextVal = Math.round(startVal + (endVal - startVal) * eased);
      displayRef.current = nextVal;
      setDisplayValue(nextVal);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        displayRef.current = endVal;
        setDisplayValue(endVal);
      }
    };
    rafId = requestAnimationFrame(tick);

    const bumpTimer = didIncrease ? setTimeout(() => setIsBumping(false), 1200) : null;
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (bumpTimer) clearTimeout(bumpTimer);
    };
  }, [safeTarget, durationMs]);

  return { value: displayValue, isBumping };
}

export default function LandingView({
  onConnect,
  onSignIn,
  onSignUp,
  hasMetaMask,
  contract,
  onOpenNgoProfile,
  theme
}) {
  const [activeFlowStep, setActiveFlowStep] = useState('record');
  const tiltStageRef = useRef(null);
  const visualizerRef = useRef(null);
  const tiltStateRef = useRef({
    currX: 0,
    currY: 0,
    targetX: 0,
    targetY: 0,
    active: false,
    rafId: null
  });

  const runTiltLoop = useCallback(() => {
    const el = visualizerRef.current;
    const st = tiltStateRef.current;
    if (!el) {
      st.rafId = null;
      return;
    }

    const ease = st.active ? 0.16 : 0.22;
    st.currX += (st.targetX - st.currX) * ease;
    st.currY += (st.targetY - st.currY) * ease;

    if (!st.active && Math.abs(st.currX) < 0.02 && Math.abs(st.currY) < 0.02) {
      st.currX = 0;
      st.currY = 0;
      st.rafId = null;
      el.classList.remove('is-tilting');
      el.style.transform = '';
      el.style.setProperty('--pointer-x', '50%');
      el.style.setProperty('--pointer-y', '50%');
      return;
    }

    el.classList.add('is-tilting');
    el.style.transform = `rotateX(${st.currX.toFixed(3)}deg) rotateY(${st.currY.toFixed(3)}deg)`;
    st.rafId = requestAnimationFrame(runTiltLoop);
  }, []);

  const handleVisualizerMouseMove = useCallback(
    (e) => {
      const stage = tiltStageRef.current;
      const el = visualizerRef.current;
      if (!stage || !el) return;

      // Measure the static non-tilted wrapper so 3D rotation never causes bounding-box jitter
      const rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const xRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const yRatio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      const st = tiltStateRef.current;
      st.targetY = (xRatio - 0.5) * 10;
      st.targetX = (0.5 - yRatio) * 8;
      st.active = true;

      el.style.setProperty('--pointer-x', `${(xRatio * 100).toFixed(1)}%`);
      el.style.setProperty('--pointer-y', `${(yRatio * 100).toFixed(1)}%`);

      if (!st.rafId) {
        st.rafId = requestAnimationFrame(runTiltLoop);
      }
    },
    [runTiltLoop]
  );

  const handleVisualizerMouseLeave = useCallback(() => {
    const st = tiltStateRef.current;
    st.targetX = 0;
    st.targetY = 0;
    st.active = false;
    if (!st.rafId && (Math.abs(st.currX) >= 0.02 || Math.abs(st.currY) >= 0.02)) {
      st.rafId = requestAnimationFrame(runTiltLoop);
    }
  }, [runTiltLoop]);

  useEffect(() => {
    return () => {
      if (tiltStateRef.current.rafId) {
        cancelAnimationFrame(tiltStateRef.current.rafId);
      }
    };
  }, []);

  const [stats, setStats] = useState(() => {
    try {
      const cached = localStorage.getItem('bbdrts_cached_stats_v1');
      if (cached) {
        const p = JSON.parse(cached);
        if (p && typeof p.totalPhp === 'number') return p;
      }
    } catch (_) {}
    return {
      donors: 0,
      orgs: 0,
      campaigns: 0,
      totalEthRaised: '0.0000',
      totalPhp: 0,
      totalPhpEstimated: '0'
    };
  });

  const animatedPhp = useSmoothCounter(stats.totalPhp, 1050);
  const animatedDonors = useSmoothCounter(stats.donors, 850);
  const animatedOrgs = useSmoothCounter(stats.orgs, 750);

  const [campaigns, setCampaigns] = useState(() => {
    try {
      const cached = localStorage.getItem('bbdrts_cached_campaigns_v2');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [];
  });

  const validHeroPool = useMemo(() => getValidHeroPool(campaigns), [campaigns]);

  const [heroSlider, setHeroSlider] = useState(() => {
    const initialPool = getValidHeroPool(campaigns);
    return {
      queue: shuffleCampaigns(initialPool),
      cursor: 0,
      direction: 'next',
      seq: 0,
      exiting: null
    };
  });
  const [isHeroCardHovered, setIsHeroCardHovered] = useState(false);
  const heroAutoTimerRef = useRef(null);
  const heroHoveredRef = useRef(false);

  const clearAutoAdvanceTimer = useCallback(() => {
    if (heroAutoTimerRef.current) {
      clearTimeout(heroAutoTimerRef.current);
      heroAutoTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearAutoAdvanceTimer, [clearAutoAdvanceTimer]);

  // Clear exiting transition layer deterministically after animation completes
  useEffect(() => {
    if (!heroSlider.exiting) return;
    const exitTargetSeq = heroSlider.seq;
    const timer = setTimeout(() => {
      setHeroSlider((prev) =>
        prev.seq === exitTargetSeq && prev.exiting ? { ...prev, exiting: null } : prev
      );
    }, HERO_SLIDE_ANIM_MS);
    return () => clearTimeout(timer);
  }, [heroSlider.seq, heroSlider.exiting]);

  // Expand / refresh the randomized slide queue whenever live campaigns arrive or update
  useEffect(() => {
    if (!validHeroPool.length) return;
    const byId = new Map(validHeroPool.map((c) => [Number(c.id), c]));

    setHeroSlider((prev) => {
      const visitedPrefix = prev.queue
        .slice(0, prev.cursor + 1)
        .map((c) => byId.get(Number(c?.id)) || c)
        .filter(Boolean);

      const anchor = visitedPrefix[visitedPrefix.length - 1] || validHeroPool[0];
      const visitedIds = new Set(visitedPrefix.map((c) => Number(c.id)));
      const unseen = validHeroPool.filter((c) => !visitedIds.has(Number(c.id)));
      const remainingPool =
        unseen.length > 0
          ? unseen
          : validHeroPool.filter((c) => Number(c.id) !== Number(anchor?.id));

      const nextQueueTail = shuffleCampaigns(
        remainingPool.length > 0 ? remainingPool : validHeroPool,
        anchor?.id
      );

      return {
        ...prev,
        queue: [...visitedPrefix, ...nextQueueTail],
        cursor: Math.max(0, visitedPrefix.length - 1)
      };
    });
  }, [validHeroPool]);

  const activeHeroCampaign =
    heroSlider.queue[heroSlider.cursor] || validHeroPool[0] || HERO_FALLBACK_CAMPAIGNS[0];
  const exitingHeroSlide = heroSlider.exiting;

  const advanceHeroSlide = useCallback(
    (dir = 'next') => {
      clearAutoAdvanceTimer();
      setHeroSlider((prev) => computeNextHeroState(prev, dir, validHeroPool));
    },
    [clearAutoAdvanceTimer, validHeroPool]
  );

  // Auto-advance to another randomized campaign only when unhovered and strictly matching current seq
  useEffect(() => {
    clearAutoAdvanceTimer();
    if (isHeroCardHovered || validHeroPool.length <= 1) return;

    const scheduledSeq = heroSlider.seq;
    heroAutoTimerRef.current = setTimeout(() => {
      heroAutoTimerRef.current = null;
      if (heroHoveredRef.current) return;
      setHeroSlider((prev) => {
        if (prev.seq !== scheduledSeq) return prev;
        return computeNextHeroState(prev, 'next', validHeroPool);
      });
    }, HERO_SLIDE_INTERVAL_MS);

    return clearAutoAdvanceTimer;
  }, [heroSlider.seq, isHeroCardHovered, validHeroPool, clearAutoAdvanceTimer]);

  const activeMetrics = useMemo(
    () => computeHeroCampaignDisplay(activeHeroCampaign),
    [activeHeroCampaign]
  );
  const exitingMetrics = useMemo(
    () => (exitingHeroSlide?.camp ? computeHeroCampaignDisplay(exitingHeroSlide.camp) : null),
    [exitingHeroSlide]
  );
  const stepDetails = getHeroStepDetails(
    activeFlowStep,
    activeHeroCampaign,
    activeMetrics.raisedPhp,
    activeMetrics.targetPhp,
    activeMetrics.pct
  );

  const [loadingCampaigns, setLoadingCampaigns] = useState(() => {
    try {
      const cached = localStorage.getItem('bbdrts_cached_campaigns_v2');
      if (cached && JSON.parse(cached).length > 0) return false;
    } catch (_) {}
    return true;
  });

  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('urgency'); // 'urgency' | 'target' | 'raised' | 'newest'
  const [viewMode, setViewMode] = useState('list'); // Default to list mode as requested
  const [contractCopied, setContractCopied] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  // Deep Link URL Target Campaign Detection (?campaign=14)
  const [targetCampaignId, setTargetCampaignId] = useState(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('campaign');
  });
  const targetScrolledRef = useRef(false);

  const handleCopyContract = () => {
    if (!contractAddress) return;
    navigator.clipboard.writeText(contractAddress);
    setContractCopied(true);
    setTimeout(() => setContractCopied(false), 2200);
  };

  const toggleFaq = (index) => {
    setOpenFaqIndex(prev => prev === index ? null : index);
  };

  useEffect(() => {
    if (!targetCampaignId && !window.location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [targetCampaignId]);

  useEffect(() => {
    let isMounted = true;
    const fetchLandingData = async () => {
      try {
        const apiUrl = API_URL;

        // Fetch real database counts and live campaigns in parallel
        const [statsRes, campsRes] = await Promise.all([
          fetch(`${apiUrl}/api/public-stats`).catch(() => null),
          fetch(`${apiUrl}/api/campaigns`).catch(() => null)
        ]);

        let realDbStats = { donors: 0, orgs: 0, campaigns: 0 };
        if (statsRes && statsRes.ok) {
          realDbStats = await statsRes.json();
        }

        if (campsRes && campsRes.ok) {
          const data = await campsRes.json();
          const validList = Array.isArray(data) ? data.filter(c => c && (c.title || c.id)) : [];
          if (isMounted) {
            setCampaigns(validList);
            try {
              localStorage.setItem('bbdrts_cached_campaigns_v2', JSON.stringify(validList));
            } catch (_) {}

            const ethSum = (realDbStats && realDbStats.totalEth !== undefined && realDbStats.totalEth > 0)
              ? parseFloat(realDbStats.totalEth)
              : validList.reduce((sum, c) => sum + parseFloat(c.currentAmount || 0), 0);
            const phpEst = (realDbStats && realDbStats.totalPhp !== undefined && realDbStats.totalPhp > 0)
              ? Math.round(realDbStats.totalPhp)
              : Math.round(ethSum * 170000);

            const nextStats = {
              donors: realDbStats.donors || 0,
              orgs: realDbStats.orgs || 0,
              campaigns: validList.length || realDbStats.campaigns || 0,
              totalEthRaised: ethSum > 0 ? ethSum.toFixed(4) : '0.0000',
              totalPhp: phpEst > 0 ? phpEst : 0,
              totalPhpEstimated: phpEst > 0 ? phpEst.toLocaleString() : '0'
            };
            setStats(nextStats);
            try {
              localStorage.setItem('bbdrts_cached_stats_v1', JSON.stringify(nextStats));
            } catch (_) {}
          }
        }
      } catch (err) {
        console.error('Failed to fetch public campaigns for landing page:', err);
      } finally {
        if (isMounted) setLoadingCampaigns(false);
      }
    };

    const pollLiveStats = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const res = await fetch(`${API_URL}/api/public-stats?_t=${Date.now()}`);
        if (!res.ok || !isMounted) return;
        const d = await res.json();
        const nextPhp = d && d.totalPhp !== undefined ? Math.round(Number(d.totalPhp) || 0) : 0;
        const nextEth = d && d.totalEth !== undefined ? Number(d.totalEth) || 0 : 0;
        setStats((prev) => {
          const updated = {
            donors: d.donors ?? prev.donors,
            orgs: d.orgs ?? prev.orgs,
            campaigns: d.campaigns ?? prev.campaigns,
            totalEthRaised: nextEth > 0 ? nextEth.toFixed(4) : prev.totalEthRaised,
            totalPhp: nextPhp > 0 ? nextPhp : prev.totalPhp,
            totalPhpEstimated: (nextPhp > 0 ? nextPhp : prev.totalPhp).toLocaleString()
          };
          try {
            localStorage.setItem('bbdrts_cached_stats_v1', JSON.stringify(updated));
          } catch (_) {}
          return updated;
        });
      } catch (_) {}
    };

    fetchLandingData();
    const liveTimer = window.setInterval(pollLiveStats, 10000);
    const onFocusOrVisible = () => {
      if (document.visibilityState !== 'hidden') pollLiveStats();
    };
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);
    return () => {
      isMounted = false;
      window.clearInterval(liveTimer);
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
  }, []);

  // Global Navigation Listener for Landing View
  useEffect(() => {
    const handleRadarNav = () => {
      setTimeout(() => {
        const el = document.getElementById('radar-heatmap');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    };
    const handleCampaignsNav = () => {
      setTimeout(() => {
        const el = document.getElementById('campaigns');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    };

    const handleCategoryNav = (e) => {
      const cat = e.detail?.category || 'ALL';
      setActiveCategory(cat);
      setSearchQuery('');
      setCurrentPage(1);
      setTimeout(() => {
        const el = document.getElementById('campaigns');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    };

    window.addEventListener('bbdrts_navigate_radar', handleRadarNav);
    window.addEventListener('bbdrts_navigate_campaigns', handleCampaignsNav);
    window.addEventListener('bbdrts_filter_category', handleCategoryNav);
    return () => {
      window.removeEventListener('bbdrts_navigate_radar', handleRadarNav);
      window.removeEventListener('bbdrts_navigate_campaigns', handleCampaignsNav);
      window.removeEventListener('bbdrts_filter_category', handleCategoryNav);
    };
  }, []);

  // Dynamic Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const CAMPAIGNS_PER_PAGE = 4;

  // Filtered and Sorted campaigns based on category, search query, and sort criteria
  const processedCampaigns = useMemo(() => {
    let list = campaigns.filter(c => {
      const matchCategory = activeCategory === 'ALL' ||
        (activeCategory === 'DR' && (c.category === 'DR' || !c.category || c.category === 'TYPHOON' || c.category === 'FLOOD')) ||
        (activeCategory === 'CD' && (c.category === 'CD' || c.category === 'COMMUNITY' || c.category === 'EDUCATION' || c.category === 'LIVELIHOOD')) ||
        (activeCategory === 'TYPHOON' && (c.title?.toLowerCase().includes('typhoon') || c.category === 'TYPHOON')) ||
        (activeCategory === 'FLOOD' && (c.title?.toLowerCase().includes('flood') || c.category === 'FLOOD')) ||
        (activeCategory === 'MEDICAL' && (c.title?.toLowerCase().includes('medical') || c.category === 'MEDICAL')) ||
        (activeCategory === 'FOOD' && (c.title?.toLowerCase().includes('food') || c.category === 'FOOD_WATER')) ||
        (activeCategory === 'SHELTER' && (c.title?.toLowerCase().includes('shelter') || c.category === 'SHELTER' || c.category === 'LIVELIHOOD'));

      const query = searchQuery.trim().toLowerCase();
      const matchQuery = !query ||
        c.title?.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query) ||
        c.locationRegion?.toLowerCase().includes(query) ||
        c.orgName?.toLowerCase().includes(query);

      return matchCategory && matchQuery;
    });

    if (sortBy === 'urgency') {
      list.sort((a, b) => {
        const diffA = (parseFloat(a.targetAmount || 0) - parseFloat(a.currentAmount || 0));
        const diffB = (parseFloat(b.targetAmount || 0) - parseFloat(b.currentAmount || 0));
        return diffB - diffA;
      });
    } else if (sortBy === 'target') {
      list.sort((a, b) => parseFloat(b.targetAmount || 0) - parseFloat(a.targetAmount || 0));
    } else if (sortBy === 'raised') {
      list.sort((a, b) => parseFloat(b.currentAmount || 0) - parseFloat(a.currentAmount || 0));
    } else if (sortBy === 'newest') {
      list.sort((a, b) => (b.id || 0) - (a.id || 0));
    }

    return list;
  }, [campaigns, activeCategory, searchQuery, sortBy]);

  // Reset to page 1 whenever user changes filter or search query
  const isInitialFilterMount = useRef(true);
  useEffect(() => {
    if (isInitialFilterMount.current) {
      isInitialFilterMount.current = false;
      return;
    }
    if (!targetCampaignId || targetScrolledRef.current) {
      setCurrentPage(1);
    }
  }, [activeCategory, searchQuery, targetCampaignId, sortBy, viewMode]);

  const totalPages = Math.ceil(((processedCampaigns || []).length) / CAMPAIGNS_PER_PAGE) || 1;

  const paginatedCampaigns = useMemo(() => {
    const start = (currentPage - 1) * CAMPAIGNS_PER_PAGE;
    return (processedCampaigns || []).slice(start, start + CAMPAIGNS_PER_PAGE);
  }, [processedCampaigns, currentPage, CAMPAIGNS_PER_PAGE]);

  // ── 1. Bottom Scroll Progress Line (1-2px fixed at bottom) ──
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScrollProgress = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        const progress = Math.min(100, Math.max(0, (window.scrollY / scrollHeight) * 100));
        setScrollProgress(progress);
      } else {
        setScrollProgress(0);
      }
    };

    window.addEventListener('scroll', handleScrollProgress, { passive: true });
    window.addEventListener('resize', handleScrollProgress, { passive: true });
    handleScrollProgress();

    return () => {
      window.removeEventListener('scroll', handleScrollProgress);
      window.removeEventListener('resize', handleScrollProgress);
    };
  }, []);

  // ── 2. Smooth Scroll Entrance Animations (Once per visit, never replay when scrolling up) ──
  useEffect(() => {
    const sections = document.querySelectorAll('.bbdrts-scroll-section');
    if (!sections.length) return;

    if (!('IntersectionObserver' in window)) {
      sections.forEach(s => s.classList.add('is-revealed'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          // Only animate once per page visit; unobserve so scrolling back up never replays
          observer.unobserve(entry.target);
        }
      });
    }, {
      root: null,
      rootMargin: '0px 0px -50px 0px',
      threshold: 0.08
    });

    sections.forEach(section => observer.observe(section));

    return () => {
      observer.disconnect();
    };
  }, []);

  // Deep Link Auto-Navigation
  useEffect(() => {
    if (!targetCampaignId || !(campaigns && campaigns.length > 0) || targetScrolledRef.current) return;

    const idx = campaigns.findIndex(c => String(c.id) === String(targetCampaignId));
    if (idx !== -1) {
      targetScrolledRef.current = true;
      setActiveCategory('ALL');
      setSearchQuery('');

      const targetPage = Math.floor(idx / CAMPAIGNS_PER_PAGE) + 1;
      setCurrentPage(targetPage);

      let attempts = 0;
      const scrollTimer = setInterval(() => {
        attempts++;
        const el = document.getElementById(`campaign-${targetCampaignId}`);
        if (el) {
          clearInterval(scrollTimer);
          const rect = el.getBoundingClientRect();
          const targetY = window.pageYOffset + rect.top - 85;
          window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
        } else if (attempts >= 30) {
          clearInterval(scrollTimer);
        }
      }, 80);

      return () => clearInterval(scrollTimer);
    }
  }, [targetCampaignId, campaigns, CAMPAIGNS_PER_PAGE]);

  return (
    <div className="bbdrts-landing-root" id="top" data-theme={theme || (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : undefined)}>

      {/* ── Fixed Bottom Scroll Progress Line (1-2px, High-Contrast Theme Line) ── */}
      <div className="bbdrts-scroll-progress-track" aria-hidden="true">
        <div
          className="bbdrts-scroll-progress-fill"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* ── 1. Hero Command Deck (Two-Column Vercel Layout) ── */}
      <section className="bbdrts-hero-section bbdrts-scroll-section">
        <div className="bbdrts-ambient-spotlight" aria-hidden="true" />
        <div className="bbdrts-hero-grid-bg" aria-hidden="true" />

        <div className="container">
          <div className="bbdrts-hero-split-grid">

            {/* ── LEFT COLUMN: Headline, Narrative, CTAs & Statistics ── */}
            <div className="bbdrts-hero-left">
              {/* Protocol Status Ribbon (Strict Vercel Monochrome) */}
              <div className="bbdrts-hero-badge">
                <span className="bbdrts-pulse-beacon" />
                <span className="bbdrts-badge-title">Public Ledger</span>
                <span className="bbdrts-badge-divider" aria-hidden="true">/</span>
                <span>Track Every Donation Live</span>
              </div>

              {/* Monumental Headline */}
              <h1 className="bbdrts-hero-title">
                Relief &amp; charity donations <br className="bbdrts-br-desktop" />
                <span className="bbdrts-title-gradient">you can actually trace.</span>
              </h1>

              {/* Lead Narrative */}
              <p className="bbdrts-hero-lead">
                Support relief and charity campaigns across 82 Philippine provinces via GCash, Maya, bank transfer, or card. Every verified peso is logged gaslessly on Ethereum Sepolia, and payouts require itemized receipts and delivery photos.
              </p>

              {/* Primary Action Buttons */}
              <div className="bbdrts-hero-actions">
                <a href="#campaigns" className="bbdrts-btn-primary">
                  <span>Browse Campaigns</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_downward</span>
                </a>
                <a href="#radar-heatmap" className="bbdrts-btn-secondary">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>map</span>
                  <span>Live Operations Map</span>
                </a>
                <button
                  type="button"
                  className="bbdrts-btn-ghost"
                  onClick={() => (onSignIn ? onSignIn('donor') : (onConnect && onConnect('donor', 'login')))}
                >
                  <span>Open Portal</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>north_east</span>
                </button>
              </div>

              {/* ── Clean Vercel Hairline Stat Strip (Strict Monochrome) ── */}
              <div className="bbdrts-hero-stats-strip">
                <div className="bbdrts-hero-stat-item">
                  <div className="bbdrts-hero-stat-val">82</div>
                  <div className="bbdrts-hero-stat-lbl">Provinces Covered</div>
                </div>
                <div className="bbdrts-hero-stat-sep" />
                <div className="bbdrts-hero-stat-item">
                  <div className={`bbdrts-hero-stat-val ${animatedPhp.isBumping ? 'is-live-bump' : ''}`}>
                    ₱{animatedPhp.value.toLocaleString()}
                  </div>
                  <div className="bbdrts-hero-stat-lbl">Total Raised</div>
                </div>
                <div className="bbdrts-hero-stat-sep" />
                <div className="bbdrts-hero-stat-item">
                  <div className={`bbdrts-hero-stat-val ${animatedDonors.isBumping ? 'is-live-bump' : ''}`}>
                    {animatedDonors.value.toLocaleString()}
                  </div>
                  <div className="bbdrts-hero-stat-lbl">Total Donors</div>
                </div>
                <div className="bbdrts-hero-stat-sep" />
                <div
                  className="bbdrts-hero-stat-item clickable"
                  onClick={() => onOpenNgoProfile && onOpenNgoProfile(3)}
                  title="Click to view verified NGO profile"
                >
                  <div className={`bbdrts-hero-stat-val ${animatedOrgs.isBumping ? 'is-live-bump' : ''}`}>
                    <span>{animatedOrgs.value} Verified</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>open_in_new</span>
                  </div>
                  <div className="bbdrts-hero-stat-lbl">Accredited NGOs</div>
                </div>
                <div className="bbdrts-hero-stat-sep" />
                <div className="bbdrts-hero-stat-item">
                  <div className="bbdrts-hero-stat-val">0%</div>
                  <div className="bbdrts-hero-stat-lbl">Platform Fee</div>
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN: Interactive 3D Vercel UI Blockchain Donation Process Visualizer ── */}
            <div className="bbdrts-hero-right">
              <div
                ref={tiltStageRef}
                className="bdr-tilt-stage"
                onMouseMove={handleVisualizerMouseMove}
                onMouseLeave={handleVisualizerMouseLeave}
              >
                <div className="bdr-process-visualizer" ref={visualizerRef}>
                  {/* Bounded Architectural Dot-Matrix Backdrop (Strict Vercel Geist Monochrome) */}
                  <div className="bdr-process-backdrop" aria-hidden="true" />
                  {/* Subtle Interactive Monochrome Cursor Sheen */}
                  <div className="bdr-tilt-glare" aria-hidden="true" />

                  {/* SVG Architectural Connecting Pipeline Bus (Height 126 + 28 + 86 + 28 + 112 = 380) */}
                  <svg className="bdr-flow-svg" viewBox="0 0 480 380" fill="none" aria-hidden="true">
                    {/* 1. Left Inflow Rail: Top Campaign (0,63) -> Donate (0,197) */}
                    <path
                      d="M 0 63 H -10 A 10 10 0 0 0 -20 73 V 187 A 10 10 0 0 0 -10 197 H 0"
                      className={activeFlowStep === 'donate' ? 'bdr-wire-active' : 'bdr-wire-inflow'}
                    />
                    <path
                      d="M 0 63 H -10 A 10 10 0 0 0 -20 73 V 187 A 10 10 0 0 0 -10 197 H 0"
                      className="bdr-wire-active bdr-wire-pulse"
                    />
                    <circle cx="0" cy="63" r="2.75" className="bdr-port-node active" />
                    <circle cx="0" cy="197" r="2.75" className="bdr-port-node active" />

                    {/* 2. On-Chain Recording Bus: Record on Blockchain (303,240) -> Blockchain Record (51,268) */}
                    <path
                      d="M 303 240 V 244 A 10 10 0 0 1 293 254 H 61 A 10 10 0 0 0 51 264 V 268"
                      className={activeFlowStep === 'record' ? 'bdr-wire-active' : 'bdr-wire-inflow'}
                    />
                    <path
                      d="M 303 240 V 244 A 10 10 0 0 1 293 254 H 61 A 10 10 0 0 0 51 264 V 268"
                      className="bdr-wire-active bdr-wire-pulse wire-delay-1"
                    />
                    <circle
                      cx="303"
                      cy="240"
                      r="2.75"
                      className={activeFlowStep === 'record' ? 'bdr-port-node active' : 'bdr-port-node'}
                    />
                    <circle
                      cx="51"
                      cy="268"
                      r="2.75"
                      className={activeFlowStep === 'record' ? 'bdr-port-node active' : 'bdr-port-node'}
                    />

                    {/* 3. Right Feedback Loop Rail: Track (480,197) -> Top Campaign (480,63) */}
                    <path
                      d="M 480 197 H 490 A 10 10 0 0 0 500 187 V 73 A 10 10 0 0 0 490 63 H 480"
                      className={activeFlowStep === 'track' ? 'bdr-wire-active' : 'bdr-wire-inflow'}
                    />
                    <path
                      d="M 480 197 H 490 A 10 10 0 0 0 500 187 V 73 A 10 10 0 0 0 490 63 H 480"
                      className="bdr-wire-active bdr-wire-pulse wire-delay-2"
                    />
                    <circle cx="480" cy="197" r="2.75" className={activeFlowStep === 'track' ? 'bdr-port-node active' : 'bdr-port-node'} />
                    <circle cx="480" cy="63" r="2.75" className={activeFlowStep === 'track' ? 'bdr-port-node active' : 'bdr-port-node'} />
                  </svg>

                  {/* 1. Top Card: Randomized Live Relief Campaign Showcase */}
                  <div
                    className="bdr-campaign-card"
                    onMouseEnter={() => {
                      heroHoveredRef.current = true;
                      clearAutoAdvanceTimer();
                      setIsHeroCardHovered(true);
                    }}
                    onMouseLeave={() => {
                      heroHoveredRef.current = false;
                      setIsHeroCardHovered(false);
                    }}
                  >
                    <button
                      type="button"
                      className="bdr-campaign-nav-btn prev"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        heroHoveredRef.current = true;
                        clearAutoAdvanceTimer();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.currentTarget.blur();
                        advanceHeroSlide('prev');
                      }}
                      aria-label="Previous campaign"
                      title="Previous campaign"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M10 3.5L5.5 8L10 12.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>

                    {/* Fixed Thumbnail Container with smooth cross-dissolve inside */}
                    <div className="bdr-campaign-thumb-wrap">
                      <img
                        key={`thumb-${heroSlider.seq}`}
                        src={activeMetrics.imageUrl}
                        onError={(e) => { e.currentTarget.src = '/hero_relief_command.jpg'; }}
                        alt={activeHeroCampaign?.title || 'Relief campaign'}
                        className={`bdr-campaign-thumb ${exitingHeroSlide && heroSlider.seq > 0 ? 'is-entering' : ''}`}
                      />
                      {exitingHeroSlide && exitingMetrics && (
                        <img
                          key={`thumb-exit-${exitingHeroSlide.seq}`}
                          src={exitingMetrics.imageUrl}
                          onError={(e) => { e.currentTarget.src = '/hero_relief_command.jpg'; }}
                          alt=""
                          aria-hidden="true"
                          className="bdr-campaign-thumb is-exiting"
                        />
                      )}
                    </div>

                    <div className="bdr-campaign-info">
                      {/* Soft-feathered text transition zone (masked ONLY while sliding so idle text stays razor sharp) */}
                      <div className={`bdr-campaign-text-stage ${exitingHeroSlide ? 'is-animating' : ''}`}>
                        <div
                          key={`text-${heroSlider.seq}`}
                          className={`bdr-campaign-text-pane ${exitingHeroSlide && heroSlider.seq > 0 ? `is-entering dir-${heroSlider.direction}` : ''}`}
                        >
                          <HeroCampaignTextPane
                            camp={activeHeroCampaign}
                            categoryLabel={activeMetrics.categoryLabel}
                            orgName={activeMetrics.orgName}
                          />
                        </div>
                        {exitingHeroSlide && exitingMetrics && (
                          <div
                            key={`text-exit-${exitingHeroSlide.seq}`}
                            className={`bdr-campaign-text-pane is-exiting dir-${exitingHeroSlide.direction}`}
                            aria-hidden="true"
                          >
                            <HeroCampaignTextPane
                              camp={exitingHeroSlide.camp}
                              categoryLabel={exitingMetrics.categoryLabel}
                              orgName={exitingMetrics.orgName}
                            />
                          </div>
                        )}
                      </div>

                      {/* Stationary Progress Track: ONLY the inner fill animates width up/down */}
                      <div className="bdr-campaign-progress-wrap">
                        <div className="bdr-campaign-progress-bar">
                          <div
                            className="bdr-campaign-progress-fill"
                            style={{ width: `${Math.min(100, Math.max(0, Number(activeMetrics.pct) || 0))}%` }}
                          />
                        </div>
                        <div className="bdr-campaign-metric-stage">
                          <div
                            key={`metric-${heroSlider.seq}`}
                            className={`bdr-campaign-metric-row ${exitingHeroSlide && heroSlider.seq > 0 ? 'is-entering' : ''}`}
                          >
                            <HeroMetricRow metrics={activeMetrics} />
                          </div>
                          {exitingHeroSlide && exitingMetrics && (
                            <div
                              key={`metric-exit-${exitingHeroSlide.seq}`}
                              className="bdr-campaign-metric-row is-exiting"
                              aria-hidden="true"
                            >
                              <HeroMetricRow metrics={exitingMetrics} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="bdr-campaign-nav-btn next"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        heroHoveredRef.current = true;
                        clearAutoAdvanceTimer();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.currentTarget.blur();
                        advanceHeroSlide('next');
                      }}
                      aria-label="Next campaign"
                      title="Next campaign"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>

                  {/* 2. Middle Row: 4-Stage Transaction Flow Steps */}
                  <div className="bdr-flow-steps-row">
                    {/* Step 1: Donate */}
                    <button
                      type="button"
                      className={`bdr-flow-step-btn ${activeFlowStep === 'donate' ? 'active' : ''}`}
                      onClick={() => setActiveFlowStep('donate')}
                      title="Step 1: Send donation"
                    >
                      <div className="bdr-step-icon-box">
                        <svg width="20" height="16" viewBox="0 0 22 18" fill="none">
                          <rect x="1.25" y="1.75" width="19.5" height="14.5" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
                          <line x1="1.5" y1="6.25" x2="20.5" y2="6.25" stroke="currentColor" strokeWidth="1.5" />
                          <rect x="4" y="10.25" width="4.5" height="2" rx="0.6" fill="currentColor" />
                        </svg>
                      </div>
                      <span className="bdr-step-label">Donate</span>
                    </button>

                    <div className={`bdr-step-arrow ${activeFlowStep === 'verify' ? 'lit' : ''}`} aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path d="M3.5 8H12.5M12.5 8L8.5 4M12.5 8L8.5 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>

                    {/* Step 2: Verify */}
                    <button
                      type="button"
                      className={`bdr-flow-step-btn ${activeFlowStep === 'verify' ? 'active' : ''}`}
                      onClick={() => setActiveFlowStep('verify')}
                      title="Step 2: Receipt & NGO check"
                    >
                      <div className="bdr-step-icon-box">
                        <svg width="18" height="20" viewBox="0 0 20 22" fill="none">
                          <path d="M10 1.75L2.75 5.25V10.75C2.75 15.25 5.85 19.25 10 20.75C14.15 19.25 17.25 15.25 17.25 10.75V5.25L10 1.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                          <path d="M6.75 11.25L9 13.5L13.5 8.75" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <span className="bdr-step-label">Verify</span>
                    </button>

                    <div className={`bdr-step-arrow ${activeFlowStep === 'record' ? 'lit' : ''}`} aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path d="M3.5 8H12.5M12.5 8L8.5 4M12.5 8L8.5 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>

                    {/* Step 3: Record on Blockchain (Primary Default Active) */}
                    <button
                      type="button"
                      className={`bdr-flow-step-btn ${activeFlowStep === 'record' ? 'active' : ''}`}
                      onClick={() => setActiveFlowStep('record')}
                      title="Step 3: Save permanent public record"
                    >
                      <div className="bdr-step-icon-box">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <polygon points="12,2.25 20.25,6.75 12,11.25 3.75,6.75" className="bdr-cube-face-top" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                          <polygon points="3.75,6.75 12,11.25 12,20.5 3.75,16" className="bdr-cube-face-left" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                          <polygon points="12,11.25 20.25,6.75 20.25,16 12,20.5" className="bdr-cube-face-right" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <span className="bdr-step-label">Record</span>
                    </button>

                    <div className={`bdr-step-arrow ${activeFlowStep === 'track' ? 'lit' : ''}`} aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path d="M3.5 8H12.5M12.5 8L8.5 4M12.5 8L8.5 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>

                    {/* Step 4: Track */}
                    <button
                      type="button"
                      className={`bdr-flow-step-btn ${activeFlowStep === 'track' ? 'active' : ''}`}
                      onClick={() => setActiveFlowStep('track')}
                      title="Step 4: Track aid delivery"
                    >
                      <div className="bdr-step-icon-box">
                        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                          <rect x="2.75" y="11" width="3.5" height="6.5" rx="0.8" fill="currentColor" opacity="0.65" />
                          <rect x="8.25" y="7" width="3.5" height="10.5" rx="0.8" fill="currentColor" opacity="0.85" />
                          <rect x="13.75" y="3" width="3.5" height="14.5" rx="0.8" fill="currentColor" />
                        </svg>
                      </div>
                      <span className="bdr-step-label">Track</span>
                    </button>
                  </div>

                  {/* 3. Bottom Card: Step Detail / Blockchain Record */}
                  <div className="bdr-record-card">
                    {/* Left: Crisp Vercel Monochrome Isometric Block Wireframe */}
                    <div className="bdr-record-cube-col">
                      <svg className="bdr-cube-svg" viewBox="0 0 66 66" fill="none">
                        {/* Orthogonal projection rays */}
                        <line x1="9" y1="45" x2="33" y2="33" className="bdr-cube-ray" strokeWidth="1.1" strokeDasharray="2 2" />
                        <line x1="57" y1="45" x2="33" y2="33" className="bdr-cube-ray" strokeWidth="1.1" strokeDasharray="2 2" />
                        <line x1="33" y1="53" x2="33" y2="60" className="bdr-cube-ray" strokeWidth="1.1" strokeDasharray="2 2" />
                        <circle cx="9" cy="45" r="1.8" className="bdr-cube-dot" />
                        <circle cx="57" cy="45" r="1.8" className="bdr-cube-dot" />
                        <circle cx="33" cy="60" r="1.8" className="bdr-cube-dot" />

                        {/* Pure Monochrome Isometric Wireframe Cube */}
                        <polygon points="33,12 52,22.5 33,33 14,22.5" className="bdr-cube-face-top" strokeWidth="1.35" strokeLinejoin="round" />
                        <polygon points="14,22.5 33,33 33,53 14,42.5" className="bdr-cube-face-left" strokeWidth="1.35" strokeLinejoin="round" />
                        <polygon points="33,33 52,22.5 52,42.5 33,53" className="bdr-cube-face-right" strokeWidth="1.35" strokeLinejoin="round" />
                        <circle cx="33" cy="33" r="2.2" className="bdr-cube-center-node" />
                      </svg>
                    </div>

                    {/* Right Structured Readout */}
                    <div className="bdr-record-content">
                      <div className="bdr-record-header-row">
                        <div className="bdr-record-title-wrap">
                          {activeFlowStep === 'donate' && (
                            <svg width="15" height="12" viewBox="0 0 22 18" fill="none" style={{ flexShrink: 0 }}>
                              <rect x="1.25" y="1.75" width="19.5" height="14.5" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
                              <line x1="1.5" y1="6.25" x2="20.5" y2="6.25" stroke="currentColor" strokeWidth="1.6" />
                            </svg>
                          )}
                          {activeFlowStep === 'verify' && (
                            <svg width="14" height="15" viewBox="0 0 20 22" fill="none" style={{ flexShrink: 0 }}>
                              <path d="M10 1.75L2.75 5.25V10.75C2.75 15.25 5.85 19.25 10 20.75C14.15 19.25 17.25 15.25 17.25 10.75V5.25L10 1.75Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                              <path d="M6.75 11.25L9 13.5L13.5 8.75" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                          {activeFlowStep === 'record' && (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                              <polygon points="12,2.25 20.25,6.75 12,11.25 3.75,6.75" className="bdr-cube-face-top" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                              <polygon points="3.75,6.75 12,11.25 12,20.5 3.75,16" className="bdr-cube-face-left" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                              <polygon points="12,11.25 20.25,6.75 20.25,16 12,20.5" className="bdr-cube-face-right" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                            </svg>
                          )}
                          {activeFlowStep === 'track' && (
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
                              <rect x="2.75" y="11" width="3.5" height="6.5" rx="0.8" fill="currentColor" opacity="0.65" />
                              <rect x="8.25" y="7" width="3.5" height="10.5" rx="0.8" fill="currentColor" opacity="0.85" />
                              <rect x="13.75" y="3" width="3.5" height="14.5" rx="0.8" fill="currentColor" />
                            </svg>
                          )}
                          <span className="bdr-record-title">{stepDetails.title || 'Blockchain Record'}</span>
                          <span className="bdr-record-stage-tag">{stepDetails.stage}</span>
                        </div>
                        <span className="bdr-record-verified-pill">
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
                            <path d="M5 8.2L7 10.2L11.2 5.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span>{stepDetails.status || 'Verified'}</span>
                        </span>
                      </div>

                      <div className="bdr-record-meta-grid">
                        <div className="bdr-record-field">
                          <span className="bdr-field-label">{stepDetails.field1Label || 'Transaction Hash'}</span>
                          {stepDetails.isLedgerLink ? (
                            <a
                              href="https://sepolia.etherscan.io"
                              target="_blank"
                              rel="noreferrer"
                              className="bdr-field-val link"
                              title="View public record on Etherscan"
                            >
                              <span>{stepDetails.field1Value}</span>
                              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <path d="M5.5 3.5H12.5V10.5M12.25 3.75L4 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </a>
                          ) : (
                            <span className="bdr-field-val">{stepDetails.field1Value}</span>
                          )}
                        </div>

                        <div className="bdr-record-field">
                          <span className="bdr-field-label">{stepDetails.field2Label || 'Network Ledger'}</span>
                          <span className="bdr-field-val">{stepDetails.field2Value}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── 2. Step-by-Step Proof vs. Regular Donations ── */}
      <section className="bbdrts-purpose-section bbdrts-scroll-section" id="purpose">
        <div className="container">
          <div className="bbdrts-section-header-centered">
            <div className="bbdrts-section-eyebrow">WHY IT MATTERS</div>
            <h2 className="bbdrts-section-title">Verified Proof vs. Regular Donations</h2>
            <p className="bbdrts-section-desc">
              Whether helping disaster victims or local charities across the Philippines, regular donations often leave donors guessing. BBDRTS checks NGOs, donation receipts, and spending proof in one open system.
            </p>
          </div>

          <div className="bbdrts-comparison-grid">
            {/* The Common Problems in Traditional Charity */}
            <div className="bbdrts-comparison-card flawed">
              <div className="bbdrts-comparison-header">
                <div className="bbdrts-comparison-tag danger">
                  <span className="material-symbols-outlined">cancel</span>
                  <span>Regular Donations</span>
                </div>
                <h3 className="bbdrts-comparison-title">Hidden accounts with no proof of delivery</h3>
              </div>

              <ul className="bbdrts-comparison-list">
                <li>
                  <span className="material-symbols-outlined icon-danger">close</span>
                  <div>
                    <strong>Private Bank Accounts:</strong> Donors send money into private accounts with no way to see how it is budgeted or spent.
                  </div>
                </li>
                <li>
                  <span className="material-symbols-outlined icon-danger">close</span>
                  <div>
                    <strong>No Clear Spending Trail:</strong> Without public updates or matching totals, donors have no way to verify what funds actually bought.
                  </div>
                </li>
                <li>
                  <span className="material-symbols-outlined icon-danger">close</span>
                  <div>
                    <strong>No Store Receipts Shown:</strong> Official store receipts and bills are rarely shared with the people who gave.
                  </div>
                </li>
                <li>
                  <span className="material-symbols-outlined icon-danger">close</span>
                  <div>
                    <strong>Slow Paperwork:</strong> Manual paper reports slow down help from reaching families and communities in need.
                  </div>
                </li>
              </ul>
            </div>

            {/* How BBDRTS Solves It */}
            <div className="bbdrts-comparison-card standard">
              <div className="bbdrts-comparison-header">
                <div className="bbdrts-comparison-tag success">
                  <span className="material-symbols-outlined">verified_user</span>
                  <span>With BBDRTS</span>
                </div>
                <h3 className="bbdrts-comparison-title">Every peso backed by receipts &amp; field photos</h3>
              </div>

              <ul className="bbdrts-comparison-list">
                <li>
                  <span className="material-symbols-outlined icon-success">check_circle</span>
                  <div>
                    <strong>Checked NGOs &amp; Direct Aid:</strong> Verified organizations run approved drives with 0% platform fees and public spending limits tied to funds raised.
                  </div>
                </li>
                <li>
                  <span className="material-symbols-outlined icon-success">check_circle</span>
                  <div>
                    <strong>Everyday Filipino Payment Rails:</strong> Donate using GCash, Maya, cards, or Philippine bank transfer—automatically logged on-chain with zero crypto wallet required.
                  </div>
                </li>
                <li>
                  <span className="material-symbols-outlined icon-success">check_circle</span>
                  <div>
                    <strong>AI Receipt Checks:</strong> Uploaded payment slips are scanned right away for reference numbers, amounts, dates, and duplicates before approval.
                  </div>
                </li>
                <li>
                  <span className="material-symbols-outlined icon-success">check_circle</span>
                  <div>
                    <strong>Public Spending Proof:</strong> NGOs upload store receipts, handover photos, and barangay certificates for every expense and notify donors.
                  </div>
                </li>
              </ul>
            </div>
          </div>

        </div>
      </section>

      {/* ── 3. Live Map (Live Operations Map & Radar) ── */}
      <section className="bbdrts-radar-section" id="radar-heatmap">
        <div className="container">
          <div className="bbdrts-command-deck-header bbdrts-scroll-section">
            <div>
              <div className="bbdrts-section-eyebrow">LIVE MAP</div>
              <h2 className="bbdrts-section-title">Philippine Disaster &amp; Aid Map</h2>
              <p className="bbdrts-section-desc">
                See active disasters and ongoing charity campaigns across all 82 Philippine provinces.
              </p>
            </div>

            <div className="bbdrts-radar-legend-chips">
              <span className="bbdrts-legend-chip l1">L1 Advisory</span>
              <span className="bbdrts-legend-chip l2">L2 Low Alert</span>
              <span className="bbdrts-legend-chip l3">L3 Moderate</span>
              <span className="bbdrts-legend-chip l4">L4 Severe</span>
              <span className="bbdrts-legend-chip l5">L5 Critical</span>
            </div>
          </div>

          <div className="bbdrts-radar-frame">
            <DisasterRadarHeatmap
              campaigns={campaigns}
              theme={theme}
              defaultLayer="terrain"
              onSelectCampaign={(c) => {
                setActiveCategory('ALL');
                setSearchQuery(c.title || '');
                setCurrentPage(1);
                setTimeout(() => {
                  const el = document.getElementById(`campaign-${c.id}`) || document.getElementById('campaigns');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 80);
              }}
            />
          </div>

          {/* Map Footer Helper */}
          <div className="bbdrts-radar-footer-bar">
            <div className="bbdrts-radar-footer-info">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>my_location</span>
              <span><strong>Interactive Map:</strong> Click any highlighted province to see active campaigns, alert levels, and verified updates.</span>
            </div>
            <a href="#campaigns" className="bbdrts-link-action">
              <span>Browse All Campaigns</span>
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>east</span>
            </a>
          </div>

        </div>
      </section>

      {/* ── 4. Active Campaigns Explorer ── */}
      <section className="bbdrts-campaigns-section bbdrts-scroll-section" id="campaigns">
        <div className="container">

          <div className="bbdrts-section-header">
            <div>
              <div className="bbdrts-section-eyebrow">ONGOING CAMPAIGNS</div>
              <h2 className="bbdrts-section-title">Verified Campaigns to Support</h2>
              <p className="bbdrts-section-desc">
                Support disaster response and local charity drives backed by real receipts and public delivery photos.
              </p>
            </div>

            {/* Layout View Toggle */}
            <div className="bbdrts-view-toggle-bar">
              <button
                type="button"
                className={`bbdrts-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid View (2-Column)"
                aria-label="Grid View"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>grid_view</span>
                <span>Grid</span>
              </button>
              <button
                type="button"
                className={`bbdrts-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List View (1-Column)"
                aria-label="List View"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>view_agenda</span>
                <span>List</span>
              </button>
            </div>
          </div>

          {/* Filter & Search Toolbar */}
          <div className="bbdrts-filter-toolbar">
            <div className="bbdrts-filter-group" role="tablist" aria-label="Relief Cause Filters">
              <button
                type="button"
                className={`bbdrts-filter-btn ${activeCategory === 'ALL' ? 'active' : ''}`}
                onClick={() => setActiveCategory('ALL')}
              >
                All Causes ({(campaigns || []).length})
              </button>
              <button
                type="button"
                className={`bbdrts-filter-btn ${activeCategory === 'TYPHOON' ? 'active' : ''}`}
                onClick={() => setActiveCategory('TYPHOON')}
              >
                Typhoon
              </button>
              <button
                type="button"
                className={`bbdrts-filter-btn ${activeCategory === 'FLOOD' ? 'active' : ''}`}
                onClick={() => setActiveCategory('FLOOD')}
              >
                Flood
              </button>
              <button
                type="button"
                className={`bbdrts-filter-btn ${activeCategory === 'FOOD' ? 'active' : ''}`}
                onClick={() => setActiveCategory('FOOD')}
              >
                Food &amp; Water
              </button>
              <button
                type="button"
                className={`bbdrts-filter-btn ${activeCategory === 'MEDICAL' ? 'active' : ''}`}
                onClick={() => setActiveCategory('MEDICAL')}
              >
                Medical
              </button>
              <button
                type="button"
                className={`bbdrts-filter-btn ${activeCategory === 'SHELTER' ? 'active' : ''}`}
                onClick={() => setActiveCategory('SHELTER')}
              >
                Shelter
              </button>
              <button
                type="button"
                className={`bbdrts-filter-btn ${activeCategory === 'CD' ? 'active' : ''}`}
                onClick={() => setActiveCategory('CD')}
              >
                Community
              </button>
            </div>

            <div className="bbdrts-toolbar-right">
              {/* Sort selector */}
              <div className="bbdrts-sort-wrap">
                <span className="bbdrts-sort-label">Sort:</span>
                <select
                  className="bbdrts-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  aria-label="Sort campaigns"
                >
                  <option value="urgency">Most Urgent Need</option>
                  <option value="target">Highest Target Goal</option>
                  <option value="raised">Most Funds Raised</option>
                  <option value="newest">Recently Launched</option>
                </select>
              </div>

              {/* Search Field */}
              <div className="bbdrts-search-input-wrap">
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>search</span>
                <input
                  type="text"
                  placeholder="Search causes, regions, or NGOs..."
                  className="bbdrts-search-field"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search relief causes"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    aria-label="Clear search"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>close</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Campaign Cards Rendering */}
          {loadingCampaigns ? (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <div className="spinner-modern" style={{ margin: '0 auto 16px', width: '32px', height: '32px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading verified campaigns...</p>
            </div>
          ) : processedCampaigns.length === 0 ? (
            <div className="bbdrts-empty-state">
              <span className="material-symbols-outlined" style={{ fontSize: '38px', color: 'var(--text-muted)', marginBottom: '12px' }}>search_off</span>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '6px', fontSize: '1.1rem', fontWeight: 600 }}>No matching campaigns found</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0, maxWidth: '420px' }}>Try switching categories, clearing your search keywords, or selecting another filter.</p>
              <button
                type="button"
                className="bbdrts-btn-secondary"
                onClick={() => { setActiveCategory('ALL'); setSearchQuery(''); setSortBy('urgency'); }}
                style={{ marginTop: '18px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>filter_alt_off</span>
                <span>Reset Filters</span>
              </button>
            </div>
          ) : (
            <>
              {/* Campaign Container with Grid vs List support */}
              <div className={viewMode === 'grid' ? 'campaigns-grid cols-2' : 'campaigns-list'}>
                {paginatedCampaigns.map(campaign => (
                  <div
                    key={campaign.id}
                    id={`campaign-${campaign.id}`}
                    className={`bbdrts-campaign-item-wrapper ${String(campaign.id) === String(targetCampaignId) ? 'target-campaign-highlight' : ''}`}
                    style={{ scrollMarginTop: '90px' }}
                  >
                    <CampaignCard
                      id={`campaign-${campaign.id}`}
                      camp={campaign}
                      onDonate={() => onConnect && onConnect('donor', 'login')}
                      userRole="PUBLIC"
                      walletAddress=""
                      contract={contract}
                      onOpenNgoProfile={onOpenNgoProfile}
                    />
                  </div>
                ))}
              </div>

              {/* Modern Pagination Bar */}
              {totalPages > 1 && (
                <div className="bbdrts-pagination-row">
                  <div className="bbdrts-pagination-info">
                    Showing <strong>{((currentPage - 1) * CAMPAIGNS_PER_PAGE) + 1}–{Math.min(currentPage * CAMPAIGNS_PER_PAGE, processedCampaigns.length)}</strong> of <strong>{processedCampaigns.length}</strong> active causes
                  </div>

                  <div className="bbdrts-pagination-controls">
                    <button
                      type="button"
                      className="bbdrts-page-btn"
                      onClick={() => {
                        setCurrentPage(prev => Math.max(1, prev - 1));
                        document.getElementById('campaigns')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      disabled={currentPage === 1}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>chevron_left</span>
                      <span>Prev</span>
                    </button>

                    {getPaginationItems(currentPage, totalPages, 7).map((item, idx) => {
                      if (item === '...') {
                        return (
                          <span
                            key={`ellipsis-landing-${idx}`}
                            style={{
                              minWidth: '32px',
                              height: '32px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--text-muted, #888888)',
                              fontSize: '0.85rem',
                              userSelect: 'none'
                            }}
                          >
                            …
                          </span>
                        );
                      }
                      const pageNum = Number(item);
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          className={`bbdrts-page-num ${currentPage === pageNum ? 'active' : ''}`}
                          onClick={() => {
                            setCurrentPage(pageNum);
                            document.getElementById('campaigns')?.scrollIntoView({ behavior: 'smooth' });
                          }}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      className="bbdrts-page-btn"
                      onClick={() => {
                        setCurrentPage(prev => Math.min(totalPages, prev + 1));
                        document.getElementById('campaigns')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      disabled={currentPage === totalPages}
                    >
                      <span>Next</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>chevron_right</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </section>

      {/* ── 5. How It Works (4 Simple Steps) ── */}
      <section className="bbdrts-lifecycle-section bbdrts-scroll-section" id="how-it-works">
        <div className="container">

          <div className="bbdrts-lifecycle-header">
            <div className="bbdrts-section-eyebrow">HOW IT WORKS</div>
            <h2 className="bbdrts-section-title">How Every Donation Goes from Giving to Proof</h2>
            <p className="bbdrts-section-desc">
              From the moment you give until help reaches people, every step is checked and saved publicly.
            </p>
          </div>

          <div className="bbdrts-lifecycle-grid">
            <div className="bbdrts-lifecycle-card">
              <div className="bbdrts-step-header">
                <span className="bbdrts-step-num">STEP 01</span>
                <span className="material-symbols-outlined bbdrts-step-icon">domain_verification</span>
              </div>
              <h3 className="bbdrts-step-title">NGOs Get Checked First</h3>
              <p className="bbdrts-step-desc">
                Only real groups with SEC or DSWD papers are allowed to start a relief or charity drive with clear goals.
              </p>
            </div>

            <div className="bbdrts-lifecycle-card">
              <div className="bbdrts-step-header">
                <span className="bbdrts-step-num">STEP 02</span>
                <span className="material-symbols-outlined bbdrts-step-icon">currency_exchange</span>
              </div>
              <h3 className="bbdrts-step-title">Pick How to Pay</h3>
              <p className="bbdrts-step-desc">
                Donate easily in Philippine Pesos using GCash (QR Ph), Maya, Credit/Debit Cards, or Bank Transfer with 0% platform fees.
              </p>
            </div>

            <div className="bbdrts-lifecycle-card">
              <div className="bbdrts-step-header">
                <span className="bbdrts-step-num">STEP 03</span>
                <span className="material-symbols-outlined bbdrts-step-icon">document_scanner</span>
              </div>
              <h3 className="bbdrts-step-title">Receipts Checked &amp; Logged</h3>
              <p className="bbdrts-step-desc">
                Uploaded payment slips are checked by AI for duplicates and details, then donations are saved to the public record.
              </p>
            </div>

            <div className="bbdrts-lifecycle-card">
              <div className="bbdrts-step-header">
                <span className="bbdrts-step-num">STEP 04</span>
                <span className="material-symbols-outlined bbdrts-step-icon">verified</span>
              </div>
              <h3 className="bbdrts-step-title">Spending Proof Posted</h3>
              <p className="bbdrts-step-desc">
                As NGOs buy supplies, they post store receipts, delivery photos, and updates for donors—capped at total funds raised.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ── 6. Payment Methods & Gasless Blockchain Audit ── */}
      <section className="bbdrts-rails-section bbdrts-scroll-section" id="payment-rails">
        <div className="container">
          <div className="bbdrts-section-header-centered">
            <div className="bbdrts-section-eyebrow">PAYMENT METHODS &amp; ON-CHAIN AUDIT</div>
            <h2 className="bbdrts-section-title">Pay Using Everyday Filipino Apps</h2>
            <p className="bbdrts-section-desc">
              Donate in Philippine Pesos using the apps and banks Filipinos use every day—while our gasless relayer anchors every verified record on Ethereum Sepolia.
            </p>
          </div>

          <div className="bbdrts-rails-grid">
            {/* GCash */}
            <div className="bbdrts-rail-card gcash">
              <div className="bbdrts-rail-top">
                <div className="bbdrts-rail-icon-box gcash">
                  <span className="material-symbols-outlined">qr_code_2</span>
                </div>
                <div className="bbdrts-rail-identity">
                  <div className="bbdrts-rail-name-row">
                    <span className="bbdrts-rail-name">GCash</span>
                    <span className="bbdrts-rail-tag gcash">QR Ph</span>
                  </div>
                  <span className="bbdrts-rail-network">Mobile E-Wallet</span>
                </div>
              </div>
              <h4 className="bbdrts-rail-title">Scan to Donate via QR Ph</h4>
              <p className="bbdrts-rail-desc">
                Send from your GCash app using QR Ph and upload your slip for AI reference checks with 0% fees taken out.
              </p>
              <div className="bbdrts-rail-features">
                <div className="bbdrts-rail-feature-item">
                  <span className="material-symbols-outlined check-icon">check_circle</span>
                  <span>0% fees taken out</span>
                </div>
                <div className="bbdrts-rail-feature-item">
                  <span className="material-symbols-outlined check-icon">check_circle</span>
                  <span>AI receipt &amp; duplicate check</span>
                </div>
              </div>
            </div>

            {/* Maya */}
            <div className="bbdrts-rail-card maya">
              <div className="bbdrts-rail-top">
                <div className="bbdrts-rail-icon-box maya">
                  <span className="material-symbols-outlined">account_balance_wallet</span>
                </div>
                <div className="bbdrts-rail-identity">
                  <div className="bbdrts-rail-name-row">
                    <span className="bbdrts-rail-name">Maya</span>
                    <span className="bbdrts-rail-tag maya">QR Ph</span>
                  </div>
                  <span className="bbdrts-rail-network">Mobile E-Wallet</span>
                </div>
              </div>
              <h4 className="bbdrts-rail-title">Scan to Donate via Maya</h4>
              <p className="bbdrts-rail-desc">
                Send straight from your Maya app using QR Ph and upload your receipt for fast AI verification and logging.
              </p>
              <div className="bbdrts-rail-features">
                <div className="bbdrts-rail-feature-item">
                  <span className="material-symbols-outlined check-icon">check_circle</span>
                  <span>0% fees taken out</span>
                </div>
                <div className="bbdrts-rail-feature-item">
                  <span className="material-symbols-outlined check-icon">check_circle</span>
                  <span>Automatic reference match</span>
                </div>
              </div>
            </div>

            {/* Bank & Credit Cards */}
            <div className="bbdrts-rail-card bank">
              <div className="bbdrts-rail-top">
                <div className="bbdrts-rail-icon-box bank">
                  <span className="material-symbols-outlined">account_balance</span>
                </div>
                <div className="bbdrts-rail-identity">
                  <div className="bbdrts-rail-name-row">
                    <span className="bbdrts-rail-name">Bank &amp; Cards</span>
                    <span className="bbdrts-rail-tag bank">InstaPay</span>
                  </div>
                  <span className="bbdrts-rail-network">Banks, Visa, Mastercard &amp; JCB</span>
                </div>
              </div>
              <h4 className="bbdrts-rail-title">Cards &amp; Philippine Banks</h4>
              <p className="bbdrts-rail-desc">
                Pay using Visa, Mastercard, JCB, or direct InstaPay bank transfer with public donation tracking.
              </p>
              <div className="bbdrts-rail-features">
                <div className="bbdrts-rail-feature-item">
                  <span className="material-symbols-outlined check-icon">check_circle</span>
                  <span>Cards &amp; InstaPay supported</span>
                </div>
                <div className="bbdrts-rail-feature-item">
                  <span className="material-symbols-outlined check-icon">check_circle</span>
                  <span>Public record logged</span>
                </div>
              </div>
            </div>

            {/* Gasless Blockchain Audit Layer */}
            <div className="bbdrts-rail-card crypto">
              <div className="bbdrts-rail-top">
                <div className="bbdrts-rail-icon-box crypto">
                  <span className="material-symbols-outlined">verified_user</span>
                </div>
                <div className="bbdrts-rail-identity">
                  <div className="bbdrts-rail-name-row">
                    <span className="bbdrts-rail-name">Sepolia EVM</span>
                    <span className="bbdrts-rail-tag crypto">Gasless Audit</span>
                  </div>
                  <span className="bbdrts-rail-network">Automated On-Chain Relayer</span>
                </div>
              </div>
              <h4 className="bbdrts-rail-title">Zero-Wallet Blockchain Proof</h4>
              <p className="bbdrts-rail-desc">
                No cryptocurrency or wallet needed. Our gasless relayer automatically anchors every verified PHP gift and payout proof onto Ethereum Sepolia.
              </p>
              <div className="bbdrts-rail-features">
                <div className="bbdrts-rail-feature-item">
                  <span className="material-symbols-outlined check-icon">check_circle</span>
                  <span>Zero gas fees for donors &amp; NGOs</span>
                </div>
                <div className="bbdrts-rail-feature-item">
                  <span className="material-symbols-outlined check-icon">check_circle</span>
                  <span>Publicly verifiable on Etherscan</span>
                </div>
              </div>
              <div className="bbdrts-rail-footer">
                <button
                  type="button"
                  className="bbdrts-copy-contract-btn"
                  onClick={handleCopyContract}
                  title="Copy Sepolia Smart Contract Address"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                    {contractCopied ? 'check' : 'content_copy'}
                  </span>
                  <span>{contractCopied ? 'Contract Copied!' : `${contractAddress ? contractAddress.substring(0, 10) + '...' + contractAddress.substring(contractAddress.length - 6) : '0x34fE...91B2'}`}</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── 7. Stakeholder Alignment (Donors vs Organizations) ── */}
      <section className="bbdrts-personas-section bbdrts-scroll-section">
        <div className="container">
          <div className="bbdrts-personas-grid">

            {/* Persona A: For Donors */}
            <div className="bbdrts-persona-card donor">
              <div className="bbdrts-persona-badge donor">
                <span className="material-symbols-outlined">favorite</span>
                <span>For Donors</span>
              </div>
              <h3 className="bbdrts-persona-title">Give Knowing Where It Went</h3>
              <p className="bbdrts-persona-desc">
                See where every peso goes. Follow campaigns on the live map, view real store receipts and delivery photos, and check every update.
              </p>
              <div className="bbdrts-persona-actions">
                <button
                  type="button"
                  className="bbdrts-persona-btn-primary"
                  onClick={() => onSignUp ? onSignUp('donor') : (onSignIn && onSignIn('donor'))}
                >
                  <span>Sign Up as Donor</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>arrow_forward</span>
                </button>
                <a href="#campaigns" className="bbdrts-persona-btn-secondary">
                  <span>Browse Campaigns</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>arrow_downward</span>
                </a>
              </div>
            </div>

            {/* Persona B: For Verified NGOs */}
            <div className="bbdrts-persona-card ngo">
              <div className="bbdrts-persona-badge ngo">
                <span className="material-symbols-outlined">corporate_fare</span>
                <span>For Verified NGOs</span>
              </div>
              <h3 className="bbdrts-persona-title">Run Campaigns Without the Hassle</h3>
              <p className="bbdrts-persona-desc">
                Submit your organization&apos;s papers once, start relief or charity drives with 0% fees, and share clear proof with your donors.
              </p>
              <div className="bbdrts-persona-actions">
                <button
                  type="button"
                  className="bbdrts-persona-btn-primary"
                  onClick={() => onSignUp ? onSignUp('organization') : (onSignIn && onSignIn('organization'))}
                >
                  <span>Register Organization</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>verified</span>
                </button>
                <button
                  type="button"
                  className="bbdrts-persona-btn-secondary"
                  onClick={() => onOpenNgoProfile && onOpenNgoProfile(3)}
                >
                  <span>View NGO Standards ↗</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 8. Frequently Asked Questions (Accordion) ── */}
      <section className="bbdrts-faq-section bbdrts-scroll-section" id="faq">
        <div className="container" style={{ maxWidth: '820px' }}>
          <div className="bbdrts-section-header-centered" style={{ marginBottom: '36px' }}>
            <div className="bbdrts-section-eyebrow">QUESTIONS &amp; ANSWERS</div>
            <h2 className="bbdrts-section-title">Frequently Asked Questions</h2>
            <p className="bbdrts-section-desc">
              Simple answers about how BBDRTS keeps donations safe, checks NGOs, and reviews proof.
            </p>
          </div>

          <div className="bbdrts-faq-list">
            <div className={`bbdrts-faq-item ${openFaqIndex === 0 ? 'open' : ''}`}>
              <button type="button" className="bbdrts-faq-question" onClick={() => toggleFaq(0)}>
                <span>How does BBDRTS keep donations safe from misuse?</span>
                <span className="material-symbols-outlined faq-icon">
                  {openFaqIndex === 0 ? 'remove' : 'add'}
                </span>
              </button>
              {openFaqIndex === 0 && (
                <div className="bbdrts-faq-answer">
                  <p>
                    Only checked NGOs with verified documents can launch campaigns, uploaded GCash and Maya receipts are scanned by AI for duplicates and details, and NGOs must log store receipts and handover photos capped at the funds actually raised.
                  </p>
                </div>
              )}
            </div>

            <div className={`bbdrts-faq-item ${openFaqIndex === 1 ? 'open' : ''}`}>
              <button type="button" className="bbdrts-faq-question" onClick={() => toggleFaq(1)}>
                <span>Do I need cryptocurrency or a digital wallet to donate?</span>
                <span className="material-symbols-outlined faq-icon">
                  {openFaqIndex === 1 ? 'remove' : 'add'}
                </span>
              </button>
              {openFaqIndex === 1 && (
                <div className="bbdrts-faq-answer">
                  <p>
                    <strong>No—100% of donations are in Philippine Pesos.</strong> You can donate using GCash (QR Ph), Maya, credit or debit cards, or Philippine bank transfers. Our gasless blockchain relayer automatically logs every verified donation onto Ethereum Sepolia for public auditing.
                  </p>
                </div>
              )}
            </div>

            <div className={`bbdrts-faq-item ${openFaqIndex === 2 ? 'open' : ''}`}>
              <button type="button" className="bbdrts-faq-question" onClick={() => toggleFaq(2)}>
                <span>How do you check if an NGO is real?</span>
                <span className="material-symbols-outlined faq-icon">
                  {openFaqIndex === 2 ? 'remove' : 'add'}
                </span>
              </button>
              {openFaqIndex === 2 && (
                <div className="bbdrts-faq-answer">
                  <p>
                    Before any group can post a campaign, admins check their official papers (such as SEC registration or DSWD permit) and contact details. Every approved NGO has a public profile you can view anytime.
                  </p>
                </div>
              )}
            </div>

            <div className={`bbdrts-faq-item ${openFaqIndex === 3 ? 'open' : ''}`}>
              <button type="button" className="bbdrts-faq-question" onClick={() => toggleFaq(3)}>
                <span>How do receipt checks work?</span>
                <span className="material-symbols-outlined faq-icon">
                  {openFaqIndex === 3 ? 'remove' : 'add'}
                </span>
              </button>
              {openFaqIndex === 3 && (
                <div className="bbdrts-faq-answer">
                  <p>
                    When donors upload a GCash or Maya receipt, AI reads the reference number, amount, recipient, and date to catch mistakes or reuse before approval. Later, when NGOs buy supplies, they upload official store receipts and delivery photos into public spending reports.
                  </p>
                </div>
              )}
            </div>

            <div className={`bbdrts-faq-item ${openFaqIndex === 4 ? 'open' : ''}`}>
              <button type="button" className="bbdrts-faq-question" onClick={() => toggleFaq(4)}>
                <span>Does BBDRTS charge any fees?</span>
                <span className="material-symbols-outlined faq-icon">
                  {openFaqIndex === 4 ? 'remove' : 'add'}
                </span>
              </button>
              {openFaqIndex === 4 && (
                <div className="bbdrts-faq-answer">
                  <p>
                    <strong>Zero fees (0%).</strong> BBDRTS is a capstone project built at Saint Joseph College, College of Computer Studies, to make giving open and trustworthy. 100% of your donation goes to the verified campaign.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. Institutional Capstone & Terminal Call to Action ── */}
      <section className="bbdrts-cta-section bbdrts-scroll-section">
        <div className="container">
          <div className="bbdrts-cta-badge">
            <span className="bbdrts-pulse-beacon" />
            <span>SAINT JOSEPH COLLEGE · COLLEGE OF COMPUTER STUDIES</span>
          </div>
          <h2 className="bbdrts-cta-title">Help Make Giving Clear Across the Philippines</h2>
          <p className="bbdrts-cta-desc">
            Support disaster relief and local charity campaigns, check the live map, or sign in to manage your account.
          </p>
          <div className="bbdrts-cta-actions">
            <button
              type="button"
              className="bbdrts-btn-primary"
              onClick={() => (onSignIn ? onSignIn('donor') : (onConnect && onConnect('donor', 'login')))}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>login</span>
              <span>Open Portal</span>
            </button>
            <a href="#campaigns" className="bbdrts-btn-secondary">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>search</span>
              <span>Browse Campaigns</span>
            </a>
            <a href="#radar-heatmap" className="bbdrts-btn-secondary">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>map</span>
              <span>Live Operations Map</span>
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}
