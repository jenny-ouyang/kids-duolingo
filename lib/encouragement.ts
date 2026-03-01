function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface PracticedWord {
  english: string
  chinese: string
  pinyin: string
}

export interface SessionData {
  packId: string
  packName: string
  subject: string
  correctWords: PracticedWord[]
}

export interface SessionContext {
  packId: string
  packName: string
  subject: string
  correct: number
  total: number
  hearts: number
  correctWords: PracticedWord[]
}

export interface Encouragement {
  heading: string
  emoji: string
  chinesePhrase: string
  chinesePinyin: string
  chineseMeaning: string
  subMessage: string
  mission: string | null
  spotlightWord: {
    chinese: string
    english: string
    pinyin: string
    message: string
  } | null
}

// ─── Praise phrases Julian hears (a different one each time) ────────────────

const CHINESE_PRAISE = [
  { phrase: '你真棒', pinyin: 'nǐ zhēn bàng', meaning: "You're really great" },
  { phrase: '太厉害了', pinyin: 'tài lìhai le', meaning: 'So awesome' },
  { phrase: '好极了', pinyin: 'hǎo jí le', meaning: 'Wonderful' },
  { phrase: '你做到了', pinyin: 'nǐ zuòdào le', meaning: 'You did it' },
  { phrase: '太酷了', pinyin: 'tài kù le', meaning: 'So cool' },
  { phrase: '了不起', pinyin: 'liǎobuqǐ', meaning: 'Remarkable' },
  { phrase: '真聪明', pinyin: 'zhēn cōngming', meaning: 'So smart' },
  { phrase: '棒极了', pinyin: 'bàng jí le', meaning: 'Fantastic' },
  { phrase: '越来越好', pinyin: 'yuè lái yuè hǎo', meaning: 'Getting better and better' },
  { phrase: '加油', pinyin: 'jiā yóu', meaning: "Let's go!" },
  { phrase: '好厉害', pinyin: 'hǎo lìhai', meaning: 'So impressive' },
  { phrase: '继续加油', pinyin: 'jìxù jiāyóu', meaning: 'Keep it up' },
  { phrase: '没问题', pinyin: 'méi wèntí', meaning: 'No problem at all' },
  { phrase: '太好了', pinyin: 'tài hǎo le', meaning: 'That is great' },
  { phrase: '你最棒', pinyin: 'nǐ zuì bàng', meaning: "You're the best" },
]

// ─── English headings by performance tier ───────────────────────────────────

const HEADINGS_PERFECT = [
  'Perfect! Not a single mistake!',
  'WOW! Every one correct!',
  'Flawless! You nailed it!',
  "You're a superstar, Julian!",
  'Clean sweep!',
  '100%! Nothing stops you!',
  'Total perfection!',
  'Incredible — every single one!',
  'All correct! The panda is amazed!',
  'Zero mistakes! Legendary!',
]

const HEADINGS_GREAT = [
  'Great job, Julian!',
  'You did it!',
  'Nice work!',
  'Keep it up — almost perfect!',
  'Look at you go!',
  'So close to perfect!',
  "You're getting stronger!",
  'That was really good!',
  'Well done, Julian!',
  'Awesome effort!',
  "You're crushing it!",
]

const HEADINGS_GOOD = [
  'Good try, Julian!',
  "You're learning!",
  'Every mistake teaches you!',
  "You'll get there — keep practicing!",
  'Practice makes perfect!',
  "You're improving!",
  'Not bad at all!',
  'You remembered a lot!',
  'Nice start — try again?',
  "Getting better every time!",
]

// ─── Emojis by tier ─────────────────────────────────────────────────────────

const EMOJIS_PERFECT = ['🏆', '🌟', '💫', '🎯', '👑', '🦸', '🚀', '💎']
const EMOJIS_GREAT = ['🎉', '✨', '🙌', '💪', '🌈', '🎊', '⚡', '🎆']
const EMOJIS_GOOD = ['💪', '🌱', '🌻', '📚', '🧩', '🎨', '🌞', '🌺']

// ─── Real-life missions by pack ─────────────────────────────────────────────

const MISSIONS: Record<string, string[]> = {
  greetings: [
    'Say 你好 (nǐ hǎo) to someone today!',
    'Tell someone 谢谢 (xièxie) when they help you!',
    'Say 早上好 to mom or dad tomorrow morning!',
    'Wave and say 再见 next time you leave!',
    'Say 对不起 (duìbuqǐ) next time you bump someone!',
  ],
  food: [
    'At your next meal, name one food in Chinese!',
    "Ask for 水 (shuǐ) next time you're thirsty!",
    'Tell mom what you ate — in Chinese!',
    'Name something on your plate in Chinese!',
    'Say 好吃 (hǎochī) when dinner is yummy!',
  ],
  animals: [
    'Next time you see a pet, say its Chinese name!',
    'Draw your favorite animal and label it in Chinese!',
    'Can you say 猫 (māo) when you see a cat?',
    'Look for an animal outside and name it!',
    'What sound does a 狗 (gǒu) make? 汪汪!',
  ],
  colors: [
    'Find something red and say 红色 (hóngsè)!',
    'Name 3 colors in your room — in Chinese!',
    'What color is your shirt? Say it in Chinese!',
    'Point to the sky and say 蓝色 (lánsè)!',
    'Find every color you learned around the house!',
  ],
  numbers: [
    'Count to 10 in Chinese at bedtime!',
    'Count your fingers — in Chinese!',
    'How many apples? Count in Chinese!',
    'Count the stairs next time — in Chinese!',
    'Tell mom your age in Chinese!',
  ],
  family: [
    'Call mom 妈妈 and dad 爸爸 today!',
    'Tell someone 我爱你 (wǒ ài nǐ)!',
    'Say who everyone is at dinner — in Chinese!',
    'Say 谢谢妈妈 or 谢谢爸爸 tonight!',
    'Tell mom she is 妈妈 and you are 宝宝!',
  ],
  pronouns: [
    'Point to yourself and say 我 (wǒ)!',
    'Ask someone 这是什么 (zhè shì shénme)?',
    "Say 我们 (wǒmen) when you're with family — it means we!",
    'Point to things and say 这 (this) or 那 (that)!',
    'Point to mom and say 你 (nǐ)!',
  ],
  actions: [
    'Next time you run, shout 跑 (pǎo)!',
    'Before bed, say 睡觉 (shuìjiào)!',
    'When you eat dinner, say 吃 (chī)!',
    'Jump and say 跳 (tiào)! Dance and say 跳舞 (tiàowǔ)!',
    'Say 来 (lái) to call someone — it means come!',
  ],
  feelings: [
    'Tell mom how you feel — in Chinese!',
    "When you're happy, say 开心 (kāixīn)!",
    'Ask someone 你好吗 — how are you?',
    'Make a happy face and say 高兴!',
    "Before bed, tell mom: 我累了 (wǒ lèi le) — I'm tired!",
  ],
  body: [
    'Touch your head and say 头 (tóu)!',
    'Point to your hand and say 手 (shǒu)!',
    'Play a body parts game — all in Chinese!',
    'Wash your hands and say 洗手 (xǐshǒu)!',
    'Touch your nose and say 鼻子 (bízi)!',
  ],
  home: [
    'Name 3 things in your room — in Chinese!',
    'Point to the door and say 门 (mén)!',
    'Find the TV and say 电视 (diànshì)!',
    'Walk around and name things — in Chinese!',
    'Where do you sit? On the 椅子 (yǐzi)!',
  ],
  nature: [
    'Look outside and say 太阳 (tàiyáng) for sun!',
    'Find a tree and say 树 (shù)!',
    'If it rains, say 下雨 (xiàyǔ)!',
    'See a flower? Say 花 (huā)!',
    'Look at the moon tonight and say 月亮 (yuèliàng)!',
  ],
  words: [
    'Find something big — say 大 (dà)! Something small — 小 (xiǎo)!',
    'Say 好 (hǎo) when something is good!',
    'Try 很好 (hěn hǎo) — it means very good!',
    'Say 快 (kuài) when something is fast!',
    'Tell mom you want to do something 一起 (yīqǐ) — together!',
  ],
}

const GENERIC_MISSIONS = [
  'Teach someone a Chinese word you learned today!',
  'Say one Chinese word at dinner tonight!',
  'Practice your favorite word 3 times before bed!',
  'Try to use a Chinese word in a real conversation!',
  'Draw something you learned and label it in Chinese!',
  'Whisper a Chinese word to the panda! 🐼',
]

// ─── Word spotlight templates ───────────────────────────────────────────────

const SPOTLIGHT_TEMPLATES = [
  'You can say "{chinese}" ({english}) now! Try it today!',
  'New word: {chinese} means {english}! Use it tonight!',
  '{chinese} = {english}. Say it 3 times fast!',
  'Julian knows {chinese}! Teach it to someone!',
  '{chinese} ({pinyin}) — your newest word!',
]

// ─── Main function ──────────────────────────────────────────────────────────

export function getEncouragement(ctx: SessionContext): Encouragement {
  const ratio = ctx.total > 0 ? ctx.correct / ctx.total : 0
  const tier: 'perfect' | 'great' | 'good' =
    ratio >= 1 ? 'perfect' : ratio > 0.6 ? 'great' : 'good'

  const heading = pick(
    tier === 'perfect' ? HEADINGS_PERFECT :
    tier === 'great' ? HEADINGS_GREAT :
    HEADINGS_GOOD
  )

  const emoji = pick(
    tier === 'perfect' ? EMOJIS_PERFECT :
    tier === 'great' ? EMOJIS_GREAT :
    EMOJIS_GOOD
  )

  const praise = pick(CHINESE_PRAISE)

  const subOptions = [
    `${ctx.correct} out of ${ctx.total} ✨`,
    `You got ${ctx.correct} right!`,
    `${ctx.correct}/${ctx.total} 🎯`,
    `Score: ${ctx.correct}/${ctx.total} 🌟`,
  ]
  if (ctx.hearts > 0) {
    subOptions.push(`${ctx.hearts} heart${ctx.hearts !== 1 ? 's' : ''} earned! ❤️`)
  }
  if (tier === 'perfect') {
    subOptions.push('Every. Single. One. 💯')
  }
  const subMessage = pick(subOptions)

  let mission: string | null = null
  if (ctx.subject === 'chinese') {
    const packMissions = MISSIONS[ctx.packId]
    mission = packMissions ? pick(packMissions) : pick(GENERIC_MISSIONS)
  }

  let spotlightWord: Encouragement['spotlightWord'] = null
  if (ctx.subject === 'chinese' && ctx.correctWords.length > 0 && Math.random() > 0.35) {
    const word = pick(ctx.correctWords)
    const template = pick(SPOTLIGHT_TEMPLATES)
    const message = template
      .replace('{chinese}', word.chinese)
      .replace('{english}', word.english)
      .replace('{pinyin}', word.pinyin)
    spotlightWord = { ...word, message }
  }

  return {
    heading,
    emoji,
    chinesePhrase: praise.phrase,
    chinesePinyin: praise.pinyin,
    chineseMeaning: praise.meaning,
    subMessage,
    mission,
    spotlightWord,
  }
}
