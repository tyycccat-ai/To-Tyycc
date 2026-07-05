"use client";

import { useEffect, useState } from "react";

function themeByCurrentHour() {
  const hour = new Date().getHours();
  return hour >= 7 && hour < 19 ? "day" : "night";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState("day");

  useEffect(() => {
    const initialTheme = document.documentElement.dataset.theme || themeByCurrentHour();
    applyTheme(initialTheme);
    setTheme(initialTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "day" ? "night" : "day";
    applyTheme(nextTheme);
    setTheme(nextTheme);
  }

  const isDay = theme === "day";

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={isDay ? "切换到夜间模式" : "切换到日间模式"}
      title={isDay ? "切换到夜间模式" : "切换到日间模式"}
      onClick={toggleTheme}
    >
      <span aria-hidden="true">{isDay ? "🌙" : "☀️"}</span>
    </button>
  );
}
