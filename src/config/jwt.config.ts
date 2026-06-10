export const jwtConfig = {
  secret: process.env.JWT_SECRET ?? 'dev-only-change-in-production',
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-only-refresh-change-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
};
