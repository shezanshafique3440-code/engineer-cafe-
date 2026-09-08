"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiPatch, ApiError } from "@/lib/api-client";
import { useSession } from "@/context/session-context";
import { Button, Input } from "@/components/ui";
import type { SessionUser } from "@/lib/types";

export function ProfileSettings({ initialPhone }: { initialPhone: string }) {
  const { user, setUser } = useSession();
  const [profile, setProfile] = useState({ name: user?.name ?? "", phone: initialPhone });
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [profileErrors, setProfileErrors] = useState<Record<string, string[]>>({});
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string[]>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileErrors({});
    setSavingProfile(true);
    try {
      const data = await apiPatch<{ user: SessionUser }>("/api/auth/me", profile);
      setUser(data.user);
      toast.success("Profile updated");
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fields) setProfileErrors(error.fields);
        toast.error(error.message);
      } else {
        toast.error("Couldn't update your profile.");
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordErrors({});
    setSavingPassword(true);
    try {
      await apiPatch("/api/auth/me", passwords);
      toast.success("Password changed");
      setPasswords({ currentPassword: "", newPassword: "" });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fields) setPasswordErrors(error.fields);
        toast.error(error.message);
      } else {
        toast.error("Couldn't change your password.");
      }
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold md:text-3xl">Account Settings</h1>
      <p className="mt-1.5 text-sm text-charcoal-500">Update your profile and password.</p>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <form onSubmit={saveProfile} className="surface space-y-4 p-5" noValidate>
          <h2 className="text-lg font-bold">Profile</h2>
          <Input
            label="Full name"
            name="name"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            error={profileErrors.name?.[0]}
            autoComplete="name"
            required
          />
          <Input
            label="Phone"
            name="phone"
            type="tel"
            inputMode="tel"
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            error={profileErrors.phone?.[0]}
            placeholder="03001234567"
          />
          <Input label="Email" value={user?.email ?? ""} disabled hint="Contact us to change your email." />
          <Button type="submit" loading={savingProfile}>Save changes</Button>
        </form>

        <form onSubmit={savePassword} className="surface space-y-4 p-5" noValidate>
          <h2 className="text-lg font-bold">Change password</h2>
          <Input
            label="Current password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            value={passwords.currentPassword}
            onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
            error={passwordErrors.currentPassword?.[0]}
            required
          />
          <Input
            label="New password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            value={passwords.newPassword}
            onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
            error={passwordErrors.newPassword?.[0]}
            hint="At least 8 characters."
            required
          />
          <Button type="submit" loading={savingPassword}>Change password</Button>
        </form>
      </div>
    </div>
  );
}
