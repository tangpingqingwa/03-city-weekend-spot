import { getClick } from "../../../api/click/[id]/route";

export const dynamic = "force-dynamic";

type ClickContext = {
  params: Promise<{ id: string }>;
};

/** SPEC alias: GET /:city/click/:id. Listing IDs are globally durable. */
export async function GET(request: Request, context: ClickContext): Promise<Response> {
  return getClick(request, context);
}
