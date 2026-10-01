import "server-only";
import Stripe from "stripe";

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe non configuré");
  return new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 15000, maxNetworkRetries: 1 });
}

export function getCheckoutOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured && process.env.NODE_ENV === "production") throw new Error("URL du site manquante");
  const url = new URL(configured || "http://localhost:3000");
  if (url.username || url.password || (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && url.hostname === "localhost"))) {
    throw new Error("URL du site invalide");
  }
  return url.origin;
}
