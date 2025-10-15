🕶️ Dark Pool Trading Simulator

A gamified, neon-lit trading simulator built to showcase how dark pool trading and privacy preserving blockchain interactions can work together using a simulated Arcium Privacy SDK integration.

Trade in hidden order books, connect your Phantom Wallet, and compete on the leaderboard all without exposing private user data.



🚀 Features

Dark Pool Trade Simulation Hidden price execution with random spread.

Phantom Wallet Connection (Simulated) — Test Solana wallet logic.

Leaderboard System — Tracks top traders using local storage.

Arcium Privacy SDK Integration (Demo) — Simulated privacy actions for trades.

Responsive UI — Built with pure HTML, CSS, and vanilla JavaScript.




🧩 Folder Structure

shadowdex/
└─ client/
   ├─ index.html      # main web app
   ├─ script.js       # trading + privacy logic
   ├─ styles.css      # neon-themed styling
   └─ README.md       # documentation



⚙️ Getting Started

Option 1 — Online Preview

You can upload this folder to:

GitHub Pages

Replit

CodeSandbox


It will run instantly without any dependencies.

Option 2 — Local Preview

1. Open the client folder.


2. Double-click index.html.


3. The app will open in your browser automatically.



You can then simulate trades and view your leaderboard progress.



🧠 How It Works

When you press Connect Wallet, it simulates connecting to Phantom.

When you Execute Trade, it performs a fake dark pool trade (randomized price).

Results are saved locally and displayed in the Leaderboard.

If a wallet is connected, a simulated Arcium SDK call is logged in the console.



🔐 Arcium Privacy SDK Integration (Demo)

This demo includes a simulated Arcium Privacy SDK function (arciumSendPrivateAction) that logs actions as if they were sent privately.

When the official Arcium SDK becomes available, this function can be replaced with the real privacy-preserving API call.

No real user data or wallet addresses are sent or exposed in this demo.


📌 Privacy Notice

This demo app stores gameplay and trading history only on your device (local storage).
No personal information or wallet addresses are shared or made public.

For a full version, Arcium privacy SDK will be integrated to:

Encrypt user actions and wallet addresses

Store game and trading data in privacy-preserving smart contracts

Ensure compliance with privacy regulations


⚠️ No user data is exposed in this demo.


---

🧰 Tech Stack

HTML5 + CSS3

Vanilla JavaScript (ES6)

Phantom Wallet (Solana.js)

Arcium SDK (Simulated Integration)


🧑‍💻 Developer Info

Built by: @Senseii_ciel
Discord: https://discord.com/users/1305099867126759516
GitHub: ozzy-sensei


🪪 License

MIT License © 2025 — Arcium Dark Pool Trading Simulator
For demonstration and educational purposes only.
