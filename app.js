const puppeteer = require('puppeteer');
const fs = require('fs');
const request = require('request');

const DATA_DIR = 'data';
const ROOT_URL = 'http://tr322.shop2000.com.tw/product/157825';

const SELECTOR = {
    PAGER: 'ul.pgNo',
    PAGER_ITEM: 'li',
    IMAGE: 'img.img_large',
    IMAGE_NEXTPAGE: 'li.w',
    TEXT: 'div>table',
    PRODUCTS: '.tbrow',
    PRICE: '.price_tb>tbody>tr>td>div>.price1:first-child',
    TITLE: '.p_ul>li>a'
};

let browser;
let launchOpt = {
    headless: false
};

let urlArr = [];
urlArr.push(ROOT_URL);

let pdList = {};

//取各分頁連結
let scrapePager =  async (rUrl) => {
    if(!browser)
        browser= await puppeteer.launch(launchOpt);
    const page = await browser.newPage();
    await page.goto(rUrl);
    await page.waitForNavigation();

    const result = await page.evaluate((rUrl, SELECTOR) => {
        let _urlArr = [];
        let pager = document.querySelector(SELECTOR.PAGER);
        let liArr = pager.querySelectorAll(SELECTOR.PAGER_ITEM);
        for (let li of liArr){
            _urlArr.push(`${rUrl}&p=${li.innerText}`);
        }
        return _urlArr;
    }, rUrl, SELECTOR);

    return result; 
};

//取商品摘要
let scrapePdInfo = async (u, i) => {
    let url = u[i];
    if(!browser)
        browser= await puppeteer.launch(launchOpt);
    const page = await browser.newPage();
    await page.goto(url);
    await page.waitForNavigation();

    const result = await page.evaluate((SELECTOR) => {
        //處理標題
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
        //處理價格
        const formatPrice = (p) => {
            return Number(p) + 250;
        }

        let _data = [];

        let products = document.querySelectorAll(SELECTOR.PRODUCTS);
        for (var pd of products){
            let price = pd.querySelector(SELECTOR.PRICE);
            let p = price ? price.innerText : '' ;
            if(p){
                let title = pd.querySelector(SELECTOR.TITLE);
                let t = formatTitle(title.innerText);
                let u = title.href;
                p = formatPrice(p);
                _data.push({ t, p, u });
            }
        }

        return _data;
    }, SELECTOR);

    await page.close();

    return result; 
};

//取單商品頁內容
let scrapeContent = async (u) => {
    if(!browser)
        browser= await puppeteer.launch(launchOpt);
    const page = await browser.newPage();
    await page.goto(u);

    function waitForMoment(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    const result = await page.evaluate((SELECTOR) => {
        let resultObj = {
            imgArr: [],
            text: null
        }

        //取圖片連結(第一頁)
        let allImg = document.querySelectorAll(SELECTOR.IMAGE);
        if(allImg && allImg.length > 0 ){
            for (i = 0; i < allImg.length; i++) {
                resultObj.imgArr.push(allImg[i].src);
            }
        }

        //取文案內容
        let textTable = document.querySelectorAll(SELECTOR.TEXT)[2];
        resultObj.text = textTable ? textTable.innerText : '';

        return resultObj;
    }, SELECTOR);

    
    const nextLi = await page.$(SELECTOR.IMAGE_NEXTPAGE);
    //取圖片連結(第二頁)
    if(nextLi) {
        const nextLiText = await page.evaluate(element => element.textContent, nextLi);
        if(nextLiText && nextLiText == '下一頁') {
            await page.$$eval(SELECTOR.IMAGE_NEXTPAGE, elements => elements[0].click());
            await waitForMoment(5000);
            const nextImgs = await page.evaluate((SELECTOR) => {
                const imgs = document.querySelectorAll(SELECTOR.IMAGE);
                let srcs = imgs && imgs.length > 0 ? [].map.call(imgs, a => a.src) : [];
                return srcs;
            }, SELECTOR);
            result.imgArr = result.imgArr.concat(nextImgs);
        }
    }

    await waitForMoment(5000);

    await page.close();

    return result;
}

//下載圖片
let downloadImg = function(uri, index, path, callback){
    let imgPath = path + '/img_' + index + '.jpg';
    try {
        request.head(uri, function(err, res, body){
            request(uri).on('error', function(e) {
                console.error("downloadImg error: ", e, uri);
                callback();
            }).pipe(fs.createWriteStream(imgPath)).on('close', callback);
        });
    } catch (error) {
        console.error("downloadImg error: ", e, uri);
        callback();
    }
    
}

//下載文案內容
let writeText = function(text, path, callback) {
    let textPath = path + '/text.txt';
    fs.writeFile(textPath, text, function(err) {
        if(err)
            return console.log(err);
        if(callback) callback();
    }); 
}

//取商品總數
let getAllPdCount = function(pds) {
    let count = 0;
    for (const page in pds) {
        count += pds[page].length;
    }
    return count;
}

//取單商品起始點
let startScrapeDetail = () => {
    let pdCount = 0;
    console.log(pdList);
    (async function loop() {
        for (const page in pdList) {
            for (let i = 0; i < pdList[page].length; i++) {
                const _u = pdList[page][i]['u'];
                const _path = pdList[page][i]['pdPath'];
                await new Promise(resolve => {
                    function onDownloadDone() {
                        resolve();
                        pdCount++;
                        let all = getAllPdCount(pdCount);
                        console.log(pdCount + '/' + all + ' finished');
                    }
                    scrapeContent(_u).then((r) => {
                        if(r.imgArr.length > 0) {
                            let imgCount = 0;
                            r.imgArr.forEach((item, i) => downloadImg(item, i, _path, function() {
                                imgCount++;
                                if(imgCount == r.imgArr.length) {
                                    if(typeof r.text == 'string' && r.text.length > 0)
                                        writeText(r.text, _path, onDownloadDone());
                                    else 
                                        onDownloadDone();
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
createDir(DATA_DIR);

//程式起始點
scrapePager(ROOT_URL).then((res) => {
    urlArr = res;
    (async function loop() {
        for (let i = 0; i < urlArr.length - 1; i++) {
            await new Promise(resolve => {
                scrapePdInfo(urlArr, i).then((res2) => { 
                    pdList[`p${i+1}`] = res2;
                    resolve();
                })
            });
        }

        const baseDir = `${DATA_DIR}/base`;
        let dateDir = '';
        let isFirst = false;
        if(!fs.existsSync(baseDir)){
            fs.mkdirSync(baseDir);
            isFirst = true;
        } else {
            let date = new Date().toISOString().slice(0,10);
            dateDir = `${DATA_DIR}/${date}`;
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

