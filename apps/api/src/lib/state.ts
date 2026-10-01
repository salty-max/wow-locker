import { eq } from "drizzle-orm";
import { db } from "@/db";
import { state } from "@/db/schema";

export async function getState(key: string): Promise<string | null> {
  const [row] = await db.select().from(state).where(eq(state.key, key));
  return row?.value ?? null;
}

export async function setState(key: string, value: string): Promise<void> {
  await db
    .insert(state)
    .values({ key, value })
    .onConflictDoUpdate({ target: state.key, set: { value, updatedAt: new Date() } });
}
