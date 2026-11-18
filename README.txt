餐廳訂位管理系統（iPad 純前端 PWA）

一、內容
- index.html：主畫面
- styles.css：iPad 友善的大按鈕介面
- app.js：訂位邏輯及 IndexedDB 本機資料庫
- manifest.webmanifest：PWA 安裝設定
- sw.js：離線快取
- icon-192.png / icon-512.png：App 圖示

二、目前保留的舊版功能
- 選擇訂位日期、前一天／後一天、回到今天
- 午餐／晚餐／全天時間表
- 每 30 分鐘一格的桌位排程
- 依用餐分鐘數判斷時間衝突及營業時間
- 同一餐期、同一開始時間可選多張桌子併桌
- 6 人以上需至少兩桌；只有 1～9 號桌可併桌
- 顧客姓名、電話、人數、備註
- 當日訂位紀錄、姓名／電話搜尋、餐期篩選
- 取消訂位
- JSON 備份／匯入、CSV 匯出

三、重要設定
- 午餐：11:00–14:30
- 晚餐：17:00–20:30
- 預設用餐時間：90 分鐘；可選 30–240 分鐘，每 15 分鐘調整
- 桌位初始容量及可併桌設定依目前可讀取的舊版封裝資訊重建。
  如店內實際桌位不同，請修改 app.js 最上方 TABLES 陣列。

四、部署方式（需要 HTTPS，才能使用 Service Worker 離線快取）
1. 建立 GitHub Repository，將此資料夾內所有檔案上傳到 repository 根目錄。
2. GitHub Repository → Settings → Pages。
3. 在 Build and deployment 選擇 Deploy from a branch。
4. Branch 選 main，資料夾選 /(root)，按 Save。
5. 等待 GitHub Pages 部署完成，取得 https://<帳號>.github.io/<repository>/ 網址。
6. 在 iPad 使用 Safari 開啟網址，先保持網路連線，等待頁面完整載入。
7. 點 Safari 分享 → 加入主畫面。從主畫面圖示開啟使用。

五、網址與隱私提醒
- GitHub Pages 是公開靜態網站託管；即使不主動分享網址，知道網址的人仍可能開啟 App 程式畫面。
- 訂位資料只存在 iPad 本機，不會傳到 GitHub Pages。
- 若連 App 網址都必須限制外部存取，就需要額外的存取控管或店內伺服器；純前端無主機方案無法單靠 Wi-Fi 做到網址私有。

六、重要資料安全提醒
- 訂位資料只存在目前這台 iPad 的 Safari/PWA IndexedDB，不會自動同步其他裝置。
- 不要清除 Safari 網站資料或移除網站資料，否則可能刪除訂位資料。
- 每日打烊後按「匯出 JSON 備份」，將備份檔另存到 iCloud Drive 或其他安全位置。
- 換新 iPad 時，先開啟 App，再用「匯入備份」還原 JSON。
- 首次載入及 App 檔案更新需要網路；已快取後可離線開啟及使用。
- 若清除網站資料或瀏覽器儲存空間被系統回收，仍可能造成資料遺失；本機資料庫不是雲端備份。

七、資料庫與功能測試
- 建議先用測試資料新增、取消、匯出、匯入，確認操作流程後再正式營運。
- 此版本沒有登入及權限控管；請將 iPad 設為店內專用，並啟用 iPad 裝置密碼。
