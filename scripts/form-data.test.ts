import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePhone, formatPhone, isValidPhone, PhoneSchema } from "../src/lib/phone";
import { parseAddresses, departmentFromPostalCode } from "../src/lib/address";
import { LeadDemenagementSchema } from "../src/types/lead";
import { LeadRenovationSchema } from "../src/types/lead-renovation";

test("Téléphones : masque, indicatifs, fixes et rejet des suites artificielles", () => {
  assert.equal(formatPhone("0684275931"), "06 84 27 59 31");
  assert.equal(normalizePhone("+33 6 84 27 59 31"), "0684275931");
  assert.equal(normalizePhone("0033 6 84 27 59 31"), "0684275931");
  for (const prefix of ["01", "02", "03", "04", "05", "06", "07", "09"]) assert.equal(isValidPhone(`${prefix}84275931`), true);
  for (const value of ["0600000000", "0611111111", "0612345678", "0712121212", "0688888888", "0987654321", "0884275931", "06842759310", "phone0684275931", "+44684275931", "0684"]) assert.equal(isValidPhone(value), false, value);
  assert.equal(PhoneSchema.parse("+33 1 84 27 59 31"), "0184275931");
});
test("BAN : suggestions typées, départements métropolitains, Corse et outre-mer", () => {
  assert.equal(departmentFromPostalCode("78000"), "78");
  assert.equal(departmentFromPostalCode("97100"), "971");
  assert.equal(departmentFromPostalCode("20000"), "");
  const addresses = parseAddresses({ type: "FeatureCollection", features: [{ type: "Feature", properties: { city: "Ajaccio", postcode: "20000", citycode: "2A004", label: "12 rue Test Ajaccio", type: "housenumber", name: "12 rue Test" } }] });
  assert.deepEqual(addresses[0], { city: "Ajaccio", postalCode: "20000", department: "2A", label: "12 rue Test Ajaccio", streetAddress: "12 rue Test" });
  assert.deepEqual(parseAddresses({ type: "FeatureCollection", features: [{ type: "Feature", properties: null }, { properties: { city: "Paris", postcode: "invalid" } }] }), []);
  assert.deepEqual(parseAddresses(null), []);
});
test("Contrats : conservation de la géographie BAN et compatibilité des anciens champs", () => {
  const geo = { departureCity: "Versailles", departurePostalCode: "78000", arrivalCity: "Paris", arrivalPostalCode: "75015" };
  const customer = { firstName: "Test", lastName: "Test", phone: "06 84 27 59 31", email: "test@example.com" };
  const moving = { geo, customer, projectDetails: { housingType: "maison", surface: 80, departureFloor: 0, arrivalFloor: 1, departureElevator: false, arrivalElevator: false, targetDate: "2026-12-12" } };
  assert.equal(LeadDemenagementSchema.parse(moving).customer.phone, "0684275931");
  const enriched = LeadDemenagementSchema.parse({ ...moving, geo: { ...geo, departureDepartment: "78", departureStreetAddress: "12 rue de Satory" } });
  assert.equal(enriched.geo.departureStreetAddress, "12 rue de Satory");
  const renovation = { vertical: "renovation", geo: enriched.geo, projectType: "cuisine", property: { occupancyStatus: "proprietaire_occupant", surface: 12, buildingType: "maison" }, budgetBracket: "< 10k", customer: { ...customer, salutation: "madame" } };
  assert.equal(LeadRenovationSchema.parse(renovation).geo?.departureDepartment, "78");
  assert.equal(LeadRenovationSchema.safeParse({ ...renovation, customer: { ...renovation.customer, phone: "0612345678" } }).success, false);
});


test("BAN : coordonnées GeoJSON validées et contrat Firestore inchangé", () => {
  const feature = { type: "Feature", properties: { city: "Paris", postcode: "75015", label: "Paris 75015", type: "municipality" }, geometry: { type: "Point", coordinates: [2.3, 48.85] } };
  const selected = parseAddresses({ type: "FeatureCollection", features: [null, feature] });
  assert.deepEqual(selected[0].coordinates, [2.3, 48.85]);
  assert.equal(selected[0].department, "75");
  assert.equal(parseAddresses({ type: "FeatureCollection", features: [{ ...feature, geometry: { type: "Point", coordinates: [200, 48] } }] })[0].coordinates, undefined);
  assert.deepEqual(parseAddresses({ features: [feature] }), []);
  const geo = LeadDemenagementSchema.shape.geo.parse({ departureCity: "Paris", departurePostalCode: "75015", arrivalCity: "Versailles", arrivalPostalCode: "78000", departureCoordinates: selected[0].coordinates });
  assert.equal("departureCoordinates" in geo, false);
  assert.equal(departmentFromPostalCode("92000"), "92");
});
