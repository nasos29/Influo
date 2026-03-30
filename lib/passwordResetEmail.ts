/** Shared HTML for branded password reset (Resend). Used by /api/emails and /api/auth/forgot-password. */

export type PasswordResetLang = 'el' | 'en';

export function buildPasswordResetEmail(
  resetLink: string,
  lang: PasswordResetLang
): { subject: string; html: string } {
  if (lang === 'el') {
    return {
      subject: 'Επαναφορά Κωδικού Πρόσβασης - Influo.gr',
      html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">🔐 Επαναφορά Κωδικού</h1>
              </div>
              <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="margin: 0 0 16px 0; font-size: 14px;">Γεια σας,</p>
                <p style="margin: 0 0 20px 0; font-size: 13px; color: #4b5563;">Έχετε ζητήσει επαναφορά του κωδικού πρόσβασης για το λογαριασμό σας στο Influo.gr.</p>
                <p style="margin: 0 0 20px 0; font-size: 13px; color: #4b5563;">Πατήστε το παρακάτω κουμπί για να ορίσετε έναν νέο κωδικό πρόσβασης:</p>
                <div style="margin: 24px 0; text-align: center;">
                  <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">Επαναφορά Κωδικού</a>
                </div>
                <p style="margin: 20px 0 0 0; font-size: 12px; color: #6b7280;">Αν δεν ζητήσατε αυτή την επαναφορά, μπορείτε να αγνοήσετε αυτό το email.</p>
                <p style="margin: 12px 0 0 0; font-size: 12px; color: #9ca3af;">Αυτός ο σύνδεσμος είναι έγκυρος για 1 ώρα.</p>
                <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af;">Η ομάδα του Influo.gr</p>
                </div>
              </div>
            </div>
          `,
    };
  }
  return {
    subject: 'Password Reset - Influo.gr',
    html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">🔐 Password Reset</h1>
              </div>
              <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="margin: 0 0 16px 0; font-size: 14px;">Hello,</p>
                <p style="margin: 0 0 20px 0; font-size: 13px; color: #4b5563;">You have requested to reset your password for your Influo.gr account.</p>
                <p style="margin: 0 0 20px 0; font-size: 13px; color: #4b5563;">Click the button below to set a new password:</p>
                <div style="margin: 24px 0; text-align: center;">
                  <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">Reset Password</a>
                </div>
                <p style="margin: 20px 0 0 0; font-size: 12px; color: #6b7280;">If you did not request this reset, you can safely ignore this email.</p>
                <p style="margin: 12px 0 0 0; font-size: 12px; color: #9ca3af;">This link is valid for 1 hour.</p>
                <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af;">The Influo.gr Team</p>
                </div>
              </div>
            </div>
          `,
  };
}
