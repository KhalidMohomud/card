import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { username } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  appName: "SwiftWash POS",
  database: prismaAdapter(prisma, { provider: "postgresql", transaction: true }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
  },
  user: {
    additionalFields: {
      fullName: { type: "string", required: true, input: true },
      role: { type: "string", required: true, defaultValue: "SUPERVISOR", input: false },
      isActive: { type: "boolean", required: true, defaultValue: true, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 12,
    updateAge: 60 * 60,
    // Avoid a remote database lookup on every page transition. The short TTL
    // keeps account-disable propagation bounded while making normal navigation instant.
    cookieCache: { enabled: true, maxAge: 60, strategy: "compact" },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/username": { window: 60, max: 5 },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    cookiePrefix: "swiftwash",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  },
  disabledPaths: ["/sign-up/email", "/is-username-available"],
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { isActive: true },
          });
          return user?.isActive === true;
        },
      },
    },
  },
  plugins: [username({ minUsernameLength: 3, maxUsernameLength: 30 })],
});

export type AuthSession = typeof auth.$Infer.Session;
