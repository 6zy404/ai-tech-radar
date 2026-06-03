import type {
  DailyDigest,
  DeliveryChannel,
  DeliveryChannelType,
  DeliveryFormat
} from "@/types/content";

export interface DeliveryChannelConfig {
  type: DeliveryChannelType;
  endpointUrl: string;
  format: DeliveryFormat;
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

export interface DeliveryAdapter {
  type: DeliveryChannelType;
  label: string;
  buildPayload: (
    digest: DailyDigest,
    channel: DeliveryChannel,
    deliveredAt: string
  ) => DeliveryAdapterPayload;
  send: (
    channel: DeliveryChannel,
    payload: DeliveryAdapterPayload
  ) => Promise<DeliveryAdapterSendResult>;
  validateChannelConfig: (config: DeliveryChannelConfig) => string[];
}
