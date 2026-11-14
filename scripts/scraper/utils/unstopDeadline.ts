type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

/**
 * Return only explicit registration-close fields from Unstop.
 *
 * Do not use item.end_date, event_end_date, round.end_date or the final
 * hackathon round: those describe when the event finishes, not when sign-up
 * closes. Missing registration dates remain unknown instead of being guessed.
 */
export function extractUnstopRegistrationDeadline(item: unknown): string | undefined {
  const record = asRecord(item);
  const requirements = asRecord(record.regnRequirements ?? record.registration_requirements);

  return text(requirements.end_regn_dt) ||
    text(record.registration_end) ||
    text(record.registrationEndDate) ||
    text(record.regn_end_date) ||
    text(record.deadline);
}
