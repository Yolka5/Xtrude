import Link from "next/link";

export default function NotFound() {
  return (
    <main className="screen" style={{ display: "grid", placeContent: "center", textAlign: "center", gap: 12 }}>
      <h1 className="t-title2">Nothing here</h1>
      <p className="t-subhead dim" style={{ margin: 0 }}>That session doesn&apos;t exist.</p>
      <Link href="/" className="t-headline">Back to Today</Link>
    </main>
  );
}
