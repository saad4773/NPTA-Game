# NPTA-Game 🎮

Name • Place • Animal • Thing — private online multiplayer word game.

## Abhi kya ban chuka hai (Step 3: Real Multiplayer)

- ✅ Landing page (`public/index.html`) — Create Room / Join Room UI
- ✅ Design system (`public/style.css`) — dark playful theme, category colors
- ✅ Game interface — waiting room, letter reveal, live countdown timer, answer form, results
- ✅ **Real multiplayer (Socket.io)** — server par asli rooms banayenge:
  - Room create karne par server se asli room code milta hai
  - Doosra device/browser usi code se join kar sakta hai
  - Players ki list sab ke liye live update hoti hai
  - Sirf **host** hi "Game Start" kar sakta hai
  - Server letter aur timer control karta hai — sab players ko sync mila
  - Jab sab players submit kar dein (ya time khatam ho), sab ko results milte hain jisme har player ke jawab dikhte hain
- ✅ **Smart Checking (Step 4)** — server ab har jawab check karta hai:
  - Answer sahi letter se start na ho ya khaali ho → 0 points ("invalid"/"empty")
  - Sahi letter se ho lekin kisi aur player ne bhi wahi jawab diya ho → 5 points ("duplicate")
  - Sahi letter se ho aur sirf isi player ne diya ho → 10 points ("unique")
  - Results screen pe har jawab ke sath uska status aur points dikhte hain, aur har player ka total score bhi dikhta hai (sabse zyada score wala sabse upar, 🏆 ke sath)
- ✅ **Multiple Rounds + STOP button (Step 5)**:
  - **STOP button** — koi bhi player round beech mein khatam karwa sakta hai (traditional NPTA jaisa "STOP" bolna). Uske apne jawab (jo tab tak likhe the) record ho jaate hain, aur round turant sabke liye khatam ho jaata hai
  - **Round counter** — har round ka number screen pe dikhta hai (Round 1, Round 2, …)
  - **Overall Leaderboard** — har round ke baad cumulative score dikhta hai (🥇🥈🥉ke saath), jo poore game (jab tak room khula hai) ke through carry hota hai. "Naya Round" dabane pe agla round shuru hota hai aur scores add hote rehte hain

## VS Code mein kaise chalayen

1. Is `NPTA-Game` folder ko VS Code mein open karo (`File → Open Folder`)
2. Terminal kholo (`Ctrl + ~` ya `View → Terminal`)
3. Ye command chalao (sirf pehli dafa):
   ```
   npm install
   ```
4. Server start karo:
   ```
   npm start
   ```
5. Browser mein kholo: **http://localhost:3000**

Har baar file change karne ke baad, terminal mein `Ctrl+C` se server band karke `npm start` dobara chalana hoga (jab tak hum `nodemon` add nahi karte — wo bhi aage aa sakta hai).

## Next steps (roadmap)

1. ~~Folder + basic website~~ ✅
2. ~~Game interface — letter reveal, answer form, timer countdown~~ ✅
3. ~~Multiplayer — Socket.io se room create/join, players list live update, host controls~~ ✅ (abhi yehi hua hai)
4. ~~Smart checking — duplicate detection, letter validity check, scoring~~ ✅ (abhi yehi hua hai)
5. ~~Leaderboard, multiple rounds, STOP button~~ ✅ (abhi yehi hua hai)
6. Free hosting pe deploy (Render.com ya Glitch — dono free)
7. (Optional future) Wildcard rounds, emoji reactions, reconnect handling

## Multiplayer test kaise karein (2 devices se)

1. Laptop pe `npm start` chalao
2. Terminal mein `ipconfig` (Windows) chalao, apna local IP dekho (jaise `192.168.1.5`)
3. Doosre device (phone/laptop) pe, jo **same WiFi** pe ho, browser mein kholo: `192.168.1.5:3000`
4. Ek device pe "Room Banao", doosre pe usi code se "Room Join Karo"
5. Ab dono ek hi room mein honge — player list dono taraf live update hogi!

## Free hosting (jab ready ho)

- **Render.com** — GitHub repo connect karo, free web service ban jaata hai, link auto milta hai
- **Glitch.com** — seedha browser mein bhi project import ho sakta hai

Dono options free hain, koi credit card nahi chahiye.
