import type { Packet, Party } from "./types";

const strip = (p: Party): Party => ({ ...p, tin: null });

/**
 * A copy of the packet with every TIN removed, for saving on the server (packet data is copied
 * into the audit log). TINs are fetched again through the encrypted store when a PDF is made.
 */
export function redactTins(packet: Packet): Packet {
  return {
    ...packet,
    documents: packet.documents.map((d) => ({
      ...d,
      recipient: d.recipient ? strip(d.recipient) : undefined,
      schedule: d.schedule ? { ...d.schedule, rows: d.schedule.rows.map((r) => ("tin" in r ? { ...r, tin: "" } : r)) } : undefined,
    })),
  };
}
