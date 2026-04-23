(function () {
  const delimiters = [
    { left: "$$", right: "$$", display: true },
    { left: "\\[", right: "\\]", display: true },
    { left: "$", right: "$", display: false },
    { left: "\\(", right: "\\)", display: false },
  ];

  function renderElement(element) {
    if (!element || typeof window.renderMathInElement !== "function") {
      return;
    }
    window.renderMathInElement(element, {
      delimiters,
      throwOnError: false,
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
      ignoredClasses: ["katex", "no-math"],
    });
  }

  window.GogoMath = {
    renderElement,
  };
})();
