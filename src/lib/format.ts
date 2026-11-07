export const formatDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const readingMinutes = (text: string) => Math.max(1, Math.round(text.split(/\s+/).length / 220));
