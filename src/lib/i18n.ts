import { useSyncExternalStore } from "react";

export const LANGS = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "si", label: "සිංහල", flag: "🇱🇰" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
] as const;

export type LangCode = (typeof LANGS)[number]["code"];

const KEY = "foxfarm.lang";
const listeners = new Set<() => void>();

export function getLang(): LangCode {
  if (typeof window === "undefined") return "en";
  const v = window.localStorage.getItem(KEY);
  return (LANGS.some((l) => l.code === v) ? v : "en") as LangCode;
}

export function setLang(code: LangCode) {
  window.localStorage.setItem(KEY, code);
  listeners.forEach((l) => l());
}

export function useLang(): LangCode {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getLang,
    () => "en" as LangCode,
  );
}

type Dict = Record<string, string>;

const en: Dict = {
  farm: "Farm",
  tasks: "Tasks",
  ads: "Ads",
  refer: "Refer",
  profile: "Profile",
  wallet: "Wallet (USDT BEP-20)",
  transactions: "Transactions",
  referFriends: "Refer friends",
  leaderboard: "Leaderboard",
  communityChannel: "Community channel",
  paymentChannel: "Payment channel",
  notifications: "Notifications",
  language: "Language",
  about: "About Fox Farm",
  finance: "Finance",
  social: "Social",
  community: "Community",
  preferences: "Preferences",
  back: "Back",
  save: "Save",
  saved: "Saved!",
};

const si: Dict = {
  farm: "ගොවිපළ",
  tasks: "කාර්යයන්",
  ads: "දැන්වීම්",
  refer: "යාළුවන්",
  profile: "පැතිකඩ",
  wallet: "මුදල් පසුම්බිය (USDT BEP-20)",
  transactions: "ගනුදෙනු",
  referFriends: "යාළුවන්ට ආරාධනා",
  leaderboard: "ශ්‍රේණිගත කිරීම",
  communityChannel: "ප්‍රජා නාලිකාව",
  paymentChannel: "ගෙවීම් නාලිකාව",
  notifications: "දැනුම්දීම්",
  language: "භාෂාව",
  about: "Fox Farm ගැන",
  finance: "මුදල්",
  social: "සමාජ",
  community: "ප්‍රජාව",
  preferences: "මනාපයන්",
  back: "ආපසු",
  save: "සුරකින්න",
  saved: "සුරැකිණි!",
};

const ru: Dict = {
  farm: "Ферма",
  tasks: "Задания",
  ads: "Реклама",
  refer: "Друзья",
  profile: "Профиль",
  wallet: "Кошелёк (USDT BEP-20)",
  transactions: "Транзакции",
  referFriends: "Пригласить друзей",
  leaderboard: "Рейтинг",
  communityChannel: "Канал сообщества",
  paymentChannel: "Канал выплат",
  notifications: "Уведомления",
  language: "Язык",
  about: "О Fox Farm",
  finance: "Финансы",
  social: "Социальное",
  community: "Сообщество",
  preferences: "Настройки",
  back: "Назад",
  save: "Сохранить",
  saved: "Сохранено!",
};

const tr: Dict = {
  farm: "Çiftlik",
  tasks: "Görevler",
  ads: "Reklamlar",
  refer: "Davet",
  profile: "Profil",
  wallet: "Cüzdan (USDT BEP-20)",
  transactions: "İşlemler",
  referFriends: "Arkadaş davet et",
  leaderboard: "Sıralama",
  communityChannel: "Topluluk kanalı",
  paymentChannel: "Ödeme kanalı",
  notifications: "Bildirimler",
  language: "Dil",
  about: "Fox Farm Hakkında",
  finance: "Finans",
  social: "Sosyal",
  community: "Topluluk",
  preferences: "Tercihler",
  back: "Geri",
  save: "Kaydet",
  saved: "Kaydedildi!",
};

const ar: Dict = {
  farm: "المزرعة",
  tasks: "المهام",
  ads: "الإعلانات",
  refer: "الدعوة",
  profile: "الملف الشخصي",
  wallet: "المحفظة (USDT BEP-20)",
  transactions: "المعاملات",
  referFriends: "ادعُ الأصدقاء",
  leaderboard: "المتصدرون",
  communityChannel: "قناة المجتمع",
  paymentChannel: "قناة الدفعات",
  notifications: "الإشعارات",
  language: "اللغة",
  about: "حول Fox Farm",
  finance: "المالية",
  social: "اجتماعي",
  community: "المجتمع",
  preferences: "التفضيلات",
  back: "رجوع",
  save: "حفظ",
  saved: "تم الحفظ!",
};

const DICTS: Record<LangCode, Dict> = { en, si, ru, tr, ar };

export function t(lang: LangCode, key: keyof typeof en): string {
  return DICTS[lang][key] ?? en[key] ?? key;
}
