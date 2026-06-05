export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const redirectUri = `${baseUrl}/api/auth/callback`;

  if (!code) {
    return Response.redirect(`${baseUrl}/?auth=failed`);
  }

  try {
    // แลก code เป็น access token
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

    // ดึงข้อมูล profile
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();

    if (!profile.userId) {
      return Response.redirect(`${baseUrl}/?auth=failed`);
    }

    // ส่ง uid + displayName กลับไปหน้าหลักผ่าน URL param
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
