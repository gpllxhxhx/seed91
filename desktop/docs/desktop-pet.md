# Music Pet 桌宠桌面端

## 运行

```bash
npm run desktop
npm run desktop:dev
```

启动后会先在本机 `127.0.0.1` 启动静态前端和增强 API，然后显示透明桌宠窗口。完整播放器不会默认弹出，可通过桌宠控制面板、右键菜单或托盘菜单打开。

## 首版能力

- 透明、无边框、置顶桌宠窗口。
- 桌宠可拖动，位置保存在 Electron `userData`。
- 左键点击桌宠打开控制面板。
- 控制面板支持播放/暂停、上一首、下一首、打开播放器、退出桌宠。
- 桌宠右键和托盘菜单支持播放/暂停、上一首、下一首、显示/隐藏歌词、锁定/解锁歌词、打开播放器、退出。
- 桌面歌词窗口透明置顶，默认点击穿透；解锁后可以拖动。
- 复用现有 Web 播放器，播放器状态通过 preload 安全同步给主进程。
- 默认桌宠资源包位于 `desktop/pets/default/`，运行时读取 `manifest.json` 和精灵图资源。
- 本地 API 由主进程启动，退出时清理子进程。
- 日志写入 `userData/logs/music-pet-YYYY-MM-DD.log`。

## 打包和发布

```bash
npm run desktop:installer
npm run desktop:publish-local
```

发布脚本会把最新 `dist/MusicPet-Setup-<version>.exe` 复制到 `frontend/downloads/`，并生成：

- `latest`
- `version.json`
- `MusicPet-Setup-<version>.exe.sha256`

`version.json` 使用统一字段：

- `version`
- `platform`
- `file`
- `sha256`
- `releaseDate`
- `notes`

## 新增桌宠资源包

开发者可以在 `desktop/pets/<pet-id>/` 下新增资源包，首版约定如下：

- 必须提供 `manifest.json`
- `renderer` 固定为 `sprite`
- `assets.spriteSheet` 指向精灵图资源
- `states` 需要包含 `idle`、`hover`、`click`、`playing`、`paused`、`loading`、`error`
- 当前默认读取 `desktop/pets/default/`

## 测试清单

1. 启动程序后出现桌宠。
2. 桌宠透明、无边框、置顶。
3. 桌宠可以拖动，重启后位置恢复。
4. 左键点击桌宠可以打开控制面板。
5. 控制面板按钮可以触发播放/暂停、上一首、下一首、打开播放器、退出桌宠。
6. 在完整播放器播放歌曲后，桌宠状态变为播放中。
7. 托盘菜单、右键菜单仍可播放/暂停。
8. 上一首/下一首在已有队列时可用。
9. 桌面歌词显示当前歌词行。
10. 歌词锁定时点击穿透，解锁后可拖动。
11. 退出程序后本地 API 子进程被关闭。
12. API 只监听 `127.0.0.1`。
13. API 启动失败时出现错误窗口且日志可查。
