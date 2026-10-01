/** Le build d'audit est isolé pour préserver le serveur de développement actif. */
export default {
  distDir: process.env.NEXT_AUDIT_BUILD === "1" ? ".next-audit" : ".next",
};
