"use client";
import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import AddressAutocomplete from "./AddressAutocomplete";
import { departmentFromPostalCode, type AddressSelection } from "../lib/address";
type LocationForm = { geo: { departureCity: string; departurePostalCode: string; departureDepartment?: string; departureStreetAddress?: string; arrivalCity?: string; arrivalPostalCode?: string; arrivalDepartment?: string; arrivalStreetAddress?: string } };
export default function LocationFields({ kind, label }: { kind: "departure" | "arrival"; label: string }) {
  const { register, control, setValue, getFieldState, formState } = useFormContext<LocationForm>();
  const cityField = `geo.${kind}City` as const;
  const postalField = `geo.${kind}PostalCode` as const;
  const departmentField = `geo.${kind}Department` as const;
  const streetField = `geo.${kind}StreetAddress` as const;
  const [city, postalCode, department, streetAddress] = useWatch({ control, name: [cityField, postalField, departmentField, streetField] });
  const value = useMemo<AddressSelection | null>(() => city && postalCode ? { city, postalCode, department: department || departmentFromPostalCode(postalCode), streetAddress: streetAddress || "", label: streetAddress ? `${streetAddress}, ${city}` : city } : null, [city, postalCode, department, streetAddress]);
  const error = getFieldState(cityField, formState).error || getFieldState(postalField, formState).error;
  return <>
    <input type="hidden" {...register(cityField)} /><input type="hidden" {...register(postalField)} />
    <input type="hidden" {...register(departmentField)} /><input type="hidden" {...register(streetField)} />
    <AddressAutocomplete label={label} inputId={`location-${kind}`} value={value} error={error?.message} onChange={(address) => {
      const options = { shouldDirty: true, shouldValidate: true, shouldTouch: true };
      setValue(cityField, address?.city ?? "", options); setValue(postalField, address?.postalCode ?? "", options);
      setValue(departmentField, address?.department ?? "", options); setValue(streetField, address?.streetAddress ?? "", options);
    }} />
  </>;
}
