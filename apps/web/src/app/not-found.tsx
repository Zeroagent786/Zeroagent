import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-sm text-teal">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Page not found</h1>
      <Link href="/" className="mt-6 inline-flex h-10 items-center rounded-lg bg-ink px-5 text-sm font-medium text-white hover:bg-[#27272A]">Back to start</Link>
    </div>
  );
}
