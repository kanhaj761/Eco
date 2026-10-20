# EcoTrack - App + Backend + APK

## 1) Backend chalana (Node 18+)
    cd backend
    node server.js            # http://localhost:3000  (frontend bhi yahi se khulta hai)
Demo logins: admin/admin123, employee/emp123, citizen/citizen123
Env: PORT, JWT_SECRET (production me zaroor set karo), ALLOW_STAFF_SIGNUP=false (production me employee/admin self-signup band).
Data `backend/data/db.json` me save hota hai.

Online deploy: `backend` folder ko Render / Railway par deploy karo (start command: `node server.js`).
Note: free hosting par db.json restart par reset ho sakti hai - serious use ke liye database (PostgreSQL) lagao.

## 2) APK banana (sabse aasan: GitHub se, PC par kuch install nahi)
1. Is poore folder ko GitHub repo me push karo.
2. `www/index.html` me `window.ECO_API=''` ko apne deployed backend URL se badlo, jaise `window.ECO_API='https://ecotrack-xyz.onrender.com'`
   (agar blank rakha to app offline demo mode me chalegi, accounts sirf us phone me save honge).
3. GitHub > Actions > "Build EcoTrack APK" > Run workflow.
4. Khatam hone par Artifacts se `EcoTrack-apk` download karo, zip kholo, `app-debug.apk` phone me install karo.

## Local build (Android Studio ke saath)
    npm install && npx cap add android
    npx capacitor-assets generate --android
    npx cap sync android && npx cap open android
