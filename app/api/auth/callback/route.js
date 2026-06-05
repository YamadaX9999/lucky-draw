export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const redirectUri = `${baseUrl}/api/auth/callback`;

  // prompt=none ล้มเหลว (user ยังไม่เคย authorize) → retry ด้วย consent
  if (error === 'login_required' || error === 'consent_required' || error === 'interaction_required') {
    return Response.redirect(`${baseUrl}/api/auth/line?retry=1`);
  }

  if (!code) {
    return Response.redirect(`${baseUrl}/?auth=failed`);
  }

  try {
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: process.env.LINE_CHANNEL_ID,
        client_secret: process.env.LINE_CHANNEL_SECRET,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return Response.redirect(`${baseUrl}/?auth=failed`);
    }

    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();

    if (!profile.userId) {
      return Response.redirect(`${baseUrl}/?auth=failed`);
    }

    const params = new URLSearchParams({
      uid: profile.userId,
      name: profile.displayName,
      pic: profile.pictureUrl || '',
    });

    return Response.redirect(`${baseUrl}/?${params}`);
  } catch (err) {
    return Response.redirect(`${baseUrl}/?auth=failed`);
  }
}
