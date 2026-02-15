---
description: Add a new user-facing setting to the Settings page
---

# Add a New User Setting

Follow these 5 steps whenever adding a new toggle or setting.

## Steps

### 1. Add Field to Schema

In `src/lib/schemas.ts`, add the field to `UserSettingsSchema`:

```ts
export const UserSettingsSchema = z.object({
  // ... existing fields
  myNewSetting: z.boolean().default(false),
});
```

### 2. Add Default Value

In `src/main/settings.ts`, add the default to `DEFAULT_SETTINGS`:

```ts
export const DEFAULT_SETTINGS: UserSettings = {
  // ... existing defaults
  myNewSetting: false,
};
```

### 3. Add Search Index Entry

In `src/lib/settingsSearchIndex.ts`:

- Add a `SETTING_IDS` constant entry
- Add a search index entry so users can find the setting via search

### 4. Create Switch Component

Create `src/components/MyNewSettingSwitch.tsx`. Follow `AutoApproveSwitch.tsx` as a template:

```tsx
import { useSettings } from "@/hooks/useSettings";

export function MyNewSettingSwitch() {
  const { settings, updateSetting } = useSettings();
  // ... render switch using settings.myNewSetting
}
```

### 5. Add to Settings Page

In `src/pages/settings.tsx`, import and add your switch component to the relevant section.
