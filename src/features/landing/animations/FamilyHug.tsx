import { FamilyIllustration } from "./FamilyIllustration";
import { FamilyHugVisibility } from "./FamilyHugVisibility";

/** Server-rendered artwork; only its visibility wrapper needs client JavaScript. */
export function FamilyHug() {
  return (
    <FamilyHugVisibility>
      <FamilyIllustration />
    </FamilyHugVisibility>
  );
}
