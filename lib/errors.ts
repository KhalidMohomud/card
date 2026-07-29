import { ZodError } from "zod";

export type ActionState = { ok: boolean; message: string; fieldErrors?: Record<string, string[]> };

export function actionError(error: unknown): ActionState {
  if (error instanceof ZodError) {
    const flattened = error.flatten().fieldErrors;
    return { ok: false, message: "Please correct the highlighted fields.", fieldErrors: flattened };
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return { ok: false, message: "You do not have permission to perform this action." };
  }
  console.error(error);
  return { ok: false, message: "The request could not be completed. Please try again." };
}

export const initialActionState: ActionState = { ok: false, message: "" };
