import "next-auth";
import "next-auth/jwt";
import type { PlanTier } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      planTier: PlanTier;
      isStaff: boolean;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    planTier?: PlanTier;
    isStaff?: boolean;
  }
}
