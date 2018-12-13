const puppeteer = require('puppeteer');
const fs = require('fs');

/***結果目錄***/
const targetDir = 'data';
const rootUrl = 'http://tr322.shop2000.com.tw/product/157825';

let browser;
let contentPage;

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

    const result = await page.evaluate(() => {
        let resultObj = {
            imgArr: [],
            text: null
        }

        const pushImgLink = function() {
            let allImg = document.querySelectorAll('img.img_large');
            if(allImg && allImg.length > 0 ){
                for (i = 0; i < allImg.length; i++) {
                    resultObj.imgArr.push(allImg[i].src);
                }
            }
        }

        pushImgLink();

        let textTable = document.querySelectorAll('div>table')[2];
        resultObj.text = textTable.innerText;

        let nextLi = document.querySelector('li.w');
        if(nextLi && nextLi.innerText == "下一頁"){
            nextLi.click();
        }

        return resultObj;
    });

    await page.close();

    return result;
}
let downloadImg = function(uri, index, path, callback){
    let imgPath = path + '/img_' + index + '.jpg';
    request.head(uri, function(err, res, body){
        request(uri).pipe(fs.createWriteStream(imgPath)).on('close', callback);
    });
}
var writeText = function(text, path) {
    let textPath = path + '/text.txt';
    fs.writeFile(textPath, text, function(err) {
        if(err)
            return console.log(err);
        console.log("The file was saved!");
    }); 
}
let startScrapeDetail = () => {
    (async function loop() {
        for (const page in pdList) {
            for (let i = 0; i < pdList[page].length; i++) {
                const _u = pdList[page][i]['u'];
                const _path = pdList[page][i]['pdPath'];
                await new Promise(resolve => {
                    scrapeContent(_u).then((r) => { 
                        if(r.imgArr.length > 0)
                            r.imgArr.forEach((item, i) => downloadImg(item, i, function() {}));
                        if(typeof r.text == 'string' && r.text.length > 0)
                            writeText(r.text, _path);
                    })
                });
            }
        }
    })();
}
//start & 建立各商品的資料夾
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

        if (!fs.existsSync(targetDir))
            fs.mkdirSync(targetDir);

        for (const page in pdList) {
            let path = `${targetDir}/${page}`
            if (!fs.existsSync(path)){
                fs.mkdirSync(path);
                for (let i = 0; i < pdList[page].length; i++) {
                    const pd = pdList[page][i];
                    let pdName = `${pd.t} ${pd.p}`;
                    pdName = pdName.replace(/\//gi, '&');
                    pdName = pdName.replace(/\?/gi, '');
                    let pdPath = `${path}/${pdName}`;
                    pdList[page][i]['pdPath'] = pdPath;
                    if (!fs.existsSync(pdPath))
                        fs.mkdirSync(pdPath);
                }
            }
        }
        startScrapeDetail();
    })();
});

