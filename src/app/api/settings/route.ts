import { handle, json } from "@/server/api";
import { getSettings, publicSettings } from "@/server/settings";

export const GET = handle(async () => {
  const settings = await getSettings();
  return json({ settings: publicSettings(settings) });
});
