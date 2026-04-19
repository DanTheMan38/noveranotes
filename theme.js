(() => {
  const storageKey = "novera-theme";
  const root = document.documentElement;
  const header = document.querySelector(".site-header");
  const toggles = Array.from(document.querySelectorAll("[data-theme-toggle]"));
  const menuToggle = document.querySelector("[data-menu-toggle]");
  const menu = menuToggle ? document.getElementById(menuToggle.getAttribute("aria-controls")) : null;
  const desktopMenu = window.matchMedia("(min-width: 761px)");
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

  function getStoredTheme() {
    try {
      return localStorage.getItem(storageKey);
    } catch (error) {
      return null;
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(storageKey, theme);
    } catch (error) {
      return;
    }
  }

  function setTheme(theme, shouldSave) {
    const isDark = theme === "dark";
    root.dataset.theme = isDark ? "dark" : "light";

    if (shouldSave) {
      saveTheme(isDark ? "dark" : "light");
    }

    if (!toggles.length) {
      return;
    }

    toggles.forEach((toggle) => {
      const label = toggle.querySelector(".theme-toggle-text");

      toggle.setAttribute("aria-pressed", String(isDark));
      toggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");

      if (label) {
        label.textContent = isDark ? "Light" : "Dark";
      }
    });
  }

  setTheme(root.dataset.theme === "dark" ? "dark" : "light", false);

  toggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      setTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
    });
  });

  function setMenu(isOpen) {
    if (!header || !menuToggle || !menu) {
      return;
    }

    if (isOpen) {
      header.dataset.menuOpen = "true";
    } else {
      delete header.dataset.menuOpen;
    }

    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
  }

  if (menuToggle && menu) {
    menuToggle.addEventListener("click", () => {
      setMenu(menuToggle.getAttribute("aria-expanded") !== "true");
    });

    menu.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        setMenu(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setMenu(false);
      }
    });

    if (desktopMenu.addEventListener) {
      desktopMenu.addEventListener("change", (event) => {
        if (event.matches) {
          setMenu(false);
        }
      });
    }
  }

  if (systemTheme.addEventListener) {
    systemTheme.addEventListener("change", (event) => {
      if (!getStoredTheme()) {
        setTheme(event.matches ? "dark" : "light", false);
      }
    });
  }
})();
