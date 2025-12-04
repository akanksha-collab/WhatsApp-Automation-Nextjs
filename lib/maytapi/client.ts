const MAYTAPI_BASE_URL = 'https://api.maytapi.com/api';

interface MaytapiConfig {
  productId: string;
  phoneId: string;
  apiToken: string;
}

export interface MaytapiResponse {
  success: boolean;
  message?: string;
  data?: {
    msgId: string;
    [key: string]: unknown;
  };
}

export class MaytapiClient {
  private productId: string;
  private phoneId: string;
  private apiToken: string;

  constructor(config: MaytapiConfig) {
    this.productId = config.productId;
    this.phoneId = config.phoneId;
    this.apiToken = config.apiToken;
  }

  private get baseUrl(): string {
    return `${MAYTAPI_BASE_URL}/${this.productId}/${this.phoneId}`;
  }

  private get headers(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'x-maytapi-key': this.apiToken,
    };
  }

  // Check if target is a WhatsApp Channel/Newsletter
  private isChannel(targetId: string): boolean {
    return targetId.includes('@newsletter');
  }

  async sendTextMessage(targetId: string, message: string): Promise<MaytapiResponse> {
    // Use 'channel_text' for WhatsApp Channels, 'text' for regular chats/groups
    const messageType = this.isChannel(targetId) ? 'channel_text' : 'text';
    
    const response = await fetch(`${this.baseUrl}/sendMessage`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        to_number: targetId,
        type: messageType,
        message,
      }),
    });

    return response.json();
  }

  async sendMediaMessage(
    targetId: string,
    mediaUrl: string,
    caption?: string
  ): Promise<MaytapiResponse> {
    // Use 'channel_media' for WhatsApp Channels, 'media' for regular chats/groups
    const messageType = this.isChannel(targetId) ? 'channel_media' : 'media';
    
    const response = await fetch(`${this.baseUrl}/sendMessage`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        to_number: targetId,
        type: messageType,
        message: mediaUrl,
        text: caption,
      }),
    });

    return response.json();
  }

  async sendLinkMessage(
    targetId: string,
    message: string,
    linkUrl: string
  ): Promise<MaytapiResponse> {
    // Links are sent as text messages with the URL included
    const fullMessage = `${message}\n\n${linkUrl}`;
    return this.sendTextMessage(targetId, fullMessage);
  }
}

// Singleton instance
let maytapiClient: MaytapiClient | null = null;

export function getMaytapiClient(): MaytapiClient {
  if (!maytapiClient) {
    maytapiClient = new MaytapiClient({
      productId: process.env.MAYTAPI_PRODUCT_ID!,
      phoneId: process.env.MAYTAPI_PHONE_ID!,
      apiToken: process.env.MAYTAPI_API_TOKEN!,
    });
  }
  return maytapiClient;
}
