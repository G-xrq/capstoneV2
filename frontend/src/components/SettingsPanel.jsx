import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import './SettingsPanel.css';
import { ROLES, ROLE_META } from '../roleConfig';
import { contractAddress } from '../contractConfig';
import { shortAddr } from './CampaignCard';
import { useToast } from '../context/ToastContext';
import EditProfileModal from './EditProfileModal';
import DonorBadge, { getDonorTier } from './DonorBadge';
import { formatPhoneNumber } from '../utils/formatters';
import NgoProfileModal from './NgoProfileModal';
import { autoCropQrScreenshot, extractQrVoucherText } from '../utils/qrCropper';
import OtpPinBoxes from './OtpPinBoxes';
import { getWorkspaceStrings } from '../data/workspaceTranslations';

import { API_URL } from '../config';
import { notifyLocalMutation } from '../utils/realtimeSync';

export default function SettingsPanel({
  pageTitle,
  contract,
  currentUser,
  walletAddress,
  handleConnectWallet,
  handleLogout,
  updateDbWallet,
  theme,
  themeMode,
  setTheme,
  textSize,
  setTextSize,
  interfaceMode = 'standard',
  setInterfaceMode,
  language = 'en',
  setLanguage,
  reducedMotion = false,
  setReducedMotion,
  highContrast = false,
  setHighContrast,
  lowBandwidthMode = false,
  setLowBandwidthMode,
  onProfileUpdated,
  totalDonatedEth = 0,
  totalDonatedPhp = 0,
  onOpenHonorsLadder,
  onStartTour
}) {
  const { showSuccess, showError } = useToast();
  const wt = getWorkspaceStrings(language);
  const activeThemeChoice = themeMode || theme || 'dark';
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'qr_library' | 'wallet' | 'preferences' | 'security'

  // ── Reusable NGO Payment QR Code Library Studio State ──
  const [savedQrList, setSavedQrList] = useState([]);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrFilter, setQrFilter] = useState('ALL'); // 'ALL' | 'GCash' | 'Maya' | 'Bank'
  const [showAddQrModal, setShowAddQrModal] = useState(false);
  const [previewQrModal, setPreviewQrModal] = useState(null); // QR object to view full size
  const [newQrMethod, setNewQrMethod] = useState('GCash');
  const [newQrName, setNewQrName] = useState('');
  const [newQrAccountName, setNewQrAccountName] = useState('');
  const [newQrAccountNumber, setNewQrAccountNumber] = useState('');
  const [newQrImage, setNewQrImage] = useState('');
  const [newQrIsDefault, setNewQrIsDefault] = useState(true);
  const [isCroppingQr, setIsCroppingQr] = useState(false);
  const [isOcrExtracting, setIsOcrExtracting] = useState(false);
  const [cropFeedback, setCropFeedback] = useState('');
  const [isApplyingQrToCamps, setIsApplyingQrToCamps] = useState(false);
  const [manualWallet, setManualWallet] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);

  // NGO Profile Inputs & Live Preview Studio State
  const [previewNgoModalOpen, setPreviewNgoModalOpen] = useState(false);
  const [selectedNgoId, setSelectedNgoId] = useState(8);
  const [showNgoInputs, setShowNgoInputs] = useState(false);

  const [ngoMission, setNgoMission] = useState('');
  const [ngoLocation, setNgoLocation] = useState('');
  const [ngoLandmark, setNgoLandmark] = useState('');
  const [ngoFocusAreas, setNgoFocusAreas] = useState('');
  const [ngoHotline, setNgoHotline] = useState('');
  const [ngoPhone, setNgoPhone] = useState('');
  const [ngoWebsite, setNgoWebsite] = useState('');
  const [ngoSocialLink, setNgoSocialLink] = useState('');
  const [ngoBannerUrl, setNgoBannerUrl] = useState('');
  const [ngoAvatarUrl, setNgoAvatarUrl] = useState('');
  const [ngoLeadOfficer, setNgoLeadOfficer] = useState('');
  const [savingNgoProfile, setSavingNgoProfile] = useState(false);

  // Sync initial values from currentUser / NGO preferences
  useEffect(() => {
    if (currentUser) {
      const prefs = (() => {
        if (!currentUser?.preferences) return {};
        try {
          return typeof currentUser.preferences === 'string' ? JSON.parse(currentUser.preferences) : currentUser.preferences;
        } catch (_) {
          return {};
        }
      })();

      const isUserOrg = currentUser?.role === ROLES.ORGANIZATION || currentUser?.role === 'organization';

      if (isUserOrg) {
        setNgoMission(currentUser.bio || prefs.missionStatement || '');
        setNgoLocation(currentUser.location || '');
        setNgoLandmark(prefs.hqLandmark || '');
        setNgoFocusAreas(prefs.focusAreas || '');
        setNgoHotline(currentUser.emergency_hotline || prefs.emergencyHotline || '');
        setNgoPhone(currentUser.phone || currentUser.mobile_number || '');
        setNgoWebsite(currentUser.website || prefs.website || '');
        setNgoSocialLink(prefs.socialLink || '');
        setNgoBannerUrl(currentUser.banner_url || prefs.banner_url || '');
        setNgoAvatarUrl(currentUser.avatar_url || '');
        setNgoLeadOfficer(prefs.leadOfficer || '');
      } else {
        // Fetch default Philippine Red Cross profile so donor/tester can preview & edit
        fetch(`${API_URL}/api/public/organizations/8`)
          .then(res => res.json())
          .then(data => {
            if (data && !data.error) {
              setNgoMission(data.bio || data.preferences?.missionStatement || '');
              setNgoLocation(data.location || '');
              setNgoLandmark(data.hqLandmark || data.preferences?.hqLandmark || '');
              setNgoFocusAreas(data.focusAreas || data.preferences?.focusAreas || '');
              setNgoHotline(data.emergency_hotline || data.preferences?.emergencyHotline || '');
              setNgoPhone(data.mobileNumber || '');
              setNgoWebsite(data.website || data.preferences?.website || '');
              setNgoSocialLink(data.socialLink || data.preferences?.socialLink || '');
              setNgoBannerUrl(data.banner_url || '');
              setNgoAvatarUrl(data.avatar_url || '');
              setNgoLeadOfficer(data.leadOfficer || data.preferences?.leadOfficer || '');
            }
          })
          .catch(() => {});
      }
    }
  }, [currentUser]);

  // Handler to persist NGO profile inputs to database
  const handleSaveNgoProfile = async (targetId = (currentUser?.role === 'organization' ? currentUser?.id : 8)) => {
    setSavingNgoProfile(true);
    try {
      const token = localStorage.getItem('token');
      const prefsPayload = {
        focusAreas: ngoFocusAreas,
        hqLandmark: ngoLandmark,
        socialLink: ngoSocialLink,
        missionStatement: ngoMission,
        emergencyHotline: ngoHotline,
        website: ngoWebsite,
        leadOfficer: ngoLeadOfficer
      };

      const res = await fetch(`${API_URL}/api/auth/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          role: 'organization',
          location: ngoLocation,
          bio: ngoMission,
          website: ngoWebsite,
          emergency_hotline: ngoHotline,
          phone: ngoPhone,
          banner_url: ngoBannerUrl,
          avatar_url: ngoAvatarUrl,
          preferences: JSON.stringify(prefsPayload)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update organization profile.');

      showSuccess('Organization profile updated! Changes are now published live to your profile.', 'Profile Published');
      if (onProfileUpdated && (currentUser?.role === 'organization' || currentUser?.role === ROLES.ORGANIZATION)) {
        onProfileUpdated(data.user);
      }
    } catch (err) {
      showError(err.message || 'Failed to update organization profile.', 'Save Error');
    } finally {
      setSavingNgoProfile(false);
    }
  };



  // Helper to format registration date
  function formatMemberSince(dateVal) {
    if (!dateVal) return 'November 2026';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return 'November 2026';
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch (_) {
      return 'November 2026';
    }
  }

  // Preferences state
  const [emailNotify, setEmailNotify] = useState(() => {
    try { return localStorage.getItem('bbdrts_email_receipts') !== 'false'; } catch (_) { return true; }
  });
  const [calamityAlerts, setCalamityAlerts] = useState(() => {
    try { return localStorage.getItem('bbdrts_calamity_alerts') !== 'false'; } catch (_) { return true; }
  });
  const [glassFx, setGlassFx] = useState(() => {
    try { return localStorage.getItem('bbdrts_glass_fx') !== 'false'; } catch (_) { return true; }
  });

  // Anonymous default preference
  const getIsAnonymousFromUser = (user) => {
    if (!user) return false;
    if (user.is_anonymous !== undefined) return Boolean(user.is_anonymous);
    if (user.preferences) {
      try {
        const p = typeof user.preferences === 'string' ? JSON.parse(user.preferences) : user.preferences;
        if (p?.is_anonymous !== undefined) return Boolean(p.is_anonymous);
        if (p?.anonymous !== undefined) return Boolean(p.anonymous);
      } catch (_) {}
    }
    if (typeof window !== 'undefined') {
      const userKey = `bbdrts_anon_default_${user.id || user.email}`;
      const userScoped = localStorage.getItem(userKey);
      if (userScoped !== null) return userScoped === 'true';
    }
    return false;
  };

  const getShowBadgeFromUser = (user) => {
    if (!user) return true;
    if (user.show_badge !== undefined) return Boolean(user.show_badge);
    if (user.hide_badge !== undefined) return !user.hide_badge;
    if (user.preferences) {
      try {
        const p = typeof user.preferences === 'string' ? JSON.parse(user.preferences) : user.preferences;
        if (p?.show_badge !== undefined) return Boolean(p.show_badge);
        if (p?.hide_badge !== undefined) return !p.hide_badge;
      } catch (_) {}
    }
    if (typeof window !== 'undefined') {
      const userKey = `bbdrts_show_badge_${user.id || user.email}`;
      const userScoped = localStorage.getItem(userKey);
      if (userScoped !== null) return userScoped === 'true';
    }
    return true;
  };

  const [anonDefault, setAnonDefault] = useState(() => getIsAnonymousFromUser(currentUser));
  const [showBadge, setShowBadge] = useState(() => getShowBadgeFromUser(currentUser));

  useEffect(() => {
    const isAnon = getIsAnonymousFromUser(currentUser);
    setAnonDefault(isAnon);
    const badgeVis = getShowBadgeFromUser(currentUser);
    setShowBadge(badgeVis);
  }, [currentUser?.id, currentUser?.is_anonymous, currentUser?.show_badge, currentUser?.hide_badge, currentUser?.preferences]);

  const handleToggleAnonymous = async () => {
    const nextVal = !anonDefault;
    setAnonDefault(nextVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bbdrts_anon_default', String(nextVal));
      if (currentUser?.id || currentUser?.email) {
        localStorage.setItem(`bbdrts_anon_default_${currentUser.id || currentUser.email}`, String(nextVal));
      }
    }

    if (currentUser) {
      let currentPrefs = {};
      try {
        currentPrefs = typeof currentUser.preferences === 'string'
          ? JSON.parse(currentUser.preferences)
          : (currentUser.preferences || {});
      } catch (_) {}

      const updatedPrefs = { ...currentPrefs, is_anonymous: nextVal, anonymous: nextVal };
      const updatedUser = { ...currentUser, is_anonymous: nextVal, preferences: updatedPrefs };

      if (onProfileUpdated) onProfileUpdated(updatedUser);

      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      if (token) {
        try {
          await fetch(`${API_URL}/api/auth/profile`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ preferences: updatedPrefs, is_anonymous: nextVal })
          });
        } catch (err) {
          console.warn('Failed to sync anonymity preference:', err);
        }
      }
    }

    showSuccess(
      nextVal
        ? 'Anonymous Donor Mode active. Your identity will be hidden on public donation walls.'
        : 'Public Donor Profile active. Your name will appear on verified donation receipts.',
      nextVal ? 'Anonymous Mode Enabled' : 'Public Profile Enabled'
    );
  };

  const handleToggleBadgeVisibility = async () => {
    const nextVal = !showBadge;
    setShowBadge(nextVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bbdrts_show_badge', String(nextVal));
      if (currentUser?.id || currentUser?.email) {
        localStorage.setItem(`bbdrts_show_badge_${currentUser.id || currentUser.email}`, String(nextVal));
      }
    }

    if (currentUser) {
      let currentPrefs = {};
      try {
        currentPrefs = typeof currentUser.preferences === 'string'
          ? JSON.parse(currentUser.preferences)
          : (currentUser.preferences || {});
      } catch (_) {}

      const updatedPrefs = { ...currentPrefs, show_badge: nextVal, hide_badge: !nextVal };
      const updatedUser = { ...currentUser, show_badge: nextVal, hide_badge: !nextVal, preferences: updatedPrefs };

      if (onProfileUpdated) onProfileUpdated(updatedUser);

      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      if (token) {
        try {
          await fetch(`${API_URL}/api/auth/profile`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ preferences: updatedPrefs, show_badge: nextVal })
          });
        } catch (err) {
          console.warn('Failed to sync badge visibility:', err);
        }
      }
    }

    showSuccess(
      nextVal
        ? 'Recognition Badge is visible next to your name on public relief records.'
        : 'Recognition Badge hidden. Your name remains visible without the badge medal.',
      nextVal ? 'Badge Visible' : 'Badge Hidden'
    );
  };

  // Sync preference toggle to backend & storage
  const handleTogglePreference = async (key, val, successMessage) => {
    try {
      localStorage.setItem(`bbdrts_${key}`, String(val));
    } catch (_) {}

    let currentPrefs = {};
    try {
      currentPrefs = typeof currentUser?.preferences === 'string'
        ? JSON.parse(currentUser.preferences)
        : (currentUser?.preferences || {});
    } catch (_) {}

    const updatedPrefs = { ...currentPrefs, [key]: val };
    const updatedUser = { ...currentUser, preferences: updatedPrefs };
    if (onProfileUpdated) onProfileUpdated(updatedUser);

    const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
    if (token) {
      try {
        await fetch(`${API_URL}/api/auth/profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ preferences: updatedPrefs })
        });
      } catch (err) {
        console.warn('Failed to sync preference:', err);
      }
    }
    showSuccess(successMessage);
  };

  // Typography Scale Options
  const TEXT_SIZE_OPTIONS = [
    { id: 'compact', name: 'Compact', scale: '90%', icon: 'density_small', desc: 'Higher density for large tables and records.' },
    { id: 'normal', name: 'Standard', scale: '100%', icon: 'density_medium', desc: 'Balanced hierarchy for everyday usage.' },
    { id: 'large', name: 'Large', scale: '110%', icon: 'density_large', desc: 'Enhanced size for relaxed reading comfort.' },
    { id: 'extra-large', name: 'Extra Large', scale: '120%', icon: 'zoom_in', desc: 'Maximum accessibility and visibility.' }
  ];

  const activeTextSize = textSize || 'normal';

  const handleSelectTextSize = (sizeId) => {
    if (setTextSize) {
      setTextSize(sizeId);
    }
    const match = TEXT_SIZE_OPTIONS.find(o => o.id === sizeId);
    showSuccess(`Interface text size set to ${match?.name || sizeId} (${match?.scale || '100%'}).`, 'Text Size Updated');
  };

  // Password Change State & Handler
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newPasswordFocused, setNewPasswordFocused] = useState(false);

  // Password Strength Evaluator (Exact 1:1 match with AuthView Sign Up)
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: 'None', color: '#64748b', percent: 0 };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 1;
    if (/\d/.test(pwd)) score += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) score += 1;

    switch (score) {
      case 1:
        return { score: 1, label: 'Weak', color: '#ef4444', percent: 25 };
      case 2:
        return { score: 2, label: 'Fair', color: '#f59e0b', percent: 50 };
      case 3:
        return { score: 3, label: 'Good', color: '#38bdf8', percent: 75 };
      case 4:
        return { score: 4, label: 'Strong', color: '#22c55e', percent: 100 };
      default:
        return { score: 0, label: 'Weak', color: '#ef4444', percent: 15 };
    }
  };

  const newPwdStrength = getPasswordStrength(newPassword);
  const newPasswordRequirements = useMemo(() => [
    { id: 'length', label: '8+ chars', full: 'At least 8 characters', met: newPassword.length >= 8 },
    { id: 'uppercase', label: 'A–Z', full: 'At least 1 uppercase letter', met: /[A-Z]/.test(newPassword) },
    { id: 'lowercase', label: 'a–z', full: 'At least 1 lowercase letter', met: /[a-z]/.test(newPassword) },
    { id: 'number', label: '0–9', full: 'At least 1 number', met: /\d/.test(newPassword) },
    { id: 'symbol', label: 'Symbol', full: 'At least 1 special symbol (@$!%*?)', met: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword) }
  ], [newPassword]);
  const newPwdMetCount = useMemo(() => newPasswordRequirements.filter(r => r.met).length, [newPasswordRequirements]);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleChangePassword = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!currentPassword) {
      showError('Please enter your current password.', 'Validation Error');
      return;
    }
    if (newPwdMetCount < 5) {
      showError('New password must meet all 5 requirements (8+ chars, uppercase, lowercase, number, and special symbol).', 'Password Requirements');
      return;
    }
    if (newPassword !== confirmPassword) {
      showError('New passwords do not match.', 'Password Mismatch');
      return;
    }

    setSavingPassword(true);
    try {
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      if (!token) {
        showError('Session expired. Please log in again.', 'Unauthorized');
        setSavingPassword(false);
        return;
      }

      if (tfaStatus.enabled && passwordTfaCode.trim().length < 6) {
        showError('Please enter your 6-digit authenticator code to change your password.', '2FA Required');
        setSavingPassword(false);
        return;
      }

      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          ...(tfaStatus.enabled ? { twoFactorCode: passwordTfaCode.trim() } : {})
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password.');

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordTfaCode('');
      showSuccess('Your password has been securely updated.', 'Password Updated');
    } catch (err) {
      showError(err.message || 'Failed to update password.', 'Error');
    } finally {
      setSavingPassword(false);
    }
  };

  // ── Account Security (2FA, Active Sessions, Email Change) State & Handlers ──
  const [tfaStatus, setTfaStatus] = useState({ enabled: false, remainingBackupCodes: 0, totalBackupCodes: 0 });
  const [tfaLoading, setTfaLoading] = useState(false);
  const [showTfaSetupModal, setShowTfaSetupModal] = useState(false);
  const [tfaWizardStep, setTfaWizardStep] = useState(1); // 1 = Scan QR, 2 = Backup Codes, 3 = Confirm 6-Digit
  const [showTfaDisableModal, setShowTfaDisableModal] = useState(false);
  const [tfaSetupData, setTfaSetupData] = useState(null); // { secret, otpauth, qrCode, recoveryCodes }
  const [tfaVerificationCode, setTfaVerificationCode] = useState('');
  const [tfaDisablePassword, setTfaDisablePassword] = useState('');
  const [tfaDisableCode, setTfaDisableCode] = useState('');
  const [tfaSubmitting, setTfaSubmitting] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Active Sessions State
  const [activeSessions, setActiveSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState(null);
  const [revokingAllOthers, setRevokingAllOthers] = useState(false);

  // Email Change State
  const [showEmailChangeModal, setShowEmailChangeModal] = useState(false);
  const [passwordTfaCode, setPasswordTfaCode] = useState('');
  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailChangePassword, setEmailChangePassword] = useState('');
  const [emailChangeTfaCode, setEmailChangeTfaCode] = useState('');
  const [emailChangeSubmitting, setEmailChangeSubmitting] = useState(false);
  const [emailChangeSuccess, setEmailChangeSuccess] = useState(false);

  // Account Deletion State & Handlers
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteWizardStep, setDeleteWizardStep] = useState(1); // 1 = Warning & Terms, 2 = Identity & Confirmation Phrase
  const [deleteConfirmationPhrase, setDeleteConfirmationPhrase] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [delete2faCode, setDelete2faCode] = useState('');
  const [deleteReason, setDeleteReason] = useState('Personal reasons / switching email');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [cancellingDeletion, setCancellingDeletion] = useState(false);

  // Lock background scrolling while any security modal is open to ensure fixed screen positioning
  useEffect(() => {
    const isAnyModalOpen = Boolean(
      showTfaSetupModal ||
      showTfaDisableModal ||
      showEmailChangeModal ||
      showDeleteAccountModal ||
      showAddQrModal ||
      previewQrModal
    );
    if (isAnyModalOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [showTfaSetupModal, showTfaDisableModal, showEmailChangeModal, showDeleteAccountModal, showAddQrModal, previewQrModal]);

  const loadSecurityData = async () => {
    const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
    if (!token) return;

    // Load 2FA status
    try {
      setTfaLoading(true);
      const res = await fetch(`${API_URL}/api/auth/2fa/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTfaStatus(data);
      }
    } catch (_) {}
    finally {
      setTfaLoading(false);
    }

    // Load Active Sessions
    try {
      setSessionsLoading(true);
      const res = await fetch(`${API_URL}/api/auth/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveSessions(data.sessions || []);
      }
    } catch (_) {}
    finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
    if (!token) return;
    fetch(`${API_URL}/api/auth/2fa/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) setTfaStatus(data);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (activeTab === 'security') {
      loadSecurityData();
    }
  }, [activeTab]);

  const handleStartTfaSetup = async () => {
    const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
    try {
      setTfaSubmitting(true);
      const res = await fetch(`${API_URL}/api/auth/2fa/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate 2FA credentials');
      setTfaSetupData(data);
      setTfaVerificationCode('');
      setCopiedCodes(false);
      setCopiedSecret(false);
      setTfaWizardStep(1);
      setShowTfaSetupModal(true);
    } catch (err) {
      showError(err.message, '2FA Error');
    } finally {
      setTfaSubmitting(false);
    }
  };

  const handleRequestAccountDeletion = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (deleteConfirmationPhrase.trim() !== 'DELETE MY ACCOUNT') {
      showError('Please type "DELETE MY ACCOUNT" exactly to confirm.', 'Confirmation Required');
      return;
    }
    if (!deletePassword) {
      showError('Please enter your account password to verify identity.', 'Password Required');
      return;
    }
    if (tfaStatus.enabled && (!delete2faCode || delete2faCode.length !== 6)) {
      showError('Please enter your 6-digit authenticator code.', '2FA Code Required');
      return;
    }

    const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
    try {
      setDeleteSubmitting(true);
      const res = await fetch(`${API_URL}/api/auth/request-account-deletion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          confirmationPhrase: deleteConfirmationPhrase.trim(),
          password: deletePassword,
          twoFactorCode: delete2faCode.trim() || undefined,
          reason: deleteReason
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to schedule account deletion');

      showSuccess(data.message || 'Account deletion scheduled with 30-day grace period.', 'Deletion Scheduled');
      setShowDeleteAccountModal(false);
      setDeleteConfirmationPhrase('');
      setDeletePassword('');
      setDelete2faCode('');
      setDeleteWizardStep(1);

      if (onProfileUpdated) {
        onProfileUpdated({
          ...currentUser,
          deletion_scheduled_at: data.deletionScheduledAt,
          deletion_effective_at: data.deletionEffectiveAt,
          deletion_reason: deleteReason
        });
      }
    } catch (err) {
      showError(err.message, 'Deletion Error');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleCancelAccountDeletion = async () => {
    const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
    try {
      setCancellingDeletion(true);
      const res = await fetch(`${API_URL}/api/auth/cancel-account-deletion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel account deletion');

      showSuccess(data.message || 'Account restored successfully!', 'Account Restored');
      if (onProfileUpdated) {
        onProfileUpdated({
          ...currentUser,
          deletion_scheduled_at: null,
          deletion_effective_at: null,
          deletion_reason: null
        });
      }
    } catch (err) {
      showError(err.message, 'Cancel Error');
    } finally {
      setCancellingDeletion(false);
    }
  };

  const handleConfirmEnableTfa = async (e, directCode = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanCode = (typeof directCode === 'string' ? directCode : tfaVerificationCode).replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      showError('Please enter the complete 6-digit code from your authenticator app.', 'Invalid Code');
      return;
    }
    const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
    try {
      setTfaSubmitting(true);
      const res = await fetch(`${API_URL}/api/auth/2fa/enable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          secret: tfaSetupData.secret,
          code: cleanCode,
          recoveryCodes: tfaSetupData.recoveryCodes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to enable 2FA');
      showSuccess(data.message || 'Two-Factor Authentication enabled successfully!', '2FA Active');
      setShowTfaSetupModal(false);
      loadSecurityData();
      if (onProfileUpdated) onProfileUpdated({ ...currentUser, two_factor_enabled: true });
    } catch (err) {
      showError(err.message, 'Verification Failed');
    } finally {
      setTfaSubmitting(false);
    }
  };

  const handleConfirmDisableTfa = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!tfaDisablePassword) {
      showError('Please enter your current password to confirm.', 'Password Required');
      return;
    }
    const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
    try {
      setTfaSubmitting(true);
      const res = await fetch(`${API_URL}/api/auth/2fa/disable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          password: tfaDisablePassword,
          code: tfaDisableCode.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disable 2FA');
      showSuccess(data.message || 'Two-Factor Authentication disabled.', 'Security Updated');
      setShowTfaDisableModal(false);
      setTfaDisablePassword('');
      setTfaDisableCode('');
      loadSecurityData();
      if (onProfileUpdated) onProfileUpdated({ ...currentUser, two_factor_enabled: false });
    } catch (err) {
      showError(err.message, 'Failed to Disable');
    } finally {
      setTfaSubmitting(false);
    }
  };

  const handleRevokeSession = async (sessionId) => {
    const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
    try {
      setRevokingSessionId(sessionId);
      const res = await fetch(`${API_URL}/api/auth/sessions/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to terminate session');
      showSuccess('Session terminated successfully.', 'Session Revoked');
      setActiveSessions(prev => prev.filter(s => s.sessionId !== sessionId));
    } catch (err) {
      showError(err.message, 'Revoke Failed');
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleRevokeAllOtherSessions = async () => {
    const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
    try {
      setRevokingAllOthers(true);
      const cleanEmail = (currentUser?.email || '').trim().toLowerCase();
      const normRole = String(currentUser?.role || 'donor').toLowerCase();
      const currentTrustedDeviceToken =
        localStorage.getItem(`bbdrts_trusted_device_${normRole}_${cleanEmail}`) ||
        localStorage.getItem(`bbdrts_trusted_device_${cleanEmail}`) ||
        null;

      const res = await fetch(`${API_URL}/api/auth/sessions/revoke-all-others`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentTrustedDeviceToken })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to log out other sessions');
      showSuccess('All other sessions have been logged out and their 30-day trusted device status was reset.', 'Sessions & Device Trust Cleared');
      setActiveSessions(prev => prev.filter(s => s.isCurrent));
    } catch (err) {
      showError(err.message, 'Action Failed');
    } finally {
      setRevokingAllOthers(false);
    }
  };

  const handleRequestEmailChange = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newEmailInput || !emailChangePassword) {
      showError('Please enter both your new email and current password.', 'Validation Error');
      return;
    }
    if (newEmailInput.trim().toLowerCase() === (currentUser?.email || '').trim().toLowerCase()) {
      showError('The new email address cannot be the same as your current email address.', 'Invalid Email');
      return;
    }
    const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
    try {
      setEmailChangeSubmitting(true);
      if (tfaStatus.enabled && emailChangeTfaCode.trim().length < 6) {
        showError('Please enter your 6-digit authenticator code to change your email address.', '2FA Required');
        setEmailChangeSubmitting(false);
        return;
      }

      const res = await fetch(`${API_URL}/api/auth/request-email-change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          newEmail: newEmailInput.trim(),
          currentPassword: emailChangePassword,
          ...(tfaStatus.enabled ? { twoFactorCode: emailChangeTfaCode.trim() } : {})
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initiate email change');
      setEmailChangeSuccess(true);
      showSuccess(data.message || 'Verification link sent to ' + newEmailInput, 'Verification Sent');
    } catch (err) {
      showError(err.message, 'Email Change Error');
    } finally {
      setEmailChangeSubmitting(false);
    }
  };


  // ── Reusable NGO Payment QR Code Management Functions ──
  const fetchSavedQrCodes = async () => {
    try {
      setQrLoading(true);
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      const targetOrgId = (currentUser?.role === 'organization' || currentUser?.role === ROLES.ORGANIZATION)
        ? (currentUser?.id || 8)
        : 8;
      const res = await fetch(`${API_URL}/api/organization/qr-codes?org_id=${targetOrgId}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (res.ok) {
        const data = await res.json();
        setSavedQrList(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Failed to fetch saved QR codes in Settings:', err);
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchSavedQrCodes();
    }
  }, [currentUser?.id, currentUser?.role]);

  const handleNewQrFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showWarning('Please upload a valid image file (PNG, JPG, WebP).', 'Invalid File');
      return;
    }

    setIsCroppingQr(true);
    setCropFeedback('Analyzing screenshot & auto-cropping QR voucher matrix...');
    showSuccess('Analyzing screenshot & auto-cropping QR matrix...', 'Processing Image');

    try {
      const cropResult = await autoCropQrScreenshot(file);
      const { croppedUrl, wasCropped } = cropResult;
      setNewQrImage(croppedUrl);

      setIsOcrExtracting(true);
      setCropFeedback('Extracting recipient details from QR...');
      try {
        const { detectedName, detectedNumber, isMaskedNumber } = await extractQrVoucherText(cropResult);
        if (detectedName) setNewQrAccountName(detectedName);
        if (detectedNumber && (!isMaskedNumber || !newQrAccountNumber)) {
          setNewQrAccountNumber(isMaskedNumber ? detectedNumber : formatPhoneNumber(detectedNumber));
        }

        if (detectedName) {
          setCropFeedback(`Pure QR code extracted & recipient detected: ${detectedName}`);
          showSuccess(`Pure QR extracted · Recipient detected: ${detectedName}`, 'Smart QR Processed');
        } else if (wasCropped) {
          setCropFeedback('Pure QR code extracted cleanly.');
          showSuccess('Pure QR code extracted cleanly!', 'Smart QR Cropped');
        } else {
          setCropFeedback('QR code image attached.');
        }
      } catch (_) {
        setCropFeedback('QR code image attached.');
      } finally {
        setIsOcrExtracting(false);
      }

      if (!newQrName) {
        setNewQrName(`${newQrMethod} Relief Receiving Card`);
      }
    } catch (err) {
      console.warn('Crop error:', err);
      const reader = new FileReader();
      reader.onload = (uploadEvt) => setNewQrImage(uploadEvt.target.result);
      reader.readAsDataURL(file);
    } finally {
      setIsCroppingQr(false);
    }
  };

  const handleSaveNewQrToLibrary = async (e) => {
    if (e) e.preventDefault();
    if (!newQrName || !newQrName.trim()) {
      showWarning('Please provide a name for this QR code (e.g. "Primary Disaster Relief GCash").', 'Name Required');
      return;
    }
    if (!newQrImage) {
      showWarning('Please upload a QR code image or voucher screenshot.', 'Image Required');
      return;
    }

    try {
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      const targetOrgId = (currentUser?.role === 'organization' || currentUser?.role === ROLES.ORGANIZATION)
        ? (currentUser?.id || 8)
        : 8;
      const res = await fetch(`${API_URL}/api/organization/qr-codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          org_id: targetOrgId,
          custom_name: newQrName.trim(),
          payment_method: newQrMethod,
          account_name: newQrAccountName.trim(),
          account_number: newQrAccountNumber.trim(),
          qr_image_url: newQrImage,
          is_default: newQrIsDefault ? 1 : 0
        })
      });

      const data = await res.json();
      if (!res.ok) {
        showError(data.error || 'Failed to save QR code to library.', 'Save Failed');
        return;
      }

      showSuccess(data.message || `QR Code "${newQrName}" added to reusable library!`, 'QR Code Saved');
      setShowAddQrModal(false);
      setNewQrName('');
      setNewQrAccountName('');
      setNewQrAccountNumber('');
      setNewQrImage('');
      setCropFeedback('');
      fetchSavedQrCodes();
      if (newQrIsDefault && typeof onProfileUpdated === 'function') {
        onProfileUpdated();
      }
    } catch (err) {
      showError(err.message, 'Save Error');
    }
  };

  const handleToggleDefaultQr = async (qr) => {
    try {
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      const targetOrgId = (currentUser?.role === 'organization' || currentUser?.role === ROLES.ORGANIZATION)
        ? (currentUser?.id || 8)
        : 8;
      const res = await fetch(`${API_URL}/api/organization/qr-codes/${qr.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          org_id: targetOrgId,
          is_default: 1,
          payment_method: qr.payment_method
        })
      });
      if (res.ok) {
        showSuccess(`"${qr.custom_name}" is now the active default ${qr.payment_method} payout channel!`, 'Default Assigned');
        fetchSavedQrCodes();
        notifyLocalMutation(['campaigns', 'organizations']);
        if (typeof onProfileUpdated === 'function') {
          onProfileUpdated();
        }
      }
    } catch (err) {
      showError(err.message, 'Update Failed');
    }
  };

  const handleDeleteQrFromLibrary = async (qrId, customName, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${customName}" from your reusable library?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      const targetOrgId = (currentUser?.role === 'organization' || currentUser?.role === ROLES.ORGANIZATION)
        ? (currentUser?.id || 8)
        : 8;
      const res = await fetch(`${API_URL}/api/organization/qr-codes/${qrId}?org_id=${targetOrgId}`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (res.ok) {
        showSuccess(`QR Code "${customName}" removed from library.`, 'Deleted');
        fetchSavedQrCodes();
      }
    } catch (err) {
      showError(err.message, 'Delete Failed');
    }
  };

  const handleMassApplyQrDefaults = async (mode = 'replace_all', specificQr = null) => {
    if (mode === 'replace_all') {
      const label = specificQr
        ? `Replace the ${specificQr.payment_method} QR code on ALL of your campaigns with "${specificQr.custom_name}"?`
        : 'Replace the QR codes on ALL of your existing campaigns with your active default QR codes?';
      if (!window.confirm(label)) return;
    }
    try {
      setIsApplyingQrToCamps(true);
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      const targetOrgId = (currentUser?.role === 'organization' || currentUser?.role === ROLES.ORGANIZATION)
        ? (currentUser?.id || 8)
        : 8;
      const payload = {
        org_id: targetOrgId,
        mode,
        ...(specificQr ? { qr_id: specificQr.id, payment_method: specificQr.payment_method } : {})
      };
      const res = await fetch(`${API_URL}/api/organization/qr-codes/apply-to-campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess(
          data.message || (mode === 'replace_all' ? 'Replaced QR codes across all campaigns!' : 'Applied defaults to campaigns with missing QR codes!'),
          mode === 'replace_all' ? 'Mass Replace Complete' : 'Mass Apply Complete'
        );
        notifyLocalMutation(['campaigns', 'organizations']);
        if (typeof onProfileUpdated === 'function') {
          onProfileUpdated();
        }
      } else {
        showError(data.error || 'Failed to update campaign QR codes.', 'Error');
      }
    } catch (err) {
      showError(err.message, 'Mass Replace Failed');
    } finally {
      setIsApplyingQrToCamps(false);
    }
  };

  if (!currentUser) return null;

  const roleMeta = ROLE_META[currentUser.role] || ROLE_META[ROLES.PUBLIC];
  const isOrg = currentUser?.role === ROLES.ORGANIZATION || currentUser?.role === 'organization';
  const isAdmin = currentUser?.role === ROLES.ADMIN || currentUser?.role === 'admin';

  let displayName = isOrg
    ? (currentUser?.org_name || currentUser?.organization_name || currentUser?.name || 'Relief Organization')
    : (currentUser?.display_name || currentUser?.name || currentUser?.legal_name || currentUser?.email || 'Valued Donor');
  if (isOrg) {
    if (currentUser?.email?.toLowerCase().includes('relieflink') || displayName.toLowerCase().includes('relieflink')) {
      displayName = 'ReliefLink PH';
    } else if (currentUser?.email?.toLowerCase().includes('redcross') || displayName.toLowerCase().includes('redcross') || displayName.toLowerCase().includes('red cross')) {
      displayName = 'Philippine Red Cross';
    } else if (currentUser?.email?.toLowerCase().includes('ccs') || displayName.toLowerCase().includes('ccs')) {
      displayName = 'College of Computer Studies (CCS)';
    }
  } else {
    if (displayName.includes('@')) {
      const handle = displayName.split('@')[0];
      if (handle.toLowerCase() === 'gestermacaldo') {
        displayName = 'Gester Macaldo';
      } else {
        displayName = handle.charAt(0).toUpperCase() + handle.slice(1);
      }
    }
  }

  const userInitials = displayName ? displayName.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'US';
  const systemId = currentUser?.system_id || `BBDRTS-${isOrg ? 'NGO' : isAdmin ? 'ADMIN' : 'DONOR'}-2026-${String(currentUser?.id || 1).padStart(5, '0')}`;

  const userPrefs = (() => {
    if (!currentUser?.preferences) return {};
    try {
      return typeof currentUser.preferences === 'string' ? JSON.parse(currentUser.preferences) : (currentUser.preferences || {});
    } catch (_) {
      return {};
    }
  })();

  const donorTierInfo = (!isOrg && !isAdmin) ? getDonorTier(totalDonatedEth, totalDonatedPhp) : null;

  const optionalFields = !isOrg
    ? [
        { key: 'occupation', label: 'Occupation', value: userPrefs.occupation || '' },
        { key: 'causes', label: 'Preferred Causes', value: userPrefs.preferredCauses || '' },
        { key: 'website', label: 'Website', value: userPrefs.website || currentUser?.website || '', isLink: true },
        { key: 'social', label: 'Social Profile', value: userPrefs.socialLink || '' },
        { key: 'emergency', label: 'Emergency Contact', value: userPrefs.emergencyContact || '' },
      ]
    : [
        { key: 'website', label: 'Official Website', value: ngoWebsite || userPrefs.website || currentUser?.website || '', isLink: true },
        { key: 'social', label: 'Social Media', value: ngoSocialLink || userPrefs.socialLink || '' },
        { key: 'focus', label: 'Disaster Focus', value: ngoFocusAreas || userPrefs.focusAreas || '' },
        { key: 'landmark', label: 'HQ Landmark', value: ngoLandmark || userPrefs.hqLandmark || '' },
        { key: 'mission', label: 'Mission Statement', value: ngoMission || userPrefs.missionStatement || '' },
      ];
  const filledOptionalFields = optionalFields.filter((f) => Boolean(String(f.value || '').trim()));
  const emptyOptionalFields = optionalFields.filter((f) => !String(f.value || '').trim());

  const handleCopySystemId = () => {
    try {
      navigator.clipboard.writeText(systemId);
      showSuccess('Account ID copied to clipboard.', 'Copied');
    } catch (_) {}
  };

  const handleCopyContract = () => {
    try {
      navigator.clipboard.writeText(contractAddress);
      showSuccess('Public audit contract address copied.', 'Copied');
    } catch (_) {}
  };

  return (
    <div className="bbdrts-settings-root">

      {/* ── Header Bar (Exact .admin-page-header Alignment Across All Portal Pages) ── */}
      <div className="admin-page-header" style={{ marginBottom: 0 }}>
        <div className="admin-page-title-wrap">
          <h2 className="admin-page-title">
            <span className="material-symbols-outlined icon" style={{ color: 'var(--text-primary)' }}>settings</span>
            <span>{pageTitle || 'Profile & Settings'}</span>
          </h2>
          <p className="admin-page-sub">
            Manage your profile identity, workspace preferences, account security, and blockchain audit ledger.
          </p>
        </div>

        <div className="admin-page-header-actions">
          <button
            type="button"
            className="vs-primary-btn"
            onClick={() => setEditModalOpen(true)}
            title="Edit your display name, contact information, location, bio, and avatar"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>edit</span>
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* ── Vercel Horizontal Underline Navigation Tabs ── */}
      <nav className="vs-tabs" role="tablist" aria-label="Settings sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'profile'}
          className={`vs-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <span>Profile</span>
        </button>

        {(isOrg || showNgoInputs) && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'qr_library'}
            className={`vs-tab ${activeTab === 'qr_library' ? 'active' : ''}`}
            onClick={() => setActiveTab('qr_library')}
          >
            <span>QR &amp; Payout Rails</span>
            {savedQrList.length > 0 && (
              <span className="vs-tab-count">{savedQrList.length}</span>
            )}
          </button>
        )}

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'preferences'}
          className={`vs-tab ${activeTab === 'preferences' ? 'active' : ''}`}
          onClick={() => setActiveTab('preferences')}
        >
          <span>Preferences</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'security'}
          className={`vs-tab ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <span>Security</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'wallet'}
          className={`vs-tab ${activeTab === 'wallet' ? 'active' : ''}`}
          onClick={() => setActiveTab('wallet')}
        >
          <span>Ledger &amp; System</span>
        </button>
      </nav>

      <div className="vs-content" key={activeTab}>
      {/* ══════════════════════════════════════════════════════════════════
          TAB 1: PROFILE & IDENTITY
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'profile' && (
        <div className="bbdrts-settings-pane vs-pane">

          {/* Full-Width Borderless Identity Strip */}
          <div className="vs-identity-band">
            <div className="vs-identity-left">
              <button
                type="button"
                className="vs-avatar-btn"
                onClick={() => setEditModalOpen(true)}
                title="Change profile photo"
              >
                <div className="vs-avatar">
                  {currentUser?.avatar_url && (currentUser.avatar_url.startsWith('data:') || currentUser.avatar_url.startsWith('http')) ? (
                    <img src={currentUser.avatar_url} alt="Profile Avatar" />
                  ) : currentUser?.avatar_url && currentUser.avatar_url.length < 30 ? (
                    <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>{currentUser.avatar_url}</span>
                  ) : (
                    userInitials
                  )}
                </div>
                <span className="vs-avatar-hover">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>photo_camera</span>
                </span>
              </button>

              <div className="vs-identity-info">
                <div className="vs-identity-name-row">
                  <h3 className="vs-identity-name">{displayName}</h3>
                  <span
                    className="material-symbols-outlined vs-verified-check"
                    title={isOrg ? 'Accredited NGO' : isAdmin ? 'Verified Admin' : 'Verified Donor'}
                  >
                    verified
                  </span>
                </div>
                <div className="vs-identity-meta">
                  <span>{currentUser.email || `${displayName.toLowerCase().replace(/\s+/g, '')}@bbdrts.org`}</span>
                  <span className="vs-dot-sep">·</span>
                  <span>Member since {formatMemberSince(currentUser?.created_at || currentUser?.Created_At)}</span>
                  <span className="vs-dot-sep">·</span>
                  <button
                    type="button"
                    className="vs-id-copy-btn"
                    onClick={handleCopySystemId}
                    title="Copy Account ID"
                  >
                    <span>{systemId}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>content_copy</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="vs-identity-pills">
              <button
                type="button"
                className="vs-status-pill"
                onClick={() => setActiveTab('wallet')}
              >
                <span className="vs-live-dot" />
                <span>Sepolia Active</span>
              </button>
              <button
                type="button"
                className="vs-status-pill"
                onClick={() => setActiveTab('security')}
              >
                <span className={`vs-live-dot ${tfaStatus?.enabled ? '' : 'is-off'}`} />
                <span>{tfaStatus?.enabled ? '2FA Enabled' : '2FA Off'}</span>
              </button>
            </div>
          </div>

          {/* Balanced 2-Column Vercel Grid (Primary Details Left · Standing & Quick Overview Right) */}
          <div className="vs-profile-grid">
            {/* LEFT COLUMN: Unified Public Profile Card */}
            <div className="vs-card">
              <div className="vs-card-head">
                <div>
                  <h4 className="vs-card-title">Public Profile</h4>
                  <p className="vs-card-desc">
                    Displayed on verified donation receipts and appreciation certificates.
                  </p>
                </div>
              </div>

              <div className="vs-kv-list">
                <div className="vs-kv-row">
                  <span className="vs-kv-key">Display Name</span>
                  <span className="vs-kv-val">{displayName}</span>
                </div>

                <div className="vs-kv-row">
                  <span className="vs-kv-key">Email Address</span>
                  <span className="vs-kv-val">{currentUser.email || '—'}</span>
                </div>

                <div className="vs-kv-row">
                  <span className="vs-kv-key">Contact Number</span>
                  <span className="vs-kv-val">
                    {currentUser?.phone || (
                      <button type="button" className="vs-add-link" onClick={() => setEditModalOpen(true)}>+ Add contact number</button>
                    )}
                  </span>
                </div>

                <div className="vs-kv-row">
                  <span className="vs-kv-key">Location</span>
                  <span className="vs-kv-val">
                    {currentUser?.location || (
                      <button type="button" className="vs-add-link" onClick={() => setEditModalOpen(true)}>+ Add location</button>
                    )}
                  </span>
                </div>

                <div className="vs-kv-row is-multiline">
                  <span className="vs-kv-key">About / Bio</span>
                  <span className="vs-kv-val">
                    {currentUser?.bio || (
                      <button type="button" className="vs-add-link" onClick={() => setEditModalOpen(true)}>+ Add a short bio</button>
                    )}
                  </span>
                </div>

                {/* Only render filled optional fields as rows */}
                {filledOptionalFields.map((field) => (
                  <div key={field.key} className="vs-kv-row">
                    <span className="vs-kv-key">{field.label}</span>
                    <span className="vs-kv-val">
                      {field.isLink ? (
                        <a href={field.value} target="_blank" rel="noopener noreferrer" className="vs-ext-link">
                          <span>{field.value}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>north_east</span>
                        </a>
                      ) : field.value}
                    </span>
                  </div>
                ))}

                {/* Compact chip strip for unset optional fields (Zero giant 'Not set' wall) */}
                {emptyOptionalFields.length > 0 && (
                  <div className="vs-optional-strip">
                    <span className="vs-optional-lbl">Optional details</span>
                    <div className="vs-optional-chips">
                      {emptyOptionalFields.map((field) => (
                        <button
                          key={field.key}
                          type="button"
                          className="vs-optional-chip"
                          onClick={() => setEditModalOpen(true)}
                        >
                          + {field.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="vs-card-foot">
                <span className="vs-card-foot-note">
                  Changes sync automatically across your notarized receipts.
                </span>
                <button
                  type="button"
                  className="vs-subtle-btn"
                  onClick={() => setEditModalOpen(true)}
                >
                  Edit Profile
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: Recognition Standing + Quick Account Health */}
            <div className="vs-side-col">
              {/* Public Visibility & Privacy Controls (Directly governs how your Public Profile appears) */}
              {!isOrg && (
                <div className="vs-card">
                  <div className="vs-card-head">
                    <div>
                      <h4 className="vs-card-title">Public Visibility</h4>
                      <p className="vs-card-desc">
                        Control how your identity appears on campaign donor logs and public receipts.
                      </p>
                    </div>
                  </div>

                  <div className="vs-toggle-list">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={anonDefault}
                      className="vs-toggle-row"
                      onClick={handleToggleAnonymous}
                    >
                      <div className="vs-toggle-info">
                        <span className="vs-toggle-label">Anonymous Donor Mode</span>
                        <span className="vs-toggle-desc">Mask your name on public donor feeds.</span>
                      </div>
                      <span className={`vs-switch ${anonDefault ? 'is-on' : ''}`}>
                        <span className="vs-switch-thumb" />
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* NGO Right Column: Regulatory Accreditation + Payout Receiving Rails (Fixes Empty Right Column) */}
              {isOrg && (
                <>
                  <div className="vs-card">
                    <div className="vs-card-head">
                      <div>
                        <h4 className="vs-card-title">Regulatory Accreditation</h4>
                        <p className="vs-card-desc">
                          Verified legal registration and emergency dispatch contact.
                        </p>
                      </div>
                      <span className="vs-standing-pill">
                        <span className="vs-live-dot" />
                        <span>{currentUser?.verification_status || currentUser?.Verification_Status || 'Verified'}</span>
                      </span>
                    </div>

                    <div className="vs-kv-list">
                      <div className="vs-kv-row vs-kv-row--compact">
                        <span className="vs-kv-key">SEC Reg. No.</span>
                        <span className="vs-kv-val vs-mono-val">
                          {currentUser?.sec_registration_no || currentUser?.Sec_Registration_No || (
                            <span className="vs-muted-inline">Pending submission</span>
                          )}
                        </span>
                      </div>
                      <div className="vs-kv-row vs-kv-row--compact">
                        <span className="vs-kv-key">DSWD Accredit.</span>
                        <span className="vs-kv-val vs-mono-val">
                          {currentUser?.dswd_accreditation_no || currentUser?.Dswd_Accreditation_No || (
                            <span className="vs-muted-inline">Pending submission</span>
                          )}
                        </span>
                      </div>
                      <div className="vs-kv-row vs-kv-row--compact">
                        <span className="vs-kv-key">24/7 Hotline</span>
                        <span className="vs-kv-val">
                          {ngoHotline || currentUser?.emergency_hotline || currentUser?.Emergency_Hotline || (
                            <span className="vs-muted-inline">Not configured</span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="vs-card-foot">
                      <span className="vs-card-foot-note">Update regulatory IDs via Edit Profile.</span>
                      <button
                        type="button"
                        className="vs-subtle-btn"
                        onClick={() => setEditModalOpen(true)}
                      >
                        Manage
                      </button>
                    </div>
                  </div>

                  <div className="vs-card">
                    <div className="vs-card-head">
                      <div>
                        <h4 className="vs-card-title">Payout Receiving Rails</h4>
                        <p className="vs-card-desc">
                          Active disbursement channels routed to donor checkout.
                        </p>
                      </div>
                    </div>

                    <div className="vs-kv-list">
                      <div className="vs-kv-row vs-kv-row--compact">
                        <span className="vs-kv-key">GCash Rail</span>
                        <span className="vs-kv-val vs-inline-status">
                          <span className={`vs-live-dot ${(currentUser?.gcash_number || currentUser?.Gcash_Number) ? '' : 'is-off'}`} />
                          <span>
                            {(currentUser?.gcash_number || currentUser?.Gcash_Number)
                              ? formatPhoneNumber(currentUser?.gcash_number || currentUser?.Gcash_Number)
                              : 'Not configured'}
                          </span>
                        </span>
                      </div>
                      <div className="vs-kv-row vs-kv-row--compact">
                        <span className="vs-kv-key">Maya Rail</span>
                        <span className="vs-kv-val vs-inline-status">
                          <span className={`vs-live-dot ${(currentUser?.maya_number || currentUser?.Maya_Number) ? '' : 'is-off'}`} />
                          <span>
                            {(currentUser?.maya_number || currentUser?.Maya_Number)
                              ? formatPhoneNumber(currentUser?.maya_number || currentUser?.Maya_Number)
                              : 'Not configured'}
                          </span>
                        </span>
                      </div>
                      <div className="vs-kv-row vs-kv-row--compact">
                        <span className="vs-kv-key">Bank Transfer</span>
                        <span className="vs-kv-val vs-inline-status">
                          <span className={`vs-live-dot ${(currentUser?.bank_account_number || currentUser?.Bank_Account_Number || currentUser?.bank_name || currentUser?.bank_details) ? '' : 'is-off'}`} />
                          <span>
                            {(currentUser?.bank_name || currentUser?.Bank_Name)
                              ? (currentUser?.bank_name || currentUser?.Bank_Name)
                              : (currentUser?.bank_details ? 'Configured' : 'Not configured')}
                          </span>
                        </span>
                      </div>
                      <div className="vs-kv-row vs-kv-row--compact">
                        <span className="vs-kv-key">Sepolia Audit</span>
                        <span className="vs-kv-val vs-inline-status">
                          <span className="vs-live-dot" />
                          <span>Gasless Relayer Active</span>
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="vs-card-foot-action"
                      onClick={() => setActiveTab('qr_library')}
                    >
                      <span>Manage QR &amp; Payout Library ({savedQrList.length} saved)</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* NGO Public Organization Profile Studio (Clean Vercel Card Rework) */}
          {(isOrg || showNgoInputs) && (
            <div className="vs-card">
              <div className="vs-card-head">
                <div>
                  <h4 className="vs-card-title">Public Organization Profile Studio</h4>
                  <p className="vs-card-desc">
                    Configure institutional details, response capabilities, and headquarters dispatch info displayed on your public NGO profile.
                  </p>
                </div>

                <button
                  type="button"
                  className="vs-subtle-btn"
                  onClick={() => {
                    setSelectedNgoId(isOrg ? (currentUser?.id || 8) : 8);
                    setPreviewNgoModalOpen(true);
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>visibility</span>
                  <span>Preview Public Profile</span>
                </button>
              </div>

              <div className="vs-form-body">
                {/* Mission Statement */}
                <div className="vs-form-field">
                  <div className="vs-field-lbl-row">
                    <label className="vs-field-lbl">Humanitarian Mission &amp; Core Mandate</label>
                    <span className="vs-id-code">{(ngoMission || '').length} / 500</span>
                  </div>
                  <textarea
                    className="vs-textarea"
                    rows={3}
                    value={ngoMission}
                    onChange={(e) => setNgoMission(e.target.value)}
                    placeholder="Describe your organization's humanitarian mission, emergency charter, and disaster response capabilities..."
                    maxLength={500}
                  />
                </div>

                {/* Headquarters Address & Landmark */}
                <div className="vs-form-grid-2">
                  <div className="vs-form-field">
                    <label className="vs-field-lbl">Headquarters Address</label>
                    <input
                      type="text"
                      className="vs-input vs-input--plain"
                      value={ngoLocation}
                      onChange={(e) => setNgoLocation(e.target.value)}
                      placeholder="e.g. 37 EDSA cor. Boni Ave, Mandaluyong City"
                    />
                  </div>

                  <div className="vs-form-field">
                    <label className="vs-field-lbl">HQ Landmark / Logistics Base</label>
                    <input
                      type="text"
                      className="vs-input vs-input--plain"
                      value={ngoLandmark}
                      onChange={(e) => setNgoLandmark(e.target.value)}
                      placeholder="e.g. Beside City Hall Complex"
                    />
                  </div>
                </div>

                {/* Primary Disaster Focus Areas */}
                <div className="vs-form-field">
                  <label className="vs-field-lbl">Primary Disaster Response Focus Areas</label>
                  <input
                    type="text"
                    className="vs-input vs-input--plain"
                    value={ngoFocusAreas}
                    onChange={(e) => setNgoFocusAreas(e.target.value)}
                    placeholder="e.g. Typhoon Relief, Flood Evacuation, Emergency First Aid"
                  />
                  <div className="vs-optional-chips" style={{ marginTop: '4px' }}>
                    {[
                      'Typhoon Relief',
                      'Flood Evacuation',
                      'Emergency First Aid',
                      'Food Packs Logistics',
                      'Clean Water & Sanitation',
                      'Search & Rescue',
                      'Post-Disaster Rebuilding',
                      'Psychosocial Support'
                    ].map((tag) => {
                      const hasTag = (ngoFocusAreas || '').includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          className={`vs-optional-chip ${hasTag ? 'is-selected' : ''}`}
                          onClick={() => {
                            if (!hasTag) {
                              setNgoFocusAreas(prev => prev ? `${prev}, ${tag}` : tag);
                            }
                          }}
                        >
                          {hasTag ? '✓ ' : '+ '}{tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Hotlines & Dispatch Contacts */}
                <div className="vs-form-grid-2">
                  <div className="vs-form-field">
                    <label className="vs-field-lbl">24/7 Disaster Operations Hotline</label>
                    <input
                      type="text"
                      className="vs-input vs-input--plain"
                      value={ngoHotline}
                      onChange={(e) => setNgoHotline(e.target.value)}
                      placeholder="e.g. 143 or (02) 8790-2300"
                    />
                  </div>

                  <div className="vs-form-field">
                    <label className="vs-field-lbl">Dispatch Mobile Contact</label>
                    <input
                      type="text"
                      className="vs-input vs-input--plain"
                      value={ngoPhone}
                      onChange={(e) => setNgoPhone(e.target.value)}
                      placeholder="e.g. 0992 982 4615"
                    />
                  </div>
                </div>

                {/* Website & Social */}
                <div className="vs-form-grid-2">
                  <div className="vs-form-field">
                    <label className="vs-field-lbl">Official Website URL</label>
                    <input
                      type="url"
                      className="vs-input vs-input--plain"
                      value={ngoWebsite}
                      onChange={(e) => setNgoWebsite(e.target.value)}
                      placeholder="https://www.redcross.org.ph"
                    />
                  </div>

                  <div className="vs-form-field">
                    <label className="vs-field-lbl">Official Social Media Page</label>
                    <input
                      type="text"
                      className="vs-input vs-input--plain"
                      value={ngoSocialLink}
                      onChange={(e) => setNgoSocialLink(e.target.value)}
                      placeholder="https://facebook.com/phredcross"
                    />
                  </div>
                </div>

                {/* Leadership & Banner URL */}
                <div className="vs-form-grid-2">
                  <div className="vs-form-field">
                    <label className="vs-field-lbl">Executive Leadership &amp; Signatories</label>
                    <input
                      type="text"
                      className="vs-input vs-input--plain"
                      value={ngoLeadOfficer}
                      onChange={(e) => setNgoLeadOfficer(e.target.value)}
                      placeholder="Authorized executive officers"
                    />
                  </div>

                  <div className="vs-form-field">
                    <label className="vs-field-lbl">Hero Cover Banner URL</label>
                    <input
                      type="text"
                      className="vs-input vs-input--plain"
                      value={ngoBannerUrl}
                      onChange={(e) => setNgoBannerUrl(e.target.value)}
                      placeholder="https://... or data:image/..."
                    />
                  </div>
                </div>
              </div>

              <div className="vs-card-foot">
                <span className="vs-card-foot-note">
                  Published changes appear immediately on your live public NGO audit profile.
                </span>
                <button
                  type="button"
                  className="vs-primary-btn vs-primary-btn--sm"
                  onClick={() => handleSaveNgoProfile(isOrg ? currentUser?.id : 8)}
                  disabled={savingNgoProfile}
                >
                  <span>{savingNgoProfile ? 'Saving...' : 'Save Profile Changes'}</span>
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: REUSABLE QR CODES & PAYOUT RAILS STUDIO
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'qr_library' && (
        <div className="bbdrts-settings-pane vs-pane">

          {/* Studio Header & Filter Card */}
          <div className="vs-card">
            <div className="vs-card-head">
              <div>
                <h4 className="vs-card-title">Reusable QR Codes &amp; Payout Rails</h4>
                <p className="vs-card-desc">
                  Upload and auto-crop GCash, Maya, or Bank QR vouchers with automatic OCR credential extraction for instant assignment across campaigns.
                </p>
              </div>

              <div className="vs-qr-head-actions">
                <button
                  type="button"
                  className="vs-subtle-btn"
                  onClick={() => handleMassApplyQrDefaults('missing_only')}
                  disabled={isApplyingQrToCamps || savedQrList.length === 0}
                  title="Fills only campaigns that do not have a QR code yet"
                >
                  <span>{isApplyingQrToCamps ? 'Applying...' : 'Fill Missing'}</span>
                </button>
                <button
                  type="button"
                  className="vs-subtle-btn"
                  onClick={() => handleMassApplyQrDefaults('replace_all')}
                  disabled={isApplyingQrToCamps || savedQrList.length === 0}
                  title="Overwrites QR codes across ALL of your existing campaigns with your active defaults"
                  style={{ borderColor: 'rgba(16, 185, 129, 0.45)', color: '#10b981' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>sync</span>
                  <span>{isApplyingQrToCamps ? 'Replacing...' : 'Replace All Campaigns'}</span>
                </button>
                <button
                  type="button"
                  className="vs-primary-btn vs-primary-btn--sm"
                  onClick={() => setShowAddQrModal(true)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>add</span>
                  <span>Upload QR</span>
                </button>
              </div>
            </div>

            <div className="vs-qr-toolbar">
              <div className="vs-seg-group" role="tablist" aria-label="Filter QR channels">
                {['ALL', 'GCash', 'Maya', 'Bank'].map((filt) => {
                  const count = filt === 'ALL'
                    ? savedQrList.length
                    : savedQrList.filter(q => q.payment_method === filt).length;
                  return (
                    <button
                      key={filt}
                      type="button"
                      className={`vs-seg-btn ${qrFilter === filt ? 'active' : ''}`}
                      onClick={() => setQrFilter(filt)}
                    >
                      <span>{filt === 'ALL' ? 'All' : filt}</span>
                      <span className="vs-seg-meta">{count}</span>
                    </button>
                  );
                })}
              </div>

              <span className="vs-inline-status vs-card-foot-note">
                <span className="vs-live-dot" />
                <span>Active defaults auto-route to donor checkout</span>
              </span>
            </div>
          </div>

          {/* QR Vouchers Grid */}
          {qrLoading ? (
            <div className="vs-card vs-qr-empty">
              <span className="vs-empty-note">Loading saved payment QR vouchers...</span>
            </div>
          ) : savedQrList.length === 0 ? (
            <div className="vs-card vs-qr-empty">
              <span className="material-symbols-outlined vs-qr-empty-icon">qr_code_scanner</span>
              <h4 className="vs-card-title">No Reusable QR Codes Yet</h4>
              <p className="vs-card-desc" style={{ maxWidth: '400px', margin: '4px auto 16px' }}>
                Upload your official GCash, Maya, or Bank QR screenshot once. Mobile borders are auto-cropped and recipient credentials extracted automatically.
              </p>
              <button
                type="button"
                className="vs-primary-btn vs-primary-btn--sm"
                onClick={() => setShowAddQrModal(true)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>upload_file</span>
                <span>Upload First QR Code</span>
              </button>
            </div>
          ) : (
            <div className="vs-qr-grid">
              {savedQrList
                .filter(q => qrFilter === 'ALL' || q.payment_method === qrFilter)
                .map((qr) => {
                  const isDefault = Boolean(qr.is_default);
                  return (
                    <div key={qr.id} className={`vs-card vs-qr-card ${isDefault ? 'is-default' : ''}`}>
                      <div className="vs-qr-card-top">
                        <div style={{ minWidth: 0 }}>
                          <div className="vs-inline-status" style={{ marginBottom: '4px' }}>
                            <span className="vs-tier-tag">{qr.payment_method}</span>
                            {isDefault && (
                              <span className="vs-mini-pill">
                                <span className="vs-live-dot" />
                                <span>Default</span>
                              </span>
                            )}
                          </div>
                          <h5 className="vs-qr-card-name">{qr.custom_name}</h5>
                        </div>

                        <button
                          type="button"
                          className="vs-icon-copy-btn vs-qr-del-btn"
                          onClick={(e) => handleDeleteQrFromLibrary(qr.id, qr.custom_name, e)}
                          title="Delete QR code"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>delete</span>
                        </button>
                      </div>

                      <div
                        className="vs-qr-thumb"
                        onClick={() => setPreviewQrModal(qr)}
                        title="Click to enlarge QR voucher"
                      >
                        <img src={qr.qr_image_url} alt={qr.custom_name} />
                        <span className="vs-qr-thumb-overlay">
                          <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>zoom_in</span>
                          <span>Enlarge</span>
                        </span>
                      </div>

                      <div className="vs-qr-meta">
                        <div className="vs-qr-meta-row">
                          <span className="vs-kv-key">Account</span>
                          <span className="vs-qr-meta-val">{qr.account_name || 'Not extracted'}</span>
                        </div>
                        <div className="vs-qr-meta-row">
                          <span className="vs-kv-key">Number</span>
                          <span className="vs-inline-status">
                            <span className="vs-qr-meta-val vs-mono-val">
                              {qr.account_number ? formatPhoneNumber(qr.account_number) : 'Not extracted'}
                            </span>
                            {qr.account_number && (
                              <button
                                type="button"
                                className="vs-id-copy-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(qr.account_number);
                                  showSuccess('Account number copied to clipboard.', 'Copied');
                                }}
                                title="Copy account number"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>content_copy</span>
                              </button>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="vs-qr-card-foot" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {isDefault ? (
                          <span className="vs-inline-status" style={{ fontSize: '0.74rem', fontWeight: 600, color: '#10b981' }}>
                            <span className="vs-live-dot" />
                            <span>Active Default for {qr.payment_method}</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="vs-subtle-btn"
                            style={{ width: '100%', justifyContent: 'center' }}
                            onClick={() => handleToggleDefaultQr(qr)}
                          >
                            <span>Set as Active Default</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="vs-subtle-btn"
                          style={{ width: '100%', justifyContent: 'center', fontSize: '0.72rem' }}
                          disabled={isApplyingQrToCamps}
                          onClick={() => handleMassApplyQrDefaults('replace_all', qr)}
                          title={`Replace ${qr.payment_method} QR across ALL of your campaigns with this QR`}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>published_with_changes</span>
                          <span>Replace on All Campaigns</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

        </div>
      )}

      {/* ── Modal: Upload & Auto-Crop New QR Voucher ── */}
      {showAddQrModal && createPortal(
        <div
          className="bbdrts-modal-backdrop"
          onClick={() => setShowAddQrModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(10px)',
            zIndex: 1000000080,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            className="bbdrts-modal-container"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '620px',
              width: '100%',
              background: '#0a0a0a',
              border: '1px solid #262626',
              borderRadius: '12px',
              padding: '24px',
              color: '#ededed',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #222222', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#007dfe' }}>auto_fix_high</span>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Smart QR Auto-Crop &amp; Library Upload</h4>
                  <p style={{ margin: 0, fontSize: '0.74rem', color: '#888888' }}>Upload a phone screenshot — edges are auto-cropped &amp; recipient text extracted via OCR</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddQrModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#888888', cursor: 'pointer', fontSize: '22px' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveNewQrToLibrary} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Payment Method Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#a3a3a3', marginBottom: '6px' }}>
                  Payment Method Rail
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {['GCash', 'Maya', 'Bank'].map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setNewQrMethod(method)}
                      style={{
                        padding: '8px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        border: '1px solid',
                        cursor: 'pointer',
                        background: newQrMethod === method ? '#ffffff' : '#141414',
                        color: newQrMethod === method ? '#000000' : '#888888',
                        borderColor: newQrMethod === method ? '#ffffff' : '#262626'
                      }}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload Dropzone */}
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#a3a3a3', marginBottom: '6px' }}>
                  Upload QR Screenshot or Image File
                </label>
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px 16px',
                    border: '2px dashed #2e2e2e',
                    borderRadius: '8px',
                    background: '#121212',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'border-color 150ms ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#007dfe'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#2e2e2e'}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleNewQrFileUpload}
                    style={{ display: 'none' }}
                  />
                  <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#007dfe', marginBottom: '8px' }}>
                    {isCroppingQr ? 'hourglass_top' : 'cloud_upload'}
                  </span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ededed' }}>
                    {isCroppingQr ? 'Auto-Cropping Screenshot...' : 'Click to Upload or Drag & Drop'}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#737373', marginTop: '4px' }}>
                    Accepts PNG, JPG, WebP (GCash blue screenshots &amp; Maya dark borders auto-trimmed)
                  </span>
                </label>
              </div>

              {/* Live Preview & Extracted OCR Details */}
              {newQrImage && (
                <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: '8px', padding: '14px', display: 'grid', gridTemplateColumns: '120px 1fr', gap: '14px', alignItems: 'center' }}>
                  <div style={{ background: '#ffffff', borderRadius: '6px', padding: '6px', textAlign: 'center' }}>
                    <img src={newQrImage} alt="Cropped QR" style={{ maxWidth: '100%', maxHeight: '120px', display: 'block', margin: '0 auto' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#10b981' }}>check_circle</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981' }}>
                        {isOcrExtracting ? 'Running OCR...' : 'Clean Voucher Matrix Ready'}
                      </span>
                    </div>
                    {cropFeedback && (
                      <p style={{ margin: 0, fontSize: '0.72rem', color: '#a3a3a3', lineHeight: 1.4 }}>
                        {cropFeedback}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Custom Identifier Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#a3a3a3', marginBottom: '4px' }}>
                  Custom QR Identifier Name *
                </label>
                <input
                  type="text"
                  value={newQrName}
                  onChange={e => setNewQrName(e.target.value)}
                  placeholder='e.g. Primary Disaster Relief GCash'
                  style={{ width: '100%', padding: '8px 12px', background: '#141414', border: '1px solid #262626', borderRadius: '6px', color: '#ffffff', fontSize: '0.8rem' }}
                  required
                />
              </div>

              {/* Editable Extracted Account Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#a3a3a3', marginBottom: '4px' }}>
                  Account / Recipient Name (Auto-Extracted via OCR)
                </label>
                <input
                  type="text"
                  value={newQrAccountName}
                  onChange={e => setNewQrAccountName(e.target.value)}
                  placeholder="e.g. Philippine Red Cross"
                  style={{ width: '100%', padding: '8px 12px', background: '#141414', border: '1px solid #262626', borderRadius: '6px', color: '#ffffff', fontSize: '0.8rem' }}
                />
              </div>

              {/* Editable Extracted Account Number */}
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#a3a3a3', marginBottom: '4px' }}>
                  Account / Mobile Number (Auto-Extracted via OCR)
                </label>
                <input
                  type="text"
                  value={newQrAccountNumber}
                  onChange={e => setNewQrAccountNumber(e.target.value)}
                  placeholder="e.g. 0917 890 1430"
                  style={{ width: '100%', padding: '8px 12px', background: '#141414', border: '1px solid #262626', borderRadius: '6px', color: '#ffffff', fontSize: '0.8rem' }}
                />
              </div>

              {/* Set as Active Default Checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.76rem', color: '#ededed' }}>
                <input
                  type="checkbox"
                  checked={newQrIsDefault}
                  onChange={e => setNewQrIsDefault(e.target.checked)}
                />
                <span>Set as Active Default Payout Rail for this payment method</span>
              </label>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddQrModal(false)}
                  style={{ padding: '8px 14px', borderRadius: '6px', background: 'transparent', border: '1px solid #262626', color: '#888888', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newQrImage || isCroppingQr}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    background: '#ffffff',
                    color: '#000000',
                    border: 'none',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: !newQrImage || isCroppingQr ? 'not-allowed' : 'pointer',
                    opacity: !newQrImage || isCroppingQr ? 0.5 : 1
                  }}
                >
                  Save to Reusable Library
                </button>
              </div>

            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Lightbox: High-Resolution QR Card Viewer ── */}
      {previewQrModal && createPortal(
        <div
          className="bbdrts-modal-backdrop"
          onClick={() => setPreviewQrModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(12px)',
            zIndex: 1000000090,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '420px',
              width: '100%',
              background: '#0d0d0d',
              border: '1px solid #262626',
              borderRadius: '14px',
              padding: '24px',
              textAlign: 'center',
              color: '#ededed'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>{previewQrModal.custom_name}</h4>
                <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 500 }}>
                  {previewQrModal.payment_method} Verified Receiving Channel
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewQrModal(null)}
                style={{ background: 'transparent', border: 'none', color: '#888888', cursor: 'pointer', fontSize: '24px' }}
              >
                ×
              </button>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '10px', padding: '16px', display: 'inline-block', border: '1px solid #262626' }}>
              <img
                src={previewQrModal.qr_image_url}
                alt={previewQrModal.custom_name}
                style={{ maxWidth: '280px', maxHeight: '280px', display: 'block', margin: '0 auto' }}
              />
            </div>

            <div style={{ marginTop: '16px', fontSize: '0.8rem', color: '#a3a3a3', background: '#141414', padding: '12px', borderRadius: '8px', textAlign: 'left' }}>
              <div style={{ marginBottom: '4px' }}>
                <strong style={{ color: '#ffffff' }}>Account Name:</strong> {previewQrModal.account_name || 'N/A'}
              </div>
              <div>
                <strong style={{ color: '#ffffff' }}>Number:</strong> {previewQrModal.account_number ? formatPhoneNumber(previewQrModal.account_number) : 'N/A'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = previewQrModal.qr_image_url;
                  link.download = `${previewQrModal.custom_name.replace(/\s+/g, '_')}_QR.png`;
                  link.click();
                }}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  background: '#ffffff',
                  color: '#000000',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>download</span>
                Download Voucher
              </button>
              <button
                type="button"
                onClick={() => setPreviewQrModal(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  background: 'transparent',
                  border: '1px solid #262626',
                  color: '#888888',
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 2: LEDGER & SYSTEM (BLOCKCHAIN AUDIT + INFRASTRUCTURE HEALTH)
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'wallet' && (
        <div className="bbdrts-settings-pane vs-pane">
          <div className="vs-card">
            <div className="vs-card-head">
              <div>
                <h4 className="vs-card-title">Gasless Sepolia Audit Contract</h4>
                <p className="vs-card-desc">
                  No MetaMask or cryptocurrency wallet is required. Every verified PHP contribution and NGO disbursement proof is notarized on Ethereum Sepolia via our gasless backend relayer.
                </p>
              </div>
              <div className="vs-standing-pill">
                <span className="vs-live-dot" />
                <span>Relayer Active</span>
              </div>
            </div>

            <div className="vs-kv-list">
              <div className="vs-kv-row">
                <span className="vs-kv-key">Public Audit Contract</span>
                <span className="vs-kv-val vs-inline-status">
                  <span className="vs-mono-val">{contractAddress}</span>
                  <button
                    type="button"
                    className="vs-icon-copy-btn"
                    onClick={handleCopyContract}
                    title="Copy contract address"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>content_copy</span>
                  </button>
                </span>
              </div>

              <div className="vs-kv-row">
                <span className="vs-kv-key">Network Protocol</span>
                <span className="vs-kv-val vs-inline-status">
                  <span className="vs-live-dot" />
                  <span>Ethereum Sepolia</span>
                  <span className="vs-id-code">Chain ID 11155111</span>
                </span>
              </div>

              <div className="vs-kv-row">
                <span className="vs-kv-key">Supported PHP Rails</span>
                <span className="vs-kv-val">GCash (QR Ph) · Maya · Bank Transfer · Credit / Debit Card</span>
              </div>

              <div className="vs-kv-row">
                <span className="vs-kv-key">Gas Fees for Users</span>
                <span className="vs-kv-val">₱0 · Sponsored by BBDRTS Relayer</span>
              </div>
            </div>

            <div className="vs-card-foot">
              <span className="vs-card-foot-note">
                Independently verifiable public ledger powered by OpenZeppelin smart contracts.
              </span>
              <a
                href={`https://sepolia.etherscan.io/address/${contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="vs-subtle-btn vs-link-btn"
              >
                <span>View on Etherscan</span>
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>north_east</span>
              </a>
            </div>
          </div>

          <div className="vs-card">
            <div className="vs-card-head">
              <div>
                <h4 className="vs-card-title">System &amp; Infrastructure Health</h4>
                <p className="vs-card-desc">
                  Real-time operational status of RPC gateways, smart contracts, and ledger databases.
                </p>
              </div>
              <div className="vs-standing-pill">
                <span className="vs-live-dot" />
                <span>All Systems Operational</span>
              </div>
            </div>

            <div className="vs-health-grid">
              <div className="vs-health-cell">
                <span className="vs-health-lbl">Sepolia EVM RPC Gateway</span>
                <span className="vs-health-val">
                  <span className="vs-live-dot" />
                  <span>Connected &amp; Operational</span>
                </span>
              </div>
              <div className="vs-health-cell">
                <span className="vs-health-lbl">Milestone Smart Contract</span>
                <span className="vs-health-val">
                  <span className="vs-live-dot" />
                  <span>Active · OpenZeppelin</span>
                </span>
              </div>
              <div className="vs-health-cell">
                <span className="vs-health-lbl">Relief Ledger Database</span>
                <span className="vs-health-val">
                  <span className="vs-live-dot" />
                  <span>Synchronized</span>
                </span>
              </div>
              <div className="vs-health-cell">
                <span className="vs-health-lbl">Authentication Session</span>
                <span className="vs-health-val">
                  <span className="vs-live-dot" />
                  <span>JWT Encrypted · Active</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 3: PREFERENCES (APPEARANCE, ACCESSIBILITY, NOTIFICATIONS)
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'preferences' && (
        <div className="bbdrts-settings-pane vs-pane">

          {/* Card 1: Appearance & Interface (Theme + Density + Text Scale + Language) */}
          <div className="vs-card">
            <div className="vs-card-head">
              <div>
                <h4 className="vs-card-title">Appearance &amp; Interface</h4>
                <p className="vs-card-desc">
                  Customize theme, dashboard density, text scaling, and display language. Saved automatically.
                </p>
              </div>
            </div>

            {/* Section A: Theme Picker with Mini UI Previews */}
            <div className="vs-section-block">
              <div className="vs-section-label-row">
                <div>
                  <div className="vs-section-label">Theme</div>
                  <div className="vs-section-hint">Select how BBDRTS renders across your workspace.</div>
                </div>
              </div>

              <div className="vs-theme-grid">
                {[
                  { id: 'light', title: 'Light', desc: 'Crisp white canvas', previewClass: 'is-light' },
                  { id: 'dark', title: 'Dark', desc: 'Pitch-black Vercel Geist', previewClass: 'is-dark' },
                  { id: 'system', title: wt.systemPreference || 'System', desc: 'Match OS appearance', previewClass: 'is-system' }
                ].map((opt) => {
                  const isActive = activeThemeChoice === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`vs-theme-tile ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        if (setTheme) setTheme(opt.id);
                        showSuccess(`${opt.title} theme enabled.`, 'Theme Updated');
                      }}
                    >
                      <div className={`vs-theme-mini ${opt.previewClass}`}>
                        <span className="vs-mini-sidebar" />
                        <span className="vs-mini-main">
                          <span className="vs-mini-bar" />
                          <span className="vs-mini-cards">
                            <span />
                            <span />
                          </span>
                        </span>
                      </div>
                      <div className="vs-theme-tile-foot">
                        <div>
                          <div className="vs-theme-tile-name">{opt.title}</div>
                          <div className="vs-theme-tile-desc">{opt.desc}</div>
                        </div>
                        <span className={`vs-radio-dot ${isActive ? 'is-on' : ''}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section B: Interface Mode */}
            <div className="vs-section-block">
              <div className="vs-section-label-row">
                <div>
                  <div className="vs-section-label">Interface Density</div>
                  <div className="vs-section-hint">Choose full telemetry or a streamlined plain-language view.</div>
                </div>
              </div>

              <div className="vs-mode-grid">
                <button
                  type="button"
                  className={`vs-mode-card ${interfaceMode === 'standard' ? 'active' : ''}`}
                  onClick={() => {
                    if (setInterfaceMode) setInterfaceMode('standard');
                    showSuccess('Standard Mode enabled with full operational telemetry.', 'Interface Updated');
                  }}
                >
                  <div className="vs-mode-top">
                    <span className="vs-mode-title">Standard</span>
                    <span className={`vs-radio-dot ${interfaceMode === 'standard' ? 'is-on' : ''}`} />
                  </div>
                  <p className="vs-mode-desc">
                    Full telemetry, on-chain contract hashes, analytics charts, and detailed ledger views.
                  </p>
                </button>

                <button
                  type="button"
                  className={`vs-mode-card ${interfaceMode === 'simplified' ? 'active' : ''}`}
                  onClick={() => {
                    if (setInterfaceMode) setInterfaceMode('simplified');
                    showSuccess('Simplified Mode enabled with streamlined presentation.', 'Interface Updated');
                  }}
                >
                  <div className="vs-mode-top">
                    <span className="vs-mode-title">Simplified</span>
                    <span className={`vs-radio-dot ${interfaceMode === 'simplified' ? 'is-on' : ''}`} />
                  </div>
                  <p className="vs-mode-desc">
                    Plain-language summaries, calmer visual hierarchy, and prominent primary actions.
                  </p>
                </button>
              </div>
            </div>

            {/* Section C: Typography Scale (Inline Segmented Control) */}
            <div className="vs-section-block vs-inline-control-row">
              <div>
                <div className="vs-section-label">Text Size</div>
                <div className="vs-section-hint">Scale typography across dashboards, tables, and dialogs.</div>
              </div>
              <div className="vs-seg-group" role="radiogroup" aria-label="Text size">
                {TEXT_SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={activeTextSize === opt.id}
                    className={`vs-seg-btn ${activeTextSize === opt.id ? 'active' : ''}`}
                    onClick={() => handleSelectTextSize(opt.id)}
                  >
                    <span>{opt.name}</span>
                    <span className="vs-seg-meta">{opt.scale}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Section D: Language (Inline Segmented Control) */}
            <div className="vs-section-block vs-inline-control-row">
              <div>
                <div className="vs-section-label">{wt.platformLanguageTitle || 'Language'}</div>
                <div className="vs-section-hint">Switch interface terminology across supported Philippine languages.</div>
              </div>
              <div className="vs-seg-group" role="radiogroup" aria-label="Language">
                {[
                  { id: 'en', label: 'English (PH)' },
                  { id: 'fil', label: 'Filipino' },
                  { id: 'ceb', label: 'Cebuano' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={language === opt.id}
                    className={`vs-seg-btn ${language === opt.id ? 'active' : ''}`}
                    onClick={() => {
                      if (setLanguage) setLanguage(opt.id);
                      showSuccess(`${opt.label} selected.`, 'Language Updated');
                    }}
                  >
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Card 2 & 3 side-by-side on desktop, stacked on mobile */}
          <div className="vs-two-col">
            {/* Accessibility & Display */}
            <div className="vs-card">
              <div className="vs-card-head">
                <div>
                  <h4 className="vs-card-title">{wt.accessibilityControlsTitle || 'Accessibility & Display'}</h4>
                  <p className="vs-card-desc">
                    Motion, contrast, and bandwidth controls for comfortable viewing.
                  </p>
                </div>
              </div>

              <div className="vs-toggle-list">
                <button
                  type="button"
                  role="switch"
                  aria-checked={reducedMotion}
                  className="vs-toggle-row"
                  onClick={() => {
                    const next = !reducedMotion;
                    if (setReducedMotion) setReducedMotion(next);
                    showSuccess(`Reduced Motion ${next ? 'enabled' : 'disabled'}.`, 'Workspace Updated');
                  }}
                >
                  <div className="vs-toggle-info">
                    <span className="vs-toggle-label">{wt.reducedMotionLabel}</span>
                    <span className="vs-toggle-desc">{wt.reducedMotionDesc}</span>
                  </div>
                  <span className={`vs-switch ${reducedMotion ? 'is-on' : ''}`}>
                    <span className="vs-switch-thumb" />
                  </span>
                </button>

                <button
                  type="button"
                  role="switch"
                  aria-checked={highContrast}
                  className="vs-toggle-row"
                  onClick={() => {
                    const next = !highContrast;
                    if (setHighContrast) setHighContrast(next);
                    showSuccess(`High Contrast Mode ${next ? 'enabled' : 'disabled'}.`, 'Workspace Updated');
                  }}
                >
                  <div className="vs-toggle-info">
                    <span className="vs-toggle-label">{wt.highContrastLabel}</span>
                    <span className="vs-toggle-desc">{wt.highContrastDesc}</span>
                  </div>
                  <span className={`vs-switch ${highContrast ? 'is-on' : ''}`}>
                    <span className="vs-switch-thumb" />
                  </span>
                </button>

                <button
                  type="button"
                  role="switch"
                  aria-checked={lowBandwidthMode}
                  className="vs-toggle-row"
                  onClick={() => {
                    const next = !lowBandwidthMode;
                    if (setLowBandwidthMode) setLowBandwidthMode(next);
                    showSuccess(`Data Saver Mode ${next ? 'enabled' : 'disabled'}.`, 'Workspace Updated');
                  }}
                >
                  <div className="vs-toggle-info">
                    <span className="vs-toggle-label">{wt.dataSaverLabel}</span>
                    <span className="vs-toggle-desc">{wt.dataSaverDesc}</span>
                  </div>
                  <span className={`vs-switch ${lowBandwidthMode ? 'is-on' : ''}`}>
                    <span className="vs-switch-thumb" />
                  </span>
                </button>

                <button
                  type="button"
                  role="switch"
                  aria-checked={glassFx}
                  className="vs-toggle-row"
                  onClick={() => {
                    const nextVal = !glassFx;
                    setGlassFx(nextVal);
                    handleTogglePreference('glass_fx', nextVal, `Backdrop blur effects ${nextVal ? 'enabled' : 'disabled'}.`);
                  }}
                >
                  <div className="vs-toggle-info">
                    <span className="vs-toggle-label">Backdrop Blur Effects</span>
                    <span className="vs-toggle-desc">Translucent surfaces on top bars and modals.</span>
                  </div>
                  <span className={`vs-switch ${glassFx ? 'is-on' : ''}`}>
                    <span className="vs-switch-thumb" />
                  </span>
                </button>
              </div>
            </div>

            {/* Notifications & Guidance */}
            <div className="vs-card">
              <div className="vs-card-head">
                <div>
                  <h4 className="vs-card-title">Notifications &amp; Guidance</h4>
                  <p className="vs-card-desc">
                    Email receipt delivery, disaster alerts, and dashboard walkthrough.
                  </p>
                </div>
              </div>

              <div className="vs-toggle-list">
                <button
                  type="button"
                  role="switch"
                  aria-checked={emailNotify}
                  className="vs-toggle-row"
                  onClick={() => {
                    const nextVal = !emailNotify;
                    setEmailNotify(nextVal);
                    handleTogglePreference('email_receipts', nextVal, `Email contribution receipts ${nextVal ? 'enabled' : 'disabled'}.`);
                  }}
                >
                  <div className="vs-toggle-info">
                    <span className="vs-toggle-label">Email Contribution Receipts</span>
                    <span className="vs-toggle-desc">Send verified donation slips and Sepolia links to your inbox.</span>
                  </div>
                  <span className={`vs-switch ${emailNotify ? 'is-on' : ''}`}>
                    <span className="vs-switch-thumb" />
                  </span>
                </button>

                <button
                  type="button"
                  role="switch"
                  aria-checked={calamityAlerts}
                  className="vs-toggle-row"
                  onClick={() => {
                    const nextVal = !calamityAlerts;
                    setCalamityAlerts(nextVal);
                    handleTogglePreference('calamity_alerts', nextVal, `Disaster response alerts ${nextVal ? 'enabled' : 'disabled'}.`);
                  }}
                >
                  <div className="vs-toggle-info">
                    <span className="vs-toggle-label">Urgent Calamity Alerts</span>
                    <span className="vs-toggle-desc">Priority alerts for severe typhoons, earthquakes, or floods.</span>
                  </div>
                  <span className={`vs-switch ${calamityAlerts ? 'is-on' : ''}`}>
                    <span className="vs-switch-thumb" />
                  </span>
                </button>

                {onStartTour && (
                  <div className="vs-action-row">
                    <div className="vs-toggle-info">
                      <span className="vs-toggle-label">Interactive Walkthrough</span>
                      <span className="vs-toggle-desc">Replay the guided tour for your portal.</span>
                    </div>
                    <button
                      type="button"
                      className="vs-subtle-btn"
                      onClick={() => {
                        try {
                          localStorage.removeItem('bbdrts_tour_donor_done');
                          localStorage.removeItem('bbdrts_tour_ngo_done');
                          if (currentUser?.id) {
                            localStorage.removeItem(`bbdrts_tour_donor_${currentUser.id}`);
                            localStorage.removeItem(`bbdrts_tour_ngo_${currentUser.id}`);
                          }
                          localStorage.setItem('bbdrts_tour_force_launch', 'true');
                          onStartTour();
                          showSuccess('Interactive onboarding walkthrough restarted.', 'Tour Launched');
                        } catch (_) {}
                      }}
                    >
                      <span>Replay Tour</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 4: SECURITY (CREDENTIALS, 2FA, SESSIONS, DANGER ZONE)
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'security' && (
        <div className="bbdrts-settings-pane vs-pane">

          {/* Grace Period Banner (Shown only when account deletion is scheduled) */}
          {currentUser?.deletion_scheduled_at && (
            <div className="vs-grace-banner">
              <div className="vs-grace-info">
                <div className="vs-grace-title">
                  Account Deletion Scheduled · 30-Day Grace Period Active
                </div>
                <p className="vs-grace-desc">
                  Scheduled for permanent deactivation on{' '}
                  <strong>
                    {new Date(currentUser.deletion_effective_at || Date.now()).toLocaleDateString('en-US', {
                      timeZone: 'Asia/Manila',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </strong>{' '}
                  ({Math.max(1, Math.ceil((new Date(currentUser.deletion_effective_at) - new Date()) / 86400000))} days remaining).
                  On-chain donation proofs remain archived under RA 10173.
                </p>
              </div>
              <button
                type="button"
                className="vs-primary-btn"
                onClick={handleCancelAccountDeletion}
                disabled={cancellingDeletion}
              >
                <span>{cancellingDeletion ? 'Restoring...' : 'Cancel Deletion'}</span>
              </button>
            </div>
          )}

          {/* Card 1: Sign-In & Credentials (Primary Email + Change Password) */}
          <div className="vs-card vs-card--dropdown-safe">
            <div className="vs-card-head">
              <div>
                <h4 className="vs-card-title">Sign-In &amp; Credentials</h4>
                <p className="vs-card-desc">
                  Manage your verified login email and account password.
                </p>
              </div>
            </div>

            {/* Primary Email Sub-Row */}
            <div className="vs-action-row vs-border-bottom">
              <div className="vs-toggle-info">
                <div className="vs-inline-status">
                  <span className="vs-toggle-label">{currentUser?.email || 'Authorized User Email'}</span>
                  <span className="vs-mini-pill">
                    <span className="vs-live-dot" />
                    <span>Verified</span>
                  </span>
                </div>
                <span className="vs-toggle-desc">
                  Primary login handle. Updating requires verification of the new address with an emergency cancel alert.
                </span>
              </div>
              <button
                type="button"
                className="vs-subtle-btn"
                onClick={() => {
                  setNewEmailInput('');
                  setEmailChangePassword('');
                  setEmailChangeSuccess(false);
                  setShowEmailChangeModal(true);
                }}
              >
                <span>Change Email</span>
              </button>
            </div>

            {/* Password Update Form */}
            <form onSubmit={handleChangePassword}>
              <div className="vs-form-body">
                <div className="vs-section-label" style={{ marginBottom: '12px' }}>Update Password</div>

                <div className="vs-form-field">
                  <label className="vs-field-lbl">Current Password</label>
                  <div className="vs-input-wrap">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      className="vs-input"
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="vs-input-eye"
                      onClick={() => setShowCurrentPassword(p => !p)}
                      tabIndex="-1"
                      aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        {showCurrentPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="vs-form-grid-2">
                  {/* New Password — Exact 1:1 Sign Up Connected Bar & Floating 5-Rule Requirements */}
                  <div className="vs-form-field vs-pwd-group">
                    <div className="vs-field-lbl-row">
                      <label htmlFor="settings-new-password" className="vs-field-lbl">New Password</label>
                      {newPassword && (
                        <span className="vs-strength-lbl" style={{ color: newPwdStrength.color }}>
                          {newPwdStrength.label}
                        </span>
                      )}
                    </div>
                    <div className="vs-input-wrap">
                      <input
                        id="settings-new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        className="vs-input"
                        placeholder="Create new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        onFocus={() => setNewPasswordFocused(true)}
                        onBlur={() => setNewPasswordFocused(false)}
                        autoComplete="new-password"
                        aria-describedby={newPasswordFocused ? 'settings-pwd-requirements-panel' : undefined}
                      />
                      <button
                        type="button"
                        className="vs-input-eye"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setShowNewPassword(p => !p)}
                        tabIndex="-1"
                        aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                          {showNewPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>

                    {/* Permanent Connected Horizontal Password Strength Indicator (Exact AuthView Match) */}
                    <div className="vs-pwd-strength-track" aria-hidden="true">
                      <div
                        className="vs-pwd-strength-fill"
                        style={{
                          width: newPassword ? `${newPwdStrength.percent}%` : '0%',
                          backgroundColor: newPassword ? newPwdStrength.color : 'transparent'
                        }}
                      />
                    </div>

                    {/* Compact 1-Line Password Requirements Strip */}
                    {(newPasswordFocused || newPassword.length > 0) && (
                      <div
                        id="settings-pwd-requirements-panel"
                        className="vs-pwd-inline"
                        role="status"
                        aria-live="polite"
                      >
                        <ul className="vs-pwd-dropdown-list">
                          {newPasswordRequirements.map((req) => (
                            <li
                              key={req.id}
                              className={`vs-pwd-dropdown-item ${req.met ? 'is-met' : 'is-unmet'}`}
                              title={req.full}
                            >
                              <span className="material-symbols-outlined vs-pwd-dropdown-icon">
                                {req.met ? 'check_circle' : 'radio_button_unchecked'}
                              </span>
                              <span>{req.label}</span>
                            </li>
                          ))}
                        </ul>
                        <span className={`vs-pwd-dropdown-counter ${newPwdMetCount === 5 ? 'all-met' : ''}`}>
                          {newPwdMetCount}/5
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Confirm New Password — Exact 1:1 Sign Up Match Indicators */}
                  <div className="vs-form-field">
                    <div className="vs-field-lbl-row">
                      <label htmlFor="settings-confirm-password" className="vs-field-lbl">Confirm New Password</label>
                      {passwordsMatch && (
                        <span className="vs-match-tag is-ok">
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check_circle</span>
                          <span>Passwords Match</span>
                        </span>
                      )}
                      {passwordsMismatch && (
                        <span className="vs-match-tag is-err">
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>error</span>
                          <span>Passwords Do Not Match</span>
                        </span>
                      )}
                    </div>
                    <div className="vs-input-wrap">
                      <input
                        id="settings-confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        className="vs-input"
                        placeholder="Repeat new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="vs-input-eye"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setShowConfirmPassword(p => !p)}
                        tabIndex="-1"
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                          {showConfirmPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {tfaStatus.enabled && (
                  <div className="vs-form-field">
                    <label className="vs-field-lbl">2FA Authenticator Code (Required)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      className="vs-input"
                      placeholder="6-digit code from authenticator app"
                      value={passwordTfaCode}
                      onChange={(e) => setPasswordTfaCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      autoComplete="one-time-code"
                    />
                  </div>
                )}
              </div>

              <div className="vs-card-foot">
                <span className="vs-card-foot-note">
                  Passwords are encrypted with salted bcrypt hashing (10 rounds).
                </span>
                <button
                  type="submit"
                  className="vs-primary-btn vs-primary-btn--sm"
                  disabled={savingPassword || !currentPassword || newPwdMetCount < 5 || !passwordsMatch}
                >
                  <span>{savingPassword ? 'Updating...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Card 2: Two-Factor Authentication */}
          <div className="vs-card">
            <div className="vs-card-head">
              <div>
                <h4 className="vs-card-title">Two-Factor Authentication</h4>
                <p className="vs-card-desc">
                  Require a 6-digit TOTP code from an authenticator app whenever you sign in or change credentials.
                </p>
              </div>
              <div className="vs-standing-pill">
                <span className={`vs-live-dot ${tfaStatus.enabled ? '' : 'is-off'}`} />
                <span>{tfaStatus.enabled ? 'Enabled' : 'Off'}</span>
              </div>
            </div>

            <div className="vs-action-row">
              <div className="vs-toggle-info">
                <span className="vs-toggle-label">
                  {tfaStatus.enabled ? 'Authenticator App Active' : 'Authenticator App Not Configured'}
                </span>
                <span className="vs-toggle-desc">
                  {tfaStatus.enabled
                    ? `TOTP enforced on all sign-ins. ${tfaStatus.remainingBackupCodes} of ${tfaStatus.totalBackupCodes || 8} single-use recovery codes remaining.`
                    : 'Compatible with Google Authenticator, Microsoft Authenticator, Authy, and Apple Passwords.'}
                </span>
              </div>
            </div>

            <div className="vs-card-foot">
              <span className="vs-card-foot-note">
                {tfaStatus.enabled ? 'Keep your backup recovery codes stored offline.' : 'Strongly recommended for donor & NGO accounts.'}
              </span>
              {tfaStatus.enabled ? (
                <button
                  type="button"
                  className="vs-subtle-btn"
                  onClick={() => {
                    setTfaDisablePassword('');
                    setTfaDisableCode('');
                    setShowTfaDisableModal(true);
                  }}
                >
                  <span>Disable 2FA</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="vs-primary-btn vs-primary-btn--sm"
                  onClick={handleStartTfaSetup}
                  disabled={tfaSubmitting || tfaLoading}
                >
                  <span>{tfaSubmitting ? 'Configuring...' : 'Set Up Authenticator'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Card 3: Active Sessions */}
          <div className="vs-card">
            <div className="vs-card-head">
              <div>
                <h4 className="vs-card-title">Active Sessions</h4>
                <p className="vs-card-desc">
                  Devices currently authenticated to your account. Revoke unrecognized sessions immediately.
                </p>
              </div>
              <button
                type="button"
                className="vs-subtle-btn"
                onClick={handleRevokeAllOtherSessions}
                disabled={revokingAllOthers || activeSessions.filter(s => !s.isCurrent).length === 0}
              >
                <span>{revokingAllOthers ? 'Signing out...' : 'Sign Out Other Devices'}</span>
              </button>
            </div>

            <div className="vs-sessions-list">
              {sessionsLoading ? (
                <div className="vs-empty-note">Loading active sessions...</div>
              ) : activeSessions.length === 0 ? (
                <div className="vs-empty-note">No active session records found.</div>
              ) : (
                activeSessions.map((session, idx) => (
                  <div key={session.sessionId || idx} className="vs-session-row">
                    <div className="vs-session-left">
                      <span className="vs-session-icon">
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                          {session.deviceType === 'Mobile Phone' ? 'smartphone' : session.deviceType === 'Tablet' ? 'tablet' : 'desktop_windows'}
                        </span>
                      </span>
                      <div className="vs-session-info">
                        <div className="vs-inline-status">
                          <span className="vs-toggle-label">{session.os || 'Unknown OS'} · {session.browser || 'Web Browser'}</span>
                          {session.isCurrent && (
                            <span className="vs-mini-pill">
                              <span className="vs-live-dot" />
                              <span>This Device</span>
                            </span>
                          )}
                        </div>
                        <div className="vs-session-meta">
                          <span>{session.location || 'Regional Station'}</span>
                          <span>·</span>
                          <span className="vs-id-code">{session.ip || '127.0.0.1'}</span>
                          <span>·</span>
                          <span>
                            {session.lastActiveAt
                              ? new Date(session.lastActiveAt).toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'short', timeStyle: 'short' })
                              : 'Active now'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!session.isCurrent && (
                      <button
                        type="button"
                        className="vs-subtle-btn"
                        onClick={() => handleRevokeSession(session.sessionId)}
                        disabled={revokingSessionId === session.sessionId}
                      >
                        <span>{revokingSessionId === session.sessionId ? 'Revoking...' : 'Revoke'}</span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card 4: Unified Danger Zone (Sign Out + Delete Account) */}
          <div className="vs-card vs-danger-zone">
            <div className="vs-card-head">
              <div>
                <h4 className="vs-card-title vs-danger-title">Danger Zone</h4>
                <p className="vs-card-desc">
                  Session termination and permanent account lifecycle controls.
                </p>
              </div>
            </div>

            <div className="vs-toggle-list">
              <div className="vs-action-row">
                <div className="vs-toggle-info">
                  <span className="vs-toggle-label">Sign Out</span>
                  <span className="vs-toggle-desc">End your active session on this browser. You can sign back in anytime.</span>
                </div>
                <button
                  type="button"
                  className="vs-subtle-btn"
                  onClick={handleLogout}
                >
                  <span>Sign Out</span>
                </button>
              </div>

              <div className="vs-action-row">
                <div className="vs-toggle-info">
                  <span className="vs-toggle-label">Delete Account</span>
                  <span className="vs-toggle-desc">
                    30-day grace period with 1-click restoration. Historical blockchain proofs remain archived per RA 10173.
                  </span>
                </div>
                {currentUser?.deletion_scheduled_at ? (
                  <button
                    type="button"
                    className="vs-subtle-btn"
                    onClick={handleCancelAccountDeletion}
                    disabled={cancellingDeletion}
                  >
                    <span>Cancel Deletion</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="vs-danger-btn"
                    onClick={() => {
                      setDeleteConfirmationPhrase('');
                      setDeletePassword('');
                      setDelete2faCode('');
                      setDeleteWizardStep(1);
                      setShowDeleteAccountModal(true);
                    }}
                  >
                    <span>Request Deletion</span>
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      </div>

      {/* ── Edit Profile Modal (Single Source of Truth) ── */}
      {editModalOpen && (
        <EditProfileModal
          currentUser={currentUser}
          onClose={() => setEditModalOpen(false)}
          onProfileUpdated={(updated) => {
            if (onProfileUpdated) onProfileUpdated(updated);
          }}
          theme={theme}
          setTheme={setTheme}
        />
      )}

      {/* ── NGO Public Profile Modal Preview ── */}
      {previewNgoModalOpen && (
        <NgoProfileModal
          isOpen={previewNgoModalOpen}
          onClose={() => setPreviewNgoModalOpen(false)}
          orgId={selectedNgoId}
          theme={theme}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════
          FEATURE 4: TWO-FACTOR AUTHENTICATION (2FA) SETUP MODAL (STEPPER WIZARD)
          Matching the Log In with Email Code Layout & Visual Tokens
          ══════════════════════════════════════════════════════════════════ */}
      {showTfaSetupModal && tfaSetupData && createPortal(
        <div className="modal-backdrop-auth">
          <div className="forgot-modal-card" style={{ maxWidth: '440px' }}>
            <div className="forgot-modal-header">
              <div className="forgot-header-icon">
                <span className="material-symbols-outlined">verified_user</span>
              </div>
              <div className="forgot-header-text">
                <h3>Set Up Two-Factor Authentication</h3>
                <p>Step {tfaWizardStep} of 3 · Authenticator App Configuration</p>
              </div>
              <button
                type="button"
                className="forgot-close-btn"
                onClick={() => setShowTfaSetupModal(false)}
                title="Close"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>

            <div className="forgot-form-body">
              {/* Stepper Progress Bar */}
              <div className="tfa-stepper-bar">
                <div className={`tfa-step-pill ${tfaWizardStep === 1 ? 'active' : tfaWizardStep > 1 ? 'completed' : ''}`}>
                  <span className="tfa-step-num">{tfaWizardStep > 1 ? '✓' : '1'}</span>
                  <span>Scan QR</span>
                </div>
                <span className="tfa-step-arrow">➔</span>
                <div className={`tfa-step-pill ${tfaWizardStep === 2 ? 'active' : tfaWizardStep > 2 ? 'completed' : ''}`}>
                  <span className="tfa-step-num">{tfaWizardStep > 2 ? '✓' : '2'}</span>
                  <span>Backup Codes</span>
                </div>
                <span className="tfa-step-arrow">➔</span>
                <div className={`tfa-step-pill ${tfaWizardStep === 3 ? 'active' : ''}`}>
                  <span className="tfa-step-num">3</span>
                  <span>Confirm</span>
                </div>
              </div>

              {/* Step 1: Scan QR Code */}
              {tfaWizardStep === 1 && (
                <div>
                  <div className="input-group-modern">
                    <label>STEP 1: SCAN QR CODE WITH AUTHENTICATOR</label>
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.74rem', color: '#71717a', lineHeight: 1.4 }}>
                      Open Google Authenticator, Microsoft Authenticator, Authy, or Apple Keychain:
                    </p>
                    <div className="security-qr-frame">
                      <img src={tfaSetupData.qrCode} alt="2FA Barcode" style={{ width: '130px', height: '130px', display: 'block' }} />
                    </div>
                    <label style={{ marginTop: '8px' }}>CAN'T SCAN? ENTER SECRET KEY MANUALLY</label>
                    <div className="input-container">
                      <span className="material-symbols-outlined input-icon">key</span>
                      <input
                        type="text"
                        readOnly
                        value={tfaSetupData.secret}
                        style={{ fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.04em', paddingRight: '40px', fontSize: '0.80rem' }}
                      />
                      <button
                        type="button"
                        title="Copy secret key"
                        onClick={() => {
                          navigator.clipboard.writeText(tfaSetupData.secret);
                          setCopiedSecret(true);
                          setTimeout(() => setCopiedSecret(false), 2000);
                        }}
                        style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                          {copiedSecret ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="forgot-action-row" style={{ marginTop: '16px' }}>
                    <button
                      type="button"
                      className="forgot-cancel-btn"
                      onClick={() => setShowTfaSetupModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-modern-primary"
                      onClick={() => setTfaWizardStep(2)}
                    >
                      <span>Next: Backup Codes</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Emergency Backup Codes */}
              {tfaWizardStep === 2 && (
                <div>
                  <div className="input-group-modern">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ margin: 0 }}>STEP 2: SAVE EMERGENCY RECOVERY CODES</label>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(tfaSetupData.recoveryCodes.join('\n'));
                          setCopiedCodes(true);
                          setTimeout(() => setCopiedCodes(false), 2000);
                        }}
                        style={{ background: 'none', border: 'none', color: '#a1a1aa', fontSize: '11px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: 0 }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                          {copiedCodes ? 'check' : 'content_copy'}
                        </span>
                        <span>{copiedCodes ? 'Copied' : 'Copy All Codes'}</span>
                      </button>
                    </div>
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.74rem', color: '#71717a', lineHeight: 1.4 }}>
                      Store these 8 single-use codes safely. If you lose your phone, you can sign in using one of these codes:
                    </p>
                    <div className="security-backup-grid">
                      {tfaSetupData.recoveryCodes.map((code, idx) => (
                        <div key={idx} className="security-backup-pill">{code}</div>
                      ))}
                    </div>
                  </div>

                  <div className="forgot-info-alert" style={{ marginTop: '10px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>verified</span>
                    <span>Make sure you have copied or noted these backup codes before proceeding to verification.</span>
                  </div>

                  <div className="forgot-action-row" style={{ marginTop: '16px' }}>
                    <button
                      type="button"
                      className="forgot-cancel-btn"
                      onClick={() => setTfaWizardStep(1)}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="btn-modern-primary"
                      onClick={() => setTfaWizardStep(3)}
                    >
                      <span>Next: Verify Code</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Enter 6-digit Code */}
              {tfaWizardStep === 3 && (
                <form onSubmit={handleConfirmEnableTfa}>
                  <div className="input-group-modern">
                    <label style={{ display: 'block', textAlign: 'center', marginBottom: '4px' }}>STEP 3: 6-DIGIT AUTHENTICATOR CODE</label>
                    <p style={{ margin: '0 0 10px 0', fontSize: '0.74rem', color: '#71717a', lineHeight: 1.4, textAlign: 'center' }}>
                      Enter the 6-digit verification code currently shown in your authenticator app:
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0 14px 0' }}>
                      <OtpPinBoxes
                        value={tfaVerificationCode}
                        onChange={setTfaVerificationCode}
                        autoFocus={true}
                        onComplete={(code) => {
                          if (!tfaSubmitting && code.length === 6) {
                            handleConfirmEnableTfa(null, code);
                          }
                        }}
                        onSubmit={(e, code) => handleConfirmEnableTfa(e, code || tfaVerificationCode)}
                      />
                    </div>
                  </div>

                  <div className="forgot-info-alert" style={{ marginTop: '10px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>verified</span>
                    <span>Once enabled, your account will require a verification code from your authenticator app every time you sign in.</span>
                  </div>

                  <div className="forgot-action-row" style={{ marginTop: '16px' }}>
                    <button
                      type="button"
                      className="forgot-cancel-btn"
                      onClick={() => setTfaWizardStep(2)}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="btn-modern-primary"
                      disabled={tfaSubmitting || tfaVerificationCode.replace(/\D/g, '').length !== 6}
                    >
                      {tfaSubmitting ? (
                        <>
                          <span className="spinner-before"></span>
                          <span>Enabling...</span>
                        </>
                      ) : (
                        <>
                          <span>Verify &amp; Enable 2FA</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════════════════════════════════
          FEATURE 4: TWO-FACTOR AUTHENTICATION (2FA) DISABLE MODAL
          Matching the Log In with Email Code Layout & Visual Tokens
          ══════════════════════════════════════════════════════════════════ */}
      {showTfaDisableModal && createPortal(
        <div className="modal-backdrop-auth">
          <div className="forgot-modal-card" style={{ maxWidth: '430px' }}>
            <div className="forgot-modal-header">
              <div className="forgot-header-icon">
                <span className="material-symbols-outlined">lock_open</span>
              </div>
              <div className="forgot-header-text">
                <h3>Disable Two-Factor Authentication</h3>
                <p>Confirm your account password to turn off 2FA protection</p>
              </div>
              <button
                type="button"
                className="forgot-close-btn"
                onClick={() => setShowTfaDisableModal(false)}
                title="Close"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmDisableTfa} className="forgot-form-body">
              <div className="forgot-info-alert" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#ef4444' }}>warning</span>
                <span>Disabling two-factor authentication reduces your account security. Future logins will only require your account password.</span>
              </div>

              <div className="input-group-modern">
                <label>CURRENT PASSWORD (FOR SECURITY VERIFICATION)</label>
                <div className="input-container">
                  <span className="material-symbols-outlined input-icon">lock</span>
                  <input
                    type="password"
                    placeholder="Enter current password"
                    value={tfaDisablePassword}
                    onChange={e => setTfaDisablePassword(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="forgot-action-row">
                <button
                  type="button"
                  className="forgot-cancel-btn"
                  onClick={() => setShowTfaDisableModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modern-primary"
                  style={{ background: '#ef4444', borderColor: '#ef4444', color: '#ffffff' }}
                  disabled={tfaSubmitting || !tfaDisablePassword}
                >
                  {tfaSubmitting ? (
                    <>
                      <span className="spinner-before"></span>
                      <span>Disabling...</span>
                    </>
                  ) : (
                    <>
                      <span>Disable 2FA</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>lock_open</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════════════════════════════════
          FEATURE 7: CHANGE ACCOUNT EMAIL ADDRESS MODAL
          Matching the Log In with Email Code Layout & Visual Tokens
          ══════════════════════════════════════════════════════════════════ */}
      {showEmailChangeModal && createPortal(
        <div className="modal-backdrop-auth">
          <div className="forgot-modal-card" style={{ maxWidth: '430px' }}>
            <div className="forgot-modal-header">
              <div className="forgot-header-icon">
                <span className="material-symbols-outlined">mark_email_read</span>
              </div>
              <div className="forgot-header-text">
                <h3>Change Account Email Address</h3>
                <p>Update your primary login email with dual verification</p>
              </div>
              <button
                type="button"
                className="forgot-close-btn"
                onClick={() => setShowEmailChangeModal(false)}
                title="Close"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>

            {emailChangeSuccess ? (
              <div className="forgot-form-body">
                <div className="forgot-info-alert">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>verified</span>
                  <span>Confirmation link sent to <strong>{newEmailInput}</strong>. Please check your inbox and click the link within 60 minutes to finalize your email change.</span>
                </div>
                <div className="forgot-action-row" style={{ gridTemplateColumns: '1fr' }}>
                  <button
                    type="button"
                    className="btn-modern-primary"
                    onClick={() => setShowEmailChangeModal(false)}
                  >
                    <span>Done</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRequestEmailChange} className="forgot-form-body">
                <div className="forgot-info-alert">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>verified</span>
                  <span>A verification link valid for 60 minutes will be sent to your new email. Your current address (<strong>{currentUser?.email}</strong>) will also receive an emergency alert with an immediate cancel button.</span>
                </div>

                <div className="input-group-modern">
                  <label>NEW EMAIL ADDRESS</label>
                  <div className="input-container">
                    <span className="material-symbols-outlined input-icon">mail</span>
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={newEmailInput}
                      onChange={e => setNewEmailInput(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="input-group-modern">
                  <label>CURRENT PASSWORD (FOR SECURITY VERIFICATION)</label>
                  <div className="input-container">
                    <span className="material-symbols-outlined input-icon">lock</span>
                    <input
                      type="password"
                      placeholder="Enter current password"
                      value={emailChangePassword}
                      onChange={e => setEmailChangePassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {tfaStatus.enabled && (
                  <div className="input-group-modern">
                    <label>2FA AUTHENTICATOR CODE (REQUIRED)</label>
                    <div className="input-container">
                      <span className="material-symbols-outlined input-icon">verified_user</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Enter 6-digit authenticator code"
                        value={emailChangeTfaCode}
                        onChange={e => setEmailChangeTfaCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="forgot-action-row">
                  <button
                    type="button"
                    className="forgot-cancel-btn"
                    onClick={() => setShowEmailChangeModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-modern-primary"
                    disabled={emailChangeSubmitting || !newEmailInput || !emailChangePassword || (tfaStatus.enabled && emailChangeTfaCode.length < 6)}
                  >
                    {emailChangeSubmitting ? (
                      <>
                        <span className="spinner-before"></span>
                        <span>Sending Link...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Verification Link</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>send</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════════════════════════════════
          FEATURE: MULTI-STEP ACCOUNT DELETION MODAL (30-DAY GRACE PERIOD)
          ══════════════════════════════════════════════════════════════════ */}
      {showDeleteAccountModal && createPortal(
        <div className="modal-backdrop-auth">
          <div className="forgot-modal-card" style={{ maxWidth: '440px' }}>
            <div className="forgot-modal-header">
              <div className="forgot-header-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.25)', color: '#ef4444' }}>
                <span className="material-symbols-outlined">person_remove</span>
              </div>
              <div className="forgot-header-text">
                <h3>Request Account Deletion</h3>
                <p>Step {deleteWizardStep} of 2 · 30-Day Grace Period Safeguard</p>
              </div>
              <button
                type="button"
                className="forgot-close-btn"
                onClick={() => setShowDeleteAccountModal(false)}
                title="Close"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>

            {deleteWizardStep === 1 ? (
              <div className="forgot-form-body">
                <div className="forgot-info-alert" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#ef4444' }}>warning</span>
                  <div>
                    <strong style={{ color: '#ffffff', display: 'block', marginBottom: '4px' }}>Mandatory 30-Day Grace Period</strong>
                    Your account will enter a 30-day scheduled closure. During this time, your account is inactive, but you can cancel the deletion and restore all access anytime by simply logging back in.
                  </div>
                </div>

                <div className="forgot-info-alert" style={{ marginTop: '8px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>verified</span>
                  <div>
                    <strong style={{ color: '#ffffff', display: 'block', marginBottom: '2px' }}>Compliance &amp; Audit Retention (RA 10173)</strong>
                    Under Philippine statutory laws and Data Privacy regulations, historical financial transactions, relief disbursements, and blockchain verification proofs remain permanently preserved in administrative audit archives.
                  </div>
                </div>

                <div className="input-group-modern" style={{ marginTop: '12px' }}>
                  <label>PRIMARY REASON FOR CLOSURE (OPTIONAL)</label>
                  <div className="input-container">
                    <span className="material-symbols-outlined input-icon">help_outline</span>
                    <select
                      value={deleteReason}
                      onChange={e => setDeleteReason(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        color: 'inherit',
                        fontSize: '0.85rem',
                        outline: 'none',
                        padding: '10px 12px 10px 38px',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="Personal reasons / switching email" style={{ background: '#18181b', color: '#ffffff' }}>Personal reasons / switching email</option>
                      <option value="No longer actively donating or requesting relief" style={{ background: '#18181b', color: '#ffffff' }}>No longer actively donating or requesting relief</option>
                      <option value="Privacy or data retention preferences" style={{ background: '#18181b', color: '#ffffff' }}>Privacy or data retention preferences</option>
                      <option value="Created duplicate test account" style={{ background: '#18181b', color: '#ffffff' }}>Created duplicate test account</option>
                      <option value="Other administrative reason" style={{ background: '#18181b', color: '#ffffff' }}>Other administrative reason</option>
                    </select>
                  </div>
                </div>

                <div className="forgot-action-row" style={{ marginTop: '18px' }}>
                  <button
                    type="button"
                    className="forgot-cancel-btn"
                    onClick={() => setShowDeleteAccountModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-modern-danger"
                    onClick={() => setDeleteWizardStep(2)}
                  >
                    <span>Next: Verify Identity</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRequestAccountDeletion} className="forgot-form-body">
                <div className="forgot-info-alert" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#ef4444' }}>lock</span>
                  <span>To prevent accidental closure, confirm your identity and type <strong>DELETE MY ACCOUNT</strong> below.</span>
                </div>

                <div className="input-group-modern" style={{ marginTop: '10px' }}>
                  <label>CONFIRMATION PHRASE (TYPE EXACTLY)</label>
                  <div className="input-container">
                    <span className="material-symbols-outlined input-icon">edit_note</span>
                    <input
                      type="text"
                      placeholder="DELETE MY ACCOUNT"
                      value={deleteConfirmationPhrase}
                      onChange={e => setDeleteConfirmationPhrase(e.target.value)}
                      required
                      autoFocus
                      style={{ fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.04em' }}
                    />
                  </div>
                </div>

                <div className="input-group-modern">
                  <label>CURRENT ACCOUNT PASSWORD</label>
                  <div className="input-container">
                    <span className="material-symbols-outlined input-icon">lock</span>
                    <input
                      type="password"
                      placeholder="Enter current password"
                      value={deletePassword}
                      onChange={e => setDeletePassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {tfaStatus.enabled && (
                  <div className="input-group-modern">
                    <label style={{ display: 'block', textAlign: 'center', marginBottom: '4px' }}>6-DIGIT AUTHENTICATOR CODE (2FA VERIFICATION)</label>
                    <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 10px 0' }}>
                      <OtpPinBoxes
                        value={delete2faCode}
                        onChange={setDelete2faCode}
                        autoFocus={false}
                      />
                    </div>
                  </div>
                )}

                <div className="forgot-action-row" style={{ marginTop: '18px' }}>
                  <button
                    type="button"
                    className="forgot-cancel-btn"
                    onClick={() => setDeleteWizardStep(1)}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="btn-modern-danger"
                    disabled={deleteSubmitting || deleteConfirmationPhrase.trim() !== 'DELETE MY ACCOUNT' || !deletePassword || (tfaStatus.enabled && delete2faCode.length < 6)}
                  >
                    {deleteSubmitting ? (
                      <>
                        <span className="spinner-before"></span>
                        <span>Scheduling...</span>
                      </>
                    ) : (
                      <>
                        <span>Schedule Deletion (30 Days)</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person_remove</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
