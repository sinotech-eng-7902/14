import { VoiceProfile, AudioStyle } from "./types";

export const VOICE_PROFILES: VoiceProfile[] = [
  {
    id: "Kore",
    name: "Kore (溫馨女聲 👩)",
    gender: "female",
    description: "溫柔、流暢、和緩且充滿親和力，最適合社區週報、溫馨提醒、生活小品或感性廣播。",
    sampleText: "各位居民大家好，這是本週的社區溫馨廣播。提醒您，垃圾分類時間已經調整，感謝您的支持，祝您有美好的一天！"
  },
  {
    id: "Charon",
    name: "Charon (專業女聲 👩)",
    gender: "female",
    description: "知性、精準、條理清晰且富有邏輯，適合公司週會、新聞播報、學術報告或政令宣導。",
    sampleText: "各位同仁好，以下是本週工作重點報告。請各部門於本週五前提交季度進度，謝謝大家的配合。"
  },
  {
    id: "Kore_sweet",
    name: "Mimi (甜美少女 👧)",
    gender: "female",
    description: "甜美活潑、輕快討喜、富有笑容感。適合晨間活力問候、文創宣傳或輕鬆歡樂的活動播報。",
    sampleText: "大家早安！今天是星期一，新的一週開始囉！小叮嚀：別忘了帶美味的早餐，給自己滿滿的元氣喔！"
  },
  {
    id: "Charon_elegant",
    name: "Alice (資深主播 🎙️)",
    gender: "female",
    description: "字正腔圓、大氣沉穩、具有極佳的專業公信力與清晰度。最適合正式宣佈、公告與政令廣播。",
    sampleText: "各位居民請注意，以下廣播重要治安宣導。請大家隨時提高警覺，注意出入安全，感謝您的配合。"
  },
  {
    id: "Kore_breeze",
    name: "Lily (活力店員 🛍️)",
    gender: "female",
    description: "熱情親切、朝氣蓬勃、充滿吸引力。適合各大商場、超市促銷、特賣會活動或商品導購廣播。",
    sampleText: "歡迎光臨！超值特惠活動現在開始！生鮮食品全線八折優惠中，趕快把握機會前來選購！"
  },
  {
    id: "Charon_mind",
    name: "Dora (療癒心靈 🧘‍♀️)",
    gender: "female",
    description: "緩慢和緩、靜謐溫柔、帶有撫慰人心的寧靜磁性。適合心靈音樂、夜間冥想、或是療癒感的小品廣播。",
    sampleText: "放鬆您的雙肩，深呼吸。讓溫柔的晚風帶走您一整天的疲憊，今晚，願您有個平靜溫暖的好夢。"
  },
  {
    id: "Zephyr",
    name: "Zephyr (知性男聲 👨)",
    gender: "male",
    description: "溫暖、親切、富有磁性且咬字清晰，適合日常活動通知、店鋪推廣或一般資訊播報。",
    sampleText: "親愛的顧客您好，本週我們準備了限時優惠活動，全店商品買二送一，歡迎您進店參觀選購！"
  },
  {
    id: "Puck",
    name: "Puck (朝氣男聲 👦)",
    gender: "male",
    description: "陽光、充滿活力與熱情、節奏輕快，最適合晨間廣播、活動開場、體育播報或優惠大促銷。",
    sampleText: "大家早安！今天是充滿活力的一天！讓我們打起精神，迎接本週精彩的活動吧！"
  },
  {
    id: "Fenrir",
    name: "Fenrir (渾厚男聲 🧔)",
    gender: "male",
    description: "低沉、穩重、具有強烈的信任感與莊重感，適合正式公告、重大決定或警示通知。",
    sampleText: "請注意，這是一則重要的安全廣播。本棟大樓將於今日下午兩點進行消防演練，請居民配合引導。"
  }
];

export const AUDIO_STYLES: AudioStyle[] = [
  {
    id: "default",
    name: "自然播報",
    description: "自然、流暢、節奏適中的大眾風格",
    icon: "Volume2"
  },
  {
    id: "warm",
    name: "溫馨關懷",
    description: "親切、溫暖、充滿人情味的慢速朗讀",
    icon: "Heart"
  },
  {
    id: "professional",
    name: "專業播報",
    description: "標準、沉穩、清晰的新聞電台風格",
    icon: "Mic"
  },
  {
    id: "energetic",
    name: "活力宣傳",
    description: "高亢、熱情、極具說服力的高頻風格",
    icon: "Sparkles"
  },
  {
    id: "story",
    name: "感性故事",
    description: "緩慢、溫柔、富有張力的訴說感",
    icon: "BookOpen"
  },
  {
    id: "urgent",
    name: "警示通知",
    description: "嚴肅、清晰、引人注意的肯定語調",
    icon: "AlertTriangle"
  }
];

export const SCRIPT_TEMPLATES = [
  {
    title: "🏢 社區每週溫馨公告",
    style: "warm",
    voice: "Kore",
    content: `各位親愛的住戶大家好：
這裡是社區管理處的每週溫馨廣播。

首先，本週四上午 9 點到 12 點，社區將進行例行性的水塔清洗與供水管線消毒，屆時會暫停供水，請大家提前做好儲水準備。

另外，提醒大家最近天氣多變，出門記得帶把傘。如果家裡有需要修繕的公設申報，請在週五前到一樓大廳填寫登記表。

感謝您的配合，祝大家這週都有個愉快、順心的生活！`
  },
  {
    title: "🛍️ 超市/店家每週促銷廣播",
    style: "energetic",
    voice: "Puck",
    content: `各位好鄰居、好朋友，大家早安，歡迎光臨我們的生鮮超市！

本週特惠活動正式開跑啦！
即日起到本週日，全館冷凍肉品一律享 85 折優惠！現採當季有機蔬菜買二送一，產地直送保證新鮮！

同時，凡是單筆消費滿 500 元的顧客，就可以憑發票到服務台免費領取一份限量精美小禮物。

活動數量有限，送完為止！祝您購物愉快，買得開心、吃得安心！`
  },
  {
    title: "📈 團隊週會重點宣導",
    style: "professional",
    voice: "Charon",
    content: `各位同仁好，以下是本週的工作重點廣播：

第一，關於本季度的核心專案，請大家務必於本週三下午五點前完成程式碼凍結，並提交測試報告。

第二，本週四下午兩點，我們將在 A 會議室舉辦跨部門協作技術研討會，請相關專案負責人準時出席。

最後，提醒大家在下班前，記得確實關閉辦公區域的電燈與空調，落實節能減碳。

感謝大家的辛勞，讓我們這週繼續一起加油！`
  }
];
