import nodemailer from "nodemailer";
import { config } from "../config.js";
import { logger } from "../logger.js";

let transporter;

function isConfigured() {
  return Boolean(
    config.alerting.enabled &&
      config.alerting.adminEmail &&
      config.alerting.smtpHost &&
      config.alerting.smtpUser &&
      config.alerting.smtpPass
  );
}

function getTransporter() {
  if (!isConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.alerting.smtpHost,
      port: config.alerting.smtpPort,
      secure: config.alerting.smtpPort === 465,
      auth: {
        user: config.alerting.smtpUser,
        pass: config.alerting.smtpPass
      }
    });
  }
  return transporter;
}

export async function sendCriticalAlertEmail({ motorId, subject, text, html }) {
  const client = getTransporter();
  if (!client) {
    logger.warn("Email alert skipped because SMTP config is incomplete", {
      motorId,
      adminEmail: config.alerting.adminEmail,
      enabled: config.alerting.enabled
    });
    return { sent: false, skipped: true, reason: "smtp_not_configured" };
  }

  const response = await client.sendMail({
    from: config.alerting.fromAddress,
    to: config.alerting.adminEmail,
    subject,
    text,
    html
  });

  logger.info("Critical alert email sent", {
    motorId,
    adminEmail: config.alerting.adminEmail,
    messageId: response.messageId
  });

  return { sent: true, messageId: response.messageId };
}