# Renting Watcher Project Overview

## Purpose
A rental property scraper that monitors Suumo and Nifty real estate websites for new rental properties and sends Slack notifications when new properties are found.

## Tech Stack
- **Language**: TypeScript/Node.js
- **Database**: Supabase (free tier)
- **Notifications**: Slack webhooks
- **Automation**: GitHub Actions
- **Scraping**: Axios + Cheerio

## Main Features
- Scrapes multiple real estate websites (Suumo, Nifty)
- Stores property data in Supabase database
- Detects new properties and sends Slack notifications
- Runs automatically via GitHub Actions every hour from 8 AM to 10 PM JST

## Key Dependencies
- `@supabase/supabase-js`: Database operations
- `axios`: HTTP requests for scraping
- `cheerio`: HTML parsing
- `dotenv`: Environment variable management