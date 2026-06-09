export interface PayheroPaymentRequest {
  amount: number;
  phoneNumber: string;
  externalReference: string;
  customerName?: string;
  callbackUrl?: string;
}

export interface PayheroPaymentResponse {
  success: boolean;
  status: string;
  reference: string;
  CheckoutRequestID: string;
  [key: string]: any;
}

const PAYHERO_API_URL = "https://backend.payhero.co.ke/api/v2/payments";
const PAYHERO_API_USERNAME = import.meta.env.VITE_PAYHERO_API_USERNAME ?? "AlRRMwRwCxYmeRsqF7Wt";
const PAYHERO_API_PASSWORD = import.meta.env.VITE_PAYHERO_API_PASSWORD ?? "WERqhlyFj1KKtHELGP9V9St28McIjF3yWpHVAf4P";
const PAYHERO_ACCOUNT_ID = Number(import.meta.env.VITE_PAYHERO_ACCOUNT_ID ?? "693");
const CHANNEL_ID = Number(import.meta.env.VITE_PAYHERO_CHANNEL_ID ?? "8195");

const generateAuthToken = () => {
  const token = `${PAYHERO_API_USERNAME}:${PAYHERO_API_PASSWORD}`;
  return `Basic ${btoa(token)}`;
};

export async function initiateMpesaStkPush(request: PayheroPaymentRequest): Promise<PayheroPaymentResponse> {
  const body: Record<string, unknown> = {
    amount: request.amount,
    phone_number: request.phoneNumber,
    channel_id: CHANNEL_ID,
    provider: "m-pesa",
    external_reference: request.externalReference,
    customer_name: request.customerName,
    callback_url: request.callbackUrl,
  };

  if (PAYHERO_ACCOUNT_ID) {
    body.account_id = PAYHERO_ACCOUNT_ID;
  }

  const response = await fetch(PAYHERO_API_URL, {
    method: "POST",
    headers: {
      Authorization: generateAuthToken(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`PayHero request failed: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as PayheroPaymentResponse;
  if (!data?.success) {
    throw new Error(`PayHero payment failed: ${JSON.stringify(data)}`);
  }

  return data;
}

export interface PayheroPaymentStatusRequest {
  checkoutRequestId?: string;
  externalReference?: string;
}

export interface PayheroPaymentStatusResponse {
  success?: boolean;
  status?: string;
  response?: Record<string, any>;
  [key: string]: any;
}

const buildStatusUrls = ({ checkoutRequestId, externalReference }: PayheroPaymentStatusRequest) => {
  const urls = new Set<string>();
  if (checkoutRequestId) {
    urls.add(`${PAYHERO_API_URL}/${encodeURIComponent(checkoutRequestId)}`);
    urls.add(`${PAYHERO_API_URL}?checkout_request_id=${encodeURIComponent(checkoutRequestId)}`);
  }
  if (externalReference) {
    urls.add(`${PAYHERO_API_URL}?external_reference=${encodeURIComponent(externalReference)}`);
    urls.add(`${PAYHERO_API_URL}?external_reference=${encodeURIComponent(externalReference)}&limit=1`);
  }
  return Array.from(urls);
};

export async function getPayheroPaymentStatus(request: PayheroPaymentStatusRequest): Promise<PayheroPaymentStatusResponse> {
  const urls = buildStatusUrls(request);
  if (urls.length === 0) {
    throw new Error("Either checkoutRequestId or externalReference is required to query PayHero status.");
  }

  let lastError: Error | null = null;
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: generateAuthToken(),
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const text = await response.text();
        lastError = new Error(`PayHero status request failed: ${response.status} ${text}`);
        continue;
      }

      const data = (await response.json()) as PayheroPaymentStatusResponse;
      if (data) {
        return data;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      continue;
    }
  }

  throw lastError ?? new Error("Unable to retrieve PayHero payment status.");
}

export const PLANS: Record<string, { name: string; amount: number }> = {
  starter: { name: "Starter", amount: 2500 },
  professional: { name: "Professional", amount: 7500 },
};
