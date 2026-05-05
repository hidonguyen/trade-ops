// NextAuth v5 configuration with credentials provider and JWT strategy
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

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

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          roles: user.roles.map((r: any) => r.role),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.roles = (user as any).roles;
        token.rolesFetchedAt = Date.now();
        return token;
      }
      // Re-fetch roles every 5 minutes so admin role changes propagate without forced re-login
      const STALE_MS = 5 * 60 * 1000;
      const fetchedAt = (token.rolesFetchedAt as number | undefined) ?? 0;
      if (token.id && Date.now() - fetchedAt > STALE_MS) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string, isActive: true },
          include: { roles: true },
        });
        if (!fresh) {
          token.roles = [];
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          token.roles = fresh.roles.map((r: any) => r.role);
        }
        token.rolesFetchedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.roles = token.roles as string[];
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
