import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f4f6f9] flex flex-col items-center justify-center font-sans p-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-center text-xl mb-4">
        🧊
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">404 — Page Not Found</h1>
      <p className="text-slate-600 text-sm max-w-sm mb-6">
        The requested operations endpoint or resource could not be found.
      </p>
      <Link
        href="/"
        className="px-4 py-2 bg-slate-900 text-white rounded-md text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
      >
        Return to TerraLens Operations →
      </Link>
    </div>
  );
}
