// apps/web/app/dev/waiting-room/[uid]/HostJoinGate.tsx
//

import { useEffect } from "react";

import { trpc } from "@calcom/trpc/react";

export function HostJoinGate({ bookingUid }: { bookingUid: string }) {
  const markHostJoined = trpc.viewer.loggedInViewer.waitingRoom.markHostJoined.useMutation();

  useEffect(() => {
    markHostJoined.mutate({ bookingUid });
    // fire once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingUid]);

  return null;
}
