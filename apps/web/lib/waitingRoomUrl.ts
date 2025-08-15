export const waitingRoomUrl = (uid: string, asHost = false) => {
  const base = process.env.NEXT_PUBLIC_WEBAPP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  return `${base}/dev/waiting-room/${uid}${asHost ? "?host=1" : ""}`;
};
