export type PlatformCurrency = 'NGN' | 'GHS' | 'USD';

export function currencyForCountry(country: string): PlatformCurrency {
  const normalized = country.trim().toLowerCase();
  if (normalized.includes('nigeria') || normalized === 'ng') return 'NGN';
  if (normalized.includes('ghana') || normalized === 'gh') return 'GHS';
  return 'USD';
}
