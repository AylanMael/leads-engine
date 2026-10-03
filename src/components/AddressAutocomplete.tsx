"use client";
import { useEffect, useId, useRef, useState } from "react";
import { parseAddresses, type AddressSelection } from "../lib/address";

type Props = { label: string; value: AddressSelection | null; onChange: (value: AddressSelection | null) => void; error?: string; inputId?: string };
export default function AddressAutocomplete({ label, value, onChange, error, inputId }: Props) {
  const uid = useId();
  const id = inputId ?? uid;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddressSelection[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, id]);
  useEffect(() => {
    const abort = new AbortController();
    setResults([]); setActive(-1); setStatus("");
    if (value || query.trim().length < 3) return;
    const timer = setTimeout(async () => {
      setStatus("Recherche en cours…");
      try {
        const response = await fetch(`https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(query.trim())}&limit=5`, { signal: abort.signal });
        if (!response.ok) throw new Error("Recherche indisponible");
        const addresses = parseAddresses(await response.json());
        if (abort.signal.aborted) return;
        setResults(addresses);
        setStatus(addresses.length ? `${addresses.length} suggestions disponibles.` : "Aucun résultat. Précisez la commune ou le code postal.");
      } catch {
        if (!abort.signal.aborted) setStatus("Recherche indisponible. Modifiez votre saisie pour réessayer.");
      }
    }, 300);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [query, value]);
  function select(address: AddressSelection) { onChange(address); setOpen(false); setResults([]); setStatus(""); }
  return <div className="relative min-w-0 sm:col-span-2" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor={id} className="font-medium">{label}</label>
    <input ref={input} id={id} type="text" role="combobox" autoComplete="off" maxLength={200}
      value={value ? `${value.label} (${value.postalCode})` : query} readOnly={Boolean(value)}
      aria-autocomplete="list" aria-expanded={open && results.length > 0} aria-controls={`${id}-list`}
      aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
      aria-invalid={Boolean(error)} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
      placeholder="Ville, code postal ou adresse" onFocus={() => setOpen(true)}
      onChange={(event) => { setQuery(event.target.value); setResults([]); setActive(-1); setOpen(true); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { setOpen(false); return; }
        if ((event.key === "ArrowDown" || event.key === "ArrowUp") && results.length) {
          event.preventDefault(); setOpen(true); setActive((previous) => previous < 0 ? (event.key === "ArrowDown" ? 0 : results.length - 1) : (previous + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
        }
        if (event.key === "Enter" && !value) { event.preventDefault(); if (open && active >= 0) select(results[active]); }
      }} className="mt-2 min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-base read-only:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-700 aria-[invalid=true]:border-red-700" />
    <p id={`${id}-hint`} className="mt-2 text-xs text-slate-600">{value ? "Localisation sélectionnée. L’adresse de rue reste facultative." : "Saisissez au moins 3 caractères, puis sélectionnez une suggestion officielle."}</p>
    {value && <button type="button" onClick={() => { setQuery(""); onChange(null); input.current?.focus(); }} className="mt-1 min-h-11 text-sm font-semibold text-emerald-800 underline focus-visible:outline-2">Modifier {label.toLowerCase()}</button>}
    <ul id={`${id}-list`} role="listbox" aria-label={label} hidden={!open || !results.length} className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
      {results.map((address, index) => <li key={`${address.label}-${address.postalCode}-${index}`} id={`${id}-option-${index}`} role="option" aria-selected={index === active}
        onMouseDown={(event) => event.preventDefault()} onClick={() => select(address)}
        className={`cursor-pointer break-words px-4 py-3 ${index === active ? "bg-emerald-100" : "hover:bg-slate-50"}`}>
        <span className="block font-medium">{address.label}</span><span className="text-sm text-slate-600">{address.postalCode} · {address.city}</span>
      </li>)}
    </ul>
    <p role="status" className="mt-1 text-sm text-slate-600">{status}</p>
    {error && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-red-700">Sélectionnez une commune dans les suggestions.</p>}
  </div>;
}
