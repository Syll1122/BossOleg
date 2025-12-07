// src/services/emailService.ts
// Email service for sending OTP and password reset emails
// Configure your email service credentials here

interface EmailConfig {
  serviceId?: string;
  templateId?: string;
  publicKey?: string;
  passwordTemplateId?: string;
}

// EmailJS Configuration
// To use EmailJS:
// 1. Sign up at https://www.emailjs.com/
// 2. Create an email service (Gmail, Outlook, etc.)
// 3. Create email templates for OTP and password reset
// 4. Get your Service ID, Template IDs, and Public Key
// 5. Replace the values below

// ⚠️ REPLACE THESE WITH YOUR EMAILJS CREDENTIALS
// Get them from: https://dashboard.emailjs.com/
const EMAIL_CONFIG: EmailConfig = {
  serviceId: 'YOUR_SERVICE_ID',           // From Email Services page
  templateId: 'YOUR_OTP_TEMPLATE_ID',     // OTP template ID
  publicKey: 'YOUR_PUBLIC_KEY',           // From Account > General
  passwordTemplateId: 'YOUR_PWD_TEMPLATE_ID', // Password reset template ID
};

/**
 * Send OTP code to email
 */
export const sendOTPEmail = async (email: string, otpCode: string): Promise<boolean> => {
  // Check if EmailJS is configured
  if (
    EMAIL_CONFIG.serviceId === 'YOUR_SERVICE_ID' ||
    EMAIL_CONFIG.templateId === 'YOUR_TEMPLATE_ID' ||
    EMAIL_CONFIG.publicKey === 'YOUR_PUBLIC_KEY'
  ) {
    console.warn('EmailJS not configured. OTP code:', otpCode);
    // In development, you can return false to show OTP in alert
    // In production, you MUST configure EmailJS or another email service
    return false;
  }

  try {
    // EmailJS requires FormData format, not JSON
    const formData = new FormData();
    formData.append('service_id', EMAIL_CONFIG.serviceId!);
    formData.append('template_id', EMAIL_CONFIG.templateId!);
    formData.append('user_id', EMAIL_CONFIG.publicKey!);
    formData.append('template_params', JSON.stringify({
      to_email: email,
      otp_code: otpCode,
      app_name: 'BossOleg',
    }));

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      body: formData,
    });

    return response.ok;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return false;
  }
};

/**
 * Send password to email (for forgot password)
 */
export const sendPasswordEmail = async (email: string, name: string, password: string): Promise<boolean> => {
  // Check if EmailJS is configured
  if (
    EMAIL_CONFIG.serviceId === 'YOUR_SERVICE_ID' ||
    EMAIL_CONFIG.passwordTemplateId === 'YOUR_PASSWORD_TEMPLATE_ID' ||
    EMAIL_CONFIG.publicKey === 'YOUR_PUBLIC_KEY'
  ) {
    console.warn('EmailJS not configured. Password:', password);
    // In development, you can return false to show password in alert
    // In production, you MUST configure EmailJS or another email service
    // NOTE: In production, you should send a password reset link instead of the actual password
    return false;
  }

  try {
    // EmailJS requires FormData format, not JSON
    const formData = new FormData();
    formData.append('service_id', EMAIL_CONFIG.serviceId!);
    formData.append('template_id', EMAIL_CONFIG.passwordTemplateId!);
    formData.append('user_id', EMAIL_CONFIG.publicKey!);
    formData.append('template_params', JSON.stringify({
      to_email: email,
      user_name: name,
      password: password,
      app_name: 'BossOleg',
    }));

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      body: formData,
    });

    return response.ok;
  } catch (error) {
    console.error('Error sending password email:', error);
    return false;
  }
};

