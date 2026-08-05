"use client";

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
  return (
    <div className="technology-language-switch">
      {/* No visible label: the two buttons already read 中文 / 原文, so a
          label beside them only restates the control. The group keeps an
          accessible name, which a screen reader still needs. */}
      <div
        className="technology-language-switch__track"
        role="group"
        aria-label="阅读语言"
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
