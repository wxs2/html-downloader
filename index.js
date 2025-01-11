console.log(`***********************
html-downloader
demo: npm run down
***********************`)

const axios = require('axios');
const fse = require('fs-extra');
const path = require('path');
const urllib = require('url');
const cheerio = require('cheerio');

// 设置最大并发请求数量以避免对服务器造成过大压力
const MAX_CONCURRENT_REQUESTS = 5;
let concurrentRequests = 0;
const SAVE_PATH = 'download'
let downloadedUrls = [];

async function downloadResource(url) {
    // if (concurrentRequests >= MAX_CONCURRENT_REQUESTS) {
    //     await new Promise(resolve => setTimeout(resolve, 2000)); // 简单的限流
    // }
    concurrentRequests++;
    try {
        if (downloadedUrls.indexOf(url) === -1) {
            const pageResource = await getUrlResources(url);
            const savePath = getUrlSavePath(url);
            const responseData = pageResource.response.data;
            await fse.outputFile(savePath, responseData);
            downloadedUrls.push(url);
            console.log(`Downloaded ${url} to ${savePath} success`);
            await downloadStaticFile(pageResource.css, pageResource.location);
            await downloadStaticFile(pageResource.js, pageResource.location);
            await downloadStaticFile(pageResource.images, pageResource.location);
            for (let index = 0; index < pageResource.hrefs.length; index++) {
                let href = pageResource.hrefs[index];
                if (!href.startsWith("http")) {
                    href = `${pageResource.location.protocol}//${pageResource.location.hostname}${href.startsWith('/') ? href : '/' + href}`;
                }
                await downloadResource(href);
            }
        } else {
            console.log(`already Downloaded ${url}`);
        }
    } catch (error) {
        console.error(`Failed to download ${url}: ${error.message}`);
    } finally {
        concurrentRequests--;
    }
}

function getUrlSavePath(url) {
    // 解析URL
    const parsedUrl = urllib.parse(url);
    // 获取pathname部分
    let pathname = parsedUrl.pathname;
    let fileName = pathname.substring(pathname.lastIndexOf('/') + 1);
    if (!fileName) {
        fileName = "index.html";
    }
    if (fileName.indexOf(".") === -1) {
        fileName += ".html";
    }
    pathname = pathname.substring(1, pathname.lastIndexOf("/"));
    if (pathname === '/') {
        pathname = "";
    }
    let savePath = path.resolve(__dirname, SAVE_PATH, parsedUrl.hostname, pathname, fileName);
    return savePath;
}

async function downloadStaticFile(fileList, location) {
    if (fileList && fileList.length > 0) {
        for (let index = 0; index < fileList.length; index++) {
            const file = fileList[index].replace(/\/\//g, "");
            const url = `${location.protocol}//${location.hostname}${file.startsWith('/') ? file : '/' + file}`;
            if (downloadedUrls.indexOf(url) === -1) {
                try {
                    savePath = getUrlSavePath(url);
                    const urlInfo = urllib.parse(url);
                    if (urlInfo.pathname.endsWith(".jpg") || urlInfo.pathname.endsWith(".png")) {
                        const response = await axios.get(url, {
                            responseType: 'arraybuffer'
                        });
                        await fse.outputFile(savePath, Buffer.from(response.data), { flag: 'w' });
                    } else {
                        const response = await requestWithRetry(url, 3);
                        await fse.outputFile(savePath, response.data);
                    }
                    downloadedUrls.push(url);
                    console.log("downloadStaticFile success:", url);
                } catch (error) {
                    console.error(`downloadStaticFile ${url} err`, error.message);
                }
            }
        }
    }
}

async function getUrlResources(url) {
    try {
        const location = urllib.parse(url);
        // 发送HTTP请求获取HTML内容
        const response = await requestWithRetry(url, 3);
        const resources = {
            js: [],
            css: [],
            images: [],
            hrefs: [],
            response: response,
            location: location
        };
        if (response.headers["content-type"].indexOf("text/html") !== -1) {
            const html = response.data;
            // 使用cheerio加载HTML内容
            const $ = cheerio.load(html);

            // 查找所有的script标签以获取JS文件链接
            $('script[src]').each((index, element) => {
                const jsUrl = $(element).attr('src');
                if (!jsUrl.startsWith("http")) {
                    resources.js.indexOf(jsUrl) === -1 && resources.js.push(jsUrl);
                }
            });

            // 查找所有的link标签以获取CSS文件链接
            $('link[rel="stylesheet"]').each((index, element) => {
                const cssUrl = $(element).attr('href');
                if (!cssUrl.startsWith("http")) {
                    resources.css.indexOf(cssUrl) === -1 && resources.css.push(cssUrl);
                }
            });

            // 查找所有的img标签以获取图片链接
            $('img[src]').each((index, element) => {
                const imageUrl = $(element).attr('src');
                if (!imageUrl.startsWith("http") && imageUrl.indexOf(";base64,") === -1) {
                    resources.images.indexOf(imageUrl) === -1 && resources.images.push(imageUrl);
                }
            });

            // 查找所有的a标签以获取跳转链接
            $('a[href]').each((index, element) => {
                let hrefUrl = $(element).attr('href');
                if (hrefUrl.lastIndexOf("#") !== -1) {
                    hrefUrl = hrefUrl.substring(0, hrefUrl.lastIndexOf("#"));
                }
                if (hrefUrl && hrefUrl !== "/") {
                    const ignore = hrefUrl.startsWith("http") && hrefUrl.indexOf(location.hostname) === -1;
                    if (!ignore) {
                        resources.hrefs.indexOf(hrefUrl) === -1 && resources.hrefs.push(hrefUrl);
                    }
                }
            });
        }
        return resources;
    } catch (error) {
        console.error(`Failed to retrieve the webpage. Error: ${error.message}`);
        return null;
    }
}

async function requestWithRetry(url, retries = 3) {
    return await axios.get(url, {
        timeout: 10000, // 10 秒超时时间
    }).catch(async error => {
        if (retries && error.code === 'ECONNRESET') {
            console.error(`Retrying ${url}, ${retries} retries left...`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // 简单的限流
            return await requestWithRetry(url, retries - 1);
        } else {
            throw error;
        }
    });
}

// 使用示例
(async () => {
    const baseUrl = process.env.url; // 替换为你要下载的网站URL
    console.log(baseUrl);
    if (!baseUrl) {
        console.error("you need set package.json scripts like 'cross-env url=https://autoxjs.dayudada.com node index.js'")
    }
    await downloadResource(baseUrl);
})();