import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true";

  if (!host || !user || !pass) {
    throw new Error("SMTP_HOST, SMTP_USER and SMTP_PASS must be set");
  }

  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

export async function sendVerificationEmail(
  to: string,
  token: string,
): Promise<void> {
  const appUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
  const link = `${appUrl}/verify-email?token=${token}`;
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@example.com";

  const transport = createTransport();
  await transport.sendMail({
    from,
    to,
    subject: "Verifique seu e-mail — Mike",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Bem-vindo ao Mike!</h2>
        <p>Clique no link abaixo para verificar o seu endereço de e-mail:</p>
        <p>
          <a href="${link}" style="
            display:inline-block;
            background:#000;
            color:#fff;
            padding:12px 24px;
            border-radius:8px;
            text-decoration:none;
            font-weight:600
          ">Verificar e-mail</a>
        </p>
        <p style="color:#666;font-size:13px">
          O link expira em 24 horas. Se você não criou uma conta, ignore este e-mail.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#999;font-size:12px">Mike — Document Assistant</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
): Promise<void> {
  const appUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
  const link = `${appUrl}/reset-password?token=${token}`;
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@example.com";

  const transport = createTransport();
  await transport.sendMail({
    from,
    to,
    subject: "Redefinição de senha — Mike",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Redefinição de senha</h2>
        <p>Clique no link abaixo para redefinir sua senha:</p>
        <p>
          <a href="${link}" style="
            display:inline-block;
            background:#000;
            color:#fff;
            padding:12px 24px;
            border-radius:8px;
            text-decoration:none;
            font-weight:600
          ">Redefinir senha</a>
        </p>
        <p style="color:#666;font-size:13px">
          O link expira em 1 hora. Se você não solicitou a redefinição, ignore este e-mail.
        </p>
      </div>
    `,
  });
}
