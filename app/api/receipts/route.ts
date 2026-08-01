import { createReceipt } from "@/modules/receipts/service";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cached-data";
import { getFreshCurrentUser } from "@/lib/session";
import { clearSessionCookie } from "@/lib/auth-session";
import { hasJsonContentType, isSameOriginMutation } from "@/lib/request-security";
import { NextResponse } from "next/server";

function noStore(response: NextResponse) { response.headers.set("Cache-Control", "no-store"); return response; }

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return noStore(NextResponse.json({ message: "Request rejected." }, { status: 403 }));
  if (!hasJsonContentType(request)) return noStore(NextResponse.json({ message: "Invalid request." }, { status: 415 }));
  // Mutations bypass the short navigation cookie cache so disabling an account
  // takes effect immediately without slowing every read-only page transition.
  const user = await getFreshCurrentUser();
  if (!user) {
    const response = NextResponse.json({ message: "Your session has expired." }, { status: 401 });
    clearSessionCookie(response);
    return noStore(response);
  }
  try {
    const receipt = await createReceipt(await request.json(), user);
    revalidateTag(CACHE_TAGS.dashboard, { expire: 0 });
    revalidateTag(CACHE_TAGS.receipts, { expire: 0 });
    revalidateTag(CACHE_TAGS.reports, { expire: 0 });
    revalidateTag(CACHE_TAGS.supervisors, { expire: 0 });
    return noStore(NextResponse.json({ id: receipt.id }, { status: 201 }));
  } catch (error) {
    console.error("Receipt creation failed", { error: error instanceof Error ? error.name : "UnknownError" });
    return noStore(NextResponse.json({ message: "The receipt could not be created. Refresh the services and try again." }, { status: 400 }));
  }
}
