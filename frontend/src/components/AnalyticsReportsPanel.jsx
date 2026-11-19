import { useState, useEffect, useCallback, useRef } from 'react';
import { API_URL } from '../config';
import { useToast } from '../context/ToastContext';
import {
  VercelAreaLineChart,
  VercelDonutChart,
  VercelBarChart,
  VercelFunnelMeter
} from './AnalyticsCharts';
import {
  exportExcelWorkbook,
  exportFormattedCsv,
  exportStructuredJson,
  exportPrintablePdfReport
} from '../utils/reportExporter';
import './AnalyticsReportsPanel.css';

const RANGE_OPTIONS = [
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
  { id: 'all', label: 'All' }
];

const RAIL_COLORS = {
  'Bank / Card': 'var(--va-series-primary, #3291FF)',
  'Sepolia ETH': 'var(--va-series-mono, #ededed)',
  GCash: '#10b981',
  Maya: '#71717a'
};

export default function AnalyticsReportsPanel({ mode = 'admin', onNavigateTab }) {
  const isAdmin = mode === 'admin';
  const { showSuccess, showError } = useToast();

  const [range, setRange] = useState('30d');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Interactive Hero KPI -> Chart Series binding
  const [chartSeries, setChartSeries] = useState('combined'); // 'combined' | 'volume' | 'disbursed' | 'split'

  // Combined Cohort Switcher Card: Admin ('donors' | 'ngos') · NGO ('supporters' | 'operations')
  const [cohortTab, setCohortTab] = useState(isAdmin ? 'donors' : 'supporters');

  // Unified Tabbed Breakdown Deck
  const [breakdownTab, setBreakdownTab] = useState(isAdmin ? 'causes' : 'goals');

  // Matrix table filters
  const [campSearch, setCampSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'CLOSED'
  const exportMenuRef = useRef(null);

  useEffect(() => {
    setCohortTab(isAdmin ? 'donors' : 'supporters');
    setBreakdownTab(isAdmin ? 'causes' : 'goals');
  }, [isAdmin]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportMenuOpen(false);
      }
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') setExportMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  const fetchAnalytics = useCallback(async (silent = false) => {
    const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
    if (!token) return;
    if (!silent) setRefreshing(true);
    try {
      const endpoint = isAdmin ? '/api/admin/analytics' : '/api/organization/analytics';
      const qs = new URLSearchParams({ range });
      const res = await fetch(`${API_URL}${endpoint}?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load analytics data.');
      }
      setAnalytics(data);
    } catch (err) {
      if (!silent) {
        showError(err.message || 'Could not retrieve analytics telemetry.', 'Analytics Unavailable');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, range, showError]);

  useEffect(() => {
    fetchAnalytics(false);
  }, [fetchAnalytics]);

  const handleExport = (format) => {
    setExportMenuOpen(false);
    if (!analytics) return;
    try {
      if (format === 'xlsx') {
        const file = exportExcelWorkbook(analytics, { mode });
        showSuccess(`Generated multi-sheet Excel report "${file}".`, 'Excel Export Ready');
      } else if (format === 'pdf') {
        exportPrintablePdfReport(analytics, { mode });
        showSuccess('Opened executive PDF print layout.', 'PDF Report Ready');
      } else if (format === 'csv') {
        const file = exportFormattedCsv(analytics, { mode });
        showSuccess(`Downloaded structured report "${file}".`, 'CSV Export Ready');
      } else if (format === 'json') {
        const file = exportStructuredJson(analytics, { mode });
        showSuccess(`Downloaded JSON audit bundle "${file}".`, 'JSON Export Ready');
      }
    } catch (err) {
      showError(err.message || 'Export failed.', 'Report Export Error');
    }
  };

  const kpis = analytics?.kpis || {};
  const trendSeries = analytics?.trendSeries || [];
  const paymentRails = analytics?.paymentRails || [];
  const categoryBreakdown = analytics?.categoryBreakdown || [];
  const regionalBreakdown = analytics?.regionalBreakdown || [];
  const verificationFunnel = analytics?.verificationFunnel || {};
  const topOrganizations = analytics?.topOrganizations || [];
  const activityBreakdown = analytics?.activityBreakdown || [];
  const topContributors = analytics?.topContributors || [];
  const allCampaigns = analytics?.campaignPerformance || [];

  const donorStats = analytics?.ecosystemStats?.donors || {
    registered: Number(kpis.registeredDonors ?? kpis.totalDonors ?? 0),
    verified: Number(kpis.verifiedDonors || 0),
    registeredOnly: Number(kpis.registeredOnlyDonors || 0),
    walletLinked: Number(kpis.walletVerifiedDonors || 0),
    contributing: Number(kpis.contributingDonors || 0),
    repeat: Number(kpis.repeatDonors || 0),
    verifiedRatePct: 0
  };
  const ngoStats = analytics?.ecosystemStats?.ngos || {
    registered: Number(kpis.registeredNgos ?? ((kpis.approvedOrgs || 0) + (kpis.pendingOrgs || 0) + (kpis.rejectedOrgs || 0))),
    verified: Number(kpis.verifiedNgos ?? kpis.approvedOrgs ?? 0),
    pending: Number(kpis.pendingOrgs || 0),
    rejected: Number(kpis.rejectedOrgs || 0),
    evmEnrolled: Number(kpis.evmEnrolledNgos || 0),
    verifiedRatePct: 0
  };
  const supporterStats = analytics?.supporterStats || {
    totalBackers: Number(kpis.uniqueDonors || 0),
    registeredBackers: Number(kpis.registeredBackers || 0),
    verifiedBackers: Number(kpis.verifiedBackers || 0),
    registeredOnlyBackers: Math.max(0, Number(kpis.registeredBackers || 0) - Number(kpis.verifiedBackers || 0)),
    repeatBackers: Number(kpis.repeatBackers || 0),
    anonymousGifts: 0,
    verifiedRatePct: 0
  };

  const campaigns = allCampaigns.filter((c) => {
    if (statusFilter === 'ACTIVE' && !c.isActive) return false;
    if (statusFilter === 'CLOSED' && c.isActive) return false;
    if (!campSearch.trim()) return true;
    const q = campSearch.toLowerCase();
    return (
      String(c.title || '').toLowerCase().includes(q) ||
      String(c.orgName || '').toLowerCase().includes(q) ||
      String(c.region || '').toLowerCase().includes(q) ||
      String(c.categoryLabel || '').toLowerCase().includes(q)
    );
  });

  const filteredRaisedSum = campaigns.reduce((sum, c) => sum + Number(c.raisedPhp || 0), 0);
  const deltaNum = kpis.periodDeltaPct;
  const hasDelta = deltaNum !== null && deltaNum !== undefined;

  return (
    <div className="va-root analytics-panel-root">
      {/* ── Top Bar: Clean Geist Heading + Single-Row Controls ── */}
      <header className="va-header">
        <div className="va-header-title-wrap">
          <h2 className="va-page-title">
            {isAdmin ? 'Analytics & Reports' : 'NGO Analytics & Reports'}
          </h2>
          <p className="va-page-sub">
            {isAdmin
              ? 'Contribution velocity, rail share, donor & NGO cohorts, and formatted exports.'
              : `Fundraising velocity, channel share, and exports for ${analytics?.meta?.orgName || 'your organization'}.`}
          </p>
        </div>

        <div className="va-controls analytics-header-controls">
          <div className="va-range-group" role="group" aria-label="Time window filter">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`va-range-btn ${range === r.id ? 'active' : ''}`}
                onClick={() => setRange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="va-icon-btn"
            onClick={() => fetchAnalytics(false)}
            disabled={refreshing}
            title="Refresh live analytics"
            aria-label="Refresh analytics"
          >
            <span className={`material-symbols-outlined ${refreshing ? 'va-spin' : ''}`}>refresh</span>
          </button>

          <div className="va-export-wrap" ref={exportMenuRef}>
            <button
              type="button"
              className="va-export-btn analytics-export-primary"
              onClick={() => setExportMenuOpen((prev) => !prev)}
              disabled={!analytics || loading}
              aria-haspopup="menu"
              aria-expanded={exportMenuOpen}
            >
              <span className="material-symbols-outlined">download</span>
              <span>Export</span>
              <span className="material-symbols-outlined va-caret">
                {exportMenuOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {exportMenuOpen && (
              <div className="va-export-menu" role="menu">
                <div className="va-export-menu-head">Download report</div>
                <button type="button" className="va-export-option analytics-export-item" role="menuitem" onClick={() => handleExport('xlsx')}>
                  <div className="va-export-option-main">
                    <strong>Excel Workbook</strong>
                    <span>6 formatted sheets with totals</span>
                  </div>
                  <span className="va-ext-tag">.xlsx</span>
                </button>
                <button type="button" className="va-export-option analytics-export-item" role="menuitem" onClick={() => handleExport('pdf')}>
                  <div className="va-export-option-main">
                    <strong>Executive PDF Report</strong>
                    <span>Print-ready whitepaper &amp; tables</span>
                  </div>
                  <span className="va-ext-tag">.pdf</span>
                </button>
                <button type="button" className="va-export-option analytics-export-item" role="menuitem" onClick={() => handleExport('csv')}>
                  <div className="va-export-option-main">
                    <strong>Structured CSV</strong>
                    <span>UTF-8 Excel-compatible tables</span>
                  </div>
                  <span className="va-ext-tag">.csv</span>
                </button>
                <button type="button" className="va-export-option analytics-export-item" role="menuitem" onClick={() => handleExport('json')}>
                  <div className="va-export-option-main">
                    <strong>Audit JSON Bundle</strong>
                    <span>Full metrics &amp; ledger archive</span>
                  </div>
                  <span className="va-ext-tag">.json</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {loading && !analytics ? (
        <div className="va-panel va-loading-panel">
          <span className="material-symbols-outlined va-spin">progress_activity</span>
          <span>Loading live analytics telemetry...</span>
        </div>
      ) : (
        <>
          {/* ── Row 1: Asymmetric 8/4 Bento Hero (Interactive KPI + Smooth Animated Spline | Payment Channels) ── */}
          <div className="va-bento-hero">
            <section className="va-panel va-hero-panel">
              <div className="va-kpi-grid analytics-kpi-strip" role="tablist" aria-label="Chart metric selector">
                <button
                  type="button"
                  role="tab"
                  aria-selected={chartSeries === 'combined'}
                  className={`va-kpi-cell va-kpi-btn ${chartSeries === 'combined' ? 'is-selected' : ''}`}
                  onClick={() => setChartSeries('combined')}
                >
                  <div className="va-kpi-top">
                    <span className="va-kpi-label">Mobilized</span>
                    {hasDelta ? (
                      <span className={`va-delta-pill ${deltaNum < 0 ? 'neg' : 'pos'}`}>
                        {deltaNum >= 0 ? '+' : ''}{deltaNum}%
                      </span>
                    ) : (
                      <span className="va-delta-pill neutral">All</span>
                    )}
                  </div>
                  <div className="va-kpi-value">
                    ₱{Number(kpis.totalMobilizedPhp || 0).toLocaleString('en-US')}
                  </div>
                  <div className="va-kpi-sub">
                    {Number(kpis.totalMobilizedEth || 0).toFixed(4)} ETH
                  </div>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={chartSeries === 'volume'}
                  className={`va-kpi-cell va-kpi-btn ${chartSeries === 'volume' ? 'is-selected' : ''}`}
                  onClick={() => setChartSeries('volume')}
                >
                  <div className="va-kpi-top">
                    <span className="va-kpi-label">Avg Gift</span>
                    <span className="va-kpi-tag">{kpis.txCount || 0} tx</span>
                  </div>
                  <div className="va-kpi-value">
                    ₱{Number(kpis.avgGiftPhp || 0).toLocaleString('en-US')}
                  </div>
                  <div className="va-kpi-sub">
                    {isAdmin
                      ? `${kpis.totalDonors || 0} donors`
                      : `${kpis.uniqueDonors || 0} backers · ${kpis.anonymousSharePct || 0}% anon`}
                  </div>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={chartSeries === 'disbursed'}
                  className={`va-kpi-cell va-kpi-btn ${chartSeries === 'disbursed' ? 'is-selected' : ''}`}
                  onClick={() => setChartSeries('disbursed')}
                >
                  <div className="va-kpi-top">
                    <span className="va-kpi-label">Disbursed</span>
                    <span className="va-kpi-tag">{kpis.utilizationPct || 0}%</span>
                  </div>
                  <div className="va-kpi-value">
                    ₱{Number(kpis.totalDisbursedPhp || 0).toLocaleString('en-US')}
                  </div>
                  <div className="va-kpi-sub">
                    {isAdmin
                      ? `${kpis.totalBeneficiaries || 0} beneficiaries`
                      : `₱${Number(kpis.remainingEscrowPhp || 0).toLocaleString('en-US')} left`}
                  </div>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={chartSeries === 'split'}
                  className={`va-kpi-cell va-kpi-btn ${chartSeries === 'split' ? 'is-selected' : ''}`}
                  onClick={() => setChartSeries('split')}
                >
                  <div className="va-kpi-top">
                    <span className="va-kpi-label">Goal Pacing</span>
                    <span className="va-kpi-tag">
                      {isAdmin ? `${kpis.approvedOrgs || 0} NGOs` : `${kpis.pendingSlipsCount || 0} slips`}
                    </span>
                  </div>
                  <div className="va-kpi-value">
                    {kpis.avgFundingPct || 0}%
                  </div>
                  <div className="va-kpi-sub">
                    {isAdmin
                      ? `${kpis.activeCampaigns || 0} active · ${kpis.pendingOrgs || 0} KYC`
                      : `${kpis.activeCampaigns || 0} active · ${kpis.approvalRatePct || 0}% pass`}
                  </div>
                </button>
              </div>

              <div className="va-hero-chart-body">
                <VercelAreaLineChart
                  data={trendSeries}
                  height={232}
                  seriesMode={chartSeries}
                  onSeriesModeChange={setChartSeries}
                  animKey={range}
                  showModeSwitch
                  title={isAdmin ? 'Contribution & Disbursement Velocity' : 'Fundraising & Disbursement Velocity'}
                />
              </div>
            </section>

            {/* Right Bento Column: Payment Channels Above The Fold */}
            <section className="va-panel va-channel-panel">
              <div className="va-panel-head">
                <div>
                  <h3 className="va-section-heading">Payment Channels</h3>
                  <p className="va-panel-sub">Verified volume by settlement rail</p>
                </div>
              </div>
              <div className="va-panel-body va-channel-body">
                <VercelDonutChart
                  stacked
                  centerLabel="Period"
                  centerValue={`₱${Number(kpis.totalMobilizedPhp || 0).toLocaleString('en-US')}`}
                  items={paymentRails.map((r) => ({
                    key: r.rail,
                    label: r.rail,
                    value: r.php,
                    meta: `${r.count} tx · ${r.eth} ETH`,
                    displayValue: `₱${Number(r.php || 0).toLocaleString('en-US')}`,
                    color: RAIL_COLORS[r.rail]
                  }))}
                />
              </div>
            </section>
          </div>

          {/* ── Row 2: Complementary Split — Combined Cohort Switcher Card (Left) | Tabbed Breakdown Deck (Right) ── */}
          <div className="va-bento-mid">
            {/* LEFT CARD: Unified Donor ↔ NGO Switcher (Admin) | Supporters ↔ Operations Switcher (NGO) */}
            <section className="va-panel va-cohort-card" aria-label={isAdmin ? 'Donor and NGO cohorts' : 'Supporter cohorts and standing'}>
              <div className="va-panel-head va-cohort-head">
                <div>
                  <h3 className="va-section-heading">
                    {isAdmin
                      ? (cohortTab === 'donors' ? 'Platform Donors' : 'Relief Organizations')
                      : (cohortTab === 'supporters' ? 'Donor Cohorts' : 'Relief Standing')}
                  </h3>
                  <p className="va-panel-sub">
                    {isAdmin
                      ? (cohortTab === 'donors' ? 'Registered accounts vs verified contributors' : 'Registered applicants vs SEC-accredited NGOs')
                      : (cohortTab === 'supporters' ? 'Verified vs registered backers funding your drives' : 'Accreditation standing and active relief output')}
                  </p>
                </div>

                {/* Clean 1-Click Switcher Button */}
                <div className="va-segmented-mini" role="tablist" aria-label="Switch cohort view">
                  {isAdmin ? (
                    <>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={cohortTab === 'donors'}
                        className={`va-seg-mini-btn ${cohortTab === 'donors' ? 'active' : ''}`}
                        onClick={() => setCohortTab('donors')}
                      >
                        Donors
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={cohortTab === 'ngos'}
                        className={`va-seg-mini-btn ${cohortTab === 'ngos' ? 'active' : ''}`}
                        onClick={() => setCohortTab('ngos')}
                      >
                        NGOs
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={cohortTab === 'supporters'}
                        className={`va-seg-mini-btn ${cohortTab === 'supporters' ? 'active' : ''}`}
                        onClick={() => setCohortTab('supporters')}
                      >
                        Donors
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={cohortTab === 'operations'}
                        className={`va-seg-mini-btn ${cohortTab === 'operations' ? 'active' : ''}`}
                        onClick={() => setCohortTab('operations')}
                      >
                        Operations
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Admin -> Donors View */}
              {isAdmin && cohortTab === 'donors' && (
                <div className="va-cohort-body va-fade-switch" key="admin-donors">
                  <div className="va-eco-headline-row">
                    <div className="va-eco-headline">
                      <strong className="va-eco-total">{donorStats.registered.toLocaleString('en-US')}</strong>
                      <span className="va-eco-unit">registered donors</span>
                    </div>
                    <span className="va-kpi-tag">{donorStats.verifiedRatePct}% verified</span>
                  </div>

                  <div className="va-eco-bar" aria-hidden="true">
                    {donorStats.verified > 0 && (
                      <div
                        className="va-eco-seg seg-primary"
                        style={{ width: `${Math.max(4, (donorStats.verified / Math.max(1, donorStats.registered)) * 100)}%` }}
                      />
                    )}
                    {donorStats.registeredOnly > 0 && (
                      <div
                        className="va-eco-seg seg-neutral"
                        style={{ width: `${Math.max(4, (donorStats.registeredOnly / Math.max(1, donorStats.registered)) * 100)}%` }}
                      />
                    )}
                  </div>

                  <div className="va-eco-metrics">
                    <div className="va-eco-metric">
                      <span className="va-eco-metric-label">
                        <span className="va-dot-sm primary" />
                        Verified Donors
                      </span>
                      <strong>{donorStats.verified.toLocaleString('en-US')}</strong>
                      <span className="va-eco-metric-sub">Wallet, 2FA, or gift verified</span>
                    </div>
                    <div className="va-eco-metric">
                      <span className="va-eco-metric-label">
                        <span className="va-dot-sm muted" />
                        Registered Only
                      </span>
                      <strong>{donorStats.registeredOnly.toLocaleString('en-US')}</strong>
                      <span className="va-eco-metric-sub">Account created, unverified</span>
                    </div>
                  </div>

                  <div className="va-eco-foot">
                    <span>{donorStats.walletLinked} EVM wallets linked · {donorStats.contributing} active · {donorStats.repeat} repeat</span>
                  </div>
                </div>
              )}

              {/* Admin -> NGOs View */}
              {isAdmin && cohortTab === 'ngos' && (
                <div className="va-cohort-body va-fade-switch" key="admin-ngos">
                  <div className="va-eco-headline-row">
                    <div className="va-eco-headline">
                      <strong className="va-eco-total">{ngoStats.registered.toLocaleString('en-US')}</strong>
                      <span className="va-eco-unit">registered NGOs</span>
                    </div>
                    <span className="va-kpi-tag">{ngoStats.verifiedRatePct}% verified</span>
                  </div>

                  <div className="va-eco-bar" aria-hidden="true">
                    {ngoStats.verified > 0 && (
                      <div
                        className="va-eco-seg seg-ok"
                        style={{ width: `${Math.max(4, (ngoStats.verified / Math.max(1, ngoStats.registered)) * 100)}%` }}
                      />
                    )}
                    {ngoStats.pending > 0 && (
                      <div
                        className="va-eco-seg seg-warn"
                        style={{ width: `${Math.max(4, (ngoStats.pending / Math.max(1, ngoStats.registered)) * 100)}%` }}
                      />
                    )}
                    {ngoStats.rejected > 0 && (
                      <div
                        className="va-eco-seg seg-neutral"
                        style={{ width: `${Math.max(4, (ngoStats.rejected / Math.max(1, ngoStats.registered)) * 100)}%` }}
                      />
                    )}
                  </div>

                  <div className="va-eco-metrics cols-3">
                    <div className="va-eco-metric">
                      <span className="va-eco-metric-label">
                        <span className="va-dot-sm ok" />
                        Verified NGOs
                      </span>
                      <strong>{ngoStats.verified.toLocaleString('en-US')}</strong>
                      <span className="va-eco-metric-sub">SEC accredited</span>
                    </div>
                    <div className="va-eco-metric">
                      <span className="va-eco-metric-label">
                        <span className="va-dot-sm warn" />
                        Pending KYC
                      </span>
                      <strong>{ngoStats.pending.toLocaleString('en-US')}</strong>
                      <span className="va-eco-metric-sub">Under review</span>
                    </div>
                    <div className="va-eco-metric">
                      <span className="va-eco-metric-label">
                        <span className="va-dot-sm muted" />
                        Rejected
                      </span>
                      <strong>{ngoStats.rejected.toLocaleString('en-US')}</strong>
                      <span className="va-eco-metric-sub">Unverified</span>
                    </div>
                  </div>

                  <div className="va-eco-foot va-eco-foot-split">
                    <span>{ngoStats.evmEnrolled} approved NGOs on Sepolia EVM</span>
                    {onNavigateTab && (
                      <button type="button" className="va-card-action-link" onClick={() => onNavigateTab('approvals')}>
                        Review KYC
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* NGO -> Supporters View */}
              {!isAdmin && cohortTab === 'supporters' && (
                <div className="va-cohort-body va-fade-switch" key="ngo-supporters">
                  <div className="va-eco-headline-row">
                    <div className="va-eco-headline">
                      <strong className="va-eco-total">{supporterStats.totalBackers.toLocaleString('en-US')}</strong>
                      <span className="va-eco-unit">unique supporters</span>
                    </div>
                    <span className="va-kpi-tag">{supporterStats.verifiedRatePct}% verified</span>
                  </div>

                  <div className="va-eco-bar" aria-hidden="true">
                    {supporterStats.verifiedBackers > 0 && (
                      <div
                        className="va-eco-seg seg-primary"
                        style={{ width: `${Math.max(4, (supporterStats.verifiedBackers / Math.max(1, supporterStats.totalBackers)) * 100)}%` }}
                      />
                    )}
                    {supporterStats.registeredOnlyBackers > 0 && (
                      <div
                        className="va-eco-seg seg-neutral"
                        style={{ width: `${Math.max(4, (supporterStats.registeredOnlyBackers / Math.max(1, supporterStats.totalBackers)) * 100)}%` }}
                      />
                    )}
                    {supporterStats.anonymousGifts > 0 && (
                      <div
                        className="va-eco-seg seg-warn"
                        style={{ width: `${Math.max(4, (supporterStats.anonymousGifts / Math.max(1, supporterStats.totalBackers)) * 100)}%` }}
                      />
                    )}
                  </div>

                  <div className="va-eco-metrics cols-3">
                    <div className="va-eco-metric">
                      <span className="va-eco-metric-label">
                        <span className="va-dot-sm primary" />
                        Verified Donors
                      </span>
                      <strong>{supporterStats.verifiedBackers.toLocaleString('en-US')}</strong>
                      <span className="va-eco-metric-sub">Wallet / repeat</span>
                    </div>
                    <div className="va-eco-metric">
                      <span className="va-eco-metric-label">
                        <span className="va-dot-sm muted" />
                        Registered
                      </span>
                      <strong>{supporterStats.registeredBackers.toLocaleString('en-US')}</strong>
                      <span className="va-eco-metric-sub">Identified accounts</span>
                    </div>
                    <div className="va-eco-metric">
                      <span className="va-eco-metric-label">
                        <span className="va-dot-sm warn" />
                        Anonymous
                      </span>
                      <strong>{supporterStats.anonymousGifts.toLocaleString('en-US')}</strong>
                      <span className="va-eco-metric-sub">{kpis.anonymousSharePct || 0}% of tx</span>
                    </div>
                  </div>

                  <div className="va-eco-foot">
                    <span>{supporterStats.repeatBackers} repeat contributor{supporterStats.repeatBackers === 1 ? '' : 's'} across your operations</span>
                  </div>
                </div>
              )}

              {/* NGO -> Operations View */}
              {!isAdmin && cohortTab === 'operations' && (
                <div className="va-cohort-body va-fade-switch" key="ngo-ops">
                  <div className="va-eco-headline-row">
                    <div className="va-eco-headline">
                      <strong className="va-eco-total">{kpis.totalCampaigns || 0}</strong>
                      <span className="va-eco-unit">relief operations</span>
                    </div>
                    <span className={`va-delta-pill ${String(analytics?.meta?.verificationStatus).toLowerCase() === 'approved' ? 'pos' : 'neutral'}`}>
                      {analytics?.meta?.verificationStatus || 'Pending'}
                    </span>
                  </div>

                  <div className="va-eco-metrics cols-3">
                    <div className="va-eco-metric">
                      <span className="va-eco-metric-label">
                        <span className="va-dot-sm ok" />
                        Active Drives
                      </span>
                      <strong>{kpis.activeCampaigns || 0}</strong>
                      <span className="va-eco-metric-sub">Live fundraising</span>
                    </div>
                    <div className="va-eco-metric">
                      <span className="va-eco-metric-label">
                        <span className="va-dot-sm muted" />
                        Concluded
                      </span>
                      <strong>{kpis.concludedCampaigns || 0}</strong>
                      <span className="va-eco-metric-sub">Completed quotas</span>
                    </div>
                    <div className="va-eco-metric">
                      <span className="va-eco-metric-label">
                        <span className="va-dot-sm primary" />
                        Beneficiaries
                      </span>
                      <strong>{Number(kpis.totalBeneficiaries || 0).toLocaleString('en-US')}</strong>
                      <span className="va-eco-metric-sub">Documented reach</span>
                    </div>
                  </div>

                  <div className="va-eco-foot va-eco-foot-split">
                    <span>{kpis.pendingSlipsCount || 0} pending slips · {kpis.approvalRatePct || 0}% pass rate</span>
                    {onNavigateTab && (
                      <button type="button" className="va-card-action-link" onClick={() => onNavigateTab('ledger')}>
                        Open Ledger
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* RIGHT CARD: Unified Vercel Tabbed Breakdown Deck */}
            <section className="va-panel va-tabbed-panel">
              <div className="va-card-tabbar" role="tablist" aria-label="Analytical breakdowns">
                <div className="va-card-tabbar-left">
                  {isAdmin ? (
                    <>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={breakdownTab === 'causes'}
                        className={`va-card-tab ${breakdownTab === 'causes' ? 'active' : ''}`}
                        onClick={() => setBreakdownTab('causes')}
                      >
                        By Cause
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={breakdownTab === 'regions'}
                        className={`va-card-tab ${breakdownTab === 'regions' ? 'active' : ''}`}
                        onClick={() => setBreakdownTab('regions')}
                      >
                        PH Regions
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={breakdownTab === 'ngos'}
                        className={`va-card-tab ${breakdownTab === 'ngos' ? 'active' : ''}`}
                        onClick={() => setBreakdownTab('ngos')}
                      >
                        Top NGOs
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={breakdownTab === 'slips'}
                        className={`va-card-tab ${breakdownTab === 'slips' ? 'active' : ''}`}
                        onClick={() => setBreakdownTab('slips')}
                      >
                        Slip Audits
                      </button>
                      {activityBreakdown.length > 0 && (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={breakdownTab === 'audit'}
                          className={`va-card-tab ${breakdownTab === 'audit' ? 'active' : ''}`}
                          onClick={() => setBreakdownTab('audit')}
                        >
                          Audit Events
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={breakdownTab === 'goals'}
                        className={`va-card-tab ${breakdownTab === 'goals' ? 'active' : ''}`}
                        onClick={() => setBreakdownTab('goals')}
                      >
                        Campaign Goals
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={breakdownTab === 'causes'}
                        className={`va-card-tab ${breakdownTab === 'causes' ? 'active' : ''}`}
                        onClick={() => setBreakdownTab('causes')}
                      >
                        By Cause
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={breakdownTab === 'supporters'}
                        className={`va-card-tab ${breakdownTab === 'supporters' ? 'active' : ''}`}
                        onClick={() => setBreakdownTab('supporters')}
                      >
                        Top Supporters
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={breakdownTab === 'slips'}
                        className={`va-card-tab ${breakdownTab === 'slips' ? 'active' : ''}`}
                        onClick={() => setBreakdownTab('slips')}
                      >
                        Slip Audits
                      </button>
                    </>
                  )}
                </div>

                {onNavigateTab && (
                  <button
                    type="button"
                    className="va-card-action-link"
                    onClick={() => onNavigateTab(isAdmin ? 'approvals' : 'ledger')}
                  >
                    {isAdmin ? 'NGO Desk' : 'Open Ledger'}
                  </button>
                )}
              </div>

              <div className="va-panel-body va-fade-switch" key={breakdownTab}>
                {isAdmin && breakdownTab === 'causes' && (
                  <VercelBarChart
                    maxItems={5}
                    leftColLabel="Cause Category"
                    rightColLabel="Raised / Funded"
                    items={categoryBreakdown.map((c) => ({
                      key: c.key,
                      label: c.label,
                      sub: `${c.campaignCount} op${c.campaignCount === 1 ? '' : 's'} · Goal ₱${Number(c.targetPhp || 0).toLocaleString('en-US')}`,
                      value: c.raisedPhp,
                      badge: `${c.fundingPct}%`
                    }))}
                  />
                )}

                {isAdmin && breakdownTab === 'regions' && (
                  <VercelBarChart
                    maxItems={5}
                    leftColLabel="Philippine Region"
                    rightColLabel="Mobilized / Ops"
                    items={regionalBreakdown.map((r) => ({
                      key: r.region,
                      label: r.region,
                      sub: `${r.campaignCount} campaign${r.campaignCount === 1 ? '' : 's'} · ${r.fundingPct}% funded`,
                      value: r.raisedPhp,
                      badge: `${r.campaignCount} ops`
                    }))}
                  />
                )}

                {isAdmin && breakdownTab === 'ngos' && (
                  <VercelBarChart
                    maxItems={5}
                    leftColLabel="Accredited Organization"
                    rightColLabel="Raised / Funded"
                    items={topOrganizations.filter((o) => o.raisedPhp > 0 || o.campaignCount > 0).map((o) => ({
                      key: String(o.orgId),
                      label: o.orgName,
                      sub: `${o.status} · ${o.campaignCount} op${o.campaignCount === 1 ? '' : 's'}`,
                      value: o.raisedPhp,
                      badge: `${o.fundingPct}%`
                    }))}
                  />
                )}

                {breakdownTab === 'slips' && (
                  <VercelFunnelMeter funnel={verificationFunnel} />
                )}

                {isAdmin && breakdownTab === 'audit' && (
                  <VercelBarChart
                    maxItems={5}
                    leftColLabel="Audit Event Category"
                    rightColLabel="Events / Share"
                    items={activityBreakdown.map((act) => ({
                      key: act.category,
                      label: act.label,
                      value: act.count,
                      displayValue: act.count.toLocaleString('en-US'),
                      badge: `${act.sharePct}%`
                    }))}
                  />
                )}

                {!isAdmin && breakdownTab === 'goals' && (
                  <VercelBarChart
                    maxItems={5}
                    leftColLabel="Campaign"
                    rightColLabel="Raised / Goal"
                    items={[...allCampaigns]
                      .sort((a, b) => b.fundingPct - a.fundingPct)
                      .map((c) => ({
                        key: String(c.id),
                        label: c.title,
                        sub: `${c.region} · Target ₱${Number(c.targetPhp || 0).toLocaleString('en-US')}`,
                        value: c.raisedPhp,
                        forcePct: c.fundingPct,
                        displayValue: `₱${Number(c.raisedPhp || 0).toLocaleString('en-US')}`,
                        badge: `${c.fundingPct}%`
                      }))}
                  />
                )}

                {!isAdmin && breakdownTab === 'causes' && (
                  <VercelBarChart
                    maxItems={5}
                    leftColLabel="Cause Category"
                    rightColLabel="Raised / Goal"
                    items={categoryBreakdown.map((c) => ({
                      key: c.key,
                      label: c.label,
                      sub: `${c.campaignCount} op${c.campaignCount === 1 ? '' : 's'} · Goal ₱${Number(c.targetPhp || 0).toLocaleString('en-US')}`,
                      value: c.raisedPhp,
                      badge: `${c.fundingPct}%`
                    }))}
                  />
                )}

                {!isAdmin && breakdownTab === 'supporters' && (
                  <VercelBarChart
                    maxItems={5}
                    leftColLabel="Contributor"
                    rightColLabel="Total / Gifts"
                    emptyMessage="No confirmed contributors in this period yet."
                    items={topContributors.map((d, i) => ({
                      key: `${d.name}-${i}`,
                      label: d.name,
                      sub: `${d.count} gift${d.count === 1 ? '' : 's'} · ${d.eth} ETH`,
                      value: d.php,
                      badge: d.isAnonymous ? 'Anon' : `${d.count}×`
                    }))}
                  />
                )}
              </div>
            </section>
          </div>

          {/* ── Row 3: Actionable Flush Vercel Performance Matrix Table ── */}
          <section className="va-panel">
            <div className="va-panel-head va-table-head-bar">
              <div>
                <h3 className="va-section-heading">
                  {isAdmin ? 'Portfolio Performance Matrix' : 'Campaign Performance Matrix'}
                </h3>
                <p className="va-panel-sub">
                  Exported directly into formatted Excel (.xlsx), PDF, and CSV reports
                </p>
              </div>

              <div className="va-table-controls">
                <div className="va-segmented-mini" role="group" aria-label="Status filter">
                  {['ALL', 'ACTIVE', 'CLOSED'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`va-seg-mini-btn ${statusFilter === st ? 'active' : ''}`}
                      onClick={() => setStatusFilter(st)}
                    >
                      {st === 'ALL' ? 'All' : st === 'ACTIVE' ? 'Active' : 'Concluded'}
                    </button>
                  ))}
                </div>

                <div className="va-search-box">
                  <span className="material-symbols-outlined">search</span>
                  <input
                    type="text"
                    placeholder="Filter operations..."
                    value={campSearch}
                    onChange={(e) => setCampSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {campaigns.length === 0 ? (
              <div className="va-empty-state" style={{ minHeight: '130px' }}>
                <span>No campaign performance records match your filters.</span>
              </div>
            ) : (
              <div className="va-table-scroll">
                <table className="va-table">
                  <thead>
                    <tr>
                      <th>Operation</th>
                      {isAdmin && <th>Organization</th>}
                      <th>Cause &amp; Region</th>
                      <th className="num">Goal</th>
                      <th className="num">Raised</th>
                      <th className="num">Funded</th>
                      <th className="num">Disbursed</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div className="va-cell-primary" title={c.title}>{c.title}</div>
                          <div className="va-cell-sub">#{c.id} · {c.urgency}</div>
                        </td>
                        {isAdmin && <td className="va-cell-org">{c.orgName}</td>}
                        <td>
                          <div className="va-cell-cat">{c.categoryLabel}</div>
                          <div className="va-cell-sub">{c.region}</div>
                        </td>
                        <td className="num mono muted">₱{Number(c.targetPhp || 0).toLocaleString('en-US')}</td>
                        <td className="num mono strong">₱{Number(c.raisedPhp || 0).toLocaleString('en-US')}</td>
                        <td className="num">
                          <div className="va-inline-progress">
                            <div className="va-inline-track">
                              <div
                                className="va-inline-fill"
                                style={{ width: `${Math.min(100, Number(c.fundingPct || 0))}%` }}
                              />
                            </div>
                            <span className="mono">{c.fundingPct}%</span>
                          </div>
                        </td>
                        <td className="num mono muted">₱{Number(c.disbursedPhp || 0).toLocaleString('en-US')}</td>
                        <td>
                          <span className={`va-status-dot-label ${c.isActive ? 'active' : 'closed'}`}>
                            <span className="va-status-dot" />
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="va-table-footer">
              <span>
                Showing <strong>{campaigns.length}</strong> of {allCampaigns.length} operation{allCampaigns.length === 1 ? '' : 's'} · Filtered raised <strong>₱{filteredRaisedSum.toLocaleString('en-US')}</strong>
              </span>
              <button
                type="button"
                className="va-footer-export-btn"
                onClick={() => handleExport('xlsx')}
                disabled={!analytics}
              >
                Download Excel Workbook (.xlsx)
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
