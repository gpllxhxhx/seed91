# 上线发布说明

这个项目分为两部分：

- `frontend/`：用户看到的网页，可以放到静态网站平台。
- `NeteaseCloudMusicApiEnhanced/`：网页依赖的音乐 API，部署在服务器本机，由同域名下的 `/api` 反向代理转发。

只上传 `frontend/` 也能打开页面，但如果不部署 API，别人访问时无法正常搜索和播放音乐。

如果你要部署到自己的云服务器，优先阅读：

```text
deploy/README.md
```

项目已经包含：

- `ecosystem.config.cjs`：PM2 常驻运行前端和 API。
- `deploy/nginx/music-site.conf.example`：Nginx 公网访问模板。
- `deploy/scripts/setup-ubuntu.sh`：Ubuntu 服务器基础环境安装脚本。
- `deploy/scripts/check-public-site.sh`：上线后的公网检查脚本。

## 推荐上线流程

1. 先部署后端 API

   把 `NeteaseCloudMusicApiEnhanced/` 作为 Node.js 服务部署到支持 Node 的平台。启动命令：

   ```bash
   cd NeteaseCloudMusicApiEnhanced
   npm install --omit=dev
   npm start
   ```

   服务默认监听平台提供的 `PORT`。如果你按仓库里的 PM2 和 Nginx 模板部署，后端只需要在服务器本机运行，不需要单独对外暴露域名。

   生产环境安装会自动跳过 `husky` 这类开发钩子，不需要额外安装开发依赖。

2. 配置前端 API 地址

   打开 `frontend/js/config.js`，把地址改成同域 `/api`：

   ```js
   window.NCM_API_BASE = window.location.origin + '/api';
   ```

3. 部署前端网页

   把 `frontend/` 目录上传到静态网站平台。发布目录选择：

   ```text
   frontend
   ```

   入口文件是：

   ```text
   index.html
   ```

4. 绑定域名

   给网站绑定一个正式域名，例如：

   ```text
   https://music.your-domain.com
   ```

5. 更新站点地图

   打开 `frontend/sitemap.xml`，把：

   ```text
   https://your-domain.example/
   ```

   改成你的真实网站首页地址。

6. 让搜索引擎收录

   网站上线并能公网访问后，把域名提交到搜索引擎站长平台，并提交：

   ```text
   https://你的域名/sitemap.xml
   ```

   通常需要几天到几周才会被搜索到。搜索引擎是否收录，还取决于网站内容质量、访问稳定性、是否有其他网站链接到你的网站。

## 本地测试

前端本地启动：

```bash
npm start
```

API 本地启动：

```bash
npm run api
```

本地访问：

```text
http://localhost:8000
```

## 服务器更新代码

如果服务器目录类似 `/www/wwwroot/music-backend/app`，更新流程推荐固定为：

```bash
cd /www/wwwroot/music-backend/app
git fetch origin
git checkout main
git pull origin main

cd /www/wwwroot/music-backend/app/NeteaseCloudMusicApiEnhanced
npm install --omit=dev

cd /www/wwwroot/music-backend/app
pm2 reload ecosystem.config.cjs --update-env
pm2 status
pm2 logs music-api --lines 50
```

最后重点确认 `music-api` 处于 `online` 状态，且日志里没有依赖缺失或启动报错。

## 注意

- 如果前端是 `https`，API 也必须是 `https`，否则浏览器会拦截请求。
- 如果使用同域部署，Nginx 需要把 `/api/*` 转发到本机的 `3000` 端口。
- `frontend/js/config.js` 里的地址不要保留 `localhost`，线上用户无法访问你电脑上的本地服务。
- 如果网站主要面向中国大陆用户，域名和服务器可能还涉及备案要求。
