// Admin EmailJS service for sending approval/rejection emails
import emailjs from '@emailjs/browser';

// EmailJS Configuration for approval/rejection
const EMAIL_CONFIG = {
  serviceId: 'service_07debef',
  acceptedTemplateId: 'template_obv438r',
  rejectedTemplateId: 'template_untxk7j',
  publicKey: 's_FkJwQn8_G5O-33a',
};

// Initialize EmailJS
emailjs.init(EMAIL_CONFIG.publicKey);

export interface ApprovalEmailParams {
  toEmail: string;
  userName: string;
  collectorName?: string;
}

/**
 * Send approval email to collector
 */
export async function sendApprovalEmail(params: ApprovalEmailParams): Promise<boolean> {
  try {
    console.log('📧 Sending approval email via EmailJS...', params);

    const result = await emailjs.send(
      EMAIL_CONFIG.serviceId,
      EMAIL_CONFIG.acceptedTemplateId,
      {
        to_email: params.toEmail,
        user_name: params.userName,
        collector_name: params.collectorName || params.userName,
      }
    );

    console.log('✅ Approval email sent successfully!', result);
    return true;
  } catch (error: any) {
    console.error('❌ Error sending approval email:', error);
    return false;
  }
}

/**
 * Send rejection email to collector
 */
export async function sendRejectionEmail(params: ApprovalEmailParams): Promise<boolean> {
  try {
    console.log('📧 Sending rejection email via EmailJS...', params);

    const result = await emailjs.send(
      EMAIL_CONFIG.serviceId,
      EMAIL_CONFIG.rejectedTemplateId,
      {
        to_email: params.toEmail,
        user_name: params.userName,
        collector_name: params.collectorName || params.userName,
      }
    );

    console.log('✅ Rejection email sent successfully!', result);
    return true;
  } catch (error: any) {
    console.error('❌ Error sending rejection email:', error);
    return false;
  }
}







