import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
// All blockchain notarization is handled gaslessly by the backend Sepolia relayer.
import { ROLES, ROLE_META } from './roleConfig';
import LandingView from './views/LandingView';
import AuthView from './views/AuthView';
import DonorView from './views/DonorView';
import OrganizationView from './views/OrganizationView';
import AdminView from './views/AdminView';
import SettingsPanel from './components/SettingsPanel';
import Header from './components/Header';
import Footer from './components/Footer';
import NgoProfileModal from './components/NgoProfileModal';
import AccreditedNgosModal from './components/AccreditedNgosModal';
import DisbursementProofModal from './components/DisbursementProofModal';
import ErrorBoundary from './components/ErrorBoundary';
// import ReliefAiChat from './components/ReliefAiChat';
import GlobalBroadcastBanner from './components/GlobalBroadcastBanner';
import MaintenanceGuardModal from './components/MaintenanceGuardModal';
import PersonalizationOnboarding from './components/PersonalizationOnboarding';
import { useLivePresence } from './hooks/useLivePresence';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import { useToast } from './context/ToastContext';
import './App.css';
import { isLocalhost, API_URL, apiFetch } from './config';

export default function App() {
  /* ── Database Auth State (Synchronously hydrated from localStorage or JWT payload to prevent Landing flash on F5 refresh) ── */
  const [dbUser, setDbUser] = useState(() => {
    try {
      const token = localStorage.getItem('bbdrts_token');
      if (!token) return null;
      const cached = localStorage.getItem('bbdrts_user');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.role) return parsed;
      }
      // Fallback: synchronously decode JWT payload so even the very first refresh never flashes LandingView
      const parts = token.split('.');
      if (parts.length === 3) {
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(b64));
        if (payload && payload.role) {
          return {
            id: payload.id,
            email: payload.email || '',
            name: payload.name || payload.email || 'User',
            role: payload.role
          };
        }
      }
    } catch (_) {}
    return null;
  });
  // dbUser = { id, name, email, role }
  const [authLoading, setAuthLoading] = useState(() => {
    try {
      return !localStorage.getItem('bbdrts_token');
    } catch (_) {
      return true;
    }
  });

  // Always keep bbdrts_user synced in localStorage whenever dbUser updates
  useEffect(() => {
    try {
      if (dbUser && dbUser.role) {
        localStorage.setItem('bbdrts_user', JSON.stringify(dbUser));
      }
    } catch (_) {}
  }, [dbUser]);
  const [showAuth, setShowAuth] = useState(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const searchParams = new URLSearchParams(window.location.search);
      return (
        pathname.startsWith('/reset-password') ||
        searchParams.has('token') ||
        searchParams.has('resetToken') ||
        searchParams.get('action') === 'secure-account'
      );
    }
    return false;
  }); // Default to Landing Page, auto-open if reset/secure link!
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authRole, setAuthRole] = useState('donor'); // 'donor' | 'organization'
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [presenceEventHint, setPresenceEventHint] = useState(null);
  const [showAccreditedNgosModal, setShowAccreditedNgosModal] = useState(false);

  const [deepLinkProofCamp, setDeepLinkProofCamp] = useState(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const campParam = params.get('campaign');
    const proofParam = params.get('proof');
    if (campParam && proofParam && proofParam !== '0' && proofParam !== 'false') {
      const numericId = Number(campParam);
      if (numericId > 0) {
        return { id: numericId, Campaign_ID: numericId };
      }
    }
    return null;
  });

  useEffect(() => {
    if (!deepLinkProofCamp || typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('proof')) {
        url.searchParams.delete('proof');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      }
    } catch (_) {}
  }, [deepLinkProofCamp]);

  const [showOnboardingModal, setShowOnboardingModal] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('onboarding') === 'true' || params.get('preview') === 'onboarding';
    }
    return false;
  });

  const { showSuccess, showError, showInfo } = useToast();
  const emailActionHandledRef = useRef(false);

  // Handle email-change verification/cancellation links even when the user is already logged in
  useEffect(() => {
    if (!dbUser || emailActionHandledRef.current || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const token = params.get('token');
    if (!token || (action !== 'verify-email-change' && action !== 'cancel-email-change')) return;

    emailActionHandledRef.current = true;
    const isVerify = action === 'verify-email-change';
    const endpoint = isVerify ? '/api/auth/verify-email-change' : '/api/auth/cancel-email-change';

    showInfo(
      isVerify ? 'Verifying your new email address...' : 'Processing your account security request...',
      isVerify ? 'Verifying Email Change' : 'Account Security',
      3500
    );

    const authToken = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
    apiFetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
      },
      body: JSON.stringify({ token })
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          if (!isVerify && data.securityToken && data.originalEmail) {
            // Account reclaimed! Log out stale session & launch immediate password reset modal
            try {
              localStorage.removeItem('bbdrts_token');
              localStorage.removeItem('token');
              localStorage.removeItem('bbdrts_user');
              window.history.replaceState(
                {},
                '',
                `/?action=secure-account&email=${encodeURIComponent(data.originalEmail)}&token=${encodeURIComponent(data.securityToken)}`
              );
            } catch (_) {}
            setDbUser(null);
            setShowAuth(true);
            showSuccess(
              data.message || 'Account reclaimed! Please set a new password now.',
              'Account Reclaimed — Change Password Now',
              9000
            );
            return;
          }

          try {
            window.history.replaceState({}, '', window.location.pathname);
          } catch (_) {}

          const updatedEmail = isVerify ? data.newEmail : data.originalEmail;
          if (updatedEmail) {
            setDbUser((prev) => (prev ? { ...prev, email: updatedEmail, username: updatedEmail } : prev));
          }
          showSuccess(
            data.message || (isVerify ? 'Email address successfully updated!' : 'Account email change cancelled.'),
            isVerify ? 'Email Updated' : 'Security Request Complete',
            8000
          );
        } else {
          try {
            window.history.replaceState({}, '', window.location.pathname);
          } catch (_) {}
          showError(
            data.error || 'This verification link is invalid or has expired.',
            isVerify ? 'Email Verification Failed' : 'Security Action Failed',
            8000
          );
        }
      })
      .catch((err) => {
        showError(err.message || 'Network error while verifying email change.', 'Verification Error', 7000);
      });
  }, [dbUser, showSuccess, showError, showInfo]);

  // Real-Time Session Revocation Guard: auto-logout any device within seconds when its session is terminated remotely
  useEffect(() => {
    if (!dbUser) return;
    let active = true;

    const verifySessionAlive = async () => {
      if (!active || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      if (!token || token === 'direct_admin_access_token') return;
      try {
        const res = await fetch(`${API_URL}/api/auth/session-check`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 401) {
          const data = await res.json().catch(() => ({}));
          if (data.sessionRevoked && active) {
            localStorage.removeItem('bbdrts_token');
            localStorage.removeItem('token');
            localStorage.removeItem('bbdrts_user');
            setDbUser(null);
            setShowAuth(true);
            showError(
              'Your session was terminated on another device or by a security action. Please sign in again.',
              'Session Terminated',
              8000
            );
          }
        }
      } catch (_) {}
    };

    const intervalId = window.setInterval(verifySessionAlive, 8000);
    const onFocus = () => verifySessionAlive();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [dbUser?.id, showError]);

  // Listen for custom event to trigger onboarding preview prototype
  useEffect(() => {
    const handleOpenOnboarding = () => setShowOnboardingModal(true);
    window.addEventListener('bbdrts_open_onboarding', handleOpenOnboarding);
    return () => window.removeEventListener('bbdrts_open_onboarding', handleOpenOnboarding);
  }, []);



  /* ── Gasless Blockchain Audit Mode (No User Wallet Required) ── */

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
  const [fetchingCampaigns, setFetchingCampaigns] = useState(false);

  const DEFAULT_WORKSPACE_PREFS = {
    experienceMode: 'standard',
    themePreference: null, // null inherits publicTheme until user chooses their own
    language: 'en',
    textSize: 'normal',
    reducedMotion: false,
    highContrast: false,
    lowBandwidthMode: false
  };

  const normalizeTextSize = (rawSize) => {
    if (rawSize === 'comfortable') return 'normal';
    if (['compact', 'normal', 'large', 'extra-large'].includes(rawSize)) return rawSize;
    return 'normal';
  };

  const resolveSystemTheme = () => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  };

  const getUserPrefsKey = (u) => {
    if (!u) return null;
    const rolePart = u.role || 'donor';
    const idPart = u.id || u.email || 'anon';
    return `bbdrts_prefs_${rolePart}_${idPart}`;
  };

  const parsePrefsObj = (raw) => {
    if (!raw) return {};
    if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  };

  const sanitizeWorkspacePrefs = (rawObj = {}) => ({
    experienceMode: rawObj.experienceMode === 'simplified' ? 'simplified' : 'standard',
    themePreference: ['light', 'dark', 'system'].includes(rawObj.themePreference) ? rawObj.themePreference : null,
    language: ['en', 'fil', 'ceb'].includes(rawObj.language) ? rawObj.language : 'en',
    textSize: normalizeTextSize(rawObj.textSize),
    reducedMotion: Boolean(rawObj.reducedMotion),
    highContrast: Boolean(rawObj.highContrast),
    lowBandwidthMode: Boolean(rawObj.lowBandwidthMode)
  });

  const clearLegacyGlobalPrefKeys = () => {
    try {
      [
        'bbdrts_interface_mode',
        'bbdrts_text_size',
        'bbdrts_theme_mode',
        'bbdrts_theme',
        'bbdrts_language',
        'bbdrts_reduced_motion',
        'bbdrts_high_contrast',
        'bbdrts_low_bandwidth'
      ].forEach(k => localStorage.removeItem(k));
    } catch (_) {}
  };

  /* ── Public Theme (Landing & AuthView only — strictly isolated from per-user dashboard setup) ── */
  const [publicTheme, setPublicThemeState] = useState(() => {
    const saved = localStorage.getItem('bbdrts_public_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    const legacy = localStorage.getItem('bbdrts_theme');
    if (legacy === 'light' || legacy === 'dark') return legacy;
    return 'dark';
  });

  const [systemPrefTheme, setSystemPrefTheme] = useState(resolveSystemTheme);

  /* ── Per-User Dashboard Preferences (strictly scoped to the currently logged-in dbUser) ── */
  const [workspacePrefs, setWorkspacePrefs] = useState(() => ({ ...DEFAULT_WORKSPACE_PREFS }));
  const interfaceMode = workspacePrefs.experienceMode;
  const language = workspacePrefs.language;
  const textSize = workspacePrefs.textSize;
  const reducedMotion = workspacePrefs.reducedMotion;
  const highContrast = workspacePrefs.highContrast;
  const lowBandwidthMode = workspacePrefs.lowBandwidthMode;
  const themeMode = dbUser ? (workspacePrefs.themePreference || publicTheme) : publicTheme;
  const theme = dbUser
    ? (workspacePrefs.themePreference === 'system'
        ? systemPrefTheme
        : (workspacePrefs.themePreference === 'light' || workspacePrefs.themePreference === 'dark'
            ? workspacePrefs.themePreference
            : publicTheme))
    : publicTheme;

  /* ── Smooth Auth Transition (Live Network & Web3 Handshake Synchronization) ── */
  const [authTransition, setAuthTransition] = useState({
    active: false,
    closing: false,
    type: 'login', // 'login' | 'logout'
    stage: 1,      // 1, 2, 3, 4
    title: '',
    role: '',
    user: null,
    latencyMs: 42
  });

  // Dashboard customization ONLY applies when the signed-in user's dashboard itself is active (never AuthView, LandingView, Onboarding, or other users)
  const isDashboardViewActive = Boolean(dbUser && !showAuth && !authTransition.active && !showOnboardingModal);

  const runInstantThemeSwitch = (cb) => {
    const css = document.createElement('style');
    css.setAttribute('type', 'text/css');
    css.appendChild(
      document.createTextNode(
        `*, *::before, *::after {
          -webkit-transition: none !important;
          -moz-transition: none !important;
          -o-transition: none !important;
          -ms-transition: none !important;
          transition: none !important;
          animation-duration: 0s !important;
        }`
      )
    );
    document.head.appendChild(css);
    cb();
    if (document.body) {
      void document.body.offsetHeight;
    }
    window.setTimeout(() => {
      if (document.head.contains(css)) {
        document.head.removeChild(css);
      }
    }, 50);
  };

  const persistWorkspacePreferences = async (patchPrefs, targetUser = dbUser) => {
    if (!patchPrefs || typeof patchPrefs !== 'object') return;
    const key = getUserPrefsKey(targetUser);
    if (key) {
      try {
        const existingLocal = parsePrefsObj(localStorage.getItem(key));
        localStorage.setItem(key, JSON.stringify({ ...existingLocal, ...patchPrefs }));
      } catch (_) {}
    }
    const token = localStorage.getItem('bbdrts_token');
    if (!token || token === 'direct_admin_access_token') return;
    try {
      const res = await fetch(`${API_URL}/api/auth/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ preferences: patchPrefs })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.user) {
          setDbUser(prev => prev ? { ...prev, ...data.user, preferences: data.user.preferences } : data.user);
        }
      }
    } catch (err) {
      console.warn('Workspace preferences sync skipped:', err);
    }
  };

  const hydrateUserWorkspacePrefs = (targetUser, { isNewRegistration = false } = {}) => {
    clearLegacyGlobalPrefKeys();
    if (!targetUser) {
      setWorkspacePrefs({ ...DEFAULT_WORKSPACE_PREFS });
      return;
    }
    if (isNewRegistration) {
      const cleanNew = { ...DEFAULT_WORKSPACE_PREFS };
      setWorkspacePrefs(cleanNew);
      window.dispatchEvent(new CustomEvent('bbdrts_interface_mode_changed', { detail: { mode: cleanNew.experienceMode } }));
      return;
    }
    const key = getUserPrefsKey(targetUser);
    const localSaved = key ? parsePrefsObj(localStorage.getItem(key)) : {};
    const dbSaved = parsePrefsObj(targetUser.preferences);
    // DB Preferences_Json takes precedence over local user cache; missing keys default cleanly
    const resolved = sanitizeWorkspacePrefs({ ...localSaved, ...dbSaved });
    setWorkspacePrefs(resolved);
    if (key && Object.keys({ ...localSaved, ...dbSaved }).length > 0) {
      try {
        localStorage.setItem(key, JSON.stringify({ ...localSaved, ...dbSaved }));
      } catch (_) {}
    }
    window.dispatchEvent(new CustomEvent('bbdrts_interface_mode_changed', { detail: { mode: resolved.experienceMode } }));
  };

  const setInterfaceMode = (newMode) => {
    const val = newMode === 'simplified' ? 'simplified' : 'standard';
    if (!dbUser) return;
    setWorkspacePrefs(prev => ({ ...prev, experienceMode: val }));
    window.dispatchEvent(new CustomEvent('bbdrts_interface_mode_changed', { detail: { mode: val } }));
    persistWorkspacePreferences({ experienceMode: val });
  };

  const setTheme = (newTheme) => {
    const mode = ['light', 'dark', 'system'].includes(newTheme) ? newTheme : 'dark';
    runInstantThemeSwitch(() => {
      if (dbUser && !showAuth) {
        setWorkspacePrefs(prev => ({ ...prev, themePreference: mode }));
      } else {
        const resolvedPublic = mode === 'system' ? systemPrefTheme : mode;
        setPublicThemeState(resolvedPublic);
        localStorage.setItem('bbdrts_public_theme', resolvedPublic);
      }
    });
    if (dbUser && !showAuth) {
      persistWorkspacePreferences({ themePreference: mode });
    }
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  const setTextSize = (newSize) => {
    const val = normalizeTextSize(newSize);
    if (!dbUser) return;
    setWorkspacePrefs(prev => ({ ...prev, textSize: val }));
    persistWorkspacePreferences({ textSize: val });
  };

  const setLanguage = (newLang) => {
    const val = ['en', 'fil', 'ceb'].includes(newLang) ? newLang : 'en';
    if (!dbUser) return;
    setWorkspacePrefs(prev => ({ ...prev, language: val }));
    persistWorkspacePreferences({ language: val });
  };

  const setReducedMotion = (enabled) => {
    if (!dbUser) return;
    const val = Boolean(enabled);
    setWorkspacePrefs(prev => ({ ...prev, reducedMotion: val }));
    persistWorkspacePreferences({ reducedMotion: val });
  };

  const setHighContrast = (enabled) => {
    if (!dbUser) return;
    const val = Boolean(enabled);
    setWorkspacePrefs(prev => ({ ...prev, highContrast: val }));
    persistWorkspacePreferences({ highContrast: val });
  };

  const setLowBandwidthMode = (enabled) => {
    if (!dbUser) return;
    const val = Boolean(enabled);
    setWorkspacePrefs(prev => ({ ...prev, lowBandwidthMode: val }));
    persistWorkspacePreferences({ lowBandwidthMode: val });
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setSystemPrefTheme(mq.matches ? 'dark' : 'light');
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);

  // Strictly scope HTML document attributes so AuthView, LandingView, Onboarding, and logged-out state stay unaffected
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (isDashboardViewActive) {
      root.setAttribute('data-dashboard-active', 'true');
      root.setAttribute('data-text-size', textSize);
    } else {
      root.setAttribute('data-dashboard-active', 'false');
      root.setAttribute('data-text-size', 'normal');
    }
  }, [theme, isDashboardViewActive, textSize]);

  // Clear stale legacy unscoped keys once on initial mount
  useEffect(() => {
    clearLegacyGlobalPrefKeys();
  }, []);

  /* ── 1. Init Session ────────────────────────────────── */
  useEffect(() => {
    const token = localStorage.getItem('bbdrts_token');
    const failsafeTimer = setTimeout(() => {
      setAuthLoading(false);
    }, 800);

    if (token) {
      fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            const pendingOnboarding = localStorage.getItem('bbdrts_needs_onboarding') === 'true' && data.user.role !== 'admin';
            setDbUser(data.user);
            hydrateUserWorkspacePrefs(data.user, { isNewRegistration: pendingOnboarding });
            const userIsAnon = Boolean(data.user.is_anonymous);
            localStorage.setItem('bbdrts_anon_default', String(userIsAnon));
            if (data.user.id || data.user.email) {
              localStorage.setItem('bbdrts_anon_default_' + (data.user.id || data.user.email), String(userIsAnon));
            }
            // Gasless relayer active — no personal wallet required
            if (localStorage.getItem('bbdrts_needs_onboarding') === 'true' && data.user.role !== 'admin') {
              setShowOnboardingModal(true);
            }
          }
        })
        .catch(err => console.error('Session restore failed:', err))
        .finally(() => {
          clearTimeout(failsafeTimer);
          setAuthLoading(false);
        });
    } else {
      clearTimeout(failsafeTimer);
      setAuthLoading(false);
    }

    const handleLiveProfileUpdate = (e) => {
      if (e.detail) {
        setDbUser(e.detail);
      }
    };
    window.addEventListener('bbdrts_profile_updated', handleLiveProfileUpdate);
    return () => {
      window.removeEventListener('bbdrts_profile_updated', handleLiveProfileUpdate);
    };
  }, []);

  /* ── 1c. Scroll Position Guard (Prevent auto-scroll jumps on mount/state changes) ── */
  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const dbUserId = dbUser?.id ?? null;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [dbUserId]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [showAuth]);

  /* ── 1b. Synchronize Global Sidebar Layout (Lockstep Vercel Alignment) ── */
  useEffect(() => {
    if (dbUser) {
      document.body.classList.add('has-dashboard-sidebar');
      const isCollapsed = localStorage.getItem('bbdrts_sidebar_collapsed') === 'true';
      document.body.setAttribute('data-sidebar-collapsed', String(isCollapsed));
    } else {
      document.body.classList.remove('has-dashboard-sidebar');
      document.body.removeAttribute('data-sidebar-collapsed');
    }

    const handleSidebarChange = (e) => {
      const isCollapsed = Boolean(e.detail?.collapsed);
      document.body.setAttribute('data-sidebar-collapsed', String(isCollapsed));
    };

    // Universal Keyboard Shortcut to Collapse/Expand Sidebar ([ or Ctrl+\ or Alt+S or Alt+B or Ctrl+B)
    const handleGlobalSidebarKeyDown = (e) => {
      const target = e.target;
      const isInput = target && (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable || 
        target.closest('input, textarea, [contenteditable="true"]')
      );
      if (isInput) return;

      const isMod = e.ctrlKey || e.metaKey;
      const isBracket = e.key === '[' || e.code === 'BracketLeft';
      const isBackslash = (isMod && (e.key === '\\' || e.code === 'Backslash'));
      const isAltShortcut = e.altKey && (
        e.key === 's' || e.key === 'S' || e.code === 'KeyS' ||
        e.key === 'b' || e.key === 'B' || e.code === 'KeyB'
      );
      const isModShortcut = (
        (isMod && (e.key === 'b' || e.key === 'B' || e.code === 'KeyB')) ||
        (isMod && e.shiftKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS'))
      );

      if (isBracket || isBackslash || isAltShortcut || isModShortcut) {
        e.preventDefault();
        e.stopPropagation();

        // If NGO profile modal is active, toggle the modal's internal 2-column sidebar
        const hasNgoModal = Boolean(document.querySelector('.vercel-ngo-modal'));
        if (hasNgoModal) {
          window.dispatchEvent(new CustomEvent('bbdrts_toggle_modal_sidebar'));
        } else {
          window.dispatchEvent(new CustomEvent('bbdrts_toggle_sidebar'));
        }
      }
    };

    window.addEventListener('keydown', handleGlobalSidebarKeyDown);
    window.addEventListener('bbdrts_sidebar_changed', handleSidebarChange);
    return () => {
      window.removeEventListener('keydown', handleGlobalSidebarKeyDown);
      window.removeEventListener('bbdrts_sidebar_changed', handleSidebarChange);
    };
  }, [Boolean(dbUser)]);

  /* ── 2. Actions ─────────────────────────────────────── */

  const handleLoginSuccess = async (user, token, options = {}) => {
    const isNewSignup = Boolean(
      options?.isNewRegistration ||
      localStorage.getItem('bbdrts_needs_onboarding') === 'true'
    );
    setPresenceEventHint(isNewSignup ? 'account_created' : 'login');
    hydrateUserWorkspacePrefs(user, { isNewRegistration: isNewSignup });
    const assignedRole = user?.role || 'donor';
    const startPing = performance.now();

    // Stage 1: Validating Session Token
    setAuthTransition({
      active: true,
      closing: false,
      type: 'login',
      stage: 1,
      title: 'Signing you in...',
      subtitle: 'Validating cryptographic session token...',
      role: assignedRole,
      user,
      latencyMs: 32
    });

    try {
      const authToken = token || localStorage.getItem('bbdrts_token');

      // ── Stage 1: Session Token (~320ms) ──
      await Promise.race([
        Promise.all([
          authToken ? fetch(API_URL + '/api/auth/me', { headers: { 'Authorization': 'Bearer ' + authToken } }).catch(() => null) : Promise.resolve(),
          new Promise(r => setTimeout(r, 320))
        ]),
        new Promise(r => setTimeout(r, 550))
      ]);

      // ── Stage 2: Syncing Role Governance Permissions (~320ms) ──
      setAuthTransition(prev => ({
        ...prev,
        stage: 2,
        title: 'Signing you in...',
        subtitle: `Syncing ${assignedRole ? (assignedRole.charAt(0).toUpperCase() + assignedRole.slice(1)) : 'donor'} governance permissions...`
      }));
      const roleFetches = [];
      if (authToken) {
        if (assignedRole === 'organization') {
          roleFetches.push(fetch(API_URL + '/api/organization/kyc', { headers: { 'Authorization': 'Bearer ' + authToken } }).catch(() => null));
          roleFetches.push(fetch(API_URL + '/api/donations/me', { headers: { 'Authorization': 'Bearer ' + authToken } }).catch(() => null));
          roleFetches.push(fetch(API_URL + '/api/manual-donations/pending', { headers: { 'Authorization': 'Bearer ' + authToken } }).catch(() => null));
        } else if (assignedRole === 'admin') {
          roleFetches.push(fetch(API_URL + '/api/admin/organizations', { headers: { 'Authorization': 'Bearer ' + authToken } }).catch(() => null));
          roleFetches.push(fetch(API_URL + '/api/public-stats').catch(() => null));
        } else {
          roleFetches.push(fetch(API_URL + '/api/donations/me', { headers: { 'Authorization': 'Bearer ' + authToken } }).catch(() => null));
        }
      }

      await Promise.race([
        Promise.all([...roleFetches, new Promise(r => setTimeout(r, 320))]),
        new Promise(r => setTimeout(r, 600))
      ]);

      // ── Stage 3: Connecting Sepolia EVM & Campaigns (~320ms) ──
      setAuthTransition(prev => ({
        ...prev,
        stage: 3,
        title: 'Connecting Network...',
        subtitle: 'Connecting Sepolia EVM & campaign ledger...'
      }));
      const userIsAnon = Boolean(
        user?.is_anonymous ||
        (typeof user?.preferences === 'object' ? (user?.preferences?.is_anonymous || user?.preferences?.anonymous) : false)
      );
      localStorage.setItem('bbdrts_anon_default', String(userIsAnon));
      if (user?.id || user?.email) {
        localStorage.setItem('bbdrts_anon_default_' + (user.id || user.email), String(userIsAnon));
      }
      fetchCampaigns().catch(() => null);
      await new Promise(r => setTimeout(r, 320));

      // ── Stage 4: Mounting Dashboard Workspace (~320ms) ──
      setAuthTransition(prev => ({
        ...prev,
        stage: 4,
        title: 'Mounting Workspace...',
        subtitle: 'Initializing relief workspace telemetry...'
      }));
      setDbUser(user);
      setShowAuth(false);
      await new Promise(r => setTimeout(r, 320));

      // ── Stage 5: ALL CHECKED! Slight delay after check all (~700ms) ──
      const elapsedPing = Math.round(performance.now() - startPing);
      setAuthTransition(prev => ({
        ...prev,
        stage: 5,
        title: `Welcome, ${user?.name || user?.email || 'Authorized User'}!`,
        subtitle: 'Workspace ready · Access granted',
        latencyMs: Math.max(16, Math.min(elapsedPing, 60))
      }));

      // Explicit pause to let user see all 4 verified checks
      await new Promise(r => setTimeout(r, 700));

      // ── Smooth Exit ──
      setAuthTransition(prev => ({ ...prev, closing: true }));
      await new Promise(r => setTimeout(r, 260));

      setAuthTransition({
        active: false,
        closing: false,
        type: 'login',
        stage: 1,
        title: '',
        subtitle: '',
        role: '',
        user: null,
        latencyMs: 32
      });

      if (isNewSignup && user?.role !== 'admin') {
        setShowOnboardingModal(true);
      }

    } catch (err) {
      console.warn('Network sync notice during auth transition:', err);
      setDbUser(user);
      setShowAuth(false);
      setAuthTransition({
        active: false,
        closing: false,
        type: 'login',
        stage: 1,
        title: '',
        subtitle: '',
        role: '',
        user: null,
        latencyMs: 32
      });
      if (isNewSignup && user?.role !== 'admin') {
        setShowOnboardingModal(true);
      }
    }
  };

  const handleLogout = async () => {
    setShowSettingsModal(false);
    setPresenceEventHint('logout');

    setAuthTransition({
      active: true,
      closing: false,
      type: 'logout',
      stage: 1,
      title: 'Ending Session',
      subtitle: 'Closing authenticated session...',
      role: '',
      user: null,
      latencyMs: 24
    });

    try {
      // ── Stage 1: Closing active session (~280ms) ──
      await new Promise(r => setTimeout(r, 280));

      // ── Stage 2: Clearing credentials & session cache (~280ms) ──
      setAuthTransition(prev => ({
        ...prev,
        stage: 2,
        title: 'Ending Session...',
        subtitle: 'Purging credentials & session cache...'
      }));
      localStorage.removeItem('bbdrts_token');
      localStorage.removeItem('token');
      localStorage.removeItem('bbdrts_user');
      localStorage.removeItem('bbdrts_role');
      localStorage.removeItem('bbdrts_anon_default');
      localStorage.removeItem('bbdrts_needs_onboarding');
      localStorage.removeItem('bbdrts_is_new_registration');
      localStorage.removeItem('bbdrts_tour_force_launch');
      clearLegacyGlobalPrefKeys();
      setShowOnboardingModal(false);
      setWorkspacePrefs({ ...DEFAULT_WORKSPACE_PREFS });
      await new Promise(r => setTimeout(r, 280));

      // ── Stage 3: Resetting public workspace & unmounting dashboard (~300ms) ──
      setAuthTransition(prev => ({
        ...prev,
        stage: 3,
        title: 'Resetting Workspace...',
        subtitle: 'Resetting public portal & unmounting views...'
      }));
      setDbUser(null);
      setShowAuth(true);
      setAuthMode('login');
      fetchCampaigns(null).catch(() => null);
      await new Promise(r => setTimeout(r, 300));

      // ── Stage 4: Session Terminated / All Checked (~650ms delay) ──
      setAuthTransition(prev => ({
        ...prev,
        stage: 4,
        title: 'Session Terminated',
        subtitle: 'Credentials purged · Returning to portal'
      }));
      await new Promise(r => setTimeout(r, 650));

      // ── Smooth Exit ──
      setAuthTransition(prev => ({ ...prev, closing: true }));
      await new Promise(r => setTimeout(r, 240));

      setAuthTransition({
        active: false,
        closing: false,
        type: 'logout',
        stage: 1,
        title: '',
        subtitle: '',
        role: '',
        user: null,
        latencyMs: 24
      });

    } catch (err) {
      console.warn('Logout notice:', err);
      setDbUser(null);
      setShowAuth(true);
      setAuthTransition({
        active: false,
        closing: false,
        type: 'logout',
        stage: 1,
        title: '',
        subtitle: '',
        role: '',
        user: null,
        latencyMs: 24
      });
    }
  };

  /* ── 4. Fetch campaigns ──────────────────────────────── */
  const fetchCampaigns = useCallback(async (arg) => {
    const silent = Boolean(arg && typeof arg === 'object' && arg.silent === true);
    try {
      if (!silent) setFetchingCampaigns(true);
      let dbCampaigns = [];
      let fetchedOk = false;
      try {
        const res = await fetch(`${API_URL}/api/campaigns?_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          dbCampaigns = await res.json();
          fetchedOk = true;
        }
      } catch (e) {
        if (!silent) console.error('Offline DB Sync failed:', e);
      }

      // Merge client-side localStorage cached campaigns (only enrich existing DB campaigns)
      try {
        const localCreated = JSON.parse(localStorage.getItem('bbdrts_created_campaigns') || '[]');
        const validLocal = [];
        localCreated.forEach(lc => {
          const lcTitle = (lc.title || '').trim().toLowerCase();
          const dbIndex = dbCampaigns.findIndex(d => (d.title || '').trim().toLowerCase() === lcTitle);

          const enriched = {
            title: lc.title,
            targetAmount: lc.targetAmount || lc.target_amount,
            tags: lc.tags || lc.tags_json || lc.tagsJson,
            locationRegion: lc.locationRegion || lc.location_region,
            gpsCoordinates: lc.gpsCoordinates || lc.gps_coordinates,
            beneficiariesImpact: lc.beneficiariesImpact || lc.beneficiaries_impact,
            allocationsJson: lc.allocationsJson || lc.allocations_json,
            contactInfo: lc.contactInfo || lc.contact_info,
            description: lc.description,
            urgency: lc.urgency,
            targetDate: lc.targetDate || lc.target_date,
            createdAt: lc.createdAt || lc.created_at,
            documentUrl: lc.documentUrl || lc.document_url,
            orgName: lc.orgName || lc.org_name
          };

          if (dbIndex !== -1) {
            dbCampaigns[dbIndex] = {
              ...dbCampaigns[dbIndex],
              tags: dbCampaigns[dbIndex].tags || enriched.tags,
              locationRegion: dbCampaigns[dbIndex].locationRegion || enriched.locationRegion,
              gpsCoordinates: dbCampaigns[dbIndex].gpsCoordinates || enriched.gpsCoordinates,
              beneficiariesImpact: dbCampaigns[dbIndex].beneficiariesImpact || enriched.beneficiariesImpact,
              allocationsJson: dbCampaigns[dbIndex].allocationsJson || enriched.allocationsJson,
              contactInfo: dbCampaigns[dbIndex].contactInfo || enriched.contactInfo,
              description: dbCampaigns[dbIndex].description || enriched.description,
              urgency: dbCampaigns[dbIndex].urgency || enriched.urgency,
              targetDate: dbCampaigns[dbIndex].targetDate || enriched.targetDate,
              createdAt: dbCampaigns[dbIndex].createdAt || enriched.createdAt,
              documentUrl: dbCampaigns[dbIndex].documentUrl || enriched.documentUrl
            };
            validLocal.push(lc);
          }
        });
        localStorage.setItem('bbdrts_created_campaigns', JSON.stringify(validLocal));
      } catch (e) {
        console.warn('Failed to load local campaign cache:', e);
      }

      // Immediately display campaigns from DB without waiting for Sepolia RPC
      if (fetchedOk && Array.isArray(dbCampaigns)) {
        setCampaigns(dbCampaigns);
        try {
          localStorage.setItem('bbdrts_cached_campaigns_v2', JSON.stringify(dbCampaigns));
        } catch (_) {}
      }

      // Campaigns & PHP totals are served directly from the audited DB + gasless Sepolia relayer ledger.
    } catch (err) {
      if (!silent) console.error('Campaign sync error:', err);
    } finally {
      if (!silent) setFetchingCampaigns(false);
    }
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const token = localStorage.getItem('bbdrts_token');
    if (!token || token === 'direct_admin_access_token') return;
    try {
      const res = await fetch(`${API_URL}/api/auth/me?_t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.user) {
          setDbUser((prev) => {
            if (!prev) return prev;
            const nextJson = JSON.stringify(data.user);
            const prevJson = JSON.stringify(prev);
            return nextJson === prevJson ? prev : data.user;
          });
        }
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchCampaigns();
    const onDonationEvent = () => fetchCampaigns({ silent: true });
    window.addEventListener('bbdrts_donation_success', onDonationEvent);
    return () => window.removeEventListener('bbdrts_donation_success', onDonationEvent);
  }, [fetchCampaigns]);

  // Real-time live sync: immediately update campaigns across all dashboards on any backend mutation
  useRealtimeSync(
    ['campaigns', 'donations', 'manual_donations', 'disbursements', 'qr_codes'],
    () => fetchCampaigns({ silent: true }),
    { debounceMs: 220 }
  );

  // Real-time live sync: immediately refresh signed-in user status (e.g. NGO KYC approval, profile changes)
  useRealtimeSync(
    ['profile', 'organizations'],
    () => refreshCurrentUser(),
    { enabled: Boolean(dbUser), debounceMs: 350 }
  );



  const uiRole = dbUser?.role || ROLES.PUBLIC;
  const roleMeta = ROLE_META[uiRole];

  const [selectedNgoForProfile, setSelectedNgoForProfile] = useState(null);
  const [activeTabInfo, setActiveTabInfo] = useState({
    tab: 'dashboard',
    section: 'Dashboard Overview',
    meta: null
  });

  const handleActiveTabChange = useCallback((tab, meta = null) => {
    const nextTab = tab || 'dashboard';
    const nextSection = meta?.section || (typeof tab === 'string' ? tab : 'Dashboard Overview');
    setActiveTabInfo(prev => {
      if (prev.tab === nextTab && prev.section === nextSection) return prev;
      return {
        tab: nextTab,
        section: nextSection,
        meta
      };
    });
  }, []);

  // ── Real-Time Active User / Guest Presence Tracking ──
  const presenceView = showOnboardingModal
    ? 'Workspace Setup'
    : !dbUser
      ? (showAuth ? 'Authentication Portal' : 'Public Landing Page')
      : (uiRole === ROLES.ADMIN
          ? 'Admin Governance Console'
          : uiRole === ROLES.ORGANIZATION
            ? 'NGO Operations Portal'
            : 'Donor Portal');

  const presenceSubpage = showOnboardingModal
    ? 'Personalization Onboarding'
    : showSettingsModal
      ? 'Account Profile & Security Settings'
      : selectedNgoForProfile
        ? 'Verified NGO Profile'
        : !dbUser
          ? (showAuth
              ? (authMode === 'register'
                  ? `Creating Account (${authRole === 'organization' ? 'NGO' : 'Donor'})`
                  : 'Portal Sign In')
              : 'Public Overview & Campaigns')
          : (activeTabInfo?.section || activeTabInfo?.tab || 'Dashboard Overview');

  useLivePresence({
    dbUser,
    currentView: presenceView,
    currentSubpage: presenceSubpage,
    eventHint: presenceEventHint,
    onEventHintConsumed: useCallback(() => setPresenceEventHint(null), [])
  });

  const sharedProps = {
    role: uiRole,
    campaigns,
    fetchCampaigns,
    fetchingCampaigns,
    currentUser: dbUser,
    handleLogout,
    theme,
    themeMode,
    setTheme,
    textSize,
    setTextSize,
    interfaceMode,
    setInterfaceMode,
    language,
    setLanguage,
    reducedMotion,
    setReducedMotion,
    highContrast,
    setHighContrast,
    lowBandwidthMode,
    setLowBandwidthMode,
    onOpenNgoProfile: (id) => setSelectedNgoForProfile(id || 3),
    onActiveTabChange: handleActiveTabChange
  };

  return (
    <div className="app" data-theme={theme}>

      {/* ── Global Broadcast Announcement Banner (High Priority Alerts) ── */}
      {!(!dbUser && showAuth) && (
        <GlobalBroadcastBanner userRole={dbUser?.role || 'donor'} />
      )}

      {/* ── System Maintenance Guard (Full Platform or Route Interceptor) ── */}
      <MaintenanceGuardModal
        userRole={uiRole}
        activeView={
          !dbUser
            ? (showAuth ? 'auth' : 'landing')
            : (uiRole === ROLES.ADMIN ? 'admin' : uiRole === ROLES.ORGANIZATION ? 'ngo' : 'donor')
        }
        dbUser={dbUser}
      />

      {/* ── Modern Institutional Header with Live Network Status & Profile Hub ── */}
      {!(!dbUser && showAuth) && (
        <Header
          dbUser={dbUser}
          handleLogout={handleLogout}
          showAuth={showAuth}
          setShowAuth={setShowAuth}
          authMode={authMode}
          setAuthMode={setAuthMode}
          setShowSettingsModal={setShowSettingsModal}
          theme={theme}
          toggleTheme={toggleTheme}
          onOpenNgoProfile={(id) => setSelectedNgoForProfile(id || 3)}
        />
      )}

      <ErrorBoundary>
        {/* ── Unauthenticated Views: Default Landing Page vs Auth Portal ── */}
        {!dbUser && !showAuth && (
          <LandingView
            onConnect={(targetRole, targetMode) => {
              if (targetRole) setAuthRole(targetRole);
              setAuthMode(targetMode || 'login');
              setShowAuth(true);
            }}
            onSignIn={(targetRole) => {
              if (targetRole) setAuthRole(targetRole);
              setAuthMode('login');
              setShowAuth(true);
            }}
            onSignUp={(targetRole) => {
              if (targetRole) setAuthRole(targetRole);
              setAuthMode('register');
              setShowAuth(true);
            }}
            onOpenNgoProfile={(id) => setSelectedNgoForProfile(id || 3)}
            onOpenNgoDirectory={() => setShowAccreditedNgosModal(true)}
            theme={theme}
          />
        )}

        {!dbUser && showAuth && (
          <AuthView
            onLoginSuccess={handleLoginSuccess}
            onBack={() => setShowAuth(false)}
            theme={theme}
            onToggleTheme={toggleTheme}
            initialMode={authMode}
            initialRole={authRole}
          />
        )}

        {/* ── Role-based Dashboards (Gasless On-Chain Audit Enabled) ── */}
        {dbUser && (
          <div
            className="dashboard-enter-reveal"
            data-dashboard-role={uiRole}
            data-interface-mode={interfaceMode}
            data-text-size={textSize}
            data-reduced-motion={String(reducedMotion)}
            data-high-contrast={String(highContrast)}
            data-low-bandwidth={String(lowBandwidthMode)}
            data-language={language}
            lang={language}
          >
            {uiRole === ROLES.ADMIN && <AdminView {...sharedProps} />}
            {uiRole === ROLES.ORGANIZATION && <OrganizationView {...sharedProps} />}
            {uiRole === ROLES.DONOR && <DonorView {...sharedProps} />}
          </div>
        )}
      </ErrorBoundary>

      {/* ── Account Settings Modal Overlay ── */}
      {showSettingsModal && typeof document !== 'undefined' && createPortal(
        <div className="bbdrts-settings-modal-overlay">
          <div
            className="bbdrts-settings-modal-dialog"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowSettingsModal(false)}
              className="bbdrts-settings-modal-close-btn"
              aria-label="Close settings"
            >
              ×
            </button>
            <SettingsPanel
              currentUser={dbUser}
              handleLogout={handleLogout}
              theme={theme}
              themeMode={themeMode}
              setTheme={setTheme}
              textSize={textSize}
              setTextSize={setTextSize}
              interfaceMode={interfaceMode}
              setInterfaceMode={setInterfaceMode}
              language={language}
              setLanguage={setLanguage}
              reducedMotion={reducedMotion}
              setReducedMotion={setReducedMotion}
              highContrast={highContrast}
              setHighContrast={setHighContrast}
              lowBandwidthMode={lowBandwidthMode}
              setLowBandwidthMode={setLowBandwidthMode}
              onProfileUpdated={(updated) => setDbUser(updated)}
            />
          </div>
        </div>,
        document.body
      )}

          {/* ── Vercel Geist Protocol Handshake Transition Overlay ── */}
      {authTransition.active && (
        <div 
          className={`auth-transition-backdrop ${authTransition.closing ? 'closing' : ''}`} 
          data-theme={theme}
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-transition-title"
        >
          <div className="auth-transition-card">
            {/* Top Hairline Progress Stream */}
            <div className="auth-transition-progress-stream">
              <div
                className={`auth-transition-progress-fill ${authTransition.stage >= (authTransition.type === 'logout' ? 4 : 5) ? 'done' : 'running'}`}
                style={{
                  width: authTransition.stage >= (authTransition.type === 'logout' ? 4 : 5)
                    ? '100%'
                    : authTransition.type === 'logout'
                      ? `${Math.min(Math.round((authTransition.stage / 3) * 100), 90)}%`
                      : `${Math.min(Math.round((authTransition.stage / 4) * 100), 90)}%`
                }}
              />
            </div>

            <div className="auth-transition-inner">
              {/* Header: Clean Logo Badge + BBDRTS + Status Pill */}
              <div className="auth-transition-header">
                <div className="auth-brand-lockup">
                  <div className="auth-handshake-emblem">
                    <img src="/logo.png" alt="BBDRTS" className="auth-handshake-logo-img" />
                  </div>
                  <span className="auth-brand-name">BBDRTS</span>
                </div>

                <div className={`auth-status-chip ${authTransition.stage >= (authTransition.type === 'logout' ? 4 : 5) ? 'ready' : authTransition.type === 'logout' ? 'logout' : 'active'}`}>
                  <span className="auth-chip-pulse" />
                  <span className="auth-chip-label">
                    {authTransition.stage >= (authTransition.type === 'logout' ? 4 : 5)
                      ? (authTransition.type === 'logout' ? 'CLOSED' : 'READY')
                      : authTransition.type === 'logout'
                        ? 'DISCONNECTING'
                        : 'AUTHENTICATING'}
                  </span>
                </div>
              </div>

              {/* Main Visual & Info */}
              <div className="auth-transition-main-content">
                <div className="auth-transition-avatar-box">
                  {authTransition.stage >= (authTransition.type === 'logout' ? 4 : 5) ? (
                    <div className="auth-transition-icon-circle is-ready">
                      <span className="material-symbols-outlined">
                        {authTransition.type === 'logout' ? 'lock' : 'check'}
                      </span>
                    </div>
                  ) : authTransition.type === 'logout' ? (
                    <div className="auth-transition-icon-circle logout">
                      <span className="material-symbols-outlined">logout</span>
                    </div>
                  ) : authTransition.user?.avatar_url ? (
                    <img src={authTransition.user.avatar_url} alt="Profile" className="auth-transition-user-avatar" />
                  ) : (
                    <div className="auth-transition-icon-circle login">
                      <span className="material-symbols-outlined">
                        {authTransition.role === 'organization'
                          ? 'corporate_fare'
                          : authTransition.role === 'admin'
                            ? 'shield_person'
                            : 'volunteer_activism'}
                      </span>
                    </div>
                  )}
                  {authTransition.stage < (authTransition.type === 'logout' ? 4 : 5) && (
                    <div className={`auth-transition-spinner-ring ${authTransition.type === 'logout' ? 'logout' : ''}`} />
                  )}
                </div>

                <div className="auth-transition-copy">
                  <h3 className="auth-transition-title" id="auth-transition-title">
                    {authTransition.title}
                  </h3>
                  <p className="auth-transition-subtitle">
                    {authTransition.subtitle}
                  </p>
                </div>
              </div>

              {/* Minimalist Telemetry Footer */}
              <div className="auth-transition-footer">
                <div className="auth-transition-assurance">
                  <span className="material-symbols-outlined footer-icon">lock</span>
                  <span>
                    {authTransition.type === 'logout'
                      ? 'Securely zeroizing session storage'
                      : 'Sepolia EVM · Cryptographic Ledger'}
                  </span>
                </div>
                <div className="auth-transition-latency">
                  <span className="auth-latency-dot" />
                  <span>{authTransition.latencyMs || 28}ms</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

            {/* ── Accredited Humanitarian NGOs Directory Modal ── */}
      {showAccreditedNgosModal && (
        <AccreditedNgosModal
          isOpen={showAccreditedNgosModal}
          onClose={() => setShowAccreditedNgosModal(false)}
          onSelectNgo={(id) => {
            setShowAccreditedNgosModal(false);
            if (id) setSelectedNgoForProfile(id);
          }}
          theme={theme}
        />
      )}

      {/* ── Verified Institutional NGO Social Profile Modal ── */}
      {selectedNgoForProfile && (
        <NgoProfileModal
          orgId={selectedNgoForProfile}
          onClose={() => setSelectedNgoForProfile(null)}
          onOpenDirectory={() => {
            setSelectedNgoForProfile(null);
            setShowAccreditedNgosModal(true);
          }}
          theme={theme}
        />
      )}

      {/* ── "ReliefAI" Humanitarian Relief Copilot Floating Assistant (Module C) — Temporarily commented out ──
      <ReliefAiChat
        currentUser={dbUser}
        userRole={dbUser?.role || 'donor'}
        campaigns={campaigns}
        activeView={
          !dbUser
            ? (showAuth ? 'Authentication Portal' : 'Public Landing Page')
            : (uiRole === ROLES.ADMIN ? 'Admin Governance Console' : uiRole === ROLES.ORGANIZATION ? 'NGO Operations Portal' : 'Donor Portal')
        }
        activeSubpage={
          showSettingsModal
            ? 'Account Profile & Security Settings Modal'
            : selectedNgoForProfile
              ? 'Verified Institutional NGO Profile Modal'
              : !dbUser
                ? (showAuth ? 'Authentication Portal' : 'Public Landing Page')
                : (activeTabInfo?.section || activeTabInfo?.tab || 'Dashboard Overview')
        }
        activeTabMeta={activeTabInfo?.meta}
      />

      */}

      {/* ── Post-Signup BBDRTS Workspace Setup & Personalization ── */}
      {showOnboardingModal && (
        <PersonalizationOnboarding
          isOpen={showOnboardingModal}
          onClose={async () => {
            localStorage.removeItem('bbdrts_needs_onboarding');
            setShowOnboardingModal(false);
            if (dbUser) {
              await persistWorkspacePreferences({
                onboardingCompleted: true,
                onboardingSkipped: true,
                onboardingCompletedAt: new Date().toISOString()
              });
            }
            window.dispatchEvent(new CustomEvent('bbdrts_onboarding_finished', { detail: { skipped: true } }));
          }}
          onComplete={async (selectedPrefs) => {
            if (!dbUser) {
              // Preview mode only: do NOT mutate AuthView/LandingView or future users
              setShowOnboardingModal(false);
              return;
            }
            const normalizedSize = normalizeTextSize(selectedPrefs?.textSize);
            const fullPrefs = {
              experienceMode: selectedPrefs?.experienceMode === 'simplified' ? 'simplified' : 'standard',
              themePreference: ['light', 'dark', 'system'].includes(selectedPrefs?.themePreference) ? selectedPrefs.themePreference : themeMode,
              language: ['en', 'fil', 'ceb'].includes(selectedPrefs?.language) ? selectedPrefs.language : language,
              textSize: normalizedSize,
              reducedMotion: Boolean(selectedPrefs?.reducedMotion),
              highContrast: Boolean(selectedPrefs?.highContrast),
              lowBandwidthMode: Boolean(selectedPrefs?.lowBandwidthMode),
              onboardingCompleted: true,
              onboardingCompletedAt: new Date().toISOString()
            };

            setWorkspacePrefs(sanitizeWorkspacePrefs(fullPrefs));
            window.dispatchEvent(new CustomEvent('bbdrts_interface_mode_changed', { detail: { mode: fullPrefs.experienceMode } }));
            await persistWorkspacePreferences(fullPrefs, dbUser);

            localStorage.removeItem('bbdrts_needs_onboarding');
            setShowOnboardingModal(false);
            window.dispatchEvent(new CustomEvent('bbdrts_onboarding_finished', { detail: { completed: true, preferences: fullPrefs } }));
          }}
          user={dbUser || { name: 'Preview User', email: 'preview@bbdrts.org', role: 'donor' }}
          initialTheme={dbUser ? themeMode : publicTheme}
          initialMode={dbUser ? interfaceMode : 'standard'}
          campaigns={campaigns}
        />
      )}

      {/* ── Email Deep-Link Verified Relief Proof Modal (?campaign=ID&proof=1) ── */}
      {deepLinkProofCamp && (
        <DisbursementProofModal
          camp={deepLinkProofCamp}
          isOpen={Boolean(deepLinkProofCamp)}
          onClose={() => setDeepLinkProofCamp(null)}
          theme={theme}
        />
      )}

      {/* ── Modern Institutional 4-Column Mega Footer ── */}
      {!(!dbUser && showAuth) && (
        <Footer onNavigate={() => { }} theme={theme} toggleTheme={toggleTheme} />
      )}

    </div>
  );
}