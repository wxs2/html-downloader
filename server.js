const express = require('express');
const path = require('path');
const app = express();
const appname = process.env.appname;
console.log(`begin run serve : ${appname}`);
if (!appname) {
    console.error("you need set package.json scripts like 'cross-env appname=autoxjs.dayudada.com node server.js'")
}
const websitePath = path.join(__dirname, 'download', appname);

// 设置静态文件夹
app.use(express.static(websitePath));

// 自定义中间件处理没有后缀的URL请求
app.get(/^(?!\/?(api|static|assets)\/).*/, function (req, res, next) {
    console.log(`Request received for URL: ${req.url}`); // 调试信息

    let urlPath = req.path; // 获取路径部分，不包括查询字符串

    // 如果路径以斜杠结尾，则默认指向 index.html
    if (urlPath.endsWith('/')) {
        urlPath += 'index';
    }

    // 添加 .html 后缀
    const filePath = urlPath + '.html';

    // 使用相对路径，并确保路径安全（防止路径遍历攻击）
    const relativePath = path.normalize(filePath.replace(/^\//, ''));

    // 尝试发送 HTML 文件，仅提供相对路径并指定 root 选项
    res.sendFile(relativePath, { root: websitePath }, function (err) {
        if (err) {
            console.error(`Error serving file: ${err.message}`); // 调试信息
            // 如果文件不存在，交由下一个中间件处理（如404处理）
            next(err);
        } else {
            console.log(`Successfully served file at path: ${relativePath}`); // 调试信息
        }
    });
});

// 错误处理中间件（例如：404页面找不到或其它错误）
app.use(function (err, req, res, next) {
    if (err.status === 404) {
        console.error(`404 Not Found: ${req.url}`); // 调试信息
        res.status(404).send("Sorry, we can't find that!");
    } else {
        console.error(err.stack);
        res.status(500).send('Something broke!');
    }
});

// 监听端口
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));