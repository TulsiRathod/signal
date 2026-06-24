"use client";
import { mediaUrl } from "@/lib/api";
import { avatarColor, initials } from "@/lib/utils";
import clsx from "clsx";

interface Props {
  name: string;
  src?: string | null;
  seed?: number | string;
  size?: number;
  online?: boolean;
  className?: string;
}

export default function Avatar({
  name,
  src,
  seed,
  size = 48,
  online,
  className,
}: Props) {
  const url = mediaUrl(src);
  return (
    <div
      className={clsx("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full font-medium text-white"
          style={{
            backgroundColor: avatarColor(seed ?? name),
            fontSize: size * 0.4,
          }}
        >
          {initials(name)}
        </div>
      )}
      {online != null && (
        <span
          className={clsx(
            "absolute bottom-0 right-0 block rounded-full border-2 border-surface",
            online ? "bg-green-500" : "bg-transparent"
          )}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}
