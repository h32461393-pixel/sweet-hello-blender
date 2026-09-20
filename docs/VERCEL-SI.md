# Fox Farm — නොමිලේ Vercel වෙත host කිරීම

මෙම app එකේ screen පමණක් නොව mining, rewards සහ Telegram webhook වැනි server වැඩද තිබෙන නිසා Vercel සහ වෙනම free backend project එකක් දෙකම අවශ්‍ය වේ.

## 1. ආරක්ෂක පියවර

කලින් chat එකක bot token එකක් share කළේ නම් BotFather හරහා එය revoke කර අලුත් token එකක් සාදන්න. Private server key සහ bot token GitHub වෙත upload නොකරන්න.

## 2. Free backend project එක සකස් කිරීම

1. ඔබට අයිති, Postgres සහ `SUPABASE_*` keys ලබාදෙන free backend project එකක් සාදන්න.
2. එහි SQL editor එක තුළ `drizzle/migrations/0000_fox_farm_core.sql` file එකේ සම්පූර්ණ SQL එක run කරන්න.
3. Project URL, public publishable key සහ private server/service-role key එක copy කර ආරක්ෂිතව තබන්න.
4. Private server key එක browser variable එකකට හෝ `VITE_` prefix එකක් සහිත variable එකකට දමන්න එපා.

Migration එක tables, grants, row-level security සහ server-side balance function එක එකවර සකස් කරයි.

## 3. GitHub සහ Vercel

1. Project code එක private GitHub repository එකකට push කරන්න.
2. Vercel හි **Add New → Project** තෝරා repository එක import කරන්න.
3. Framework සහ build settings auto-detect වීමට ඉඩ දෙන්න. Custom output directory එකක් දමන්න එපා.
4. **Settings → Environment Variables** තුළ පහත values Production, Preview සහ Development සඳහා එක් කරන්න.

| Variable | දමන්න ඕන value එක |
|---|---|
| `VITE_SUPABASE_URL` | ඔබේ free backend Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | public/publishable key |
| `SUPABASE_URL` | ඉහත Project URL එකම |
| `SUPABASE_PUBLISHABLE_KEY` | ඉහත public key එකම |
| `SUPABASE_SERVICE_ROLE_KEY` | private server/service-role key |
| `TELEGRAM_BOT_TOKEN` | BotFather වෙතින් ගත් අලුත් bot token එක |
| `TELEGRAM_WEBHOOK_SECRET` | ඔබම සෑදූ දිගු random secret එක |

`VITE_SUPABASE_PROJECT_ID` සහ `SUPABASE_PROJECT_ID` මෙම code එකට අවශ්‍ය නැත.

Random webhook secret එකක් local computer එකේ සාදාගැනීමට:

```sh
openssl rand -hex 32
```

Vercel deploy එක අවසන් වූ පසු ඔබට `https://YOUR-APP.vercel.app` වැනි URL එකක් ලැබේ.

## 4. Telegram Mini App URL එක

Admin panel එක භාවිතා කිරීමට Vercel Environment Variables තුළ පහත server-only values දෙකත් එකතු කරන්න:

```text
ADMIN_PANEL_USER=ඔබගේ admin username එක
ADMIN_PANEL_PASSWORD=ශක්තිමත්, වෙනත් තැනක භාවිතා නොකළ password එකක්
```

මේ දෙකට `VITE_` prefix එක යොදන්න එපා. සැබෑ values GitHub හෝ `.env.example` තුළ save නොකරන්න.

BotFather තුළ Mini App/Web App URL එක මෙලෙස සකසන්න:

```text
https://YOUR-APP.vercel.app
```

## 5. Telegram webhook එක සම්බන්ධ කිරීම

Terminal එකේ පහත command run කරන්න. සැබෑ secrets command history එකේ save නොවීමට temporary variables භාවිතා කර පසුව unset කරන්න.

```sh
read -s BOT_TOKEN
read -s WEBHOOK_SECRET
APP_URL="https://YOUR-APP.vercel.app"

curl -sS "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=${APP_URL}/api/public/telegram/webhook" \
  --data-urlencode "secret_token=${WEBHOOK_SECRET}"

unset BOT_TOKEN WEBHOOK_SECRET APP_URL
```

Telegram webhook response එකේ `"ok":true` පෙන්විය යුතුය.

## 6. පරීක්ෂා කිරීම

1. Telegram තුළ bot එකට `/start` යවන්න.
2. **Open Mini App** button එකෙන් app එක විවෘත කරන්න.
3. Mining start/claim, daily reward සහ channel tasks පරීක්ෂා කරන්න.
4. Vercel හි error එකක් නම් මුලින් Environment Variables සියල්ල නිවැරදිද සහ redeploy කළාද බලන්න.

## වැදගත්

දැනට Lovable Cloud හි ඇති private admin key එක export කළ නොහැක. එම නිසා Vercel සඳහා ඔබට අයිති free backend project එකේ keys භාවිතා කළ යුතුය. `.env.example` එක values වල නම් පෙන්වීමට පමණි; සැබෑ secrets එයට ලියා commit නොකරන්න.