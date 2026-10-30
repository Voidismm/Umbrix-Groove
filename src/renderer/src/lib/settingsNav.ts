export type SettingsFocusTarget = 'add-folder' | 'warnings'

export const OPEN_SETTINGS_EVENT = 'umbrix:open-settings'

export type OpenSettingsDetail = {
  focus?: SettingsFocusTarget | null
}

/** Open Settings from anywhere in the renderer (Home empty state, etc.). */
export function openSettings(detail: OpenSettingsDetail = {}): void {
  window.dispatchEvent(new CustomEvent<OpenSettingsDetail>(OPEN_SETTINGS_EVENT, { detail }))
}
