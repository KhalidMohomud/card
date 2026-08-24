import { createReceipt } from "@/modules/receipts/service";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cached-data";
import { getFreshCurrentUser } from "@/lib/session";
import { clearSessionCookie } from "@/lib/auth-session";
import { hasJsonContentType, isSameOriginMutation, readLimitedJson, RequestBodyTooLargeError } from "@/lib/request-security";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

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
  let input: unknown;
  try {
    input = await readLimitedJson(request, 8 * 1024);
  } catch (error) {
    return noStore(NextResponse.json(
      { message: error instanceof RequestBodyTooLargeError ? "Request body is too large." : "Invalid JSON request." },
      { status: error instanceof RequestBodyTooLargeError ? 413 : 400 },
    ));
  }
  try {
    const receipt = await createReceipt(input, user);
    revalidateTag(CACHE_TAGS.dashboard, { expire: 0 });
    revalidateTag(CACHE_TAGS.receipts, { expire: 0 });
    revalidateTag(CACHE_TAGS.reports, { expire: 0 });
    revalidateTag(CACHE_TAGS.supervisors, { expire: 0 });
    return noStore(NextResponse.json({ id: receipt.id }, { status: 201 }));
  } catch (error) {
    console.error("Receipt creation failed", { error: error instanceof Error ? error.name : "UnknownError" });
    if (error instanceof ZodError) return noStore(NextResponse.json({ message: "Invalid receipt details." }, { status: 400 }));
    if (error instanceof Error && error.message === "FORBIDDEN") return noStore(NextResponse.json({ message: "You do not have permission to create receipts." }, { status: 403 }));
    if (error instanceof Error && error.message === "SERVICE_OR_PAYMENT_UNAVAILABLE") {
      return noStore(NextResponse.json({ message: "Refresh the services and payment methods, then try again." }, { status: 409 }));
    }
    return noStore(NextResponse.json({ message: "The receipt could not be created. Try again." }, { status: 500 }));
  }
}
