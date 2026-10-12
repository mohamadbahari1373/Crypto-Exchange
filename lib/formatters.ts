import { Language, NumberDisplayMode } from './types';

// Convert English digits (0-9) to Persian digits (۰-۹)
export function toPersianDigits(n: number | string): string {
  const str = String(n);
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.replace(/[0-9]/g, (w) => persianDigits[Number(w)]);
}

// Format integer with comma separators: 1462100000000 -> 1,462,100,000,000
export function formatWithCommas(num: number): string {
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Format volume in Tomans with standard Iranian financial units (همت / میلیارد / کامل)
export function formatTomanVolume(
  amount: number,
  mode: NumberDisplayMode = 'hemat',
  lang: Language = 'fa'
): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return lang === 'fa' ? '۰ تومان' : '0 TMN';
  }

  // Full precision view (1,462,100,000,000 تومان)
  if (mode === 'full') {
    const formatted = formatWithCommas(amount);
    if (lang === 'fa') {
      return `${toPersianDigits(formatted)} تومان`;
    }
    return `${formatted} TMN`;
  }

  // Pure Billion (میلیارد تومان) view for direct comparison without mixed trillions
  if (mode === 'compact') {
    if (amount >= 1_000_000_000) {
      const val = Math.round(amount / 1_000_000_000);
      const formatted = formatWithCommas(val);
      if (lang === 'fa') {
        return `${toPersianDigits(formatted)} میلیارد تومان`;
      }
      return `${formatted} B TMN`;
    }
    if (amount >= 1_000_000) {
      const val = (amount / 1_000_000).toFixed(1);
      if (lang === 'fa') {
        return `${toPersianDigits(val)} میلیون تومان`;
      }
      return `${val} M TMN`;
    }
    const formatted = formatWithCommas(amount);
    return lang === 'fa' ? `${toPersianDigits(formatted)} تومان` : `${formatted} TMN`;
  }

  // Default 'hemat' mode: Standard Iranian financial term "همت" (هزار میلیارد تومان)
  // For >= 1 Trillion Tomans: e.g. 5.45 همت instead of 5.4 هزار میلیارد تومان
  if (amount >= 1_000_000_000_000) {
    const val = (amount / 1_000_000_000_000).toFixed(2);
    if (lang === 'fa') {
      return `${toPersianDigits(val)} همت`;
    }
    return `${val} T TMN`;
  }

  // >= 1,000,000,000 (1 Billion Tomans / میلیارد تومان)
  if (amount >= 1_000_000_000) {
    const val = (amount / 1_000_000_000).toFixed(1);
    if (lang === 'fa') {
      return `${toPersianDigits(val)} میلیارد تومان`;
    }
    return `${val} B TMN`;
  }

  // >= 1,000,000 (1 Million Tomans / میلیون تومان)
  if (amount >= 1_000_000) {
    const val = (amount / 1_000_000).toFixed(1);
    if (lang === 'fa') {
      return `${toPersianDigits(val)} میلیون تومان`;
    }
    return `${val} M TMN`;
  }

  const formatted = formatWithCommas(amount);
  return lang === 'fa' ? `${toPersianDigits(formatted)} تومان` : `${formatted} TMN`;
}

// Return a secondary explanatory label (e.g. "معادل ۵,۴۵۰ میلیارد تومان") when in hemat mode
export function getSecondaryVolumeLabel(
  amount: number,
  mode: NumberDisplayMode = 'hemat',
  lang: Language = 'fa'
): string | null {
  if (mode === 'hemat' && amount >= 1_000_000_000_000) {
    const billionVal = Math.round(amount / 1_000_000_000);
    const formatted = formatWithCommas(billionVal);
    if (lang === 'fa') {
      return `معادل ${toPersianDigits(formatted)} میلیارد تومان`;
    }
    return `eq. ${formatted} B TMN`;
  }
  return null;
}

// Format percent: e.g. 38.62% or ۳۸.۶٪
export function formatPercent(val: number, lang: Language = 'fa'): string {
  const rounded = val.toFixed(1);
  if (lang === 'fa') {
    return `${toPersianDigits(rounded)}٪`;
  }
  return `${rounded}%`;
}

// Format standard integer/counter
export function formatCount(val: number, lang: Language = 'fa'): string {
  const str = formatWithCommas(val);
  return lang === 'fa' ? toPersianDigits(str) : str;
}

// Format Tether (USDT) quantity
export function formatUsdtAmount(
  amount: number,
  mode: NumberDisplayMode = 'hemat',
  lang: Language = 'fa'
): string {
  if (isNaN(amount) || amount === null || amount === undefined || amount <= 0) {
    return lang === 'fa' ? '۰ USDT' : '0 USDT';
  }

  // Full precision view
  if (mode === 'full') {
    const formatted = formatWithCommas(Math.round(amount));
    return lang === 'fa' ? `${toPersianDigits(formatted)} USDT` : `${formatted} USDT`;
  }

  // Millions of USDT (e.g. 7.85M USDT / ۷.۸۵ میلیون USDT)
  if (amount >= 1_000_000) {
    const val = (amount / 1_000_000).toFixed(2);
    if (lang === 'fa') {
      return `${toPersianDigits(val)} میلیون USDT`;
    }
    return `${val}M USDT`;
  }

  // Thousands of USDT (e.g. 450K USDT / ۴۵۰ هزار USDT)
  if (amount >= 1_000) {
    const val = (amount / 1_000).toFixed(1);
    if (lang === 'fa') {
      return `${toPersianDigits(val)} هزار USDT`;
    }
    return `${val}K USDT`;
  }

  const formatted = formatWithCommas(Math.round(amount));
  return lang === 'fa' ? `${toPersianDigits(formatted)} USDT` : `${formatted} USDT`;
}

// Format crypto coin quantity based on size and symbol
export function formatCoinQty(
  qty: number,
  symbol: string,
  mode: NumberDisplayMode = 'hemat',
  lang: Language = 'fa'
): string {
  if (isNaN(qty) || qty === null || qty === undefined || qty <= 0) {
    return lang === 'fa' ? `۰ ${symbol}` : `0 ${symbol}`;
  }

  if (mode === 'full') {
    const formatted = qty >= 1000 ? formatWithCommas(Math.round(qty)) : qty.toLocaleString('en-US', { maximumFractionDigits: 4 });
    return lang === 'fa' ? `${toPersianDigits(formatted)} ${symbol}` : `${formatted} ${symbol}`;
  }

  // Billions of units (like PEPE or SHIB)
  if (qty >= 1_000_000_000) {
    const val = (qty / 1_000_000_000).toFixed(2);
    if (lang === 'fa') {
      return `${toPersianDigits(val)} میلیارد ${symbol}`;
    }
    return `${val}B ${symbol}`;
  }

  // Millions of units (like DOGE, NOT, etc.)
  if (qty >= 1_000_000) {
    const val = (qty / 1_000_000).toFixed(2);
    if (lang === 'fa') {
      return `${toPersianDigits(val)} میلیون ${symbol}`;
    }
    return `${val}M ${symbol}`;
  }

  // Thousands of units
  if (qty >= 1_000) {
    const val = (qty / 1_000).toFixed(1);
    if (lang === 'fa') {
      return `${toPersianDigits(val)} هزار ${symbol}`;
    }
    return `${val}K ${symbol}`;
  }

  // Standard low quantities (e.g. BTC, ETH, SOL)
  const val = qty >= 10 ? qty.toFixed(1) : qty.toFixed(2);
  return lang === 'fa' ? `${toPersianDigits(val)} ${symbol}` : `${val} ${symbol}`;
}


