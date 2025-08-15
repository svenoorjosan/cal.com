// apps/web/app/dev/waiting-room/[uid]/page.tsx
//

"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@calcom/trpc/react";

export default function WaitingRoomPage({ params }: { params: { uid: string } }) {
  const bookingUid = params.uid;
  const search = useSearchParams();
  const isHost = useMemo(() => search.get("host") === "1", [search]);

  // Poll status + fetch join info
  const { data: status, isLoading: loadingStatus } =
    trpc.viewer.loggedInViewer.waitingRoom.getStatus.useQuery(
      { bookingUid },
      { refetchInterval: 2000, retry: false }
    );

  const { data: info, isLoading: loadingInfo } =
    trpc.viewer.loggedInViewer.waitingRoom.getJoinInfo.useQuery(
      { bookingUid },
      { retry: false }
    );

  // Host auto-mark joined
  const { mutate: markHostJoined } =
    trpc.viewer.loggedInViewer.waitingRoom.markHostJoined.useMutation();

  useEffect(() => {
    if (isHost) markHostJoined({ bookingUid });
  }, [isHost, bookingUid, markHostJoined]);

  // Auto-redirect when host present & we have a join URL
  useEffect(() => {
    if (status?.enabled && status.hostJoined && info?.joinUrl) {
      window.location.href = info.joinUrl;
    }
  }, [status?.enabled, status?.hostJoined, info?.joinUrl]);

  const waiting = status?.enabled && !status?.hostJoined;

  // Loading state
  if (loadingStatus || loadingInfo) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="rounded-2xl bg-[#0f0f0f] p-8 shadow-xl">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  // Waiting room disabled
  if (!status?.enabled) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="rounded-2xl bg-[#0f0f0f] p-8 text-center shadow-xl">
          <h2 className="text-2xl font-semibold">Waiting room is off</h2>
          <p className="mt-2 text-muted-foreground">This meeting doesn’t use a waiting room.</p>
          {info?.joinUrl && (
            <a
              href={info.joinUrl}
              className="border-border mt-6 inline-flex rounded-lg border px-4 py-2"
            >
              Open meeting
            </a>
          )}
        </div>
      </div>
    );
  }

  // Waiting for host
  if (waiting) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="w-full max-w-md rounded-2xl bg-[#0f0f0f] p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-full border" />
          <h2 className="text-2xl font-semibold">Waiting for host…</h2>
          <p className="mt-2 text-muted-foreground">We’ll let you in as soon as they arrive.</p>
          {isHost && (
            <p className="mt-6 text-xs text-muted-foreground">
              You’re marked as the host. Once you open the meeting, attendees will be admitted.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Host is here — show manual button in case auto-redirect is blocked
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="w-full max-w-md rounded-2xl bg-[#0f0f0f] p-8 text-center shadow-xl">
        <h2 className="text-2xl font-semibold">Host is here ✅</h2>
        <p className="mt-2 text-muted-foreground">Joining your call…</p>
        {info?.joinUrl && (
          <a
            href={info.joinUrl}
            className="border-border mx-auto mt-6 inline-flex items-center justify-center rounded-lg border px-4 py-2"
          >
            Open meeting
          </a>
        )}
      </div>
    </div>
  );
}

