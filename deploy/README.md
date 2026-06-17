# 服务器部署操作手册

这份手册对应当前项目结构：根目录运行前端网站，`NeteaseCloudMusicApiEnhanced/` 运行音乐 API。

## 1. 服务器准备

推荐 Ubuntu 22.04 或 24.04。先把项目上传到：

```text
/var/www/music-backend/app
```

在云服务器安全组中开放：

```text
22, 80, 443
```

`3000` 和 `8000` 不建议长期开放给外网，正式访问交给 Nginx。

## 2. 安装服务器环境

进入项目目录后运行：

```bash
sudo bash deploy/scripts/setup-ubuntu.sh
```

这会安装 Node.js、npm、Nginx、PM2 和 Certbot。

## 3. 安装项目依赖

```bash
cd /var/www/music-backend/app/NeteaseCloudMusicApiEnhanced
npm install --omit=dev
```

根目录前端服务不需要额外依赖。

生产环境安装会自动跳过 `husky` 这类只用于本地开发的 Git 钩子，不需要额外安装开发依赖。

## 4. 填写你的域名

假设你使用：

```text
music.your-domain.com
```

需要替换三个地方：

```text
frontend/js/config.js
frontend/sitemap.xml
ecosystem.config.cjs
```

把 API 地址写成：

```js
window.NCM_API_BASE = window.location.origin + '/api';
```

把 `sitemap.xml` 里的首页写成：

```text
https://music.your-domain.com/
```

把 `ecosystem.config.cjs` 里的 `CORS_ALLOW_ORIGIN` 写成：

```text
https://music.your-domain.com
```

## 5. 启动前端和 API

在项目根目录运行：

```bash
cd /var/www/music-backend/app
npm run deploy:start
pm2 save
```

检查状态：

```bash
pm2 status
```

查看日志：

```bash
npm run deploy:logs
```

如果只想快速确认 API 是否正常，也可以单独看：

```bash
pm2 logs music-api --lines 50
```

## 6. 配置 Nginx

复制模板：

```bash
sudo cp deploy/nginx/music-site.conf.example /etc/nginx/sites-available/music-site.conf
```

编辑 `/etc/nginx/sites-available/music-site.conf`，把里面的：

```text
music.your-domain.com
```

替换成你的真实域名。模板已经默认把同域名下的 `/api/*` 转发到本机 `3000` 端口。

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/music-site.conf /etc/nginx/sites-enabled/music-site.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 7. 开启 HTTPS

域名 DNS 已经指向服务器公网 IP 后，运行：

```bash
sudo certbot --nginx -d music.your-domain.com
```

按提示选择自动跳转 HTTPS。

## 8. 设置开机自启

```bash
pm2 startup
pm2 save
```

`pm2 startup` 会输出一条命令，把那条命令复制执行一次即可。

## 9. 公网验收

在任意电脑或手机流量环境访问：

```text
https://music.your-domain.com
```

也可以在服务器上运行：

```bash
bash deploy/scripts/check-public-site.sh https://music.your-domain.com
```

需要确认：

- 首页能打开。
- 搜索有结果。
- 推荐、榜单、播放等 API 功能可用。
- `https://music.your-domain.com/sitemap.xml` 能打开。

## 10. 搜索引擎收录

上线稳定后，把下面地址提交到搜索引擎站长平台：

```text
https://music.your-domain.com/sitemap.xml
```

收录通常需要几天到几周。

## 11. 后续更新代码

以后服务器拉取 GitHub 最新代码时，推荐固定执行：

```bash
cd /var/www/music-backend/app
git fetch origin
git checkout main
git pull origin main

cd /var/www/music-backend/app/NeteaseCloudMusicApiEnhanced
npm install --omit=dev

cd /var/www/music-backend/app
pm2 reload ecosystem.config.cjs --update-env
pm2 status
pm2 logs music-api --lines 50
```

确认 `music-web` 和 `music-api` 都是 `online` 后，再做公网访问检查。
