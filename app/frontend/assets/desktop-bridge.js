(function installDesktopBridge() {
  const invoke =
    typeof window !== "undefined" && window.__TAURI__ && window.__TAURI__.core
      ? window.__TAURI__.core.invoke
      : null;

  const desktopApi = {
    isDesktopRuntime() {
      return typeof invoke === "function";
    },
    async getRuntimeInfo() {
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
