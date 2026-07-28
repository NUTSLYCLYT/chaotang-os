const UNKNOWN_TIME = "时间未知";

const BUSINESS_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function formatBusinessTime(
  value: string | null | undefined,
): string {
  if (!value) {
    return UNKNOWN_TIME;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return UNKNOWN_TIME;
  }

  const parts = Object.fromEntries(
    BUSINESS_TIME_FORMATTER.formatToParts(date).map(({ type, value }) => [
      type,
      value,
    ]),
  );

  return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
