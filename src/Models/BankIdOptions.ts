import { RequirementAlternative } from "./RequirementAlternative";
import { EndUserInfo } from "./EndUserInfo";

export interface BankIdOptions {
  readonly requirementAlternatives?: [RequirementAlternative];
  readonly endUserInfo?: [EndUserInfo];
}
