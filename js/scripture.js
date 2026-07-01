const FALLBACK_SCRIPTURES = [
  { reference: "Isaiah 41:10", text: "Do not be afraid, for I am with you. Do not be anxious, for I am your God. I will fortify you, yes, I will help you, I will really hold on to you with my right hand of righteousness.", theme: "courage" },
  { reference: "Philippians 4:6-7", text: "Do not be anxious over anything, but in everything by prayer and supplication along with thanksgiving, let your petitions be made known to God; and the peace of God that surpasses all understanding will guard your hearts and your mental powers.", theme: "peace" },
  { reference: "Lamentations 3:22-23", text: "It is through Jehovah's loyal love that we are not consumed, for his mercies never end. They are new every morning. Your faithfulness is great.", theme: "mercy" },
  { reference: "Psalm 34:18", text: "Jehovah is close to the brokenhearted; he saves those who are crushed in spirit.", theme: "comfort" },
  { reference: "Proverbs 3:5-6", text: "Trust in Jehovah with all your heart, and do not rely on your own understanding. In all your ways take notice of him, and he will make your paths straight.", theme: "trust" },
  { reference: "Jeremiah 29:11", text: "For I well know the thoughts that I am thinking toward you, declares Jehovah, thoughts of peace, and not of calamity, to give you a future and a hope.", theme: "hope" },
  { reference: "Isaiah 40:31", text: "But those hoping in Jehovah will regain power. They will soar on wings like eagles. They will run and not grow weary; they will walk and not tire out.", theme: "strength" },
  { reference: "Psalm 37:4", text: "Find exquisite delight in Jehovah, and he will grant you the desires of your heart.", theme: "joy" },
  { reference: "Matthew 11:28", text: "Come to me, all you who are toiling and loaded down, and I will refresh you.", theme: "rest" },
  { reference: "Psalm 118:24", text: "This is the day that Jehovah has made. We will be joyful and rejoice in it.", theme: "joy" },
  { reference: "Romans 15:13", text: "May the God who gives hope fill you with all joy and peace by your trusting in him, so that you may abound in hope with power of holy spirit.", theme: "hope" },
  { reference: "Zephaniah 3:17", text: "Jehovah your God is in your midst; as a mighty one, he will save you. He will rejoice over you with great joy.", theme: "love" },
  { reference: "Psalm 139:14", text: "I praise you because in an awe-inspiring way I am wonderfully made. Your works are wonderful; I know this very well.", theme: "identity" },
  { reference: "Isaiah 43:4", text: "Because you have been precious in my eyes, you have been honored, and I have loved you.", theme: "love" },
];

let scriptureList = [];

async function loadScriptures() {
  try {
    const res = await fetch('./data/scriptures.json');
    if (!res.ok) throw new Error('fetch failed');
    scriptureList = await res.json();
  } catch {
    scriptureList = FALLBACK_SCRIPTURES;
  }
}

function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

function getDailyScripture(date = new Date()) {
  if (!scriptureList.length) return null;
  const dayOfYear = getDayOfYear(date);
  const dayIndex = (dayOfYear - 1) % scriptureList.length;
  return scriptureList[dayIndex];
}

function getMonthlyScripture(month, year) {
  if (!scriptureList.length) return null;
  const idx = ((month - 1) + year) % scriptureList.length;
  return scriptureList[idx];
}

window.Scripture = { loadScriptures, getDailyScripture, getMonthlyScripture };
