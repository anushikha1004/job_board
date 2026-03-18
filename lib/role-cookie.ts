const ROLE_COOKIE_KEY = 'th_role';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function setRoleCookie(role: 'candidate' | 'company' | 'admin'): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${ROLE_COOKIE_KEY}=${role}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function clearRoleCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${ROLE_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
}
