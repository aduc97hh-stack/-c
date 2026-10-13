"use client";
import { useState } from "react";
import { Checkout } from "./checkout";
import { Attachments } from "./attachments";
import type { Session, CheckoutData, Attachment } from "./model";
export function Workbench({
  session,
  initial,
  names,
  attachments,
  lowScore,
}: {
  session: Session;
  initial: CheckoutData;
  names: Record<string, string>;
  attachments: Attachment[];
  lowScore: number;
}) {
  const [uploading, setUploading] = useState(false);
  const [completed, setCompleted] = useState(session.status === "completed");
  return (
    <>
      <Checkout
        key={session.id + session.status}
        session={session}
        initial={initial}
        names={names}
        uploading={uploading}
        lowScore={lowScore}
        onComplete={() => setCompleted(true)}
      />
      <Attachments
        sessionId={session.id}
        initial={attachments}
        locked={completed || session.status !== "in_progress"}
        onBusyChange={setUploading}
      />
    </>
  );
}
