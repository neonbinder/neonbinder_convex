# Welcome to your Convex + Next.js + Convex Auth app

This is a [Convex](https://convex.dev/) project created with [`npm create convex`](https://www.npmjs.com/package/create-convex).

After the initial setup (<2 minutes) you'll have a working full-stack app using:

- Convex as your backend (database, server logic)
- [React](https://react.dev/) as your frontend (web page interactivity)
- [Next.js](https://nextjs.org/) for optimized web hosting and page routing
- [Tailwind](https://tailwindcss.com/) for building great looking accessible UI
- [Convex Auth](https://labs.convex.dev/auth) for authentication
- Google Cloud Secret Manager for secure credential storage

## Google Cloud Secret Manager Setup

This project uses Google Cloud Secret Manager to securely store user credentials for various sports card platforms. To set up:

1. **Install Google Cloud CLI** and authenticate:
   ```bash
   gcloud auth login
   gcloud config set project neonbinder
   ```

2. **Enable Secret Manager API**:
   ```bash
   gcloud services enable secretmanager.googleapis.com
   ```

3. **Create Service Account** (already done):
   ```bash
   gcloud iam service-accounts create neonbinder-convex --display-name="NeonBinder Convex Backend"
   gcloud projects add-iam-policy-binding neonbinder --member="serviceAccount:neonbinder-convex@neonbinder.iam.gserviceaccount.com" --role="roles/secretmanager.admin"
   ```

4. **Download Service Account Key** (already done):
   ```bash
   gcloud iam service-accounts keys create ~/.config/gcloud/neonbinder-convex-key.json --iam-account=neonbinder-convex@neonbinder.iam.gserviceaccount.com
   ```

5. **Set Environment Variable** for local development:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.config/gcloud/neonbinder-convex-key.json"
   ```

For production deployment, you'll need to configure the service account credentials in your Convex deployment environment.

## Browser Service Requirement

This project uses a separate browser service for interacting with certain sports card platforms (like BuySportsCards). To test credentials for these platforms, you need to have the browser service running locally:

1. **Navigate to the browser service directory**:
   ```bash
   cd ../neonbinder_browser
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the browser service**:
   ```bash
   npm start
   ```

The browser service will run on http://localhost:8080 by default. You can configure a different URL by setting the `NEONBINDER_BROWSER_URL` environment variable in your Convex environment.

## Get started

If you just cloned this codebase and didn't use `npm create convex`, run:

```
npm install
npm run dev
```

If you're reading this README on GitHub and want to use this template, run:

```
npm create convex@latest -- -t nextjs-convexauth
```

## Learn more

To learn more about developing your project with Convex, check out:

- The [Tour of Convex](https://docs.convex.dev/get-started) for a thorough introduction to Convex principles.
- The rest of [Convex docs](https://docs.convex.dev/) to learn about all Convex features.
- [Stack](https://stack.convex.dev/) for in-depth articles on advanced topics.
- [Convex Auth docs](https://labs.convex.dev/auth) for documentation on the Convex Auth library.

## Configuring other authentication methods

To configure different authentication methods, see [Configuration](https://labs.convex.dev/auth/config) in the Convex Auth docs.

## Join the community

Join thousands of developers building full-stack apps with Convex:

- Join the [Convex Discord community](https://convex.dev/community) to get help in real-time.
- Follow [Convex on GitHub](https://github.com/get-convex/), star and contribute to the open-source implementation of Convex.
