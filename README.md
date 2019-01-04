## 關於   
   
由於有代理此公司的產品，並且需要將產品資訊上架到各網拍平台上。因此寫了一支爬蟲程式，從公司官網上擷取各產品的標題、價格、圖片與文案內容，並存到本地的資料夾中。   


## 如何使用   
1. 下載專案 `git clone https://github.com/showwell0120/hanlin-crawler.git`或下載壓縮檔
2. 安裝node & npm 
3. 安裝所需的dependencies  `npm install`   
4. 執行 `npm run start`   

   
## 資料說明   
- **data** : 儲存所有擷取的內容，第一次擷取到的產品會放在 **base** 的資料夾中。之後的擷取若有新的產品的話，則會另外建立 **yyyy-mm-dd** 的資料夾存放。
- 每個產品的資料夾名稱格式為 **標題 價格**
