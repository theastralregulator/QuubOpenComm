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
    if (rawString.includes('₹')) return rawString;
    if (rawString.includes('$')) {
      return rawString.replace(/\$/g, '₹');
    }
  }
  
  if (min !== undefined && max !== undefined && min !== null && max !== null) {
    return `${formatINR(min)} - ${formatINR(max)}`;
  }
  
  if (rawString) return rawString;
  return '₹0';
}
