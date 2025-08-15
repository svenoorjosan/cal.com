// packages/trpc/server/routers/waitingRoom.ts
import { z } from "zod";

import prisma from "@calcom/prisma";

import { TRPCError } from "@trpc/server";

import authedProcedure from "../procedures/authedProcedure";
import { router, publicProcedure } from "../trpc";

/**
 * Normalize deep-link join URLs to browser-friendly links (avoid xdg-open prompts).
 * Extend as needed for other providers.
 */
function normalizeJoinUrl(url: string): string {
  try {
    const u = new URL(url);

    // Zoom native deep link -> web join URL
    if (u.protocol === "zoommtg:") {
      // zoommtg://zoom.us/join?confno=XXXXXXXXXX&pwd=YYYY
      const id = u.searchParams.get("confno") || u.pathname.split("/").pop() || "";
      const pwd = u.searchParams.get("pwd");
      return `https://zoom.us/w/${id}${pwd ? `?pwd=${pwd}` : ""}`;
    }

    // Microsoft Teams: msteams://teams.microsoft.com/l/meetup-join/... or msteams://?url=<https link>
    if (u.protocol === "msteams:") {
      const inner = u.searchParams.get("url");
      if (inner) return inner;
      // Sometimes pathname already carries a web URL-ish path; if not, just fall through.
    }

    // Unknown / already http(s)
    return url;
  } catch {
    return url;
  }
}

export const waitingRoomRouter = router({
  // Attendee/host: poll status
  getStatus: publicProcedure.input(z.object({ bookingUid: z.string() })).query(async ({ input }) => {
    const booking = await prisma.booking.findFirst({
      where: { uid: input.bookingUid },
      select: { metadata: true /* , startTime: true, endTime: true */ },
    });

    const enabled = !!(booking as any)?.metadata?.waitingRoom?.enabled;
    const hostJoinedAt = (booking as any)?.metadata?.waitingRoom?.hostJoinedAt ?? null;

    // (Optional) Time guard example:
    // const now = new Date();
    // if (booking?.startTime) {
    //   const diffMin = Math.abs((now.getTime() - booking.startTime.getTime()) / 60000);
    //   if (diffMin > 6 * 60) return { enabled: false, hostJoined: false }; // >6h away: disabled
    // }

    return { enabled, hostJoined: !!hostJoinedAt };
  }),

  // Provider join info (URL/title/time)
  getJoinInfo: publicProcedure.input(z.object({ bookingUid: z.string() })).query(async ({ input }) => {
    const b = await prisma.booking.findUnique({
      where: { uid: input.bookingUid },
      select: { metadata: true, location: true, title: true, startTime: true },
    });
    if (!b) return { joinUrl: null, title: null, startsAt: null };

    const meta = (b.metadata ?? {}) as any;
    const loc = b.location as any;

    // Try common places Cal stores meeting URLs
    const locString = typeof loc === "string" ? loc : loc?.link || loc?.meetingUrl || loc?.url || "";

    // Raw URL from metadata or location
    const joinUrlRaw: string | null = meta.videoCallUrl || locString || null;

    // Normalize to a web-friendly URL if possible (avoids xdg-open prompt)
    const joinUrl = joinUrlRaw ? normalizeJoinUrl(joinUrlRaw) : null;

    return {
      joinUrl,
      title: b.title,
      startsAt: b.startTime?.toISOString?.() ?? null,
    };
  }),

  // Host: mark presence (organizer-only; extend to team if desired)
  markHostJoined: authedProcedure
    .input(z.object({ bookingUid: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const viewerId = ctx.user?.id;
      if (!viewerId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const booking = await prisma.booking.findFirst({
        where: { uid: input.bookingUid },
        select: { id: true, userId: true /*, teamId: true */, metadata: true },
      });
      if (!booking) throw new TRPCError({ code: "NOT_FOUND" });

      // Organizer check
      const isOrganizer = booking.userId === viewerId;

      // (Optional) Also allow team members – enable if your schema matches:
      // let isTeamMember = false;
      // if (booking.teamId) {
      //   const membership = await prisma.membership.findFirst({
      //     where: { teamId: booking.teamId, userId: viewerId },
      //     select: { id: true },
      //   });
      //   isTeamMember = !!membership;
      // }

      if (!isOrganizer /* && !isTeamMember */) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const next = {
        ...((booking.metadata as any) ?? {}),
        waitingRoom: { enabled: true, hostJoinedAt: new Date().toISOString() },
      };

      await prisma.booking.update({
        where: { id: booking.id },
        data: { metadata: next as any },
      });
      return { ok: true };
    }),
});
