import { NextResponse, type NextRequest } from "next/server";
import { getSiteConfig } from "./config/site";

export function middleware(request: NextRequest) {
  const vertical = getSiteConfig().vertical;
  const requestHeaders = new Headers(request.headers);
  // Remplace toute valeur fournie par le visiteur. En-tête de requête interne,
  // pas un en-tête de réponse ni une autorisation d'accès aux données.
  requestHeaders.set("x-vertical", vertical);
  const options = { request: { headers: requestHeaders } };

  if (vertical === "renovation" && request.nextUrl.pathname === "/") {
    const destination = request.nextUrl.clone();
    destination.pathname = "/renovation";
    return NextResponse.rewrite(destination, options);
  }
  return NextResponse.next(options);
}

export const config = {
  // Les espaces administrateur et partenaire, sous-routes comprises, sont exclus.
  matcher: ["/((?!admin(?:/|$)|partenaire(?:/|$)|_next(?:/|$)|images(?:/|$)|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$|.*\\.(?:avif|webp|png|jpg|jpeg|gif|svg|ico|css|js|map|woff|woff2|ttf|otf)$).*)"],
};
