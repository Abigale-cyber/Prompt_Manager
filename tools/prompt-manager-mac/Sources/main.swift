import AppKit
import ApplicationServices
import Carbon
import UniformTypeIdentifiers
import WebKit

struct PromptItem: Codable {
    let id: Int
    let title: String
    let description: String
    let prompt: String
    let categoryId: String
    let categoryLabel: String
    let usageCount: Int
}

final class PromptWindow: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

final class PromptEditingWebView: WKWebView {
    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        if handleEditShortcut(event) {
            return true
        }
        return super.performKeyEquivalent(with: event)
    }

    override func keyDown(with event: NSEvent) {
        if handleEditShortcut(event) {
            return
        }
        super.keyDown(with: event)
    }

    private func handleEditShortcut(_ event: NSEvent) -> Bool {
        guard event.type == .keyDown else { return false }

        let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        guard flags.contains(.command),
              !flags.contains(.control),
              !flags.contains(.option) else {
            return false
        }

        let action: Selector
        switch Int(event.keyCode) {
        case kVK_ANSI_X:
            action = #selector(NSText.cut(_:))
        case kVK_ANSI_C:
            action = #selector(NSText.copy(_:))
        case kVK_ANSI_V:
            action = #selector(NSText.paste(_:))
        case kVK_ANSI_A:
            action = #selector(NSText.selectAll(_:))
        default:
            return false
        }

        return NSApp.sendAction(action, to: nil, from: self) || tryToPerform(action, with: self)
    }
}

final class PromptWebController: NSWindowController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, NSWindowDelegate {
    private let webView: WKWebView
    private var isFrontendLoaded = false
    private var pendingPromptFetches: [([PromptItem]) -> Void] = []
    private let frameDefaultsKey = "prompt-manager.window-frame.v1"
    var onUsePrompt: ((PromptItem) -> Void)?

    init() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        configuration.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        configuration.setValue(true, forKey: "allowUniversalAccessFromFileURLs")

        self.webView = PromptEditingWebView(frame: .zero, configuration: configuration)

        let window = PromptWindow(
            contentRect: NSRect(x: 0, y: 0, width: 640, height: 460),
            styleMask: [.titled, .closable, .resizable, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        window.title = "Prompt Manager"
        window.minSize = NSSize(width: 520, height: 380)
        window.center()
        window.isFloatingPanel = true
        window.level = .floating
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        window.hidesOnDeactivate = false
        window.isReleasedWhenClosed = false
        window.isRestorable = false

        super.init(window: window)

        window.delegate = self
        restoreSavedFrameIfAvailable()
        webView.configuration.userContentController.add(self, name: "exportExcel")
        webView.configuration.userContentController.add(self, name: "importFile")
        webView.configuration.userContentController.add(self, name: "usePrompt")
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false

        let root = NSView()
        root.wantsLayer = true
        root.layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
        root.addSubview(webView)
        window.contentView = root

        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            webView.topAnchor.constraint(equalTo: root.topAnchor),
            webView.bottomAnchor.constraint(equalTo: root.bottomAnchor)
        ])

        loadFrontend()
    }

    required init?(coder: NSCoder) {
        nil
    }

    deinit {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "exportExcel")
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "importFile")
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "usePrompt")
    }

    func showTool(over app: NSRunningApplication? = nil) {
        if !restoreSavedFrameIfAvailable() {
            positionWindow(near: app)
        }
        window?.orderFrontRegardless()
        webView.window?.makeFirstResponder(webView)
    }

    func reloadFrontend() {
        isFrontendLoaded = false
        loadFrontend()
    }

    private func positionWindow(near app: NSRunningApplication?) {
        guard let window else { return }
        let screen = NSScreen.main
        let visibleFrame = screen?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1200, height: 800)
        let size = window.frame.size
        let focusedFrame = app.flatMap { focusedElementFrame(for: $0, on: screen) }
        let targetFrame = focusedFrame ?? app.flatMap { frontmostWindowFrame(for: $0) } ?? visibleFrame
        var x = visibleFrame.maxX - size.width - 48
        var y: CGFloat

        if let focusedFrame {
            let gap: CGFloat = 18
            let roomAbove = visibleFrame.maxY - focusedFrame.maxY
            let roomBelow = focusedFrame.minY - visibleFrame.minY

            if roomAbove >= size.height + gap {
                y = focusedFrame.maxY + gap
            } else if roomBelow >= size.height + gap {
                y = focusedFrame.minY - size.height - gap
            } else if roomAbove >= roomBelow {
                y = min(focusedFrame.maxY + gap, visibleFrame.maxY - size.height - 16)
            } else {
                y = max(focusedFrame.minY - size.height - gap, visibleFrame.minY + 16)
            }
        } else {
            y = targetFrame.midY - size.height / 2
        }

        x = min(max(x, visibleFrame.minX + 16), visibleFrame.maxX - size.width - 16)
        y = min(max(y, visibleFrame.minY + 16), visibleFrame.maxY - size.height - 16)
        window.setFrameOrigin(NSPoint(x: x, y: y))
        saveCurrentFrame()
    }

    @discardableResult
    private func restoreSavedFrameIfAvailable() -> Bool {
        guard
            let window,
            let rawFrame = UserDefaults.standard.string(forKey: frameDefaultsKey)
        else {
            return false
        }

        let savedFrame = NSRectFromString(rawFrame)
        guard savedFrame.width >= window.minSize.width, savedFrame.height >= window.minSize.height else {
            return false
        }

        var nextFrame = savedFrame
        if abs(savedFrame.width - 720) < 1, abs(savedFrame.height - 520) < 1 {
            nextFrame.size = NSSize(width: 640, height: 460)
            nextFrame.origin.x = savedFrame.maxX - nextFrame.width
            nextFrame.origin.y = savedFrame.maxY - nextFrame.height
        }

        window.setFrame(constrainToVisibleScreens(nextFrame), display: false)
        saveCurrentFrame()
        return true
    }

    private func saveCurrentFrame() {
        guard let window else { return }
        UserDefaults.standard.set(NSStringFromRect(window.frame), forKey: frameDefaultsKey)
    }

    private func constrainToVisibleScreens(_ frame: NSRect) -> NSRect {
        let visibleFrame = NSScreen.screens
            .first { $0.frame.intersects(frame) }?
            .visibleFrame ?? NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1200, height: 800)
        var next = frame
        next.size.width = min(next.width, visibleFrame.width - 32)
        next.size.height = min(next.height, visibleFrame.height - 32)
        next.origin.x = min(max(next.minX, visibleFrame.minX + 16), visibleFrame.maxX - next.width - 16)
        next.origin.y = min(max(next.minY, visibleFrame.minY + 16), visibleFrame.maxY - next.height - 16)
        return next
    }

    func windowDidMove(_ notification: Notification) {
        saveCurrentFrame()
    }

    func windowDidResize(_ notification: Notification) {
        saveCurrentFrame()
    }

    private func focusedElementFrame(for app: NSRunningApplication, on screen: NSScreen?) -> NSRect? {
        let appElement = AXUIElementCreateApplication(app.processIdentifier)
        var focusedValue: CFTypeRef?
        guard AXUIElementCopyAttributeValue(appElement, kAXFocusedUIElementAttribute as CFString, &focusedValue) == .success,
              let focusedElement = focusedValue else {
            return nil
        }

        var positionValue: CFTypeRef?
        var sizeValue: CFTypeRef?
        guard AXUIElementCopyAttributeValue(focusedElement as! AXUIElement, kAXPositionAttribute as CFString, &positionValue) == .success,
              AXUIElementCopyAttributeValue(focusedElement as! AXUIElement, kAXSizeAttribute as CFString, &sizeValue) == .success,
              let positionValue,
              let sizeValue,
              CFGetTypeID(positionValue) == AXValueGetTypeID(),
              CFGetTypeID(sizeValue) == AXValueGetTypeID() else {
            return nil
        }

        var point = CGPoint.zero
        var size = CGSize.zero
        AXValueGetValue(positionValue as! AXValue, .cgPoint, &point)
        AXValueGetValue(sizeValue as! AXValue, .cgSize, &size)
        guard size.width > 6, size.height > 6 else { return nil }

        let screenFrame = screen?.frame ?? NSScreen.main?.frame ?? NSRect(x: 0, y: 0, width: 1200, height: 800)
        let appKitY = screenFrame.height - point.y - size.height
        return NSRect(x: point.x, y: appKitY, width: size.width, height: size.height)
    }

    private func frontmostWindowFrame(for app: NSRunningApplication) -> NSRect? {
        guard
            let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]],
            let screen = NSScreen.main
        else {
            return nil
        }

        for windowInfo in windows {
            guard
                let ownerPID = windowInfo[kCGWindowOwnerPID as String] as? pid_t,
                ownerPID == app.processIdentifier,
                let layer = windowInfo[kCGWindowLayer as String] as? Int,
                layer == 0,
                let boundsDict = windowInfo[kCGWindowBounds as String] as? [String: Any],
                let x = boundsDict["X"] as? CGFloat,
                let y = boundsDict["Y"] as? CGFloat,
                let width = boundsDict["Width"] as? CGFloat,
                let height = boundsDict["Height"] as? CGFloat,
                width > 120,
                height > 120
            else {
                continue
            }

            let appKitY = screen.frame.height - y - height
            return NSRect(x: x, y: appKitY, width: width, height: height)
        }

        return nil
    }

    func fetchPromptItems(completion: @escaping ([PromptItem]) -> Void) {
        guard isFrontendLoaded else {
            pendingPromptFetches.append(completion)
            return
        }

        let script = """
        (() => {
          try {
            const raw = window.localStorage.getItem('prompt-management-tool:v1');
            const state = raw ? JSON.parse(raw) : {};
            const categories = Array.isArray(state.categories) ? state.categories : [];
            const labels = Object.fromEntries(categories.map((item) => [item.id, item.label]));
            const prompts = state.prompts && typeof state.prompts === 'object' ? state.prompts : {};
            const items = Object.entries(prompts).flatMap(([categoryId, list]) => {
              if (!Array.isArray(list)) return [];
              return list
                .filter((item) => item && item.enabled !== false && item.prompt)
                .map((item) => ({
                  id: Number(item.id || 0),
                  title: String(item.title || 'Untitled Prompt'),
                  description: String(item.description || ''),
                  prompt: String(item.prompt || ''),
                  categoryId,
                  categoryLabel: String(labels[categoryId] || categoryId),
                  usageCount: Number(item.usageCount || 0)
                }));
            });
            return JSON.stringify(items);
          } catch {
            return '[]';
          }
        })();
        """

        webView.evaluateJavaScript(script) { result, error in
            guard error == nil, let json = result as? String, let data = json.data(using: .utf8) else {
                NSLog("PromptManager prompt fetch failed: \(error?.localizedDescription ?? "unknown error")")
                completion([])
                return
            }

            let items = (try? JSONDecoder().decode([PromptItem].self, from: data)) ?? []
            completion(items)
        }
    }

    func markPromptUsed(_ id: Int) {
        let script = """
        (() => {
          try {
            const key = 'prompt-management-tool:v1';
            const raw = window.localStorage.getItem(key);
            const state = raw ? JSON.parse(raw) : {};
            const prompts = state.prompts && typeof state.prompts === 'object' ? state.prompts : {};
            const now = Date.now();
            for (const categoryId of Object.keys(prompts)) {
              const list = Array.isArray(prompts[categoryId]) ? prompts[categoryId] : [];
              prompts[categoryId] = list.map((item) => {
                if (Number(item.id) !== \(id)) return item;
                return { ...item, usageCount: Number(item.usageCount || 0) + 1, updatedAt: now };
              });
            }
            state.prompts = prompts;
            window.localStorage.setItem(key, JSON.stringify(state));
          } catch {}
        })();
        """
        webView.evaluateJavaScript(script, completionHandler: nil)
    }

    private func loadFrontend() {
        guard let resourceURL = Bundle.main.resourceURL else { return }
        let webRoot = resourceURL.appendingPathComponent("web", isDirectory: true)
        let indexURL = webRoot.appendingPathComponent("index.html")
        webView.loadFileURL(indexURL, allowingReadAccessTo: webRoot)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showLoadError(error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        showLoadError(error)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        isFrontendLoaded = true
        let fetches = pendingPromptFetches
        pendingPromptFetches.removeAll()
        fetches.forEach { fetchPromptItems(completion: $0) }
    }

    func webView(
        _ webView: WKWebView,
        runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping ([URL]?) -> Void
    ) {
        let panel = NSOpenPanel()
        panel.title = "导入 Prompt 文件"
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection

        if #available(macOS 12.0, *) {
            panel.allowedContentTypes = [
                UTType(filenameExtension: "xlsx"),
                UTType(filenameExtension: "xls"),
                .commaSeparatedText,
                .json,
            ].compactMap { $0 }
        } else {
            panel.allowedFileTypes = ["xlsx", "xls", "csv", "json"]
        }

        let completion: (NSApplication.ModalResponse) -> Void = { response in
            completionHandler(response == .OK ? panel.urls : nil)
        }

        if let window {
            panel.beginSheetModal(for: window, completionHandler: completion)
        } else {
            completion(panel.runModal())
        }
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (Bool) -> Void
    ) {
        let alert = NSAlert()
        alert.messageText = message
        alert.alertStyle = .warning
        alert.addButton(withTitle: "确定")
        alert.addButton(withTitle: "取消")

        let complete: (NSApplication.ModalResponse) -> Void = { response in
            completionHandler(response == .alertFirstButtonReturn)
        }

        if let window {
            alert.beginSheetModal(for: window, completionHandler: complete)
        } else {
            complete(alert.runModal())
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "importFile" {
            showImportOpenPanel()
            return
        }

        if message.name == "usePrompt" {
            guard
                let body = message.body as? [String: Any],
                let promptText = body["prompt"] as? String
            else {
                return
            }

            onUsePrompt?(PromptItem(
                id: body["id"] as? Int ?? 0,
                title: body["title"] as? String ?? "Prompt",
                description: body["description"] as? String ?? "",
                prompt: promptText,
                categoryId: body["categoryId"] as? String ?? "",
                categoryLabel: "",
                usageCount: 0
            ))
            return
        }

        guard message.name == "exportExcel" else { return }
        guard
            let body = message.body as? [String: Any],
            let base64 = body["base64"] as? String,
            let data = Data(base64Encoded: base64)
        else {
            notifyExportResult(success: false, message: "Excel 数据无效")
            return
        }

        let rawFilename = (body["filename"] as? String) ?? "prompt-library.xlsx"
        let filename = rawFilename.hasSuffix(".xlsx") ? rawFilename : "\(rawFilename).xlsx"
        showExcelSavePanel(filename: filename, data: data)
    }

    private func showImportOpenPanel() {
        let panel = NSOpenPanel()
        panel.title = "导入 Prompt 文件"
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false

        if #available(macOS 12.0, *) {
            panel.allowedContentTypes = [
                UTType(filenameExtension: "xlsx"),
                UTType(filenameExtension: "xls"),
                .commaSeparatedText,
                .json,
            ].compactMap { $0 }
        } else {
            panel.allowedFileTypes = ["xlsx", "xls", "csv", "json"]
        }

        let completion: (NSApplication.ModalResponse) -> Void = { [weak self] response in
            guard response == .OK, let url = panel.url else {
                return
            }

            do {
                let data = try Data(contentsOf: url)
                self?.notifyImportFileSelected(filename: url.lastPathComponent, data: data)
            } catch {
                NSLog("PromptManager import file read failed: \(error.localizedDescription)")
            }
        }

        if let window {
            panel.beginSheetModal(for: window, completionHandler: completion)
        } else {
            completion(panel.runModal())
        }
    }

    private func notifyImportFileSelected(filename: String, data: Data) {
        let payload = """
        Promise.resolve(window.__promptManagerImportFile?.({
          filename: \(jsString(filename)),
          base64: \(jsString(data.base64EncodedString()))
        })).catch((error) => {
          console.error('PromptManager native import failed', error);
          window.dispatchEvent(new CustomEvent('prompt-manager-import-error', {
            detail: { message: String(error && error.message ? error.message : error) }
          }));
        });
        """
        webView.evaluateJavaScript(payload) { _result, error in
            if let error {
                NSLog("PromptManager import callback failed: \(error.localizedDescription)")
            }
        }
    }

    private func showExcelSavePanel(filename: String, data: Data) {
        let panel = NSSavePanel()
        panel.title = "导出 Prompt Excel"
        panel.nameFieldStringValue = filename
        panel.canCreateDirectories = true
        if #available(macOS 12.0, *) {
            panel.allowedContentTypes = [UTType(filenameExtension: "xlsx") ?? .spreadsheet]
        } else {
            panel.allowedFileTypes = ["xlsx"]
        }

        let completion: (NSApplication.ModalResponse) -> Void = { [weak self] response in
            guard response == .OK, let url = panel.url else {
                self?.notifyExportResult(success: false, message: "已取消导出")
                return
            }

            do {
                try data.write(to: url, options: .atomic)
                self?.notifyExportResult(success: true, message: "Excel 已导出")
            } catch {
                NSLog("PromptManager export failed: \(error.localizedDescription)")
                self?.notifyExportResult(success: false, message: "导出失败")
            }
        }

        if let window {
            panel.beginSheetModal(for: window, completionHandler: completion)
        } else {
            completion(panel.runModal())
        }
    }

    private func notifyExportResult(success: Bool, message: String) {
        let payload = """
        window.dispatchEvent(new CustomEvent('prompt-manager-export-result', {
          detail: { success: \(success ? "true" : "false"), message: \(jsString(message)) }
        }));
        """
        webView.evaluateJavaScript(payload, completionHandler: nil)
    }

    private func showLoadError(_ error: Error) {
        let html = """
        <html>
          <body style="font: 14px -apple-system; padding: 24px;">
            <h3>前端页面加载失败</h3>
            <p>\(error.localizedDescription)</p>
            <p>请重新运行 <code>tools/prompt-manager-mac/build.sh</code>。</p>
          </body>
        </html>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }
}

func jsString(_ string: String) -> String {
    if let data = try? JSONEncoder().encode(string),
       let encoded = String(data: data, encoding: .utf8) {
        return encoded
    }

    let escaped = string
        .replacingOccurrences(of: "\\", with: "\\\\")
        .replacingOccurrences(of: "\"", with: "\\\"")
        .replacingOccurrences(of: "\n", with: "\\n")
        .replacingOccurrences(of: "\r", with: "\\r")
    return "\"\(escaped)\""
}

final class PromptDataController: NSObject, WKNavigationDelegate {
    private let webView: WKWebView
    private var isFrontendLoaded = false
    private var pendingPromptFetches: [([PromptItem]) -> Void] = []

    override init() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        configuration.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        configuration.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
        webView = WKWebView(frame: .zero, configuration: configuration)

        super.init()

        webView.navigationDelegate = self
        loadFrontend()
    }

    func reloadFrontend() {
        isFrontendLoaded = false
        loadFrontend()
    }

    func fetchPromptItems(completion: @escaping ([PromptItem]) -> Void) {
        guard isFrontendLoaded else {
            pendingPromptFetches.append(completion)
            return
        }

        let script = """
        (() => {
          try {
            const raw = window.localStorage.getItem('prompt-management-tool:v1');
            const state = raw ? JSON.parse(raw) : {};
            const categories = Array.isArray(state.categories) ? state.categories : [];
            const labels = Object.fromEntries(categories.map((item) => [item.id, item.label]));
            const prompts = state.prompts && typeof state.prompts === 'object' ? state.prompts : {};
            const items = Object.entries(prompts).flatMap(([categoryId, list]) => {
              if (!Array.isArray(list)) return [];
              return list
                .filter((item) => item && item.enabled !== false && item.prompt)
                .map((item) => ({
                  id: Number(item.id || 0),
                  title: String(item.title || 'Untitled Prompt'),
                  description: String(item.description || ''),
                  prompt: String(item.prompt || ''),
                  categoryId,
                  categoryLabel: String(labels[categoryId] || categoryId),
                  usageCount: Number(item.usageCount || 0)
                }));
            });
            return JSON.stringify(items);
          } catch {
            return '[]';
          }
        })();
        """

        webView.evaluateJavaScript(script) { result, error in
            guard error == nil, let json = result as? String, let data = json.data(using: .utf8) else {
                NSLog("PromptManager prompt fetch failed: \(error?.localizedDescription ?? "unknown error")")
                completion([])
                return
            }

            let items = (try? JSONDecoder().decode([PromptItem].self, from: data)) ?? []
            completion(items)
        }
    }

    func markPromptUsed(_ id: Int) {
        let script = """
        (() => {
          try {
            const key = 'prompt-management-tool:v1';
            const raw = window.localStorage.getItem(key);
            const state = raw ? JSON.parse(raw) : {};
            const prompts = state.prompts && typeof state.prompts === 'object' ? state.prompts : {};
            const now = Date.now();
            for (const categoryId of Object.keys(prompts)) {
              const list = Array.isArray(prompts[categoryId]) ? prompts[categoryId] : [];
              prompts[categoryId] = list.map((item) => {
                if (Number(item.id) !== \(id)) return item;
                return { ...item, usageCount: Number(item.usageCount || 0) + 1, updatedAt: now };
              });
            }
            state.prompts = prompts;
            window.localStorage.setItem(key, JSON.stringify(state));
          } catch {}
        })();
        """
        webView.evaluateJavaScript(script, completionHandler: nil)
    }

    private func loadFrontend() {
        guard let resourceURL = Bundle.main.resourceURL else { return }
        let webRoot = resourceURL.appendingPathComponent("web", isDirectory: true)
        let indexURL = webRoot.appendingPathComponent("index.html")
        webView.loadFileURL(indexURL, allowingReadAccessTo: webRoot)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        isFrontendLoaded = true
        let fetches = pendingPromptFetches
        pendingPromptFetches.removeAll()
        fetches.forEach { fetchPromptItems(completion: $0) }
    }
}

final class PromptReactLauncherController: NSWindowController, WKScriptMessageHandler, WKNavigationDelegate {
    private let webView: WKWebView
    private var sourceApp: NSRunningApplication?
    var onSelect: ((PromptItem, NSRunningApplication?) -> Void)?

    init() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        configuration.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        configuration.setValue(true, forKey: "allowUniversalAccessFromFileURLs")

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.setValue(false, forKey: "drawsBackground")

        let panel = LauncherPanel(
            contentRect: NSRect(x: 0, y: 0, width: 760, height: 560),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.isReleasedWhenClosed = false

        super.init(window: panel)

        webView.configuration.userContentController.add(WeakScriptMessageDelegate(self), name: "usePrompt")
        webView.configuration.userContentController.add(WeakScriptMessageDelegate(self), name: "closeLauncher")
        webView.navigationDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        panel.contentView = webView
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: panel.contentView!.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: panel.contentView!.trailingAnchor),
            webView.topAnchor.constraint(equalTo: panel.contentView!.topAnchor),
            webView.bottomAnchor.constraint(equalTo: panel.contentView!.bottomAnchor)
        ])

        loadLauncher()
    }

    required init?(coder: NSCoder) {
        nil
    }

    deinit {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "usePrompt")
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "closeLauncher")
    }

    var isVisible: Bool {
        window?.isVisible == true
    }

    func show(sourceApp: NSRunningApplication?) {
        self.sourceApp = sourceApp
        loadLauncher()
        positionWindow(near: sourceApp)
        NSApp.activate(ignoringOtherApps: true)
        window?.makeKeyAndOrderFront(nil)
    }

    func hide() {
        window?.orderOut(nil)
    }

    private func loadLauncher() {
        guard let resourceURL = Bundle.main.resourceURL else { return }
        let webRoot = resourceURL.appendingPathComponent("web", isDirectory: true)
        let launcherURL = webRoot.appendingPathComponent("launcher.html")
        webView.loadFileURL(launcherURL, allowingReadAccessTo: webRoot)
    }

    private func positionWindow(near app: NSRunningApplication?) {
        guard let window else { return }
        let screen = NSScreen.main
        let visibleFrame = screen?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1200, height: 800)
        let targetFrame = app.flatMap { frontmostWindowFrame(for: $0) } ?? visibleFrame
        let size = window.frame.size
        var x = targetFrame.midX - size.width / 2
        var y = targetFrame.minY + 72
        x = min(max(x, visibleFrame.minX + 16), visibleFrame.maxX - size.width - 16)
        y = min(max(y, visibleFrame.minY + 56), visibleFrame.maxY - size.height - 16)
        window.setFrame(NSRect(x: x, y: y, width: size.width, height: size.height), display: true)
    }

    private func frontmostWindowFrame(for app: NSRunningApplication) -> NSRect? {
        guard
            let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]],
            let screen = NSScreen.main
        else {
            return nil
        }

        for windowInfo in windows {
            guard
                let ownerPID = windowInfo[kCGWindowOwnerPID as String] as? pid_t,
                ownerPID == app.processIdentifier,
                let layer = windowInfo[kCGWindowLayer as String] as? Int,
                layer == 0,
                let boundsDict = windowInfo[kCGWindowBounds as String] as? [String: Any],
                let x = boundsDict["X"] as? CGFloat,
                let y = boundsDict["Y"] as? CGFloat,
                let width = boundsDict["Width"] as? CGFloat,
                let height = boundsDict["Height"] as? CGFloat,
                width > 120,
                height > 120
            else {
                continue
            }

            let appKitY = screen.frame.height - y - height
            return NSRect(x: x, y: appKitY, width: width, height: height)
        }

        return nil
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "closeLauncher" {
            hide()
            sourceApp?.activate(options: [.activateAllWindows, .activateIgnoringOtherApps])
            return
        }

        guard
            message.name == "usePrompt",
            let body = message.body as? [String: Any],
            let promptText = body["prompt"] as? String
        else {
            return
        }

        let item = PromptItem(
            id: body["id"] as? Int ?? 0,
            title: body["title"] as? String ?? "Prompt",
            description: body["description"] as? String ?? "",
            prompt: promptText,
            categoryId: body["categoryId"] as? String ?? "",
            categoryLabel: "",
            usageCount: 0
        )
        let app = sourceApp
        hide()
        onSelect?(item, app)
    }
}

final class WeakScriptMessageDelegate: NSObject, WKScriptMessageHandler {
    weak var delegate: WKScriptMessageHandler?

    init(_ delegate: WKScriptMessageHandler) {
        self.delegate = delegate
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}

final class HotKeyController {
    private var eventHandler: EventHandlerRef?
    private var hotKeyRef: EventHotKeyRef?
    var onToggle: (() -> Void)?
    private(set) var hotKeyLabel = "未注册"

    init() {
        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: OSType(kEventHotKeyPressed))
        InstallEventHandler(GetApplicationEventTarget(), { _, _, userData in
            guard let userData else { return noErr }
            let controller = Unmanaged<HotKeyController>.fromOpaque(userData).takeUnretainedValue()
            DispatchQueue.main.async {
                controller.onToggle?()
            }
            return noErr
        }, 1, &eventType, Unmanaged.passUnretained(self).toOpaque(), &eventHandler)

        _ = registerHotKey(keyCode: UInt32(kVK_Space), modifiers: UInt32(optionKey), id: 1, label: "⌥Space")
    }

    deinit {
        if let hotKeyRef {
            UnregisterEventHotKey(hotKeyRef)
        }
        if let eventHandler {
            RemoveEventHandler(eventHandler)
        }
    }

    private func registerHotKey(keyCode: UInt32, modifiers: UInt32, id: UInt32, label: String) -> Bool {
        var ref: EventHotKeyRef?
        let hotKeyID = EventHotKeyID(signature: fourCharCode("PMGR"), id: id)
        let status = RegisterEventHotKey(
            keyCode,
            modifiers,
            hotKeyID,
            GetApplicationEventTarget(),
            UInt32(kEventHotKeyExclusive),
            &ref
        )

        guard status == noErr, let ref else {
            NSLog("PromptManager hotkey registration failed: \(label), status: \(status)")
            return false
        }

        hotKeyRef = ref
        hotKeyLabel = label
        NSLog("PromptManager hotkey registered: \(label)")
        return true
    }
}

func fourCharCode(_ string: String) -> OSType {
    var result: OSType = 0
    for scalar in string.unicodeScalars.prefix(4) {
        result = (result << 8) + OSType(scalar.value)
    }
    return result
}

final class LauncherSearchField: NSSearchField {
    var onSpecialKey: ((NSEvent) -> Bool)?

    override func keyDown(with event: NSEvent) {
        if onSpecialKey?(event) == true {
            return
        }
        super.keyDown(with: event)
    }
}

final class LauncherPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

final class PromptLauncherController: NSWindowController, NSTableViewDataSource, NSTableViewDelegate, NSSearchFieldDelegate {
    private let searchField = LauncherSearchField()
    private let tableView = NSTableView()
    private let scrollView = NSScrollView()
    private let emptyLabel = NSTextField(labelWithString: "没有找到匹配的 Prompt")
    private let footerLabel = NSTextField(labelWithString: "Enter 调用并粘贴    Esc 关闭")
    private var allItems: [PromptItem] = []
    private var filteredItems: [PromptItem] = []
    private var sourceApp: NSRunningApplication?
    var onSelect: ((PromptItem, NSRunningApplication?) -> Void)?

    init() {
        let panel = LauncherPanel(
            contentRect: NSRect(x: 0, y: 0, width: 640, height: 420),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        panel.isFloatingPanel = true
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.hasShadow = true
        panel.isReleasedWhenClosed = false

        super.init(window: panel)

        buildInterface()
    }

    required init?(coder: NSCoder) {
        nil
    }

    func show(items: [PromptItem], sourceApp: NSRunningApplication?) {
        self.sourceApp = sourceApp
        allItems = items
        searchField.stringValue = ""
        applyFilter()
        positionWindow()
        NSLog("PromptManager launcher shown: \(items.count) prompts")
        NSApp.activate(ignoringOtherApps: true)
        window?.makeKeyAndOrderFront(nil)
        searchField.becomeFirstResponder()
    }

    func hide() {
        window?.orderOut(nil)
    }

    var isVisible: Bool {
        window?.isVisible == true
    }

    func confirmSelectionFromMonitor() {
        confirmSelection()
    }

    private func buildInterface() {
        guard let window else { return }

        let root = NSVisualEffectView()
        root.translatesAutoresizingMaskIntoConstraints = false
        root.material = .hudWindow
        root.blendingMode = .behindWindow
        root.state = .active
        root.wantsLayer = true
        root.layer?.cornerRadius = 18
        root.layer?.masksToBounds = true

        let container = NSStackView()
        container.translatesAutoresizingMaskIntoConstraints = false
        container.orientation = .vertical
        container.spacing = 12
        container.edgeInsets = NSEdgeInsets(top: 16, left: 16, bottom: 14, right: 16)

        searchField.translatesAutoresizingMaskIntoConstraints = false
        searchField.placeholderString = "搜索 Prompt..."
        searchField.font = .systemFont(ofSize: 18, weight: .medium)
        searchField.delegate = self
        searchField.onSpecialKey = { [weak self] event in
            self?.handleSpecialKey(event) ?? false
        }

        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("prompt"))
        column.title = "Prompt"
        tableView.addTableColumn(column)
        tableView.headerView = nil
        tableView.rowHeight = 72
        tableView.intercellSpacing = NSSize(width: 0, height: 6)
        tableView.backgroundColor = .clear
        tableView.selectionHighlightStyle = .regular
        tableView.dataSource = self
        tableView.delegate = self
        tableView.target = self
        tableView.doubleAction = #selector(confirmSelection)

        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.documentView = tableView
        scrollView.hasVerticalScroller = true
        scrollView.drawsBackground = false

        emptyLabel.translatesAutoresizingMaskIntoConstraints = false
        emptyLabel.alignment = .center
        emptyLabel.textColor = .secondaryLabelColor
        emptyLabel.font = .systemFont(ofSize: 14)

        footerLabel.translatesAutoresizingMaskIntoConstraints = false
        footerLabel.alignment = .center
        footerLabel.textColor = .secondaryLabelColor
        footerLabel.font = .systemFont(ofSize: 12)

        let listContainer = NSView()
        listContainer.translatesAutoresizingMaskIntoConstraints = false
        listContainer.addSubview(scrollView)
        listContainer.addSubview(emptyLabel)

        container.addArrangedSubview(searchField)
        container.addArrangedSubview(listContainer)
        container.addArrangedSubview(footerLabel)
        root.addSubview(container)
        window.contentView = root

        NSLayoutConstraint.activate([
            container.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            container.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            container.topAnchor.constraint(equalTo: root.topAnchor),
            container.bottomAnchor.constraint(equalTo: root.bottomAnchor),

            searchField.heightAnchor.constraint(equalToConstant: 44),
            listContainer.heightAnchor.constraint(equalToConstant: 330),
            footerLabel.heightAnchor.constraint(equalToConstant: 18),

            scrollView.leadingAnchor.constraint(equalTo: listContainer.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: listContainer.trailingAnchor),
            scrollView.topAnchor.constraint(equalTo: listContainer.topAnchor),
            scrollView.bottomAnchor.constraint(equalTo: listContainer.bottomAnchor),

            emptyLabel.leadingAnchor.constraint(equalTo: listContainer.leadingAnchor),
            emptyLabel.trailingAnchor.constraint(equalTo: listContainer.trailingAnchor),
            emptyLabel.centerYAnchor.constraint(equalTo: listContainer.centerYAnchor)
        ])
    }

    private func positionWindow() {
        guard let window else { return }
        let screen = NSScreen.main
        let visibleFrame = screen?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1200, height: 800)
        let targetFrame = sourceApp.flatMap { frontmostWindowFrame(for: $0) } ?? visibleFrame
        let size = window.frame.size
        var x = targetFrame.midX - size.width / 2
        var y = targetFrame.minY + 72
        x = min(max(x, visibleFrame.minX + 16), visibleFrame.maxX - size.width - 16)
        y = min(max(y, visibleFrame.minY + 56), visibleFrame.maxY - size.height - 16)
        window.setFrame(NSRect(x: x, y: y, width: size.width, height: size.height), display: true)
    }

    private func frontmostWindowFrame(for app: NSRunningApplication) -> NSRect? {
        guard
            let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]],
            let screen = NSScreen.main
        else {
            return nil
        }

        for windowInfo in windows {
            guard
                let ownerPID = windowInfo[kCGWindowOwnerPID as String] as? pid_t,
                ownerPID == app.processIdentifier,
                let layer = windowInfo[kCGWindowLayer as String] as? Int,
                layer == 0,
                let boundsDict = windowInfo[kCGWindowBounds as String] as? [String: Any],
                let x = boundsDict["X"] as? CGFloat,
                let y = boundsDict["Y"] as? CGFloat,
                let width = boundsDict["Width"] as? CGFloat,
                let height = boundsDict["Height"] as? CGFloat,
                width > 120,
                height > 120
            else {
                continue
            }

            let appKitY = screen.frame.height - y - height
            return NSRect(x: x, y: appKitY, width: width, height: height)
        }

        return nil
    }

    private func applyFilter() {
        let query = searchField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if query.isEmpty {
            filteredItems = allItems
        } else {
            filteredItems = allItems.filter { item in
                [item.title, item.description, item.prompt, item.categoryLabel]
                    .joined(separator: " ")
                    .lowercased()
                    .contains(query)
            }
        }
        tableView.reloadData()
        emptyLabel.isHidden = !filteredItems.isEmpty
        scrollView.isHidden = filteredItems.isEmpty
        if !filteredItems.isEmpty {
            tableView.selectRowIndexes(IndexSet(integer: 0), byExtendingSelection: false)
            tableView.scrollRowToVisible(0)
        }
    }

    private func handleSpecialKey(_ event: NSEvent) -> Bool {
        switch Int(event.keyCode) {
        case kVK_Escape:
            hide()
            sourceApp?.activate(options: [.activateIgnoringOtherApps])
            return true
        case kVK_Return:
            confirmSelection()
            return true
        case kVK_DownArrow:
            moveSelection(by: 1)
            return true
        case kVK_UpArrow:
            moveSelection(by: -1)
            return true
        default:
            return false
        }
    }

    private func moveSelection(by delta: Int) {
        guard !filteredItems.isEmpty else { return }
        let current = tableView.selectedRow >= 0 ? tableView.selectedRow : 0
        let next = min(max(current + delta, 0), filteredItems.count - 1)
        tableView.selectRowIndexes(IndexSet(integer: next), byExtendingSelection: false)
        tableView.scrollRowToVisible(next)
    }

    @objc private func confirmSelection() {
        guard !filteredItems.isEmpty else { return }
        let row = tableView.selectedRow >= 0 ? tableView.selectedRow : 0
        guard row < filteredItems.count else { return }
        let item = filteredItems[row]
        let app = sourceApp
        hide()
        onSelect?(item, app)
    }

    func controlTextDidChange(_ obj: Notification) {
        applyFilter()
    }

    func numberOfRows(in tableView: NSTableView) -> Int {
        filteredItems.count
    }

    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        guard row < filteredItems.count else { return nil }
        let item = filteredItems[row]
        let view = NSTableCellView()
        view.wantsLayer = true
        view.layer?.cornerRadius = 10

        let title = NSTextField(labelWithString: item.title)
        title.translatesAutoresizingMaskIntoConstraints = false
        title.font = .systemFont(ofSize: 15, weight: .semibold)
        title.textColor = .labelColor
        title.lineBreakMode = .byTruncatingTail

        let description = NSTextField(labelWithString: item.description.isEmpty ? item.prompt : item.description)
        description.translatesAutoresizingMaskIntoConstraints = false
        description.font = .systemFont(ofSize: 12)
        description.textColor = .secondaryLabelColor
        description.lineBreakMode = .byTruncatingTail

        let meta = NSTextField(labelWithString: "\(item.categoryLabel) · 已用 \(item.usageCount) 次")
        meta.translatesAutoresizingMaskIntoConstraints = false
        meta.font = .systemFont(ofSize: 11, weight: .medium)
        meta.textColor = .tertiaryLabelColor
        meta.lineBreakMode = .byTruncatingTail

        view.addSubview(title)
        view.addSubview(description)
        view.addSubview(meta)

        NSLayoutConstraint.activate([
            title.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
            title.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),
            title.topAnchor.constraint(equalTo: view.topAnchor, constant: 8),

            description.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            description.trailingAnchor.constraint(equalTo: title.trailingAnchor),
            description.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 5),

            meta.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            meta.trailingAnchor.constraint(equalTo: title.trailingAnchor),
            meta.topAnchor.constraint(equalTo: description.bottomAnchor, constant: 5)
        ])

        return view
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    private enum TargetShortcut: Equatable {
        case paste

        var keyCode: CGKeyCode {
            switch self {
            case .paste:
                return CGKeyCode(kVK_ANSI_V)
            }
        }
    }

    private let promptDataController = PromptDataController()
    private var promptController: PromptWebController?
    private let launcherController = PromptReactLauncherController()
    private var statusItem: NSStatusItem?
    private var hotKeyController: HotKeyController?
    private var hotKeyLabel = "注册中"
    private var localMonitor: Any?
    private var globalMouseMonitor: Any?
    private var sourceAppForPromptWindow: NSRunningApplication?
    private var lastTargetApp: NSRunningApplication?
    private var activationObserver: NSObjectProtocol?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        setupMainMenu()
        setupStatusItem()
        launcherController.onSelect = { [weak self] item, sourceApp in
            self?.usePrompt(item, sourceApp: sourceApp)
        }
        rememberTargetApp(NSWorkspace.shared.frontmostApplication)
        requestAccessibilityPermission()
        installActivationObserver()
        installLocalMonitor()
        installGlobalMouseMonitor()
        hotKeyController = HotKeyController()
        hotKeyController?.onToggle = { [weak self] in
            self?.openPromptWindowFromFrontmostApp()
        }
        hotKeyLabel = hotKeyController?.hotKeyLabel ?? "未注册"
        setupStatusItem()
    }

    deinit {
        if let activationObserver {
            NSWorkspace.shared.notificationCenter.removeObserver(activationObserver)
        }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        openWindow()
        return true
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    private func setupStatusItem() {
        if let statusItem {
            NSStatusBar.system.removeStatusItem(statusItem)
        }
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.title = "Prompt Manager"
        if let menuBarImage = NSImage(named: "PromptManagerMenuBar") {
            menuBarImage.size = NSSize(width: 18, height: 18)
            item.button?.image = menuBarImage
            item.button?.imagePosition = .imageLeading
        }

        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Open Prompt Manager", action: #selector(openWindow), keyEquivalent: "p"))
        menu.addItem(NSMenuItem(title: "重新加载页面", action: #selector(reloadWindow), keyEquivalent: "r"))
        menu.addItem(NSMenuItem(title: "快捷键：\(hotKeyLabel)", action: nil, keyEquivalent: ""))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "退出", action: #selector(quit), keyEquivalent: "q"))
        item.menu = menu
        statusItem = item
    }

    private func setupMainMenu() {
        let mainMenu = NSMenu()

        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)
        let appMenu = NSMenu()
        appMenu.addItem(NSMenuItem(title: "Quit Prompt Manager", action: #selector(quit), keyEquivalent: "q"))
        appMenuItem.submenu = appMenu

        let editMenuItem = NSMenuItem()
        mainMenu.addItem(editMenuItem)
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(NSMenuItem(title: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x"))
        editMenu.addItem(NSMenuItem(title: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c"))
        editMenu.addItem(NSMenuItem(title: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v"))
        editMenu.addItem(NSMenuItem(title: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a"))
        editMenuItem.submenu = editMenu

        NSApp.mainMenu = mainMenu
    }

    private func installLocalMonitor() {
        localMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard self?.launcherController.isVisible == true else {
                return event
            }
            switch Int(event.keyCode) {
            case kVK_Escape:
                self?.launcherController.hide()
                return nil
            default:
                return event
            }
        }
    }

    private func installGlobalMouseMonitor() {
        globalMouseMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { [weak self] _ in
            guard let self, self.launcherController.isVisible else { return }
            DispatchQueue.main.async {
                self.launcherController.hide()
            }
        }
    }

    private func installActivationObserver() {
        activationObserver = NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
            self?.rememberTargetApp(app)
        }
    }

    private func rememberTargetApp(_ app: NSRunningApplication?) {
        guard app?.bundleIdentifier != Bundle.main.bundleIdentifier else { return }
        lastTargetApp = app
    }

    private func currentTargetApp() -> NSRunningApplication? {
        let frontmostApp = NSWorkspace.shared.frontmostApplication
        if frontmostApp?.bundleIdentifier != Bundle.main.bundleIdentifier {
            rememberTargetApp(frontmostApp)
            return frontmostApp
        }
        return lastTargetApp
    }

    private func requestAccessibilityPermission() {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        let trusted = AXIsProcessTrustedWithOptions(options)
        NSLog("PromptManager accessibility trusted: \(trusted)")
    }

    @objc private func openWindow() {
        sourceAppForPromptWindow = currentTargetApp()
        let controller = promptController ?? PromptWebController()
        promptController = controller
        controller.onUsePrompt = { [weak self] item in
            guard let self else { return }
            let sourceApp = self.sourceAppForPromptWindow
            self.promptController?.window?.orderOut(nil)
            self.usePrompt(item, sourceApp: sourceApp)
        }
        controller.showTool()
    }

    private func openPromptWindowFromFrontmostApp() {
        sourceAppForPromptWindow = NSWorkspace.shared.frontmostApplication
        NSLog("PromptManager manager requested from: \(sourceAppForPromptWindow?.localizedName ?? "unknown")")
        let controller = promptController ?? PromptWebController()
        promptController = controller
        controller.onUsePrompt = { [weak self] item in
            guard let self else { return }
            let sourceApp = self.sourceAppForPromptWindow
            self.promptController?.window?.orderOut(nil)
            self.usePrompt(item, sourceApp: sourceApp)
        }
        controller.showTool(over: sourceAppForPromptWindow)
    }

    @objc private func reloadWindow() {
        promptDataController.reloadFrontend()
        promptController?.reloadFrontend()
        openWindow()
    }

    private func showLauncher() {
        let sourceApp = NSWorkspace.shared.frontmostApplication
        NSLog("PromptManager launcher requested from: \(sourceApp?.localizedName ?? "unknown")")
        if sourceApp?.bundleIdentifier == Bundle.main.bundleIdentifier, launcherController.isVisible {
            launcherController.hide()
        } else {
            launcherController.show(sourceApp: sourceApp)
        }
    }

    private func usePrompt(_ item: PromptItem, sourceApp: NSRunningApplication?) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(item.prompt, forType: .string)

        let targetApp = sourceApp ?? currentTargetApp()
        guard let targetApp, targetApp.bundleIdentifier != Bundle.main.bundleIdentifier else {
            return
        }
        rememberTargetApp(targetApp)

        NSLog("PromptManager use prompt target: \(targetApp.localizedName ?? "unknown") pid=\(targetApp.processIdentifier)")
        targetApp.activate(options: [.activateAllWindows, .activateIgnoringOtherApps])
        pastePromptIntoTargetApp(targetApp, attempt: 0, shortcut: .paste)
    }

    private func pastePromptIntoTargetApp(_ targetApp: NSRunningApplication, attempt: Int, shortcut: TargetShortcut) {
        let frontmost = NSWorkspace.shared.frontmostApplication
        if NSWorkspace.shared.frontmostApplication?.processIdentifier != targetApp.processIdentifier,
           attempt < 12 {
            NSLog("PromptManager waiting target foreground: target=\(targetApp.localizedName ?? "unknown") frontmost=\(frontmost?.localizedName ?? "none") attempt=\(attempt)")
            targetApp.activate(options: [.activateAllWindows, .activateIgnoringOtherApps])
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
                self.pastePromptIntoTargetApp(targetApp, attempt: attempt + 1, shortcut: shortcut)
            }
            return
        }

        NSLog("PromptManager posting shortcut \(shortcut): target=\(targetApp.localizedName ?? "unknown") frontmost=\(frontmost?.localizedName ?? "none") attempt=\(attempt)")
        if shortcut == .paste {
            let pendingPromptText = NSPasteboard.general.string(forType: .string) ?? ""
            if !pendingPromptText.isEmpty {
                if !shouldUseKeyboardPaste(for: targetApp),
                   insertPrompt(pendingPromptText, intoFocusedElementOf: targetApp) {
                    return
                }
            }
        }

        if !postKeyboardShortcut(shortcut), shortcut == .paste {
            pasteWithAppleScriptFallback()
        }
    }

    private func shouldUseKeyboardPaste(for app: NSRunningApplication) -> Bool {
        guard let bundleIdentifier = app.bundleIdentifier else {
            return false
        }

        let keyboardPasteBundleIdentifiers: Set<String> = [
            "co.zeit.hyper",
            "com.apple.Terminal",
            "com.exafunction.windsurf",
            "com.github.wez.wezterm",
            "com.googlecode.iterm2",
            "com.microsoft.VSCode",
            "com.microsoft.VSCodeInsiders",
            "com.mitchellh.ghostty",
            "com.todesktop.230313mzl4w4u92",
            "dev.warp.Warp-Preview",
            "dev.warp.Warp-Stable",
            "net.kovidgoyal.kitty",
            "org.alacritty"
        ]

        return keyboardPasteBundleIdentifiers.contains(bundleIdentifier)
    }

    private func insertPrompt(_ prompt: String, intoFocusedElementOf app: NSRunningApplication) -> Bool {
        let appElement = AXUIElementCreateApplication(app.processIdentifier)
        var focusedValue: CFTypeRef?
        guard AXUIElementCopyAttributeValue(appElement, kAXFocusedUIElementAttribute as CFString, &focusedValue) == .success,
              let focusedElement = focusedValue else {
            return false
        }

        return insertPrompt(prompt, into: focusedElement as! AXUIElement)
    }

    private func insertPrompt(_ prompt: String, into focusedElement: AXUIElement) -> Bool {
        var valueRef: CFTypeRef?
        guard AXUIElementCopyAttributeValue(focusedElement, kAXValueAttribute as CFString, &valueRef) == .success,
              let currentValue = valueRef as? String else {
            return false
        }

        let nsValue = currentValue as NSString
        var selectedRange = CFRange(location: nsValue.length, length: 0)
        var selectedRangeRef: CFTypeRef?
        if AXUIElementCopyAttributeValue(focusedElement, kAXSelectedTextRangeAttribute as CFString, &selectedRangeRef) == .success,
           let selectedRangeRef,
           CFGetTypeID(selectedRangeRef) == AXValueGetTypeID() {
            AXValueGetValue(selectedRangeRef as! AXValue, .cfRange, &selectedRange)
        }

        let location = max(0, min(selectedRange.location, nsValue.length))
        let maxLength = nsValue.length - location
        let length = max(0, min(selectedRange.length, maxLength))
        let nextValue = nsValue.replacingCharacters(in: NSRange(location: location, length: length), with: prompt)

        guard AXUIElementSetAttributeValue(focusedElement, kAXValueAttribute as CFString, nextValue as CFTypeRef) == .success else {
            return false
        }

        var nextRange = CFRange(location: location + (prompt as NSString).length, length: 0)
        if let nextRangeValue = AXValueCreate(.cfRange, &nextRange) {
            AXUIElementSetAttributeValue(focusedElement, kAXSelectedTextRangeAttribute as CFString, nextRangeValue)
        }
        return true
    }

    private func postPasteShortcut() -> Bool {
        postKeyboardShortcut(.paste)
    }

    private func postKeyboardShortcut(_ shortcut: TargetShortcut) -> Bool {
        guard
            let source = CGEventSource(stateID: .combinedSessionState),
            let keyDown = CGEvent(keyboardEventSource: source, virtualKey: shortcut.keyCode, keyDown: true),
            let keyUp = CGEvent(keyboardEventSource: source, virtualKey: shortcut.keyCode, keyDown: false)
        else {
            return false
        }

        keyDown.flags = .maskCommand
        keyUp.flags = .maskCommand
        keyDown.post(tap: .cghidEventTap)
        keyUp.post(tap: .cghidEventTap)
        return true
    }

    private func pasteWithAppleScriptFallback() {
        var error: NSDictionary?
        let script = NSAppleScript(source: "tell application \"System Events\" to keystroke \"v\" using command down")
        script?.executeAndReturnError(&error)

        if error == nil {
            return
        }

        NSLog("PromptManager AppleScript paste failed: \(String(describing: error))")
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
