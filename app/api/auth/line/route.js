export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`;

  const state = Math.random().toString(36).substring(2);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINE_CHANNEL_ID,
    redirect_uri: redirectUri,
    state,
    scope: 'profile openid',
    prompt: 'none',
  });

  return Response.redirect(`https://access.line.me/oauth2/v2.1/authorize?${params}`);
}
