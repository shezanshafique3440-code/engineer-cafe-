-- Retain existing profile assignments; custom restrictions are opt-in.
ALTER TABLE "StaffAccess"
  ADD COLUMN "customPermissions" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
