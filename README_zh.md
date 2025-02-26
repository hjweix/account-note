# Account Note (账号备注助手)

一个浏览器扩展插件，通过添加和管理账号备注来增强您的多账号管理体验。

[English](./README.md)

## 功能特点

- 🔍 智能识别：自动识别登录表单和关联的账号
- 📝 快速备注：在登录界面直接添加和编辑备注信息
- 🔒 安全存储：所有数据均存储在本地，确保信息安全
- 📱 便捷管理：集中管理所有网站的账号备注
- 🎯 精准关联：备注信息与具体网站和用户名绑定
- 🔍 快速搜索：支持按网站、用户名和备注内容搜索

## 安装方法

### Chrome 网上应用店
1. 访问 [Chrome 网上应用店](https://chrome.google.com/webstore)
2. 搜索 "Account Note"
3. 点击 "添加到 Chrome"

### 手动安装（开发者模式）
1. 下载或克隆此仓库
2. 打开 Chrome，访问 `chrome://extensions/`
3. 开启 "开发者模式"
4. 点击 "加载已解压的扩展程序" 并选择 `dist` 文件夹

## 使用说明

### 添加备注
1. 在登录页面点击账号输入区域
2. 登录表单旁会出现备注图标
3. 点击图标添加或编辑备注
4. 按回车保存，按 Esc 取消

### 管理备注
- 点击工具栏中的扩展图标查看当前网站的备注
- 使用管理页面查看和整理所有备注
- 支持按网站、用户名或内容搜索
- 支持批量选择和删除备注

## 隐私与安全

- 所有数据仅存储在浏览器本地
- 不会上传任何数据到服务器
- 备注仅与网站和用户名关联
- 不会涉及任何账号密码信息

## 开发说明

### 环境搭建
```bash
# 安装依赖
npm install

# 启动开发模式
npm run watch

# 构建生产版本
npm run build
```

### 项目结构
```
project/
├── src/          # 源代码文件
├── dist/         # 编译后文件
├── icons/        # 扩展图标
└── docs/         # 文档文件
```

## 参与贡献

1. Fork 此仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m '添加某个特性'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 开源协议

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 致谢

- 感谢所有为此项目做出贡献的开发者
- 特别感谢开源社区的支持

## 支持

如果您遇到任何问题或有建议，请[提交 Issue](https://github.com/yourusername/AccountNote/issues)。