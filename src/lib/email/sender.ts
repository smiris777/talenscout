import nodemailer from "nodemailer";

interface SendEmailParams {
  fromEmail: string;
  fromName: string;
  appPassword: string;
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(params: SendEmailParams) {
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // STARTTLS
    auth: {
      user: params.fromEmail,
      pass: params.appPassword,
    },
  });

  const info = await transport.sendMail({
    from: `"${params.fromName}" <${params.fromEmail}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  return { messageId: info.messageId, accepted: info.accepted };
}

export async function testConnection(email: string, appPassword: string): Promise<boolean> {
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: email, pass: appPassword },
  });

  await transport.verify();
  return true;
}
