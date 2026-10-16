<div dir="rtl">

# Context Mods

המודים של ג'יי ל-Claude Code לשיחות ארוכות: לקרוא את מה שחשוב, לשמור אותו בקומפאקט, ולהעביר אותו נקי לשיחה אחרת. הדף: https://jaygptpro.com/context-mods/

[English](README.md)

תוספות קטנות שמשנות איך Claude Code נראה ועובד: כפתורים מעל שורת הכתיבה, סימון בצהוב של מה ששווה לקרוא בתשובה ארוכה, והעתקה נקייה של כל השיחה. כל אחת היא מוד של Claude Code (פלאגין עם function hooks) שארוז בתוך תיקיית סקיל, כך שפקודה אחת מתקינה אותו ו-Claude Code טוען אותו לבד בכל שיחה חדשה.

| מוד | מה מקבלים | עלות |
| --- | --- | --- |
| **TL;DR** (`tldr-highlight`) | אחרי תשובה ארוכה, הפסקאות ששווה לקרוא נצבעות בצהוב והודעה קטנה אומרת את כל התשובה במשפט אחד, בשפה שלך. כפתור `TL;DR` מדליק ומכבה. | קריאה קצרה אחת ל-Haiku לכל תשובה ארוכה, מהמנוי שלך |
| **Copy chat** (`copy-chat`) | כפתור `Copy chat`: כל השיחה בקליפבורד כטקסט נקי, `שם (12:01): ...`, מוכנה להדבקה בצ'אט אחר או במסמך. | כלום |
| **Smart PreCompact** | מד קונטקסט מעל שורת הכתיבה וכפתור `Smart compact` שאומר לקומפאקט מה לשמור. נמצא בריפו משלו: [JayGPTPro/smart-precompact](https://github.com/JayGPTPro/smart-precompact). | קריאה אחת כשעושים קומפאקט |
| **Hebrew tools** (`hebrew-tools`, אופציונלי) | למי שקורא עברית: `Translate to Hebrew` על תשובה באנגלית, ו-`⇄ Left` / `⇄ Right` להפוך את יישור העברית. | קריאה אחת ל-Sonnet לכל לחיצה על תרגום |

כשמתקינים כמה, הם חולקים שורה אחת מעל שורת הכתיבה באפליקציה.

## התקנה

### הדרך הקלה: Claude מתקין

פותחים Claude Code ומדביקים את הפרומפט של מה שרוצים. Claude מריץ את ההתקנה, בודק אותה, ואומר מה לצפות.

- הכל (TL;DR, Copy chat ו-Smart PreCompact): [install-prompts/all.he.txt](install-prompts/all.he.txt)
- מוד אחד: [tldr.he.txt](install-prompts/tldr.he.txt), [copy-chat.he.txt](install-prompts/copy-chat.he.txt), [hebrew-tools.he.txt](install-prompts/hebrew-tools.he.txt)

אחר כך פותחים שיחה חדשה. מודים נטענים רק כשהשיחה מתחילה.

### ידנית

צריך Node.js (בשביל `npx`). מוד אחד, או כמה ביחד:

</div>

```bash
npx skills add JayGPTPro/context-mods --skill tldr-highlight -g -a claude-code
```

```bash
npx skills add JayGPTPro/context-mods --skill tldr-highlight copy-chat hebrew-tools -g -a claude-code
```

<div dir="rtl">

את Smart PreCompact מתקינים מהריפו שלו:

</div>

```bash
npx skills add JayGPTPro/smart-precompact -g -a claude-code
```

<div dir="rtl">

בלי Node.js: מורידים את הריפו כ-zip ומעתיקים תיקייה מתוך `skills/` אל `~/.claude/skills/` (בווינדוס: `%USERPROFILE%\.claude\skills\`). התיקייה הנסתרת `.claude-plugin` חייבת להישאר בפנים.

## מה כל מוד עושה

### TL;DR

כשתשובה עוברת בערך 150 מילה, מודל קטן קורא אותה ובוחר עד שלוש פסקאות: התשובה עצמה, מה שמחכה לך, ומה שנכשל או לא נבדק. הן מקבלות רקע צהוב: מעבר לפסקה הראשונה, לא יותר משליש מהתשובה, ואף פעם לא קוד או כותרת לבד. באותה קריאה הוא כותב את התשובה במשפט אחד בשפה שאתה כותב בה, ומציג אותו כהודעה. `↩ No TL;DR` מכבה, והבחירה נשמרת; `TL;DR` מדליק שוב. הצהוב מופיע באפליקציה. בטרמינל יש את הכפתור ואת המשפט.

### Copy chat

לחיצה אחת מעתיקה את השיחה: ההודעות שלך ושל Claude, עם שעות, התאריך בהודעה הראשונה וכשהיום מתחלף, ושורה במקום שבו נעשה קומפאקט. קריאות לכלים, הפלט שלהן, סוכני משנה ותזכורות לא נכנסים. השם שלך מגיע מחשבון ה-Claude שלך, ואם אין שם, "Me". אפשר גם לבקש במילים ("תעתיק את השיחה"), וזה עובד גם איפה שמודים לא עובדים.

השעות צריכות Python 3; בלעדיו הכפתור מעתיק את ההודעות בלי שעות. בלינוקס הוא משתמש ב-`wl-copy`, `xclip` או `xsel` אם יש.

### Hebrew tools

`Translate to Hebrew` מופיע כשבאחת התשובות האחרונות יש טקסט באנגלית, ומציג את העברית במקומו; קוד, פקודות, נתיבים ושמות נשארים כמו שהם. `↩ Original` ו-`Show Hebrew` מחליפים הלוך ושוב. `⇄ Left` / `⇄ Right` הופך את הצד שאליו שורות עברית מיושרות; ימין כברירת מחדל.

### בכל המודים

רק התצוגה משתנה. השיחה עצמה, ומה ש-Claude קורא, נשארים כמו שנכתבו. קריאות למודל עוברות דרך החיבור שלך ל-Claude Code, כמו השיחה עצמה.

## לכבות או להסיר

</div>

```bash
claude plugin disable tldr@skills-dir
```

<div dir="rtl">

השמות הם `tldr`, `copy-chat` ו-`hebrew-tools`. להסרה:

</div>

```bash
npx skills remove tldr-highlight -g
```

<div dir="rtl">

אסור להשאיר עותק גיבוי של תיקיית מוד בתוך `~/.claude/skills`: Claude Code יטען אותו פעמיים.

## כשמשהו לא מופיע

- **אין כפתורים בשיחה חדשה:** גרסת ה-Claude Code שלך עוד לא מריצה מודים. מעדכנים את Claude Code. ‏Copy chat עדיין עובד כשמבקשים במילים.
- **שתי שורות מעל שורת הכתיבה במקום אחת:** המודים נכנסים לשורה של Smart PreCompact כשאחד מהם נטען אחריו. Claude Code טוען תיקיות סקילים לפי הסדר שבו הדיסק מציג אותן, אז בחלק מהמחשבים Smart PreCompact נטען ראשון ונשאר בשורה משלו. הכל עובד אותו דבר.
- **חלון צר** משאיר את השורה של Smart PreCompact שלמה, והמודים עוברים לשורה משלהם.
- **בטרמינל** ל-Smart PreCompact תמיד יש שורה משלו, והמודים חולקים שורה שנייה.
- ‏`claude --debug` כותב ללוג את ההערות של המנוע על כל מוד, בשורות שמתחילות בשם המוד.

## למפתחים

כל מוד הוא תיקיית סקיל בתוך `skills/`: ‏`SKILL.md`, ‏`.claude-plugin/plugin.json`, ‏`hooks/` (`register.tsx`, ו-`panel.ts`, השורה המשותפת, אותו קובץ בשלושתם) ו-`tests/`. ‏`dev/test-all.sh` מריץ את כל הבדיקות: `claude plugin test` ו-`claude plugin validate` לכל מוד, הבדיקות של סקריפט ההעתקה, שלושת העותקים של `panel.ts` זהים, והשורה המשותפת בכל סדר טעינה אפשרי של המודים ו-Smart PreCompact.

נבנה על ידי [ג'יי](https://jaygptpro.com). פרויקט עצמאי, לא מוצר של Anthropic.

</div>
