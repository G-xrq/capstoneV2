/**
 * BBDRTS Transactional Email Templates (Vercel-inspired Design System)
 * Pure, high-contrast, institutional minimalism matching Vercel UI & BBDRTS branding.
 */

const SYSTEM_BRAND_NAME = 'BBDRTS';
const SYSTEM_FULL_NAME = 'Blockchain-Based Donation & Relief Transparency System';
const INSTITUTION_LINE = 'College of Computer Studies · Saint Joseph College · Maasin City, Southern Leyte';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@bbdrts.gov.ph';

/**
 * Universal Vercel-style email container
 */
function renderBaseLayout({ preheader = '', badge = 'OFFICIAL NOTICE', title, subtitle, bodyHtml, alertType = 'default' }) {
  const badgeColors = {
    default: { bg: '#18181b', text: '#10b981', border: '#27272a' },
    warning: { bg: '#18181b', text: '#f59e0b', border: '#27272a' },
    danger: { bg: '#18181b', text: '#ef4444', border: '#27272a' },
    info: { bg: '#18181b', text: '#38bdf8', border: '#27272a' }
  };

  const badgeStyle = badgeColors[alertType] || badgeColors.default;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title || SYSTEM_BRAND_NAME}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, h1, h2, h3, p, a { font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #ededed;">
  <!-- Preheader preview text -->
  <div style="display: none; max-height: 0px; overflow: hidden; opacity: 0; font-size: 1px; line-height: 1px;">
    ${preheader || subtitle || title}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000; width: 100%; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Vercel-Style Main Card Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 540px; background-color: #09090b; border: 1px solid #27272a; border-radius: 12px; overflow: hidden;">
          
          <!-- Subtle Top Accent Line -->
          <tr>
            <td style="height: 2px; background: #10b981; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Header Lockup -->
          <tr>
            <td style="padding: 24px 28px 20px 28px; border-bottom: 1px solid #18181b;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 12px;">
                          <!-- Official BBDRTS Brand Logo (Current 512x512 Emerald Shield & Prism Heart Core) -->
                          <img 
                            src="https://iili.io/o2bNGEB.png" 
                            alt="BBDRTS" 
                            width="32" 
                            height="32" 
                            style="display: block; width: 32px; height: 32px; border-radius: 6px; object-fit: contain;" 
                          />
                        </td>
                        <td style="vertical-align: middle;">
                          <div style="font-size: 13px; font-weight: 700; letter-spacing: 0.05em; color: #ffffff; line-height: 1.2;">
                            ${SYSTEM_BRAND_NAME}
                          </div>
                          <div style="font-size: 11px; color: #71717a; margin-top: 2px;">
                            ${SYSTEM_FULL_NAME}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <!-- Badge Pill -->
                    <span style="display: inline-block; padding: 3px 9px; border-radius: 6px; font-size: 10px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; background: ${badgeStyle.bg}; color: ${badgeStyle.text}; border: 1px solid ${badgeStyle.border};">
                      ${badge}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 28px 28px 24px 28px;">
              ${title ? `<h1 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 600; color: #ffffff; letter-spacing: -0.02em; line-height: 1.3;">${title}</h1>` : ''}
              ${subtitle ? `<p style="margin: 0 0 20px 0; font-size: 13px; line-height: 1.6; color: #a1a1aa;">${subtitle}</p>` : ''}
              ${bodyHtml}
            </td>
          </tr>

          <!-- Institutional Footer -->
          <tr>
            <td style="background-color: #000000; padding: 20px 28px; border-top: 1px solid #18181b;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="font-size: 11px; line-height: 1.6; color: #71717a;">
                    <div style="font-weight: 600; color: #a1a1aa; margin-bottom: 2px;">
                      BBDRTS Security Desk
                    </div>
                    <div>${INSTITUTION_LINE}</div>
                    <div style="margin-top: 8px; color: #52525b;">
                      This is an automated system notification. Inquiries: <a href="mailto:${SUPPORT_EMAIL}" style="color: #10b981; text-decoration: none;">${SUPPORT_EMAIL}</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * 1. Registration Email OTP Verification
 */
function renderRegistrationOtpEmail({ emailOtpCode, role = 'donor', expiresMinutes = 5 }) {
  const roleLabel = role === 'organization' ? 'Relief Organization (NGO)' : (role === 'admin' ? 'Administrator' : 'Donor');

  const bodyHtml = `
    <div style="font-size: 13px; line-height: 1.6; color: #d4d4d8; margin-bottom: 16px;">
      Confirm your email to complete registration for your <strong style="color: #ffffff;">${roleLabel}</strong> account:
    </div>

    <!-- Monospace Security Code Box -->
    <div style="background-color: #000000; border: 1px solid #27272a; border-radius: 8px; padding: 20px 16px; text-align: center; margin: 18px 0;">
      <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: #71717a; text-transform: uppercase; margin-bottom: 8px;">
        VERIFICATION CODE
      </div>
      <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #ffffff; padding: 4px 0; line-height: 1;">
        ${emailOtpCode}
      </div>
      <div style="margin-top: 10px; font-size: 11px; color: #a1a1aa;">
        Valid for <strong>${expiresMinutes} minutes</strong>
      </div>
    </div>

    <div style="font-size: 12px; line-height: 1.5; color: #71717a; margin-top: 16px;">
      Enter this code on the registration screen to activate your account. If you did not request this, please disregard this message.
    </div>
  `;

  return renderBaseLayout({
    preheader: `Your BBDRTS verification code is ${emailOtpCode}`,
    badge: 'EMAIL VERIFICATION',
    title: 'Verify Your Email',
    subtitle: `Complete your BBDRTS relief account registration.`,
    bodyHtml,
    alertType: 'default'
  });
}

/**
 * 2. Login One-Time Passcode (OTP)
 */
function renderLoginOtpEmail({ otpCode, role = 'donor', expiresMinutes = 5 }) {
  const roleLabel = role === 'organization' ? 'Relief Organization (NGO)' : (role === 'admin' ? 'Administrator' : 'Donor');

  const bodyHtml = `
    <div style="font-size: 13px; line-height: 1.6; color: #d4d4d8; margin-bottom: 16px;">
      Use the one-time passcode below to complete your sign-in to the <strong style="color: #ffffff;">${roleLabel}</strong> portal:
    </div>

    <!-- Monospace Security Code Box -->
    <div style="background-color: #000000; border: 1px solid #27272a; border-radius: 8px; padding: 20px 16px; text-align: center; margin: 18px 0;">
      <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: #71717a; text-transform: uppercase; margin-bottom: 8px;">
        SIGN-IN PASSCODE
      </div>
      <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #ffffff; padding: 4px 0; line-height: 1;">
        ${otpCode}
      </div>
      <div style="margin-top: 10px; font-size: 11px; color: #a1a1aa;">
        Valid for <strong>${expiresMinutes} minutes</strong>
      </div>
    </div>

    <div style="font-size: 12px; line-height: 1.5; color: #71717a; margin-top: 16px;">
      If you did not initiate this login request, your account may be at risk. We recommend changing your password.
    </div>
  `;

  return renderBaseLayout({
    preheader: `Your BBDRTS sign-in passcode is ${otpCode}`,
    badge: 'LOGIN SECURITY',
    title: 'Single-Use Sign-In Code',
    subtitle: `Requested for your ${roleLabel} account.`,
    bodyHtml,
    alertType: 'default'
  });
}

/**
 * 3. Password Reset Link (60-minute Secure Link)
 */
function renderPasswordResetEmail({ resetUrl, email, expiresMinutes = 60 }) {
  const bodyHtml = `
    <div style="font-size: 13px; line-height: 1.6; color: #d4d4d8; margin-bottom: 24px;">
      We received a password reset request for your account (<strong style="color: #ffffff;">${email}</strong>). Click the button below to choose a new password.
    </div>

    <!-- Vercel-Style CTA Button -->
    <div style="text-align: center; margin: 28px 0;">
      <a href="${resetUrl}" style="background-color: #10b981; color: #000000; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 6px; text-decoration: none; display: inline-block;">
        Reset Password
      </a>
    </div>

    <div style="font-size: 12px; line-height: 1.5; color: #71717a; margin: 24px 0 16px 0;">
      This link is strictly single-use and will expire in <strong style="color: #d4d4d8;">${expiresMinutes} minutes</strong>. If you did not request a password reset, no action is required and your existing credentials remain secure.
    </div>

    <!-- Fallback Plain URL -->
    <div style="border-top: 1px solid #18181b; padding-top: 16px; margin-top: 20px;">
      <div style="font-size: 11px; color: #71717a; margin-bottom: 4px;">
        Button not working? Copy and paste this URL into your browser:
      </div>
      <div style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: #10b981; word-break: break-all; line-height: 1.4;">
        <a href="${resetUrl}" style="color: #10b981; text-decoration: underline;">${resetUrl}</a>
      </div>
    </div>
  `;

  return renderBaseLayout({
    preheader: `Reset your BBDRTS password (link valid for ${expiresMinutes} min)`,
    badge: 'PASSWORD RECOVERY',
    title: 'Reset Your Password',
    subtitle: `Follow the link below to securely choose a new password.`,
    bodyHtml,
    alertType: 'default'
  });
}

/**
 * 4. New Device Login Alert
 */
function renderNewDeviceAlertEmail({ userName, deviceInfo, secureUrl }) {
  const bodyHtml = `
    <!-- Minimalist Alert Banner -->
    <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
      <div style="color: #f59e0b; font-size: 12px; font-weight: 600; margin-bottom: 4px;">
        Unrecognized Sign-In
      </div>
      <div style="font-size: 13px; line-height: 1.5; color: #d4d4d8;">
        Hello <strong>${userName || 'Authorized User'}</strong>, a new sign-in was detected from a device or browser not previously recognized.
      </div>
    </div>

    <!-- Telemetry Table -->
    <div style="background-color: #000000; border: 1px solid #27272a; border-radius: 8px; padding: 16px 18px; margin-bottom: 20px;">
      <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.08em; color: #71717a; text-transform: uppercase; margin-bottom: 12px;">
        SESSION TELEMETRY
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 12px; line-height: 1.6;">
        <tr>
          <td style="padding: 4px 0; color: #71717a; width: 110px;">Device</td>
          <td style="padding: 4px 0; color: #ededed; font-weight: 500;">${deviceInfo.os || 'Unknown OS'} (${deviceInfo.deviceType || 'Desktop'})</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #71717a;">Browser</td>
          <td style="padding: 4px 0; color: #ededed; font-weight: 500;">${deviceInfo.browser || 'Web Browser'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #71717a;">Location</td>
          <td style="padding: 4px 0; color: #ededed; font-weight: 500;">${deviceInfo.location || 'Philippines'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #71717a;">Date & Time</td>
          <td style="padding: 4px 0; color: #ededed; font-weight: 500;">${deviceInfo.dateTime || new Date().toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #71717a;">IP Address</td>
          <td style="padding: 4px 0; color: #10b981; font-family: ui-monospace, monospace; font-size: 11px;">${deviceInfo.ip || 'Local / Proxied'}</td>
        </tr>
      </table>
    </div>

    <div style="font-size: 12px; line-height: 1.6; color: #a1a1aa; margin-bottom: 20px;">
      <p style="margin: 0 0 10px 0;">
        If this was you, you can safely ignore this alert.
      </p>
      <p style="margin: 0 0 14px 0; color: #f87171;">
        If you don't recognize this activity, your password may be compromised. Lock down your account to terminate all active sessions and choose a new password:
      </p>

      <div style="text-align: center; margin: 20px 0;">
        <a href="${secureUrl}" style="background-color: #ef4444; color: #ffffff; font-weight: 600; font-size: 13px; padding: 11px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
          Secure Your Account
        </a>
      </div>
    </div>
  `;

  return renderBaseLayout({
    preheader: `Security Alert: New sign-in detected on your BBDRTS account`,
    badge: 'SECURITY ALERT',
    title: 'New Sign-In Detected',
    subtitle: `Activity detected from an unrecognized device.`,
    bodyHtml,
    alertType: 'warning'
  });
}

/**
 * 5. Password Updated Confirmation
 */
function renderPasswordChangedEmail({ email }) {
  const bodyHtml = `
    <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
      <div style="color: #10b981; font-size: 12px; font-weight: 600; margin-bottom: 4px;">
        Password Changed
      </div>
      <div style="font-size: 13px; line-height: 1.5; color: #d4d4d8;">
        The password for your BBDRTS account (<strong style="color: #ffffff;">${email}</strong>) has been successfully updated.
      </div>
    </div>

    <div style="font-size: 12px; line-height: 1.6; color: #71717a;">
      If you did not make this change, please contact our support desk immediately at <a href="mailto:${SUPPORT_EMAIL}" style="color: #ef4444; text-decoration: underline;">${SUPPORT_EMAIL}</a>.
    </div>
  `;

  return renderBaseLayout({
    preheader: `Your BBDRTS password was successfully updated.`,
    badge: 'ACCOUNT SECURITY',
    title: 'Password Updated',
    subtitle: `Your credentials have been securely changed.`,
    bodyHtml,
    alertType: 'default'
  });
}

/**
 * 6. Account Secured Confirmation
 */
function renderAccountSecuredEmail({ email }) {
  const bodyHtml = `
    <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
      <div style="color: #10b981; font-size: 12px; font-weight: 600; margin-bottom: 4px;">
        Account Secured
      </div>
      <div style="font-size: 13px; line-height: 1.5; color: #d4d4d8;">
        Emergency lockdown completed for <strong style="color: #ffffff;">${email}</strong>.
      </div>
    </div>

    <div style="background-color: #000000; border: 1px solid #27272a; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; font-size: 12px; line-height: 1.6; color: #a1a1aa;">
      <div style="margin-bottom: 4px; color: #ededed;">• All active sessions and tokens invalidated</div>
      <div style="margin-bottom: 4px; color: #ededed;">• Account password updated</div>
      <div style="color: #ededed;">• Unrecognized device list cleared</div>
    </div>

    <div style="font-size: 12px; line-height: 1.6; color: #71717a;">
      You can now log in safely with your newly configured credentials.
    </div>
  `;

  return renderBaseLayout({
    preheader: `Your BBDRTS account has been securely locked down.`,
    badge: 'ACCOUNT SECURED',
    title: 'Account Secured',
    subtitle: `Emergency security lockdown and credential update completed.`,
    bodyHtml,
    alertType: 'default'
  });
}

/**
 * 7. Suspicious Login Activity & Account Lockout Alert
 */
function renderSuspiciousLoginEmail({ userName, deviceInfo, failedAttempts = 5, lockDurationMinutes = 15, secureUrl }) {
  const bodyHtml = `
    <!-- Danger Banner -->
    <div style="background-color: #18181b; border: 1px solid #ef4444; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
      <div style="color: #ef4444; font-size: 13px; font-weight: 700; margin-bottom: 4px;">
        Security Notice: Multiple Failed Sign-in Attempts
      </div>
      <div style="font-size: 13px; line-height: 1.5; color: #ededed;">
        Hello <strong>${userName || 'Authorized User'}</strong>, our security telemetry detected <strong>${failedAttempts} consecutive failed sign-in attempts</strong> for your BBDRTS account.
      </div>
      <div style="font-size: 12px; color: #f87171; margin-top: 6px;">
        To protect your account security and donation records, account sign-in is temporarily paused for <strong>${lockDurationMinutes} minutes</strong>.
      </div>
    </div>

    <!-- Telemetry Table -->
    <div style="background-color: #000000; border: 1px solid #27272a; border-radius: 8px; padding: 16px 18px; margin-bottom: 20px;">
      <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.08em; color: #71717a; text-transform: uppercase; margin-bottom: 12px;">
        SOURCE TELEMETRY
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 12px; line-height: 1.6;">
        <tr>
          <td style="padding: 4px 0; color: #71717a; width: 110px;">Device</td>
          <td style="padding: 4px 0; color: #ededed; font-weight: 500;">${deviceInfo.os || 'Unknown OS'} (${deviceInfo.deviceType || 'Desktop'})</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #71717a;">Browser</td>
          <td style="padding: 4px 0; color: #ededed; font-weight: 500;">${deviceInfo.browser || 'Web Browser'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #71717a;">IP Address</td>
          <td style="padding: 4px 0; color: #ef4444; font-family: ui-monospace, monospace; font-size: 11px;">${deviceInfo.ip || 'Unknown'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #71717a;">Timestamp</td>
          <td style="padding: 4px 0; color: #ededed; font-weight: 500;">${deviceInfo.dateTime || new Date().toLocaleString()}</td>
        </tr>
      </table>
    </div>

    <div style="font-size: 12px; line-height: 1.6; color: #a1a1aa; margin-bottom: 20px;">
      <p style="margin: 0 0 10px 0;">
        If this was not you, someone may be attempting to guess your password. We recommend securing your account immediately to terminate all active sessions and choose a fresh password.
      </p>

      <div style="text-align: center; margin: 20px 0;">
        <a href="${secureUrl}" style="background-color: #ef4444; color: #ffffff; font-weight: 600; font-size: 13px; padding: 12px 28px; border-radius: 6px; text-decoration: none; display: inline-block;">
          Secure Account & Reset Password
        </a>
      </div>
    </div>
  `;

  return renderBaseLayout({
    preheader: `Security Alert: Suspicious login attempts and temporary account lockout`,
    badge: 'SECURITY ALERT',
    title: 'Suspicious Login Activity',
    subtitle: `Multiple failed sign-in attempts detected.`,
    bodyHtml,
    alertType: 'danger'
  });
}

/**
 * 8. Email Change Verification (Sent to New Email)
 */
function renderEmailChangeVerificationEmail({ newEmail, verificationUrl, expiresMinutes = 60 }) {
  const bodyHtml = `
    <div style="font-size: 13px; line-height: 1.6; color: #d4d4d8; margin-bottom: 24px;">
      You requested to update your BBDRTS primary account email to <strong style="color: #ffffff;">${newEmail}</strong>.
    </div>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${verificationUrl}" style="background-color: #10b981; color: #000000; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 6px; text-decoration: none; display: inline-block;">
        Verify New Email Address
      </a>
    </div>

    <div style="font-size: 12px; line-height: 1.5; color: #71717a; margin-top: 20px;">
      This verification link is valid for <strong style="color: #d4d4d8;">${expiresMinutes} minutes</strong>. If you did not request this email change, you can safely ignore this email; no changes will be applied to your account.
    </div>
  `;

  return renderBaseLayout({
    preheader: `Verify your new email address for BBDRTS`,
    badge: 'EMAIL CHANGE',
    title: 'Verify New Email Address',
    subtitle: `Confirm ownership of this email to complete the update.`,
    bodyHtml,
    alertType: 'default'
  });
}

/**
 * 9. Email Change Security Alert (Sent to Current Email)
 */
function renderEmailChangeAlertToCurrentEmail({ currentEmail, newEmail, cancelUrl, deviceInfo }) {
  const bodyHtml = `
    <div style="background-color: #18181b; border: 1px solid #f59e0b; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
      <div style="color: #f59e0b; font-size: 12px; font-weight: 600; margin-bottom: 4px;">
        Email Change Requested
      </div>
      <div style="font-size: 13px; line-height: 1.5; color: #d4d4d8;">
        A request was submitted to change your primary account email from <strong>${currentEmail}</strong> to <strong style="color: #ffffff;">${newEmail}</strong>.
      </div>
    </div>

    <div style="font-size: 12px; line-height: 1.6; color: #a1a1aa; margin-bottom: 20px;">
      <p style="margin: 0 0 10px 0;">
        A verification link was sent to the new email address. Your current email remains active until that verification is completed.
      </p>
      <p style="margin: 0 0 14px 0; color: #ef4444;">
        <strong>Did NOT request this change?</strong> Someone may have gained unauthorized access to your account. You have a <strong>30-day emergency protection window</strong> to cancel this change or reclaim your account even if the new email was already confirmed:
      </p>

      <div style="text-align: center; margin: 20px 0;">
        <a href="${cancelUrl}" style="background-color: #ef4444; color: #ffffff; font-weight: 600; font-size: 13px; padding: 12px 26px; border-radius: 6px; text-decoration: none; display: inline-block;">
          Cancel Change & Reclaim Account
        </a>
      </div>

      <p style="margin: 14px 0 0 0; font-size: 11px; color: #71717a; text-align: center;">
        Clicking this button will immediately revert your primary email and terminate all active sessions on other devices.
      </p>
    </div>
  `;

  return renderBaseLayout({
    preheader: `Security Alert: Email change requested for your BBDRTS account`,
    badge: 'SECURITY ALERT',
    title: 'Email Change Requested',
    subtitle: `An update to your account email was initiated.`,
    bodyHtml,
    alertType: 'warning'
  });
}

/**
 * 9b. Email Change Applied Alert (Sent to Original Email when change is confirmed)
 */
function renderEmailChangeAppliedAlertToOriginalEmail({ originalEmail, newEmail, revertUrl }) {
  const bodyHtml = `
    <div style="background-color: #18181b; border: 1px solid #ef4444; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
      <div style="color: #ef4444; font-size: 12px; font-weight: 600; margin-bottom: 4px;">
        Primary Email Address Changed
      </div>
      <div style="font-size: 13px; line-height: 1.5; color: #d4d4d8;">
        Your BBDRTS account primary email was updated from <strong>${originalEmail}</strong> to <strong style="color: #ffffff;">${newEmail}</strong>.
      </div>
    </div>

    <div style="font-size: 12px; line-height: 1.6; color: #a1a1aa; margin-bottom: 20px;">
      <p style="margin: 0 0 10px 0;">
        If you authorized this change, no further action is required.
      </p>
      <div style="background: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; padding: 12px 14px; margin: 16px 0; border-radius: 4px;">
        <strong style="color: #fca5a5; font-size: 12.5px;">Did NOT authorize this? Account hijacked?</strong>
        <p style="margin: 6px 0 0 0; color: #d4d4d8; font-size: 12px; line-height: 1.5;">
          You have an active <strong>30-day emergency protection window</strong>. Click below to immediately revert your email back to <strong>${originalEmail}</strong> and terminate all active sessions across all devices.
        </p>
      </div>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${revertUrl}" style="background-color: #ef4444; color: #ffffff; font-weight: 600; font-size: 13px; padding: 12px 28px; border-radius: 6px; text-decoration: none; display: inline-block;">
          Reclaim Account & Revoke Access
        </a>
      </div>

      <p style="margin: 14px 0 0 0; font-size: 11px; color: #71717a; text-align: center;">
        Valid for 30 days. Clicking will restore your account and sign out all unauthorized sessions.
      </p>
    </div>
  `;

  return renderBaseLayout({
    preheader: `Emergency Alert: Your BBDRTS account email was changed`,
    badge: 'SECURITY ALERT',
    title: 'Account Email Changed',
    subtitle: `Your primary account email was updated to ${newEmail}`,
    bodyHtml,
    alertType: 'warning'
  });
}

/**
 * 9c. Email Change Reverted Confirmation (Sent to Original Email when emergency reclaim is used)
 */
function renderEmailChangeRevertedEmail({ email }) {
  const bodyHtml = `
    <div style="background-color: #18181b; border: 1px solid #10b981; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
      <div style="color: #10b981; font-size: 12px; font-weight: 600; margin-bottom: 4px;">
        Account Successfully Reclaimed & Restored
      </div>
      <div style="font-size: 13px; line-height: 1.5; color: #d4d4d8;">
        Your BBDRTS primary account email has been successfully restored to <strong style="color: #ffffff;">${email}</strong>.
      </div>
    </div>

    <div style="font-size: 12px; line-height: 1.6; color: #a1a1aa; margin-bottom: 20px;">
      <p style="margin: 0 0 10px 0;">
        <strong>Actions taken automatically to protect your account:</strong>
      </p>
      <ul style="margin: 0 0 16px 18px; padding: 0; color: #d4d4d8; font-size: 12.5px; line-height: 1.7;">
        <li>Primary email reverted to <strong>${email}</strong></li>
        <li>All active login sessions across all devices were terminated</li>
        <li>Unauthorized email change authorization was permanently voided</li>
      </ul>
      <p style="margin: 0 0 12px 0;">
        If you suspect your credentials were compromised, please reset your password immediately or enable Two-Factor Authentication (2FA) in Settings.
      </p>
    </div>
  `;

  return renderBaseLayout({
    preheader: `Your BBDRTS account has been reclaimed and restored.`,
    badge: 'ACCOUNT RECLAIMED',
    title: 'Account Successfully Reclaimed',
    subtitle: `Your primary email is active: ${email}`,
    bodyHtml,
    alertType: 'general'
  });
}

/**
 * 10. Two-Factor Authentication Status Changed
 */
function renderTwoFactorStatusChangedEmail({ email, enabled }) {
  const statusColor = enabled ? '#10b981' : '#ef4444';
  const statusLabel = enabled ? 'Enabled' : 'Disabled';

  const bodyHtml = `
    <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
      <div style="color: ${statusColor}; font-size: 12px; font-weight: 600; margin-bottom: 4px;">
        Two-Factor Authentication ${statusLabel}
      </div>
      <div style="font-size: 13px; line-height: 1.5; color: #d4d4d8;">
        Two-Factor Authentication (2FA) via Authenticator App was successfully <strong>${statusLabel.toLowerCase()}</strong> for your BBDRTS account (<strong style="color: #ffffff;">${email}</strong>).
      </div>
    </div>

    <div style="font-size: 12px; line-height: 1.6; color: #71717a;">
      If you did not make this change, please contact our security desk immediately at <a href="mailto:${SUPPORT_EMAIL}" style="color: #ef4444; text-decoration: underline;">${SUPPORT_EMAIL}</a>.
    </div>
  `;

  return renderBaseLayout({
    preheader: `Two-Factor Authentication has been ${statusLabel.toLowerCase()} on your BBDRTS account.`,
    badge: 'ACCOUNT SECURITY',
    title: `Two-Factor Authentication ${statusLabel}`,
    subtitle: `Security settings update confirmation.`,
    bodyHtml,
    alertType: 'default'
  });
}

function renderAccountDeletionScheduledEmail({ email, userName = 'Authorized User', effectiveDate, daysRemaining = 30, cancelUrl }) {
  const bodyHtml = `
    <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 6px; padding: 14px 16px; margin-bottom: 20px;">
      <div style="color: #ef4444; font-size: 13px; font-weight: 600; margin-bottom: 6px;">
        Account Closure & 30-Day Grace Period Initiated
      </div>
      <div style="font-size: 13px; line-height: 1.5; color: #d4d4d8;">
        Hello <strong style="color: #ffffff;">${userName}</strong>,<br/>
        We have received your request to delete your BBDRTS account (<strong style="color: #ffffff;">${email}</strong>).
      </div>
    </div>

    <div style="background: #111113; border: 1px solid #27272a; border-radius: 6px; padding: 14px 16px; margin-bottom: 20px; font-size: 12px; line-height: 1.6; color: #a1a1aa;">
      <div style="color: #ffffff; font-weight: 600; margin-bottom: 8px;">Important Notice Regarding Data & Audit Retention:</div>
      <div style="margin-bottom: 6px;">• <strong>Grace Period:</strong> Your account will be permanently deactivated on <strong style="color: #f59e0b;">${effectiveDate}</strong> (${daysRemaining} days remaining).</div>
      <div style="margin-bottom: 6px;">• <strong>Easy Restoration:</strong> If this was a mistake or you change your mind, simply sign back in to your account at any time within this 30-day window to cancel the deletion request and restore full access immediately.</div>
      <div>• <strong>Compliance & Audit Archives:</strong> In accordance with Philippine statutory accounting laws and Republic Act 10173 (Data Privacy Act of 2012), immutable blockchain transaction proofs and administrative compliance records will remain safely archived for audit integrity.</div>
    </div>

    <div style="text-align: center; margin: 24px 0 16px;">
      <a href="${cancelUrl}" style="display: inline-block; background: #ffffff; color: #000000; padding: 10px 22px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none;">
        Sign In to Cancel Deletion
      </a>
    </div>

    <div style="font-size: 11px; line-height: 1.6; color: #71717a; text-align: center;">
      If you did not initiate this deletion request, please sign in immediately to secure your credentials or reach out to <a href="mailto:${SUPPORT_EMAIL}" style="color: #ef4444; text-decoration: underline;">${SUPPORT_EMAIL}</a>.
    </div>
  `;

  return renderBaseLayout({
    preheader: `Your BBDRTS account deletion request has been scheduled with a 30-day grace period.`,
    badge: 'SECURITY NOTICE',
    title: 'Account Deletion Scheduled',
    subtitle: `Grace period active until ${effectiveDate}.`,
    bodyHtml,
    alertType: 'danger'
  });
}

function renderAccountDeletionCancelledEmail({ email, userName = 'Authorized User' }) {
  const bodyHtml = `
    <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 6px; padding: 14px 16px; margin-bottom: 20px;">
      <div style="color: #10b981; font-size: 13px; font-weight: 600; margin-bottom: 6px;">
        Account Deletion Request Cancelled
      </div>
      <div style="font-size: 13px; line-height: 1.5; color: #d4d4d8;">
        Hello <strong style="color: #ffffff;">${userName}</strong>,<br/>
        Your account deletion request for <strong style="color: #ffffff;">${email}</strong> has been successfully cancelled. Your account remains fully active and protected.
      </div>
    </div>

    <div style="font-size: 12px; line-height: 1.6; color: #a1a1aa;">
      All your profile settings, preferences, and verified credentials continue without interruption. If you did not cancel this request, please contact <a href="mailto:${SUPPORT_EMAIL}" style="color: #ef4444; text-decoration: underline;">${SUPPORT_EMAIL}</a>.
    </div>
  `;

  return renderBaseLayout({
    preheader: `Your BBDRTS account deletion request was cancelled. Your account is active.`,
    badge: 'ACCOUNT RESTORED',
    title: 'Account Restored Successfully',
    subtitle: `Your deletion request has been withdrawn.`,
    bodyHtml,
    alertType: 'success'
  });
}

module.exports = {
  renderBaseLayout,
  renderRegistrationOtpEmail,
  renderLoginOtpEmail,
  renderPasswordResetEmail,
  renderNewDeviceAlertEmail,
  renderPasswordChangedEmail,
  renderAccountSecuredEmail,
  renderSuspiciousLoginEmail,
  renderEmailChangeVerificationEmail,
  renderEmailChangeAlertToCurrentEmail,
  renderEmailChangeAppliedAlertToOriginalEmail,
  renderEmailChangeRevertedEmail,
  renderTwoFactorStatusChangedEmail,
  renderAccountDeletionScheduledEmail,
  renderAccountDeletionCancelledEmail
};
