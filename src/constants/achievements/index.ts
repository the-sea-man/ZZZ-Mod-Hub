import type { AchievementDef } from './types';
import { BASICS_AND_COLLECTION_ACHIEVEMENTS } from './basicsAndCollection';
import { MANAGEMENT_AND_TOOLS_ACHIEVEMENTS } from './managementAndTools';
import { CUSTOMIZATION_AND_SECRETS_ACHIEVEMENTS } from './customizationAndSecrets';

export * from './types';
export { BASICS_AND_COLLECTION_ACHIEVEMENTS } from './basicsAndCollection';
export { MANAGEMENT_AND_TOOLS_ACHIEVEMENTS } from './managementAndTools';
export { CUSTOMIZATION_AND_SECRETS_ACHIEVEMENTS } from './customizationAndSecrets';

export const ACHIEVEMENTS: AchievementDef[] = [
  ...BASICS_AND_COLLECTION_ACHIEVEMENTS,
  ...MANAGEMENT_AND_TOOLS_ACHIEVEMENTS,
  ...CUSTOMIZATION_AND_SECRETS_ACHIEVEMENTS,
];
