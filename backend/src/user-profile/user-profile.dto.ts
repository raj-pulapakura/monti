import { ValidationError } from '../common/errors/app-error';

export type UserProfileRole =
  | 'educator'
  | 'tutor'
  | 'student'
  | 'parent'
  | 'learning_on_my_own'
  | 'other';

export type UserProfileContext =
  | 'k12_elementary'
  | 'k12_middle'
  | 'k12_high'
  | 'k12_mixed'
  | 'higher_ed'
  | 'corporate'
  | 'personal';

export type ParsedPatchProfile = {
  role?: UserProfileRole;
  context?: UserProfileContext;
  role_other_text?: string | null;
};

const ROLES: UserProfileRole[] = [
  'educator',
  'tutor',
  'student',
  'parent',
  'learning_on_my_own',
  'other',
];

const CONTEXTS: UserProfileContext[] = [
  'k12_elementary',
  'k12_middle',
  'k12_high',
  'k12_mixed',
  'higher_ed',
  'corporate',
  'personal',
];

export function parsePatchProfileRequest(body: unknown): ParsedPatchProfile {
  const object = asRecord(body, 'Request body must be a JSON object.');

  const hasRole = Object.prototype.hasOwnProperty.call(object, 'role');
  const hasContext = Object.prototype.hasOwnProperty.call(object, 'context');
  const hasRoleOther = Object.prototype.hasOwnProperty.call(object, 'roleOtherText');

  if (!hasRole && !hasContext && !hasRoleOther) {
    throw new ValidationError('Provide at least one of: role, context, roleOtherText.');
  }

  const parsed: ParsedPatchProfile = {};

  if (hasRole) {
    parsed.role = asRole(object.role);
  }

  if (hasContext) {
    parsed.context = asContext(object.context);
  }

  if (hasRoleOther) {
    parsed.role_other_text = asOptionalTrimmedOrNull(object.roleOtherText, 'roleOtherText');
  }

  return parsed;
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(message);
  }

  return value as Record<string, unknown>;
}

function asRole(value: unknown): UserProfileRole {
  if (typeof value !== 'string' || !ROLES.includes(value as UserProfileRole)) {
    throw new ValidationError(
      `role must be one of: ${ROLES.join(', ')}.`,
    );
  }

  return value as UserProfileRole;
}

function asContext(value: unknown): UserProfileContext {
  if (typeof value !== 'string' || !CONTEXTS.includes(value as UserProfileContext)) {
    throw new ValidationError(
      `context must be one of: ${CONTEXTS.join(', ')}.`,
    );
  }

  return value as UserProfileContext;
}

function asOptionalTrimmedOrNull(value: unknown, fieldName: string): string | null {
  if (value === undefined) {
    throw new ValidationError(`${fieldName} was marked present but is undefined.`);
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string or null.`);
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
