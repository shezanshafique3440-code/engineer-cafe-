import Link from "next/link";

/**
 * 404 for anything inside the storefront — a menu category or item that no
 * longer exists. Lives in the (site) group so it renders inside the normal
 * navbar/footer shell and returns a real 404 status.
 */
export default function SiteNotFound() {
  return (
    <div className="container flex flex-col items-center justify-center py-20 text-center md:py-28">
      <p className="font-mono text-sm font-bold uppercase tracking-[0.2em] text-chai-600">
        Error 404
      </p>
      <h1 className="mt-4 text-4xl font-extrabold md:text-5xl">Chai Not Found.</h1>
      <p className="mx-auto mt-4 max-w-md text-sm text-charcoal-600 md:text-base">
        Ye item ya page menu par nahi hai — shayad hata diya gaya ho. Neeche se
        poora menu dekh lein.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/menu" className="btn-primary px-6 py-3">Browse the menu</Link>
        <Link href="/" className="btn-secondary px-6 py-3">Back home</Link>
      </div>
    </div>
  );
}
