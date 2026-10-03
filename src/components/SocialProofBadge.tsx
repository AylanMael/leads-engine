/** Aucun compteur ni activité récente ne sont inventés en l'absence de données vérifiées. */
export default function SocialProofBadge({ city }: { city?: string }) {
  return <p className="mt-5 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
    <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500 motion-reduce:animate-none" />
    <span>{city ? `Votre projet à ${city}` : "Votre projet local"} : votre demande est transmise à 2 professionnels maximum.</span>
  </p>;
}
