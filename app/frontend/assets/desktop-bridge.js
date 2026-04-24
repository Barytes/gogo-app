(function installDesktopBridge() {
  function resolveInvoke() {
    if (typeof window === "undefined") {
      return null;
    }

    if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === "function") {
      return window.__TAURI__.core.invoke.bind(window.__TAURI__.core);
    }

    if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === "function") {
      return window.__TAURI_INTERNALS__.invoke.bind(window.__TAURI_INTERNALS__);
    }

    return null;
  }

  const desktopApi = {
    isDesktopRuntime() {
      return typeof resolveInvoke() === "function";
    },
    async getRuntimeInfo() {
      const invoke = resolveInvoke();
      if (typeof invoke !== "function") {
        return {
          desktop_runtime: false,
          backend_url: "",
          platform: "web",
        };
      }
      return invoke("desktop_runtime_info");
    },
    async selectKnowledgeBaseDirectory() {
      const invoke = resolveInvoke();
      if (typeof invoke !== "function") {
        return {
          canceled: true,
          path: "",
        };
      }
      const path = await invoke("select_knowledge_base_directory");
      return {
        canceled: !path,
        path: path || "",
      };
    },
    async selectMarkdownSavePath(rootPath, defaultFileName) {
      const invoke = resolveInvoke();
      if (typeof invoke !== "function") {
        return {
          canceled: true,
          path: "",
        };
      }
      const path = await invoke("select_markdown_save_path", {
        rootPath: String(rootPath || ""),
        defaultFileName: String(defaultFileName || ""),
      });
      return {
        canceled: !path,
        path: path || "",
      };
    },
    async openPath(targetPath) {
      const invoke = resolveInvoke();
      if (typeof invoke !== "function") {
        throw new Error("当前不是桌面版运行时。");
      }
      return invoke("open_path", { path: String(targetPath || "") });
    },
  };

  if (typeof window !== "undefined") {
    window.GogoDesktop = desktopApi;
  }
})();
