import type { OperatingStatus } from "@/lib/availability";

interface Props {
  status: OperatingStatus;
}

export function OperatingHoursAlert({ status }: Props) {
  if (status === "open") return null;

  const isClosed = status === "closed";

  return (
    <div
      role="alert"
      className={`sticky top-0 z-40 w-full px-4 py-3 text-center text-sm font-medium ${
        isClosed
          ? "bg-gray-900 text-gray-100 dark:bg-gray-950 dark:text-gray-200"
          : "bg-amber-800 text-white dark:bg-amber-800"
      }`}
    >
      {isClosed ? (
        <>
          🕐 We&apos;re currently closed.{" "}
          <span className="font-normal opacity-90">Open daily 11AM–11PM. Last order 10:30PM.</span>
        </>
      ) : (
        <>
          ⏰ Last order has passed for today.{" "}
          <span className="font-normal opacity-90">Come back tomorrow!</span>
        </>
      )}
    </div>
  );
}
