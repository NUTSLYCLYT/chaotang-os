中文字体落点
============

朝堂是中文优先界面，生产环境不能依赖宿主机刚好安装中文字体。

当前自托管文件名：

- `NotoSansSC-VF.ttf`
- `NotoSerifSC-VF.ttf`

`src/app/globals.css` 已注册这些文件。文件存在时浏览器会优先使用自托管字体；文件缺失时会继续走系统字体 fallback。Docker runtime 另安装 `font-noto-cjk` 作为容器兜底。
