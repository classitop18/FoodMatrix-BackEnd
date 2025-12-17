import nodemailer, { Transporter } from "nodemailer";
import Handlebars from "handlebars";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { CONFIG } from "../utils/env.config.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const BASE_DIR = path.join(__dirname, "layouts");
const LAYOUT_FILE = path.join(BASE_DIR, "main.hbs");

type TemplateContext = Record<string, any>;

export interface EmailServiceOptions {
  provider?: "smtp" | "console";
}

export class EmailService {
  private transporter: Transporter | null = null;
  private from: string;
  private provider: "smtp" | "console";

  constructor(opts?: EmailServiceOptions) {
    this.provider =
      opts?.provider ?? (process.env.EMAIL_PROVIDER as any) ?? "smtp";
    this.from = process.env.EMAIL_FROM ?? "no-reply@example.com";

    if (this.provider === "smtp") {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
    } else {
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: "unix",
        buffer: true,
      } as any);
    }
  }

  private renderTemplate(templateName: string, context: TemplateContext) {
    const templatePath = path.join(BASE_DIR, `${templateName}.hbs`);
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Email template not found: ${templateName}`);
    }

    const templateSource = fs.readFileSync(templatePath, "utf8");

    const layoutSource = fs.existsSync(LAYOUT_FILE)
      ? fs.readFileSync(LAYOUT_FILE, "utf8")
      : "{{{body}}}";

    const finalSource = layoutSource.replace("{{{body}}}", templateSource);

    const compiled = Handlebars.compile(finalSource);

    return compiled({
      ...context,
      appUrl: process.env.APP_URL,
      year: new Date().getFullYear(),
    });
  }

  async sendMail(
    to: string,
    subject: string,
    templateName?: string,
    context: TemplateContext = {},
    overrides?: { html?: string; text?: string },
  ) {
    let html = overrides?.html;
    let text = overrides?.text;

    if (templateName) {
      html = this.renderTemplate(templateName, context);
      text = html.replace(/<\/?[^>]+>/g, "").trim();
    }

    const mailOptions = {
      from: this.from,
      to,
      subject,
      html,
      text,
    };

    if (!this.transporter) throw new Error("Transporter not initialized");

    try {
      const info = await this.transporter.sendMail(mailOptions);

      if ((info as any).message) {
        console.log("\n📨 EMAIL (console mode):\n");
        console.log((info as any).message.toString());
      } else {
        console.log("Email sent:", info);
      }

      return info;
    } catch (err) {
      console.error("Email send failed:", err);
      throw err;
    }
  }

  async sendVerificationEmail(to: string, token: string, name?: string) {
    const verifyUrl = `${CONFIG.APP_URL}/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`;

    return this.sendMail(to, "Verify your email", "verification", {
      name: name ?? "there",
      verifyUrl,
    });
  }

  async sendResetPasswordEmail(
    to: string,
    token: string,
    name?: string,
    expiresMins = 60,
  ) {
    const resetUrl = `${process.env.APP_URL}/api/v1/auth/verify/${encodeURIComponent(token)}`;

    return this.sendMail(to, "Reset your password", "reset-password", {
      name: name ?? "there",
      resetUrl,
      expires: expiresMins,
    });
  }

  async sendOtpEmail(
    to: string,
    otp: string | number,
    name?: string,
    expiresMins = 10,
  ) {
    return this.sendMail(to, "Your OTP Code", "otp", {
      name: name ?? "there",
      otp,
      expires: expiresMins,
    });
  }

  async sendMemberInvitationEmail(
    to: string,
    inviteeName: string,
    inviterName: string,
    accountName: string,
    acceptLink: string,
  ) {
    return this.sendMail(
      to,
      `Join ${accountName} on FoodMatrix`,
      "member-invitation",
      {
        inviteeName,
        inviterName,
        accountName,
        acceptLink,
      },
    );
  }
}

export const emailService = new EmailService();
