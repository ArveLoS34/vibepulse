# 🚀 VibePulse Canlıya Alma ve APK Üretme Rehberi

Uygulamanızı kendi bilgisayarınızdan (localhost) tamamen bağımsız hale getirip, 7/24 internette canlı çalışan gerçek bir mobil uygulama (.apk) yapmak için aşağıdaki **2 basit aşamayı** izleyin.

---

## ☁️ 1. AŞAMA: Backend ve Veritabanını Bulut Sunucuya Yükleme (24/7 Canlı)

### A) Ücretsiz MongoDB Veritabanı Oluşturma (MongoDB Atlas):
1. [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) adresinden ücretsiz hesap açın.
2. **Create Cluster** -> **Free (M0)** seçeneğini seçin.
3. **Database Access** kısmından bir kullanıcı adı ve şifre belirleyin.
4. **Network Access** kısmından `0.0.0.0/0` (Allow access from anywhere) iznini verin.
5. **Connect** butonuna basıp Connection String adresinizi kopyalayın:
   `mongodb+srv://kullanici:sifre@cluster0.mongodb.net/vibepulse?retryWrites=true&w=majority`

### B) Python Backend'i Render.com'a Yükleme (Ücretsiz 24/7 Sunucu):
1. GitHub reponuzu (`ArveLoS34/vibepulse`) güncel tutun.
2. [Render.com](https://render.com) adresine ücretsiz kaydolun.
3. **New +** -> **Web Service** seçeneğine basın ve GitHub reponuzu bağlayın.
4. Ayarları şu şekilde yapın:
   * **Root Directory:** `backend`
   * **Environment:** `Python 3`
   * **Build Command:** `pip install -r requirements.txt`
   * **Start Command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
5. **Environment Variables** bölümüne şu değişkenleri ekleyin:
   * `MONGO_URL` = *(A şıkkında kopyaladığınız MongoDB Atlas adresi)*
   * `DB_NAME` = `vibepulse`
   * `JWT_SECRET` = `vibepulse-production-secret-9988`
   * `CORS_ORIGINS` = `*`
6. **Create Web Service** butonuna basın. Render size canlı bir URL verecektir:
   `https://vibepulse-api.onrender.com`

---

## 📱 2. AŞAMA: Herkesin İndirebileceği İndirilebilir `.apk` Dosyası Oluşturma

Backend canlıya geçtikten sonra artık bilgisayarınızı kapatabilirsiniz. APK üretmek için:

1. `frontend` klasöründeki **`.env`** dosyasını açın ve Render'dan aldığınız canlı URL'yi yazın:
   ```env
   EXPO_PUBLIC_BACKEND_URL=https://vibepulse-api.onrender.com
   ```

2. Bilgisayarınızda PowerShell terminalini açıp `frontend` klasörüne gidin ve derlemeyi başlatın:
   ```powershell
   cd frontend
   npm install -g eas-cli
   eas login
   eas build --platform android --profile preview
   ```

3. **Sonuç:**
   Derleme bittiğinde Expo size doğrudan indirilebilir bir `.apk` indirme linki verecektir (`https://expo.dev/artifacts/eas/...apk`).

Bu linki arkadaşlarınıza gönderdiğinizde, herkes APK'yı telefonuna indirip Expo Go olmadan, bilgisayarınız kapalıyken bile 24/7 tüm v1 ve v2 özellikleriyle uygulamayı kullanabilir! 🎉
