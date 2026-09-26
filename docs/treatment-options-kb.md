# Treatment Options Knowledge Base — v1.0

> **Status: Approved for use in the app by the project team, 25 Sep 2026 (v1.0).**
> Prepared 25 Sep 2026 for the CKD conversational agent ("Clara").

## 1. Purpose and rules

This file is the single source of facts for the "how each option differs on what matters to you" step. The chatbot may **select and lightly personalise** these statements. It must never add new medical facts, rank options, or say which option suits the patient best.

- Every option is shown for every dimension, always in the same order: PD → HD → Transplant → CKM.
- All four options are always shown. `common.suitability.1` is always shown with them.
- Statements tagged `ask-team` are handed to the care team instead of being explained.
- Singapore-only content. Australian-specific details (rebates, travel assistance, home haemodialysis) have been removed.
- Numbers are approximate on purpose ("about", "usually"), because prescriptions vary.

### Statement format

```
- `option.dimension.tag.n` · tag · [SOURCE] · ⚠ flag (if any)
  EN: English text
  ZH: 简体中文
```

**Tags:** `helps` (may suit people who value this), `harder` (may be harder for people who value this), `practical` (neutral fact about daily life), `ask-team` (hand to care team).

**Flags:** ⚠ GATE = only show if the sensitive-topic gate allows it.

## 2. Sources

| Code | Source |
|---|---|
| NKF-PD | NKF Singapore, "What is Peritoneal Dialysis?" (nkfs.org) |
| NKF-HD | NKF Singapore, haemodialysis FAQ (shown on the "What is Kidney Supportive Care?" page) |
| NKF-NOC | NKF Singapore, "Nocturnal Dialysis for Better Health Outcomes" (2020, updated with 2022/2024 content) |
| NKF-TX | NKF Singapore, "What is Kidney Transplant?" |
| NKF-KSC | NKF Singapore, "What is Kidney Supportive Care?" (2026) |
| MYK | Ozdemir et al., myKIDNEY decision aid evaluation, Kidney Int Rep 2026 (SGH/NUH) |
| RRT | Project documents: Framework, Clinical Flow, Consolidated Insights (NKF advisory group, Sep 2026) |
| KHA-G | Kidney Health Australia, *My Kidneys My Choice* — used **only** for general facts that are not Australia-specific |
| VAN | Vantive PD brochure — used **only** for how PD works; no promotional claims |

## 3. Options

| ID | English | 中文 | Singapore availability |
|---|---|---|---|
| `pd` | Peritoneal dialysis (PD) | 腹膜透析 | Yes. Two ways: CAPD (hand exchanges by day) and APD (machine at night). NKF PD Home Support Programme. [NKF-PD] |
| `hd` | Haemodialysis at a centre (HD) | 中心血液透析 | Yes. Morning, afternoon or evening slots; overnight (nocturnal) at some NKF centres. [NKF-HD, NKF-NOC] |
| `tx` | Kidney transplant | 肾脏移植 | Yes. Living donor or deceased donor. [NKF-TX] |
| `ckm` | Conservative kidney management (care without dialysis) | 保守肾脏管理（不做透析的护理） | Yes, offered at SGH and NUH. [MYK] |

**Excluded:** Home haemodialysis — no Singapore source confirms it is currently offered. Add back only if the clinical team confirms availability.

**Kidney supportive care (KSC)** is not a separate option. It is support available alongside the options (see `common.ksc.1`).

### Option summaries

- `pd.summary.1` · practical · [NKF-PD]
  EN: Dialysis done at home through a soft tube in your tummy. Cleaning fluid flows in, collects waste and extra water, and is then drained out.
  ZH: 在家里通过肚子上的一条软管做透析。透析液流进肚子，带走废物和多余的水分，然后再排出来。
- `pd.summary.2` · practical · [NKF-PD]
  EN: There are two ways: changing the fluid by hand a few times during the day, or using a machine that changes it at night while you sleep.
  ZH: 有两种方式：白天用手换几次透析液，或者晚上睡觉时用机器自动换液。
- `hd.summary.1` · practical · [NKF-HD]
  EN: Your blood is cleaned by a machine at a dialysis centre, usually 3 times a week for about 4 hours each time.
  ZH: 在透析中心用机器清洗血液，通常每周三次，每次大约四个小时。
- `hd.summary.2` · practical · [NKF-HD, NKF-NOC]
  EN: Some NKF centres also offer evening sessions or overnight dialysis while you sleep.
  ZH: 部分国家肾脏基金会（NKF）中心也提供傍晚时段，或在晚上睡觉时进行的夜间透析。
- `tx.summary.1` · practical · [NKF-TX]
  EN: An operation places a healthy kidney from a donor into your body. The donor may be a family member or close friend, or someone who has passed away.
  ZH: 通过手术把一颗健康的肾脏放进您的身体。捐肾的人可以是家人或好朋友，也可以是已经过世的人。
- `ckm.summary.1` · practical · [KHA-G, RRT]
  EN: Care without dialysis. Your kidney team helps you manage symptoms with medicine, diet and other support, so you can live as well as possible.
  ZH: 不做透析的护理方式。肾脏团队通过药物、饮食和其他支持帮助您控制症状，让您尽量生活得好。
- `ckm.summary.2` · practical · [MYK, RRT]
  EN: It is a planned choice with ongoing care from your kidney team. It is not "doing nothing".
  ZH: 这是一个有计划的选择，肾脏团队会一直照顾您。这并不是"什么都不做"。

## 4. Dimensions

| ID | English | 中文 | Fed by app questions |
|---|---|---|---|
| `independence` | Managing my own care | 自己管理护理 | `values-1` (Staying independent), `treatment-independence` |
| `flexibility` | Flexible days vs a fixed routine | 时间灵活还是安排固定 | `treatment-priorities` (flexible schedule / predictable routine) |
| `work` | Work and daily responsibilities | 工作和日常责任 | `values-1` (work or activities), `treatment-priorities` (fitting care around work) |
| `travel` | Travel and overnight stays | 旅行和在外过夜 | `treatment-travel`, `treatment-priorities` |
| `time` | Time and trips spent on care | 花在护理上的时间和来回次数 | `treatment-priorities` (time each day, fewer trips), `life-2` |
| `family` | Help needed from family | 需要家人帮忙的程度 | `life-3`, `values-1` (Time with family), `worries-1` (Impact on family) |
| `home` | Where care happens and my home | 在哪里接受护理和家里的条件 | `treatment-location` |
| `body` | Effects on my body and physical demands | 对身体的影响和体力要求 | `treatment-mobility`, `worries-1` (How treatment may affect my body) |
| `comfort` | Feeling comfortable day to day | 日常舒适感 | `values-1` (Feeling comfortable) |
| `longevity` | How long I may live | 可能活多久 | `treatment-priorities` — always `ask-team` |
| `cost` | Costs | 费用 | `worries-1` (Costs) — always `ask-team` |

## 5. Common statements (all options)

- `common.suitability.1` · practical · [RRT]
  EN: Not every option is suitable for everyone. Your care team will tell you which options are possible for you.
  ZH: 不是每种方式都适合每个人。医疗团队会告诉您哪些方式适合您。
- `common.nochoice.1` · practical · [RRT]
  EN: There is no single right answer. People with similar health can make different choices.
  ZH: 没有唯一正确的答案。健康情况相似的人，也可以做出不同的选择。
- `common.change.1` · practical · [KHA-G]
  EN: You can talk to your care team about changing your treatment later if your needs change.
  ZH: 如果以后您的需要有变化，可以和医疗团队商量换一种治疗方式。
- `common.ksc.1` · practical · [NKF-KSC, RRT]
  EN: Kidney supportive care is available alongside your treatment. It helps with symptoms such as pain, itch and tiredness, gives emotional support, and helps you plan ahead.
  ZH: 在治疗的同时，您也可以得到肾脏支持性护理。它帮助处理疼痛、瘙痒、疲倦等症状，提供情绪支持，并帮助您提前做好规划。

## 6. How the options differ, by dimension

### 6.1 `independence` — Managing my own care

**PD**
- `pd.independence.helps.1` · helps · [NKF-PD]
  EN: You do the treatment yourself at home and plan it around your own day.
  ZH: 您在家里自己做治疗，可以按照自己的作息来安排。
- `pd.independence.practical.1` · practical · [NKF-PD, VAN]
  EN: The PD nurses train you, or a family member, to do it safely.
  ZH: 腹膜透析护士会教您或您的家人如何安全地做。
- `pd.independence.harder.1` · harder · [KHA-G]
  EN: It needs to be done every day, and the tube must be kept clean to prevent infection.
  ZH: 需要每天做，而且软管要保持清洁，以免感染。

**HD**
- `hd.independence.helps.1` · helps · [KHA-G]
  EN: Nurses and staff at the centre do the treatment for you.
  ZH: 由透析中心的护士和工作人员为您做治疗。
- `hd.independence.harder.1` · harder · [NKF-PD, NKF-HD]
  EN: You follow the centre's fixed schedule rather than your own.
  ZH: 您需要按照透析中心固定的时间安排，而不是自己的时间。

**Transplant**
- `tx.independence.helps.1` · helps · [NKF-TX]
  EN: If the new kidney works well, you no longer need dialysis and can manage daily life much as before.
  ZH: 如果新肾脏运作良好，您就不需要再透析，可以像以前一样打理日常生活。
- `tx.independence.harder.1` · harder · [NKF-TX]
  EN: You must take anti-rejection medicine every day for the rest of your life.
  ZH: 您需要一辈子每天服用抗排斥药物。
- `tx.independence.practical.1` · practical
  EN: You will need regular check-ups at the transplant clinic.
  ZH: 您需要定期到移植门诊复诊。

**CKM**
- `ckm.independence.helps.1` · helps · [KHA-G]
  EN: There is no machine or dialysis routine to manage. Care focuses on keeping you comfortable.
  ZH: 不需要操作机器，也没有透析的固定程序。护理的重点是让您舒适。
- `ckm.independence.harder.1` · harder · [KHA-G]
  EN: As kidney function keeps going down, you may need more help from family and the care team over time.
  ZH: 随着肾功能继续下降，您以后可能需要家人和医疗团队更多的帮助。

### 6.2 `flexibility` — Flexible days vs a fixed routine

**PD**
- `pd.flexibility.helps.1` · helps · [NKF-PD]
  EN: You can fit the fluid changes around your day, or use the machine at night.
  ZH: 您可以按自己的时间安排换液，或者晚上用机器做。
- `pd.flexibility.harder.1` · harder
  EN: It happens every day. There are no days off.
  ZH: 每天都要做，没有休息日。

**HD**
- `hd.flexibility.helps.1` · helps · [NKF-HD]
  EN: A fixed routine that is easy to plan around: the same days and the same time slot each week.
  ZH: 安排固定，容易提前计划：每星期同样的日子、同样的时段。
- `hd.flexibility.practical.1` · practical · [NKF-HD]
  EN: At NKF centres you choose either Monday, Wednesday and Friday, or Tuesday, Thursday and Saturday, and a morning, afternoon or evening slot.
  ZH: 在国家肾脏基金会的中心，您可以选择星期一、三、五，或星期二、四、六，并选择上午、下午或傍晚的时段。
- `hd.flexibility.harder.1` · harder · [NKF-HD]
  EN: Three days a week are planned around your sessions.
  ZH: 每星期有三天需要围绕透析来安排。

**Transplant**
- `tx.flexibility.helps.1` · helps · [NKF-TX]
  EN: Once the kidney is working, there is no dialysis schedule to follow.
  ZH: 新肾脏开始运作后，就不需要按照透析时间表生活。
- `tx.flexibility.harder.1` · harder
  EN: In the first months after the operation, you will have many clinic visits and blood tests.
  ZH: 手术后的头几个月，需要经常复诊和验血。

**CKM**
- `ckm.flexibility.helps.1` · helps · [KHA-G]
  EN: There are no regular treatment sessions. Clinic visits are for check-ups and symptom care.
  ZH: 没有固定的治疗时段。去门诊主要是复查和处理症状。
- `ckm.flexibility.practical.1` · practical
  EN: Visits and support may increase as your health changes.
  ZH: 随着健康状况变化，复诊和支持可能会增加。

### 6.3 `work` — Work and daily responsibilities

**PD**
- `pd.work.helps.1` · helps · [NKF-PD, VAN]
  EN: With the night-time machine, your days stay free for work or other responsibilities.
  ZH: 使用夜间机器的话，白天可以空出来工作或处理其他事情。
- `pd.work.practical.1` · practical · [NKF-PD]
  EN: Daytime fluid changes can be done at work if there is a clean, private place.
  ZH: 如果工作的地方有干净、私密的空间，白天也可以在那里换液。

**HD**
- `hd.work.helps.1` · helps · [NKF-HD, NKF-NOC]
  EN: Evening sessions, or overnight dialysis at some NKF centres, can keep your daytime free.
  ZH: 傍晚时段，或部分国家肾脏基金会中心的夜间透析，可以让您白天有空。
- `hd.work.harder.1` · harder · [NKF-HD]
  EN: Daytime sessions take about 4 hours, plus travel, 3 times a week. This can clash with work.
  ZH: 白天的透析每次大约四个小时，加上来回路程，每星期三次，可能会和工作时间冲突。

**Transplant**
- `tx.work.helps.1` · helps · [NKF-TX]
  EN: Many people go back to work or study after they recover.
  ZH: 很多人康复后可以重新工作或读书。
- `tx.work.practical.1` · practical
  EN: You will need time off for the operation and recovery.
  ZH: 手术和康复期间需要请假。

**CKM**
- `ckm.work.practical.1` · practical · [KHA-G]
  EN: There are no treatment sessions to fit around work, but working may become harder as your health changes.
  ZH: 不需要为治疗调整工作时间，但随着健康状况变化，工作可能会变得比较困难。

### 6.4 `travel` — Travel and overnight stays

**PD**
- `pd.travel.helps.1` · helps · [NKF-PD]
  EN: PD can be done while you are away from home, with careful planning.
  ZH: 只要事先做好安排，出门在外也可以做腹膜透析。
- `pd.travel.practical.1` · practical
  EN: Speak to your PD team early so supplies can be arranged. If you use the night machine, it needs to travel with you.
  ZH: 请提早告诉腹膜透析团队，以便安排用品。如果您使用夜间机器，也需要带着它一起出门。

**HD**
- `hd.travel.harder.1` · harder · [KHA-G]
  EN: You need to book dialysis at a centre near where you are going, well ahead of time.
  ZH: 您需要提早预约目的地附近的透析中心。
- `hd.travel.practical.1` · practical · [KHA-G]
  EN: Longer trips, especially overseas, may be harder or more costly to arrange.
  ZH: 较长的旅程，尤其是出国，可能比较难安排，费用也可能较高。

**Transplant**
- `tx.travel.helps.1` · helps · [NKF-TX]
  EN: Once you have recovered and are stable, you can travel without arranging dialysis.
  ZH: 康复并且情况稳定后，您出门旅行就不需要安排透析。
- `tx.travel.practical.1` · practical
  EN: You need to bring your medicine with you and ask your team when it is safe to travel after the operation.
  ZH: 出门时需要带上药物，并请医疗团队告诉您手术后什么时候可以安全出行。

**CKM**
- `ckm.travel.practical.1` · practical · [KHA-G]
  EN: You can travel if you feel well enough. Talk to your kidney team about your plans first.
  ZH: 如果身体状况允许，您可以去旅行。出发前请先和肾脏团队商量。

### 6.5 `time` — Time and trips spent on care

**PD**
- `pd.time.helps.1` · helps · [NKF-PD]
  EN: There are no trips to a dialysis centre for treatment. You mainly go to the clinic for check-ups.
  ZH: 不需要去透析中心做治疗，主要是回门诊复查。
- `pd.time.harder.1` · harder · [NKF-PD, VAN]
  EN: It takes time every day: several fluid changes of about half an hour each, or 8 to 10 hours on the machine at night.
  ZH: 每天都需要花时间：白天换液几次，每次大约半小时；或晚上接上机器八到十个小时。

**HD**
- `hd.time.harder.1` · harder · [NKF-HD]
  EN: About 4 hours each session, 3 times a week, plus travel and waiting time.
  ZH: 每次大约四个小时，每星期三次，还要加上来回和等候的时间。
- `hd.time.practical.1` · practical · [NKF-NOC]
  EN: Overnight dialysis takes 6 to 7 hours, but it happens while you sleep.
  ZH: 夜间透析需要六到七个小时，但是在您睡觉时进行。

**Transplant**
- `tx.time.helps.1` · helps · [NKF-TX]
  EN: After you recover, there are no dialysis sessions.
  ZH: 康复以后，就不需要再做透析。
- `tx.time.harder.1` · harder · [NKF-TX]
  EN: Waiting for a kidney from a donor who has passed away can take many years. In Singapore the average wait is about 8 years, and dialysis is usually needed while waiting.
  ZH: 等待已故捐赠者的肾脏可能需要很多年。在新加坡，平均要等大约八年，等待期间通常需要透析。
- `tx.time.practical.1` · practical · [NKF-TX] · ⚠ GATE
  EN: A kidney from a living donor usually means a shorter wait.
  ZH: 如果有活体捐赠者，等待的时间通常会比较短。

**CKM**
- `ckm.time.helps.1` · helps · [KHA-G]
  EN: There are no dialysis sessions. Your time on care is mainly regular clinic visits.
  ZH: 没有透析时段。花在护理上的时间主要是定期复诊。

### 6.6 `family` — Help needed from family

**PD**
- `pd.family.practical.1` · practical · [VAN, RRT]
  EN: If you cannot do the treatment yourself, a family member or helper can be trained to do it.
  ZH: 如果您自己没办法做，可以由家人或帮手学习后帮您做。
- `pd.family.practical.2` · practical · [NKF-PD]
  EN: NKF's PD nurses can visit your home to check on you and support you. Your hospital needs to refer you.
  ZH: 国家肾脏基金会的腹膜透析护士可以上门探访和支持您，但需要由医院转介。
- `pd.family.harder.1` · harder
  EN: If a family member does the treatment, it becomes part of their daily routine too.
  ZH: 如果由家人帮忙做，这也会成为他们每天生活的一部分。

**HD**
- `hd.family.helps.1` · helps · [KHA-G]
  EN: Staff at the centre do the treatment, so family do not need to help with it.
  ZH: 由中心的工作人员做治疗，家人不需要帮忙操作。
- `hd.family.practical.1` · practical
  EN: Family may be needed to take you to and from the centre.
  ZH: 可能需要家人接送您往返透析中心。

**Transplant**
- `tx.family.practical.1` · practical
  EN: You will need help at home while you recover from the operation.
  ZH: 手术后康复期间，您在家里需要有人帮忙。
- `tx.family.practical.2` · practical · [NKF-TX] · ⚠ GATE
  EN: A living donor is often a family member or friend. This is a personal decision for them too.
  ZH: 活体捐赠者通常是家人或朋友，这对他们来说也是一个很个人的决定。

**CKM**
- `ckm.family.practical.1` · practical · [NKF-KSC]
  EN: Family often take on a bigger role as health changes. The supportive care team can support your family as well.
  ZH: 随着健康状况变化，家人通常会承担更多照顾工作。支持性护理团队也可以帮助您的家人。

### 6.7 `home` — Where care happens and my home

**PD**
- `pd.home.helps.1` · helps · [NKF-PD]
  EN: Most of your care happens at home.
  ZH: 大部分的护理都在家里进行。
- `pd.home.harder.1` · harder · [RRT]
  EN: You need a clean space for the treatment and room to store boxes of supplies.
  ZH: 家里需要有干净的地方做治疗，也需要空间存放一箱箱的用品。
- `pd.home.practical.1` · practical · [NKF-PD]
  EN: PD nurses can check your home and help you set it up.
  ZH: 腹膜透析护士可以评估您的家，并帮助您布置。

**HD**
- `hd.home.helps.1` · helps · [KHA-G]
  EN: No equipment or supplies are kept at home, and nurses are nearby during treatment.
  ZH: 家里不需要放任何器材或用品，治疗时也有护士在旁。
- `hd.home.harder.1` · harder · [NKF-HD]
  EN: You need to go to the centre for every session.
  ZH: 每次透析都需要到中心去。

**Transplant**
- `tx.home.practical.1` · practical · [KHA-G]
  EN: No treatment equipment is needed at home.
  ZH: 家里不需要任何治疗器材。

**CKM**
- `ckm.home.helps.1` · helps · [NKF-KSC, MYK]
  EN: Care aims to keep you comfortable at home and avoid hospital stays that are not needed.
  ZH: 护理的目标是让您在家里舒适地生活，避免不必要的住院。

### 6.8 `body` — Effects on my body and physical demands

**PD**
- `pd.body.practical.1` · practical · [VAN, NKF-PD]
  EN: A small operation places a soft tube in your tummy.
  ZH: 需要一个小手术，在肚子里放一条软管。
- `pd.body.helps.1` · helps · [NKF-PD]
  EN: No needles are used.
  ZH: 不需要打针。
- `pd.body.harder.1` · harder
  EN: Doing the fluid changes needs steady hands and good eyesight, or a helper who can do it.
  ZH: 换液需要手稳、视力好，或者有人帮忙做。
- `pd.body.practical.2` · practical · [KHA-G]
  EN: Some people feel full in the tummy.
  ZH: 有些人会觉得肚子胀。

**HD**
- `hd.body.practical.1` · practical · [KHA-G]
  EN: A small operation on your arm prepares a blood vessel for dialysis.
  ZH: 需要在手臂上做一个小手术，为透析准备好血管。
- `hd.body.harder.1` · harder · [NKF-HD]
  EN: Two needles are put into your arm at every session.
  ZH: 每次透析都要在手臂上插两根针。
- `hd.body.harder.2` · harder · [NKF-NOC]
  EN: Some people feel tired or dizzy, or get cramps, during or after a session.
  ZH: 有些人在透析时或透析后会觉得疲倦、头晕或抽筋。

**Transplant**
- `tx.body.harder.1` · harder · [NKF-TX]
  EN: It is a major operation, with a hospital stay of about 5 to 7 days.
  ZH: 这是一个大手术，需要住院大约五到七天。
- `tx.body.harder.2` · harder · [KHA-G]
  EN: Anti-rejection medicine can have side effects. Your team will explain them.
  ZH: 抗排斥药物可能有副作用，医疗团队会向您说明。
- `tx.body.practical.1` · practical · [NKF-TX]
  EN: Doctors first check your overall health to see if a transplant is safe for you.
  ZH: 医生会先检查您的整体健康，看看移植对您是否安全。

**CKM**
- `ckm.body.helps.1` · helps · [KHA-G]
  EN: No operations are needed.
  ZH: 不需要做任何手术。
- `ckm.body.practical.1` · practical · [NKF-KSC]
  EN: Symptoms such as tiredness, itch or poor appetite may increase over time. Your team will help you manage them.
  ZH: 疲倦、瘙痒或胃口差等症状可能会慢慢增加，医疗团队会帮您处理。

### 6.9 `comfort` — Feeling comfortable day to day

**PD**
- `pd.comfort.helps.1` · helps · [NKF-PD]
  EN: It works slowly and all the time, like your own kidneys. Many people find it gentler, with fewer food limits than haemodialysis.
  ZH: 它像自己的肾脏一样，慢慢地、持续地工作。很多人觉得比较温和，饮食限制也比血液透析少。

**HD**
- `hd.comfort.harder.1` · harder · [KHA-G]
  EN: There are more limits on food and drink between sessions.
  ZH: 两次透析之间，饮食和喝水的限制比较多。
- `hd.comfort.practical.1` · practical · [NKF-NOC]
  EN: Overnight dialysis works more slowly, which can mean fewer problems such as dizziness and cramps for people who are suitable.
  ZH: 夜间透析比较慢，对适合的人来说，头晕、抽筋等问题可能会比较少。

**Transplant**
- `tx.comfort.helps.1` · helps · [NKF-TX]
  EN: There are fewer limits on food and drink, and many people feel much better.
  ZH: 饮食和喝水的限制较少，很多人会觉得身体好很多。

**CKM**
- `ckm.comfort.helps.1` · helps · [KHA-G, NKF-KSC]
  EN: Care focuses on your comfort and quality of life.
  ZH: 护理的重点是您的舒适和生活质量。
- `ckm.comfort.practical.1` · practical · [KHA-G]
  EN: Some changes to what you eat and drink may still be needed.
  ZH: 可能仍然需要调整饮食和喝水。

### 6.10 `longevity` — How long I may live (handed to care team)

- `common.longevity.ask-team.1` · ask-team · [RRT, MYK]
  EN: How each choice may affect how long you live depends on your age and your other health conditions. Your kidney doctor can explain this for you personally.
  ZH: 每种选择会怎样影响寿命，要看您的年龄和其他健康状况。肾科医生可以根据您的情况为您说明。

### 6.11 `cost` — Costs (handed to care team)

- `common.cost.ask-team.1` · ask-team · [NKF-TX, NKF-PD]
  EN: Costs and financial help differ for each option and depend on your situation. Your medical social worker or care team can explain what applies to you.
  ZH: 每种方式的费用和经济援助都不一样，也要看您的情况。医疗社工或医疗团队可以告诉您适用的安排。

## 7. Display rules for sensitive content

- ⚠ GATE statements (`tx.time.practical.1`, `tx.family.practical.2`) mention living donation. Show them only if the patient did not defer or keep private the sensitive topic (`sensitive-1`). Otherwise show transplant statements without them.
- Never show the myKIDNEY finding about survival benefit of dialysis in older adults. Longevity is always `ask-team`.

## 8. Balance check

Every option has at least one statement in every dimension from `independence` to `comfort`. Counts of `helps` vs `harder`:

| Option | helps | harder | practical |
|---|---|---|---|
| PD | 8 | 6 | 8 |
| HD | 5 | 9 | 6 |
| Transplant | 6 | 5 | 8 |
| CKM | 6 | 1 | 6 |

CKM has few `harder` statements because most of its trade-offs (length of life, symptoms over time) sit in `ask-team` or `practical`.
