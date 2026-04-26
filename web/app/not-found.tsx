import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-prose">
      <p className="text-xs uppercase tracking-widest text-muted mb-4">404</p>
      <h1 className="font-serif text-3xl mb-4">Not found</h1>
      <p className="text-muted">
        The page you&apos;re looking for doesn&apos;t exist.{" "}
        <Link href="/" className="underline underline-offset-4">
          Go home
        </Link>
        .
      </p>
    </div>
  );
}
