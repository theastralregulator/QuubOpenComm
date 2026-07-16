export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validatePassword(password: string): boolean {
  // At least 8 characters, 1 letter, and 1 number
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export function validateUsername(username: string): boolean {
  // 3-20 characters, alphanumeric and underscore
  const re = /^[a-zA-Z0-9_]{3,20}$/;
  return re.test(username);
}

export function validateRequired(value: string | any): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}
