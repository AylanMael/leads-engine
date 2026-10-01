import type { DecodedIdToken } from "firebase-admin/auth";

/** Only a verified account explicitly authorized by the server may view prospects. */
export function isAdministrator(token: DecodedIdToken, allowedEmails = process.env.ADMIN_EMAILS ?? "") {
  const emails = allowedEmails.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  return token.email_verified === true && typeof token.email === "string"
    && emails.includes(token.email.toLowerCase());
}
