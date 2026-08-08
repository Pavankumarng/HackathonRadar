<div align="center">

# 📡 HackathonRadar

### *Every hackathon. One place.*

An autonomous, real-time intelligence dashboard aggregating active hackathons across **Unstop, Devpost, HackerEarth, Devfolio, and HackCulture** — updated automatically on a 12-hour engine.

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-hackathon--radar--alpha.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://hackathon-radar-alpha.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Upstash Redis](https://img.shields.io/badge/Upstash-Redis-00E599?style=for-the-badge&logo=redis&logoColor=white)](https://upstash.com)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-Automated-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/features/actions)

</div>

---

## ✨ Why HackathonRadar?

Finding hackathons across multiple platforms is tedious and noisy. **HackathonRadar** unifies active global hackathons into a single, lightning-fast command dashboard. 

No sign-ups required. No sponsored clutter. Just active hackathons with real-time countdowns and direct application routes.

---

## ⚡ Key Features

* **🤖 100% Autonomous Scraper Pipeline:** GitHub Actions execute headless stealth scrapers every **12 hours** to fetch fresh hackathons and upsert them directly to PostgreSQL.
* **🧹 Smart Deadline Pruning:** Automatically filters out and purges expired events so you only see active opportunities.
* **🎯 Precision Filtering:** Filter instantly by format (**Online**, **Offline/In-Person**, **Hybrid**) or keyword search.
* **🛡️ Rate-Limited Edge Security:** Built-in sliding-window rate limiting via **Upstash Redis** to protect backend APIs against abuse.
* **📊 Privacy-First Web Analytics:** Real-time visitor tracking integrated natively with **Vercel Analytics**.

---

## 🏗️ System Architecture

```text
  [ Unstop / Devpost / HackerEarth / Devfolio / HackCulture ]
                             │
                  (Scheduled Cron Job - 12h)
                             │
                             ▼
                 [ 🤖 GitHub Actions Scraper ]
                             │
                             ▼
               [ 🐘 Supabase PostgreSQL DB ]
                             │
               (Indexed Queries / Auto-Pruning)
                             │
                             ▼
     [ ⚡ Next.js App Router + Upstash Redis Rate Limiter ]
                             │
                             ▼
               [ 🚀 Deployed on Vercel Edge ]
