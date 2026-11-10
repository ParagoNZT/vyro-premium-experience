const parisDate = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const parisOffset = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  timeZoneName: "longOffset",
});

export function parisDateInput(timestamp: number) {
  const parts = parisDate.formatToParts(timestamp);
  const part = (type: "year" | "month" | "day") =>
    parts.find((value) => value.type === type)!.value;
  return [part("year").padStart(4, "0"), part("month"), part("day")].join("-");
}

// A validated calendar date includes the entire day in Paris.
export function expiryAfterParisDay(day: string) {
  const utcMidnight = Date.parse(day + "T00:00:00.000Z") + 86_400_000;
  const offset = parisOffset
    .formatToParts(utcMidnight - 4 * 3_600_000)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(offset ?? "");
  if (!match) throw new RangeError("Invalid Europe/Paris offset");
  const minutes = (Number(match[2]) * 60 + Number(match[3])) * (match[1] === "-" ? -1 : 1);
  return new Date(utcMidnight - minutes * 60_000).toISOString();
}

export function formatLastLicenseDay(expiresAt: string) {
  return parisDate.format(Date.parse(expiresAt) - 1);
}

export function lastIncludedParisDay(expiresAt: string) {
  const timestamp = Date.parse(expiresAt);
  if (!Number.isFinite(timestamp) || expiresAt >= "9999-01-01") return undefined;
  const day = parisDateInput(timestamp - 1);
  return expiryAfterParisDay(day) === expiresAt ? day : undefined;
}
