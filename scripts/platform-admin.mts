// Makes an existing Visito account a platform admin (or removes it).
//   npm.cmd run platform-admin -- you@example.com
//   npm.cmd run platform-admin -- you@example.com --remove
// The person must have signed up in the app first.
import { createClient } from "@supabase/supabase-js";

const [email, flag] = process.argv.slice(2);
if (!email) {
  console.error("Usage: npm.cmd run platform-admin -- <email> [--remove]");
  process.exit(1);
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let user: { id: string; email?: string } | undefined;
for (let page = 1; !user; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw new Error(error.message);
  user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (data.users.length < 200) break;
}
if (!user) {
  console.error(`No account with ${email}. Sign up in the app first.`);
  process.exit(1);
}
const { error } =
  flag === "--remove"
    ? await db.from("platform_admins").delete().eq("user_id", user.id)
    : await db.from("platform_admins").upsert({ user_id: user.id });
if (error) throw new Error(error.message);
console.log(
  flag === "--remove"
    ? `✓ ${email} is no longer a platform admin`
    : `✓ ${email} is now a platform admin (open /admin)`,
);
