import { io } from "socket.io-client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api/v1";

type RepairEvent = {
  type: "repair:job-created" | "repair:job-changed";
  payload: {
    repairId: string;
    jobNo: string;
    outletId: string;
    action?:
      | "UPDATED"
      | "STATUS_CHANGED"
      | "PART_ADDED"
      | "PART_REMOVED"
      | "PAYMENT_ADDED"
      | "SETTLED";
  };
};

const toSocketOrigin = (apiBaseUrl: string) => {
  const normalized = apiBaseUrl.endsWith("/") ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
  return normalized.replace(/\/api\/v1$/i, "");
};

export const subscribeRepairRealtime = (
  onRepairJobCreated: (event: RepairEvent["payload"]) => void,
) => {
  const socketOrigin = toSocketOrigin(API_BASE_URL);
  const socket = io(socketOrigin, {
    path: "/api/v1/socket.io",
    transports: ["websocket"],
    withCredentials: true,
  });

  socket.on("repair:job-created", onRepairJobCreated);
  socket.on("repair:job-changed", onRepairJobCreated);

  return () => {
    socket.close();
  };
};
