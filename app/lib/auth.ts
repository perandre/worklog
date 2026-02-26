import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import type { JWT } from "next-auth/jwt"
import { resolveUserAccountId } from "@/app/lib/milient"

declare module "next-auth" {
  interface Session {
    accessToken?: string
    error?: string
    milientUserId?: string
  }
}

interface ExtendedJWT extends JWT {
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  error?: string
  milientUserId?: string
}

async function tryResolveMilientUserId(email: string | null | undefined): Promise<string | undefined> {
  if (!email) return undefined
  try {
    return await resolveUserAccountId(email)
  } catch {
    return undefined
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/drive.metadata.readonly",
            "https://www.googleapis.com/auth/drive.activity.readonly",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }): Promise<ExtendedJWT> {
      const extToken = token as ExtendedJWT

      // Initial sign in
      if (account) {
        return {
          ...extToken,
          accessToken: account.access_token as string,
          refreshToken: account.refresh_token as string,
          expiresAt: account.expires_at as number,
        }
      }

      // Return token if not expired
      if (Date.now() < (extToken.expiresAt ?? 0) * 1000) {
        if (!extToken.milientUserId) {
          const milientUserId = await tryResolveMilientUserId(extToken.email)
          if (milientUserId) return { ...extToken, milientUserId }
        }
        return extToken
      }

      // Refresh the token
      try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: "refresh_token",
            refresh_token: extToken.refreshToken!,
          }),
        })

        const tokens = await response.json()

        if (!response.ok) throw tokens

        const refreshed: ExtendedJWT = {
          ...extToken,
          accessToken: tokens.access_token,
          expiresAt: Math.floor(Date.now() / 1000 + tokens.expires_in),
          refreshToken: tokens.refresh_token ?? extToken.refreshToken,
        }

        if (!refreshed.milientUserId) {
          const milientUserId = await tryResolveMilientUserId(extToken.email)
          if (milientUserId) refreshed.milientUserId = milientUserId
        }

        return refreshed
      } catch (error) {
        console.error("Error refreshing token:", error)
        return { ...extToken, error: "RefreshTokenError" }
      }
    },
    async session({ session, token }) {
      const extToken = token as ExtendedJWT
      session.accessToken = extToken.accessToken
      session.error = extToken.error
      session.milientUserId = extToken.milientUserId
      return session
    },
  },
})
