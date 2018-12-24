const puppeteer = require('puppeteer');
const fs = require('fs');
const request = require('request');

var browser;

var scrapeContent = async (u) => {
    if(!browser)
        browser= await puppeteer.launch({headless: false, devtools: true});
    const page = await browser.newPage();
    await page.goto(u);
    // await page.waitForNavigation();


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
        resultObj.text = textTable.innerText;
        
        return resultObj;
    });

    const nextLi = await page.$("li.w");
    const nextLiText = await page.evaluate(element => element.textContent, nextLi);
    if(nextLiText && nextLiText == '下一頁') {
        await page.$$eval('li.w', elements => elements[0].click());
        await waitForMoment(5000);
        const nextImgs = await page.evaluate(() => {
            const imgs = document.querySelectorAll('img.img_large');
            return [].map.call(imgs, a => a.src);
        });

        result.imgArr = result.imgArr.concat(nextImgs);
    }

    await page.close();
    return result;
}

var downloadImg = function(uri, index, callback){
    let imgPath = 'testData/img_' + index + '.jpg';
    request.head(uri, function(err, res, body){
        request(uri).pipe(fs.createWriteStream(imgPath)).on('close', callback);
    });
};
var writeText = function(text) {
    let textPath = 'testData/text' + '.txt';
    fs.writeFile(textPath, text, function(err) {
        if(err)
            return console.log(err);
        console.log("The file was saved!");
    });
}
scrapeContent('https://tr322.shop2000.com.tw/product/p32083446').then((r)=> {
    console.log(r);
    if(r.imgArr.length > 0) {
        r.imgArr.forEach(function(item, i) {
            downloadImg(item, i, function() {
            });
        });
    }
    if(typeof r.text == 'string' && r.text.length > 0) {
        writeText(r.text);
    }
});
