import type { DeliveryAdapter } from "./types";

export const telegramAdapterPlaceholder: DeliveryAdapter = {
  type: "telegram",
  label: "Telegram",
  buildPayload() {
    throw new Error("Telegram delivery is reserved for a later version.");
  },
  async send() {
    throw new Error("Telegram delivery is reserved for a later version.");
  },
  validateChannelConfig() {
    return ["Telegram delivery is reserved for a later version."];
  }
};
