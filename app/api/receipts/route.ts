import { createReceipt } from "@/modules/receipts/service";
import { getCurrentUser } from "@/lib/session";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Your session has expired." }, { status: 401 });
  try {
    const receipt = await createReceipt(await request.json(), user);
    return Response.json({ id: receipt.id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ message: "The receipt could not be created. Refresh the services and try again." }, { status: 400 });
  }
}
