export interface PasswordValidationResult {
  isValid: boolean;
  error: string | null;
  checks: {
    minLength: boolean;
    hasUpper: boolean;
    hasLower: boolean;
    hasNumber: boolean;
  };
}

export function validatePassword(password: string): PasswordValidationResult {
  const pass = password || '';
  const minLength = pass.length >= 8;
  const hasUpper = /[A-Z]/.test(pass);
  const hasLower = /[a-z]/.test(pass);
  const hasNumber = /[0-9]/.test(pass);

  const isValid = minLength && hasUpper && hasLower && hasNumber;

  let error: string | null = null;
  if (!minLength) {
    error = 'Password must be at least 8 characters long.';
  } else if (!hasUpper) {
    error = 'Password must contain at least 1 uppercase letter.';
  } else if (!hasLower) {
    error = 'Password must contain at least 1 lowercase letter.';
  } else if (!hasNumber) {
    error = 'Password must contain at least 1 number.';
  }

  return {
    isValid,
    error,
    checks: {
      minLength,
      hasUpper,
      hasLower,
      hasNumber,
    },
  };
}
