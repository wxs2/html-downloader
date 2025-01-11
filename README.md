# html-downloader
html-downloader是一个静态网站下载器，会自动递归下载所有页面的html、js、css、图片等静态资源
a static website downloader, can auto download all page file, include HTML, JS, CSS, images ...


#### Using html-downloader
1.  modify package.json url,appname

```
 "scripts": {
    "down": "cross-env url=https://autoxjs.dayudada.com node index.js",
    "serve": "cross-env appname=autoxjs.dayudada.com node server.js"
  }
```

2.  npm install

3.  npm run down
    
4.  npm run serve

5.  open http://localhost:3000/

6.  default download path : ./download

