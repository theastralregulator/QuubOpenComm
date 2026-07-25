export function getInitials(name?: string | null, email?: string | null) {
  const safeName = name?.trim();

  if (safeName) {
    const parts = safeName.split(/\s+/).filter(Boolean);
    return parts
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
  }

  const safeEmail = email?.trim();

  if (safeEmail) {
    return safeEmail.charAt(0).toUpperCase();
  }

  return 'U';
}

export function getDisplayEmail(email?: string | null) {
  return email?.trim() || 'Email unavailable';
}

export function getDisplayName(user: any) {
  if (!user) return 'OpenComm User';
  const name = user.full_name?.trim() || user.username?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email.split('@')[0];
  return 'OpenComm User';
}
