// Applied as early as possible (before the stylesheet paints) so there's no
// flash of the wrong theme. Falls back to the OS preference via the
// prefers-color-scheme media query in style.css when nothing is stored.
(function () {
  try {
    var t = localStorage.getItem("gpt-theme");
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  } catch (e) {}
})();
