// NextAuth v5 configuration with credentials provider and JWT strategy
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import type { RoleAssignment } from "@/lib/rbac";

// True when token.roles is not a clean RoleAssignment[] — e.g. the legacy
// string[] shape (pre per-BU RBAC) or objects missing businessUnitId. Such
// tokens must be refetched so checkAccess receives a valid RoleAssignment[].
function isLegacyRolesShape(roles: unknown): boolean {
  return (
    Array.isArray(roles) &&
    roles.some((r) => typeof r !== "object" || r === null || !("businessUnitId" in r))
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string, isActive: true },
          include: { roles: true },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!isValid) return null;

        // Block login for users with no role assignment at all — they have no
        // Business Unit access and nothing to do in the app.
        if (user.roles.length === 0) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.roles.map((r) => ({
            role: r.role,
            businessUnitId: r.businessUnitId,
          })),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.roles = (user as { roles: RoleAssignment[] }).roles;
        token.rolesFetchedAt = Date.now();
        return token;
      }
      // Re-fetch roles every 5 minutes so admin role changes propagate without
      // forced re-login. Legacy string[] tokens are refetched immediately so
      // checkAccess always receives RoleAssignment[].
      const STALE_MS = 5 * 60 * 1000;
      const fetchedAt = (token.rolesFetchedAt as number | undefined) ?? 0;
      const stale = Date.now() - fetchedAt > STALE_MS;
      if (token.id && (stale || isLegacyRolesShape(token.roles))) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string, isActive: true },
          include: { roles: true },
        });
        token.roles = fresh
          ? fresh.roles.map((r) => ({ role: r.role, businessUnitId: r.businessUnitId }))
          : [];
        token.rolesFetchedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.roles = (token.roles as RoleAssignment[]) ?? [];
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
});
