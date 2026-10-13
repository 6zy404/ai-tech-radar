"use client";

import { signalsCopy } from "@/lib/i18n/copy/signals";
import { useLocale } from "@/lib/i18n/use-locale";
import type { TechnologyContentMode } from "@/lib/technology-localization";

interface TechnologyLanguageSwitchProps {
  mode: TechnologyContentMode;
  onChange: (mode: TechnologyContentMode) => void;
  chineseEnabled?: boolean;
}

export function TechnologyLanguageSwitch({
  mode,
  onChange,
  chineseEnabled = true
}: TechnologyLanguageSwitchProps) {
  const locale = useLocale();
  const copy = signalsCopy[locale].languageSwitch;

  return (
    <div className="technology-language-switch">
      {/* No visible label: the two buttons already read 中文 / 原文, so a
          label beside them only restates the control. The group keeps an
          accessible name, which a screen reader still needs. */}
      <div
        className="technology-language-switch__track"
        role="group"
        aria-label={copy.label}
      >
        <button
          type="button"
          className={`technology-language-switch__button${
            mode === "zh" ? " technology-language-switch__button--active" : ""
          }`}
          onClick={() => onChange("zh")}
          disabled={!chineseEnabled}
          lang={locale === "en" ? "zh-CN" : undefined}
        >
          {copy.zh}
        </button>
        <button
          type="button"
          className={`technology-language-switch__button${
            mode === "original"
              ? " technology-language-switch__button--active"
              : ""
          }`}
          onClick={() => onChange("original")}
        >
          {copy.original}
        </button>
      </div>
    </div>
  );
}
