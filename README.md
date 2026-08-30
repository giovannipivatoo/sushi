# Maki a Choice 🍣

A playful Google Maps-powered picker for finding, shortlisting, and choosing a sushi restaurant in any city, neighborhood, or region.

## What it does

- Searches live sushi restaurants in a chosen geographic area with Google Maps and Places
- Filters by rating and whether a restaurant is open
- Saves a shortlist in the browser
- Randomly picks from the shortlist when nobody wants to make the final call
- Falls back to a polished demo experience before an API key is configured

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add your key to `.env.local` as `VITE_GOOGLE_MAPS_API_KEY`. In Google Cloud, enable **Maps JavaScript API** and **Places API (New)**. The key is intentionally used client-side, so restrict it by HTTP referrer to your local and GitHub Pages URLs.

## Publish with GitHub Pages

The workflow in `.github/workflows/deploy.yml` publishes every push to `main`.

1. In the repository, open **Settings → Secrets and variables → Actions**.
2. Add a repository secret named `GOOGLE_MAPS_API_KEY`.
3. Under **Settings → Pages**, choose **GitHub Actions** as the source.
4. Push to `main`, or run the workflow manually.

The production URL will be `https://<your-github-username>.github.io/sushi/`.

## Google Maps setup

Restrict the API key to these referrers (adjust the username):

```text
http://localhost:5173/*
https://<your-github-username>.github.io/sushi/*
```

Do not commit `.env.local`; Vite environment files are ignored by Git.
