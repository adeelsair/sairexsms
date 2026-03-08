export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export const PASSWORD_RULE_TEXT = {
  minLength: `At least ${PASSWORD_MIN_LENGTH} characters`,
  lowercase: "At least one lowercase letter",
  uppercase: "At least one uppercase letter",
  number: "At least one number",
  symbol: "At least one special character",
} as const;

export interface PasswordRuleState {
  minLength: boolean;
  lowercase: boolean;
  uppercase: boolean;
  number: boolean;
  symbol: boolean;
  maxLength: boolean;
}

export function getPasswordRuleState(password: string): PasswordRuleState {
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
    maxLength: password.length <= PASSWORD_MAX_LENGTH,
  };
}

export function isPasswordPolicyCompliant(password: string): boolean {
  const state = getPasswordRuleState(password);
  return (
    state.minLength &&
    state.lowercase &&
    state.uppercase &&
    state.number &&
    state.symbol &&
    state.maxLength
  );
}

export const PASSWORD_POLICY_ERROR =
  "Password must be 8-72 characters and include uppercase, lowercase, number, and special character.";
