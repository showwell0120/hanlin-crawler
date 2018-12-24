const puppeteer = require('puppeteer');
const fs = require('fs');
const request = require('request');

const dataDir = 'data';
const rootUrl = 'http://tr322.shop2000.com.tw/product/157825';

let browser;

/***取每分頁的商品摘要***/
let urlArr = [];
urlArr.push(rootUrl);
let pdList = {}; //title, price, link
//取各分頁連結
let scrapePager =  async (rUrl) => {
    if(!browser)
        browser= await puppeteer.launch({headless: false});
    const page = await browser.newPage();
    await page.goto(rUrl);
    await page.waitForNavigation();

    const result = await page.evaluate((rUrl) => {
        let _urlArr = [];
        let pager = document.querySelector('ul.pgNo');
        let liArr = pager.querySelectorAll('li');
        for (let li of liArr){
            _urlArr.push(`${rUrl}&p=${li.innerText}`);
        }
        return _urlArr;
    }, rUrl);

    return result; 
};
//處理商品摘要
let scrapePds = async (u, i) => {
    let url = u[i];
    if(!browser)
        browser= await puppeteer.launch({headless: false});
    const page = await browser.newPage();
    await page.goto(url);
    await page.waitForNavigation();

    const result = await page.evaluate(() => {
        const formatTitle = (t) => {
            t = t.trim();
            let tArr = [], matched = [];
            p = t.indexOf('-');

            while (p !== -1) {
                matched.push('-');
                p = t.indexOf('-', p + 1);
            }

            if(matched.length == 2){
                tArr = t.split('-');
                return `${tArr[2]}【南部總代理】${tArr[0]} ${tArr[1]}`;
            } else if(matched.length == 1) {
                tArr = t.split(' ');
                if(tArr.length >= 2){
                    let tArr1 = tArr[0].split('-');
                    tArr.shift();
                    let name = tArr.join(' ');
                    return `${name}【南部總代理】${tArr1[0]} ${tArr1[1]}`;
                }
            }
            return `【南部總代理】${t}`;
        }

        const formatPrice = (p) => {
            return Number(p) + 250;
        }

        let _data = [];

        let products = document.querySelectorAll('.tbrow');
        for (var pd of products){
            let price = pd.querySelector('.price_tb>tbody>tr>td>div>.price1:first-child');
            let p = price ? price.innerText : '' ;
            if(p){
                let title = pd.querySelector('.p_ul>li>a');
                let t = formatTitle(title.innerText);
                let u = title.href;
                p = formatPrice(p);
                _data.push({ t, p, u });
            }
        }

        return _data;
    });

    await page.close();

    return result; 
};
let scrapeContent = async (u) => {
    if(!browser)
        browser= await puppeteer.launch({headless: false});
    const page = await browser.newPage();
    await page.goto(u);

    function waitForMoment(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    const result = await page.evaluate(() => {
        let resultObj = {
            imgArr: [],
            text: null
        }

        let allImg = document.querySelectorAll('img.img_large');
        if(allImg && allImg.length > 0 ){
            for (i = 0; i < allImg.length; i++) {
                resultObj.imgArr.push(allImg[i].src);
            }
        }

        let textTable = document.querySelectorAll('div>table')[2];
        resultObj.text = textTable ? textTable.innerText : '';

        return resultObj;
    });

    const nextLi = await page.$("li.w");
    if(nextLi) {
        const nextLiText = await page.evaluate(element => element.textContent, nextLi);
        if(nextLiText && nextLiText == '下一頁') {
            await page.$$eval('li.w', elements => elements[0].click());
            await waitForMoment(5000);
            const nextImgs = await page.evaluate(() => {
                const imgs = document.querySelectorAll('img.img_large');
                let srcs = imgs && imgs.length > 0 ? [].map.call(imgs, a => a.src) : [];
                return srcs;
            });
            result.imgArr = result.imgArr.concat(nextImgs);
        }
    }

    await waitForMoment(5000);

    await page.close();

    return result;
}
let downloadImg = function(uri, index, path, callback){
    let imgPath = path + '/img_' + index + '.jpg';
    request.head(uri, function(err, res, body){
        request({
            url: uri,
            timeout: 120000
        }).pipe(fs.createWriteStream(imgPath)).on('error', function(e) {
            console.error("downloadImg error: ", e);
            callback();
        }).on('close', callback);
    });
}
let writeText = function(text, path, callback) {
    let textPath = path + '/text.txt';
    fs.writeFile(textPath, text, function(err) {
        if(err)
            return console.log(err);
        // console.log(textPath, " was saved!");
        if(callback) callback();
    }); 
}
let startScrapeDetail = () => {
    let pdCount = 0;
    (async function loop() {
        for (const page in pdList) {
            for (let i = 0; i < pdList[page].length; i++) {
                const _u = pdList[page][i]['u'];
                const _path = pdList[page][i]['pdPath'];
                await new Promise(resolve => {
                    scrapeContent(_u).then((r) => {
                        // console.log(r);
                        if(r.imgArr.length > 0)
                        {
                            let imgCount = 0;
                            r.imgArr.forEach((item, i) => downloadImg(item, i, _path, function() {
                                imgCount++;
                                let imgPath = _path + '/img_' + i + '.jpg';
                                // console.log(imgPath, " was saved!");
                                if(imgCount == r.imgArr.length) {
                                    if(typeof r.text == 'string' && r.text.length > 0)
                                        writeText(r.text, _path, function() {
                                            resolve();
                                            pdCount++;
                                            console.log(pdCount + '/157 finished');
                                        });
                                }
                            }));
                        }
                            
                    })
                });
            }
        }
    })();
}
let createDir = (path) => {
    if(!fs.existsSync(path))
        fs.mkdirSync(path);
}
//start & 建立各商品的資料夾
createDir(dataDir);
scrapePager(rootUrl).then((res) => {
    urlArr = res;
    (async function loop() {
        for (let i = 0; i < urlArr.length - 1; i++) {
            await new Promise(resolve => {
                scrapePds(urlArr, i).then((res2) => { 
                    pdList[`p${i+1}`] = res2;
                    resolve();
                })
            });
        }

        const baseDir = `${dataDir}/base`;
        let dateDir = '';
        let isFirst = false;
        if(!fs.existsSync(baseDir)){
            fs.mkdirSync(baseDir);
            isFirst = true;
        } else {
            let date = new Date().toISOString().slice(0,10);
            dateDir = `${dataDir}/${date}`;
            createDir(dateDir);
        }
            
        const _createPdDir = (pdName, pd) => {
            let pdPath = `${baseDir}/${pdName}`;
            if(isFirst) {
                createDir(pdPath);
            } else {
                if (!fs.existsSync(pdPath)) {
                    pdPath = `${dateDir}/${{pdName}}`;
                    createDir(pdPath);
                }
            }
            pd['pdPath'] = pdPath;
        }

        for (const page in pdList) {
            for (let i = 0; i < pdList[page].length; i++) {
                let pd = pdList[page][i];
                let pdName = `${pd.t} ${pd.p}`;
                pdName = pdName.replace(/\//gi, '&');
                pdName = pdName.replace(/\?/gi, '');
                _createPdDir(pdName, pd);
            }
        }
        startScrapeDetail();
    })();
});

