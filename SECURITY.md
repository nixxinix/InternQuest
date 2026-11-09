# Security Policy

InternQuest handles sign-in details and job-search data, so security reports are taken seriously.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Use GitHub's private reporting instead: go to the **Security** tab of this repository and choose **Report a vulnerability**.

Include what you found, how to reproduce it, and the impact if you can tell. You'll get a reply as soon as possible. This is a student-run project, so please allow a few days.

## What counts

Examples we care about: ways to fake EXP or leaderboard rankings, reading another user's data (row-level security bypass), exposed API keys, open redirects through `/go/:id`, and injection or XSS.

## Not in the repo, ever

Real keys and secrets are never committed. `.env.local` is git-ignored and `.env.example` only documents variable names. If you spot a real secret in the history, please report it privately.
