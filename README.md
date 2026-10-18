Shadow-Pool — Trade the Invisible
A responsive paper-trading simulator built with plain HTML, CSS, and JavaScript. It is intended for UI/UX demonstrations and learning about simulated trade execution.
Run locally
1. Keep index.html, style.css, and script.js in the same folder.
2. Open index.html in a modern browser, or use VS Code Live Server.
3. Internet access is used for Google Fonts and the optional Phantom provider script. The core simulator does not require a build step.
Included
- Responsive trading dashboard and illustrative simulated price chart
- Virtual starting balance of $10,000
- Simulated buy/sell orders with validation and execution slippage
- Trade history and session persistence in browser local storage
- Local browser leaderboard (not global)
- Optional Phantom wallet connection
Important limitations
- No real orders, payments, token transfers, or blockchain transactions are submitted.
- The price chart is randomly generated illustrative data, not a live market feed.
- The Phantom connection only identifies the connected public key in the interface. It does not make trades private or execute Arcium computations.
- The leaderboard is stored in the current browser and is not shared across users or devices.
- This is an educational demo, not financial advice.
Files
- index.html — semantic app structure
- style.css — responsive visual system
- script.js — simulator logic and browser persistence
