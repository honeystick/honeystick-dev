# Project Setup & Testing Guide

## 🚀 Getting Started

```bash
npm install
npm run dev
```

### Node version

```bash
nvm use
node -v // v24.12.0
```

If you dont have the node version. Please install with your favourite node package manager. [node](https://nodejs.org/en/download)

## 🧪 Testing

### Run Tests

To ensure test execution works, please have playwright installed with mock browsers.

Run this command in your terminal. This will download Chrome for Testing browsers (169mb).

```bash
npx playwright install
```

Execute the test suite:

Please expect msedge tests to fail. The plugin would not be installed.

```bash
npm run test
```

### View Test Report

After running tests, view the detailed report:

> **Note:** If the report doesn't automatically open in your browser, run the command above manually.

```bash
npx playwright show-report
```

---

## 📝 Additional Notes

- Make sure all dependencies are installed before running tests. There are 2 moderate vulnerabilities that you can ignore.
- The test report provides detailed insights into test execution and failures.
- AI was not used in writing this webapp except to assist with debugging issues. I used it as I would Stack Overflow or Googling a problem. I did not use AI integrated IDE's such as Cursor.
- 1% of this code was AI generated.
- AI Code was reviewed and edited for this project.
