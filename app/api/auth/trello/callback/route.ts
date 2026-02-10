import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

// NOTE:
// Trello's "response_type=token" flow normally returns the token in the URL fragment,
// which is only visible client-side. This callback route is provided as a placeholder
// if you decide to implement a client-side fragment parser and then POST the token here.
//
// For now, this route accepts a `token` query parameter and stores it in an HTTP-only cookie.

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const token = searchParams.get("token")
  const error = searchParams.get("error")

  if (error) {
    console.error("Trello OAuth error:", error)
    return NextResponse.redirect(new URL("/?trello_error=" + error, process.env.NEXTAUTH_URL))
  }

  if (!token) {
    // In a real implementation, you might redirect to a page that can read the
    // fragment part of the URL and then call a POST endpoint with the token.
    return NextResponse.redirect(new URL("/?trello_error=no_token", process.env.NEXTAUTH_URL))
  }

  try {
    const cookieStore = await cookies()
    cookieStore.set("trello_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    })

    console.log("[Trello] OAuth successful, token stored")

    return NextResponse.redirect(new URL("/?trello_connected=true", process.env.NEXTAUTH_URL))
  } catch (err) {
    console.error("Trello OAuth error:", err)
    return NextResponse.redirect(new URL("/?trello_error=store_failed", process.env.NEXTAUTH_URL))
  }
}

