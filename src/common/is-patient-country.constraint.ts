import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isPatientCountryCode } from './patient-countries';

@ValidatorConstraint({ name: 'isPatientCountry', async: false })
export class IsPatientCountryConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown): boolean {
    return typeof value === 'string' && isPatientCountryCode(value);
  }

  defaultMessage(): string {
    return 'country must be a valid ISO 3166-1 alpha-2 country code';
  }
}
