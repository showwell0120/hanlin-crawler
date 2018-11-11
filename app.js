const puppeteer = require('puppeteer');
const fs = require('fs');

const targetDir = 'data';
const rootUrl = 'http://tr322.shop2000.com.tw/product/157825';
var urlArr = [];
urlArr.push(rootUrl);

var data = {};

var browser;
var contentPage;

let scrapePager =  async (rootUrl) => {
    if(!browser)
        browser= await puppeteer.launch({headless: false});
    const page = await browser.newPage();
    await page.goto(rootUrl);

    const result = await page.evaluate((rootUrl) => {
        //判斷有幾個分頁
        let _urlArr = [];
        let pager = document.querySelector('.pgNo.pgNoget0');
        let liArr = pager.querySelectorAll('li');
        for (let li of liArr){
            _urlArr.push(`${rootUrl}&p=${li.innerText}`);
        }

        return _urlArr;
    }, rootUrl);

    return result; 
};

let scrapeTitle = async (u, i) => {
    let url = u[i];
    if(!browser)
        browser= await puppeteer.launch({headless: false});
    const page = await browser.newPage();
    await page.goto(url);

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

    return result; 
};

// let scrapeContent = async (url) => {
//     if(!contentPage)
//     contentPage= await browser.newPage();
//     await contentPage.goto(url);

//     const result = await contentPage.evaluate(() => {
//         let content = document.querySelectorAll('body>div:nth-child(4)');
//         return content ? content.innerText : '';
//     });

//     return result;
// };


scrapePager(rootUrl).then((res1) => { 
    urlArr = res1;
    (async function loop() {
        for (let i = 0; i < urlArr.length - 1; i++) {
            await new Promise(resolve => {
                scrapeTitle(urlArr, i).then((res2) => { 
                    data[`p${i+1}`] = res2;
                    resolve();
                })
            });
        }

        // console.log(data)

        if (!fs.existsSync(targetDir))
            fs.mkdirSync(targetDir);

        for (const page in data) {
            let path = `${targetDir}/${page}`
            if (!fs.existsSync(path)){
                fs.mkdirSync(path);
                for (let i = 0; i < data[page].length; i++) {
                    const pd = data[page][i];
                    let pdName = `${pd.t} ${pd.p}`;
                    pdName = pdName.replace(/\//gi, '&');
                    let pdPath = `${path}/${pdName}`;
                    if (!fs.existsSync(pdPath)){
                        fs.mkdirSync(pdPath);
                        console.log(pd.u);
                    }  
                }
            }
        }

        browser.close();
    })();
});

