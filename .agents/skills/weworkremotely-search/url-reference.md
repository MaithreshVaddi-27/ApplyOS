# We Work Remotely Endpoint & URL Reference

## Overview

[We Work Remotely](https://weworkremotely.com) is one of the largest remote work communities and job boards globally. WWR provides public RSS feeds for its job categories and full listings, which supply real-time job postings with descriptions, tags, company names, candidate regions, and publication timestamps.

## RSS Endpoints

| Category | Endpoint URL | Description |
|----------|--------------|-------------|
| **All Remote Jobs** | `https://weworkremotely.com/remote-jobs.rss` | Latest remote jobs across all categories |
| **Full-Stack Programming** | `https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss` | Full-stack developer & engineer roles |
| **Front-End Programming** | `https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss` | Front-end UI/UX & web developer roles |
| **Back-End Programming** | `https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss` | Back-end API, server, and systems roles |
| **DevOps & Sysadmin** | `https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss` | DevOps, cloud infrastructure, SRE, and sysadmin |
| **Design** | `https://weworkremotely.com/categories/remote-design-jobs.rss` | UI/UX, product design, and graphic design |
| **Product** | `https://weworkremotely.com/categories/remote-product-jobs.rss` | Product managers, technical PMs, owners |
| **Management & Finance** | `https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss` | Engineering management, leadership, finance |
| **Customer Support** | `https://weworkremotely.com/categories/remote-customer-support-jobs.rss` | Support engineering, customer success |
| **Sales & Marketing** | `https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss` | Developer relations, growth, marketing |
| **All Other Remote** | `https://weworkremotely.com/categories/all-other-remote-jobs.rss` | General remote and interdisciplinary roles |

## RSS Item Fields

Each `<item>` in the RSS feed contains:
- `<title>`: `Company: Role Title` (e.g. `Lemon.io: Senior Java & React Developer`)
- `<region>`: Region eligibility (e.g. `Anywhere in the World`, `USA Only`, `Europe Only`)
- `<country>`: Country restriction or list of eligible countries
- `<state>`: State/province restriction
- `<skills>`: Skills and technology keywords separated by commas/and
- `<category>`: Job category
- `<type>`: Employment type (`Full-Time`, `Contract`, etc.)
- `<description>`: Complete HTML job description
- `<pubDate>`: Publication date (RFC 2822 format)
- `<guid>` / `<link>`: Canonical job listing URL (e.g. `https://weworkremotely.com/remote-jobs/<slug>`)

## Access & Rate Limits

- RSS feeds are publicly accessible without authentication or API keys.
- User-Agent header standard: `Mozilla/5.0 (compatible; weworkremotely-cli/1.0)`.
- Requests should use exponential backoff and maintain low query volume for personal job search use.
