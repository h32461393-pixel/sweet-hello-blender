/** Maps setup problems (missing database updates, bad keys) to a clear hint. */
export function dbHint(error: unknown): string | null {
  const e = error as { message?: string; code?: string } | null;
  const msg = e?.message ?? "";
  if (e) console.error("[db]", e.code, msg);
  if (e?.code === "42883" || e?.code === "PGRST202" || /function .* does not exist|Could not find the function/i.test(msg))
    return "Database update missing — run all SQL updates from the guide (0000–0006).";
  if (e?.code === "42703" || e?.code === "PGRST204" || /column .* does not exist|Could not find the '.*' column/i.test(msg))
    return "Database update missing — run all SQL updates from the guide (0000–0006).";
  if (e?.code === "42501" || /permission denied/i.test(msg))
    return "Server key is wrong — use the private service_role key on the server.";
  return null;
}
