import { redirect } from "next/navigation";
export default async function StudioPage({ searchParams }: { searchParams: Promise<{ sample?: string }> }) {
  const sp = await searchParams;
  redirect(sp.sample === "1" ? "/dashboard?sample=1" : "/dashboard");
}
