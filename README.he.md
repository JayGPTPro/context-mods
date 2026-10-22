<div dir="rtl">

# Context Mods

המודים של ג'יי ל-Claude Code לשיחות ארוכות: לקרוא את מה שחשוב, ולשמור אותו בקומפאקט. הדף: https://jaygptpro.com/context-mods/

[English](README.md)

תוספות קטנות שמשנות איך Claude Code נראה ועובד: כפתור מעל שורת הכתיבה, וסימון בצהוב של מה ששווה לקרוא בתשובה ארוכה. כל אחת היא מוד של Claude Code (פלאגין עם function hooks) שארוז בתוך תיקיית סקיל, כך שפקודה אחת מתקינה אותו ו-Claude Code טוען אותו לבד בכל שיחה חדשה.

| מוד | מה מקבלים | עלות |
| --- | --- | --- |
| **TL;DR** (`tldr-highlight`) | אחרי תשובה ארוכה, הפסקאות ששווה לקרוא נצבעות בצהוב והודעה קטנה אומרת את כל התשובה במשפט אחד, בשפה שלך. כפתור `TL;DR` מדליק ומכבה. | קריאה קצרה אחת ל-Haiku לכל תשובה ארוכה, מהמנוי שלך |
| **Smart PreCompact** | מד קונטקסט מעל שורת הכתיבה וכפתור `Smart compact` שאומר לקומפאקט מה לשמור. נמצא בריפו משלו: [JayGPTPro/smart-precompact](https://github.com/JayGPTPro/smart-precompact). | קריאה אחת כשעושים קומפאקט |

כשמתקינים את שניהם, הם יכולים לחלוק שורה אחת מעל שורת הכתיבה באפליקציה.

## התקנה

### הדרך הקלה: Claude מתקין

פותחים Claude Code ומדביקים את הפרומפט של מה שרוצים. Claude מריץ את ההתקנה, בודק אותה, ואומר מה לצפות.

- שניהם (TL;DR ו-Smart PreCompact): [install-prompts/all.he.txt](install-prompts/all.he.txt)
- רק TL;DR: [install-prompts/tldr.he.txt](install-prompts/tldr.he.txt)

אחר כך פותחים שיחה חדשה. מודים נטענים רק כשהשיחה מתחילה.

### ידנית

צריך Node.js (בשביל `npx`):

</div>

```bash
npx skills add JayGPTPro/context-mods --skill tldr-highlight -g -a claude-code
```

<div dir="rtl">

את Smart PreCompact מתקינים מהריפו שלו:

</div>

```bash
npx skills add JayGPTPro/smart-precompact -g -a claude-code
```

<div dir="rtl">

בלי Node.js: מורידים את הריפו כ-zip ומעתיקים את `skills/tldr-highlight` אל `~/.claude/skills/` (בווינדוס: `%USERPROFILE%\.claude\skills\`). התיקייה הנסתרת `.claude-plugin` חייבת להישאר בפנים.

## מה TL;DR עושה

כשתשובה עוברת בערך 150 מילה, מודל קטן קורא אותה ובוחר עד שלוש פסקאות: התשובה עצמה, מה שמחכה לך, ומה שנכשל או לא נבדק. הן מקבלות רקע צהוב: מעבר לפסקה הראשונה, לא יותר משליש מהתשובה, ואף פעם לא קוד או כותרת לבד. באותה קריאה הוא כותב את התשובה במשפט אחד בשפה שאתה כותב בה, ומציג אותו כהודעה. `↩ No TL;DR` מכבה, והבחירה נשמרת; `TL;DR` מדליק שוב. הצהוב מופיע באפליקציה. בטרמינל יש את הכפתור ואת המשפט.

רק התצוגה משתנה. השיחה עצמה, ומה ש-Claude קורא, נשארים כמו שנכתבו. הקריאה למודל עוברת דרך החיבור שלך ל-Claude Code, כמו השיחה עצמה.

## לכבות או להסיר

</div>

```bash
claude plugin disable tldr@skills-dir
```

<div dir="rtl">

להסרה:

</div>

```bash
npx skills remove tldr-highlight -g
```

<div dir="rtl">

אסור להשאיר עותק גיבוי של תיקיית מוד בתוך `~/.claude/skills`: Claude Code יטען אותו פעמיים.

## כשמשהו לא מופיע

- **אין כפתור בשיחה חדשה:** גרסת ה-Claude Code שלך עוד לא מריצה מודים. מעדכנים את Claude Code.
- **שתי שורות מעל שורת הכתיבה במקום אחת:** TL;DR נכנס לשורה של Smart PreCompact כשהוא נטען אחריו. Claude Code טוען תיקיות סקילים לפי הסדר שבו הדיסק מציג אותן, אז בחלק מהמחשבים Smart PreCompact נטען ראשון ונשאר בשורה משלו. הכל עובד אותו דבר.
- **חלון צר** משאיר את השורה של Smart PreCompact שלמה, ו-TL;DR עובר לשורה משלו.
- **בטרמינל** ל-Smart PreCompact תמיד יש שורה משלו, ו-TL;DR מקבל שורה שנייה.
- ‏`claude --debug` כותב ללוג את ההערות של המנוע על כל מוד, בשורות שמתחילות בשם המוד.

## למפתחים

המוד הוא תיקיית סקיל בתוך `skills/`: ‏`SKILL.md`, ‏`.claude-plugin/plugin.json`, ‏`hooks/` (`register.tsx`, ו-`panel.ts`, השורה המשותפת) ו-`tests/`. ‏`dev/test-all.sh` מריץ את כל הבדיקות: `claude plugin test` ו-`claude plugin validate` של המוד, והשורה המשותפת בכל סדר טעינה אפשרי של המוד ו-Smart PreCompact.

רץ על Mac ועל Linux.

נבנה על ידי [ג'יי](https://jaygptpro.com). פרויקט עצמאי, לא מוצר של Anthropic.

</div>
