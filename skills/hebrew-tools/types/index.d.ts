/** A Hebrew translation of one English text block, or null before there is one. */
export type Translation = string | null

/** The side Hebrew lines align to: right (rtl) or left (ltr). */
export type Direction = 'rtl' | 'ltr'

declare module 'claude-code' {
  interface PluginState {
    'hebrew-tools': {
      /** The side Hebrew lines align to, on screen only. Kept across sessions in $.store. */
      direction: Direction
      /** Draw the Hebrew translations in place of the English originals. */
      showHebrew: boolean
      /** A translation is running. */
      isBusy: boolean
      /** Ids (keyOf) of the English text blocks the translate button works on. */
      englishIds: string[]
      /** How many blocks this session has translated, so the switch-back button has a reason to show. */
      translatedCount: number
      /** One Hebrew translation per English text block, by its id. */
      translation: StateFamily<Translation>
    }
  }
}
