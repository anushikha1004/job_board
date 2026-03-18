type CandidateProfileLike = Record<string, unknown> | undefined;

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasSkills(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => typeof item === 'string' && item.trim().length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean).length > 0;
  }
  return false;
}

function hasValidExperienceYears(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0;
  }
  return false;
}

export function isCandidateProfileComplete(profile: CandidateProfileLike): boolean {
  if (!profile) return false;

  return (
    hasText(profile.full_name) &&
    hasText(profile.phone) &&
    hasText(profile.location) &&
    hasText(profile.headline) &&
    hasText(profile.about) &&
    hasValidExperienceYears(profile.experience_years) &&
    hasSkills(profile.skills) &&
    hasText(profile.resume_url)
  );
}
