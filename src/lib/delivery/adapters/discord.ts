import type { DeliveryAdapter } from "./types";

export const discordAdapterPlaceholder: DeliveryAdapter = {
  type: "discord",
  label: "Discord",
  buildPayload() {
    throw new Error("Discord delivery is reserved for a later version.");
  },
  async send() {
    throw new Error("Discord delivery is reserved for a later version.");
  },
  validateChannelConfig() {
    return ["Discord delivery is reserved for a later version."];
  }
};
