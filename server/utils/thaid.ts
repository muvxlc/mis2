// ThaID (DOPA) OIDC Utility
export const getThaIDAuthUrl = () => {
  const baseUrl = process.env.THAID_BASE_URL || 'https://imauth.bora.dopa.go.th/api/v2/oauth2/auth/';
  const clientId = process.env.THAID_CLIENT_ID;
  const redirectUri = process.env.THAID_REDIRECT_URI;
  
  if (!clientId || !redirectUri) {
    throw new Error('ThaID configuration missing');
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid pid name',
    state: 'thaid_login' // Should ideally be random and verified in callback
  });

  return `${baseUrl}?${params.toString()}`;
};

export const exchangeThaIDCode = async (code: string) => {
  const tokenUrl = process.env.THAID_TOKEN_URL || 'https://imauth.bora.dopa.go.th/api/v2/oauth2/token/';
  const clientId = process.env.THAID_CLIENT_ID;
  const clientSecret = process.env.THAID_CLIENT_SECRET;
  const redirectUri = process.env.THAID_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('ThaID configuration missing');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await $fetch<any>(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    })
  });

  return response; // { access_token, id_token, ... }
};

export const getThaIDUserInfo = async (accessToken: string) => {
  const userinfoUrl = process.env.THAID_USERINFO_URL || 'https://imauth.bora.dopa.go.th/api/v2/oauth2/userinfo/';

  const response = await $fetch<any>(userinfoUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  return response; // Should contain pid, name, etc.
};
