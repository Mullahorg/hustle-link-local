/**
 * Turns raw backend auth errors into plain language a person can act on.
 * Never shows internal codes or provider jargon.
 */
export function friendlyAuthError(raw: unknown): string {
  const message = (raw instanceof Error ? raw.message : String(raw ?? "")).toLowerCase();

  if (!message) return "Something went wrong. Please try again.";

  if (message.includes("already registered") || message.includes("already been registered") || message.includes("user already exists") || message.includes("duplicate key"))
    return "That email already has an account. Sign in instead, or reset your password.";
  if (message.includes("invalid login credentials") || message.includes("invalid credentials"))
    return "That email and password don't match. Check your password and try again.";
  if (message.includes("email not confirmed"))
    return "Please confirm your email first — check your inbox for the link we sent.";
  if (message.includes("invalid") && (message.includes("otp") || message.includes("token") || message.includes("code")))
    return "That code is wrong or has expired. Request a new one.";
  if (message.includes("expired"))
    return "Your session expired. Please sign in again.";
  if (message.includes("password") && (message.includes("short") || message.includes("least") || message.includes("weak") || message.includes("6 characters")))
    return "That password is too weak. Use at least 8 characters with a number.";
  if (message.includes("same password"))
    return "That's your current password. Choose a different one.";
  if (message.includes("rate limit") || message.includes("too many"))
    return "Too many attempts. Please wait a minute and try again.";
  if (message.includes("failed to fetch") || message.includes("network") || message.includes("offline"))
    return "No connection. Check your internet and try again.";
  if (message.includes("unsupported provider") || message.includes("provider is not enabled"))
    return "That sign-in method isn't available right now. Try email instead.";
  if (message.includes("email") && message.includes("invalid"))
    return "That email address doesn't look right.";
  if (message.includes("not authorised") || message.includes("not authorized") || message.includes("permission") || message.includes("row-level security") || message.includes("42501"))
    return "You don't have permission to do that.";
  if (message.includes("jwt") || message.includes("session"))
    return "Your session expired. Please sign in again.";

  return "Something went wrong. Please try again.";
}
