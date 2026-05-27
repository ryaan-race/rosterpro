# 📋 Smart Workforce Management Platform (ROSTERS)

An advanced, mobile-responsive personnel scheduling and roster optimization application. Built with **React 18 / 19**, **Vite**, **Tailwind CSS**, and fully integrated with robust serverless services using **Firebase (Firestore & Auth)**.

---

## 🚀 Key Highlights & Architectural Features

### 1. 🤖 Autonomous Roster Planner
* **Conflict-Free Scheduling Engine**: Automatically respects and filters out approved Leaves/Time-Offs and Week-Off preferences daily to maintain absolute compliance.
* **Auto Load-Balancing & Rotation**: Shuffles eligible staff and distributes Morning, Evening, and Night shifts symmetrically across the work squad.
* **Intelligent Density Analytics**: Features automated roster simulation and operational planning checks.

### 2. 📱 Responsive Navigation Architecture
* **Dual-Viewport Layouts**: 
  - *Large Screens*: Persistent, beautiful side-navigation panel with real-time route transitions.
  - *Mobile & Handhelds*: Transitions seamlessly into an intuitive bottom-navigation quick-touch rail.
* **Touch-Friendly Hitboxes**: Fully optimized interface maintaining hitboxes of at least `44px` for seamless mobile interactions.

### 3. 🎯 Advanced Operational Modules
* **Live GPS-Assisted Attendance Gate**: Real-time geolocation coordinate math comparing physical location with geofenced worksite points, backed by dynamic optical camera confirmations.
* **SwapBoard**: Multi-user portal allowing employees to post shift-trades, select trade partners, and request managerial overrides securely.
* **Interactive Reporting Analytics**: Visualizes roster performance, shift allocations, and workforce attendance trends utilizing **Recharts**.

---

## 📂 Repository Structure Key Files

* `src/lib/firebase.ts` — Houses authentication state listener & Firestore operations logic.
* `firebase-applet-config.json` — Pre-seeded credential store for database bindings.
* `firestore.rules` — Rules enforcing absolute field limits, read/write boundaries, and path restrictions.
* `.env.example` — Template defining API secret requirements.

---

## 🛠️ Local Development & Quick Start (VS Code Step-by-Step)

If you are using **VS Code**, follow these steps to initialize your project, connect your GitHub repository, and launch the platform:

### Step 1: Open the Project in VS Code
1. Open **VS Code**.
2. Click **File -> Open Folder** and select this extracted project folder.
3. Open the built-in terminal by pressing ``Ctrl + ` `` (Windows/Linux) or ``Cmd + ` `` (Mac).

---

### Step 2: Push Subsequent Updates to GitHub (For Existing Online Repositories)
If you successfully linked your repository yesterday and want to upload today's new features and UI adjustments, run these exact commands in your terminal:

```powershell
# 1. Securely check the status of modified files
git status

# 2. Stage all modifications (including today's style and sidebar changes)
git add .

# 3. Commit with a structured note
git commit -m "update: rearranged navigation sidebar sequentially and polished typography"

# 4. Push changes straight to your main branch
git push origin main
```

> **💡 What if your remote branch has diverged or "rejects updates"?**
> If you modified files directly on github.com (such as editing the README online), your local workspace is out-of-sync. Simply run:
> ```powershell
> git pull origin main --rebase
> git push origin main
> ```
> Or force your pristine local computer state as the single source of truth:
> ```powershell
> git push origin main --force
> ```

---

### Step 2b: Initialize Git and Push to GitHub (Only if starting fresh)
If you are initializing this folder as a brand new GitHub repository from scratch, run these commands:

```powershell
# 1. Initialize local Git repository
git init

# 2. Add your GitHub Identity (Required to avoid Author Identity errors)
git config --global user.name "Rajesh Sharma"
git config --global user.email "rajesh.myphoneme@gmail.com"

# 3. Add all current project files to source control
git add .

# 4. Create your initial commit
git commit -m "first commit: Smart Workforce Platform (ROSTERS)"

# 5. Set the main branch
git branch -M main

# 6. Link to your target GitHub repository
git remote add origin https://github.com/ryaan-race/rosterpro.git

# 7. Push local files securely to GitHub
git push -u origin main
```

> **💡 Troubleshooting "Author identity unknown" or "src refspec main does not match any":**
> If you forgot to set your user configuration initially, the write attempt failed. This leaves your repository completely empty (meaning the `main` branch does not exist yet). Simply run the two `git config` lines above, then run the add, commit, and push steps again to resolve it automatically!

---

### Step 3: Install Project Dependencies
In the same terminal, you **MUST** install all local project dependencies before running any other command:
```bash
npm install
```

---

### Step 4: Configure Local Application Secrets
1. Generate your local environment file by replicating the template:
```bash
cp .env.example .env
```
2. Open your new `.env` file in the VS Code explorer pane, and configure any desired keys:
```env
GEMINI_API_KEY="YOUR_OPTIONAL_GEMINI_API_KEY"
APP_URL="http://localhost:3000"
```

---

### Step 5: Replace Firebase Applet Credentials
1. Locate the `firebase-applet-config.json` file in your root folder.
2. If you are using your own Firestore cluster, replace the values with your active web configurations:
```json
{
  "projectId": "YOUR_PROJECT_ID",
  "appId": "YOUR_APP_ID",
  "apiKey": "YOUR_API_KEY",
  "authDomain": "YOUR_AUTH_DOMAIN.firebaseapp.com",
  "firestoreDatabaseId": "(default)",
  "storageBucket": "YOUR_STORAGE_BUCKET.firebasestorage.app",
  "messagingSenderId": "YOUR_MESSAGING_SENDER_ID"
}
```

---

### Step 6: Start local Development Services
Since you are on Windows, port `3000` is often reserved by Hyper-V or WSL, causing the **EACCES Permission Denied** error. 

#### 🚀 How to start development immediately:
1. Make sure you completed **Step 3 (`npm install`)** so all modules are fully loaded!
2. Run this exact command inside your VS Code PowerShell terminal to use a standard free port:

```powershell
npx vite --port 5173
```

*(This will run your development server on http://localhost:5173 where it has full permissions and won't be blocked!)*

---

### 🚨 Troubleshooting Your Local Terminal Errors:

#### 1. Why did `npx vite --port 5173` say "Unresolved Import: Could not resolve @tailwindcss/vite" and fail?
* **Why this happens**: You ran `npx vite` in a newly downloaded folder copy (`shiftsync (4)`) without installing the project libraries first!
* **How to fix**: Run **`npm install`** first inside your terminal. Once it finishes downloading (`added 254 packages...`), run `npx vite --port 5173` again.

#### 2. Why did Git push fail with `rejected main -> main (fetch first)`?
* **Why this happens**: Secure remote platforms like GitHub prevent developers from pushing code if the online repository already has placeholder files (like a default README.md or License file) that are missing on your local computer.
* **How to fix**: Since you are pushing your project from scratch to initialize the code, you can use a **force push** to establish your local computer as the source of truth:
  ```powershell
  git push -u origin main --force
  ```

#### 3. Why did `firebase deploy` fail with "Not in a Firebase app directory (could not locate firebase.json)"?
* **Why this happens**: Local Firebase needs a `firebase.json` file in the root directory to map your local `firestore.rules` and compiled website production assets.
* **How to fix**: We have created and pre-configured a proper `firebase.json` file in your root directory! Now, to deploy to Firebase, just run:
  ```powershell
  # A. Build the optimized production code
  npm run build
  
  # B. Deploy both Hosting and Firestore securely
  firebase deploy
  ```

#### 4. How to fix Firestore Storage CORS Blocked on Vercel (`rosterpro-seven.vercel.app`)? (Without Installing Anything!)
* **Why this happens**: Firebase Storage blocks uploads from custom web domains by default. If you try to run `gsutil` locally on Windows, it will fail because the heavy Google Cloud SDK CLI is not installed on your laptop!
* **How to fix using Google Cloud Shell (100% Free & Zero-Install)**:
  1. Open your web browser and open: **[Google Cloud Shell Terminal (Direct Link)](https://shell.cloud.google.com/?show=terminal)**.
  2. This gives you a free, pre-authenticated Google safe terminal in your browser with `gsutil` preloaded!
  3. Copy and paste this exact command block into your Cloud Shell browser terminal and press **Enter** to write your file:
     ```bash
     cat << 'EOF' > cors.json
     [
       {
         "origin": ["https://rosterpro-seven.vercel.app", "http://localhost:5173", "http://localhost:3000"],
         "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
         "responseHeader": ["Content-Type"],
         "maxAgeSeconds": 3600
       }
     ]
     EOF
     ```
  4. Set your Google Cloud Shell workspace to target your specific project by running this command:
     ```bash
     gcloud config set project gen-lang-client-0868734466
     ```
     *(If a popup asks you to authorize, click **"Authorize"**!)*

  5. **IMPORTANT: Did you get a "404 Bucket does not exist" error?**
     Before Google Cloud Shell can configure your Storage, you must first create your bucket in the Firebase Console:
     * Open the **[Firebase Console](https://console.firebase.google.com/)** in your web browser.
     * Click on your project: **`gen-lang-client-0868734466`**.
     * On the left sidebar, expand **Build** and click **Storage**.
     * Click the blue **"Get Started"** button (choose any security rule options, pick your preferred hosting location, and click **Done**).
     * Wait 5 seconds for the bucket to provision!

  6. Now, run this command in your Cloud Shell terminal to find your exact bucket name:
     ```bash
     gsutil ls
     ```
     *(This will print your bucket name! It will look something like `gs://gen-lang-client-0868734466.appspot.com/` or `gs://gen-lang-client-0868734466.firebasestorage.app/`)*

  7. Finally, apply CORS to that exact printed bucket name:
     ```bash
     gsutil cors set cors.json gs://YOUR_PRINT_OUT_BUCKET_NAME
     ```
     *Example using the appspot bucket name:*
     `gsutil cors set cors.json gs://gen-lang-client-0868734466.appspot.com`
     
  *(Note: To save time, our application includes an **automatic high-compression self-healing fallback**! If Firebase Storage is ever blocked, the system automatically compresses avatars and saves them locally in firestore so profile pictures will still edit and render beautifully immediately!)*

---

## 💻 VS Code Workspace Setup

For the absolute best local development experience inside **VS Code**, apply the following configuration:

### 1. Recommended Extensions
Install these standard extensions from the VS Code Marketplace:
* **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`) — Enables advanced auto-completion, previewing, and syntax checks for responsive layout styles.
* **ESLint** (`dbaeumer.vscode-eslint`) — Integrates automatic syntax compilation warnings and compliance checks right in your code gutters.
* **Prettier - Code formatter** (`esbenp.prettier-vscode`) — Automatically tidies up JSX attributes, spacing, and bracket margins.

### 2. Workspace Optimization Settings
To enable auto-layout-reformatting on single-save sweeps, create a `.vscode/settings.json` file inside your workspace with these options:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

---

## 📦 Production Builds & Compilation Checks

To lint constraints, clean stale assets, and compile the optimized production-ready bundle, execute:

```bash
# Verify TypeScript compile safety and code styles
npm run lint

# Compile and optimize asset pipelines into /dist
npm run build
```

---

## ☁️ Comprehensive Cloud Deployment Guide

The code is pre-configured to be hosted across multiple cloud platforms. Choose the hosting standard that fits your architecture:

---

### Option A: Hosting with Firebase (Recommended)

Since the application utilizes Firebase Firestore rules and persistent stores, Firebase Web Hosting is the easiest target:

#### 1. Setup Firebase CLI locally
If you do not have Firebase tools installed globally:
```bash
npm install -g firebase-tools
firebase login
```

#### 2. Initialize Firebase within folder
Run initialization and link the directory to your target project:
```bash
firebase init
```
* **Firestore**: Select Firestore rules and use existing `firestore.rules` file.
* **Hosting**: Choose `dist` as the public folder, configure it as a single-page app (write `yes` to rewrite all URLs to `/index.html`), and choose not to override existing assets.

#### 3. Deploy Security Rules & Indexes
```bash
npx firebase deploy --only firestore:rules
```

#### 4. Run Build and Deploy Web App
```bash
npm run build
firebase deploy --only hosting
```

---

### Option B: Deploying to Vercel or Netlify

Vercel and Netlify can ingest your GitHub branch directly and compile the code upon every push.

#### Vercel Configuration Check
1. Connect your GitHub repository to [Vercel](https://vercel.com).
2. Set **Framework Preset** to `Vite`.
3. Set **Build Command** override to: `npm run build`
4. Set **Output Directory** to: `dist`
5. Under **Environment Variables**, configure:
   * `GEMINI_API_KEY` *(Optional, secure)*
   * `APP_URL` (Set to your custom deployment domain)
6. Add a custom `vercel.json` file to the root if you need single-page application router rewrites (to route pages such as `/dashboard` inside the SPA):
   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```

#### Netlify Configuration Check
1. Create a site from Git on [Netlify](https://netlify.com).
2. Select build commands:
   * **Build Command**: `npm run build`
   * **Publish Directory**: `dist`
3. Save environment parameters similar to Vercel.
4. Specify redirects by creating a `public/_redirects` file with the following rule:
   ```text
   /*    /index.html   200
   ```

---

### Option C: Containerized Deployment via Docker & GCP Cloud Run

For secure, private VPC container networks, Docker configuration builds are highly effective.

#### 1. Create a `Dockerfile` in the root:
```dockerfile
# Use precise LTS Node Alpine distribution
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Use lightweight runner for served assets
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Custom Nginx configuration to support SPA routing fallback
RUN echo 'server { \
    listen 3000; \
    location / { \
        root /usr/share/nginx/html; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
```

#### 2. Build and Deploy Container on Google Cloud Run:
```bash
# Build the container image securely using Google Cloud Build
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/rosters-app

# Deploy to fully-managed Cloud Run instance, allowing public ingress on port 3000
gcloud run deploy rosters-app \
  --image gcr.io/YOUR_PROJECT_ID/rosters-app \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000
```

---

*Enterprise Scheduling, Attendance Gateways, and SwapBoard Coordination built securely.*
