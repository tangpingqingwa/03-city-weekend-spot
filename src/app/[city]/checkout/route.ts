import { handleCheckout } from "../../api/checkout/route";

export const dynamic = "force-dynamic";

type CheckoutContext = {
  params: Promise<{ city: string }>;
};

/** SPEC alias: POST /:city/checkout. The path city is authoritative. */
export async function POST(request: Request, context: CheckoutContext): Promise<Response> {
  const { city } = await context.params;
  return handleCheckout(request, city);
}
