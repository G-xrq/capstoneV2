import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import TermsPolicyModal from '../components/TermsPolicyModal';
import OtpPinBoxes from '../components/OtpPinBoxes';
import './AuthView.css';

import { API_URL, apiFetch } from '../config';

export default function AuthView({ onLoginSuccess, onBack, theme, onToggleTheme, initialMode = 'login', initialRole = 'donor' }) {
  const [isRegistering, setIsRegistering] = useState(initialMode === 'register');
  const [role, setRole] = useState(initialRole === 'organization' ? 'organization' : 'donor');

  useEffect(() => {
    setIsRegistering(initialMode === 'register');
  }, [initialMode]);

  useEffect(() => {
    if (initialRole) {
      setRole(initialRole === 'organization' ? 'organization' : 'donor');
    }
  }, [initialRole]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [isRegistering]);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [legalModal, setLegalModal] = useState({ open: false, tab: 'agreement' });
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [secRegistrationNo, setSecRegistrationNo] = useState('');
  const [boardMembers, setBoardMembers] = useState('');
  const [dswdAccreditationNo, setDswdAccreditationNo] = useState('');
  const [secCertificateUrl, setSecCertificateUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [stats, setStats] = useState({ donors: '3', orgs: '2', campaigns: '6' });

  const handleSecCertUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.type.includes('pdf')) {
      setError('Please upload a valid image or PDF document.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setSecCertificateUrl(uploadEvent.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleAutofillDemoSecNgo = () => {
    setOrgName('Philippine Red Cross - Southern Leyte Chapter');
    setSecRegistrationNo('SEC-CN2021-08492');
    setDswdAccreditationNo('DSWD-SB-A-2024-0193');
    setBoardMembers('Chairman: Richard Gordon | SecGen: Gwendolyn Pang | Trustee: Dr. Benjamin Go');
    setEmail('redcross.leyte@gmail.com');
    setPassword('Password123!');
    setConfirmPassword('Password123!');

    // Generate realistic SEC Non-Stock Certificate SVG
    const secCertSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400"><rect width="600" height="400" fill="#fdfbf7" stroke="#b45309" stroke-width="6" rx="8"/><rect x="15" y="15" width="570" height="370" fill="none" stroke="#d97706" stroke-width="2" stroke-dasharray="8 4"/><text x="300" y="60" font-family="Georgia, serif" font-size="16" font-weight="bold" fill="#78350f" text-anchor="middle">REPUBLIC OF THE PHILIPPINES</text><text x="300" y="85" font-family="Georgia, serif" font-size="20" font-weight="bold" fill="#b45309" text-anchor="middle">SECURITIES AND EXCHANGE COMMISSION</text><text x="300" y="110" font-family="sans-serif" font-size="12" fill="#92400e" text-anchor="middle">SEC Building, EDSA, Greenhills, Mandaluyong City</text><line x1="100" y1="125" x2="500" y2="125" stroke="#b45309" stroke-width="2"/><text x="300" y="160" font-family="Georgia, serif" font-size="22" font-style="italic" fill="#1e293b" text-anchor="middle">CERTIFICATE OF INCORPORATION</text><text x="300" y="195" font-family="sans-serif" font-size="14" fill="#334155" text-anchor="middle">This is to certify that</text><text x="300" y="230" font-family="Georgia, serif" font-size="20" font-weight="bold" fill="#0f172a" text-anchor="middle">PHILIPPINE RED CROSS - SOUTHERN LEYTE CHAPTER</text><text x="300" y="260" font-family="sans-serif" font-size="13" fill="#475569" text-anchor="middle">is registered as a Non-Stock, Non-Profit Humanitarian Corporation</text><text x="300" y="295" font-family="monospace" font-size="15" font-weight="bold" fill="#b45309" text-anchor="middle">COMPANY REG. NO. SEC-CN2021-08492</text><text x="300" y="355" font-family="sans-serif" font-size="11" fill="#64748b" text-anchor="middle">Issued under Republic Act 11232 • Duly Verified & Seal Affixed</text></svg>`;
    const b64 = window.btoa(unescape(encodeURIComponent(secCertSvg)));
    setSecCertificateUrl(`data:image/svg+xml;base64,${b64}`);
  };

  // ── Forgot Password Real Email Link State (60-min Link, Not OTP) ──
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Enter Email, 2: Link Sent
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotDevResetUrl, setForgotDevResetUrl] = useState('');
  const [forgotResendCooldown, setForgotResendCooldown] = useState(0);
  const [forgotResendLoading, setForgotResendLoading] = useState(false);
  const [forgotResendMsg, setForgotResendMsg] = useState('');

  // ── Password Reset Deep Link State (from Email Link) ──
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [resetPasswordFocused, setResetPasswordFocused] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetChecking, setResetChecking] = useState(false);
  const [resetTokenValid, setResetTokenValid] = useState(false);
  const [resetAlreadyUsed, setResetAlreadyUsed] = useState(false);

  // ── Security Alert Deep Link State (Unrecognized Device Login) ──
  const [secureModalOpen, setSecureModalOpen] = useState(false);
  const [secureToken, setSecureToken] = useState('');
  const [secureEmail, setSecureEmail] = useState('');
  const [secureNewPassword, setSecureNewPassword] = useState('');
  const [secureConfirmPassword, setSecureConfirmPassword] = useState('');
  const [showSecureNewPassword, setShowSecureNewPassword] = useState(false);
  const [showSecureConfirmPassword, setShowSecureConfirmPassword] = useState(false);
  const [securePasswordFocused, setSecurePasswordFocused] = useState(false);
  const [secureLoading, setSecureLoading] = useState(false);
  const [secureError, setSecureError] = useState('');
  const [secureSuccess, setSecureSuccess] = useState(false);

  // ── Two-Factor Authentication (2FA) Challenge Modal State ──
  const [twoFactorModalOpen, setTwoFactorModalOpen] = useState(false);
  const [twoFactorTempToken, setTwoFactorTempToken] = useState('');
  const [twoFactorEmail, setTwoFactorEmail] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorRecoveryCode, setTwoFactorRecoveryCode] = useState('');
  const [twoFactorUseBackup, setTwoFactorUseBackup] = useState(false);
  const [twoFactorTrustDevice, setTwoFactorTrustDevice] = useState(false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState('');

  // ── Email Change Link Notification State ──
  const [emailChangeNotice, setEmailChangeNotice] = useState(null); // { verifying, success, error, message }

  // ── Registration Dual-Channel (Email + SMS) Verification State ──
  const [regVerifyOpen, setRegVerifyOpen] = useState(false);
  const [regVerifyOtp, setRegVerifyOtp] = useState('');
  const [regVerifyEmailOtp, setRegVerifyEmailOtp] = useState('');
  const [regVerifySmsOtp, setRegVerifySmsOtp] = useState('');
  const [regVerifyDevCode, setRegVerifyDevCode] = useState('');
  const [regDevEmailCode, setRegDevEmailCode] = useState('');
  const [regDevSmsCode, setRegDevSmsCode] = useState('');
  const [isDualOtpModal, setIsDualOtpModal] = useState(false);
  const [regVerifyLoading, setRegVerifyLoading] = useState(false);
  const [regVerifyError, setRegVerifyError] = useState('');
  const [regCountdown, setRegCountdown] = useState(300);
  const [regResendCooldown, setRegResendCooldown] = useState(0);
  const [regResendLoading, setRegResendLoading] = useState(false);
  const [regResendMsg, setRegResendMsg] = useState('');
  const [simulatedSmsToast, setSimulatedSmsToast] = useState(null);
  const [showSimulatedPhoneModal, setShowSimulatedPhoneModal] = useState(false);

  // ── Email OTP Login State (Instant Login via Email Passcode) ──
  const [otpLoginOpen, setOtpLoginOpen] = useState(false);
  const [otpLoginStep, setOtpLoginStep] = useState(1); // 1: Enter Email, 2: Enter Code
  const [otpLoginEmail, setOtpLoginEmail] = useState('');
  const [otpLoginCode, setOtpLoginCode] = useState('');
  const [otpLoginLoading, setOtpLoginLoading] = useState(false);
  const [otpLoginError, setOtpLoginError] = useState('');
  const [otpLoginDevCode, setOtpLoginDevCode] = useState('');
  const [otpLoginCountdown, setOtpLoginCountdown] = useState(300);
  const [otpLoginResendCooldown, setOtpLoginResendCooldown] = useState(0);
  const [otpLoginResendLoading, setOtpLoginResendLoading] = useState(false);
  const [otpLoginResendMsg, setOtpLoginResendMsg] = useState('');

  // Safe API Response Parser
  const parseApiResponse = async (response) => {
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      if (text && (text.includes('<!DOCTYPE') || text.includes('<html'))) {
        throw new Error('Backend server is offline. Please ensure backend is running on port 3001.');
      }
      throw new Error('Invalid response received from server.');
    }
    if (!response.ok) {
      throw new Error(data?.error || 'Request failed.');
    }
    return data;
  };

  useEffect(() => {
    fetch(`${API_URL}/api/public-stats`)
      .then(async res => {
        const text = await res.text();
        try { return JSON.parse(text); } catch { return null; }
      })
      .then(data => {
        if (data && typeof data === 'object') {
          setStats({
            donors: String(data.donors || '3'),
            orgs: String(data.orgs || '2'),
            campaigns: String(data.campaigns || '6')
          });
        }
      })
      .catch(err => console.warn('Using fallback stats', err));
  }, []);

  // ── Deep Link & Route Detection (Password Reset & Device Security Alert) ──
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const pathname = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);

    const tokenFromPath = pathname.startsWith('/reset-password/')
      ? pathname.replace('/reset-password/', '').split('/')[0].split('?')[0]
      : null;
    const tokenFromQuery = searchParams.get('token') || searchParams.get('resetToken');
    const emailParam = searchParams.get('email') || '';
    const actionParam = searchParams.get('action') || '';

    const effectiveToken = tokenFromPath || tokenFromQuery;

    if (actionParam === 'secure-account') {
      setSecureModalOpen(true);
      if (effectiveToken) setSecureToken(effectiveToken);
      if (emailParam) setSecureEmail(emailParam);
    } else if (actionParam === 'forgot-password') {
      setForgotOpen(true);
      setForgotStep(1);
      if (emailParam) setForgotEmail(emailParam);
    } else if (actionParam === 'verify-email-change' && effectiveToken) {
      setEmailChangeNotice({ verifying: true, success: false, error: '', message: 'Verifying your new email address...' });
      apiFetch(`${API_URL}/api/auth/verify-email-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: effectiveToken })
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            setEmailChangeNotice({ verifying: false, success: true, message: data.message || 'Email address successfully updated! You can now log in.' });
          } else {
            setEmailChangeNotice({ verifying: false, success: false, error: data.error || 'Failed to verify email change link.' });
          }
        })
        .catch(err => {
          setEmailChangeNotice({ verifying: false, success: false, error: err.message });
        });
    } else if (actionParam === 'cancel-email-change' && effectiveToken) {
      setEmailChangeNotice({ verifying: true, success: false, error: '', message: 'Processing account security request...' });
      apiFetch(`${API_URL}/api/auth/cancel-email-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: effectiveToken })
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.success) {
            setEmailChangeNotice({
              verifying: false,
              success: true,
              reverted: !!data.reverted,
              cancelled: !!data.cancelled,
              alreadyReverted: !!data.alreadyReverted,
              originalEmail: data.originalEmail,
              message: data.message || 'Account successfully secured and restored!'
            });
            if (data.originalEmail) {
              setEmail(data.originalEmail);
            }
          } else {
            setEmailChangeNotice({
              verifying: false,
              success: false,
              error: data.error || 'Failed to cancel email change request.'
            });
          }
        })
        .catch(err => {
          setEmailChangeNotice({ verifying: false, success: false, error: err.message });
        });
    } else if (effectiveToken) {
      setResetModalOpen(true);
      setResetToken(effectiveToken);
      setResetEmail(emailParam);
      setResetChecking(true);
      setResetTokenValid(false);
      setResetAlreadyUsed(false);
      setResetError('');

      apiFetch(`${API_URL}/api/auth/verify-reset-token?token=${encodeURIComponent(effectiveToken)}`)
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.valid) {
            setResetTokenValid(true);
            if (data.email) setResetEmail(data.email);
          } else {
            setResetTokenValid(false);
            if (data.alreadyUsed) setResetAlreadyUsed(true);
            setResetError(data.error || 'This password reset link is invalid or has already been used.');
          }
        })
        .catch(() => {
          setResetTokenValid(false);
          setResetError('Unable to verify reset link. Please check your internet connection or request a new link.');
        })
        .finally(() => {
          setResetChecking(false);
        });
    }
  }, []);

  // ── Expiration Countdown Timers ──


  useEffect(() => {
    let timer = null;
    if (regVerifyOpen && regCountdown > 0) {
      timer = setInterval(() => setRegCountdown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [regVerifyOpen, regCountdown]);

  useEffect(() => {
    let timer = null;
    if (otpLoginOpen && otpLoginStep === 2 && otpLoginCountdown > 0) {
      timer = setInterval(() => setOtpLoginCountdown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [otpLoginOpen, otpLoginStep, otpLoginCountdown]);

  // ── Resend Cooldown Timers (60 seconds) ──
  useEffect(() => {
    let timer = null;
    if (forgotResendCooldown > 0) {
      timer = setInterval(() => setForgotResendCooldown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [forgotResendCooldown]);

  useEffect(() => {
    let timer = null;
    if (regResendCooldown > 0) {
      timer = setInterval(() => setRegResendCooldown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [regResendCooldown]);

  useEffect(() => {
    let timer = null;
    if (otpLoginResendCooldown > 0) {
      timer = setInterval(() => setOtpLoginResendCooldown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [otpLoginResendCooldown]);

  // Global keyboard listener so hitting 'Enter' anywhere in auth view proceeds immediately
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key !== 'Enter') return;
      if (loading || regVerifyLoading || otpLoginLoading || forgotLoading) return;

      if (regVerifyOpen) {
        e.preventDefault();
        handleVerifyRegistrationOtp(e);
      } else if (otpLoginOpen) {
        e.preventDefault();
        if (otpLoginStep === 1) handleOtpLoginRequest(e);
        else if (otpLoginStep === 2) handleOtpLoginVerify(e);
      } else if (forgotOpen) {
        if (forgotStep === 1) {
          e.preventDefault();
          handleForgotRequestLink(e);
        }
      } else if (resetModalOpen) {
        e.preventDefault();
        handleResetPasswordSubmit(e);
      } else if (secureModalOpen) {
        e.preventDefault();
        handleSecureAccountSubmit(e);
      } else if (!isRegistering) {
        if (email && password) {
          e.preventDefault();
          handleSubmit(e);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    regVerifyOpen, otpLoginOpen, otpLoginStep, forgotOpen, forgotStep,
    resetModalOpen, secureModalOpen,
    isRegistering, email, password, loading, regVerifyLoading, otpLoginLoading, forgotLoading,
    regVerifyEmailOtp, regVerifySmsOtp, regVerifyOtp, otpLoginCode, forgotEmail, resetNewPassword, resetConfirmPassword
  ]);

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Password Strength Evaluator
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

  const pwdStrength = getPasswordStrength(password);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const resetPwdStrength = getPasswordStrength(resetNewPassword);
  const resetPasswordRequirements = useMemo(() => [
    { id: 'length', label: 'At least 8 characters', met: resetNewPassword.length >= 8 },
    { id: 'uppercase', label: 'At least 1 uppercase letter (A–Z)', met: /[A-Z]/.test(resetNewPassword) },
    { id: 'lowercase', label: 'At least 1 lowercase letter (a–z)', met: /[a-z]/.test(resetNewPassword) },
    { id: 'number', label: 'At least 1 number (0–9)', met: /\d/.test(resetNewPassword) },
    { id: 'symbol', label: 'At least 1 special symbol (@$!%*?)', met: /[!@#$%^&*(),.?":{}|<>]/.test(resetNewPassword) }
  ], [resetNewPassword]);
  const resetMetRequirementsCount = useMemo(() => resetPasswordRequirements.filter(r => r.met).length, [resetPasswordRequirements]);
  const resetPasswordsMatch = resetConfirmPassword.length > 0 && resetNewPassword === resetConfirmPassword;
  const resetPasswordsMismatch = resetConfirmPassword.length > 0 && resetNewPassword !== resetConfirmPassword;

  const securePwdStrength = getPasswordStrength(secureNewPassword);
  const securePasswordRequirements = useMemo(() => [
    { id: 'length', label: 'At least 8 characters', met: secureNewPassword.length >= 8 },
    { id: 'uppercase', label: 'At least 1 uppercase letter (A–Z)', met: /[A-Z]/.test(secureNewPassword) },
    { id: 'lowercase', label: 'At least 1 lowercase letter (a–z)', met: /[a-z]/.test(secureNewPassword) },
    { id: 'number', label: 'At least 1 number (0–9)', met: /\d/.test(secureNewPassword) },
    { id: 'symbol', label: 'At least 1 special symbol (@$!%*?)', met: /[!@#$%^&*(),.?":{}|<>]/.test(secureNewPassword) }
  ], [secureNewPassword]);
  const secureMetRequirementsCount = useMemo(() => securePasswordRequirements.filter(r => r.met).length, [securePasswordRequirements]);
  const securePasswordsMatch = secureConfirmPassword.length > 0 && secureNewPassword === secureConfirmPassword;
  const securePasswordsMismatch = secureConfirmPassword.length > 0 && secureNewPassword !== secureConfirmPassword;

  // Live real-time password requirements list for floating dropdown
  const passwordRequirements = useMemo(() => [
    {
      id: 'length',
      label: 'At least 8 characters',
      met: password.length >= 8
    },
    {
      id: 'uppercase',
      label: 'At least 1 uppercase letter (A–Z)',
      met: /[A-Z]/.test(password)
    },
    {
      id: 'lowercase',
      label: 'At least 1 lowercase letter (a–z)',
      met: /[a-z]/.test(password)
    },
    {
      id: 'number',
      label: 'At least 1 number (0–9)',
      met: /\d/.test(password)
    },
    {
      id: 'symbol',
      label: 'At least 1 special symbol (@$!%*?)',
      met: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    }
  ], [password]);

  const metRequirementsCount = useMemo(() => {
    return passwordRequirements.filter(r => r.met).length;
  }, [passwordRequirements]);

  // Live real-time missing requirements generator
  const livePwdFeedback = useMemo(() => {
    if (!password) {
      return {
        text: 'Must be 8+ characters with uppercase, lowercase, numbers & symbols.',
        isComplete: false,
        color: '#94a3b8'
      };
    }

    const missing = [];
    if (password.length < 8) missing.push('8+ characters');
    if (!/[A-Z]/.test(password)) missing.push('uppercase (A-Z)');
    if (!/[a-z]/.test(password)) missing.push('lowercase (a-z)');
    if (!/\d/.test(password)) missing.push('number (0-9)');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) missing.push('symbol (@$!%*?)');

    if (missing.length === 0) {
      return {
        text: 'Great password! All requirements satisfied.',
        isComplete: true,
        color: '#22c55e'
      };
    }

    return {
      text: `Still needed: ${missing.join(', ')}.`,
      isComplete: false,
      color: missing.length <= 2 ? '#f59e0b' : '#ef4444'
    };
  }, [password]);

  const liveResetPwdFeedback = useMemo(() => {
    if (!resetNewPassword) {
      return {
        text: 'Must be 8+ characters with uppercase, lowercase, numbers & symbols.',
        isComplete: false,
        color: '#94a3b8'
      };
    }

    const missing = [];
    if (resetNewPassword.length < 8) missing.push('8+ characters');
    if (!/[A-Z]/.test(resetNewPassword)) missing.push('uppercase (A-Z)');
    if (!/[a-z]/.test(resetNewPassword)) missing.push('lowercase (a-z)');
    if (!/\d/.test(resetNewPassword)) missing.push('number (0-9)');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(resetNewPassword)) missing.push('symbol (@$!%*?)');

    if (missing.length === 0) {
      return {
        text: 'Great password! All requirements satisfied.',
        isComplete: true,
        color: '#22c55e'
      };
    }

    return {
      text: `Still needed: ${missing.join(', ')}.`,
      isComplete: false,
      color: missing.length <= 2 ? '#f59e0b' : '#ef4444'
    };
  }, [resetNewPassword]);

  // Fast, responsive settling helper (0-100ms max to prevent UI flicker)
  const simulateDelay = (ms = 100) => new Promise(resolve => setTimeout(resolve, Math.min(ms, 100)));

  // ── Form Submission Handler (Login vs Registration with Email Verification) ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isRegistering) {
      if (!agreedToTerms) {
        setError('Please review and check the agreement box for the User Agreement, Terms of Service, and Privacy Policy (RA 10173).');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please verify your password confirmation.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }

      // Step 1 of Registration: Request real verification OTP (Dual Email+SMS for NGO, Email for Donor)
      setLoading(true);
      try {
        const computedName = role === 'donor'
          ? `${firstName.trim()} ${lastName.trim()}`.trim()
          : orgName.trim();

        const computedDisplayName = role === 'donor'
          ? (firstName.trim() ? `${firstName.trim()} ${lastName.trim()}`.trim() : 'Verified Donor')
          : orgName.trim();

        const [response] = await Promise.all([
          apiFetch(`${API_URL}/api/auth/register-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: computedName || (role === 'donor' ? 'Anonymous Donor' : 'Relief Organization'),
              displayName: computedDisplayName,
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              orgName: orgName.trim(),
              email,
              password,
              role,
              mobileNumber: mobileNumber.trim(),
              secRegistrationNo: secRegistrationNo.trim(),
              secCertificateUrl: secCertificateUrl,
              boardMembers: boardMembers.trim(),
              dswdAccreditationNo: dswdAccreditationNo.trim()
            })
          }),
          simulateDelay(850)
        ]);
        const data = await parseApiResponse(response);

        setIsDualOtpModal(Boolean(data.isDualOtp));
        if (data.devEmailCode) setRegDevEmailCode(data.devEmailCode);
        if (data.devSmsCode) setRegDevSmsCode(data.devSmsCode);
        if (data.devCode) setRegVerifyDevCode(data.devCode);
        if (data.simulatedSms) setSimulatedSmsToast(data.simulatedSms);

        setRegVerifyOtp('');
        setRegVerifyEmailOtp('');
        setRegVerifySmsOtp('');
        setRegVerifyError('');
        setRegResendMsg('');
        setRegCountdown(300);
        setRegResendCooldown(60);
        setRegVerifyOpen(true);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Standard Login
    setLoading(true);
    try {
      const cleanLoginEmail = email.trim().toLowerCase();
      const normalizedRole = String(role || 'donor').toLowerCase();
      const scopedTrustKey = `bbdrts_trusted_device_${normalizedRole}_${cleanLoginEmail}`;
      const legacyTrustKey = `bbdrts_trusted_device_${cleanLoginEmail}`;
      const clientTrustToken = localStorage.getItem(scopedTrustKey) || localStorage.getItem(legacyTrustKey) || null;
      const response = await apiFetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role, trustedDeviceToken: clientTrustToken })
      });
      const data = await parseApiResponse(response);

      // Feature 4: Two-Factor Authentication Check
      if (data.requires2FA) {
        if (clientTrustToken) {
          try {
            localStorage.removeItem(scopedTrustKey);
            localStorage.removeItem(legacyTrustKey);
          } catch (_) {}
        }
        setTwoFactorTempToken(data.tempToken);
        setTwoFactorEmail(data.email || email);
        setTwoFactorCode('');
        setTwoFactorRecoveryCode('');
        setTwoFactorUseBackup(false);
        setTwoFactorTrustDevice(false);
        setTwoFactorError('');
        setTwoFactorModalOpen(true);
        setLoading(false);
        return;
      }

      localStorage.setItem('bbdrts_token', data.token);
      if (data.user?.role) {
        localStorage.setItem('bbdrts_role', data.user.role);
      }
      // Ensure existing users logging in do not auto-trigger new user onboarding
      localStorage.removeItem('bbdrts_tour_force_launch');
      localStorage.removeItem('bbdrts_is_new_registration');
      localStorage.removeItem('bbdrts_needs_onboarding');
      // Slight delay so the user sees the button loading spinner before the full workspace transition
      await new Promise(r => setTimeout(r, 450));
      onLoginSuccess?.(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Two-Factor Authentication Verification Handler ──
  const handleVerify2FA = async (e, directCode = null) => {
    if (e && e.preventDefault) e.preventDefault();
    setTwoFactorError('');

    const effectiveCode = (typeof directCode === 'string' ? directCode : twoFactorCode).replace(/\D/g, '');
    if (!twoFactorUseBackup) {
      if (effectiveCode.length !== 6) return;
    } else {
      if (twoFactorRecoveryCode.trim().length < 8) return;
    }

    setTwoFactorLoading(true);

    try {
      const payload = {
        tempToken: twoFactorTempToken,
        trustDevice: twoFactorTrustDevice,
        ...(twoFactorUseBackup
          ? { recoveryCode: twoFactorRecoveryCode.trim() }
          : { code: effectiveCode })
      };

      const response = await apiFetch(`${API_URL}/api/auth/login-2fa-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await parseApiResponse(response);

      if (data.trustedDeviceToken) {
        const resolvedEmail = String(data.user?.email || twoFactorEmail || email).trim().toLowerCase();
        const resolvedRole = String(data.user?.role || role || 'donor').toLowerCase();
        localStorage.setItem(`bbdrts_trusted_device_${resolvedRole}_${resolvedEmail}`, data.trustedDeviceToken);
      }

      setTwoFactorModalOpen(false);
      localStorage.setItem('bbdrts_token', data.token);
      if (data.user?.role) {
        localStorage.setItem('bbdrts_role', data.user.role);
      }
      localStorage.removeItem('bbdrts_tour_force_launch');
      localStorage.removeItem('bbdrts_is_new_registration');
      localStorage.removeItem('bbdrts_needs_onboarding');
      await new Promise(r => setTimeout(r, 350));
      onLoginSuccess?.(data.user, data.token);
    } catch (err) {
      setTwoFactorError(err.message || 'Two-factor verification failed. Please try again.');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  // ── Registration Step 2: Verify Dual Codes (Email + SMS) & Finalize Account ──
  const handleVerifyRegistrationOtp = async (e) => {
    e.preventDefault();
    setRegVerifyError('');
    setRegVerifyLoading(true);

    const payload = isDualOtpModal ? {
      email,
      emailOtp: regVerifyEmailOtp,
      smsOtp: regVerifySmsOtp
    } : {
      email,
      otp: regVerifyOtp
    };

    try {
      const [response] = await Promise.all([
        apiFetch(`${API_URL}/api/auth/register-verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }),
        simulateDelay(850)
      ]);
      const data = await parseApiResponse(response);

      setRegVerifyOpen(false);
      setSimulatedSmsToast(null);
      localStorage.setItem('bbdrts_token', data.token);
      if (data.user?.role) {
        localStorage.setItem('bbdrts_role', data.user.role);
      }
      // Guarantee Guided Spotlight Tour launches immediately ONLY for newly registered accounts
      localStorage.setItem('bbdrts_tour_force_launch', 'true');
      localStorage.setItem('bbdrts_is_new_registration', 'true');
      localStorage.setItem('bbdrts_needs_onboarding', 'true');
      if (data.user?.id) {
        localStorage.removeItem(`bbdrts_tour_donor_${data.user.id}`);
        localStorage.removeItem(`bbdrts_tour_ngo_${data.user.id}`);
      }
      if (data.user?.email) {
        localStorage.removeItem(`bbdrts_tour_donor_${data.user.email}`);
        localStorage.removeItem(`bbdrts_tour_ngo_${data.user.email}`);
      }
      localStorage.removeItem('bbdrts_tour_donor_done');
      localStorage.removeItem('bbdrts_tour_ngo_done');
      onLoginSuccess?.(data.user, data.token, { isNewRegistration: true });
    } catch (err) {
      setRegVerifyError(err.message);
    } finally {
      setRegVerifyLoading(false);
    }
  };

  // ── Resend Registration Code Handler ──
  const handleResendRegOtp = async () => {
    if (regResendCooldown > 0 || regResendLoading) return;
    setRegResendMsg('');
    setRegVerifyError('');
    setRegResendLoading(true);
    try {
      const computedName = role === 'donor'
        ? `${firstName.trim()} ${lastName.trim()}`.trim()
        : orgName.trim();

      const computedDisplayName = role === 'donor'
        ? (firstName.trim() ? `${firstName.trim()} ${lastName.trim()}`.trim() : 'Verified Donor')
        : orgName.trim();

      const [response] = await Promise.all([
        apiFetch(`${API_URL}/api/auth/register-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: computedName || (role === 'donor' ? 'Anonymous Donor' : 'Relief Organization'),
            displayName: computedDisplayName,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            orgName: orgName.trim(),
            email,
            password,
            role,
            mobileNumber: mobileNumber.trim()
          })
        }),
        simulateDelay(750)
      ]);
      const data = await parseApiResponse(response);
      if (data.devEmailCode) setRegDevEmailCode(data.devEmailCode);
      if (data.devSmsCode) setRegDevSmsCode(data.devSmsCode);
      if (data.devCode) setRegVerifyDevCode(data.devCode);
      if (data.simulatedSms) setSimulatedSmsToast(data.simulatedSms);
      setRegResendCooldown(60);
      setRegCountdown(600);
      setRegResendMsg(isDualOtpModal
        ? 'New Email and SMS security codes have been dispatched.'
        : 'A new verification code has been dispatched to your email.');
    } catch (err) {
      setRegVerifyError(err.message);
    } finally {
      setRegResendLoading(false);
    }
  };

  // ── Email OTP Login Step 1: Request Login Code ──
  const handleOtpLoginRequest = async (e) => {
    e.preventDefault();
    if (!otpLoginEmail) return;
    setOtpLoginError('');
    setOtpLoginLoading(true);

    try {
      const [response] = await Promise.all([
        apiFetch(`${API_URL}/api/auth/login-otp-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: otpLoginEmail, role })
        }),
        simulateDelay(800)
      ]);
      const data = await parseApiResponse(response);

      if (data.devCode) {
        setOtpLoginDevCode(data.devCode);
      }
      setOtpLoginCode('');
      setOtpLoginStep(2);
      setOtpLoginCountdown(600);
      setOtpLoginResendCooldown(60);
      setOtpLoginResendMsg('');
    } catch (err) {
      setOtpLoginError(err.message);
    } finally {
      setOtpLoginLoading(false);
    }
  };

  // ── Resend Login Code Handler ──
  const handleResendLoginOtp = async () => {
    if (otpLoginResendCooldown > 0 || otpLoginResendLoading) return;
    setOtpLoginResendMsg('');
    setOtpLoginError('');
    setOtpLoginResendLoading(true);
    try {
      const [response] = await Promise.all([
        apiFetch(`${API_URL}/api/auth/login-otp-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: otpLoginEmail, role })
        }),
        simulateDelay(750)
      ]);
      const data = await parseApiResponse(response);
      if (data.devCode) setOtpLoginDevCode(data.devCode);
      setOtpLoginResendCooldown(60);
      setOtpLoginCountdown(600);
      setOtpLoginResendMsg('A fresh login passcode has been dispatched to your email.');
    } catch (err) {
      setOtpLoginError(err.message);
    } finally {
      setOtpLoginResendLoading(false);
    }
  };

  // ── Email OTP Login Step 2: Verify Code & Direct Login ──
  const handleOtpLoginVerify = async (e) => {
    e.preventDefault();
    setOtpLoginError('');
    setOtpLoginLoading(true);

    try {
      const response = await apiFetch(`${API_URL}/api/auth/login-otp-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpLoginEmail, otp: otpLoginCode })
      });
      const data = await parseApiResponse(response);

      setOtpLoginOpen(false);
      localStorage.setItem('bbdrts_token', data.token);
      if (data.user?.role) {
        localStorage.setItem('bbdrts_role', data.user.role);
      }
      localStorage.removeItem('bbdrts_tour_force_launch');
      localStorage.removeItem('bbdrts_is_new_registration');
      localStorage.removeItem('bbdrts_needs_onboarding');
      // Slight delay so the user sees the button loading spinner before the full workspace transition
      await new Promise(r => setTimeout(r, 450));
      onLoginSuccess?.(data.user, data.token);
    } catch (err) {
      setOtpLoginError(err.message);
    } finally {
      setOtpLoginLoading(false);
    }
  };

  // Direct Admin Access Bypass
  const handleDirectAdminAccess = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      const res = await fetch(`${API_URL}/api/auth/direct-admin`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.token && data.user) {
          localStorage.setItem('bbdrts_token', data.token);
          localStorage.setItem('bbdrts_role', 'admin');
          localStorage.removeItem('bbdrts_needs_onboarding');
          localStorage.removeItem('bbdrts_is_new_registration');
          localStorage.removeItem('bbdrts_tour_force_launch');
          onLoginSuccess?.(data.user, data.token);
          return;
        }
      }
    } catch (err) {
      console.warn('Direct admin API failed, falling back:', err);
    }

    const adminUser = {
      id: 1,
      name: 'System Administrator',
      email: 'admin@bbdrts.gov.ph',
      role: 'admin',
      wallet_address: '0x206e5d8b76c8c4598d1a457493a746535560b771',
      verification_status: 'Approved'
    };
    localStorage.setItem('bbdrts_token', 'direct_admin_access_token');
    localStorage.setItem('bbdrts_role', 'admin');
    localStorage.removeItem('bbdrts_needs_onboarding');
    localStorage.removeItem('bbdrts_is_new_registration');
    localStorage.removeItem('bbdrts_tour_force_launch');
    onLoginSuccess?.(adminUser, 'direct_admin_access_token');
  };

  // ── Forgot Password: Send 60-Minute Reset Link via Dedicated Email ─────────
  const handleForgotRequestLink = async (e) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotError('');
    setForgotLoading(true);

    try {
      const [response] = await Promise.all([
        apiFetch(`${API_URL}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: forgotEmail })
        }),
        simulateDelay(650)
      ]);
      const data = await parseApiResponse(response);

      if (data.resetUrl || data.devResetUrl) {
        setForgotDevResetUrl(data.resetUrl || data.devResetUrl);
      }
      setForgotStep(2); // Link Sent confirmation
      setForgotResendCooldown(60);
      setForgotResendMsg('');
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  // ── Resend Forgot Password Reset Link Handler ──
  const handleResendForgotLink = async () => {
    if (forgotResendCooldown > 0 || forgotResendLoading) return;
    setForgotResendMsg('');
    setForgotError('');
    setForgotResendLoading(true);
    try {
      const [response] = await Promise.all([
        apiFetch(`${API_URL}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: forgotEmail })
        }),
        simulateDelay(650)
      ]);
      const data = await parseApiResponse(response);
      if (data.resetUrl || data.devResetUrl) setForgotDevResetUrl(data.resetUrl || data.devResetUrl);
      setForgotResendCooldown(60);
      setForgotResendMsg('A new password reset link has been dispatched to your email.');
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setForgotResendLoading(false);
    }
  };

  // ── Reset Password via Secure Email Token ──────────────────────────────────
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setResetError('');

    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('New passwords do not match.');
      return;
    }

    if (resetNewPassword.length < 6) {
      setResetError('New password must be at least 6 characters long.');
      return;
    }

    setResetLoading(true);

    try {
      const [response] = await Promise.all([
        apiFetch(`${API_URL}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: resetToken,
            email: resetEmail,
            newPassword: resetNewPassword
          })
        }),
        simulateDelay(750)
      ]);
      await parseApiResponse(response);

      setResetSuccess(true);
      setResetTokenValid(false);
      setResetToken('');
      if (resetEmail) setEmail(resetEmail);
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState({}, document.title, '/');
      }
    } catch (err) {
      setResetError(err.message);
      if (err.message?.toLowerCase().includes('already been used') || err.message?.toLowerCase().includes('expired')) {
        setResetTokenValid(false);
        setResetAlreadyUsed(true);
      }
    } finally {
      setResetLoading(false);
    }
  };

  // ── Secure Account from Unrecognized Device Alert ──────────────────────────
  const handleSecureAccountSubmit = async (e) => {
    e.preventDefault();
    setSecureError('');

    if (secureNewPassword !== secureConfirmPassword) {
      setSecureError('New passwords do not match.');
      return;
    }

    if (secureNewPassword.length < 6) {
      setSecureError('New password must be at least 6 characters long.');
      return;
    }

    setSecureLoading(true);

    try {
      const [response] = await Promise.all([
        apiFetch(`${API_URL}/api/auth/secure-account`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: secureEmail,
            securityToken: secureToken,
            newPassword: secureNewPassword
          })
        }),
        simulateDelay(750)
      ]);
      await parseApiResponse(response);

      setSecureSuccess(true);
      if (secureEmail) setEmail(secureEmail);
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState({}, document.title, '/');
      }
    } catch (err) {
      setSecureError(err.message);
    } finally {
      setSecureLoading(false);
    }
  };

  const handleToggleMode = (registering) => {
    setHasInteracted(true);
    setIsRegistering(registering);
    setError('');
  };

  return (
    <div className="login-split-container">
      {/* Ambient background glow backdrop */}
      <div className="login-ambient-mesh"></div>

      {/* Minimal Top Navigation Controls (since Header & Footer are hidden in focused Auth mode) */}
      <div className="auth-topbar-controls">
        {onBack ? (
          <button
            type="button"
            className="auth-corner-pill"
            onClick={onBack}
            aria-label="Back to landing page"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span>Back to Home</span>
          </button>
        ) : <span />}

        <div className="auth-topbar-right">
          <button
            type="button"
            className="auth-corner-pill"
            onClick={handleDirectAdminAccess}
            title="Direct Access to Administrator Dashboard"
          >
            <span className="material-symbols-outlined">admin_panel_settings</span>
            <span>Admin Access</span>
          </button>

          <button
            type="button"
            className="auth-corner-pill"
            onClick={() => window.dispatchEvent(new CustomEvent('bbdrts_open_onboarding'))}
            title="Interactive UI Prototype: Preview First-Time Personalization Experience"
          >
            <span className="material-symbols-outlined">tune</span>
            <span>Preview</span>
          </button>

          {onToggleTheme && (
            <button
              type="button"
              className="auth-corner-pill icon-only"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="material-symbols-outlined">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="login-form-side fade-in">
        <div className={`login-glass-card ${isRegistering ? 'right-panel-active' : ''} ${hasInteracted ? 'has-interacted' : ''}`}>

          {/* Quick Direct Admin Access Floating Button */}
          {/*}
          <button
            type="button"
            className="bbdrts-auth-floating-admin-btn"
            onClick={handleDirectAdminAccess}
            title="Direct Access to Administrator Dashboard"
          >
            <span className="material-symbols-outlined">admin_panel_settings</span>
            <span>Direct Admin Access</span>
          </button>
          */}

          {/* ===== FORM 1: SIGN IN (RIGHT HALF BY DEFAULT) ===== */}
          <div className="form-panel sign-in-panel">
            <div className="panel-inner">

              {/* Header */}
              <div className="login-header-modern">
                <h2>{role === 'organization' ? 'NGO Portal Login' : 'Donor Portal Login'}</h2>
                <p className="login-header-subtitle">Log in to access your transparent relief portal</p>
              </div>

              {/* Vercel-style Segmented Role Switcher */}
              <div className="role-selector" role="tablist" aria-label="Account Login Role">
                <button
                  type="button"
                  role="tab"
                  aria-selected={role === 'donor'}
                  className={`role-card-opt ${role === 'donor' ? 'active' : ''}`}
                  onClick={() => {
                    setRole('donor');
                    setError('');
                  }}
                >
                  <span className="material-symbols-outlined role-type-icon">person</span>
                  <span className="role-type-label">Donor</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={role === 'organization'}
                  className={`role-card-opt ${role === 'organization' ? 'active' : ''}`}
                  onClick={() => {
                    setRole('organization');
                    setError('');
                  }}
                >
                  <span className="material-symbols-outlined role-type-icon">domain</span>
                  <span className="role-type-label">NGO / Relief Org</span>
                </button>
              </div>

              {/* Login Form */}
              <form className="modern-login-form" onSubmit={handleSubmit}>
                <div className="input-group-modern">
                  <label>{role === 'organization' ? 'OFFICIAL NGO EMAIL' : 'EMAIL ADDRESS'}</label>
                  <div className="input-container">
                    <span className="material-symbols-outlined input-icon">mail</span>
                    <input
                      type="email"
                      placeholder={role === 'organization' ? "contact@redcross.org.ph" : "your.email@gmail.com"}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSubmit(e);
                        }
                      }}
                      required
                    />
                  </div>
                </div>

                <div className="input-group-modern">
                  <label>PASSWORD</label>
                  <div className="input-container">
                    <span className="material-symbols-outlined input-icon">lock</span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSubmit(e);
                        }
                      }}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex="-1"
                    >
                      <span className="material-symbols-outlined">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="login-options">
                  <label className="custom-checkbox">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                    />
                    <span className="checkbox-mark"></span>
                    <span className="checkbox-label">Remember me</span>
                  </label>
                  <button
                    type="button"
                    className="link-modern-btn"
                    onClick={() => {
                      setForgotOpen(true);
                      setForgotStep(1);
                      setForgotError('');
                      setForgotEmail(email);
                    }}
                  >
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="submit"
                  className={`btn-modern-primary ${loading && !isRegistering ? 'loading' : ''}`}
                  disabled={loading}
                >
                  {loading && !isRegistering ? (
                    <>
                      <span className="spinner-before"></span>
                      <span>Logging in...</span>
                    </>
                  ) : (
                    <>
                      <span>Log In</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
                    </>
                  )}
                </button>

                {/* Direct One-Time Email Code Login Button */}
                <button
                  type="button"
                  className="btn-modern-secondary-opt"
                  onClick={() => {
                    setOtpLoginOpen(true);
                    setOtpLoginStep(1);
                    setOtpLoginError('');
                    setOtpLoginEmail(email);
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>mark_email_read</span>
                  <span>Log In with One-Time Email Code</span>
                </button>
              </form>

              <div className="login-divider"><span>OR</span></div>

              {/* Footer Switch */}
              <div className="login-footer-modern">
                <p className="switch-text">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    style={{ border: "none" }}
                    className="switch-link"
                    onClick={() => handleToggleMode(true)}
                  >
                    Sign Up
                  </button>
                </p>
              </div>

            </div>
          </div>

          {/* ===== FORM 2: SIGN UP (LEFT HALF WHEN ACTIVE) ===== */}
          <div className="form-panel sign-up-panel">
            <div className="panel-inner">

              {/* Header */}
              <div className="login-header-modern">
                <h2>Create Account</h2>
                <p className="login-header-subtitle">
                  {role === 'organization' ? 'Register your Non-Governmental Organization (NGO)' : 'Sign up as a Donor (Individual, Group, or Entity)'}
                </p>
              </div>

              {/* Vercel-style Segmented Role Switcher */}
              <div className="role-selector" role="tablist" aria-label="Account Registration Role">
                <button
                  type="button"
                  role="tab"
                  aria-selected={role === 'donor'}
                  className={`role-card-opt ${role === 'donor' ? 'active' : ''}`}
                  onClick={() => {
                    setRole('donor');
                    setError('');
                  }}
                >
                  <span className="material-symbols-outlined role-type-icon">person</span>
                  <span className="role-type-label">Donor</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={role === 'organization'}
                  className={`role-card-opt ${role === 'organization' ? 'active' : ''}`}
                  onClick={() => {
                    setRole('organization');
                    setError('');
                  }}
                >
                  <span className="material-symbols-outlined role-type-icon">domain</span>
                  <span className="role-type-label">NGO / Relief Org</span>
                </button>
              </div>

              {/* Registration Form */}
              <form className="modern-login-form" onSubmit={handleSubmit}>
                {/* Dynamic Role-specific Name Fields with Smooth Transition */}
                <div key={role} className="role-form-fields">
                  {role === 'donor' ? (
                    <div className="input-row-2col">
                      <div className="input-group-modern">
                        <label>FIRST NAME (LEGAL)</label>
                        <div className="input-container">
                          <span className="material-symbols-outlined input-icon">person</span>
                          <input
                            type="text"
                            placeholder="e.g., Gester"
                            value={firstName}
                            onChange={e => setFirstName(e.target.value)}
                            required={isRegistering && role === 'donor'}
                          />
                        </div>
                      </div>
                      <div className="input-group-modern">
                        <label>LAST NAME (LEGAL)</label>
                        <div className="input-container">
                          <span className="material-symbols-outlined input-icon">badge</span>
                          <input
                            type="text"
                            placeholder="e.g., Macaldo"
                            value={lastName}
                            onChange={e => setLastName(e.target.value)}
                            required={isRegistering && role === 'donor'}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="input-group-modern">
                      <label>OFFICIAL NGO / ORGANIZATION NAME</label>
                      <div className="input-container">
                        <span className="material-symbols-outlined input-icon">domain</span>
                        <input
                          type="text"
                          placeholder="e.g., Philippine Red Cross - Southern Leyte Chapter"
                          value={orgName}
                          onChange={e => setOrgName(e.target.value)}
                          required={isRegistering && role === 'organization'}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="input-group-modern">
                  <label>{role === 'organization' ? 'OFFICIAL NGO EMAIL' : 'EMAIL ADDRESS'}</label>
                  <div className="input-container">
                    <span className="material-symbols-outlined input-icon">mail</span>
                    <input
                      type="email"
                      placeholder={role === 'organization' ? "contact@redcross.org.ph" : "your.email@gmail.com"}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required={isRegistering}
                    />
                  </div>
                </div>

                {/* Dedicated Row 1: Password Field with Connected Strength Meter & Floating Requirements */}
                <div className="input-group-modern pwd-input-group">
                  <div className="label-with-strength">
                    <label htmlFor="reg-password">PASSWORD</label>
                    {password && (
                      <span className="pwd-strength-tag" style={{ color: pwdStrength.color }}>
                        {pwdStrength.label}
                      </span>
                    )}
                  </div>
                  <div className={`input-container ${passwordFocused ? 'is-focused' : ''}`}>
                    <span className="material-symbols-outlined input-icon">lock</span>
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      required={isRegistering}
                      autoComplete="new-password"
                      aria-describedby={passwordFocused ? "pwd-requirements-panel" : undefined}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex="-1"
                      aria-label="Toggle password visibility"
                    >
                      <span className="material-symbols-outlined">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>

                  {/* Connected Horizontal Password Strength Indicator Directly Below Input */}
                  <div className="pwd-strength-bar-track" aria-hidden="true">
                    <div
                      className="pwd-strength-bar-fill"
                      style={{
                        width: password ? `${pwdStrength.percent}%` : '0%',
                        backgroundColor: password ? pwdStrength.color : 'transparent'
                      }}
                    />
                  </div>

                  {/* Floating Password Requirements Dropdown Panel (Zero layout shift) */}
                  {passwordFocused && (
                    <div
                      id="pwd-requirements-panel"
                      className="pwd-requirements-dropdown"
                      onMouseDown={(e) => e.preventDefault()}
                      role="tooltip"
                      aria-live="polite"
                    >
                      <div className="pwd-requirements-header">
                        <span className="pwd-requirements-title">PASSWORD REQUIREMENTS</span>
                        <span className={`pwd-requirements-counter ${metRequirementsCount === 5 ? 'all-met' : ''}`}>
                          {metRequirementsCount}/5 met
                        </span>
                      </div>
                      <ul className="pwd-requirements-list">
                        {passwordRequirements.map((req) => (
                          <li
                            key={req.id}
                            className={`pwd-requirement-item ${req.met ? 'is-met' : 'is-unmet'}`}
                          >
                            <span className="material-symbols-outlined pwd-req-icon">
                              {req.met ? 'check_circle' : 'radio_button_unchecked'}
                            </span>
                            <span className="pwd-req-label">{req.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Dedicated Row 2: Confirm Password Field (Full Width Line with Complete Label) */}
                <div className="input-group-modern confirm-pwd-input-group">
                  <div className="label-with-strength">
                    <label htmlFor="reg-confirm-password">CONFIRM PASSWORD</label>
                    {passwordsMatch && (
                      <span className="match-tag success">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check_circle</span>
                        Passwords Match
                      </span>
                    )}
                    {passwordsMismatch && (
                      <span className="match-tag error">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>error</span>
                        Passwords Do Not Match
                      </span>
                    )}
                  </div>
                  <div className="input-container">
                    <span className="material-symbols-outlined input-icon">check</span>
                    <input
                      id="reg-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Repeat password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required={isRegistering}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      tabIndex="-1"
                      aria-label="Toggle confirm password visibility"
                    >
                      <span className="material-symbols-outlined">
                        {showConfirmPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/*
                Smooth NGO Verification Note (CSS-animated, zero layout jump)
                <div className={`input-hint org-hint ${role === 'organization' ? 'visible' : ''}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#22c55e' }}>info</span>
                  <span>NGO accounts undergo Admin verification before campaign creation is unlocked.</span>
                </div>
                */}

                {/* Statutory Terms & Data Privacy Agreement Notice */}
                <div className="auth-legal-notice-box">
                  <label className="auth-legal-checkbox-label">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="auth-legal-checkbox"
                      required
                    />
                    <span className="auth-legal-text">
                      I have read and agree to the{' '}
                      <button
                        type="button"
                        className="auth-legal-link-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setLegalModal({ open: true, tab: 'agreement' });
                        }}
                      >
                        User Agreement
                      </button>
                      ,{' '}
                      <button
                        type="button"
                        className="auth-legal-link-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setLegalModal({ open: true, tab: 'terms' });
                        }}
                      >
                        Terms of Service
                      </button>
                      , and{' '}
                      <button
                        type="button"
                        className="auth-legal-link-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setLegalModal({ open: true, tab: 'privacy' });
                        }}
                      >
                        Privacy Policy (RA 10173)
                      </button>
                      .
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  className={`btn-modern-primary ${loading && isRegistering ? 'loading' : ''}`}
                  disabled={loading}
                >
                  {loading && isRegistering ? (
                    <>
                      <span className="spinner-before"></span>
                      <span>Creating account...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Account</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
                    </>
                  )}
                </button>
              </form>

              <div className="login-divider"><span>OR</span></div>

              {/* Footer Switch */}
              <div className="login-footer-modern">
                <p className="switch-text">
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="switch-link"
                    style={{ textDecoration: "none", border: "none" }}
                    onClick={() => handleToggleMode(false)}
                  >
                    Log In
                  </button>
                </p>
              </div>

            </div>
          </div>

          {/* ===== SLIDING HERO OVERLAY CONTAINER (TRANSFORMS LEFT <-> RIGHT) ===== */}
          <div className="sliding-overlay-container">
            <div className="login-brand-side">

              {/* Top Grouped Section: Brand Identity & Live Metrics */}
              <div className="brand-top-section">
                <div className="brand-header-block">
                  <div className="brand-logo-wrap">
                    <img src="/logo.png" alt="BBDRTS Logo" className="brand-logo-img" />
                  </div>
                  <div className="brand-text-wrap">
                    <div className="brand-title-row">
                      <h1 className="brand-title">BBDRTS</h1>
                      <span className="brand-protocol-pill">PROTOCOL</span>
                    </div>
                    <p className="brand-tagline">
                      Blockchain-Based Donation &amp; Relief Transparency System
                    </p>
                  </div>
                </div>

                {/* Hairline Metric Strip */}
                <div className="brand-metrics-glass-card">
                  <div className="metric-col">
                    <span className="metric-val">{stats.donors}</span>
                    <span className="metric-lbl">ACTIVE DONORS</span>
                  </div>
                  <div className="metric-divider"></div>
                  <div className="metric-col">
                    <span className="metric-val">{stats.orgs}</span>
                    <span className="metric-lbl">VERIFIED NGOS</span>
                  </div>
                  <div className="metric-divider"></div>
                  <div className="metric-col">
                    <span className="metric-val">{stats.campaigns}</span>
                    <span className="metric-lbl">CAMPAIGNS</span>
                  </div>
                </div>
              </div>

              {/* Centerpiece Editorial Mission Statement */}
              <div className="brand-welcome-block">
                <div className="brand-welcome-eyebrow">
                  <span className="material-symbols-outlined">
                    {role === 'organization' ? 'verified_user' : 'favorite'}
                  </span>
                  <span>
                    {role === 'organization' ? 'VERIFIED NGO PORTAL' : 'DISASTER & CHARITY PORTAL'}
                  </span>
                </div>
                <h2 className="brand-welcome-headline">
                  {isRegistering
                    ? (role === 'organization'
                        ? 'Apply as a verified relief organization.'
                        : 'Create your donor portal account.')
                    : (role === 'organization'
                        ? 'Manage campaigns and spending logs.'
                        : 'Track your relief and charity donations.')}
                </h2>
                <p className="brand-welcome-copy">
                  {role === 'organization'
                    ? (isRegistering
                        ? 'Register with SEC or DSWD credentials for admin approval before posting drives and logging spending reports.'
                        : 'Run approved campaigns, verify pending wallet slips, and upload itemized store receipts and delivery proof for donors.')
                    : (isRegistering
                        ? 'Donate in Philippine Pesos via GCash, Maya, cards, or bank transfer—with gasless Sepolia blockchain records and 0% platform fees.'
                        : 'Browse verified campaigns, give via GCash, Maya, cards, or bank transfer, and inspect gasless blockchain records alongside NGO spending proof.')}
                </p>
              </div>

              {/* Bottom Status Pill & Accurate Trust Labels */}
              <div className="brand-footer-block">
                <div className="brand-live-pill">
                  <span className="pulse-dot"></span>
                  <span>Sepolia Network Live</span>
                  <span className="pill-dot-sep">•</span>
                  <span className="pill-subtext">0% Platform Fees</span>
                </div>

                <div className="brand-trust-labels">
                  <div className="trust-badge-item">
                    <span className="material-symbols-outlined">document_scanner</span>
                    <span>AI Slip Checks</span>
                  </div>
                  <div className="trust-badge-item">
                    <span className="material-symbols-outlined">verified</span>
                    <span>Checked NGOs</span>
                  </div>
                  <div className="trust-badge-item">
                    <span className="material-symbols-outlined">volunteer_activism</span>
                    <span>100% Direct Aid</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* ===== ONE-TIME EMAIL CODE (OTP) LOGIN MODAL ===== */}
      {otpLoginOpen && (
        <div className="modal-backdrop-auth">
          <div className="forgot-modal-card">
            <div className="forgot-modal-header">
              <div className="forgot-header-icon">
                <span className="material-symbols-outlined">mark_email_read</span>
              </div>
              <div className="forgot-header-text">
                <h3>Log In with Email Code</h3>
                <p>
                  {otpLoginStep === 1
                    ? 'Enter ANY email address to receive a secure 6-digit one-time login code'
                    : `Enter the 6-digit login code sent to ${otpLoginEmail}`}
                </p>
              </div>
              <button
                type="button"
                className="forgot-close-btn"
                onClick={() => setOtpLoginOpen(false)}
                title="Close"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>

            {otpLoginError && (
              <div className="alert-modern error" style={{ marginBottom: '12px' }}>
                <span className="material-symbols-outlined">warning</span>
                <span>{otpLoginError}</span>
              </div>
            )}

            {otpLoginResendMsg && (
              <div className="otp-success-banner" style={{ marginBottom: '12px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>check_circle</span>
                <span>{otpLoginResendMsg}</span>
              </div>
            )}

            {otpLoginStep === 1 && (
              <form onSubmit={handleOtpLoginRequest} className="forgot-form-body">
                <div className="input-group-modern">
                  <label>YOUR GMAIL / EMAIL ADDRESS</label>
                  <div className="input-container">
                    <span className="material-symbols-outlined input-icon">mail</span>
                    <input
                      type="email"
                      placeholder="your.email@gmail.com"
                      value={otpLoginEmail}
                      onChange={e => setOtpLoginEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="forgot-info-alert">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>verified</span>
                  <span>A secure 6-digit code will be sent to your inbox. This code is valid for 5 minutes.</span>
                </div>

                <div className="forgot-action-row">
                  <button
                    type="button"
                    className="forgot-cancel-btn"
                    onClick={() => setOtpLoginOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-modern-primary"
                    disabled={otpLoginLoading}
                  >
                    {otpLoginLoading ? (
                      <>
                        <span className="spinner-before"></span>
                        <span>Sending Login Code...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Login Code</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>send</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {otpLoginStep === 2 && (
              <form onSubmit={handleOtpLoginVerify} className="forgot-form-body">
                {otpLoginDevCode && (
                  <div className="dev-otp-pill">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>terminal</span>
                    <span>Dev Helper Code: <strong>{otpLoginDevCode}</strong></span>
                  </div>
                )}

                <div className="input-group-modern">
                  <div className="label-with-strength">
                    <label>6-DIGIT LOGIN CODE</label>
                    <span className="otp-timer-tag">
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>timer</span>
                      Expires in: {formatTimer(otpLoginCountdown)}
                    </span>
                  </div>
                  <OtpPinBoxes value={otpLoginCode} onChange={setOtpLoginCode} onSubmit={handleOtpLoginVerify} />
                </div>

                <div className="otp-resend-row">
                  <span>Didn't receive the code?</span>
                  <button
                    type="button"
                    className="otp-resend-btn"
                    disabled={otpLoginResendCooldown > 0 || otpLoginResendLoading}
                    onClick={handleResendLoginOtp}
                  >
                    <span className={`material-symbols-outlined ${otpLoginResendLoading ? 'btn-resend-spinning' : ''}`} style={{ fontSize: '14px' }}>
                      sync
                    </span>
                    <span>{otpLoginResendCooldown > 0 ? `Resend in ${otpLoginResendCooldown}s` : 'Resend Code'}</span>
                  </button>
                </div>

                <div className="forgot-info-alert">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>mail</span>
                  <span>Please check your inbox (and Spam/Junk folder if not seen within a few seconds).</span>
                </div>

                <div className="forgot-action-row">
                  <button
                    type="button"
                    className="forgot-cancel-btn"
                    onClick={() => setOtpLoginStep(1)}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="btn-modern-primary"
                    disabled={otpLoginLoading || otpLoginCountdown === 0 || otpLoginCode.length < 6}
                  >
                    {otpLoginLoading ? (
                      <>
                        <span className="spinner-before"></span>
                        <span>Logging in...</span>
                      </>
                    ) : (
                      <>
                        <span>Log In</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>login</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ===== REGISTRATION EMAIL VERIFICATION MODAL ===== */}
      {regVerifyOpen && (
        <div className="modal-backdrop-auth">
          <div className="forgot-modal-card" style={{ maxWidth: isDualOtpModal ? '560px' : '480px' }}>

            <div className="forgot-modal-header">
              <div className="forgot-header-icon" style={{ background: role === 'organization' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(34, 197, 94, 0.15)', color: role === 'organization' ? '#38bdf8' : '#22c55e' }}>
                <span className="material-symbols-outlined">{role === 'organization' ? 'domain_verification' : 'mark_email_unread'}</span>
              </div>
              <div className="forgot-header-text">
                <h3>{role === 'organization' ? 'Institutional Identity & SEC Verification' : 'Verify Your Email Address'}</h3>
                <p>
                  {role === 'organization'
                    ? `A 6-digit security code was dispatched to your official NGO email (${email})`
                    : `A 6-digit security code was dispatched to ${email}`}
                </p>
              </div>
              <button
                type="button"
                className="forgot-close-btn"
                onClick={() => setRegVerifyOpen(false)}
                title="Close"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>

            {regVerifyError && (
              <div className="alert-modern error" style={{ marginBottom: '12px' }}>
                <span className="material-symbols-outlined">warning</span>
                <span>{regVerifyError}</span>
              </div>
            )}

            {regResendMsg && (
              <div className="otp-success-banner" style={{ marginBottom: '12px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>check_circle</span>
                <span>{regResendMsg}</span>
              </div>
            )}

            <form onSubmit={handleVerifyRegistrationOtp} className="forgot-form-body">
              {/* Dev Helper Pills for Local Testing */}
              {isDualOtpModal ? (
                (regDevEmailCode || regDevSmsCode) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                    {regDevEmailCode && (
                      <div className="dev-otp-pill" style={{ margin: 0 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>mail</span>
                        <span>Dev Email Code: <strong>{regDevEmailCode}</strong></span>
                      </div>
                    )}
                    {regDevSmsCode && (
                      <div className="dev-otp-pill" style={{ margin: 0, background: 'rgba(56, 189, 248, 0.12)', borderColor: 'rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>smartphone</span>
                        <span>Dev SMS Code: <strong>{regDevSmsCode}</strong></span>
                      </div>
                    )}
                  </div>
                )
              ) : (
                regVerifyDevCode && (
                  <div className="dev-otp-pill">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>terminal</span>
                    <span>Dev Helper Code: <strong>{regVerifyDevCode}</strong></span>
                  </div>
                )
              )}

              {/* ── DUAL OTP CONTAINERS FOR NGO ── */}
              {isDualOtpModal ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  {/* 1. Official Email Code Box */}
                  <div style={{ background: 'var(--bg-subcard, var(--bg-card))', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>mail</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          1. Official Email Code
                        </span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: regVerifyEmailOtp.length === 6 ? '#22c55e' : 'var(--text-muted)', fontWeight: 600 }}>
                        {regVerifyEmailOtp.length === 6 ? '6 Digits Entered' : `Sent to: ${email}`}
                      </span>
                    </div>
                    <OtpPinBoxes value={regVerifyEmailOtp} onChange={setRegVerifyEmailOtp} autoFocus={true} onSubmit={handleVerifyRegistrationOtp} />
                  </div>

                  {/* 2. Authorized Mobile SMS Code Box */}
                  <div style={{ background: 'var(--bg-subcard, var(--bg-card))', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#38bdf8' }}>smartphone</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          2. Mobile SMS Security Code
                        </span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: regVerifySmsOtp.length === 6 ? '#22c55e' : 'var(--text-muted)', fontWeight: 600 }}>
                        {regVerifySmsOtp.length === 6 ? '6 Digits Entered' : `Sent to: ${mobileNumber || 'Registered Mobile'}`}
                      </span>
                    </div>
                    <OtpPinBoxes value={regVerifySmsOtp} onChange={setRegVerifySmsOtp} onSubmit={handleVerifyRegistrationOtp} />

                    {simulatedSmsToast && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setRegVerifySmsOtp(simulatedSmsToast.code)}
                          style={{
                            background: 'rgba(56, 189, 248, 0.12)',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            color: '#38bdf8',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>bolt</span>
                          <span>Auto-Fill SMS Code ({simulatedSmsToast.code})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowSimulatedPhoneModal(true)}
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            color: '#cbd5e1',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>phone_iphone</span>
                          <span>View Phone Screen</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Timer */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <span className="otp-timer-tag">
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>timer</span>
                      Codes expire in: {formatTimer(regCountdown)}
                    </span>
                  </div>
                </div>
              ) : (
                /* ── SINGLE EMAIL OTP CONTAINER FOR DONOR ── */
                <div className="input-group-modern">
                  <div className="label-with-strength">
                    <label>6-DIGIT VERIFICATION CODE</label>
                    <span className="otp-timer-tag">
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>timer</span>
                      Expires in: {formatTimer(regCountdown)}
                    </span>
                  </div>
                  <OtpPinBoxes value={regVerifyOtp} onChange={setRegVerifyOtp} autoFocus={true} onSubmit={handleVerifyRegistrationOtp} />
                </div>
              )}

              <div className="otp-resend-row">
                <span>Didn't receive the codes?</span>
                <button
                  type="button"
                  className="otp-resend-btn"
                  disabled={regResendCooldown > 0 || regResendLoading}
                  onClick={handleResendRegOtp}
                >
                  <span className={`material-symbols-outlined ${regResendLoading ? 'btn-resend-spinning' : ''}`} style={{ fontSize: '14px' }}>
                    sync
                  </span>
                  <span>{regResendCooldown > 0 ? `Resend in ${regResendCooldown}s` : 'Resend Codes'}</span>
                </button>
              </div>

              <div className="forgot-info-alert">
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: role === 'organization' ? '#38bdf8' : '#22c55e' }}>verified</span>
                <span>
                  {role === 'organization'
                    ? 'Verifying your official institutional email ensures verified NGO corporate accreditation under Philippine SEC regulations, legal accountability, and secure disaster relief disbursements.'
                    : 'Verifying your email ensures genuine donor identity, instant receipt generation, and transparent ledger access.'}
                </span>
              </div>

              <div className="forgot-action-row">
                <button
                  type="button"
                  className="forgot-cancel-btn"
                  onClick={() => setRegVerifyOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modern-primary"
                  disabled={
                    regVerifyLoading ||
                    regCountdown === 0 ||
                    (isDualOtpModal
                      ? regVerifyEmailOtp.length < 6 || regVerifySmsOtp.length < 6
                      : regVerifyOtp.length < 6)
                  }
                >
                  {regVerifyLoading ? (
                    <>
                      <span className="spinner-before"></span>
                      <span>Verifying code...</span>
                    </>
                  ) : (
                    <>
                      <span>{isDualOtpModal ? 'Verify Both Codes & Register' : 'Confirm & Complete Registration'}</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ===== SECURE EMAIL LINK PASSWORD RECOVERY MODAL ===== */}
      {forgotOpen && (
        <div className="modal-backdrop-auth">
          <div className="forgot-modal-card">

            <div className="forgot-modal-header">
              <div className="forgot-header-icon">
                <span className="material-symbols-outlined">
                  {forgotStep === 2 ? 'mark_email_read' : 'lock_reset'}
                </span>
              </div>
              <div className="forgot-header-text">
                <h3>{forgotStep === 1 ? 'Reset Your Password' : 'Check Your Email'}</h3>
                <p>
                  {forgotStep === 1
                    ? 'Enter your registered email address to receive a secure password reset link'
                    : `We've sent a 60-minute password reset link to ${forgotEmail}`}
                </p>
              </div>
              <button
                type="button"
                className="forgot-close-btn"
                onClick={() => setForgotOpen(false)}
                title="Close"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>

            {forgotError && (
              <div className="alert-modern error" style={{ marginBottom: '12px' }}>
                <span className="material-symbols-outlined">warning</span>
                <span>{forgotError}</span>
              </div>
            )}

            {forgotResendMsg && (
              <div className="otp-success-banner" style={{ marginBottom: '12px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>check_circle</span>
                <span>{forgotResendMsg}</span>
              </div>
            )}

            {/* ── STEP 1: ENTER REGISTERED EMAIL ── */}
            {forgotStep === 1 && (
              <form onSubmit={handleForgotRequestLink} className="forgot-form-body">
                <div className="input-group-modern">
                  <label>REGISTERED EMAIL ADDRESS</label>
                  <div className="input-container">
                    <span className="material-symbols-outlined input-icon">mail</span>
                    <input
                      type="email"
                      placeholder="your.email@example.com"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="forgot-info-alert">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>verified</span>
                  <span>A secure 60-minute single-use password reset link will be sent from <strong>bbdrts@gmail.com</strong>.</span>
                </div>

                <div className="forgot-action-row">
                  <button
                    type="button"
                    className="forgot-cancel-btn"
                    onClick={() => setForgotOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-modern-primary"
                    disabled={forgotLoading || !forgotEmail}
                  >
                    {forgotLoading ? (
                      <>
                        <span className="spinner-before"></span>
                        <span>Sending Link...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Reset Link</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>send</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* ── STEP 2: LINK DISPATCHED CONFIRMATION ── */}
            {forgotStep === 2 && (
              <div className="forgot-form-body">
                <div className="forgot-info-alert">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>mark_email_read</span>
                  <span>Click the button in the email sent to <strong>{forgotEmail}</strong> to reset your password. The link is single-use and expires in 60 minutes.</span>
                </div>

                <div className="forgot-info-alert" style={{ background: 'transparent', borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#71717a' }}>info</span>
                  <span>If you don't see the email within a minute, please check your spam or junk folder.</span>
                </div>

                <div className="forgot-action-row">
                  <button
                    type="button"
                    className="forgot-cancel-btn"
                    disabled={forgotResendCooldown > 0 || forgotResendLoading}
                    onClick={handleResendForgotLink}
                  >
                    {forgotResendCooldown > 0 ? `Resend in ${forgotResendCooldown}s` : 'Resend Email'}
                  </button>

                  <button
                    type="button"
                    className="btn-modern-primary"
                    onClick={() => setForgotOpen(false)}
                  >
                    <span>Back to Log In</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ===== SET NEW PASSWORD MODAL (FROM EMAIL LINK) ===== */}
      {resetModalOpen && (
        <div className="modal-backdrop-auth">
          <div className="forgot-modal-card">
            <div className="forgot-modal-header">
              <div className="forgot-header-icon">
                <span className="material-symbols-outlined">
                  {resetChecking ? 'sync' : (resetSuccess ? 'verified' : (!resetTokenValid ? 'link_off' : 'lock_reset'))}
                </span>
              </div>
              <div className="forgot-header-text">
                <h3>
                  {resetChecking
                    ? 'Verifying Reset Link...'
                    : (resetSuccess
                      ? 'Password Reset Complete'
                      : (!resetTokenValid
                        ? 'Link Expired or Already Used'
                        : 'Create New Password'))}
                </h3>
                <p>
                  {resetChecking
                    ? 'Checking link validity and security status...'
                    : (resetSuccess
                      ? 'Your account credentials have been securely updated.'
                      : (!resetTokenValid
                        ? 'This password reset link is no longer valid.'
                        : `Choose a new secure password for ${resetEmail || 'your account'}.`))}
                </p>
              </div>
              <button
                type="button"
                className="forgot-close-btn"
                onClick={() => {
                  setResetModalOpen(false);
                  if (typeof window !== 'undefined' && window.history?.replaceState) {
                    window.history.replaceState({}, document.title, '/');
                  }
                }}
                title="Close"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>

            {/* When Checking Token */}
            {resetChecking && (
              <div style={{ padding: '36px 20px', textAlign: 'center', color: '#a1a1aa' }}>
                <span className="spinner-modern" style={{ width: '28px', height: '28px', marginBottom: '14px', display: 'inline-block' }}></span>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Verifying secure link with BBDRTS...</p>
              </div>
            )}

            {/* When Link is Invalid / Expired / Already Used */}
            {!resetChecking && !resetTokenValid && !resetSuccess && (
              <div className="forgot-form-body">
                <div className="forgot-info-alert" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#ef4444' }}>error</span>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '3px' }}>Single-Use Security Policy</strong>
                    <span>{resetError || 'This password reset link has already been used to change credentials, or has expired (60-minute limit). For security, each reset link can only be used once.'}</span>
                  </div>
                </div>

                <div className="forgot-action-row">
                  <button
                    type="button"
                    className="forgot-cancel-btn"
                    onClick={() => {
                      setResetModalOpen(false);
                      if (typeof window !== 'undefined' && window.history?.replaceState) {
                        window.history.replaceState({}, document.title, '/');
                      }
                    }}
                  >
                    Back to Log In
                  </button>
                  <button
                    type="button"
                    className="btn-modern-primary"
                    onClick={() => {
                      setResetModalOpen(false);
                      setForgotOpen(true);
                      setForgotStep(1);
                      if (resetEmail) setForgotEmail(resetEmail);
                      if (typeof window !== 'undefined' && window.history?.replaceState) {
                        window.history.replaceState({}, document.title, '/');
                      }
                    }}
                  >
                    <span>Request New Link</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                  </button>
                </div>
              </div>
            )}

            {/* When Valid: Form */}
            {!resetChecking && resetTokenValid && !resetSuccess && (
              <form onSubmit={handleResetPasswordSubmit} className="forgot-form-body">
                {resetError && (
                  <div className="alert-modern error" style={{ marginBottom: '12px' }}>
                    <span className="material-symbols-outlined">warning</span>
                    <span>{resetError}</span>
                  </div>
                )}

                <div className="input-group-modern" style={{ position: 'relative' }}>
                  <div className="label-with-strength" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ margin: 0 }}>NEW PASSWORD</label>
                    {resetNewPassword && (
                      <span className="pwd-strength-tag" style={{ color: resetPwdStrength.color }}>
                        {resetPwdStrength.label}
                      </span>
                    )}
                  </div>
                  <div className="input-container">
                    <span className="material-symbols-outlined input-icon">lock</span>
                    <input
                      type={showResetNewPassword ? 'text' : 'password'}
                      placeholder="Enter new password (8+ characters)"
                      value={resetNewPassword}
                      onChange={e => setResetNewPassword(e.target.value)}
                      onFocus={() => setResetPasswordFocused(true)}
                      onBlur={() => setTimeout(() => setResetPasswordFocused(false), 200)}
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowResetNewPassword(!showResetNewPassword)}
                      tabIndex="-1"
                      aria-label="Toggle password visibility"
                    >
                      <span className="material-symbols-outlined">
                        {showResetNewPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>

                  {/* Connected Horizontal Password Strength Indicator Directly Below Input */}
                  <div className="pwd-strength-bar-track" aria-hidden="true" style={{ marginTop: '6px' }}>
                    <div
                      className="pwd-strength-bar-fill"
                      style={{
                        width: resetNewPassword ? `${resetPwdStrength.percent}%` : '0%',
                        backgroundColor: resetNewPassword ? resetPwdStrength.color : 'transparent'
                      }}
                    />
                  </div>

                  {/* Floating Password Requirements Dropdown Panel (Zero layout shift) */}
                  {resetPasswordFocused && (
                    <div
                      id="reset-pwd-requirements-panel"
                      className="pwd-requirements-dropdown"
                      onMouseDown={(e) => e.preventDefault()}
                      role="tooltip"
                      aria-live="polite"
                    >
                      <div className="pwd-requirements-header">
                        <span className="pwd-requirements-title">PASSWORD REQUIREMENTS</span>
                        <span className={`pwd-requirements-counter ${resetMetRequirementsCount === 5 ? 'all-met' : ''}`}>
                          {resetMetRequirementsCount}/5 met
                        </span>
                      </div>
                      <ul className="pwd-requirements-list">
                        {resetPasswordRequirements.map((req) => (
                          <li
                            key={req.id}
                            className={`pwd-requirement-item ${req.met ? 'is-met' : 'is-unmet'}`}
                          >
                            <span className="material-symbols-outlined pwd-req-icon">
                              {req.met ? 'check_circle' : 'radio_button_unchecked'}
                            </span>
                            <span className="pwd-req-label">{req.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="input-group-modern confirm-pwd-input-group">
                  <div className="label-with-strength" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ margin: 0 }}>CONFIRM NEW PASSWORD</label>
                    {resetPasswordsMatch && (
                      <span className="match-tag success">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check_circle</span>
                        Passwords Match
                      </span>
                    )}
                    {resetPasswordsMismatch && (
                      <span className="match-tag error">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>error</span>
                        Passwords Do Not Match
                      </span>
                    )}
                  </div>
                  <div className="input-container">
                    <span className="material-symbols-outlined input-icon">check</span>
                    <input
                      type={showResetConfirmPassword ? 'text' : 'password'}
                      placeholder="Repeat new password"
                      value={resetConfirmPassword}
                      onChange={e => setResetConfirmPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                      tabIndex="-1"
                      aria-label="Toggle confirm password visibility"
                    >
                      <span className="material-symbols-outlined">
                        {showResetConfirmPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="forgot-info-alert">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>verified</span>
                  <span>Once saved, your new credentials take effect immediately across all sessions.</span>
                </div>

                <div className="forgot-action-row">
                  <button
                    type="button"
                    className="forgot-cancel-btn"
                    onClick={() => setResetModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-modern-primary"
                    disabled={resetLoading || resetMetRequirementsCount < 5 || !resetPasswordsMatch}
                  >
                    {resetLoading ? (
                      <>
                        <span className="spinner-before"></span>
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <span>Reset Password</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Success State */}
            {resetSuccess && (
              <div className="forgot-form-body">
                <div className="forgot-info-alert">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>verified</span>
                  <span>Your account password has been updated securely. You can now log in with your new credentials.</span>
                </div>
                <div className="forgot-action-row" style={{ gridTemplateColumns: '1fr' }}>
                  <button
                    type="button"
                    className="btn-modern-primary"
                    onClick={() => {
                      setResetModalOpen(false);
                      setIsRegistering(false);
                      if (typeof window !== 'undefined' && window.history?.replaceState) {
                        window.history.replaceState({}, document.title, '/');
                      }
                    }}
                  >
                    <span>Log In Now</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== EMERGENCY SECURE ACCOUNT MODAL (FROM DEVICE ALERT EMAIL) ===== */}
      {secureModalOpen && (
        <div className="modal-backdrop-auth">
          <div className="forgot-modal-card" style={{ border: '1px solid rgba(239, 68, 68, 0.4)' }}>
            <div className="forgot-modal-header">
              <div className="forgot-header-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
                <span className="material-symbols-outlined">
                  {secureSuccess ? 'gpp_good' : 'gpp_maybe'}
                </span>
              </div>
              <div className="forgot-header-text">
                <h3 style={{ color: '#ef4444' }}>
                  {secureSuccess ? 'Account Secured' : 'Secure Your Account'}
                </h3>
                <p>
                  {secureSuccess
                    ? 'All active sessions on other devices were terminated.'
                    : `Unrecognized device sign-in detected for ${secureEmail || 'your account'}`}
                </p>
              </div>
              <button
                type="button"
                className="forgot-close-btn"
                onClick={() => setSecureModalOpen(false)}
                title="Close"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>

            {secureError && (
              <div className="alert-modern error" style={{ marginBottom: '12px' }}>
                <span className="material-symbols-outlined">warning</span>
                <span>{secureError}</span>
              </div>
            )}

            {!secureSuccess ? (
              <form onSubmit={handleSecureAccountSubmit} className="forgot-form-body">
                <div className="forgot-info-alert" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#ef4444' }}>warning</span>
                  <span>Setting a new password will immediately terminate all active logins across other devices and revoke unrecognized sessions.</span>
                </div>

                <div className="input-group-modern" style={{ position: 'relative' }}>
                  <div className="label-with-strength" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ margin: 0 }}>NEW SECURE PASSWORD</label>
                    {secureNewPassword && (
                      <span className="pwd-strength-tag" style={{ color: securePwdStrength.color }}>
                        {securePwdStrength.label}
                      </span>
                    )}
                  </div>
                  <div className="input-container">
                    <span className="material-symbols-outlined input-icon">lock</span>
                    <input
                      type={showSecureNewPassword ? 'text' : 'password'}
                      placeholder="Enter new password (8+ characters)"
                      value={secureNewPassword}
                      onChange={e => setSecureNewPassword(e.target.value)}
                      onFocus={() => setSecurePasswordFocused(true)}
                      onBlur={() => setTimeout(() => setSecurePasswordFocused(false), 200)}
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowSecureNewPassword(!showSecureNewPassword)}
                      tabIndex="-1"
                      aria-label="Toggle password visibility"
                    >
                      <span className="material-symbols-outlined">
                        {showSecureNewPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>

                  {/* Connected Horizontal Password Strength Indicator */}
                  <div className="pwd-strength-bar-track" aria-hidden="true" style={{ marginTop: '6px' }}>
                    <div
                      className="pwd-strength-bar-fill"
                      style={{
                        width: secureNewPassword ? `${securePwdStrength.percent}%` : '0%',
                        backgroundColor: secureNewPassword ? securePwdStrength.color : 'transparent'
                      }}
                    />
                  </div>

                  {/* Floating Password Requirements Dropdown Panel */}
                  {securePasswordFocused && (
                    <div
                      id="secure-pwd-requirements-panel"
                      className="pwd-requirements-dropdown"
                      onMouseDown={(e) => e.preventDefault()}
                      role="tooltip"
                      aria-live="polite"
                    >
                      <div className="pwd-requirements-header">
                        <span className="pwd-requirements-title">PASSWORD REQUIREMENTS</span>
                        <span className={`pwd-requirements-counter ${secureMetRequirementsCount === 5 ? 'all-met' : ''}`}>
                          {secureMetRequirementsCount}/5 met
                        </span>
                      </div>
                      <ul className="pwd-requirements-list">
                        {securePasswordRequirements.map((req) => (
                          <li
                            key={req.id}
                            className={`pwd-requirement-item ${req.met ? 'is-met' : 'is-unmet'}`}
                          >
                            <span className="material-symbols-outlined pwd-req-icon">
                              {req.met ? 'check_circle' : 'radio_button_unchecked'}
                            </span>
                            <span className="pwd-req-label">{req.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="input-group-modern confirm-pwd-input-group">
                  <div className="label-with-strength" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ margin: 0 }}>CONFIRM NEW PASSWORD</label>
                    {securePasswordsMatch && (
                      <span className="match-tag success">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check_circle</span>
                        Passwords Match
                      </span>
                    )}
                    {securePasswordsMismatch && (
                      <span className="match-tag error">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>error</span>
                        Passwords Do Not Match
                      </span>
                    )}
                  </div>
                  <div className="input-container">
                    <span className="material-symbols-outlined input-icon">check</span>
                    <input
                      type={showSecureConfirmPassword ? 'text' : 'password'}
                      placeholder="Repeat new password"
                      value={secureConfirmPassword}
                      onChange={e => setSecureConfirmPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowSecureConfirmPassword(!showSecureConfirmPassword)}
                      tabIndex="-1"
                      aria-label="Toggle confirm password visibility"
                    >
                      <span className="material-symbols-outlined">
                        {showSecureConfirmPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="forgot-action-row">
                  <button
                    type="button"
                    className="forgot-cancel-btn"
                    onClick={() => setSecureModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-modern-primary"
                    style={{ background: '#ef4444', borderColor: '#ef4444', color: '#ffffff' }}
                    disabled={secureLoading || secureMetRequirementsCount < 5 || !securePasswordsMatch}
                  >
                    {secureLoading ? (
                      <>
                        <span className="spinner-before"></span>
                        <span>Securing Account...</span>
                      </>
                    ) : (
                      <>
                        <span>Secure Account & Reset</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>shield</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="forgot-form-body">
                <div className="forgot-info-alert">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>verified_user</span>
                  <span>All unauthorized sessions on other devices have been zeroized and your password has been securely updated.</span>
                </div>
                <div className="forgot-action-row" style={{ gridTemplateColumns: '1fr' }}>
                  <button
                    type="button"
                    className="btn-modern-primary"
                    onClick={() => {
                      setSecureModalOpen(false);
                      setIsRegistering(false);
                    }}
                  >
                    <span>Log In Securely</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== REALISTIC SIMULATED MOBILE SMS PUSH NOTIFICATION BANNER ===== */}
      {simulatedSmsToast && (
        <div className="simulated-sms-push-banner">
          <div className="sim-sms-header">
            <div className="sim-sms-app-badge">
              <div className="sim-sms-app-icon">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chat</span>
              </div>
              <span>Messages · now</span>
              <span className="sim-sms-carrier-tag">
                <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>signal_cellular_alt</span>
                {simulatedSmsToast.carrier}
              </span>
            </div>
            <button
              type="button"
              className="sim-sms-close-btn"
              onClick={() => setSimulatedSmsToast(null)}
              title="Dismiss SMS notification"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
            </button>
          </div>

          <div className="sim-sms-body">
            <div className="sim-sms-sender-row">
              <span>{simulatedSmsToast.sender}</span>
              <span className="sim-sms-to-tag">To: {simulatedSmsToast.recipient}</span>
            </div>
            <div className="sim-sms-content">
              {simulatedSmsToast.text}
            </div>
          </div>

          <div className="sim-sms-actions">
            <button
              type="button"
              className="sim-sms-autofill-btn"
              onClick={() => {
                setRegVerifySmsOtp(simulatedSmsToast.code);
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>bolt</span>
              <span>Auto-Fill SMS Code ({simulatedSmsToast.code})</span>
            </button>
            <button
              type="button"
              className="sim-sms-phone-btn"
              onClick={() => setShowSimulatedPhoneModal(true)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>smartphone</span>
              <span>View Phone</span>
            </button>
          </div>
        </div>
      )}

      {/* ===== FULL SIMULATED SMARTPHONE MODAL ===== */}
      {showSimulatedPhoneModal && simulatedSmsToast && (
        <div className="sim-phone-overlay" onClick={() => setShowSimulatedPhoneModal(false)}>
          <div className="sim-phone-handset" onClick={e => e.stopPropagation()}>
            {/* Notch / Dynamic Island */}
            <div className="sim-phone-notch">
              <div className="sim-phone-camera"></div>
              <div className="sim-phone-speaker"></div>
            </div>

            {/* Status Bar */}
            <div className="sim-phone-status-bar">
              <span>{simulatedSmsToast.timestamp || '11:00 PM'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.65rem', color: '#4ade80' }}>{simulatedSmsToast.carrier}</span>
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>signal_cellular_alt</span>
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>wifi</span>
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>battery_full</span>
              </div>
            </div>

            {/* App Header */}
            <div className="sim-phone-app-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#38bdf8', cursor: 'pointer' }} onClick={() => setShowSimulatedPhoneModal(false)}>
                  arrow_back_ios
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '12px' }}>
                  BB
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>{simulatedSmsToast.sender}</div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Verified Telco Broadcast</div>
                </div>
              </div>
              <button
                type="button"
                className="sim-sms-close-btn"
                onClick={() => setShowSimulatedPhoneModal(false)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
              </button>
            </div>

            {/* Chat Body */}
            <div className="sim-phone-chat-body">
              <div className="sim-phone-date-divider">Today · {simulatedSmsToast.timestamp || 'Just now'}</div>
              <div className="sim-phone-msg-bubble">
                <p style={{ margin: '0 0 6px 0' }}>
                  BBDRTS: Your 6-digit institutional SMS verification code is:
                </p>
                <div className="sim-phone-otp-highlight">
                  {simulatedSmsToast.code}
                </div>
                <p style={{ margin: '6px 0 0 0', fontSize: '0.74rem', color: '#94a3b8' }}>
                  Valid for 10 minutes. Delivered to {simulatedSmsToast.recipient} on {simulatedSmsToast.carrier}. Do not share this code.
                </p>
              </div>
            </div>

            {/* Footer Action */}
            <div className="sim-phone-footer-bar">
              <button
                type="button"
                className="btn-modern-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  setRegVerifySmsOtp(simulatedSmsToast.code);
                  setShowSimulatedPhoneModal(false);
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>bolt</span>
                <span>Auto-Fill OTP into Box ({simulatedSmsToast.code})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TWO-FACTOR AUTHENTICATION CHALLENGE
          Matching the Log In with Email Code Layout & Visual Tokens
          ══════════════════════════════════════════════════════════════════ */}
      {twoFactorModalOpen && (
        <div className="modal-backdrop-auth">
          <div className="forgot-modal-card" style={{ maxWidth: '430px' }}>
            <div className="forgot-modal-header">
              <div className="forgot-header-icon">
                <span className="material-symbols-outlined">verified_user</span>
              </div>
              <div className="forgot-header-text">
                <h3>Two-Factor Authentication</h3>
                <p>
                  {twoFactorUseBackup
                    ? 'Enter one of your 8 single-use emergency backup recovery codes'
                    : `Enter the 6-digit code from your authenticator app for ${twoFactorEmail}`}
                </p>
              </div>
              <button
                type="button"
                className="forgot-close-btn"
                onClick={() => setTwoFactorModalOpen(false)}
                title="Close"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>

            {twoFactorError && (
              <div className="alert-modern error" style={{ marginBottom: '12px' }}>
                <span className="material-symbols-outlined">warning</span>
                <span>{twoFactorError}</span>
              </div>
            )}

            <form onSubmit={handleVerify2FA} className="forgot-form-body">
              {!twoFactorUseBackup ? (
                <div>
                  {/* Boxes ONLY, NO label - do not auto-submit so the user can optionally check "Trust this device" */}
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 14px 0' }}>
                    <OtpPinBoxes
                      value={twoFactorCode}
                      onChange={setTwoFactorCode}
                      autoFocus={true}
                      onSubmit={(e, code) => handleVerify2FA(e, code || twoFactorCode)}
                    />
                  </div>

                  {/* Trust This Device Checkbox & Lost Device Link */}
                  <div className="twofa-trust-row">
                    <label className="twofa-trust-label">
                      <input
                        type="checkbox"
                        className="twofa-trust-checkbox"
                        checked={twoFactorTrustDevice}
                        onChange={e => setTwoFactorTrustDevice(e.target.checked)}
                      />
                      <span>Trust this device for 30 days</span>
                    </label>

                    <button
                      type="button"
                      className="twofa-link-btn"
                      onClick={() => {
                        setTwoFactorUseBackup(true);
                        setTwoFactorError('');
                      }}
                    >
                      Lost device?
                    </button>
                  </div>
                </div>
              ) : (
                <div className="input-group-modern">
                  <label>EMERGENCY BACKUP RECOVERY CODE</label>
                  <div className="input-container">
                    <span className="material-symbols-outlined input-icon">key</span>
                    <input
                      type="text"
                      autoFocus
                      style={{
                        letterSpacing: '3px',
                        fontFamily: 'var(--font-mono, monospace)',
                        fontWeight: 600,
                        textTransform: 'uppercase'
                      }}
                      placeholder="XXXX-XXXX"
                      value={twoFactorRecoveryCode}
                      onChange={e => setTwoFactorRecoveryCode(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div style={{ textAlign: 'right', marginTop: '6px' }}>
                    <button
                      type="button"
                      className="twofa-link-btn"
                      onClick={() => {
                        setTwoFactorUseBackup(false);
                        setTwoFactorError('');
                      }}
                    >
                      Use 6-digit authenticator code instead
                    </button>
                  </div>
                </div>
              )}

              <div className="forgot-info-alert">
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>verified</span>
                <span>
                  {twoFactorUseBackup
                    ? 'Each single-use backup recovery code can only be used once to access your account.'
                    : 'Open Google Authenticator, Microsoft Authenticator, Authy, or Apple Keychain to view your active code.'}
                </span>
              </div>

              <div className="forgot-action-row">
                <button
                  type="button"
                  className="forgot-cancel-btn"
                  onClick={() => setTwoFactorModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modern-primary"
                  disabled={twoFactorLoading || (!twoFactorUseBackup ? twoFactorCode.length < 6 : twoFactorRecoveryCode.trim().length < 8)}
                >
                  {twoFactorLoading ? (
                    <>
                      <span className="spinner-before"></span>
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify & Sign In</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>login</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          EMAIL CHANGE NOTIFICATION MODAL (Feature 7 & Hijack Protection)
          Matching the Log In with Email Code Layout & Visual Tokens
          ══════════════════════════════════════════════════════════════════ */}
      {emailChangeNotice && (
        <div className="modal-backdrop-auth">
          <div className="forgot-modal-card" style={{ maxWidth: '440px' }}>
            <div className="forgot-modal-header">
              <div className="forgot-header-icon" style={emailChangeNotice.reverted ? { borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.1)' } : {}}>
                <span className="material-symbols-outlined" style={emailChangeNotice.reverted ? { color: '#10b981' } : emailChangeNotice.error ? { color: '#ef4444' } : { color: '#10b981' }}>
                  {emailChangeNotice.verifying ? 'sync' : emailChangeNotice.reverted ? 'shield' : emailChangeNotice.cancelled ? 'task_alt' : emailChangeNotice.success ? 'mark_email_read' : 'error'}
                </span>
              </div>
              <div className="forgot-header-text">
                <h3>
                  {emailChangeNotice.reverted
                    ? 'Account Reclaimed & Restored'
                    : emailChangeNotice.cancelled
                    ? 'Email Change Request Cancelled'
                    : emailChangeNotice.success
                    ? 'Email Address Updated'
                    : 'Security Alert'}
                </h3>
                <p>
                  {emailChangeNotice.verifying
                    ? 'Processing security request with BBDRTS...'
                    : emailChangeNotice.reverted
                    ? 'Unauthorized change revoked and active sessions terminated'
                    : emailChangeNotice.cancelled
                    ? 'Pending request voided; your primary email is unchanged'
                    : emailChangeNotice.success
                    ? 'Your email address has been successfully updated'
                    : 'Account email verification notice'}
                </p>
              </div>
              <button
                type="button"
                className="forgot-close-btn"
                onClick={() => {
                  setEmailChangeNotice(null);
                  window.history.replaceState({}, document.title, window.location.pathname);
                }}
                title="Close"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>

            <div className="forgot-form-body">
              <div
                className="forgot-info-alert"
                style={
                  emailChangeNotice.error
                    ? { background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5' }
                    : { background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.25)', color: '#86efac' }
                }
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: emailChangeNotice.error ? '#ef4444' : '#22c55e', flexShrink: 0 }}>
                  {emailChangeNotice.error ? 'warning' : 'verified_user'}
                </span>
                <span style={{ fontSize: '0.78rem', lineHeight: 1.5 }}>
                  {emailChangeNotice.message || emailChangeNotice.error}
                </span>
              </div>

              {emailChangeNotice.reverted && (
                <div style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', padding: '12px 14px', margin: '14px 0', fontSize: '0.75rem', color: '#a1a1aa' }}>
                  <div style={{ color: '#ffffff', fontWeight: 600, marginBottom: '6px' }}>Protective actions completed:</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#10b981' }}>check</span>
                    <span>Primary email active: <strong style={{ color: '#ffffff' }}>{emailChangeNotice.originalEmail}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#10b981' }}>check</span>
                    <span>All active login sessions across devices terminated</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#10b981' }}>check</span>
                    <span>Unauthorized email change authorization voided</span>
                  </div>
                </div>
              )}

              <div className="forgot-action-row" style={{ gridTemplateColumns: emailChangeNotice.reverted ? '1fr 1fr' : '1fr', gap: '10px' }}>
                {emailChangeNotice.reverted && (
                  <button
                    type="button"
                    className="forgot-cancel-btn"
                    style={{ padding: '9px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => {
                      if (emailChangeNotice.originalEmail) {
                        setForgotEmail(emailChangeNotice.originalEmail);
                      }
                      setEmailChangeNotice(null);
                      setForgotOpen(true);
                      window.history.replaceState({}, document.title, window.location.pathname);
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>lock_reset</span>
                    <span>Reset Password</span>
                  </button>
                )}
                <button
                  type="button"
                  className="btn-modern-primary"
                  onClick={() => {
                    setEmailChangeNotice(null);
                    window.history.replaceState({}, document.title, window.location.pathname);
                  }}
                >
                  <span>Continue to Sign In</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statutory Legal Framework, User Agreement, Terms & Privacy (RA 10173) Modal */}
      <TermsPolicyModal
        isOpen={legalModal.open}
        onClose={() => setLegalModal(prev => ({ ...prev, open: false }))}
        initialTab={legalModal.tab}
        theme={theme}
      />

      {/* Non-Shifting Floating Auth Error Notification */}
      {error && typeof document !== 'undefined' && createPortal(
        <div className="auth-floating-error" role="alert" aria-live="assertive">
          <span className="material-symbols-outlined auth-floating-error-icon">warning</span>
          <span className="auth-floating-error-text">{error}</span>
          <button
            type="button"
            className="auth-floating-error-close"
            onClick={() => setError('')}
            aria-label="Dismiss error"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>,
        document.body
      )}

    </div>
  );
}
