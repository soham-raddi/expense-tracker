import filters from '../config/smsFilters.json';

const otp = filters.otpPatterns.map(p => new RegExp(p, 'i'));
const notices = filters.noticePatterns.map(p => new RegExp(p, 'i'));
const txnHints = filters.transactionHints.map(w => new RegExp(`\\b${w}\\b`, 'i'));
const amountHints = filters.amountHints.map(p => new RegExp(p, 'i'));

export function isOtp(body: string): boolean {
  return otp.some(r => r.test(body));
}

/** A heads-up about a payment that has not happened yet, so nothing has been debited. */
export function isNotice(body: string): boolean {
  return notices.some(r => r.test(body));
}

/** True if the SMS looks like a money movement (vs. a promo or info message). */
export function looksLikeTransaction(body: string): boolean {
  return txnHints.some(r => r.test(body)) && amountHints.some(r => r.test(body));
}
