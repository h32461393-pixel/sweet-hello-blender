import { useSyncExternalStore } from "react";

export const LANGS = [
  { code: "en", label: "English", native: "English", flag: "🇺🇸" },
  { code: "si", label: "සිංහල", native: "Sinhala", flag: "🇱🇰" },
  { code: "ru", label: "Русский", native: "Russian", flag: "🇷🇺" },
  { code: "uk", label: "Українська", native: "Ukrainian", flag: "🇺🇦" },
  { code: "fr", label: "Français", native: "French", flag: "🇫🇷" },
  { code: "ar", label: "العربية", native: "Arabic", flag: "🇸🇦" },
  { code: "fa", label: "فارسی", native: "Persian", flag: "🇮🇷" },
  { code: "id", label: "Bahasa Indonesia", native: "Indonesian", flag: "🇮🇩" },
  { code: "tr", label: "Türkçe", native: "Turkish", flag: "🇹🇷" },
  { code: "vi", label: "Tiếng Việt", native: "Vietnamese", flag: "🇻🇳" },
  { code: "es", label: "Español", native: "Spanish", flag: "🇪🇸" },
  { code: "mx", label: "Español (MX)", native: "Spanish (MX)", flag: "🇲🇽" },
  { code: "pt", label: "Português", native: "Portuguese", flag: "🇵🇹" },
  { code: "ur", label: "اردو", native: "Urdu", flag: "🇵🇰" },
  { code: "fil", label: "Filipino", native: "Filipino", flag: "🇵🇭" },
] as const;

export const LANG_PICKED_KEY = "foxfarm.lang.picked";
export function hasPickedLang(): boolean {
  try {
    return !!window.localStorage.getItem(LANG_PICKED_KEY);
  } catch {
    return true;
  }
}

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
  window.localStorage.setItem(LANG_PICKED_KEY, "1");
  document.documentElement.dir = ["ar", "fa", "ur"].includes(code) ? "rtl" : "ltr";
  document.documentElement.lang = code;
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

const tabs = (farm: string, tasks: string, ads: string, refer: string, profile: string, language: string, back: string, save: string): Dict => ({ farm, tasks, ads, refer, profile, language, back, save });
const uk = tabs("Ферма", "Завдання", "Реклама", "Друзі", "Профіль", "Мова", "Назад", "Зберегти");
const fr = tabs("Ferme", "Tâches", "Pubs", "Inviter", "Profil", "Langue", "Retour", "Enregistrer");
const fa = tabs("مزرعه", "وظایف", "تبلیغات", "دعوت", "پروفایل", "زبان", "بازگشت", "ذخیره");
const id = tabs("Kebun", "Tugas", "Iklan", "Undang", "Profil", "Bahasa", "Kembali", "Simpan");
const vi = tabs("Nông trại", "Nhiệm vụ", "Quảng cáo", "Mời", "Hồ sơ", "Ngôn ngữ", "Quay lại", "Lưu");
const es = tabs("Granja", "Tareas", "Anuncios", "Invitar", "Perfil", "Idioma", "Atrás", "Guardar");
const pt = tabs("Fazenda", "Tarefas", "Anúncios", "Convidar", "Perfil", "Idioma", "Voltar", "Salvar");
const ur = tabs("فارم", "کام", "اشتہارات", "دعوت", "پروفائل", "زبان", "واپس", "محفوظ کریں");
const fil = tabs("Bukid", "Gawain", "Ads", "Imbita", "Profile", "Wika", "Bumalik", "I-save");

const DICTS: Record<LangCode, Dict> = { en, si, ru, tr, ar, uk, fr, fa, id, vi, es, mx: es, pt, ur, fil };

export function t(lang: LangCode, key: keyof typeof en): string {
  return DICTS[lang][key] ?? en[key] ?? key;
}
