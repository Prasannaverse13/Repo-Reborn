import Overview from "@/components/Overview";
import Studio from "@/components/Studio";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ sample?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <Overview />
      <Studio sample={sp.sample === "1"} />
    </>
  );
}
