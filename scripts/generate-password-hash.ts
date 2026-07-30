import { z } from "zod";
import { hashPassword } from "../lib/password";

const passwordSchema = z.string()
  .min(12, "Use at least 12 characters")
  .max(128, "Use at most 128 characters")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/\d/, "Add a number")
  .regex(/[^a-zA-Z0-9]/, "Add a symbol");

async function readHidden(label: string) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("Run this command in an interactive terminal.");
  }

  process.stderr.write(label);
  process.stdin.setEncoding("utf8");
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise<string>((resolve, reject) => {
    let value = "";
    const finish = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stderr.write("\n");
    };
    const onData = (chunk: string) => {
      if (chunk === "\u0003") {
        finish();
        reject(new Error("Cancelled."));
        return;
      }
      if (chunk === "\r" || chunk === "\n") {
        finish();
        resolve(value);
        return;
      }
      if (chunk === "\u007f" || chunk === "\b") {
        if (value.length) {
          value = value.slice(0, -1);
          process.stderr.write("\b \b");
        }
        return;
      }
      if (!/[\u0000-\u001f\u007f]/.test(chunk)) {
        value += chunk;
        process.stderr.write("*".repeat([...chunk].length));
      }
    };
    process.stdin.on("data", onData);
  });
}

async function main() {
  const password = await readHidden("New administrator password: ");
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Password is not strong enough.");
  const confirmation = await readHidden("Confirm administrator password: ");
  if (confirmation !== parsed.data) throw new Error("Passwords do not match.");
  const hash = await hashPassword(parsed.data);
  process.stdout.write(`ADMIN_PASSWORD_HASH="${hash}"\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Could not generate the password hash.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
