"use client";
import type { MessageStatus } from "@/lib/types";
import { Check, CheckCheck, Clock } from "lucide-react";

/** Signal-style delivery indicator: clock -> single -> double -> double blue. */
export default function Checks({ status }: { status: MessageStatus }) {
  if (status === "sending")
    return <Clock size={14} className="opacity-70" />;
  if (status === "sent") return <Check size={15} className="opacity-80" />;
  if (status === "delivered")
    return <CheckCheck size={15} className="opacity-80" />;
  // read
  return <CheckCheck size={15} className="text-sky-300" />;
}
