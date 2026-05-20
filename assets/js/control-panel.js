const element = (id) => document.getElementById(id);
const uid = new URLSearchParams(location.search).get("uid");
const webuiVersion = "WebUI v1.1.7 Beta - URL fix";
const UI_COMPAT_STORAGE_KEY = "bluearchivecafe-webui-compat-enabled";
const APP_CONFIG = {
    assets: {
        icons: {
            actionSave: "assets/icons/action-save.svg",
            actionHelp: "assets/icons/action-help.svg",
            actionCopyLink: "assets/icons/action-copy-link.svg",
            actionDiagnose: "assets/icons/action-diagnose.svg",
            statusLoading: "assets/icons/status-loading.svg",
            statusReady: "assets/icons/status-ready.svg",
            statusUpdate: "assets/icons/status-update.svg",
            statusError: "assets/icons/status-error.svg"
        }
    },
    urls: {
        apiBase: "https://api.bluearchive.cafe",
        shareBase: "https://control.bluearchive.cafe"
    }
};
const API_ENDPOINTS = {
    statusList: `${APP_CONFIG.urls.apiBase}/status/list`,
    configGet: `${APP_CONFIG.urls.apiBase}/config/get`,
    configSet: `${APP_CONFIG.urls.apiBase}/config/set`
};

/*  让 MDUI 组件跟随系统深浅色 */
mdui.setTheme("auto");

/*  设置页面主题色  */
mdui.setColorScheme("#1976D2");

const statusStyles = {
    loading: { text: "加载中", icon: APP_CONFIG.assets.icons.statusLoading },
    ready: { text: "可用", icon: APP_CONFIG.assets.icons.statusReady },
    waiting: { text: "待维护", icon: APP_CONFIG.assets.icons.statusUpdate },
    failed: { text: "获取失败", icon: APP_CONFIG.assets.icons.statusError }
};
const resourceVersions = {
    text: null,
    voice: null,
    media: null
};
const hasUid = typeof uid === "string" && uid.trim() !== "";
const compatButtonLabel = element("compat-button-label");

const isUiCompatEnabled = () => document.body.classList.contains("ui-compat-enabled");

const updateCompatButton = () => {
    const enabled = isUiCompatEnabled();
    compatButtonLabel.textContent = enabled ? "退出 UI 兼容布局" : "启用 UI 兼容布局";
    element("compat-button").variant = enabled ? "tonal" : "outlined";
    element("compat-button").setAttribute("aria-pressed", String(enabled));
};

const setUiCompatEnabled = (enabled) => {
    document.body.classList.toggle("ui-compat-enabled", enabled);
    updateCompatButton();

    try {
        localStorage.setItem(UI_COMPAT_STORAGE_KEY, enabled ? "1" : "0");
    } catch {
        // Ignore storage failures and keep the current session state.
    }
};

const initUiCompatPreference = () => {
    try {
        setUiCompatEnabled(localStorage.getItem(UI_COMPAT_STORAGE_KEY) === "1");
    } catch {
        updateCompatButton();
    }
};

const toggleInteractiveState = (disabled) => {
    ["text-checkbox", "voice-checkbox", "media-checkbox", "save-button", "copy-button"].forEach((id) => {
        element(id).disabled = disabled;
    });
};

const setStatus = (id, state) => {
    const chip = element(id);
    const style = statusStyles[state];
    chip.querySelector(".status-label").textContent = style.text;
    chip.querySelector(".ui-icon").style.maskImage = `url('${style.icon}')`;
    chip.querySelector(".ui-icon").style.webkitMaskImage = `url('${style.icon}')`;
};

const showTextDialog = ({
    headline,
    lines,
    actions = [],
    closeOnOverlayClick = true,
    closeOnEsc = true
}) => {
    const dialog = document.createElement("mdui-dialog");

    if (closeOnOverlayClick) {
        dialog.setAttribute("close-on-overlay-click", "");
    }

    if (closeOnEsc) {
        dialog.setAttribute("close-on-esc", "");
    }

    const headlineElement = document.createElement("div");
    headlineElement.slot = "headline";
    headlineElement.textContent = headline;

    const descriptionElement = document.createElement("div");
    descriptionElement.slot = "description";
    descriptionElement.style.whiteSpace = "pre-line";
    descriptionElement.textContent = lines.join("\n");

    dialog.append(headlineElement, descriptionElement);

    actions.forEach(({ text, variant = "text", onClick, closeOnClick = false }) => {
        const actionElement = document.createElement("mdui-button");
        actionElement.slot = "action";
        actionElement.variant = variant;
        actionElement.textContent = text;
        actionElement.addEventListener("click", async () => {
            if (typeof onClick === "function") {
                await onClick(dialog);
            }

            if (closeOnClick) {
                dialog.open = false;
            }
        });
        dialog.append(actionElement);
    });

    dialog.addEventListener("closed", () => dialog.remove(), { once: true });
    document.body.append(dialog);
    dialog.open = true;
};

const fallbackCopyText = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.top = "-9999px";
    textArea.style.opacity = "0";
    document.body.append(textArea);
    textArea.focus();
    textArea.select();

    let copied = false;
    try {
        copied = document.execCommand("copy");
    } finally {
        textArea.remove();
    }

    return copied;
};

const copyText = async (text) => {
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            return fallbackCopyText(text);
        }
    }

    return fallbackCopyText(text);
};

const showHelp = () => {
    showTextDialog({
        headline: "操作说明",
        lines: [
            "1. 先确认各项状态，再决定是否开启对应功能",
            "2. 只有状态为“可用”时，功能才能正常生效",
            "3. 主线中配仅对主线剧情内容生效",
            "4. 开启“图像视频”后，可能需要重新下载相关资源"
        ],
        actions: [
            {
                text: "知道了",
                variant: "tonal",
                closeOnClick: true
            }
        ]
    });
};

const getBrowserEngineVersion = () => {
    const { userAgent } = navigator;
    const edge = userAgent.match(/Edg\/([\d.]+)/);
    if (edge) return `Chromium ${edge[1]} (Edge)`;

    const chrome = userAgent.match(/Chrome\/([\d.]+)/);
    if (chrome) return `Chromium ${chrome[1]}`;

    const firefox = userAgent.match(/Firefox\/([\d.]+)/);
    if (firefox) return `Gecko ${firefox[1]} (Firefox)`;

    const safari = userAgent.match(/Version\/([\d.]+).*Safari/);
    if (safari) return `WebKit ${safari[1]} (Safari)`;

    return "无法识别";
};

const getDiagnosticsLines = () => {
    const { userAgent, appVersion, platform, language, languages, onLine, cookieEnabled, hardwareConcurrency, deviceMemory } = navigator;
    const viewport = `${window.innerWidth} x ${window.innerHeight}`;
    const screenSize = `${window.screen.width} x ${window.screen.height}`;
    const formatVersionLine = (label, versionInfo) => {
        if (!versionInfo) return `${label}: 暂无数据`;
        return `${label}: \n * 官方: ${versionInfo.official} \n * 汉化: ${versionInfo.localized}`;
    };

    return [
        `浏览器内核: ${getBrowserEngineVersion()}`,
        `User-Agent: ${userAgent}`,
        `App Version: ${appVersion}`,
        `平台: ${platform || "未知"}`,
        `语言: ${language || "未知"}`,
        `语言列表: ${Array.isArray(languages) && languages.length ? languages.join(", ") : "未知"}`,
        `在线状态: ${onLine ? "在线" : "离线"}`,
        `Cookie: ${cookieEnabled ? "已启用" : "已禁用"}`,
        `视口尺寸: ${viewport}`,
        `屏幕尺寸: ${screenSize}`,
        `设备像素比: ${window.devicePixelRatio || 1}`,
        `UI 兼容模式: ${isUiCompatEnabled() ? "已启用" : "未启用"}`,
        `控制面板 UID: ${hasUid ? uid : "未提供"}`,
        `当前地址: ${location.href}`,
        formatVersionLine("文本资源版本", resourceVersions.text),
        formatVersionLine("语音资源版本", resourceVersions.voice),
        formatVersionLine("媒体资源版本", resourceVersions.media)
    ];
};

element("read-button").addEventListener("click", showHelp);
element("webui-version").textContent = webuiVersion;
element("compat-button").addEventListener("click", () => {
    const nextEnabled = !isUiCompatEnabled();
    setUiCompatEnabled(nextEnabled);
    mdui.snackbar({
        message: nextEnabled ? "已启用移动端优化布局" : "已恢复默认布局",
        closeable: true
    });
});

element("copy-button").addEventListener("click", async () => {
    if (!hasUid) {
        showTextDialog({
            headline: "缺少参数",
            lines: [
                "当前链接缺少有效的 UID 参数",
                "暂时无法生成分享链接",
                "请使用包含 uid 的完整地址重新打开页面"
            ],
            closeOnOverlayClick: false,
            closeOnEsc: false,
            actions: [
                {
                    text: "关闭",
                    variant: "tonal",
                    closeOnClick: true
                }
            ]
        });
        return;
    }

    const shareUrl = `${APP_CONFIG.urls.shareBase}?uid=${uid}`;
    const copied = await copyText(shareUrl);

    showTextDialog({
        headline: copied ? "复制成功" : "复制失败",
        lines: copied
            ? [
                `UID: ${uid}`,
                "控制面板链接已复制到剪贴板",
                "可粘贴到浏览器中打开",
                "请妥善保管，避免被他人修改设置"
            ]
            : [
                "当前浏览器无法自动写入剪贴板",
                "请手动复制下面的链接并在浏览器中打开",
                shareUrl
            ],
        actions: [
            {
                text: "关闭",
                variant: "tonal",
                closeOnClick: true
            }
        ]
    });
});

element("diagnose-button").addEventListener("click", () => {
    const diagnosticsLines = getDiagnosticsLines();
    showTextDialog({
        headline: "诊断信息",
        lines: diagnosticsLines,
        actions: [
            {
                text: "复制",
                variant: "text",
                onClick: async () => {
                    const copied = await copyText(diagnosticsLines.join("\n"));
                    mdui.snackbar({
                        message: copied ? "诊断信息已复制到剪贴板" : "复制失败，请手动复制诊断信息",
                        closeable: true
                    });
                }
            },
            {
                text: "关闭",
                variant: "tonal",
                closeOnClick: true
            }
        ]
    });
});

element("save-button").addEventListener("click", async () => {
    if (!hasUid) {
        showTextDialog({
            headline: "无法保存",
            lines: [
                "当前链接缺少有效的 UID 参数",
                "无法确认要保存到哪个账号",
                "请通过正确的控制面板链接重新进入"
            ],
            closeOnOverlayClick: false,
            closeOnEsc: false,
            actions: [
                {
                    text: "关闭",
                    variant: "tonal",
                    closeOnClick: true
                }
            ]
        });
        return;
    }

    const text = element("text-checkbox").checked ? "cn" : "jp";
    const voice = element("voice-checkbox").checked ? "cn" : "jp";
    const media = element("media-checkbox").checked ? "cn" : "jp";
    const params = new URLSearchParams({ uid, text, voice, media });
    const response = await fetch(`${API_ENDPOINTS.configSet}?${params}`);

    if (response.ok) {
        mdui.snackbar({
            message: "设置已保存，重启游戏后生效",
            closeable: true
        });
    } else {
        mdui.snackbar({
            message: "保存失败，请稍后重试",
            closeable: true
        });
    }
});

const init = async () => {
    if (!hasUid) {
        toggleInteractiveState(true);
        setStatus("text-status", "failed");
        setStatus("voice-status", "failed");
        setStatus("media-status", "failed");
        showTextDialog({
            headline: "链接无效",
            lines: [
                "当前页面缺少必要的 UID 参数",
                "暂时无法读取或保存资源开关配置",
                "请从有效的控制面板链接重新打开页面"
            ],
            closeOnOverlayClick: false,
            closeOnEsc: false,
            actions: [
                {
                    text: "知道了",
                    variant: "tonal",
                    closeOnClick: true
                }
            ]
        });
        return;
    }

    const [statusRes, configRes] = await Promise.all([
        fetch(API_ENDPOINTS.statusList),
        fetch(`${API_ENDPOINTS.configGet}?uid=${uid}`)
    ]);

    if (statusRes.ok) {
        const status = await statusRes.json();
        resourceVersions.text = {
            official: status.text.official.version,
            localized: status.text.localized.version
        };
        resourceVersions.voice = {
            official: status.voice.official.version,
            localized: status.voice.localized.version
        };
        resourceVersions.media = {
            official: status.media.official.version,
            localized: status.media.localized.version
        };
        const textSynced = status.text.official.version === status.text.localized.version;
        const voiceSynced = status.voice.official.version === status.voice.localized.version;
        const mediaSynced = status.media.official.version === status.media.localized.version;
        setStatus("text-status", textSynced ? "ready" : "waiting");
        setStatus("voice-status", voiceSynced ? "ready" : "waiting");
        setStatus("media-status", mediaSynced ? "ready" : "waiting");
    } else {
        setStatus("text-status", "failed");
        setStatus("voice-status", "failed");
        setStatus("media-status", "failed");
    }

    if (configRes.ok) {
        const { text, voice, media } = await configRes.json();
        element("text-checkbox").checked = text === "cn";
        element("voice-checkbox").checked = voice === "cn";
        element("media-checkbox").checked = media === "cn";
    }
};

initUiCompatPreference();
init().catch(() => {
    setStatus("text-status", "failed");
    setStatus("voice-status", "failed");
    setStatus("media-status", "failed");
});
