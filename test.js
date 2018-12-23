const puppeteer = require('puppeteer');
const fs = require('fs');
const request = require('request');

var browser;

var scrapeContent = async (u) => {
    if(!browser)
        browser= await puppeteer.launch({headless: false});
    const page = await browser.newPage();
    await page.goto(u);
    await page.waitForNavigation();

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

var downloadImg = function(uri, index, callback){
    let imgPath = 'data/img_' + index + '.jpg';
    request.head(uri, function(err, res, body){
        request(uri).pipe(fs.createWriteStream(imgPath)).on('close', callback);
    });
};
var writeText = function(text) {
    let textPath = 'data/text' + '.txt';
    fs.writeFile(textPath, text, function(err) {
        if(err)
            return console.log(err);
        console.log("The file was saved!");
    });
}
scrapeContent('https://tr322.shop2000.com.tw/product/p32083446').then((r)=> {
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
