# Financial Wellness Platform

A simple Node.js, Express, MySQL, HTML, CSS, and JavaScript application for local testing in VS Code. XAMPP supplies MySQL; Node.js serves the website and API.

## Run it

1. Open XAMPP Control Panel and start **MySQL**. Apache is not required.
2. Open `http://localhost/phpmyadmin` and import `sql/database.sql`.
3. In VS Code, copy `.env.example` to `.env`. XAMPP normally uses user `root` with a blank password.
4. Open a terminal in this folder and run `npm install`.
5. Run `npm start`.
6. Open `http://localhost:3000`.

Register a new account first. After registration, add income and expenses and test the debt payoff calculator.
