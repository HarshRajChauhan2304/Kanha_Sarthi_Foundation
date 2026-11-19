import { redirect } from "next/navigation";

export default function SignUpPage({
  searchParams,
}: {
  searchParams?: { redirect?: string };
}) {
  const redirectQuery = searchParams?.redirect
    ? `&redirect=${encodeURIComponent(searchParams.redirect)}`
    : "";
  redirect(`/signin?mode=signup${redirectQuery}`);
}
