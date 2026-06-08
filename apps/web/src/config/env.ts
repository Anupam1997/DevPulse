const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
  webhookUrl: process.env.NEXT_PUBLIC_WEBHOOK_URL ?? '',
  githubClientId: process.env.GITHUB_CLIENT_ID ?? '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
  nextAuthSecret: process.env.NEXTAUTH_SECRET ?? '',
  nextAuthUrl: process.env.NEXTAUTH_URL ?? '',
};

const missing = Object.entries(env)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0 && process.env.NODE_ENV === 'production') {
  throw new Error(`Missing env vars: ${missing.join(', ')}`);
}

export default env;
