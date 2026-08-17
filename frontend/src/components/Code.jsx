export default function Code({ children }) {
  return (
    <span className="font-mono text-xs px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600">
      {children}
    </span>
  );
}
