import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './SettingsPanel.css';
import { ROLES, ROLE_META } from '../roleConfig';
import { contractAddress } from '../contractConfig';
import { shortAddr } from './CampaignCard';
import { useToast } from '../context/ToastContext';
import EditProfileModal from './EditProfileModal';
import DonorBadge from './DonorBadge';
import { formatPhoneNumber } from '../utils/formatters';
import NgoProfileModal from './NgoProfileModal';
import { autoCropQrScreenshot, extractQrVoucherText } from '../utils/qrCropper';
import OtpPinBoxes from './OtpPinBoxes';
import { getWorkspaceStrings } from '../data/workspaceTranslations';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function SettingsPanel({
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

  // Password Strength Evaluator (matches AuthView standards)
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: 'None', color: '#64748b', percent: 0 };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 1;
    if (/\d/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
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
        return { score: 0, label: 'Too short (min 6)', color: '#ef4444', percent: 15 };
    }
  };

  const newPwdStrength = getPasswordStrength(newPassword);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleChangePassword = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!currentPassword) {
      showError('Please enter your current password.', 'Validation Error');
      return;
    }
    if (newPassword.length < 6) {
      showError('New password must be at least 6 characters long.', 'Validation Error');
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
      const { croppedUrl, wasCropped } = await autoCropQrScreenshot(file);
      setNewQrImage(croppedUrl);

      setIsOcrExtracting(true);
      setCropFeedback('Running OCR recipient text recognition...');
      try {
        const { detectedName, detectedNumber } = await extractQrVoucherText(croppedUrl);
        if (detectedName) setNewQrAccountName(detectedName);
        if (detectedNumber) setNewQrAccountNumber(formatPhoneNumber(detectedNumber));

        if (wasCropped && (detectedName || detectedNumber)) {
          setCropFeedback('Clean QR voucher card cropped (outer background removed) & recipient credentials detected!');
          showSuccess('Clean QR card cropped and account info detected via OCR!', 'Smart QR Processed');
        } else if (wasCropped) {
          setCropFeedback('Clean QR voucher card cropped (outer background removed).');
          showSuccess('Clean QR voucher card cropped!', 'Smart QR Cropped');
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

  const handleMassApplyQrDefaults = async () => {
    try {
      setIsApplyingQrToCamps(true);
      const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
      const targetOrgId = (currentUser?.role === 'organization' || currentUser?.role === ROLES.ORGANIZATION)
        ? (currentUser?.id || 8)
        : 8;
      const res = await fetch(`${API_URL}/api/organization/qr-codes/apply-to-campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ org_id: targetOrgId, mode: 'missing_only' })
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess(data.message || 'Default QR codes applied to all campaigns with missing channels!', 'Mass Apply Complete');
      } else {
        showError(data.error || 'Failed to mass-apply QR codes.', 'Error');
      }
    } catch (err) {
      showError(err.message, 'Mass Apply Failed');
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

  return (
    <div className="bbdrts-settings-root">

      {/* ── Header Bar ── */}
      <div className="bbdrts-settings-header">
        <div className="bbdrts-settings-title-wrap">
          <h2 className="bbdrts-settings-title">
            <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#16a34a' }}>manage_accounts</span>
            Account & Settings
          </h2>
          <p className="bbdrts-settings-sub">
            Manage your personal profile, security controls, public blockchain audit contract, and preferences.
          </p>
        </div>

        <div className="bbdrts-settings-header-actions">
          <span className="bbdrts-settings-role-badge">
            <span className="material-symbols-outlined" style={{ fontSize: '15px', color: roleMeta.color }}>{roleMeta.icon}</span>
            <span>{isOrg ? 'Accredited NGO' : isAdmin ? 'Administrator' : 'Verified Donor'}</span>
          </span>

          <button
            type="button"
            className="bbdrts-settings-edit-btn"
            onClick={() => setEditModalOpen(true)}
            title="Edit your display name, contact information, location, bio, and avatar"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* ── Segmented Navigation Tabs ── */}
      <nav className="bbdrts-settings-tabs" aria-label="Settings categories">
        <button
          type="button"
          className={`bbdrts-settings-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person</span>
          <span>Profile & Identity</span>
        </button>

        {(isOrg || showNgoInputs) && (
          <button
            type="button"
            className={`bbdrts-settings-tab-btn ${activeTab === 'qr_library' ? 'active' : ''}`}
            onClick={() => setActiveTab('qr_library')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>qr_code_2</span>
            <span>QR Codes &amp; Payout Rails</span>
            {savedQrList.length > 0 && (
              <span className="bbdrts-qr-tab-count-badge">{savedQrList.length}</span>
            )}
          </button>
        )}

        <button
          type="button"
          className={`bbdrts-settings-tab-btn ${activeTab === 'wallet' ? 'active' : ''}`}
          onClick={() => setActiveTab('wallet')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>verified_user</span>
          <span>Blockchain Audit</span>
        </button>

        <button
          type="button"
          className={`bbdrts-settings-tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
          onClick={() => setActiveTab('preferences')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>tune</span>
          <span>Preferences & Theme</span>
        </button>

        <button
          type="button"
          className={`bbdrts-settings-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>shield</span>
          <span>Security & System</span>
        </button>
      </nav>

      {/* ══════════════════════════════════════════════════════════════════
          TAB 1: PROFILE & IDENTITY
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'profile' && (
        <div className="bbdrts-settings-pane">
          
          {/* Hero Identity Pass */}
          <div className="bbdrts-profile-hero">
            <div className="bbdrts-profile-hero-left">
              <div className="bbdrts-profile-avatar-wrap">
                {currentUser?.avatar_url && (currentUser.avatar_url.startsWith('data:') || currentUser.avatar_url.startsWith('http')) ? (
                  <img src={currentUser.avatar_url} alt="Profile Avatar" />
                ) : currentUser?.avatar_url && currentUser.avatar_url.length < 30 ? (
                  <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>{currentUser.avatar_url}</span>
                ) : (
                  userInitials
                )}
              </div>

              <div className="bbdrts-profile-hero-info">
                <div className="bbdrts-profile-name-row">
                  <h3 className="bbdrts-profile-hero-name">{displayName}</h3>
                  <span className="bbdrts-profile-badge-pill">
                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                      verified
                    </span>
                    {isOrg ? 'Verified NGO' : isAdmin ? 'Verified Admin' : 'Verified Donor'}
                  </span>
                </div>

                <div className="bbdrts-profile-hero-sub">
                  <span>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>mail</span>
                    {currentUser.email || `${displayName.toLowerCase().replace(/\s+/g, '')}@bbdrts.org`}
                  </span>
                  <span>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>location_on</span>
                    {currentUser.location || <span className="bbdrts-field-not-set">Location not set</span>}
                  </span>
                  <span>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>badge</span>
                    {systemId}
                  </span>
                  <span>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>calendar_today</span>
                    Member since {formatMemberSince(currentUser?.created_at || currentUser?.Created_At)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Information Card */}
          <div className="bbdrts-settings-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>id_card</span>
                  Public Profile Information
                </h4>
                <p className="bbdrts-settings-card-desc">
                  Information displayed on your verified relief contribution receipts and certificates.
                </p>
              </div>
            </div>

            <div className="bbdrts-profile-fields-grid">
              <div className="bbdrts-profile-field-item">
                <span className="bbdrts-profile-field-label">Display Name</span>
                <span className="bbdrts-profile-field-value">{displayName}</span>
              </div>

              <div className="bbdrts-profile-field-item">
                <span className="bbdrts-profile-field-label">Account Role</span>
                <span className="bbdrts-profile-field-value">{isOrg ? 'Accredited NGO Organization' : isAdmin ? 'System Administrator' : 'Verified Donor'}</span>
              </div>

              <div className="bbdrts-profile-field-item">
                <span className="bbdrts-profile-field-label">Contact Number</span>
                <span className="bbdrts-profile-field-value">
                  {currentUser?.phone || <span className="bbdrts-field-not-set">Not provided</span>}
                </span>
              </div>

              <div className="bbdrts-profile-field-item">
                <span className="bbdrts-profile-field-label">Registered Location</span>
                <span className="bbdrts-profile-field-value">
                  {currentUser?.location || <span className="bbdrts-field-not-set">Not provided</span>}
                </span>
              </div>

              <div className="bbdrts-profile-field-item" style={{ gridColumn: '1 / -1' }}>
                <span className="bbdrts-profile-field-label">About / Bio</span>
                <span className="bbdrts-profile-field-value">
                  {currentUser?.bio || <span className="bbdrts-field-not-set">No bio provided yet. Click "Edit Profile" to add one.</span>}
                </span>
              </div>

              {/* Optional Additional Humanitarian Background */}
              {!isOrg && (
                <>
                  <div className="bbdrts-profile-field-item">
                    <span className="bbdrts-profile-field-label">Occupation / Profession</span>
                    <span className="bbdrts-profile-field-value">
                      {userPrefs.occupation || <span className="bbdrts-field-not-set">Not provided (Optional)</span>}
                    </span>
                  </div>

                  <div className="bbdrts-profile-field-item">
                    <span className="bbdrts-profile-field-label">Preferred Relief Causes</span>
                    <span className="bbdrts-profile-field-value">
                      {userPrefs.preferredCauses || <span className="bbdrts-field-not-set">Not provided (Optional)</span>}
                    </span>
                  </div>

                  <div className="bbdrts-profile-field-item">
                    <span className="bbdrts-profile-field-label">Personal Website</span>
                    <span className="bbdrts-profile-field-value">
                      {userPrefs.website || currentUser?.website ? (
                        <a href={userPrefs.website || currentUser?.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent, #16a34a)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span>{userPrefs.website || currentUser?.website}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>open_in_new</span>
                        </a>
                      ) : <span className="bbdrts-field-not-set">Not provided (Optional)</span>}
                    </span>
                  </div>

                  <div className="bbdrts-profile-field-item">
                    <span className="bbdrts-profile-field-label">Social Profile</span>
                    <span className="bbdrts-profile-field-value">
                      {userPrefs.socialLink || <span className="bbdrts-field-not-set">Not provided (Optional)</span>}
                    </span>
                  </div>

                  <div className="bbdrts-profile-field-item">
                    <span className="bbdrts-profile-field-label">Emergency Contact</span>
                    <span className="bbdrts-profile-field-value">
                      {userPrefs.emergencyContact || <span className="bbdrts-field-not-set">Not provided (Optional)</span>}
                    </span>
                  </div>
                </>
              )}

              {isOrg && (
                <>
                  <div className="bbdrts-profile-field-item">
                    <span className="bbdrts-profile-field-label">Official Website</span>
                    <span className="bbdrts-profile-field-value">
                      {ngoWebsite || userPrefs.website || currentUser?.website ? (
                        <a href={ngoWebsite || userPrefs.website || currentUser?.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent, #16a34a)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span>{ngoWebsite || userPrefs.website || currentUser?.website}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>open_in_new</span>
                        </a>
                      ) : <span className="bbdrts-field-not-set">Not provided (Optional)</span>}
                    </span>
                  </div>

                  <div className="bbdrts-profile-field-item">
                    <span className="bbdrts-profile-field-label">Social Media Page</span>
                    <span className="bbdrts-profile-field-value">
                      {ngoSocialLink || userPrefs.socialLink || <span className="bbdrts-field-not-set">Not provided (Optional)</span>}
                    </span>
                  </div>

                  <div className="bbdrts-profile-field-item">
                    <span className="bbdrts-profile-field-label">Disaster Focus Areas</span>
                    <span className="bbdrts-profile-field-value">
                      {ngoFocusAreas || userPrefs.focusAreas || <span className="bbdrts-field-not-set">Not provided (Optional)</span>}
                    </span>
                  </div>

                  <div className="bbdrts-profile-field-item">
                    <span className="bbdrts-profile-field-label">HQ Landmark</span>
                    <span className="bbdrts-profile-field-value">
                      {ngoLandmark || userPrefs.hqLandmark || <span className="bbdrts-field-not-set">Not provided (Optional)</span>}
                    </span>
                  </div>

                  <div className="bbdrts-profile-field-item" style={{ gridColumn: '1 / -1' }}>
                    <span className="bbdrts-profile-field-label">Mission Statement</span>
                    <span className="bbdrts-profile-field-value">
                      {ngoMission || userPrefs.missionStatement || <span className="bbdrts-field-not-set">Not provided (Optional)</span>}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* NGO Profile Inputs & Information Studio (Dedicated In-Place Inputs) */}
          {(isOrg || showNgoInputs) && (
            <div className="bbdrts-settings-card bbdrts-ngo-studio-card">
              <div className="bbdrts-settings-card-header">
                <div className="bbdrts-settings-card-title-wrap">
                  <h4 className="bbdrts-settings-card-title">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#10b981' }}>domain_verification</span>
                    Organization Profile Inputs &amp; Public Information Studio
                  </h4>
                  <p className="bbdrts-settings-card-desc">
                    Fill up your institutional details, relief capabilities, operations base, and dispatch coordinates displayed on your public profile.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="bbdrts-btn-outline"
                    onClick={() => {
                      setSelectedNgoId(isOrg ? (currentUser?.id || 8) : 8);
                      setPreviewNgoModalOpen(true);
                    }}
                    title="Preview how these details appear on the live public profile modal"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                    <span>Preview Public Profile</span>
                  </button>

                  <button
                    type="button"
                    className="bbdrts-btn-primary"
                    onClick={() => handleSaveNgoProfile(isOrg ? currentUser?.id : 8)}
                    disabled={savingNgoProfile}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                      {savingNgoProfile ? 'sync' : 'save'}
                    </span>
                    <span>{savingNgoProfile ? 'Publishing...' : 'Save Profile Changes'}</span>
                  </button>
                </div>
              </div>

              {/* In-Place Inputs Form */}
              <div className="bbdrts-settings-input-grid">

                {/* Mission Statement (Full Width Textarea) */}
                <div className="bbdrts-settings-field-box" style={{ gridColumn: '1 / -1' }}>
                  <label className="bbdrts-settings-field-label">Humanitarian Mission &amp; Core Mandate</label>
                  <textarea
                    className="bbdrts-settings-textarea"
                    rows={3}
                    value={ngoMission}
                    onChange={(e) => setNgoMission(e.target.value)}
                    placeholder="Describe your organization's humanitarian mission, emergency relief charter, community focus, and disaster response capabilities..."
                    maxLength={500}
                  />
                  <span className="bbdrts-field-help">Displayed prominently in the profile sidebar and relief mission headers with 'Show more' toggle.</span>
                </div>

                {/* Headquarters Location */}
                <div className="bbdrts-settings-field-box">
                  <label className="bbdrts-settings-field-label">Headquarters Physical Address</label>
                  <input
                    type="text"
                    className="bbdrts-settings-input"
                    value={ngoLocation}
                    onChange={(e) => setNgoLocation(e.target.value)}
                    placeholder="e.g. National Headquarters, 37 EDSA cor. Boni Ave, Mandaluyong City"
                  />
                  <span className="bbdrts-field-help">Official headquarters address shown with location pin on map and profile.</span>
                </div>

                {/* HQ Landmark */}
                <div className="bbdrts-settings-field-box">
                  <label className="bbdrts-settings-field-label">Headquarters Landmark / Logistics Base</label>
                  <input
                    type="text"
                    className="bbdrts-settings-input"
                    value={ngoLandmark}
                    onChange={(e) => setNgoLandmark(e.target.value)}
                    placeholder="e.g. Near Provincial Capitol / Beside City Hall Complex"
                  />
                  <span className="bbdrts-field-help">Landmark directions to assist in-person aid deliveries and logistics dispatch.</span>
                </div>

                {/* Disaster Focus Areas with Suggestion Chips */}
                <div className="bbdrts-settings-field-box" style={{ gridColumn: '1 / -1' }}>
                  <label className="bbdrts-settings-field-label">Primary Disaster Response Focus Areas</label>
                  <input
                    type="text"
                    className="bbdrts-settings-input"
                    value={ngoFocusAreas}
                    onChange={(e) => setNgoFocusAreas(e.target.value)}
                    placeholder="e.g. Typhoon Relief, Flood Evacuation, Emergency First Aid, Food Logistics, Clean Water"
                  />
                  <div className="bbdrts-quick-chips-wrap">
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Quick add tags:</span>
                    {[
                      'Typhoon Relief',
                      'Flood Evacuation',
                      'Emergency First Aid',
                      'Food Packs Logistics',
                      'Clean Water & Sanitation',
                      'Search & Rescue',
                      'Post-Disaster Rebuilding',
                      'Psychosocial Support'
                    ].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="bbdrts-quick-chip"
                        onClick={() => {
                          if (!ngoFocusAreas.includes(tag)) {
                            setNgoFocusAreas(prev => prev ? `${prev}, ${tag}` : tag);
                          }
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>add</span>
                        {tag}
                      </button>
                    ))}
                  </div>
                  <span className="bbdrts-field-help">Rendered as luminous #{'tag'} pills on the profile sidebar and dispatch center.</span>
                </div>

                {/* 24/7 Operations Hotline */}
                <div className="bbdrts-settings-field-box">
                  <label className="bbdrts-settings-field-label">24/7 Disaster Operations Hotline</label>
                  <input
                    type="text"
                    className="bbdrts-settings-input"
                    value={ngoHotline}
                    onChange={(e) => setNgoHotline(e.target.value)}
                    placeholder="e.g. 143 or (02) 8790-2300"
                  />
                  <span className="bbdrts-field-help">Direct emergency hotline with quick-dial click integration.</span>
                </div>

                {/* Secondary Mobile Number */}
                <div className="bbdrts-settings-field-box">
                  <label className="bbdrts-settings-field-label">Secondary Dispatch Mobile Contact</label>
                  <input
                    type="text"
                    className="bbdrts-settings-input"
                    value={ngoPhone}
                    onChange={(e) => setNgoPhone(e.target.value)}
                    placeholder="e.g. 09929824615"
                  />
                  <span className="bbdrts-field-help">Field coordinator mobile number for operations logistics.</span>
                </div>

                {/* Official Website */}
                <div className="bbdrts-settings-field-box">
                  <label className="bbdrts-settings-field-label">Official Website URL</label>
                  <input
                    type="url"
                    className="bbdrts-settings-input"
                    value={ngoWebsite}
                    onChange={(e) => setNgoWebsite(e.target.value)}
                    placeholder="https://www.redcross.org.ph"
                  />
                  <span className="bbdrts-field-help">Official institutional portal with external verification link.</span>
                </div>

                {/* Social Media Channel */}
                <div className="bbdrts-settings-field-box">
                  <label className="bbdrts-settings-field-label">Official Social Media Page</label>
                  <input
                    type="text"
                    className="bbdrts-settings-input"
                    value={ngoSocialLink}
                    onChange={(e) => setNgoSocialLink(e.target.value)}
                    placeholder="https://facebook.com/phredcross or @philredcross"
                  />
                  <span className="bbdrts-field-help">Official Facebook, X (Twitter), or LinkedIn channel.</span>
                </div>

                {/* Executive Leadership */}
                <div className="bbdrts-settings-field-box">
                  <label className="bbdrts-settings-field-label">Executive Leadership &amp; Signatories</label>
                  <input
                    type="text"
                    className="bbdrts-settings-input"
                    value={ngoLeadOfficer}
                    onChange={(e) => setNgoLeadOfficer(e.target.value)}
                    placeholder="e.g. Richard Gordon (Chairman) &amp; Gwendolyn Pang (SecGen)"
                  />
                  <span className="bbdrts-field-help">Authorized signatories and accountable executive officers.</span>
                </div>

                {/* Hero Cover Banner URL */}
                <div className="bbdrts-settings-field-box">
                  <label className="bbdrts-settings-field-label">Organization Hero Banner Image URL</label>
                  <input
                    type="text"
                    className="bbdrts-settings-input"
                    value={ngoBannerUrl}
                    onChange={(e) => setNgoBannerUrl(e.target.value)}
                    placeholder="https://... or data:image/..."
                  />
                  <span className="bbdrts-field-help">High-resolution banner displayed across the top of the profile sidebar.</span>
                </div>

              </div>

              {/* Bottom Action Footer */}
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <button
                  type="button"
                  className="bbdrts-btn-outline"
                  onClick={() => {
                    setSelectedNgoId(isOrg ? (currentUser?.id || 8) : 8);
                    setPreviewNgoModalOpen(true);
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                  <span>View Public Profile</span>
                </button>

                <button
                  type="button"
                  className="bbdrts-btn-primary"
                  onClick={() => handleSaveNgoProfile(isOrg ? currentUser?.id : 8)}
                  disabled={savingNgoProfile}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    {savingNgoProfile ? 'sync' : 'save'}
                  </span>
                  <span>{savingNgoProfile ? 'Publishing...' : 'Save Profile Changes'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Donor Philanthropic Standing Card (Donors Only) */}
          {!isOrg && !isAdmin && (
            <div className="bbdrts-settings-card">
              <div className="bbdrts-settings-card-header">
                <div className="bbdrts-settings-card-title-wrap">
                  <h4 className="bbdrts-settings-card-title">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>military_tech</span>
                    Philanthropic Standing & Recognition
                  </h4>
                  <p className="bbdrts-settings-card-desc">
                    Your cumulative humanitarian contributions recorded on the immutable ledger.
                  </p>
                </div>

                {onOpenHonorsLadder && (
                  <button
                    type="button"
                    className="bbdrts-btn-outline"
                    onClick={onOpenHonorsLadder}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>leaderboard</span>
                    <span>View Honors Ladder</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', padding: '14px', background: 'var(--bg-subcard, #fafafa)', border: '1px solid var(--border, #eaeaea)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <DonorBadge
                    size="lg"
                    walletAddress={walletAddress || currentUser?.wallet_address}
                    donorId={currentUser?.id}
                    amountEth={totalDonatedEth}
                    amountPhp={totalDonatedPhp}
                    showProgress={false}
                    onClick={onOpenHonorsLadder}
                  />
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Verified Supporter
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      ₱{Number(totalDonatedPhp).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} verified relief contributed · Gasless Sepolia receipts
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ textAlign: 'center', padding: '8px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Donated</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#16a34a' }}>₱{Number(totalDonatedPhp).toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Audit Ledger</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Sepolia Verified</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Accredited NGO Directory & Profile Studio Card (For Donors / Testers) */}
          {!isOrg && !isAdmin && (
            <div className="bbdrts-settings-card">
              <div className="bbdrts-settings-card-header">
                <div className="bbdrts-settings-card-title-wrap">
                  <h4 className="bbdrts-settings-card-title">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#10b981' }}>verified_user</span>
                    Accredited NGO Directory &amp; Profile Studio
                  </h4>
                  <p className="bbdrts-settings-card-desc">
                    View and configure institutional profile inputs for accredited humanitarian partners (e.g. Philippine Red Cross). All fields populate the live public NGO audit profile.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="bbdrts-btn-outline"
                    onClick={() => {
                      setSelectedNgoId(8);
                      setPreviewNgoModalOpen(true);
                    }}
                    title="Open the live Philippine Red Cross profile modal"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                    <span>Preview Philippine Red Cross Profile</span>
                  </button>

                  <button
                    type="button"
                    className="bbdrts-btn-primary"
                    onClick={() => setShowNgoInputs(prev => !prev)}
                    title="Configure organizational profile inputs right here"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit_note</span>
                    <span>{showNgoInputs ? 'Hide NGO Profile Inputs' : 'Configure NGO Profile Inputs'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* NGO Regulatory Accreditation & Payout Rails (NGOs Only) */}
          {isOrg && (
            <div className="bbdrts-settings-card">
              <div className="bbdrts-settings-card-header">
                <div className="bbdrts-settings-card-title-wrap">
                  <h4 className="bbdrts-settings-card-title">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>verified_user</span>
                    Accreditation & Payout Receiving Rails
                  </h4>
                  <p className="bbdrts-settings-card-desc">
                    Official regulatory registration and active payout channels for emergency relief disbursements.
                  </p>
                </div>

                <button
                  type="button"
                  className="bbdrts-btn-outline"
                  onClick={() => setEditModalOpen(true)}
                  title="Update your payout numbers, QR codes, or accreditation numbers in Edit Profile"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>payments</span>
                  <span>Manage Rails</span>
                </button>
              </div>

              {/* Regulatory Accreditations Grid */}
              <div className="bbdrts-profile-fields-grid" style={{ marginBottom: '16px' }}>
                <div className="bbdrts-profile-field-item">
                  <span className="bbdrts-profile-field-label">SEC Registration No.</span>
                  <span className="bbdrts-profile-field-value">
                    {currentUser?.sec_registration_no || currentUser?.Sec_Registration_No || (
                      <span className="bbdrts-field-not-set">Pending Submission</span>
                    )}
                  </span>
                </div>

                <div className="bbdrts-profile-field-item">
                  <span className="bbdrts-profile-field-label">DSWD Accreditation No.</span>
                  <span className="bbdrts-profile-field-value">
                    {currentUser?.dswd_accreditation_no || currentUser?.Dswd_Accreditation_No || (
                      <span className="bbdrts-field-not-set">Pending Submission</span>
                    )}
                  </span>
                </div>

                <div className="bbdrts-profile-field-item">
                  <span className="bbdrts-profile-field-label">Verification Standing</span>
                  <span className="bbdrts-profile-field-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#16a34a' }}>check_circle</span>
                    <strong style={{ color: '#16a34a' }}>{currentUser?.verification_status || currentUser?.Verification_Status || 'Verified'}</strong>
                  </span>
                </div>

                <div className="bbdrts-profile-field-item">
                  <span className="bbdrts-profile-field-label">Emergency Hotline</span>
                  <span className="bbdrts-profile-field-value">
                    {currentUser?.emergency_hotline || currentUser?.Emergency_Hotline || (
                      <span className="bbdrts-field-not-set">Not configured</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Active Payout Channels Chips & QR Library Link */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Receiving Channels &amp; Payout Rails
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('qr_library')}
                    style={{
                      background: 'rgba(0, 125, 254, 0.1)',
                      border: '1px solid rgba(0, 125, 254, 0.25)',
                      color: '#007dfe',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>qr_code_2</span>
                    <span>Manage Reusable QR Library ({savedQrList.length} saved)</span>
                  </button>
                </div>
                <div className="bbdrts-rails-grid">
                  <div className={`bbdrts-rail-chip ${(currentUser?.gcash_number || currentUser?.Gcash_Number) ? 'active' : ''}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#007dfe' }}>qr_code_2</span>
                    <div>
                      <div className="bbdrts-rail-title">GCash Rail</div>
                      <div className="bbdrts-rail-sub">
                        {(currentUser?.gcash_number || currentUser?.Gcash_Number)
                          ? `Active (${formatPhoneNumber(currentUser?.gcash_number || currentUser?.Gcash_Number)})`
                          : 'Not configured'}
                      </div>
                    </div>
                  </div>

                  <div className={`bbdrts-rail-chip ${(currentUser?.maya_number || currentUser?.Maya_Number) ? 'active' : ''}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#00c389' }}>account_balance_wallet</span>
                    <div>
                      <div className="bbdrts-rail-title">Maya Rail</div>
                      <div className="bbdrts-rail-sub">
                        {(currentUser?.maya_number || currentUser?.Maya_Number)
                          ? `Active (${formatPhoneNumber(currentUser?.maya_number || currentUser?.Maya_Number)})`
                          : 'Not configured'}
                      </div>
                    </div>
                  </div>

                  <div className={`bbdrts-rail-chip ${(currentUser?.bank_account_number || currentUser?.Bank_Account_Number || currentUser?.bank_name || currentUser?.bank_details) ? 'active' : ''}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#8b5cf6' }}>account_balance</span>
                    <div>
                      <div className="bbdrts-rail-title">Bank Transfer</div>
                      <div className="bbdrts-rail-sub">
                        {(currentUser?.bank_name || currentUser?.Bank_Name)
                          ? `${currentUser?.bank_name || currentUser?.Bank_Name}`
                          : (currentUser?.bank_details ? 'Configured' : 'Not configured')}
                      </div>
                    </div>
                  </div>

                  <div className="bbdrts-rail-chip active">
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#16a34a' }}>verified_user</span>
                    <div>
                      <div className="bbdrts-rail-title">Gasless Sepolia Audit</div>
                      <div className="bbdrts-rail-sub">Active · Zero Gas Fees</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Accredited NGO Directory & Profile Studio Card (For Donors / Testers) */}
          {!isOrg && !isAdmin && (
            <div className="bbdrts-settings-card">
              <div className="bbdrts-settings-card-header">
                <div className="bbdrts-settings-card-title-wrap">
                  <h4 className="bbdrts-settings-card-title">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#10b981' }}>verified_user</span>
                    Accredited NGO Directory &amp; Profile Studio
                  </h4>
                  <p className="bbdrts-settings-card-desc">
                    View and configure institutional profile inputs for accredited humanitarian partners (e.g. Philippine Red Cross). All fields populate the live public NGO audit profile.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="bbdrts-btn-outline"
                    onClick={() => {
                      setSelectedNgoId(8);
                      setPreviewNgoModalOpen(true);
                    }}
                    title="Open the live Philippine Red Cross profile modal"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                    <span>Preview Philippine Red Cross Profile</span>
                  </button>

                  <button
                    type="button"
                    className="bbdrts-btn-primary"
                    onClick={() => setShowNgoInputs(prev => !prev)}
                    title="Configure organizational profile inputs right here"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit_note</span>
                    <span>{showNgoInputs ? 'Hide NGO Profile Inputs' : 'Configure NGO Profile Inputs'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: REUSABLE QR CODES & PAYOUT RAILS STUDIO
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'qr_library' && (
        <div className="bbdrts-settings-pane fade-in">
          
          {/* Studio Header Card */}
          <div className="bbdrts-settings-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#007dfe' }}>qr_code_2</span>
                  Reusable Payment QR Codes &amp; Payout Rails Studio
                </h4>
                <p className="bbdrts-settings-card-desc">
                  Upload, auto-crop mobile screenshots (removes blue/dark edges), extract recipient account credentials via OCR, and manage verified QR vouchers for instant assignment across all relief campaigns.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="bbdrts-btn-primary"
                  onClick={() => setShowAddQrModal(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add_photo_alternate</span>
                  <span>+ Upload &amp; Extract New QR</span>
                </button>

                <button
                  type="button"
                  className="bbdrts-btn-outline"
                  onClick={handleMassApplyQrDefaults}
                  disabled={isApplyingQrToCamps || savedQrList.length === 0}
                  title="Applies the active default QR codes to any campaign that doesn't have a payout channel yet"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    {isApplyingQrToCamps ? 'hourglass_top' : 'published_with_changes'}
                  </span>
                  <span>{isApplyingQrToCamps ? 'Applying...' : 'Mass-Apply to Campaigns'}</span>
                </button>
              </div>
            </div>

            {/* Filter Pills & Statistics Bar */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {['ALL', 'GCash', 'Maya', 'Bank'].map(filt => {
                  const count = filt === 'ALL' 
                    ? savedQrList.length 
                    : savedQrList.filter(q => q.payment_method === filt).length;
                  return (
                    <button
                      key={filt}
                      type="button"
                      onClick={() => setQrFilter(filt)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '20px',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        border: '1px solid',
                        cursor: 'pointer',
                        transition: 'all 120ms ease',
                        background: qrFilter === filt ? '#ffffff' : 'transparent',
                        color: qrFilter === filt ? '#000000' : 'var(--text-muted)',
                        borderColor: qrFilter === filt ? '#ffffff' : 'var(--border)'
                      }}
                    >
                      {filt === 'ALL' ? 'All Channels' : filt} ({count})
                    </button>
                  );
                })}
              </div>

              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#10b981' }}>verified</span>
                <span>Active defaults auto-route directly into donor payment gateways</span>
              </div>
            </div>
          </div>

          {/* QR Cards Grid */}
          {qrLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '32px', animation: 'spin 1.2s linear infinite' }}>autorenew</span>
              <p style={{ marginTop: '8px', fontSize: '0.85rem' }}>Loading saved payment QR vouchers...</p>
            </div>
          ) : savedQrList.length === 0 ? (
            <div className="bbdrts-settings-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(0, 125, 254, 0.1)', color: '#007dfe', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>qr_code_scanner</span>
              </div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>No Reusable QR Codes in Library Yet</h4>
              <p style={{ margin: '0 auto 18px auto', maxWidth: '420px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Upload your official GCash, Maya, or Bank QR codes once. Our smart cropper will automatically crop away outer mobile phone borders and extract account details via OCR.
              </p>
              <button
                type="button"
                className="bbdrts-btn-primary"
                onClick={() => setShowAddQrModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>upload_file</span>
                <span>Upload First QR Code</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {savedQrList
                .filter(q => qrFilter === 'ALL' || q.payment_method === qrFilter)
                .map(qr => {
                  const isDefault = Boolean(qr.is_default);
                  const isGcash = qr.payment_method === 'GCash';
                  const isMaya = qr.payment_method === 'Maya';
                  const isBank = qr.payment_method === 'Bank';

                  const badgeColor = isGcash ? '#007dfe' : isMaya ? '#00c389' : '#8b5cf6';
                  const badgeBg = isGcash ? 'rgba(0, 125, 254, 0.12)' : isMaya ? 'rgba(0, 195, 137, 0.12)' : 'rgba(139, 92, 246, 0.12)';

                  return (
                    <div
                      key={qr.id}
                      className="bbdrts-qr-card-item"
                      style={{
                        background: 'var(--bg-card, #0d0d0d)',
                        border: isDefault ? '1px solid #10b981' : '1px solid var(--border)',
                        borderRadius: '10px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        position: 'relative',
                        transition: 'all 150ms ease'
                      }}
                    >
                      {/* Card Header: Method Pill + Custom Name + Default Pill */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: badgeBg,
                                color: badgeColor,
                                border: `1px solid ${badgeColor}40`
                              }}
                            >
                              {qr.payment_method}
                            </span>
                            {isDefault && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 600,
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  color: '#10b981',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>star</span>
                                Active Default
                              </span>
                            )}
                          </div>
                          <h5 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {qr.custom_name}
                          </h5>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteQrFromLibrary(qr.id, qr.custom_name, e)}
                          title="Delete QR code from library"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                        </button>
                      </div>

                      {/* QR Thumbnail Preview (Click to Enlarge Lightbox) */}
                      <div
                        onClick={() => setPreviewQrModal(qr)}
                        title="Click to view QR card enlarged"
                        style={{
                          background: '#ffffff',
                          borderRadius: '8px',
                          padding: '10px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        <img
                          src={qr.qr_image_url}
                          alt={qr.custom_name}
                          style={{ maxWidth: '140px', maxHeight: '140px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                        />
                        <div
                          className="bbdrts-qr-hover-zoom"
                          style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'rgba(0, 0, 0, 0.45)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            opacity: 0,
                            transition: 'opacity 150ms ease',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            gap: '4px'
                          }}
                          onMouseEnter={e => e.currentTarget.style.opacity = 1}
                          onMouseLeave={e => e.currentTarget.style.opacity = 0}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>zoom_in</span>
                          <span>Click to Enlarge</span>
                        </div>
                      </div>

                      {/* Extracted Metadata Info */}
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--bg-input, #141414)', padding: '10px', borderRadius: '6px' }}>
                        <div>
                          <strong style={{ color: 'var(--text-muted)' }}>Account Name:</strong>{' '}
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                            {qr.account_name || 'Not extracted'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <strong style={{ color: 'var(--text-muted)' }}>Number:</strong>{' '}
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'monospace' }}>
                              {qr.account_number ? formatPhoneNumber(qr.account_number) : 'Not extracted'}
                            </span>
                          </div>
                          {qr.account_number && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(qr.account_number);
                                showSuccess('Account number copied to clipboard!', 'Copied');
                              }}
                              title="Copy number"
                              style={{ background: 'transparent', border: 'none', color: '#007dfe', cursor: 'pointer', padding: '2px', display: 'flex' }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>content_copy</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Card Footer: Toggle Default Action */}
                      <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                        {isDefault ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10b981', fontSize: '0.74rem', fontWeight: 600 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>check_circle</span>
                            <span>Active Default for {qr.payment_method}</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleDefaultQr(qr)}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              background: 'transparent',
                              border: '1px solid var(--border)',
                              color: 'var(--text-primary)',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '5px',
                              transition: 'all 120ms ease'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.color = '#10b981'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>star_outline</span>
                            <span>Set as Active Default</span>
                          </button>
                        )}
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
          TAB 2: GASLESS BLOCKCHAIN AUDIT & PUBLIC CONTRACT
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'wallet' && (
        <div className="bbdrts-settings-pane">
          <div className="bbdrts-settings-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>verified</span>
                  Gasless Sepolia Blockchain Audit Ledger
                </h4>
                <p className="bbdrts-settings-card-desc">
                  No MetaMask or cryptocurrency wallet is required. BBDRTS automatically notarizes every verified Philippine Peso donation and NGO disbursement proof onto Ethereum Sepolia via our gasless backend relayer.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', fontWeight: 600, color: '#16a34a', padding: '4px 8px', borderRadius: '4px', background: 'rgba(22, 163, 74, 0.1)', border: '1px solid rgba(22, 163, 74, 0.25)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span>
                  Gasless Relayer Active
                </span>
                <span style={{ fontSize: '0.74rem', fontFamily: 'monospace', padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-subcard)', border: '1px solid var(--border)' }}>
                  Chain ID: 11155111
                </span>
              </div>
            </div>

            <div className="bbdrts-diag-list">
              <div className="bbdrts-diag-item">
                <span className="bbdrts-diag-label">Public Audit Contract:</span>
                <a
                  href={`https://sepolia.etherscan.io/address/${contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#16a34a', fontFamily: 'monospace', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>{contractAddress}</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
                </a>
              </div>

              <div className="bbdrts-diag-item">
                <span className="bbdrts-diag-label">Network Protocol:</span>
                <span className="bbdrts-diag-value status-ok">● Ethereum Sepolia (Chain ID 11155111)</span>
              </div>

              <div className="bbdrts-diag-item">
                <span className="bbdrts-diag-label">Supported Payment Rails:</span>
                <span className="bbdrts-diag-value">GCash (QR Ph) · Maya · Bank Transfer · Credit / Debit Card (PHP)</span>
              </div>

              <div className="bbdrts-diag-item">
                <span className="bbdrts-diag-label">Gas Fees for Users:</span>
                <span className="bbdrts-diag-value status-ok">₱0 (Sponsored by BBDRTS Gasless Relayer)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 3: PREFERENCES & THEME
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'preferences' && (
        <div className="bbdrts-settings-pane">

          {/* Visual Appearance & Theme Selection */}
          <div className="bbdrts-settings-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>palette</span>
                  Visual Appearance & Theme
                </h4>
                <p className="bbdrts-settings-card-desc">
                  Choose your interface theme. Preferences are saved automatically.
                </p>
              </div>
            </div>

            <div className="bbdrts-theme-cards-grid">
              {/* Option 1: Light Mode */}
              <div
                className={`bbdrts-theme-card-option ${activeThemeChoice === 'light' ? 'active' : ''}`}
                onClick={() => {
                  if (setTheme) setTheme('light');
                  showSuccess('Light Mode enabled.', 'Theme Updated');
                }}
              >
                <div className="bbdrts-theme-preview-icon">
                  <span className="material-symbols-outlined">light_mode</span>
                </div>
                <div className="bbdrts-theme-option-text">
                  <span className="bbdrts-theme-option-title">Light Mode</span>
                  <span className="bbdrts-theme-option-desc">Clean white canvas with soft borders and high-contrast typography.</span>
                </div>
                {activeThemeChoice === 'light' && (
                  <span className="material-symbols-outlined bbdrts-theme-active-icon">check_circle</span>
                )}
              </div>

              {/* Option 2: Dark Mode */}
              <div
                className={`bbdrts-theme-card-option ${activeThemeChoice === 'dark' ? 'active' : ''}`}
                onClick={() => {
                  if (setTheme) setTheme('dark');
                  showSuccess('Dark Mode enabled.', 'Theme Updated');
                }}
              >
                <div className="bbdrts-theme-preview-icon">
                  <span className="material-symbols-outlined">dark_mode</span>
                </div>
                <div className="bbdrts-theme-option-text">
                  <span className="bbdrts-theme-option-title">Dark Mode</span>
                  <span className="bbdrts-theme-option-desc">Deep charcoal and obsidian theme with comfortable contrast.</span>
                </div>
                {activeThemeChoice === 'dark' && (
                  <span className="material-symbols-outlined bbdrts-theme-active-icon">check_circle</span>
                )}
              </div>

              {/* Option 3: System Preference */}
              <div
                className={`bbdrts-theme-card-option ${activeThemeChoice === 'system' ? 'active' : ''}`}
                onClick={() => {
                  if (setTheme) setTheme('system');
                  showSuccess('System Preference theme tracking enabled.', 'Theme Updated');
                }}
              >
                <div className="bbdrts-theme-preview-icon">
                  <span className="material-symbols-outlined">devices</span>
                </div>
                <div className="bbdrts-theme-option-text">
                  <span className="bbdrts-theme-option-title">{wt.systemPreference}</span>
                  <span className="bbdrts-theme-option-desc">{wt.systemPreferenceDesc}</span>
                </div>
                {activeThemeChoice === 'system' && (
                  <span className="material-symbols-outlined bbdrts-theme-active-icon">check_circle</span>
                )}
              </div>
            </div>
          </div>

          {/* Interface Presentation Mode (Standard vs Simplified) */}
          <div className="bbdrts-settings-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>tune</span>
                  Interface Presentation Mode
                </h4>
                <p className="bbdrts-settings-card-desc">
                  Select your preferred information density and dashboard layout structure. Both modes belong to the same BBDRTS application and retain full functionality.
                </p>
              </div>
              <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#16a34a' }}>
                Active: {interfaceMode === 'simplified' ? 'Simplified Mode' : 'Standard Mode'}
              </span>
            </div>

            <div className="bbdrts-theme-cards-grid">
              {/* Option 1: Standard Mode */}
              <div
                className={`bbdrts-theme-card-option ${interfaceMode === 'standard' ? 'active' : ''}`}
                onClick={() => {
                  if (setInterfaceMode) setInterfaceMode('standard');
                  showSuccess('Standard Mode enabled with full operational telemetry.', 'Interface Mode Updated');
                }}
              >
                <div className="bbdrts-theme-preview-icon">
                  <span className="material-symbols-outlined">dashboard</span>
                </div>
                <div className="bbdrts-theme-option-text">
                  <span className="bbdrts-theme-option-title">Standard Mode (Default)</span>
                  <span className="bbdrts-theme-option-desc">Complete platform capabilities, comprehensive metric telemetry, on-chain contract hashes, and advanced operational controls.</span>
                </div>
                {interfaceMode === 'standard' && (
                  <span className="material-symbols-outlined bbdrts-theme-active-icon">check_circle</span>
                )}
              </div>

              {/* Option 2: Simplified Mode */}
              <div
                className={`bbdrts-theme-card-option ${interfaceMode === 'simplified' ? 'active' : ''}`}
                onClick={() => {
                  if (setInterfaceMode) setInterfaceMode('simplified');
                  showSuccess('Simplified Mode enabled with streamlined presentation.', 'Interface Mode Updated');
                }}
              >
                <div className="bbdrts-theme-preview-icon">
                  <span className="material-symbols-outlined">volunteer_activism</span>
                </div>
                <div className="bbdrts-theme-option-text">
                  <span className="bbdrts-theme-option-title">Simplified Mode</span>
                  <span className="bbdrts-theme-option-desc">Streamlined presentation with intuitive content hierarchy, plain-language summaries, and prominent primary actions with reduced visual clutter.</span>
                </div>
                {interfaceMode === 'simplified' && (
                  <span className="material-symbols-outlined bbdrts-theme-active-icon">check_circle</span>
                )}
              </div>
            </div>
          </div>

          {/* Typography Scaling Card */}
          <div className="bbdrts-settings-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>format_size</span>
                  Interface Typography Sizing
                </h4>
                <p className="bbdrts-settings-card-desc">
                  Scale text sizes across dashboards, campaign cards, tables, and dialogs.
                </p>
              </div>

              <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#16a34a' }}>
                Active: {TEXT_SIZE_OPTIONS.find(o => o.id === activeTextSize)?.name || 'Standard'}
              </span>
            </div>

            <div className="bbdrts-type-scale-grid">
              {TEXT_SIZE_OPTIONS.map((opt) => {
                const isActive = activeTextSize === opt.id;
                return (
                  <div
                    key={opt.id}
                    className={`bbdrts-type-scale-card ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelectTextSize(opt.id)}
                  >
                    <div className="bbdrts-type-scale-info">
                      <span className="bbdrts-type-scale-name">{opt.name}</span>
                      <span className="bbdrts-type-scale-pct">{opt.scale} scale</span>
                    </div>
                    {isActive && (
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#16a34a' }}>check</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Platform Language Preference */}
          <div className="bbdrts-settings-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>translate</span>
                  {wt.platformLanguageTitle}
                </h4>
                <p className="bbdrts-settings-card-desc">
                  {wt.platformLanguageDesc}
                </p>
              </div>
              <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#16a34a' }}>
                {wt.langName}
              </span>
            </div>

            <div className="bbdrts-theme-cards-grid">
              {[
                { id: 'en', title: 'English (Philippines)', desc: 'Standard operational & legal relief terminology.' },
                { id: 'fil', title: 'Filipino / Tagalog', desc: 'Salin sa Filipino para sa mas madaling paggamit.' },
                { id: 'ceb', title: 'Bisaya / Cebuano', desc: 'Gihubad sa Cebuano alang sa Visayas ug Mindanao.' }
              ].map((opt) => (
                <div
                  key={opt.id}
                  className={`bbdrts-theme-card-option ${language === opt.id ? 'active' : ''}`}
                  onClick={() => {
                    if (setLanguage) setLanguage(opt.id);
                    showSuccess(`${opt.title} selected.`, 'Language Updated');
                  }}
                >
                  <div className="bbdrts-theme-preview-icon">
                    <span className="material-symbols-outlined">language</span>
                  </div>
                  <div className="bbdrts-theme-option-text">
                    <span className="bbdrts-theme-option-title">{opt.title}</span>
                    <span className="bbdrts-theme-option-desc">{opt.desc}</span>
                  </div>
                  {language === opt.id && (
                    <span className="material-symbols-outlined bbdrts-theme-active-icon">check_circle</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Visual & Cognitive Accessibility Controls */}
          <div className="bbdrts-settings-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>accessibility_new</span>
                  {wt.accessibilityControlsTitle}
                </h4>
                <p className="bbdrts-settings-card-desc">
                  {wt.accessibilityControlsDesc}
                </p>
              </div>
            </div>

            <div className="bbdrts-pref-list">
              <div
                className="bbdrts-pref-item"
                onClick={() => {
                  const next = !reducedMotion;
                  if (setReducedMotion) setReducedMotion(next);
                  showSuccess(`Reduced Motion ${next ? 'enabled' : 'disabled'}.`, 'Workspace Updated');
                }}
              >
                <div className="bbdrts-pref-info">
                  <span className="bbdrts-pref-label">{wt.reducedMotionLabel}</span>
                  <span className="bbdrts-pref-desc">{wt.reducedMotionDesc}</span>
                </div>
                <div className={`bbdrts-toggle-track ${reducedMotion ? 'active' : ''}`}>
                  <div className="bbdrts-toggle-thumb" />
                </div>
              </div>

              <div
                className="bbdrts-pref-item"
                onClick={() => {
                  const next = !highContrast;
                  if (setHighContrast) setHighContrast(next);
                  showSuccess(`High Contrast Mode ${next ? 'enabled' : 'disabled'}.`, 'Workspace Updated');
                }}
              >
                <div className="bbdrts-pref-info">
                  <span className="bbdrts-pref-label">{wt.highContrastLabel}</span>
                  <span className="bbdrts-pref-desc">{wt.highContrastDesc}</span>
                </div>
                <div className={`bbdrts-toggle-track ${highContrast ? 'active' : ''}`}>
                  <div className="bbdrts-toggle-thumb" />
                </div>
              </div>

              <div
                className="bbdrts-pref-item"
                onClick={() => {
                  const next = !lowBandwidthMode;
                  if (setLowBandwidthMode) setLowBandwidthMode(next);
                  showSuccess(`Data Saver Mode ${next ? 'enabled' : 'disabled'}.`, 'Workspace Updated');
                }}
              >
                <div className="bbdrts-pref-info">
                  <span className="bbdrts-pref-label">{wt.dataSaverLabel}</span>
                  <span className="bbdrts-pref-desc">{wt.dataSaverDesc}</span>
                </div>
                <div className={`bbdrts-toggle-track ${lowBandwidthMode ? 'active' : ''}`}>
                  <div className="bbdrts-toggle-thumb" />
                </div>
              </div>
            </div>
          </div>

          {/* Notifications & Privacy Preferences */}
          <div className="bbdrts-settings-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>notifications</span>
                  Notifications & Privacy
                </h4>
                <p className="bbdrts-settings-card-desc">
                  Manage communication alerts and public visibility options.
                </p>
              </div>
            </div>

            <div className="bbdrts-pref-list">
              <div
                className="bbdrts-pref-item"
                onClick={() => {
                  const nextVal = !emailNotify;
                  setEmailNotify(nextVal);
                  handleTogglePreference('email_receipts', nextVal, `Email contribution receipts ${nextVal ? 'enabled' : 'disabled'}.`);
                }}
              >
                <div className="bbdrts-pref-info">
                  <span className="bbdrts-pref-label">Email Contribution Receipts</span>
                  <span className="bbdrts-pref-desc">Receive tax deduction slips and on-chain verification links via email.</span>
                </div>
                <div className={`bbdrts-toggle-track ${emailNotify ? 'active' : ''}`}>
                  <div className="bbdrts-toggle-thumb" />
                </div>
              </div>

              <div
                className="bbdrts-pref-item"
                onClick={() => {
                  const nextVal = !calamityAlerts;
                  setCalamityAlerts(nextVal);
                  handleTogglePreference('calamity_alerts', nextVal, `Disaster response alerts ${nextVal ? 'enabled' : 'disabled'}.`);
                }}
              >
                <div className="bbdrts-pref-info">
                  <span className="bbdrts-pref-label">Urgent Disaster Calamity Alerts</span>
                  <span className="bbdrts-pref-desc">Instant alerts when severe typhoons, earthquakes, or floods require emergency relief.</span>
                </div>
                <div className={`bbdrts-toggle-track ${calamityAlerts ? 'active' : ''}`}>
                  <div className="bbdrts-toggle-thumb" />
                </div>
              </div>

              {!isOrg && (
                <>
                  <div className="bbdrts-pref-item" onClick={handleToggleAnonymous}>
                    <div className="bbdrts-pref-info">
                      <span className="bbdrts-pref-label">Anonymous Donor Mode</span>
                      <span className="bbdrts-pref-desc">Mask your real name on public campaign donor lists and leaderboards.</span>
                    </div>
                    <div className={`bbdrts-toggle-track ${anonDefault ? 'active' : ''}`}>
                      <div className="bbdrts-toggle-thumb" />
                    </div>
                  </div>

                  <div className="bbdrts-pref-item" onClick={handleToggleBadgeVisibility}>
                    <div className="bbdrts-pref-info">
                      <span className="bbdrts-pref-label">Philanthropic Recognition Badge</span>
                      <span className="bbdrts-pref-desc">Display your humanitarian supporter insignia next to your contributions.</span>
                    </div>
                    <div className={`bbdrts-toggle-track ${showBadge ? 'active' : ''}`}>
                      <div className="bbdrts-toggle-thumb" />
                    </div>
                  </div>
                </>
              )}

              <div
                className="bbdrts-pref-item"
                onClick={() => {
                  const nextVal = !glassFx;
                  setGlassFx(nextVal);
                  handleTogglePreference('glass_fx', nextVal, `Backdrop blur effects ${nextVal ? 'enabled' : 'disabled'}.`);
                }}
              >
                <div className="bbdrts-pref-info">
                  <span className="bbdrts-pref-label">Backdrop Blur Effects</span>
                  <span className="bbdrts-pref-desc">Frosted glass transparency across navigation bars and modal overlays.</span>
                </div>
                <div className={`bbdrts-toggle-track ${glassFx ? 'active' : ''}`}>
                  <div className="bbdrts-toggle-thumb" />
                </div>
              </div>

              {onStartTour && (
                <div
                  className="bbdrts-pref-item"
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
                  <div className="bbdrts-pref-info">
                    <span className="bbdrts-pref-label">Reset Interactive Walkthrough</span>
                    <span className="bbdrts-pref-desc">Replay the guided feature tour for your dashboard.</span>
                  </div>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--text-muted)' }}>
                    play_circle
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 4: SECURITY & SYSTEM STATUS
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'security' && (
        <div className="bbdrts-settings-pane">

          {/* ── Active Account Deletion Grace Period Banner ── */}
          {currentUser?.deletion_scheduled_at && (
            <div className="deletion-grace-banner">
              <div className="deletion-grace-info">
                <span className="material-symbols-outlined deletion-grace-icon">warning</span>
                <div>
                  <div className="deletion-grace-title">
                    Account Deletion Scheduled · 30-Day Grace Period Active
                  </div>
                  <div className="deletion-grace-desc">
                    Your account is scheduled for permanent deactivation on{' '}
                    <strong style={{ color: '#f59e0b' }}>
                      {new Date(currentUser.deletion_effective_at || Date.now()).toLocaleDateString('en-US', {
                        timeZone: 'Asia/Manila',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </strong>{' '}
                    ({Math.max(1, Math.ceil((new Date(currentUser.deletion_effective_at) - new Date()) / 86400000))} days remaining).
                    Historical blockchain transactions and donation proofs remain archived in compliance records (Philippine RA 10173). You can cancel deletion anytime before the deadline.
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn-modern-primary"
                onClick={handleCancelAccountDeletion}
                disabled={cancellingDeletion}
                style={{ flexShrink: 0, padding: '8px 16px', fontSize: '0.80rem' }}
              >
                {cancellingDeletion ? (
                  <>
                    <span className="material-symbols-outlined bbdrts-spin" style={{ fontSize: '14px' }}>sync</span>
                    <span>Restoring...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>undo</span>
                    <span>Cancel Deletion &amp; Restore</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Change Account Password Card */}
          <div className="bbdrts-settings-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>lock</span>
                  Change Account Password
                </h4>
                <p className="bbdrts-settings-card-desc">
                  Update your authentication credentials. Passwords are encrypted using bcrypt hashing with salted rounds.
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="bbdrts-password-section">
              {/* Row 1: Current Password */}
              <div className="bbdrts-field-group">
                <label className="bbdrts-form-label">Current Password</label>
                <div className="bbdrts-input-wrap">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    className="bbdrts-settings-input"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="bbdrts-input-eye-btn"
                    onClick={() => setShowCurrentPassword(p => !p)}
                    tabIndex="-1"
                    title={showCurrentPassword ? 'Hide password' : 'Show password'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                      {showCurrentPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Row 2: New Password & Confirm Password (2-column responsive layout) */}
              <div className="bbdrts-password-grid">
                {/* New Password */}
                <div className="bbdrts-field-group">
                  <div className="bbdrts-label-with-meta">
                    <label className="bbdrts-form-label">New Password</label>
                    {newPassword && (
                      <span className="bbdrts-pwd-strength-badge" style={{ color: newPwdStrength.color }}>
                        {newPwdStrength.label}
                      </span>
                    )}
                  </div>
                  <div className="bbdrts-input-wrap">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      className="bbdrts-settings-input"
                      placeholder="Min. 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="bbdrts-input-eye-btn"
                      onClick={() => setShowNewPassword(p => !p)}
                      tabIndex="-1"
                      title={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                        {showNewPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>

                  {/* Password Strength Progress Bar */}
                  {newPassword && (
                    <div className="bbdrts-pwd-strength-track">
                      <div
                        className="bbdrts-pwd-strength-fill"
                        style={{
                          width: `${newPwdStrength.percent}%`,
                          backgroundColor: newPwdStrength.color
                        }}
                      />
                    </div>
                  )}

                  {/* Criteria Checklist Pills */}
                  <div className="bbdrts-pwd-criteria-row">
                    <span className={`bbdrts-criteria-pill ${newPassword.length >= 8 ? 'met' : ''}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                        {newPassword.length >= 8 ? 'check' : 'circle'}
                      </span>
                      8+ chars
                    </span>
                    <span className={`bbdrts-criteria-pill ${/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) ? 'met' : ''}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                        {/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) ? 'check' : 'circle'}
                      </span>
                      Aa (mixed case)
                    </span>
                    <span className={`bbdrts-criteria-pill ${/\d|[^A-Za-z0-9]/.test(newPassword) ? 'met' : ''}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                        {/\d|[^A-Za-z0-9]/.test(newPassword) ? 'check' : 'circle'}
                      </span>
                      Number / symbol
                    </span>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div className="bbdrts-field-group">
                  <div className="bbdrts-label-with-meta">
                    <label className="bbdrts-form-label">Confirm New Password</label>
                    {passwordsMatch && (
                      <span className="bbdrts-match-pill match">
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>check_circle</span>
                        Match
                      </span>
                    )}
                    {passwordsMismatch && (
                      <span className="bbdrts-match-pill mismatch">
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>error</span>
                        Do not match
                      </span>
                    )}
                  </div>
                  <div className="bbdrts-input-wrap">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="bbdrts-settings-input"
                      placeholder="Repeat new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="bbdrts-input-eye-btn"
                      onClick={() => setShowConfirmPassword(p => !p)}
                      tabIndex="-1"
                      title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                        {showConfirmPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {tfaStatus.enabled && (
                <div className="bbdrts-field-group" style={{ marginTop: '12px' }}>
                  <label className="bbdrts-form-label">2FA Authenticator Code (Required)</label>
                  <div className="bbdrts-input-wrap">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      className="bbdrts-settings-input"
                      placeholder="Enter 6-digit code from authenticator app"
                      value={passwordTfaCode}
                      onChange={(e) => setPasswordTfaCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      autoComplete="one-time-code"
                    />
                  </div>
                </div>
              )}

              {/* Action Bar */}
              <div className="bbdrts-password-actions-bar">
                <span className="bbdrts-password-actions-note">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#10b981' }}>verified_user</span>
                  <span>Bcrypt salted hash with 10 rounds</span>
                </span>
                <button
                  type="submit"
                  className="bbdrts-btn-primary-action"
                  disabled={savingPassword || !currentPassword || !newPassword || passwordsMismatch}
                >
                  {savingPassword ? (
                    <>
                      <span className="material-symbols-outlined bbdrts-spin" style={{ fontSize: '14px' }}>sync</span>
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>key</span>
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              FEATURE 4: TWO-FACTOR AUTHENTICATION (2FA) CARD
              ══════════════════════════════════════════════════════════════════ */}
          <div className="bbdrts-settings-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#10b981' }}>verified_user</span>
                  <span>Two-Factor Authentication (2FA)</span>
                  <span className={`bbdrts-sec-status-badge ${tfaStatus.enabled ? 'active' : 'inactive'}`}>
                    {tfaStatus.enabled ? '● Active' : '○ Not Enabled'}
                  </span>
                </h4>
                <p className="bbdrts-settings-card-desc">
                  Require an additional verification code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, Apple Keychain) each time you sign in.
                </p>
              </div>

              <div className="bbdrts-settings-card-actions">
                {tfaStatus.enabled ? (
                  <button
                    type="button"
                    className="vercel-btn-secondary-sm"
                    onClick={() => {
                      setTfaDisablePassword('');
                      setTfaDisableCode('');
                      setShowTfaDisableModal(true);
                    }}
                    style={{ padding: '6px 14px', height: 'auto', fontSize: '0.8rem' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>lock_open</span>
                    <span>Disable 2FA</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="bbdrts-btn-primary-action"
                    onClick={handleStartTfaSetup}
                    disabled={tfaSubmitting || tfaLoading}
                  >
                    {tfaSubmitting ? (
                      <>
                        <span className="material-symbols-outlined bbdrts-spin" style={{ fontSize: '14px' }}>sync</span>
                        <span>Configuring...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>qr_code_2</span>
                        <span>Set Up Authenticator App</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="bbdrts-sec-card-body">
              {tfaStatus.enabled ? (
                <div className="bbdrts-sec-row">
                  <div className="bbdrts-sec-info">
                    <span className="bbdrts-sec-label">Authenticator App Configured</span>
                    <span className="bbdrts-sec-desc">
                      TOTP verification is enforced on all sign-ins. {tfaStatus.remainingBackupCodes} of {tfaStatus.totalBackupCodes || 8} single-use backup recovery codes remaining.
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#10b981' }}>check_circle</span>
                    <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>Protected</span>
                  </div>
                </div>
              ) : (
                <div className="bbdrts-sec-row">
                  <div className="bbdrts-sec-info">
                    <span className="bbdrts-sec-label">Standard Multi-Factor Protection</span>
                    <span className="bbdrts-sec-desc">
                      When enabled, your account cannot be accessed without both your password and a time-based verification code generated on your personal mobile device.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              FEATURE 5: ACTIVE SESSION MANAGEMENT CARD
              ══════════════════════════════════════════════════════════════════ */}
          <div className="bbdrts-settings-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#0ea5e9' }}>devices</span>
                  <span>Active Sessions &amp; Logged-In Devices</span>
                  <span className="bbdrts-sec-status-badge active">
                    {activeSessions.length} Active {activeSessions.length === 1 ? 'Session' : 'Sessions'}
                  </span>
                </h4>
                <p className="bbdrts-settings-card-desc">
                  View and manage all authenticated sessions across desktop, mobile, and web clients. Terminate unrecognized devices immediately.
                </p>
              </div>

              <div className="bbdrts-settings-card-actions">
                <button
                  type="button"
                  className="vercel-btn-secondary-sm"
                  onClick={handleRevokeAllOtherSessions}
                  disabled={revokingAllOthers || activeSessions.filter(s => !s.isCurrent).length === 0}
                  style={{ padding: '6px 14px', height: 'auto', fontSize: '0.8rem' }}
                >
                  {revokingAllOthers ? (
                    <>
                      <span className="material-symbols-outlined bbdrts-spin" style={{ fontSize: '14px' }}>sync</span>
                      <span>Revoking...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>logout</span>
                      <span>Sign Out All Other Sessions</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="bbdrts-sec-card-body">
              {sessionsLoading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted, #71717a)', fontSize: '0.85rem' }}>
                  <span className="material-symbols-outlined bbdrts-spin" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '6px' }}>sync</span>
                  Loading active sessions...
                </div>
              ) : activeSessions.length === 0 ? (
                <div style={{ padding: '16px', color: 'var(--text-muted, #71717a)', fontSize: '0.8rem' }}>
                  No active session records found.
                </div>
              ) : (
                <div className="bbdrts-sessions-list">
                  {activeSessions.map((session, idx) => (
                    <div key={session.sessionId || idx} className="bbdrts-session-card">
                      <div className="bbdrts-session-left">
                        <div className="bbdrts-session-icon-wrap">
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                            {session.deviceType === 'Mobile Phone' ? 'smartphone' : session.deviceType === 'Tablet' ? 'tablet' : 'desktop_windows'}
                          </span>
                        </div>
                        <div className="bbdrts-session-details">
                          <div className="bbdrts-session-title">
                            <span>{session.os || 'Unknown OS'} · {session.browser || 'Web Browser'}</span>
                            {session.isCurrent && (
                              <span className="bbdrts-current-pill">This Device</span>
                            )}
                          </div>
                          <div className="bbdrts-session-meta">
                            <span>{session.location || 'Regional Station'}</span>
                            <span>•</span>
                            <span>IP: {session.ip || '127.0.0.1'}</span>
                            <span>•</span>
                            <span>Active: {session.lastActiveAt ? new Date(session.lastActiveAt).toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'short', timeStyle: 'short' }) : 'Now'}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        {session.isCurrent ? (
                          <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>Active Now</span>
                        ) : (
                          <button
                            type="button"
                            className="vercel-btn-secondary-sm"
                            onClick={() => handleRevokeSession(session.sessionId)}
                            disabled={revokingSessionId === session.sessionId}
                          >
                            {revokingSessionId === session.sessionId ? (
                              <span className="material-symbols-outlined bbdrts-spin" style={{ fontSize: '14px' }}>sync</span>
                            ) : (
                              <>
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                                <span>Revoke</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              FEATURE 7: EMAIL ADDRESS & VERIFICATION MANAGEMENT CARD
              ══════════════════════════════════════════════════════════════════ */}
          <div className="bbdrts-settings-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#8b5cf6' }}>alternate_email</span>
                  <span>Primary Account Email</span>
                  <span className="bbdrts-sec-status-badge active">
                    ● Verified
                  </span>
                </h4>
                <p className="bbdrts-settings-card-desc">
                  Your verified login handle and notification destination. Changing email requires verification of the new address before activation.
                </p>
              </div>

              <div className="bbdrts-settings-card-actions">
                <button
                  type="button"
                  className="bbdrts-btn-primary-action"
                  onClick={() => {
                    setNewEmailInput('');
                    setEmailChangePassword('');
                    setEmailChangeSuccess(false);
                    setShowEmailChangeModal(true);
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>edit</span>
                  <span>Change Email</span>
                </button>
              </div>
            </div>

            <div className="bbdrts-sec-card-body">
              <div className="bbdrts-sec-row">
                <div className="bbdrts-sec-info">
                  <span className="bbdrts-sec-label">{currentUser?.email || 'Authorized User Email'}</span>
                  <span className="bbdrts-sec-desc">
                    Dual verification safeguard: an alert is sent to this address with an emergency cancel option whenever an update is requested.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* System Health Overview */}
          <div className="bbdrts-settings-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>health_and_safety</span>
                  Real-Time System &amp; Infrastructure Health
                </h4>
                <p className="bbdrts-settings-card-desc">
                  Status of blockchain nodes, smart contracts, and database synchronization.
                </p>
              </div>
            </div>

            <div className="bbdrts-diag-list">
              <div className="bbdrts-diag-item">
                <span className="bbdrts-diag-label">Sepolia EVM RPC Gateway:</span>
                <span className="bbdrts-diag-value status-ok">● Connected &amp; Operational</span>
              </div>
              <div className="bbdrts-diag-item">
                <span className="bbdrts-diag-label">Smart Contract Milestone Vault:</span>
                <span className="bbdrts-diag-value status-ok">● Active (OpenZeppelin Secure)</span>
              </div>
              <div className="bbdrts-diag-item">
                <span className="bbdrts-diag-label">Relief Ledger Database:</span>
                <span className="bbdrts-diag-value status-ok">● Synchronized</span>
              </div>
              <div className="bbdrts-diag-item">
                <span className="bbdrts-diag-label">Authentication Session:</span>
                <span className="bbdrts-diag-value">JWT Secure Session (Active)</span>
              </div>
            </div>
          </div>

          {/* Account Danger Zone: Deletion & Sign Out */}
          <div className="bbdrts-settings-card bbdrts-danger-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title" style={{ color: '#ef4444' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#ef4444' }}>person_remove</span>
                  <span>Request Account Deletion (30-Day Grace Period)</span>
                </h4>
                <p className="bbdrts-settings-card-desc">
                  Initiate permanent account closure. Your account enters a mandatory 30-day grace period with instant 1-click restoration upon login. All historical transactions and donation proofs remain archived in administrative compliance records (Philippine RA 10173).
                </p>
              </div>

              <div className="bbdrts-settings-card-actions">
                {currentUser?.deletion_scheduled_at ? (
                  <button
                    type="button"
                    className="btn-modern-primary"
                    onClick={handleCancelAccountDeletion}
                    disabled={cancellingDeletion}
                    style={{ padding: '6px 14px', height: 'auto', fontSize: '0.8rem' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>undo</span>
                    <span>Cancel Pending Deletion</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-modern-outline-danger"
                    onClick={() => {
                      setDeleteConfirmationPhrase('');
                      setDeletePassword('');
                      setDelete2faCode('');
                      setDeleteWizardStep(1);
                      setShowDeleteAccountModal(true);
                    }}
                    style={{ padding: '6px 14px', height: 'auto', fontSize: '0.8rem' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>delete_forever</span>
                    <span>Request Deletion</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bbdrts-settings-card bbdrts-danger-card">
            <div className="bbdrts-settings-card-header">
              <div className="bbdrts-settings-card-title-wrap">
                <h4 className="bbdrts-settings-card-title" style={{ color: '#ef4444' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#ef4444' }}>logout</span>
                  <span>Sign Out of Account</span>
                </h4>
                <p className="bbdrts-settings-card-desc">
                  Safely conclude your active session. You can sign back in at any time.
                </p>
              </div>

              <div className="bbdrts-settings-card-actions">
                <button
                  type="button"
                  className="bbdrts-danger-btn"
                  onClick={handleLogout}
                  style={{ padding: '6px 14px', height: 'auto', fontSize: '0.8rem' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>logout</span>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

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
