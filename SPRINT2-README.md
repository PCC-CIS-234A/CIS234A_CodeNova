# Sprint 2 — Send Notification (Multiple Subscriber Lists) + Admin List Creation

**Team CodeNova** — Noah McGarry, Saul Bravo, Maeve Davis  
**Sprint 2 owner:** Saul Bravo  
**Branch:** `Sauls-Sprint-2`

---

## What this sprint does

Managers can send an email to one or more subscriber lists instead of one big list.

Students pick which lists they want when they sign up. They can also change their picks on the profile page.

Managers can make new lists and remove lists from the profile page.

---

## N-tier structure

The app is split into layers. Each layer has a job and we try not to mix them up.

| Layer | Folder | What it does |

| **Application** | `application/` | Routes. Gets the request, calls logic, renders a page or redirects. 
| **Logic** | `logic/` | Business rules. Signup, login, send notification, list stuff. 
| **Data** | `data/` | Talks to SQL Server through Sequelize models. 
| **Models** | `models/` | User class with validation. 
| **Views** | `views/` | EJS pages the user sees. 
| **Public** | `public/` | CSS and client-side JS. 

**Flow example (student saves lists on profile):**

1. Browser posts to `/profile/subscriptions` > `application/app.js`
2. Route calls `logic.updateStudentSubscriptions()` > `logic/logic.js`
3. That calls `subscriberListService.updateUserSubscriptions()` > `logic/subscriberListService.js`
4. Service reads/writes `user_list` table > `data/database.js`

---

## Main Sprint 2 files

**Application layer**
- `application/app.js` — signup, send notification, profile routes

**Logic layer**
- `logic/logic.js` — signup saves lists, send uses list ids, profile helpers
- `logic/subscriberListService.js` — all list CRUD and “who gets the email”

**Data layer**
- `data/database.js` — `SubscriberList` and `UserSubscriberList` models

**Views**
- `views/signup.ejs` — account type dropdown + list checkboxes (students)
- `views/profile.ejs` — student subscriptions / manager list tools
- `views/sendNotification.ejs` — manager picks lists to email
- `views/partials/subscriberListPicker.ejs` — shared list picker (search, sort, show more)
- `views/partials/header.ejs` — profile icon in navbar

**Public**
- `public/signup-role.js` — hide lists unless role is student; require one list
- `public/subscriber-list-picker.js` — search, sort, show more, manager remove button
- `public/styles.css` — profile and list picker styles

---

## Features by role

**Student (subscriber)**
- Pick lists at signup (must pick at least one)
- Profile > check/uncheck lists → Save Subscriptions

**Manager**
- Send Notification → check one or more lists → send email
- Profile > create a list name
- Profile > check lists > Remove Selected (All Subscribers cannot be removed)

**All Subscribers list**
- If a manager checks this list when sending, every student with an email gets the message.

---

## Run the app

```bash
npm install
npm start
```

```bash
npm run dev
```

Open the site in the browser (usually `http://localhost:5000`).

---

## Comments in code

Sprint 2 code is marked with:

```
/* ----- Saul Sprint 2: ... ----- */
/* ----- end Saul Sprint 2 ----- */
```
