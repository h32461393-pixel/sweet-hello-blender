# Fox Farm නොමිලේ Vercel වෙත යෙදවීම

## ඉලක්කය
Vercel free plan එක සහ user-owned free backend එක භාවිතා කර Fox Farm app එක ක්‍රියාත්මක කිරීම. Lovable paid plan එකක් අවශ්‍ය නොවන ලෙස සැකසීම.

## ක්‍රියාමාර්ග
1. **TypeScript දෝෂය**
   - `src/hooks/use-mobile.tsx` පරීක්ෂා කර React import එක නිවැරදි බව සහ සම්පූර්ණ project type-check එක සාර්ථක බව තහවුරු කිරීම.

2. **Vercel build configuration**
   - Production build එකේ Nitro `vercel` preset භාවිතා කරන ලෙස Vite configuration එක වෙනස් කිරීම.
   - Vercel සඳහා අවශ්‍ය build/output සැකසුම් සහ deployment උපදෙස් එක් කිරීම.

3. **Free backend migration guide**
   - දැනට Lovable Cloud හි ඇති database schema එක user-owned free backend project එකකට යෙදවීමට SQL migration එක භාවිතා කරන ක්‍රමය ලිවීම.
   - FOX balance, mining, rewards සහ admin operations server-side පමණක් තබා zero-trust ආරක්ෂාව රැකීම.

4. **Environment variables template**
   - රහස් values code එකට නොදමා `.env.example` එකක් සකස් කිරීම.
   - Vercel තුළ අවශ්‍ය public URL/key, private server key, Telegram bot token සහ webhook secret යන සියල්ල පැහැදිලි කිරීම.
   - සැබෑ private server key එක user-owned backend project එකෙන් පමණක් ලබාගත යුතුය; Lovable Cloud private key එක export නොකරයි.

5. **Telegram webhook setup**
   - Deployment එකෙන් පසු Vercel URL එක භාවිතා කර Telegram webhook එක සුරක්ෂිතව set කරන command/template එක ලබාදීම.

6. **Validation**
   - Type-check සහ Vercel-targeted production build එක සාර්ථකද පරීක්ෂා කිරීම.
   - රහස් values repository එකට ඇතුළත් නොවූ බව තහවුරු කිරීම.

## ඔබට අවසානයේ ලැබෙන්නේ
- Vercel-ready Fox Farm source code
- copy කර භාවිතා කළ හැකි environment variable template එක
- free backend schema setup සහ Telegram webhook සඳහා සිංහල deployment guide එක

## සීමාව
Lovable Cloud හි private admin key එක පිටතට ලබාගත නොහැක. එබැවින් Vercel deployment එක සඳහා user-owned free backend project එකක් සහ එහි private server key එක අවශ්‍ය වේ; එය මුදල් ගෙවීමකින් තොරව free tier එකෙන් කළ හැක.
