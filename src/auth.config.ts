import type { NextAuthConfig } from "next-auth";

export const authPages = {
  signIn: "/en/auth/sign-in",
  verifyRequest: "/en/auth/verify-request",
} satisfies NonNullable<NextAuthConfig["pages"]>;

export const baseAuthConfig = {
  pages: authPages,
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? token.sub ?? "";
        session.user.planTier = token.planTier ?? "basic";
        session.user.isStaff = Boolean(token.isStaff);
      }

      return session;
    },
  },
} satisfies NextAuthConfig;
