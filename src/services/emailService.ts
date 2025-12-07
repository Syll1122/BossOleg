// src/services/emailService.ts
// Email service for sending OTP and password reset emails
// Using EmailJS SDK for reliable email delivery

import emailjs from '@emailjs/browser';

// EmailJS Configuration
// ⚠️ REPLACE THESE WITH YOUR EMAILJS CREDENTIALS
// Get them from: https://dashboard.emailjs.com/
const EMAIL_CONFIG = {
  serviceId: 'service_tnj5b06',           // From Email Services page
  templateId: 'template_kev84tu',         // OTP template ID
  publicKey: '9ym2DrtC59VedPK_b',         // From Account > General
  passwordTemplateId: 'template_odc4hxj', // Password reset template ID
};

// Initialize EmailJS with your Public Key
emailjs.init(EMAIL_CONFIG.publicKey);

/**
 * Send OTP code to email
 */
export const sendOTPEmail = async (email: string, otpCode: string): Promise<boolean> => {
  // Validate configuration
  if (!EMAIL_CONFIG.serviceId || !EMAIL_CONFIG.templateId || !EMAIL_CONFIG.publicKey) {
    console.error('❌ EmailJS configuration missing:', EMAIL_CONFIG);
    return false;
  }

  try {
    console.log('📧 Attempting to send OTP email via EmailJS...', {
      serviceId: EMAIL_CONFIG.serviceId,
      templateId: EMAIL_CONFIG.templateId,
      recipientEmail: email,
      otpCode: otpCode
    });

    // Use EmailJS SDK - much more reliable!
    const result = await emailjs.send(
      EMAIL_CONFIG.serviceId,
      EMAIL_CONFIG.templateId,
      {
        to_email: email,
        otp_code: otpCode,
        app_name: 'BossOleg',
      }
    );

    console.log('✅ OTP email sent successfully!', result);
    return true;
  } catch (error: any) {
    console.error('❌ Error sending OTP email:', error);
    console.error('Error details:', {
      status: error?.status,
      text: error?.text,
      message: error?.message
    });
    
    // Show user-friendly error
    const errorMessage = error?.text || error?.message || 'Unknown error';
    alert(`Failed to send email: ${errorMessage}`);
    return false;
  }
};

/**
 * Send password to email (for forgot password)
 */
export const sendPasswordEmail = async (email: string, name: string, password: string): Promise<boolean> => {
  // Validate configuration
  if (!EMAIL_CONFIG.serviceId || !EMAIL_CONFIG.passwordTemplateId || !EMAIL_CONFIG.publicKey) {
    console.error('❌ EmailJS configuration missing for password email');
    return false;
  }

  try {
    console.log('📧 Sending password recovery email via EmailJS...');

    // Use EmailJS SDK
    const result = await emailjs.send(
      EMAIL_CONFIG.serviceId,
      EMAIL_CONFIG.passwordTemplateId,
      {
        to_email: email,
        user_name: name,
        password: password,
        app_name: 'BossOleg',
      }
    );

    console.log('✅ Password email sent successfully!', result);
    return true;
  } catch (error: any) {
    console.error('❌ Error sending password email:', error);
    return false;
  }
};

