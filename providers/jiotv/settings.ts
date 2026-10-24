import { ProviderContext, SettingsField } from "../types";

export const getSettingsSchema = async function (_args: {
  providerContext: ProviderContext;
}): Promise<SettingsField[]> {
  return [
    {
      key: "jiotvBaseUrl",
      type: "text",
      label: "JioTV Go server URL",
      description: "URL of your own running JioTV Go instance. Sign in to JioTV Go there first; do not enter OTPs or passwords here.",
      placeholder: "http://192.168.1.10:5001",
      defaultValue: "http://127.0.0.1:5001",
    },
    {
      key: "jiotvQuality",
      type: "select",
      label: "Stream quality",
      description: "Quality requested from your JioTV Go server.",
      options: [
        { label: "Auto", value: "auto" },
        { label: "High", value: "high" },
        { label: "Medium", value: "medium" },
        { label: "Low", value: "low" },
      ],
      defaultValue: "auto",
    },
  ];
};
