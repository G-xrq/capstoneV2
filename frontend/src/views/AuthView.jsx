import { useState, useEffect, useRef, useMemo } from 'react';
import './AuthView.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ── 6-Digit Individual Box PIN Input Component ────────────────
function OtpPinBoxes({ value = '', onChange, autoFocus = true }) {
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];

  const rawDigits = (value || '').split('').slice(0, 6);
  const digits = Array.from({ length: 6 }, (_, i) => rawDigits[i] || '');

  const handleChange = (index, e) => {
    const val = e.target.value.replace(/\D/g, '');
    if (!val) {
      const next = [...digits];
      next[index] = '';
      onChange(next.join(''));
      return;
    }

    const lastChar = val.slice(-1);
    const next = [...digits];
    next[index] = lastChar;
    const combined = next.join('');
    onChange(combined);

    if (index < 5 && lastChar) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs[index - 1].current?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs[index - 1].current?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      onChange(pasted);
      const focusIndex = Math.min(pasted.length, 5);
      inputRefs[focusIndex].current?.focus();
    }
  };

  return (
    <div className="otp-boxes-container" onPaste={handlePaste}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={inputRefs[i]}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKeyDown(i, e)}
          className={`otp-single-box ${digit ? 'filled' : ''}`}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

export default function AuthView({ onLoginSuccess, onBack, theme }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
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
  const [role, setRole] = useState('donor');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
    setSecCertificateUrl(`data:image/svg+xml;utf8,${encodeURIComponent(secCertSvg)}`);
  };

  // ── Forgot Password Real Email Verification State ──
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Enter Email, 2: Enter OTP & New Password, 3: Success
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotDevCode, setForgotDevCode] = useState('');
  const [forgotCountdown, setForgotCountdown] = useState(300);
  const [forgotResendCooldown, setForgotResendCooldown] = useState(0);
  const [forgotResendLoading, setForgotResendLoading] = useState(false);
  const [forgotResendMsg, setForgotResendMsg] = useState('');

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

  // ── Expiration Countdown Timers ──
  useEffect(() => {
    let timer = null;
    if (forgotOpen && forgotStep === 2 && forgotCountdown > 0) {
      timer = setInterval(() => setForgotCountdown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [forgotOpen, forgotStep, forgotCountdown]);

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
        return { score: 0, label: 'Too short', color: '#ef4444', percent: 15 };
    }
  };

  const pwdStrength = getPasswordStrength(password);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const forgotPwdStrength = getPasswordStrength(forgotNewPassword);

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

  const liveForgotPwdFeedback = useMemo(() => {
    if (!forgotNewPassword) {
      return {
        text: 'Must be 8+ characters with uppercase, lowercase, numbers & symbols.',
        isComplete: false,
        color: '#94a3b8'
      };
    }

    const missing = [];
    if (forgotNewPassword.length < 8) missing.push('8+ characters');
    if (!/[A-Z]/.test(forgotNewPassword)) missing.push('uppercase (A-Z)');
    if (!/[a-z]/.test(forgotNewPassword)) missing.push('lowercase (a-z)');
    if (!/\d/.test(forgotNewPassword)) missing.push('number (0-9)');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(forgotNewPassword)) missing.push('symbol (@$!%*?)');

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
  }, [forgotNewPassword]);

  // Realistic loading delay simulation helper (700ms - 900ms)
  const simulateDelay = (ms = 800) => new Promise(resolve => setTimeout(resolve, ms));

  // ── Form Submission Handler (Login vs Registration with Email Verification) ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isRegistering) {
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

        const [response] = await Promise.all([
          fetch(`${API_URL}/api/auth/register-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: computedName || (role === 'donor' ? 'Anonymous Donor' : 'Relief Organization'),
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
      const [response] = await Promise.all([
        fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, role })
        }),
        simulateDelay(800)
      ]);
      const data = await parseApiResponse(response);
      localStorage.setItem('bbdrts_token', data.token);
      onLoginSuccess?.(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
        fetch(`${API_URL}/api/auth/register-verify`, {
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
      onLoginSuccess?.(data.user, data.token);
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

      const [response] = await Promise.all([
        fetch(`${API_URL}/api/auth/register-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: computedName || (role === 'donor' ? 'Anonymous Donor' : 'Relief Organization'),
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
        fetch(`${API_URL}/api/auth/login-otp-request`, {
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
        fetch(`${API_URL}/api/auth/login-otp-request`, {
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
      const [response] = await Promise.all([
        fetch(`${API_URL}/api/auth/login-otp-verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: otpLoginEmail, otp: otpLoginCode })
        }),
        simulateDelay(850)
      ]);
      const data = await parseApiResponse(response);

      setOtpLoginOpen(false);
      localStorage.setItem('bbdrts_token', data.token);
      onLoginSuccess?.(data.user, data.token);
    } catch (err) {
      setOtpLoginError(err.message);
    } finally {
      setOtpLoginLoading(false);
    }
  };

  // Direct Admin Access Bypass
  const handleDirectAdminAccess = () => {
    const adminUser = {
      id: 1,
      name: 'System Administrator',
      email: 'admin@bbdrts.gov.ph',
      role: 'admin',
      wallet_address: '0x206e5d8b76c8c4598d1a457493a746535560b771',
      verification_status: 'Approved'
    };
    onLoginSuccess?.(adminUser, 'direct_admin_access_token');
  };

  // ── Forgot Password Step 1: Request Real Email OTP ──
  const handleForgotRequestOtp = async (e) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotError('');
    setForgotLoading(true);

    try {
      const [response] = await Promise.all([
        fetch(`${API_URL}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: forgotEmail })
        }),
        simulateDelay(800)
      ]);
      const data = await parseApiResponse(response);

      if (data.devCode) {
        setForgotDevCode(data.devCode);
      }
      setForgotOtp('');
      setForgotStep(2);
      setForgotCountdown(600); // Reset 10-minute timer
      setForgotResendCooldown(60);
      setForgotResendMsg('');
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  // ── Resend Forgot Password Code Handler ──
  const handleResendForgotOtp = async () => {
    if (forgotResendCooldown > 0 || forgotResendLoading) return;
    setForgotResendMsg('');
    setForgotError('');
    setForgotResendLoading(true);
    try {
      const [response] = await Promise.all([
        fetch(`${API_URL}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: forgotEmail })
        }),
        simulateDelay(750)
      ]);
      const data = await parseApiResponse(response);
      if (data.devCode) setForgotDevCode(data.devCode);
      setForgotResendCooldown(60);
      setForgotCountdown(600);
      setForgotResendMsg('A new password recovery code has been dispatched to your email.');
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setForgotResendLoading(false);
    }
  };

  // ── Forgot Password Step 2: Verify Code & Update Password ──
  const handleForgotVerifyAndReset = async (e) => {
    e.preventDefault();
    setForgotError('');

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('New passwords do not match.');
      return;
    }

    if (forgotNewPassword.length < 6) {
      setForgotError('New password must be at least 6 characters long.');
      return;
    }

    setForgotLoading(true);

    try {
      const [response] = await Promise.all([
        fetch(`${API_URL}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: forgotEmail,
            otp: forgotOtp,
            newPassword: forgotNewPassword
          })
        }),
        simulateDelay(850)
      ]);
      await parseApiResponse(response);

      setForgotStep(3);
      setEmail(forgotEmail); // Autofill updated email on the login form
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
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

      <div className="login-form-side fade-in">
        <div className={`login-glass-card ${isRegistering ? 'right-panel-active' : ''} ${hasInteracted ? 'has-interacted' : ''}`}>

          {/* ===== FORM 1: SIGN IN (RIGHT HALF BY DEFAULT) ===== */}
          <div className="form-panel sign-in-panel">
            <div className="panel-inner">

              {/* Header */}
              <div className="login-header-modern">
                <h2>{role === 'organization' ? 'NGO Portal Login' : 'Donor Portal Login'}</h2>
                <p>Log in to access your transparent relief portal</p>
              </div>

              {/* Role Switcher (Donor vs NGO) */}
              <div className="role-selector">
                <div
                  className={`role-card-opt ${role === 'donor' ? 'active' : ''}`}
                  onClick={() => setRole('donor')}
                >
                  {role === 'donor' && (
                    <span className="material-symbols-outlined role-check-icon">check_circle</span>
                  )}
                  <span className="material-symbols-outlined role-type-icon">person</span>
                  <span className="role-type-label">Donor</span>
                </div>

                <div
                  className={`role-card-opt ${role === 'organization' ? 'active' : ''}`}
                  onClick={() => setRole('organization')}
                >
                  {role === 'organization' && (
                    <span className="material-symbols-outlined role-check-icon">check_circle</span>
                  )}
                  <span className="material-symbols-outlined role-type-icon">domain</span>
                  <span className="role-type-label">NGO / Relief Org</span>
                </div>
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

                {error && !isRegistering && (
                  <div className="alert-modern error">
                    <span className="material-symbols-outlined">warning</span>
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className={`btn-modern-primary ${loading && !isRegistering ? 'loading' : ''}`}
                  disabled={loading}
                >
                  {loading && !isRegistering ? (
                    <>
                      <span className="spinner-before"></span>
                      <span>Authenticating...</span>
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
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    background: 'rgba(34, 197, 94, 0.08)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    color: '#22c55e',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>mark_email_read</span>
                  <span>Sign In with One-Time Email Code</span>
                </button>
              </form>

              <div className="login-divider"><span>OR</span></div>

              {/* Footer Switch */}
              <div className="login-footer-modern">
                <p className="switch-text">
                  Don't have an account?{" "}
                  <button
                    type="button"
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
                <p>{role === 'organization' ? 'Register your Non-Governmental Organization (NGO)' : 'Sign up as a Donor (Individual, Group, or Entity)'}</p>
              </div>

              {/* Role Switcher (Donor vs NGO) */}
              <div className="role-selector">
                <div
                  className={`role-card-opt ${role === 'donor' ? 'active' : ''}`}
                  onClick={() => setRole('donor')}
                >
                  {role === 'donor' && (
                    <span className="material-symbols-outlined role-check-icon">check_circle</span>
                  )}
                  <span className="material-symbols-outlined role-type-icon">person</span>
                  <span className="role-type-label">Donor</span>
                </div>

                <div
                  className={`role-card-opt ${role === 'organization' ? 'active' : ''}`}
                  onClick={() => setRole('organization')}
                >
                  {role === 'organization' && (
                    <span className="material-symbols-outlined role-check-icon">check_circle</span>
                  )}
                  <span className="material-symbols-outlined role-type-icon">domain</span>
                  <span className="role-type-label">NGO / Relief Org</span>
                </div>
              </div>

              {/* Registration Form */}
              <form className="modern-login-form" onSubmit={handleSubmit}>
                {role === 'donor' ? (
                  <div className="input-row-2col">
                    <div className="input-group-modern">
                      <label>FIRST NAME</label>
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
                      <label>LAST NAME</label>
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
                        placeholder="e.g., Philippine Red Cross"
                        value={orgName}
                        onChange={e => setOrgName(e.target.value)}
                        required={isRegistering && role === 'organization'}
                      />
                    </div>
                  </div>
                )}

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

                {/* Password Field with Dynamic Strength Meter */}
                <div className="input-group-modern">
                  <div className="label-with-strength">
                    <label>PASSWORD</label>
                    {password && (
                      <span className="pwd-strength-tag" style={{ color: pwdStrength.color }}>
                        {pwdStrength.label}
                      </span>
                    )}
                  </div>
                  <div className="input-container">
                    <span className="material-symbols-outlined input-icon">lock</span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create secure password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required={isRegistering}
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

                  {/* Visual Password Strength Meter Bar */}
                  {password && (
                    <div className="pwd-strength-bar-track">
                      <div
                        className="pwd-strength-bar-fill"
                        style={{
                          width: `${pwdStrength.percent}%`,
                          backgroundColor: pwdStrength.color
                        }}
                      ></div>
                    </div>
                  )}

                  {/* Compact Live Password Guidance Instruction */}
                  <div
                    className="password-instruction-box"
                    style={{ borderColor: livePwdFeedback.isComplete ? 'rgba(34, 197, 94, 0.35)' : 'rgba(255, 255, 255, 0.06)' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '13px', color: livePwdFeedback.color }}>
                      {livePwdFeedback.isComplete ? 'verified' : 'info'}
                    </span>
                    <span style={{ color: livePwdFeedback.isComplete ? '#22c55e' : undefined }}>
                      {livePwdFeedback.text}
                    </span>
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div className="input-group-modern">
                  <div className="label-with-strength">
                    <label>CONFIRM PASSWORD</label>
                    {passwordsMatch && (
                      <span className="match-tag success">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check_circle</span>
                        Match
                      </span>
                    )}
                    {passwordsMismatch && (
                      <span className="match-tag error">Mismatch</span>
                    )}
                  </div>
                  <div className="input-container">
                    <span className="material-symbols-outlined input-icon">check</span>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Repeat password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required={isRegistering}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      tabIndex="-1"
                    >
                      <span className="material-symbols-outlined">
                        {showConfirmPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>

                  {/* Smooth NGO Verification Note (CSS-animated, zero layout jump) */}
                  <div className={`input-hint org-hint ${role === 'organization' ? 'visible' : ''}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#22c55e' }}>info</span>
                    <span>NGO accounts undergo Admin verification before campaign creation is unlocked.</span>
                  </div>
                </div>

                {error && isRegistering && (
                  <div className="alert-modern error">
                    <span className="material-symbols-outlined">warning</span>
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className={`btn-modern-primary ${loading && isRegistering ? 'loading' : ''}`}
                  disabled={loading}
                >
                  {loading && isRegistering ? (
                    <>
                      <span className="spinner-before"></span>
                      <span>Dispatching Verification Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify Email & Create Account</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>verified_user</span>
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

              {/* Top Grouped Section: Header & Elevated Metrics */}
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
                      Blockchain-Based Donation & Relief Transparency System
                    </p>
                  </div>
                </div>

                {/* Top-Aligned Glass Metric Card */}
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

              {/* Bottom Status Pill & Security Seals */}
              <div className="brand-footer-block">
                <div className="brand-live-pill">
                  <span className="pulse-dot"></span>
                  <span>Sepolia EVM Protocol Live</span>
                  <span className="pill-dot-sep">•</span>
                  <span className="pill-subtext">Zero Non-Profit Fees</span>
                </div>

                <div className="brand-trust-labels">
                  <div className="trust-badge-item">
                    <span className="material-symbols-outlined">lock</span>
                    <span>256-Bit SSL</span>
                  </div>
                  <div className="trust-badge-item">
                    <span className="material-symbols-outlined">verified</span>
                    <span>Smart Contract Audited</span>
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

      {/* ── Institutional Footer Area with Direct Admin Access ── */}
      <footer className="auth-system-footer">
        <div className="auth-footer-info">
          <div className="auth-footer-primary">
            <strong>BBDRTS System</strong>
            <span className="auth-footer-bullet">•</span>
            <span>Hybrid Web2/Web3 Authenticated Environment</span>
          </div>
          <div className="auth-footer-secondary">
            College of Computer Studies · Saint Joseph College · Maasin City, Southern Leyte
          </div>
        </div>

        <button
          type="button"
          className="auth-footer-admin-btn"
          onClick={handleDirectAdminAccess}
          title="Direct Access to Administrator Dashboard"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>admin_panel_settings</span>
          <span>Admin Access</span>
        </button>
      </footer>

      {/* ===== ONE-TIME EMAIL CODE (OTP) LOGIN MODAL ===== */}
      {otpLoginOpen && (
        <div className="modal-backdrop-auth" onClick={() => setOtpLoginOpen(false)}>
          <div className="forgot-modal-card" onClick={e => e.stopPropagation()}>
            <div className="forgot-modal-header">
              <div className="forgot-header-icon">
                <span className="material-symbols-outlined">mark_email_read</span>
              </div>
              <div className="forgot-header-text">
                <h3>Sign In with Email Code</h3>
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
              >
                ✕
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
                  <span>A real 6-digit code will be sent to your Gmail inbox. If you are a new user, your account will be created automatically!</span>
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
                  <OtpPinBoxes value={otpLoginCode} onChange={setOtpLoginCode} />
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
                        <span>Verifying & Signing In...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In</span>
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
        <div className="modal-backdrop-auth" onClick={() => setRegVerifyOpen(false)}>
          <div className="forgot-modal-card" style={{ maxWidth: isDualOtpModal ? '560px' : '480px' }} onClick={e => e.stopPropagation()}>

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
              >
                ✕
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
                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>mail</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          1. Official Email Code
                        </span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: regVerifyEmailOtp.length === 6 ? '#22c55e' : 'var(--text-muted)', fontWeight: 600 }}>
                        {regVerifyEmailOtp.length === 6 ? '✓ 6 Digits Entered' : `Sent to: ${email}`}
                      </span>
                    </div>
                    <OtpPinBoxes value={regVerifyEmailOtp} onChange={setRegVerifyEmailOtp} autoFocus={true} />
                  </div>

                  {/* 2. Authorized Mobile SMS Code Box */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#38bdf8' }}>smartphone</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          2. Mobile SMS Security Code
                        </span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: regVerifySmsOtp.length === 6 ? '#22c55e' : 'var(--text-muted)', fontWeight: 600 }}>
                        {regVerifySmsOtp.length === 6 ? '✓ 6 Digits Entered' : `Sent to: ${mobileNumber || 'Registered Mobile'}`}
                      </span>
                    </div>
                    <OtpPinBoxes value={regVerifySmsOtp} onChange={setRegVerifySmsOtp} />

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
                  <OtpPinBoxes value={regVerifyOtp} onChange={setRegVerifyOtp} autoFocus={true} />
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
                    ? '🛡️ Verifying your official institutional email ensures verified NGO corporate accreditation under Philippine SEC regulations, legal accountability, and secure disaster relief disbursements.'
                    : '🛡️ Verifying your email ensures genuine donor identity, instant receipt generation, and transparent ledger access.'}
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
                      <span>Verifying Credentials...</span>
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

      {/* ===== REAL GMAIL OTP PASSWORD RECOVERY MODAL ===== */}
      {forgotOpen && (
        <div className="modal-backdrop-auth" onClick={() => setForgotOpen(false)}>
          <div className="forgot-modal-card" onClick={e => e.stopPropagation()}>

            <div className="forgot-modal-header">
              <div className="forgot-header-icon">
                <span className="material-symbols-outlined">
                  {forgotStep === 3 ? 'verified_user' : 'lock_reset'}
                </span>
              </div>
              <div className="forgot-header-text">
                <h3>
                  {forgotStep === 1 && 'Secure Password Recovery'}
                  {forgotStep === 2 && 'Enter Verification Code'}
                  {forgotStep === 3 && 'Password Reset Complete'}
                </h3>
                <p>
                  {forgotStep === 1 && 'Enter your registered Gmail to receive a real 6-digit security code'}
                  {forgotStep === 2 && `6-digit security code sent to ${forgotEmail}`}
                  {forgotStep === 3 && 'Your credentials have been securely updated on the BBDRTS network'}
                </p>
              </div>
              <button
                type="button"
                className="forgot-close-btn"
                onClick={() => setForgotOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Error Alert */}
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

            {/* ── STEP 1: ENTER REGISTERED GMAIL ── */}
            {forgotStep === 1 && (
              <form onSubmit={handleForgotRequestOtp} className="forgot-form-body">
                <div className="input-group-modern">
                  <label>REGISTERED GMAIL ADDRESS</label>
                  <div className="input-container">
                    <span className="material-symbols-outlined input-icon">mail</span>
                    <input
                      type="email"
                      placeholder="your.email@gmail.com"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="forgot-info-alert">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>shield</span>
                  <span>An official 6-digit one-time security passcode (OTP) will be dispatched directly to your inbox via Google SMTP.</span>
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
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? (
                      <>
                        <span className="spinner-before"></span>
                        <span>Dispatching Code...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Security Code</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>send</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* ── STEP 2: ENTER OTP & NEW PASSWORD ── */}
            {forgotStep === 2 && (
              <form onSubmit={handleForgotVerifyAndReset} className="forgot-form-body">

                {forgotDevCode && (
                  <div className="dev-otp-pill">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>terminal</span>
                    <span>Dev Helper Code: <strong>{forgotDevCode}</strong></span>
                  </div>
                )}

                <div className="input-group-modern">
                  <div className="label-with-strength">
                    <label>6-DIGIT VERIFICATION CODE</label>
                    <span className="otp-timer-tag">
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>timer</span>
                      Expires in: {formatTimer(forgotCountdown)}
                    </span>
                  </div>
                  <OtpPinBoxes value={forgotOtp} onChange={setForgotOtp} />
                </div>

                <div className="otp-resend-row">
                  <span>Didn't receive the code?</span>
                  <button
                    type="button"
                    className="otp-resend-btn"
                    disabled={forgotResendCooldown > 0 || forgotResendLoading}
                    onClick={handleResendForgotOtp}
                  >
                    <span className={`material-symbols-outlined ${forgotResendLoading ? 'btn-resend-spinning' : ''}`} style={{ fontSize: '14px' }}>
                      sync
                    </span>
                    <span>{forgotResendCooldown > 0 ? `Resend in ${forgotResendCooldown}s` : 'Resend Code'}</span>
                  </button>
                </div>

                <div className="input-group-modern">
                  <div className="label-with-strength">
                    <label>NEW PASSWORD</label>
                    {forgotNewPassword && (
                      <span className="pwd-strength-tag" style={{ color: forgotPwdStrength.color }}>
                        {forgotPwdStrength.label}
                      </span>
                    )}
                  </div>
                  <div className="input-container">
                    <span className="material-symbols-outlined input-icon">lock</span>
                    <input
                      type="password"
                      placeholder="Enter new password"
                      value={forgotNewPassword}
                      onChange={e => setForgotNewPassword(e.target.value)}
                      required
                    />
                  </div>

                  {/* Compact Live Password Guidance Instruction */}
                  <div
                    className="password-instruction-box"
                    style={{ borderColor: liveForgotPwdFeedback.isComplete ? 'rgba(34, 197, 94, 0.35)' : 'rgba(255, 255, 255, 0.06)' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '13px', color: liveForgotPwdFeedback.color }}>
                      {liveForgotPwdFeedback.isComplete ? 'verified' : 'info'}
                    </span>
                    <span style={{ color: liveForgotPwdFeedback.isComplete ? '#22c55e' : undefined }}>
                      {liveForgotPwdFeedback.text}
                    </span>
                  </div>
                </div>

                <div className="input-group-modern">
                  <label>CONFIRM NEW PASSWORD</label>
                  <div className="input-container">
                    <span className="material-symbols-outlined input-icon">check</span>
                    <input
                      type="password"
                      placeholder="Repeat new password"
                      value={forgotConfirmPassword}
                      onChange={e => setForgotConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="forgot-action-row">
                  <button
                    type="button"
                    className="forgot-cancel-btn"
                    onClick={() => setForgotStep(1)}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="btn-modern-primary"
                    disabled={forgotLoading || forgotCountdown === 0 || forgotOtp.length < 6}
                  >
                    {forgotLoading ? (
                      <>
                        <span className="spinner-before"></span>
                        <span>Verifying & Updating...</span>
                      </>
                    ) : (
                      <>
                        <span>Reset Password</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>lock_reset</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* ── STEP 3: SUCCESS STATE ── */}
            {forgotStep === 3 && (
              <div className="forgot-success-state">
                <div className="forgot-success-icon">
                  <span className="material-symbols-outlined">verified</span>
                </div>
                <h4>Password Successfully Reset!</h4>
                <p>
                  Your account password for <strong>{forgotEmail}</strong> has been encrypted with bcrypt and updated on the BBDRTS database.
                </p>
                <button
                  type="button"
                  className="btn-modern-primary"
                  onClick={() => setForgotOpen(false)}
                >
                  Return & Log In Now
                </button>
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
            >
              ✕
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
              >
                ✕
              </button>
            </div>

            {/* Chat Body */}
            <div className="sim-phone-chat-body">
              <div className="sim-phone-date-divider">Today · {simulatedSmsToast.timestamp || 'Just now'}</div>
              <div className="sim-phone-msg-bubble">
                <p style={{ margin: '0 0 6px 0' }}>
                  BBDRTS Protocol: Your 6-digit institutional SMS verification code is:
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

    </div>
  );
}
