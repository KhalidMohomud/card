import { createReceipt } from "@/modules/receipts/service";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cached-data";
import { getFreshCurrentUser } from "@/lib/session";

export async function POST(request: Request) {
  // Mutations bypass the short navigation cookie cache so disabling an account
  // takes effect immediately without slowing every read-only page transition.
  const user = await getFreshCurrentUser();
  if (!user) return Response.json({ message: "Your session has expired." }, { status: 401 });
  try {
    const receipt = await createReceipt(await request.json(), user);
    revalidateTag(CACHE_TAGS.dashboard, { expire: 0 });
    revalidateTag(CACHE_TAGS.receipts, { expire: 0 });
    revalidateTag(CACHE_TAGS.reports, { expire: 0 });
    revalidateTag(CACHE_TAGS.supervisors, { expire: 0 });
    return Response.json({ id: receipt.id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ message: "The receipt could not be created. Refresh the services and try again." }, { status: 400 });
  }
}
