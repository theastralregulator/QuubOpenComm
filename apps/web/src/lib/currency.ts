/**
 * Indian Rupee (INR / ₹) Currency Formatting Utilities for OpenComm
 */

export function formatINR(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '₹0';
  
  if (typeof amount === 'string') {
    if (amount.includes('₹')) return amount;
    const cleanStr = amount.replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleanStr);
    if (isNaN(parsed)) return amount;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(parsed);
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatSalaryRange(min?: number | string, max?: number | string, rawString?: string): string {
  if (rawString) {
    const trimmed = rawString.trim();
    if (!trimmed) return 'Salary discussed during selection';
    
    // Check if it's text without numbers (e.g., "Paid Opportunity", "Negotiable", "Salary discussed", "Contract")
    const hasDigits = /\d/.test(trimmed);
    if (!hasDigits) {
      // Strip any accidental leading/trailing currency symbols if present on pure text
      return trimmed.replace(/^[₹$\s]+/, '');
    }

    if (trimmed.includes('₹')) return trimmed;
    if (trimmed.includes('$')) return trimmed.replace(/\$/g, '₹');

    // Has numbers but no currency symbol
    return `₹${trimmed}`;
  }
  
  if (min !== undefined && max !== undefined && min !== null && max !== null) {
    return `${formatINR(min)} - ${formatINR(max)}`;
  }
  
  return 'Salary discussed during selection';
}
