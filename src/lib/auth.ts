import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { Resend as ResendClient } from "resend";

import { baseAuthConfig } from "@/auth.config";
import { env } from "@/env";
import { prisma } from "@/lib/prisma";
import { ensureUserProfile } from "@/server/services/accounts";

const providers: NextAuthConfig["providers"] = [
  Resend({
    apiKey: env.AUTH_RESEND_KEY ?? "development-key",
    from: env.RESEND_FROM_EMAIL ?? "Career Studio <hello@careerstudio.lk>",
    async sendVerificationRequest({ identifier, url, provider }) {
      if (!env.AUTH_RESEND_KEY) {
        console.info(`Career Studio sign-in link for ${identifier}: ${url}`);
        return;
      }

      const resend = new ResendClient(env.AUTH_RESEND_KEY);
      await resend.emails.send({
        from: provider.from ?? "Career Studio <hello@careerstudio.lk>",
        to: identifier,
        subject: "Your Career Studio sign-in link",
        text: `Open this secure link to continue to Career Studio:\n\n${url}\n\nThis link expires soon.`,
      });
    },
  }),
];

if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...baseAuthConfig,
  adapter: PrismaAdapter(prisma),
  providers,
  events: {
    async createUser({ user }) {
      if (user.id) {
        await ensureUserProfile(user.id);
      }
    },
  },
  callbacks: {
    ...baseAuthConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        const profile = await ensureUserProfile(user.id);
        const account = await prisma.user.findUnique({
          where: { id: user.id },
          select: { isStaff: true, isSuperuser: true },
        });
        token.planTier = profile.planTier;
        token.isStaff = Boolean(account?.isStaff || account?.isSuperuser);
      }

      return token;
    },
  },
});
