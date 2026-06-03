"use client";

import type { TechnologyContentMode } from "@/lib/technology-localization";

interface TechnologyLanguageSwitchProps {
  mode: TechnologyContentMode;
  onChange: (mode: TechnologyContentMode) => void;
  chineseEnabled?: boolean;
  label?: string;
  compact?: boolean;
}

export function TechnologyLanguageSwitch({
  mode,
  onChange,
  chineseEnabled = true,
  label = "阅读语言",
  compact = false
}: TechnologyLanguageSwitchProps) {
  return (
    <div
      className={`technology-language-switch${
        compact ? " technology-language-switch--compact" : ""
      }`}
    >
      <span className="technology-language-switch__label">{label}</span>
      <div
        className="technology-language-switch__track"
        role="group"
        aria-label={label}
      >
        <button
          type="button"
          className={`technology-language-switch__button${
            mode === "zh" ? " technology-language-switch__button--active" : ""
          }`}
          onClick={() => onChange("zh")}
          disabled={!chineseEnabled}
        >
          中文
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
          原文
        </button>
      </div>
    </div>
  );
}
