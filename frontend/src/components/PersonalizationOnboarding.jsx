import React, { useState, useMemo, useEffect } from 'react';
import VercelIcon from './VercelIcon';
import BbdrtsLogo from './BbdrtsLogo';
import SidebarToggleIcon from './SidebarToggleIcon';
import './PersonalizationOnboarding.css';

/**
 * BBDRTS — Post-Signup Workspace Setup & Personalization Wizard
 * Synchronizes dashboard layout, theme, language, typography, and accessibility preferences.
 */

// Localized translation strings for Live Preview synchronization
const previewTranslations = {
  en: {
    dashboardTitle: 'Dashboard Overview',
    dashboardSub: 'Real-time relief contributions, verified digital receipts, and humanitarian impact tracking.',
    verifiedDonor: 'Verified Donor',
    walletStatus: 'Gasless Sepolia Audit',
    sepoliaNet: 'Sepolia Testnet',
    lifetimeGiving: 'LIFETIME GIVING',
    newContributor: 'New Contributor',
    browseCamp: 'Browse Campaigns',
    donationReceipts: 'Donation Receipts',
    reliefRadar: 'Relief Radar',
    publicLedger: 'Public Ledger',
    totalDonated: 'TOTAL DONATED',
    onChainVerified: 'PHP · On-chain verified',
    reliefCamp: 'RELIEF CAMPAIGNS',
    criticalPriority: '16 critical priority',
    familiesReached: 'FAMILIES REACHED',
    awaitingPledge: 'Awaiting first relief pledge',
    honorRoll: 'HONOR ROLL STANDING',
    pledgeFirst: 'Pledge first donation',
    activeAppeals: 'Active Disaster Relief Appeals',
    viewAllCamp: 'View all 17 campaigns →',
    donate: 'Donate',
    detailsMap: 'Details & Map',
    donateRelief: 'Donate Relief',
    // Simplified specific
    welcomeUser: 'Welcome',
    simplifiedSub: 'Ready to send your first relief aid? Explore verified Philippine disaster appeals with 100% transparency.',
    startGiving: 'Start Giving Relief',
    active15: '15 Active Relief Appeals',
    active15Sub: 'Open for public aid across the Philippines',
    direct100: '100% Direct to Ground Relief',
    direct100Sub: 'Zero platform cuts · Verified on public ledger',
    simplifiedBanner: 'Simplified Mode Active: Essential overview for new donors. Advanced audit telemetry and empty zero-metrics are hidden.',
    // Sidebar
    navOverview: 'Dashboard Overview',
    navExplore: 'Explore Campaigns',
    navRadar: 'Relief Radar',
    navContrib: 'My Contributions',
    navSettings: 'Profile & Settings',
    navTutorial: 'Guided Tutorial',
    donorPortal: 'DONOR PORTAL',
    // Privacy
    anonymousDonor: 'Anonymous Donor',
    anonymousContributor: 'Anonymous Contributor',
    privacyShielded: 'Privacy Shielded',
    privacyMaskedSub: 'Identity masked on public blockchain ledger',
  },
  fil: {
    dashboardTitle: 'Pangkalahatang-ideya ng Dashboard',
    dashboardSub: 'Real-time na tulong, beripikadong digital resibo, at pagsubaybay sa humanitarian impact.',
    verifiedDonor: 'Beripikadong Donor',
    walletStatus: 'Gasless Sepolia Audit',
    sepoliaNet: 'Sepolia Testnet',
    lifetimeGiving: 'KABUUANG NAIBIGAY',
    newContributor: 'Bagong Tagapag-ambag',
    browseCamp: 'Maghanap ng Kampanya',
    donationReceipts: 'Mga Resibo ng Donasyon',
    reliefRadar: 'Relief Radar',
    publicLedger: 'Pampublikong Ledger',
    totalDonated: 'KABUUANG NAIDONASYON',
    onChainVerified: 'PHP · Beripikado sa blockchain',
    reliefCamp: 'MGA KAMPANYA NG RELIEF',
    criticalPriority: '16 kritikal na prayoridad',
    familiesReached: 'MGA PAMILYANG NATULUNGAN',
    awaitingPledge: 'Naghihintay ng unang donasyon',
    honorRoll: 'ANTAS NG KARANGALAN',
    pledgeFirst: 'Ilaan ang unang donasyon',
    activeAppeals: 'Mga Aktibong Apela para sa Disaster Relief',
    viewAllCamp: 'Tingnan ang lahat ng 17 kampanya →',
    donate: 'Mag-donate',
    detailsMap: 'Detalye at Mapa',
    donateRelief: 'Mag-donate ng Tulong',
    // Simplified specific
    welcomeUser: 'Maligayang pagdating',
    simplifiedSub: 'Handa nang magbigay ng unang tulong? Tuklasin ang mga beripikadong operasyon ng disaster relief sa Pilipinas.',
    startGiving: 'Simulan ang Pagbibigay',
    active15: '15 Aktibong Apela ng Relief',
    active15Sub: 'Bukas para sa tulong sa buong Pilipinas',
    direct100: '100% Direktang Tulong sa Lapag',
    direct100Sub: 'Walang kaltas ang plataporma · Beripikado sa blockchain',
    simplifiedBanner: 'Aktibo ang Simplified Mode: Naka-focus para sa mga bagong donor. Nakatago ang advanced na audit telemetry.',
    // Sidebar
    navOverview: 'Pangkalahatang-ideya',
    navExplore: 'Tuklasin ang Kampanya',
    navRadar: 'Relief Radar',
    navContrib: 'Aking Mga Donasyon',
    navSettings: 'Profile at Setting',
    navTutorial: 'Gabay sa Paggamit',
    donorPortal: 'PORTAL NG DONOR',
    // Privacy
    anonymousDonor: 'Hindi Kilalang Donor',
    anonymousContributor: 'Hindi Kilalang Tagapag-ambag',
    privacyShielded: 'Naka-protektang Pagkakakilanlan',
    privacyMaskedSub: 'Nakatago ang pangalan sa pampublikong blockchain ledger',
  },
  ceb: {
    dashboardTitle: 'Kinatibuk-ang Pagtan-aw sa Dashboard',
    dashboardSub: 'Tinuod-nga-panahon nga donasyon, beripikado nga resibo, ug pagsubay sa humanitarian nga tabang.',
    verifiedDonor: 'Beripikadong Maghahatag',
    walletStatus: 'Gasless Sepolia Audit',
    sepoliaNet: 'Sepolia Testnet',
    lifetimeGiving: 'TIBUOK NGA NAHATAG',
    newContributor: 'Bag-ong Mag-aambag',
    browseCamp: 'Pangitaa ang Kampanya',
    donationReceipts: 'Mga Resibo sa Donasyon',
    reliefRadar: 'Relief Radar',
    publicLedger: 'Publikong Ledger',
    totalDonated: 'TIBUOK NGA NADONAR',
    onChainVerified: 'PHP · Beripikado sa blockchain',
    reliefCamp: 'MGA KAMPANYA SA RELIEF',
    criticalPriority: '16 ka kritikal nga prayoridad',
    familiesReached: 'MGA PAMILYA NGA NATABANGAN',
    awaitingPledge: 'Naghulat sa unang donasyon',
    honorRoll: 'LEBEL SA PAGPASIDUNGOG',
    pledgeFirst: 'Ihatag ang unang donasyon',
    activeAppeals: 'Mga Aktibong Panawagan alang sa Hinabang',
    viewAllCamp: 'Tan-awa ang tanang 17 ka kampanya →',
    donate: 'Donar',
    detailsMap: 'Detalye ug Mapa',
    donateRelief: 'Donar og Hinabang',
    // Simplified specific
    welcomeUser: 'Maayong pag-abot',
    simplifiedSub: 'Andam na mupadala og unang hinabang? Susiha ang mga beripikado nga mga kampanya sa Pilipinas.',
    startGiving: 'Sugdi ang Paghatag',
    active15: '15 ka Aktibong Panawagan',
    active15Sub: 'Bukas alang sa tabang sa tibuok Pilipinas',
    direct100: '100% Direkta sa Yuta nga Hinabang',
    direct100Sub: 'Walang kaltas ang plataporma · Beripikado sa blockchain',
    simplifiedBanner: 'Aktibo ang Simplified Mode: Gipasimple alang sa mga bag-ong maghahatag. Gitago ang advanced nga audit telemetry.',
    // Sidebar
    navOverview: 'Kinatibuk-ang Pagtan-aw',
    navExplore: 'Susiha ang Kampanya',
    navRadar: 'Relief Radar',
    navContrib: 'Akong mga Donasyon',
    navSettings: 'Profile ug Setting',
    navTutorial: 'Giya sa Paggamit',
    donorPortal: 'PORTAL SA MAGHAHATAG',
    // Privacy
    anonymousDonor: 'Wala Mailhing Maghahatag',
    anonymousContributor: 'Wala Mailhing Mag-aambag',
    privacyShielded: 'Giprotektahan nga Pagkailhanan',
    privacyMaskedSub: 'Gitago ang ngalan sa publikong blockchain ledger',
  }
};

export default function PersonalizationOnboarding({
  isOpen = true,
  onClose,
  onComplete,
  user = { name: 'Jeo Lee', email: 'jeo.lee@bbdrts.gov.ph', role: 'donor' },
  initialTheme = 'dark',
  initialMode = 'standard',
  campaigns = []
}) {
  // Step tracker:
  // 0 = Welcome
  // 1 = Interface Mode Selection (Step 1 of 6)
  // 2 = Preview Theme (Step 2 of 6)
  // 3 = Preferred Platform Language (Step 3 of 6)
  // 4 = Interface Text Size (Step 4 of 6)
  // 5 = Visual & Cognitive Controls (Step 5 of 6)
  // 6 = Giving Privacy & Calamity Alerts (Step 6 of 6)
  // 6 = Review Preferences
  // 7 = Complete
  const buildInitialPrefs = () => {
    let saved = {};
    try {
      const rawPrefs = user?.preferences;
      if (rawPrefs) {
        saved = typeof rawPrefs === 'string' ? JSON.parse(rawPrefs) : rawPrefs;
      }
    } catch (_) {}

    const rawTextSize = saved?.textSize || 'comfortable';
    const mappedTextSize = rawTextSize === 'compact' ? 'compact' : (rawTextSize === 'large' || rawTextSize === 'extra-large') ? 'large' : 'comfortable';
    const rawThemePref = saved?.themePreference || initialTheme;
    const mappedTheme = ['light', 'dark', 'system'].includes(rawThemePref) ? rawThemePref : (initialTheme === 'light' ? 'light' : 'dark');
    const rawMode = saved?.experienceMode || initialMode;
    const rawLang = saved?.language;

    return {
      experienceMode: rawMode === 'simplified' ? 'simplified' : 'standard',
      themePreference: mappedTheme,
      language: ['en', 'fil', 'ceb'].includes(rawLang) ? rawLang : 'en',
      textSize: mappedTextSize,
      reducedMotion: Boolean(saved?.reducedMotion),
      highContrast: Boolean(saved?.highContrast),
      lowBandwidthMode: Boolean(saved?.lowBandwidthMode)
    };
  };

  const [step, setStep] = useState(0);
  const [slideDirection, setSlideDirection] = useState('next'); // 'next' | 'prev'
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [prefs, setPrefs] = useState(buildInitialPrefs);

  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setSlideDirection('next');
      setSaveError('');
      setPrefs(buildInitialPrefs());
      document.body.dataset.onboardingOpen = 'true';
    } else {
      delete document.body.dataset.onboardingOpen;
    }
    return () => {
      delete document.body.dataset.onboardingOpen;
    };
  }, [isOpen, initialMode, initialTheme, user?.id, user?.email]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape' && step < 7 && !saving && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, step, saving, onClose]);

  // Dynamic active campaigns count and critical priority count
  const rawCampaigns = useMemo(() => {
    if (Array.isArray(campaigns) && campaigns.length > 0) return campaigns;
    try {
      const cached = localStorage.getItem('bbdrts_cached_campaigns_v2');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [];
  }, [campaigns]);

  const activeCampaignsList = useMemo(() => {
    return rawCampaigns.filter(c => c.isActive !== false && !c.isClosed);
  }, [rawCampaigns]);

  const activeCampaignsCount = useMemo(() => {
    if (rawCampaigns.length === 0) return 15;
    return activeCampaignsList.length;
  }, [rawCampaigns, activeCampaignsList]);

  const criticalUrgencyCount = useMemo(() => {
    if (rawCampaigns.length === 0) return 3;
    const count = activeCampaignsList.filter(c => {
      if (c.isActive === false || c.isClosed) return false;
      const u = (c.audit?.urgency || c.urgency || '').toUpperCase();
      return u === 'CRITICAL' || u.includes('CRITICAL');
    }).length;
    return Math.min(count, activeCampaignsCount);
  }, [rawCampaigns, activeCampaignsList, activeCampaignsCount]);

  if (!isOpen) return null;

  // Language display map
  const languageLabels = {
    en: { name: 'English (Philippines)', sub: 'Default operational interface & official audit terminology' },
    fil: { name: 'Filipino / Tagalog', sub: 'Localized disaster terminology & community relief guidelines' },
    ceb: { name: 'Bisaya / Cebuano', sub: 'Optimized for Visayas & Mindanao disaster response zones' }
  };

  const themeLabelMap = {
    dark: 'Dark Theme',
    light: 'Light Theme',
    system: 'System Sync'
  };

  const textSizeLabelMap = {
    compact: 'Compact',
    comfortable: 'Standard',
    normal: 'Standard',
    large: 'Large',
    'extra-large': 'Extra Large'
  };

  const handleNext = () => {
    setSlideDirection('next');
    setStep(s => Math.min(7, s + 1));
  };

  const handleBack = () => {
    setSlideDirection('prev');
    setStep(s => Math.max(0, s - 1));
  };

  const handleFinish = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError('');
    try {
      if (onComplete) {
        await onComplete(prefs);
      } else if (onClose) {
        onClose();
      }
    } catch (err) {
      setSaveError(err?.message || 'Failed to save workspace preferences.');
    } finally {
      setSaving(false);
    }
  };

  const handleOptionKeyDown = (e, action) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  const isOrgUser = user?.role === 'organization';
  const isPreviewMode = !user?.id && (user?.email === 'preview@bbdrts.org' || !user?.email);
  const activeComfortControls = [
    prefs.reducedMotion && 'Reduced Motion',
    prefs.highContrast && 'High Contrast',
    prefs.lowBandwidthMode && 'Data Saver'
  ].filter(Boolean);
  const emailHandle = (user?.email || '').split('@')[0];
  const displayName = (isOrgUser
    ? (user?.org_name || user?.organization_name || user?.name || user?.display_name)
    : (user?.display_name || user?.name || user?.username || user?.Username)) || emailHandle || (isOrgUser ? 'Relief Organization' : 'Valued Supporter');
  const userInitials = displayName
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'BB';

  // Reusable Live Preview Renderer (Dynamic synchronization across ALL steps)
  const renderLivePreview = () => {
    const currentLang = prefs.language || 'en';
    const t = previewTranslations[currentLang] || previewTranslations.en;
    const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const isLight = prefs.themePreference === 'light' || (prefs.themePreference === 'system' && !prefersDark);

    return (
      <div
        className={`onboarding-preview-window ${isLight ? 'light' : 'dark'} scale-${prefs.textSize} ${prefs.reducedMotion ? 'reduced-motion' : ''} ${prefs.highContrast ? 'high-contrast' : ''}`}
        data-theme={isLight ? 'light' : 'dark'}
      >
        {/* Mac/Browser Frame Window Chrome */}
        <div className="onboarding-window-chrome">
          <div className="onboarding-traffic-dots">
            <span className="onboarding-traffic-dot red" />
            <span className="onboarding-traffic-dot yellow" />
            <span className="onboarding-traffic-dot green" />
          </div>

          <div className="onboarding-address-bar">
            <span className="material-symbols-outlined" style={{ fontSize: '12px', color: '#10b981' }}>lock</span>
            <span className="onboarding-address-url">https://bbdrts-frontend.vercel.app/</span>
          </div>

          <div className="onboarding-live-badge">
            <span className="onboarding-live-dot" />
            <span>LIVE PREVIEW</span>
          </div>
        </div>

        {/* Viewport: Authentic Desktop Canvas Scaled to Fit */}
        <div className="preview-desktop-viewport">
          <div className="preview-desktop-canvas">
            {/* 1. Header (EXACT MATCH TO BBDRTS INSTITUTIONAL SCREEN) */}
            <header className="preview-bbdrts-header">
              <div className="preview-header-left">
                <div className="preview-brand-link">
                  <BbdrtsLogo size={24} />
                  <div className="preview-brand-text">
                    <span className="preview-brand-wordmark">BBDRTS</span>
                    <span className="preview-brand-tagline">Blockchain-Based Donation &amp; Relief Transparency System</span>
                  </div>
                </div>
              </div>

              <div className="preview-header-right">
                <div className="preview-live-pill" title="Live System">
                  <span className="preview-live-beacon" />
                  <span>Live</span>
                </div>

                <span className="material-symbols-outlined preview-icon-btn" title="Audit Telemetry">wifi_tethering</span>

                <span
                  className="material-symbols-outlined preview-icon-btn"
                  onClick={() => setPrefs(p => ({ ...p, themePreference: p.themePreference === 'light' ? 'dark' : 'light' }))}
                  title="Toggle preview theme"
                  style={{ cursor: 'pointer' }}
                >
                  {isLight ? 'dark_mode' : 'light_mode'}
                </span>

                <div className="preview-notif-wrap" title="Notifications">
                  <span className="material-symbols-outlined preview-icon-btn">notifications</span>
                  <span className="preview-notif-badge">1</span>
                </div>

                <div className="preview-profile-chip">
                  <div className="preview-avatar-img">
                    <span className="preview-avatar-initials">{userInitials}</span>
                  </div>
                  <span className="preview-profile-name">{displayName}</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#71717a' }}>expand_more</span>
                </div>
              </div>
            </header>

            {/* 2. Main Body: Sidebar + Main Content */}
            <div className="preview-app-body">
              {/* Left Sidebar */}
              <aside className="preview-app-sidebar">
                <div className="preview-sidebar-header-strip">
                  <div className="preview-sidebar-brand-group">
                    <span className="material-symbols-outlined ref-portal-icon" style={{ fontSize: '18px', color: isLight ? '#09090b' : '#ededed' }}>volunteer_activism</span>
                    <span className="preview-sidebar-portal-title">{isOrgUser ? 'NGO PORTAL' : t.donorPortal}</span>
                  </div>
                  <div className="preview-sidebar-collapse-toggle" title="Collapse Sidebar">
                    <SidebarToggleIcon />
                  </div>
                </div>

                <div className="preview-sidebar-menu">
                  <div className="preview-nav-item active">
                    <span className="material-symbols-outlined">dashboard</span>
                    <span>{t.navOverview}</span>
                  </div>
                  <div className="preview-nav-item">
                    <span className="material-symbols-outlined">explore</span>
                    <span>{t.navExplore}</span>
                  </div>
                  {prefs.experienceMode === 'standard' && (
                    <>
                      <div className="preview-nav-item">
                        <span className="material-symbols-outlined">radar</span>
                        <span>{t.navRadar}</span>
                      </div>
                      <div className="preview-nav-item">
                        <span className="material-symbols-outlined">receipt_long</span>
                        <span>{t.navContrib}</span>
                      </div>
                    </>
                  )}
                  <div className="preview-nav-item">
                    <span className="material-symbols-outlined">settings</span>
                    <span>{t.navSettings}</span>
                  </div>
                </div>

                <div className="preview-sidebar-footer">
                  <div className="preview-nav-item">
                    <span className="material-symbols-outlined">help</span>
                    <span>{t.navTutorial}</span>
                  </div>
                </div>
              </aside>

              {/* Main Content Area */}
              <main className="preview-app-main">
            {/* Page Header */}
            <div className="preview-page-header">
              <h2 className="preview-page-title">
                <span className="material-symbols-outlined preview-page-icon">space_dashboard</span>
                <span>{t.dashboardTitle}</span>
              </h2>
              <p className="preview-page-sub">{t.dashboardSub}</p>
            </div>

            {/* Hero Banner */}
            {prefs.experienceMode === 'standard' ? (
              <div className="preview-hero-card">
                <div className="preview-hero-top">
                  <div className="preview-hero-user">
                    <div className="preview-hero-avatar-photo">
                      <span className="preview-hero-avatar-initials">{userInitials}</span>
                    </div>
                    <div className="preview-hero-meta">
                      <div className="preview-hero-name-row">
                        <h3 className="preview-hero-name">{displayName}</h3>
                        <span className="preview-verified-badge">
                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>verified</span>
                          <span>{isOrgUser ? 'Verified NGO' : t.verifiedDonor}</span>
                        </span>
                      </div>

                      <div className="preview-hero-subtext" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                        <span>{t.walletStatus}</span>
                        <span>•</span>
                        <span>{t.sepoliaNet}</span>
                        
                      </div>
                    </div>
                  </div>

                  <div className="preview-hero-stat">
                    <span className="preview-stat-label">{t.lifetimeGiving}</span>
                    <span className="preview-stat-val">₱0</span>
                    <span className="preview-stat-sub gray">
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>military_tech</span>
                      <span>{t.newContributor} &gt;</span>
                    </span>
                  </div>
                </div>

                {/* Action Buttons Row */}
                <div className="preview-hero-actions">
                  <button type="button" className="preview-action-btn">
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>campaign</span>
                    <span>{t.browseCamp}</span>
                  </button>
                  <button type="button" className="preview-action-btn">
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>receipt_long</span>
                    <span>{t.donationReceipts}</span>
                  </button>
                  <button type="button" className="preview-action-btn">
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>radar</span>
                    <span>{t.reliefRadar}</span>
                  </button>
                  <button type="button" className="preview-action-btn public-ledger-btn">
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>analytics</span>
                    <span>{t.publicLedger}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '12px', opacity: 0.7 }}>open_in_new</span>
                    
                  </button>
                </div>
              </div>
            ) : (
              <div className="preview-hero-card preview-simplified-welcome-card">
                <div className="preview-simplified-welcome-wrap">
                  <div className="preview-simplified-welcome-avatar">
                    <span className="preview-hero-avatar-initials">{userInitials}</span>
                  </div>
                  <div className="preview-simplified-welcome-body">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 className="preview-simplified-welcome-title">{t.welcomeUser}, {displayName} 👋</h3>
                      <span className="preview-verified-badge">
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>verified</span>
                        <span>{isOrgUser ? 'Verified NGO' : t.verifiedDonor}</span>
                      </span>
                    </div>
                    <p className="preview-simplified-welcome-desc">{t.simplifiedSub}</p>
                  </div>
                  <button type="button" className="preview-simplified-primary-cta">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>volunteer_activism</span>
                    <span>{t.startGiving}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                  </button>
                </div>
              </div>
            )}

            {/* Metrics Section */}
            {prefs.experienceMode === 'standard' ? (
              <div className="preview-metrics-row">
                <div className="preview-metric-card">
                  <div className="preview-metric-head">
                    <span className="preview-metric-title">{t.totalDonated}</span>
                    <span className="material-symbols-outlined preview-metric-icon">payments</span>
                  </div>
                  <div className="preview-metric-num accent">₱0</div>
                  <p className="preview-metric-cap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                    <span>{t.onChainVerified}</span>
                    
                  </p>
                </div>

                <div className="preview-metric-card">
                  <div className="preview-metric-head">
                    <span className="preview-metric-title">{t.reliefCamp}</span>
                    <span className="material-symbols-outlined preview-metric-icon">campaign</span>
                  </div>
                  <div className="preview-metric-num">{activeCampaignsCount}</div>
                  <p className="preview-metric-cap">
                    {criticalUrgencyCount > 0 ? t.criticalPriority.replace('16', String(criticalUrgencyCount)) : t.activeAppeals}
                  </p>
                </div>

                <div className="preview-metric-card">
                  <div className="preview-metric-head">
                    <span className="preview-metric-title">{t.familiesReached}</span>
                    <span className="material-symbols-outlined preview-metric-icon">groups</span>
                  </div>
                  <div className="preview-metric-num">0</div>
                  <p className="preview-metric-cap">{t.awaitingPledge}</p>
                </div>

                <div className="preview-metric-card">
                  <div className="preview-metric-head">
                    <span className="preview-metric-title">{t.honorRoll}</span>
                    <span className="material-symbols-outlined preview-metric-icon">workspace_premium</span>
                  </div>
                  <div className="preview-metric-num">{t.newContributor}</div>
                  <p className="preview-metric-cap">{t.pledgeFirst}</p>
                </div>
              </div>
            ) : (
              <div className="preview-simplified-strip">
                <div className="preview-simple-pill">
                  <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: '18px', flexShrink: 0 }}>campaign</span>
                  <div>
                    <strong>{t.active15.replace('15', String(activeCampaignsCount))}</strong>
                    <span className="preview-pill-sub">{t.active15Sub}</span>
                  </div>
                </div>
                <div className="preview-simple-pill">
                  <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: '18px', flexShrink: 0 }}>verified</span>
                  <div>
                    <strong>{t.direct100}</strong>
                    <span className="preview-pill-sub">{t.direct100Sub}</span>
                  </div>
                  
                </div>
              </div>
            )}

            {/* Active Disaster Relief Appeals Section */}
            <div className="preview-section-wrap">
              <div className="preview-section-head">
                <div className="preview-section-title">
                  <span className="preview-asterisk">*</span>
                  <span>{t.activeAppeals}</span>
                </div>
                <span className="preview-section-link">{t.viewAllCamp.replace('17', String(activeCampaignsCount))}</span>
              </div>

              {/* 3 Campaign Cards (All Skeleton Content + Perfectly Aligned Buttons) */}
              <div className="preview-campaigns-grid-row">
                
                {/* Card 1 */}
                <div className="preview-camp-card-item">
                  <div className="preview-camp-card-header">
                    <span className="preview-skeleton-bar is-tag" style={{ width: '84px', height: '18px', borderRadius: '4px' }} />
                  </div>
                  <div className="preview-camp-card-content">
                    <div className="preview-skeleton-bar is-title" style={{ width: '76%', borderRadius: '4px', marginBottom: '10px' }} />
                    <div className="preview-skeleton-bar is-line" style={{ width: '92%', borderRadius: '4px', marginBottom: '5px' }} />
                    <div className="preview-skeleton-bar is-line" style={{ width: '58%', borderRadius: '4px', marginBottom: '10px' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                      <span className="preview-skeleton-bar is-line" style={{ width: '42%', borderRadius: '4px' }} />
                      <span className="preview-skeleton-bar is-line" style={{ width: '16%', borderRadius: '4px' }} />
                    </div>
                    <div className="preview-skeleton-bar is-track" style={{ width: '100%', height: '5px', borderRadius: '999px', marginBottom: '8px' }} />
                    {prefs.experienceMode === 'standard' ? (
                      <div className="preview-camp-btn-row">
                        <button type="button" className="preview-camp-donate-btn">
                          <span>{t.donate}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>arrow_forward</span>
                        </button>
                        <button type="button" className="preview-camp-details-btn">
                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>map</span>
                          <span>{t.detailsMap}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="preview-camp-btn-row-simple">
                        <button type="button" className="preview-simplified-donate-cta">
                          <span>{t.donateRelief}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>arrow_forward</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card 2 */}
                <div className="preview-camp-card-item">
                  <div className="preview-camp-card-header">
                    <span className="preview-skeleton-bar is-tag" style={{ width: '92px', height: '18px', borderRadius: '4px' }} />
                  </div>
                  <div className="preview-camp-card-content">
                    <div className="preview-skeleton-bar is-title" style={{ width: '84%', borderRadius: '4px', marginBottom: '10px' }} />
                    <div className="preview-skeleton-bar is-line" style={{ width: '90%', borderRadius: '4px', marginBottom: '5px' }} />
                    <div className="preview-skeleton-bar is-line" style={{ width: '64%', borderRadius: '4px', marginBottom: '10px' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                      <span className="preview-skeleton-bar is-line" style={{ width: '38%', borderRadius: '4px' }} />
                      <span className="preview-skeleton-bar is-line" style={{ width: '20%', borderRadius: '4px' }} />
                    </div>
                    <div className="preview-skeleton-bar is-track" style={{ width: '100%', height: '5px', borderRadius: '999px', marginBottom: '8px' }} />
                    {prefs.experienceMode === 'standard' ? (
                      <div className="preview-camp-btn-row">
                        <button type="button" className="preview-camp-donate-btn">
                          <span>{t.donate}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>arrow_forward</span>
                        </button>
                        <button type="button" className="preview-camp-details-btn">
                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>map</span>
                          <span>{t.detailsMap}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="preview-camp-btn-row-simple">
                        <button type="button" className="preview-simplified-donate-cta">
                          <span>{t.donateRelief}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>arrow_forward</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card 3 */}
                <div className="preview-camp-card-item">
                  <div className="preview-camp-card-header">
                    <span className="preview-skeleton-bar is-tag" style={{ width: '80px', height: '18px', borderRadius: '4px' }} />
                  </div>
                  <div className="preview-camp-card-content">
                    <div className="preview-skeleton-bar is-title" style={{ width: '80%', borderRadius: '4px', marginBottom: '10px' }} />
                    <div className="preview-skeleton-bar is-line" style={{ width: '94%', borderRadius: '4px', marginBottom: '5px' }} />
                    <div className="preview-skeleton-bar is-line" style={{ width: '52%', borderRadius: '4px', marginBottom: '10px' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                      <span className="preview-skeleton-bar is-line" style={{ width: '44%', borderRadius: '4px' }} />
                      <span className="preview-skeleton-bar is-line" style={{ width: '15%', borderRadius: '4px' }} />
                    </div>
                    <div className="preview-skeleton-bar is-track" style={{ width: '100%', height: '5px', borderRadius: '999px', marginBottom: '8px' }} />
                    {prefs.experienceMode === 'standard' ? (
                      <div className="preview-camp-btn-row">
                        <button type="button" className="preview-camp-donate-btn">
                          <span>{t.donate}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>arrow_forward</span>
                        </button>
                        <button type="button" className="preview-camp-details-btn">
                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>map</span>
                          <span>{t.detailsMap}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="preview-camp-btn-row-simple">
                        <button type="button" className="preview-simplified-donate-cta">
                          <span>{t.donateRelief}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>arrow_forward</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

          </main>
        </div>
      </div>
    </div>
  </div>
);
  };

  return (
    <div className="onboarding-backdrop" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className={`onboarding-card ${step >= 1 && step <= 6 ? 'is-side-by-side' : ''}`}>
        
        {/* ── Top Header & Progress Track ── */}
        <header className="onboarding-header">
          <div className="onboarding-header-brand">
            <div className="onboarding-brand-badge"><img src="/logo.png" alt="BBDRTS" style={{ width: '18px', height: '18px', objectFit: 'contain' }} /></div>
            <span className="onboarding-brand-title">BBDRTS Workspace Setup</span>
          </div>

          <div className="onboarding-header-actions">
            {step > 0 && step <= 5 && (
              <span className="onboarding-step-pill">
                STEP {step} OF 5
              </span>
            )}
            {step === 6 && (
              <span className="onboarding-step-pill">
                REVIEW &amp; CONFIRM
              </span>
            )}
            {step === 7 && (
              <span className="onboarding-step-pill is-complete">
                SETUP COMPLETE
              </span>
            )}
            {step < 7 && (
              <button
                type="button"
                className="onboarding-skip-btn"
                onClick={onClose}
                title="Skip personalization and use platform defaults"
              >
                Skip for now
              </button>
            )}
          </div>
        </header>

        {/* ── Segmented Step Progress Bar (1:1 Step Alignment, 5 Steps) ── */}
        {step > 0 && step <= 6 && (
          <div className="onboarding-segmented-track" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={5}>
            {[1, 2, 3, 4, 5].map(s => {
              const isFilled = s < step || step === 6;
              const isActive = s === step && step <= 5;
              return (
                <div 
                  key={s} 
                  className={`onboarding-segment-step ${isFilled ? 'is-filled' : ''} ${isActive ? 'is-active' : ''}`}
                  title={`Step ${s} of 5`}
                />
              );
            })}
          </div>
        )}

        {/* ── Dynamic Content Body ── */}
        <main className="onboarding-body">

          {/* ════ SCREEN 0: WELCOME SCREEN ════ */}
          {step === 0 && (
            <div className="onboarding-welcome-view">
              <div className="onboarding-welcome-emblem">
                <VercelIcon name={isPreviewMode ? 'tune' : 'verified'} size={26} color="#10b981" />
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                <span className="onboarding-section-tag" style={{ margin: 0 }}>
                  {isPreviewMode ? 'Interactive Preview' : 'Account Verified · Welcome'}
                </span>
              </div>
              <h2 className="onboarding-section-title" id="onboarding-title" style={{ fontSize: '1.72rem', marginBottom: '10px' }}>
                Personalize your workspace, {displayName}
              </h2>
              <p className="onboarding-welcome-desc">
                {isPreviewMode
                  ? 'Preview how your BBDRTS relief dashboard adapts in real time—every option here can be customized once signed in.'
                  : 'Set your preferred layout, theme, language, and reading comfort in under a minute. Choices apply only to your dashboard.'}
              </p>

              {/* Symmetrical 3-Column Feature Bento */}
              <div className="onboarding-welcome-features">
                <div className="onboarding-welcome-feature">
                  <div className="onboarding-welcome-feature-head">
                    <span className="onboarding-welcome-feature-icon">
                      <VercelIcon name="view_compact" size={15} color="#10b981" />
                    </span>
                    <strong className="onboarding-welcome-feature-title">Layout Focus</strong>
                  </div>
                  <p className="onboarding-welcome-feature-desc">
                    Switch between full operational metrics and a clean essentials-only workspace.
                  </p>
                </div>

                <div className="onboarding-welcome-feature">
                  <div className="onboarding-welcome-feature-head">
                    <span className="onboarding-welcome-feature-icon">
                      <VercelIcon name="visibility" size={15} color="#10b981" />
                    </span>
                    <strong className="onboarding-welcome-feature-title">Theme &amp; Language</strong>
                  </div>
                  <p className="onboarding-welcome-feature-desc">
                    Pick Dark, Light, or System themes in English (PH), Tagalog, or Bisaya / Cebuano.
                  </p>
                </div>

                <div className="onboarding-welcome-feature">
                  <div className="onboarding-welcome-feature-head">
                    <span className="onboarding-welcome-feature-icon is-amber">
                      <VercelIcon name="shield" size={15} color="#f59e0b" />
                    </span>
                    <strong className="onboarding-welcome-feature-title">Comfort &amp; Data Saver</strong>
                  </div>
                  <p className="onboarding-welcome-feature-desc">
                    Adjust text scaling, 2px high contrast, reduced motion, and zero-tile offline maps.
                  </p>
                </div>
              </div>

              <div className="onboarding-cta-stack">
                <button
                  type="button"
                  className="onboarding-btn onboarding-btn-primary"
                  onClick={handleNext}
                  style={{ minWidth: '220px', padding: '12px 26px' }}
                >
                  <span>Start Setup</span>
                  <VercelIcon name="arrow_forward" size={16} />
                </button>
                <span className="onboarding-cta-note">
                  {isPreviewMode ? 'Live sandbox · Does not affect signed-in users' : 'Takes under 1 minute · Editable anytime in Account Settings'}
                </span>
              </div>
            </div>
          )}

          {/* ════ STEPS 1 TO 6: SHARED PERSISTENT LAYOUT WITH ANIMATED CHOICES ════ */}
          {step >= 1 && step <= 6 && (
            <div className="onboarding-step-view">
              {/* Dynamic Header Meta for Active Step with Key & Slide Animation */}
              <div className="onboarding-section-meta">
                <div key={`meta-${step}`} className={`onboarding-meta-inner anim-${slideDirection}`}>

                {step === 1 && (
                  <>
                    <span className="onboarding-section-tag">
                      <VercelIcon name="tune" size={14} color="#10b981" />
                      Step 1 of 5 · Interface Presentation Mode
                    </span>
                    <h2 className="onboarding-section-title" id="onboarding-title">
                      Choose your interface presentation mode
                    </h2>
                    <p className="onboarding-section-desc">
                      Both modes belong to the same BBDRTS application. Select how information, telemetry, and actions are structured.
                    </p>
                  </>
                )}

                {step === 2 && (
                  <>
                    <span className="onboarding-section-tag">
                      <VercelIcon name="visibility" size={14} color="#10b981" />
                      Step 2 of 5 · Display Theme
                    </span>
                    <h2 className="onboarding-section-title" id="onboarding-title">
                      Select your display theme
                    </h2>
                    <p className="onboarding-section-desc">
                      Choose how the BBDRTS workspace appears across daytime relief operations and low-light field conditions.
                    </p>
                  </>
                )}

                {step === 3 && (
                  <>
                    <span className="onboarding-section-tag">
                      <VercelIcon name="translate" size={14} color="#10b981" />
                      Step 3 of 5 · Preferred Platform Language
                    </span>
                    <h2 className="onboarding-section-title" id="onboarding-title">
                      Choose your platform language
                    </h2>
                    <p className="onboarding-section-desc">
                      Calibrates campaign dossiers, receipt terminology, and field disaster alerts to your native dialect.
                    </p>
                  </>
                )}

                {step === 4 && (
                  <>
                    <span className="onboarding-section-tag">
                      <VercelIcon name="text_fields" size={14} color="#10b981" />
                      Step 4 of 5 · Interface Text Size &amp; Typography
                    </span>
                    <h2 className="onboarding-section-title" id="onboarding-title">
                      Adjust interface text size
                    </h2>
                    <p className="onboarding-section-desc">
                      Set your baseline typography scale for optimal reading comfort across campaign feeds and blockchain ledgers.
                    </p>
                  </>
                )}

                {step === 5 && (
                  <>
                    <span className="onboarding-section-tag">
                      <VercelIcon name="shield" size={14} color="#10b981" />
                      Step 5 of 5 · Visual &amp; Cognitive Controls
                    </span>
                    <h2 className="onboarding-section-title" id="onboarding-title">
                      Fine-tune visual &amp; cognitive controls
                    </h2>
                    <p className="onboarding-section-desc">
                      Configure comfort switches for motion sensitivity, high-contrast clarity, and field data-saving.
                    </p>
                  </>
                )}

                {step === 6 && (
                  <>
                    <span className="onboarding-section-tag">
                      <VercelIcon name="fact_check" size={14} color="#10b981" />
                      Review &amp; Finalize Personalization
                    </span>
                    <h2 className="onboarding-section-title" id="onboarding-title">
                      Review your personalized workspace
                    </h2>
                    <p className="onboarding-section-desc">
                      Here is how BBDRTS will adapt to your preferences. You can jump back to edit any setting or proceed to launch.
                    </p>
                  </>
                )}
                </div>
              </div>

              <div className="onboarding-side-by-side">
                <div className="onboarding-left-panel">
                  <div key={`panel-${step}`} className={`onboarding-panel-inner anim-${slideDirection}`}>

                  {step === 1 && (
                    <>
                      {/* Option 1: Standard Mode */}
                  <div
                    className={`onboarding-card-select ${prefs.experienceMode === 'standard' ? 'is-selected' : ''}`}
                    onClick={() => setPrefs(prev => ({ ...prev, experienceMode: 'standard' }))}
                    onKeyDown={(e) => handleOptionKeyDown(e, () => setPrefs(prev => ({ ...prev, experienceMode: 'standard' })))}
                    role="radio"
                    aria-checked={prefs.experienceMode === 'standard'}
                    tabIndex={0}
                    style={{ padding: '12px 14px' }}
                  >
                    <div className="onboarding-card-top">
                      <div className="onboarding-card-header-left">
                        <div className="onboarding-card-icon-wrap" style={{ width: '28px', height: '28px', flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>dashboard</span>
                        </div>
                        <h4 className="onboarding-card-title" style={{ margin: 0, fontSize: '0.86rem' }}>Standard Mode</h4>
                        <span className="onboarding-card-badge">DEFAULT</span>
                      </div>
                      <div className="onboarding-radio-dot">
                        {prefs.experienceMode === 'standard' && <div className="onboarding-radio-inner-dot" />}
                      </div>
                    </div>
                    <p className="onboarding-card-desc" style={{ margin: 0, fontSize: '0.74rem', lineHeight: 1.35 }}>
                      Full operational telemetry, 4-metric financials, and complete blockchain audit navigation.
                    </p>
                  </div>

                  {/* Option 2: Simplified Mode */}
                  <div
                    className={`onboarding-card-select ${prefs.experienceMode === 'simplified' ? 'is-selected' : ''}`}
                    onClick={() => setPrefs(prev => ({ ...prev, experienceMode: 'simplified' }))}
                    onKeyDown={(e) => handleOptionKeyDown(e, () => setPrefs(prev => ({ ...prev, experienceMode: 'simplified' })))}
                    role="radio"
                    aria-checked={prefs.experienceMode === 'simplified'}
                    tabIndex={0}
                    style={{ padding: '12px 14px' }}
                  >
                    <div className="onboarding-card-top">
                      <div className="onboarding-card-header-left">
                        <div className="onboarding-card-icon-wrap" style={{ width: '28px', height: '28px', flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>volunteer_activism</span>
                        </div>
                        <h4 className="onboarding-card-title" style={{ margin: 0, fontSize: '0.86rem' }}>Simplified Mode</h4>
                        <span className="onboarding-card-badge neutral">SIMPLIFIED</span>
                      </div>
                      <div className="onboarding-radio-dot">
                        {prefs.experienceMode === 'simplified' && <div className="onboarding-radio-inner-dot" />}
                      </div>
                    </div>
                    <p className="onboarding-card-desc" style={{ margin: 0, fontSize: '0.74rem', lineHeight: 1.35 }}>
                      Focused giving interface highlighting direct relief campaigns, one-click donations, and essential aid summaries.
                    </p>
                  </div>

                  {/* Concrete Differences Breakdown Callout */}
                  <div className="onboarding-mode-diff-box">
                    <div className="onboarding-diff-header">
                      <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#10b981' }}>compare_arrows</span>
                      <span>What changes in {prefs.experienceMode === 'standard' ? 'Standard Mode' : 'Simplified Mode'}:</span>
                    </div>
                    {prefs.experienceMode === 'standard' ? (
                      <ul className="onboarding-diff-list">
                        <li><strong>Dual Aligned Buttons:</strong> Every campaign card features aligned Donate and Details &amp; Map action buttons.</li>
                        <li><strong>4-Card Telemetry Grid:</strong> Shows verified PHP totals, priority counts, and honor roll tier.</li>
                        <li><strong>Blockchain Audit Telemetry:</strong> Displays live Sepolia notarization status and audit ledger tag.</li>
                        <li><strong>Full Navigation:</strong> Complete 5-item sidebar with audit access and advanced tools.</li>
                      </ul>
                    ) : (
                      <ul className="onboarding-diff-list">
                        <li><strong>Direct Action Button:</strong> Essential card layout with one prominent "Donate Relief" action.</li>
                        <li><strong>Clean Welcome Hero:</strong> Replaces dense telemetry banners &amp; 4 utility buttons with a simple direct start button.</li>
                        <li><strong>Lightweight Reassurance Strip:</strong> Replaces 4 zero-metric boxes with a clean 2-pill status bar.</li>
                        <li><strong>Essential Navigation:</strong> Focused 3-item sidebar reducing cognitive load for new donors.</li>
                      </ul>
                    )}
                  </div>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      {/* Option 1: Dark Theme */}
                  <div
                    className={`onboarding-card-select ${prefs.themePreference === 'dark' ? 'is-selected' : ''}`}
                    onClick={() => setPrefs(prev => ({ ...prev, themePreference: 'dark' }))}
                    onKeyDown={(e) => handleOptionKeyDown(e, () => setPrefs(prev => ({ ...prev, themePreference: 'dark' })))}
                    role="radio"
                    aria-checked={prefs.themePreference === 'dark'}
                    tabIndex={0}
                    style={{ padding: '12px 14px' }}
                  >
                    <div className="onboarding-card-top">
                      <div className="onboarding-card-header-left">
                        <div className="onboarding-card-icon-wrap" style={{ width: '28px', height: '28px', flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>dark_mode</span>
                        </div>
                        <h4 className="onboarding-card-title" style={{ margin: 0, fontSize: '0.86rem' }}>Dark Theme</h4>
                        <span className="onboarding-card-badge">RECOMMENDED</span>
                      </div>
                      <div className="onboarding-radio-dot">
                        {prefs.themePreference === 'dark' && <div className="onboarding-radio-inner-dot" />}
                      </div>
                    </div>
                    <p className="onboarding-card-desc" style={{ margin: 0, fontSize: '0.74rem', lineHeight: 1.35 }}>
                      Deep zinc surfaces, high-contrast night readability, and energy-efficient for OLED screens.
                    </p>
                  </div>

                  {/* Option 2: Light Theme */}
                  <div
                    className={`onboarding-card-select ${prefs.themePreference === 'light' ? 'is-selected' : ''}`}
                    onClick={() => setPrefs(prev => ({ ...prev, themePreference: 'light' }))}
                    onKeyDown={(e) => handleOptionKeyDown(e, () => setPrefs(prev => ({ ...prev, themePreference: 'light' })))}
                    role="radio"
                    aria-checked={prefs.themePreference === 'light'}
                    tabIndex={0}
                    style={{ padding: '12px 14px' }}
                  >
                    <div className="onboarding-card-top">
                      <div className="onboarding-card-header-left">
                        <div className="onboarding-card-icon-wrap" style={{ width: '28px', height: '28px', flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>light_mode</span>
                        </div>
                        <h4 className="onboarding-card-title" style={{ margin: 0, fontSize: '0.86rem' }}>Light Theme</h4>
                        <span className="onboarding-card-badge neutral">LIGHT</span>
                      </div>
                      <div className="onboarding-radio-dot">
                        {prefs.themePreference === 'light' && <div className="onboarding-radio-inner-dot" />}
                      </div>
                    </div>
                    <p className="onboarding-card-desc" style={{ margin: 0, fontSize: '0.74rem', lineHeight: 1.35 }}>
                      Clean high-contrast bright interface optimized for daytime viewing and well-lit workspaces.
                    </p>
                  </div>

                  {/* Option 3: System Sync */}
                  <div
                    className={`onboarding-card-select ${prefs.themePreference === 'system' ? 'is-selected' : ''}`}
                    onClick={() => setPrefs(prev => ({ ...prev, themePreference: 'system' }))}
                    onKeyDown={(e) => handleOptionKeyDown(e, () => setPrefs(prev => ({ ...prev, themePreference: 'system' })))}
                    role="radio"
                    aria-checked={prefs.themePreference === 'system'}
                    tabIndex={0}
                    style={{ padding: '12px 14px' }}
                  >
                    <div className="onboarding-card-top">
                      <div className="onboarding-card-header-left">
                        <div className="onboarding-card-icon-wrap" style={{ width: '28px', height: '28px', flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>desktop_windows</span>
                        </div>
                        <h4 className="onboarding-card-title" style={{ margin: 0, fontSize: '0.86rem' }}>System Preference</h4>
                        <span className="onboarding-card-badge neutral">AUTOMATIC</span>
                      </div>
                      <div className="onboarding-radio-dot">
                        {prefs.themePreference === 'system' && <div className="onboarding-radio-inner-dot" />}
                      </div>
                    </div>
                    <p className="onboarding-card-desc" style={{ margin: 0, fontSize: '0.74rem', lineHeight: 1.35 }}>
                      Automatically synchronizes with your device operating system schedule and daylight cycles.
                    </p>
                  </div>

                  {/* Theme Tip Callout */}
                  <div className="onboarding-mode-diff-box">
                    <div className="onboarding-diff-header">
                      <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#10b981' }}>palette</span>
                      <span>Theme Persistence:</span>
                    </div>
                    <ul className="onboarding-diff-list">
                      <li><strong>Instant Toggle:</strong> You can toggle themes anytime using the sun/moon icon in the dashboard topbar.</li>
                      <li><strong>Low Eye-Strain:</strong> Dark surfaces reduce glare during emergency night monitoring operations.</li>
                    </ul>
                  </div>
                    </>
                  )}

                  {step === 3 && (
                    <>
                      {/* Option 1: English (Philippines) */}
                  <div
                    className={`onboarding-card-select ${prefs.language === 'en' ? 'is-selected' : ''}`}
                    onClick={() => setPrefs(prev => ({ ...prev, language: 'en' }))}
                    onKeyDown={(e) => handleOptionKeyDown(e, () => setPrefs(prev => ({ ...prev, language: 'en' })))}
                    role="radio"
                    aria-checked={prefs.language === 'en'}
                    tabIndex={0}
                    style={{ padding: '12px 14px' }}
                  >
                    <div className="onboarding-card-top">
                      <div className="onboarding-card-header-left">
                        <div className="onboarding-card-icon-wrap" style={{ width: '28px', height: '28px', flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>language</span>
                        </div>
                        <h4 className="onboarding-card-title" style={{ margin: 0, fontSize: '0.86rem' }}>English (Philippines)</h4>
                        <span className="onboarding-card-badge">DEFAULT</span>
                      </div>
                      <div className="onboarding-radio-dot">
                        {prefs.language === 'en' && <div className="onboarding-radio-inner-dot" />}
                      </div>
                    </div>
                    <p className="onboarding-card-desc" style={{ margin: 0, fontSize: '0.74rem', lineHeight: 1.35 }}>
                      Standard Philippine relief terminology, receipt descriptions, and ledger navigation.
                    </p>
                  </div>

                  {/* Option 2: Filipino / Tagalog */}
                  <div
                    className={`onboarding-card-select ${prefs.language === 'fil' ? 'is-selected' : ''}`}
                    onClick={() => setPrefs(prev => ({ ...prev, language: 'fil' }))}
                    onKeyDown={(e) => handleOptionKeyDown(e, () => setPrefs(prev => ({ ...prev, language: 'fil' })))}
                    role="radio"
                    aria-checked={prefs.language === 'fil'}
                    tabIndex={0}
                    style={{ padding: '12px 14px' }}
                  >
                    <div className="onboarding-card-top">
                      <div className="onboarding-card-header-left">
                        <div className="onboarding-card-icon-wrap" style={{ width: '28px', height: '28px', flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>translate</span>
                        </div>
                        <h4 className="onboarding-card-title" style={{ margin: 0, fontSize: '0.86rem' }}>Filipino / Tagalog</h4>
                        <span className="onboarding-card-badge neutral">TAGALOG</span>
                      </div>
                      <div className="onboarding-radio-dot">
                        {prefs.language === 'fil' && <div className="onboarding-radio-inner-dot" />}
                      </div>
                    </div>
                    <p className="onboarding-card-desc" style={{ margin: 0, fontSize: '0.74rem', lineHeight: 1.35 }}>
                      Localized disaster terms, community guidelines, and regional relief announcements.
                    </p>
                  </div>

                  {/* Option 3: Cebuano / Bisaya */}
                  <div
                    className={`onboarding-card-select ${prefs.language === 'ceb' ? 'is-selected' : ''}`}
                    onClick={() => setPrefs(prev => ({ ...prev, language: 'ceb' }))}
                    onKeyDown={(e) => handleOptionKeyDown(e, () => setPrefs(prev => ({ ...prev, language: 'ceb' })))}
                    role="radio"
                    aria-checked={prefs.language === 'ceb'}
                    tabIndex={0}
                    style={{ padding: '12px 14px' }}
                  >
                    <div className="onboarding-card-top">
                      <div className="onboarding-card-header-left">
                        <div className="onboarding-card-icon-wrap" style={{ width: '28px', height: '28px', flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>g_translate</span>
                        </div>
                        <h4 className="onboarding-card-title" style={{ margin: 0, fontSize: '0.86rem' }}>Cebuano / Bisaya</h4>
                        <span className="onboarding-card-badge neutral">BISAYA</span>
                      </div>
                      <div className="onboarding-radio-dot">
                        {prefs.language === 'ceb' && <div className="onboarding-radio-inner-dot" />}
                      </div>
                    </div>
                    <p className="onboarding-card-desc" style={{ margin: 0, fontSize: '0.74rem', lineHeight: 1.35 }}>
                      Optimized for Visayas and Mindanao emergency responder communications and field teams.
                    </p>
                  </div>

                  {/* Live Localization Callout */}
                  <div className="onboarding-mode-diff-box">
                    <div className="onboarding-diff-header">
                      <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#10b981' }}>public</span>
                      <span>Live Translation Active:</span>
                    </div>
                    <ul className="onboarding-diff-list">
                      <li><strong>Real-Time Preview:</strong> Notice how the live dashboard on the right translates all headers and buttons immediately.</li>
                      <li><strong>Official Audit Intact:</strong> Smart contract transaction hashes remain universally auditable across languages.</li>
                    </ul>
                  </div>
                    </>
                  )}

                  {step === 4 && (
                    <>
                      {/* Option 1: Compact */}
                  <div
                    className={`onboarding-card-select ${prefs.textSize === 'compact' ? 'is-selected' : ''}`}
                    onClick={() => setPrefs(prev => ({ ...prev, textSize: 'compact' }))}
                    onKeyDown={(e) => handleOptionKeyDown(e, () => setPrefs(prev => ({ ...prev, textSize: 'compact' })))}
                    role="radio"
                    aria-checked={prefs.textSize === 'compact'}
                    tabIndex={0}
                    style={{ padding: '12px 14px' }}
                  >
                    <div className="onboarding-card-top">
                      <div className="onboarding-card-header-left">
                        <div className="onboarding-card-icon-wrap" style={{ width: '28px', height: '28px', flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>format_size</span>
                        </div>
                        <h4 className="onboarding-card-title" style={{ margin: 0, fontSize: '0.86rem' }}>Compact (14.5px)</h4>
                        <span className="onboarding-card-badge neutral">COMPACT</span>
                      </div>
                      <div className="onboarding-radio-dot">
                        {prefs.textSize === 'compact' && <div className="onboarding-radio-inner-dot" />}
                      </div>
                    </div>
                    <p className="onboarding-card-desc" style={{ margin: 0, fontSize: '0.74rem', lineHeight: 1.35 }}>
                      Smaller font scale allowing more campaign cards and blockchain ledger rows to fit on screen.
                    </p>
                  </div>

                  {/* Option 2: Comfortable */}
                  <div
                    className={`onboarding-card-select ${prefs.textSize === 'comfortable' ? 'is-selected' : ''}`}
                    onClick={() => setPrefs(prev => ({ ...prev, textSize: 'comfortable' }))}
                    onKeyDown={(e) => handleOptionKeyDown(e, () => setPrefs(prev => ({ ...prev, textSize: 'comfortable' })))}
                    role="radio"
                    aria-checked={prefs.textSize === 'comfortable'}
                    tabIndex={0}
                    style={{ padding: '12px 14px' }}
                  >
                    <div className="onboarding-card-top">
                      <div className="onboarding-card-header-left">
                        <div className="onboarding-card-icon-wrap" style={{ width: '28px', height: '28px', flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>text_fields</span>
                        </div>
                        <h4 className="onboarding-card-title" style={{ margin: 0, fontSize: '0.86rem' }}>Standard (16px)</h4>
                        <span className="onboarding-card-badge">RECOMMENDED</span>
                      </div>
                      <div className="onboarding-radio-dot">
                        {prefs.textSize === 'comfortable' && <div className="onboarding-radio-inner-dot" />}
                      </div>
                    </div>
                    <p className="onboarding-card-desc" style={{ margin: 0, fontSize: '0.74rem', lineHeight: 1.35 }}>
                      Balanced typography scale recommended for all desktop displays, laptops, and mobile screens.
                    </p>
                  </div>

                  {/* Option 3: Large & Legible */}
                  <div
                    className={`onboarding-card-select ${prefs.textSize === 'large' ? 'is-selected' : ''}`}
                    onClick={() => setPrefs(prev => ({ ...prev, textSize: 'large' }))}
                    onKeyDown={(e) => handleOptionKeyDown(e, () => setPrefs(prev => ({ ...prev, textSize: 'large' })))}
                    role="radio"
                    aria-checked={prefs.textSize === 'large'}
                    tabIndex={0}
                    style={{ padding: '12px 14px' }}
                  >
                    <div className="onboarding-card-top">
                      <div className="onboarding-card-header-left">
                        <div className="onboarding-card-icon-wrap" style={{ width: '28px', height: '28px', flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>zoom_in</span>
                        </div>
                        <h4 className="onboarding-card-title" style={{ margin: 0, fontSize: '0.86rem' }}>Large &amp; Legible (17.5px)</h4>
                        <span className="onboarding-card-badge neutral">LARGE</span>
                      </div>
                      <div className="onboarding-radio-dot">
                        {prefs.textSize === 'large' && <div className="onboarding-radio-inner-dot" />}
                      </div>
                    </div>
                    <p className="onboarding-card-desc" style={{ margin: 0, fontSize: '0.74rem', lineHeight: 1.35 }}>
                      Enhanced vision comfort with larger headers, high-legibility numerals, and generous line-heights.
                    </p>
                  </div>

                  {/* Text Size Callout */}
                  <div className="onboarding-mode-diff-box">
                    <div className="onboarding-diff-header">
                      <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#10b981' }}>format_size</span>
                      <span>Responsive Typography:</span>
                    </div>
                    <ul className="onboarding-diff-list">
                      <li><strong>Proportional Scaling:</strong> Font sizes scale harmoniously across all cards without breaking button alignment.</li>
                      <li><strong>WCAG Compliant:</strong> Maintains minimum recommended contrast ratios across all size steps.</li>
                    </ul>
                  </div>
                    </>
                  )}

                  {step === 5 && (
                    <>
                      {/* Reduced Motion Toggle */}
                  <div
                    className="onboarding-toggle-card"
                    onClick={() => setPrefs(p => ({ ...p, reducedMotion: !p.reducedMotion }))}
                    onKeyDown={(e) => handleOptionKeyDown(e, () => setPrefs(p => ({ ...p, reducedMotion: !p.reducedMotion })))}
                    role="switch"
                    aria-checked={prefs.reducedMotion}
                    tabIndex={0}
                    style={{ padding: '12px 14px' }}
                  >
                    <div className="onboarding-toggle-info">
                      <div className="onboarding-toggle-icon">
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>motion_photos_off</span>
                      </div>
                      <div>
                        <h5 className="onboarding-toggle-title" style={{ fontSize: '0.86rem', margin: '0 0 3px' }}>Reduced Motion</h5>
                        <p className="onboarding-toggle-desc" style={{ fontSize: '0.74rem', margin: 0, lineHeight: 1.35 }}>
                          Halts skeleton shimmer sweeps, radar pulses, and hover transitions for motion sensitivity.
                        </p>
                      </div>
                    </div>
                    <div className={`onboarding-switch ${prefs.reducedMotion ? 'is-on' : ''}`}>
                      <div className="onboarding-switch-knob" />
                    </div>
                  </div>

                  {/* High Contrast Toggle */}
                  <div
                    className="onboarding-toggle-card"
                    onClick={() => setPrefs(p => ({ ...p, highContrast: !p.highContrast }))}
                    onKeyDown={(e) => handleOptionKeyDown(e, () => setPrefs(p => ({ ...p, highContrast: !p.highContrast })))}
                    role="switch"
                    aria-checked={prefs.highContrast}
                    tabIndex={0}
                    style={{ padding: '12px 14px' }}
                  >
                    <div className="onboarding-toggle-info">
                      <div className="onboarding-toggle-icon">
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>contrast</span>
                      </div>
                      <div>
                        <h5 className="onboarding-toggle-title" style={{ fontSize: '0.86rem', margin: '0 0 3px' }}>High Contrast</h5>
                        <p className="onboarding-toggle-desc" style={{ fontSize: '0.74rem', margin: 0, lineHeight: 1.35 }}>
                          Enforces 2px solid contrast borders and pure black/white distinction for low-vision clarity.
                        </p>
                      </div>
                    </div>
                    <div className={`onboarding-switch ${prefs.highContrast ? 'is-on' : ''}`}>
                      <div className="onboarding-switch-knob" />
                    </div>
                  </div>

                  {/* Data Saver Toggle */}
                  <div
                    className="onboarding-toggle-card"
                    onClick={() => setPrefs(p => ({ ...p, lowBandwidthMode: !p.lowBandwidthMode }))}
                    onKeyDown={(e) => handleOptionKeyDown(e, () => setPrefs(p => ({ ...p, lowBandwidthMode: !p.lowBandwidthMode })))}
                    role="switch"
                    aria-checked={prefs.lowBandwidthMode}
                    tabIndex={0}
                    style={{ padding: '12px 14px' }}
                  >
                    <div className="onboarding-toggle-info">
                      <div className="onboarding-toggle-icon">
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>signal_cellular_alt</span>
                      </div>
                      <div>
                        <h5 className="onboarding-toggle-title" style={{ fontSize: '0.86rem', margin: '0 0 3px' }}>Data Saver</h5>
                        <p className="onboarding-toggle-desc" style={{ fontSize: '0.74rem', margin: 0, lineHeight: 1.35 }}>
                          Compresses satellite radar imagery, defers media downloads, and prioritizes essential text telemetry for low-connectivity calamity zones.
                        </p>
                      </div>
                    </div>
                    <div className={`onboarding-switch ${prefs.lowBandwidthMode ? 'is-on' : ''}`}>
                      <div className="onboarding-switch-knob" />
                    </div>
                  </div>

                  {/* Accessibility Standards Callout */}
                  <div className="onboarding-mode-diff-box">
                    <div className="onboarding-diff-header">
                      <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#10b981' }}>accessibility_new</span>
                      <span>Accessibility Guarantee:</span>
                    </div>
                    <ul className="onboarding-diff-list">
                      <li><strong>WCAG 2.1 AA Compliant:</strong> Built to meet international digital accessibility guidelines.</li>
                      <li><strong>Keyboard Navigable:</strong> All selections and modal actions are fully operable via Tab and Enter keys.</li>
                    </ul>
                  </div>
                    </>
                  )}

                  {step === 6 && (
                    <>
                      {/* Summary Cards with Jump Links */}
                  <div className="onboarding-summary-list">
                    <div className="onboarding-summary-item">
                      <div className="onboarding-summary-left">
                        <span className="onboarding-summary-key">Interface Mode</span>
                        <span className="onboarding-summary-val">
                          {prefs.experienceMode === 'standard' ? 'Standard (Full Telemetry & Dual Actions)' : 'Simplified (Direct Giving & Essential Metrics)'}
                        </span>
                      </div>
                      <button type="button" className="onboarding-summary-edit-btn" onClick={() => { setSlideDirection('prev'); setStep(1); }}>
                        Edit
                      </button>
                    </div>

                    <div className="onboarding-summary-item">
                      <div className="onboarding-summary-left">
                        <span className="onboarding-summary-key">Display Theme</span>
                        <span className="onboarding-summary-val">
                          {themeLabelMap[prefs.themePreference] || 'Dark Theme'}
                        </span>
                      </div>
                      <button type="button" className="onboarding-summary-edit-btn" onClick={() => { setSlideDirection('prev'); setStep(2); }}>
                        Edit
                      </button>
                    </div>

                    <div className="onboarding-summary-item">
                      <div className="onboarding-summary-left">
                        <span className="onboarding-summary-key">Platform Language</span>
                        <span className="onboarding-summary-val">
                          {languageLabels[prefs.language]?.name}
                        </span>
                      </div>
                      <button type="button" className="onboarding-summary-edit-btn" onClick={() => { setSlideDirection('prev'); setStep(3); }}>
                        Edit
                      </button>
                    </div>

                    <div className="onboarding-summary-item">
                      <div className="onboarding-summary-left">
                        <span className="onboarding-summary-key">Typography Scale</span>
                        <span className="onboarding-summary-val">
                          {textSizeLabelMap[prefs.textSize] || 'Standard'} Scale
                        </span>
                      </div>
                      <button type="button" className="onboarding-summary-edit-btn" onClick={() => { setSlideDirection('prev'); setStep(4); }}>
                        Edit
                      </button>
                    </div>

                    <div className="onboarding-summary-item">
                      <div className="onboarding-summary-left">
                        <span className="onboarding-summary-key">Comfort Controls</span>
                        <span className="onboarding-summary-val">
                          {prefs.reducedMotion ? 'Reduced Motion' : 'Standard Motion'} · {prefs.highContrast ? 'High Contrast' : 'Standard Contrast'} · {prefs.lowBandwidthMode ? 'Field Data Saver' : 'Full Bandwidth'}
                        </span>
                      </div>
                      <button type="button" className="onboarding-summary-edit-btn" onClick={() => { setSlideDirection('prev'); setStep(5); }}>
                        Edit
                      </button>
                    </div>
                  </div>

                  <div className="onboarding-mode-diff-box">
                    <div className="onboarding-diff-header">
                      <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#10b981' }}>verified</span>
                      <span>Setup Completed:</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#a1a1aa', margin: 0, lineHeight: 1.4 }}>
                      Click "Confirm &amp; Finalize" below to apply these preferences and open your live relief dashboard.
                    </p>
                  </div>
                    </>
                  )}
                  </div>
                </div>

                {/* Right Panel: Mounted ONCE, completely static, zero animation */}
                <div className="onboarding-right-panel">
                  {renderLivePreview()}
                </div>
              </div>
            </div>
          )}

          {/* ════ SCREEN 7: COMPLETION SCREEN ════ */}
          {step === 7 && (
            <div className="onboarding-complete-view">
              <div className="onboarding-complete-ring">
                <VercelIcon name="check" size={30} color="#10b981" />
              </div>

              <h2 className="onboarding-complete-title" id="onboarding-title">
                Your workspace is ready, {displayName}
              </h2>
              <p className="onboarding-complete-sub">
                {isPreviewMode
                  ? 'Your setup preview is complete. You can jump back to review any step or close this preview.'
                  : 'Your workspace preferences are configured and saved. You can update any option anytime under Account Settings.'}
              </p>

              {/* Structured Summary Card */}
              <div className="onboarding-complete-summary">
                <div className="onboarding-complete-summary-grid">
                  <div className="onboarding-complete-cell">
                    <span className="onboarding-complete-cell-label">
                      <VercelIcon name="tune" size={13} color="#10b981" />
                      <span>Layout</span>
                    </span>
                    <span className="onboarding-complete-cell-val">
                      {prefs.experienceMode === 'standard' ? 'Standard Mode' : 'Simplified Mode'}
                    </span>
                  </div>

                  <div className="onboarding-complete-cell">
                    <span className="onboarding-complete-cell-label">
                      <VercelIcon name="visibility" size={13} color="#10b981" />
                      <span>Theme</span>
                    </span>
                    <span className="onboarding-complete-cell-val">
                      {themeLabelMap[prefs.themePreference] || 'Dark Theme'}
                    </span>
                  </div>

                  <div className="onboarding-complete-cell">
                    <span className="onboarding-complete-cell-label">
                      <VercelIcon name="translate" size={13} color="#10b981" />
                      <span>Language</span>
                    </span>
                    <span className="onboarding-complete-cell-val">
                      {languageLabels[prefs.language]?.name || 'English (Philippines)'}
                    </span>
                  </div>

                  <div className="onboarding-complete-cell">
                    <span className="onboarding-complete-cell-label">
                      <VercelIcon name="text_fields" size={13} color="#10b981" />
                      <span>Text Size</span>
                    </span>
                    <span className="onboarding-complete-cell-val">
                      {textSizeLabelMap[prefs.textSize] || 'Standard'}
                    </span>
                  </div>
                </div>

                <div className="onboarding-complete-comfort-bar">
                  <span className="onboarding-complete-cell-label">
                    <VercelIcon name="shield" size={13} color={activeComfortControls.length > 0 ? '#f59e0b' : '#10b981'} />
                    <span>Comfort &amp; Data</span>
                  </span>
                  <span className="onboarding-complete-cell-val" style={{ fontSize: '0.8rem' }}>
                    {activeComfortControls.length > 0 ? activeComfortControls.join(' · ') : 'Default motion, contrast & full media'}
                  </span>
                </div>
              </div>

              {saveError && (
                <div style={{ color: '#f87171', fontSize: '0.78rem', marginBottom: '12px' }}>
                  {saveError}
                </div>
              )}

              <div className="onboarding-complete-actions">
                <button
                  type="button"
                  className="onboarding-btn onboarding-btn-secondary"
                  onClick={() => { setSlideDirection('prev'); setStep(6); }}
                  disabled={saving}
                  style={{ padding: '11px 18px' }}
                >
                  <VercelIcon name="arrow_back" size={15} />
                  <span>Review Settings</span>
                </button>

                <button
                  type="button"
                  className="onboarding-btn onboarding-btn-primary"
                  onClick={handleFinish}
                  disabled={saving}
                  style={{ minWidth: '220px', padding: '11px 24px', opacity: saving ? 0.75 : 1 }}
                >
                  <span>
                    {saving
                      ? 'Saving Preferences...'
                      : (isPreviewMode ? 'Done Previewing' : (isOrgUser ? 'Open NGO Dashboard' : 'Open Donor Dashboard'))}
                  </span>
                  <VercelIcon name="arrow_forward" size={16} />
                </button>
              </div>
            </div>
          )}

        </main>

        {/* ── Footer Navigation Bar (Steps 1 to 6) ── */}
        {step > 0 && step < 7 && (
          <footer className="onboarding-footer">
            <button
              type="button"
              className="onboarding-btn onboarding-btn-secondary"
              onClick={handleBack}
            >
              <VercelIcon name="arrow_back" size={16} />
              <span>Back</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.76rem', color: '#71717a', fontFamily: 'var(--font-mono, monospace)' }}>
                {step <= 5 ? `Step ${step} of 5` : 'Review'}
              </span>
            </div>

            <button
              type="button"
              className="onboarding-btn onboarding-btn-primary"
              onClick={handleNext}
            >
              <span>{step === 6 ? 'Confirm & Finalize' : 'Continue'}</span>
              <VercelIcon name="arrow_forward" size={16} />
            </button>
          </footer>
        )}

      </div>
    </div>
  );
}
