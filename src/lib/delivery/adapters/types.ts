import type {
  DailyDigest,
  DeliveryChannelType,
  DeliveryFormat,
  StoredDeliveryChannel
} from "@/types/content";

export interface DeliveryChannelConfig {
  type: DeliveryChannelType;
  endpointUrl: string;
  format: DeliveryFormat;
  /** Telegram: the token to validate (the stored one when the form left it blank). */
  botToken?: string;
  chatId?: string;
}

export interface DeliveryAdapterPayload {
  body: string;
  contentType: string;
  preview?: string;
}

export interface DeliveryAdapterSendResult {
  ok: boolean;
  status?: number;
  bodyPreview: string;
}

// Adapters receive the stored channel, secrets included: they are the only
// code besides the delivery workflow that may read `botToken`.
export interface DeliveryAdapter {
  type: DeliveryChannelType;
  label: string;
  buildPayload: (
    digest: DailyDigest,
    channel: StoredDeliveryChannel,
    deliveredAt: string
  ) => DeliveryAdapterPayload;
  send: (
    channel: StoredDeliveryChannel,
    payload: DeliveryAdapterPayload
  ) => Promise<DeliveryAdapterSendResult>;
  validateChannelConfig: (config: DeliveryChannelConfig) => string[];
}
