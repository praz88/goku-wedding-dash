// ============================================================================
//  STORY, LORE AND ANOMALIES — the only file most contributors need to touch.
//  g = [name1, name2, name3] (the three who got away; roast-mode names or defaults)
// ============================================================================

export const DEFAULT_NAMES = ['The one from college', 'The one from the café', 'The one who waited'];

export const TIMES = ['Fri 11:58 PM', 'Sat 12:40 AM', 'Sat 1:30 AM', 'Sat 3:15 AM', 'Sat 5:00 AM', 'Sat 11:00 PM', 'Sun 2:00 AM', 'Sun 5:45 AM', 'Sun 6:30 AM'];

export const STORY = (g) => [
  { tag: 'PROLOGUE', title: 'The man who always picks up', text:
`This is <b>Goku</b>.

Engineer by degree, banker by a campus placement he attended for the free lunch. He became a <b>branch manager</b> because he was the only one who answered every call.

That is the problem. He answers <i>every</i> call.

On Sunday morning, at 6:30, there is a <b>muhurtha</b>. A mantapa. A thaali. Four hundred relatives. A purohit who has done four thousand weddings and will not wait for a four-thousand-and-first.

It is Friday, 11:58 PM. Goku is still in the branch.

He just has to walk out.` },

  { tag: 'NIGHT 1', title: 'The hall', text:
`The branch after hours is one long hall. The Regional Manager's cabin on the left. The strong room. The counters with their shutters down. His own desk on the right, under the Chairman. The waiting bench nobody ever leaves. The ATM. The exit.

He has walked it a thousand times.

Tonight it feels like the hall is walking him.

<b>Rule of the branch:</b> walk to the far door if it's a normal night. Walk back to the door behind you if anything is wrong. Eight walks before the muhurtha. Look at everything.` },

  { tag: 'NIGHT 1 · LATER', title: 'The Manager', text:
`About the <b>Manager</b>.

Not Goku. Goku's manager. The Regional one. The one who says "just 2 hours" on a Saturday and means the whole Saturday. The one who said, when Goku announced the wedding: <i>"Good, good. Which weekend?"</i>

He keeps a cabin in the branch for his "visits". Nobody has seen him leave it. Ever.

Its door is on the left, near the front. It is always closed. Keep it that way.` },

  { tag: 'NIGHT 2', title: 'The customers', text:
`About the <b>customers</b>.

A manager's customers don't take tokens. They take <i>time</i>. The NPA uncle who says "next month pakka". The depositor who wants 0.5% more or he walks. The one who just wants <b>one signature</b>, sir, one only, sir.

They come at 9. They are still there at 6. Some of them, Goku suspects, never left the bench at all.` },

  { tag: 'NIGHT 2 · LATER', title: g[0], text:
`About <b>${g[0]}</b>.

College. Hostel mess, 2 AM Maggi, the walk to the beach. She said: "You're going to be a different person once you have a job."

He said he wouldn't.

He took a call during their last dinner. "Sir, net banking not working." It was not even his customer.

She is in the branch tonight. Don't look at the water cooler for too long.` },

  { tag: 'NIGHT 3', title: g[1], text:
`About <b>${g[1]}</b>.

Second bank. The café opposite the branch. She made the coffee; he made the excuses. Three months of "one day I'll come at 4 PM and we'll just sit".

He came at 4 PM once. The phone rang. She watched him take it.

The café closed last year. She didn't. She's just… waiting, somewhere near the strong room.` },

  { tag: 'NIGHT 3 · LATER', title: g[2], text:
`About <b>${g[2]}</b>.

The one the families arranged. The one who said, "I know bank timings. I'll wait."

She waited. Through the audit, the transfer, the year-end, the quarter-end, the month-end, the week-end that was never an end.

She is the one at the mantapa on Sunday. She is <i>still</i> waiting. That's the whole game.` },

  { tag: 'SUNDAY', title: 'The last walk', text:
`Sunday, 5:45 AM. Jasmine, nadaswara, a purohit checking his watch.

The branch is between Goku and the mantapa. It has always been.

Phone in pocket. Switched off — he thinks. The hall is quiet in a way that halls are not.

One more walk.` },

  { tag: 'MUHURTHA', title: '6:30 AM', text: `` },
];

export const WIN_TEXT = (g) =>
`He walked out. The exit said EXIT. The auto was waiting. The purohit was not, quite, but close enough.

<b>${g[2]}</b> looked up. She had been waiting a long time. She said: "Phone?"

He held it up. Switched off. Properly, this time.

Somewhere in the branch, a cabin door closed on its own. The Manager will call on Monday. Monday is allowed.

<b>Congratulations, Goku.</b>`;

export const LOSE_TEXT = 'The muhurtha passed. The branch opened. It is always, somehow, Friday.';

// What you read when you tap a thing on a normal night.
export const LORE = {
  clock: 'Branch clock. Ajanta. It has said the wrong time since 2019. Nobody fixed it; the customers never leave anyway.',
  token: 'Token display. NOW SERVING. It counts the people who have been dealt with. It has never once reached the number of people waiting.',
  calendar: 'Wall calendar from an insurance partner. Sunday is circled in red: MUHURTHA 6:30. Goku circled it himself. Twice.',
  portrait: 'Portrait of the Chairman. Watches over the hall. Has never once called on a weekend. Goku respects him for that.',
  notice: 'Noticeboard. TARGET 110%. CASA drive. "Smile, you are the face of the bank." Someone has drawn a small, tired face under it.',
  npa: 'NPA board. Overdue accounts, written in red by hand because the printer gave up in 2021. The uncle on line 2 says "next month pakka" every month.',
  cabin: 'The Regional Manager\'s cabin. Door closed. Light off. Goku has never seen him leave. He has also never seen him arrive.',
  bench: 'The waiting bench. Steel, three seats, bolted to the floor in 2015 after an incident. Everyone sits facing the counters, waiting for "one signature".',
  desk: 'Goku\'s desk. Monitor, a half-signed file, the phone. The desk phone is for customers. The mobile is for the Manager. Both are for weekends.',
  lamp: 'The green banker\'s lamp. A gift from the previous branch manager, who retired, and then came back as a customer, and then as an NPA.',
  cooler: 'Water cooler. Hasn\'t been refilled since the AMC guy stopped answering Goku\'s calls. Poetic, really.',
  plant: 'Money plant. Gift from a customer whose loan got sanctioned. The only thing in the branch that grew this year.',
  vault: 'The strong room. Twelve-inch steel door, two keys, one of them Goku\'s. Locker Aunty has function today. Locker Aunty always has function today.',
  counter: 'The counters. CASH 1, CASH 2, ENQUIRY. Shutters down. The tellers went home at 6 like sane people.',
  exit: 'The EXIT. Green sign. Beyond it: the road, the auto, the mantapa. It has never looked this far away.',
  entry: 'The door he came in through. STAFF ONLY. It leads back to the start of the hall. Somehow, it always has.',
  atm: 'ATM lobby. Out of cash on the 1st, out of order on the 2nd. On the 3rd it dispenses receipts to nobody.',
  cctv: 'Security desk. CCTV monitor shows the hall. Shows the bench. Shows a man who should have gone home three hours ago. The guard went home three hours ago.',
  fan: 'Ceiling fan. Regulator at 3 since the AC died. It wobbles. It has wobbled for six years. One day it will stop wobbling, and that will be worse.',
  ac: 'Split AC. Dead since March. Drips when it rains, which is a thing dead ACs apparently do.',
  poster: 'Bank poster. "Beware of fraud calls. Never share your OTP." Goku has answered forty thousand calls. Not one of them was a fraud. He almost wishes.',
  extinguisher: 'Fire extinguisher. Inspected monthly. The inspection sticker says the inspector is "available on call".',
  bin: 'Dustbin. Contains: three empty tea cups, one torn target sheet, and a wedding card that fell in by accident. Probably by accident.',
};

// Anomalies. One per walk at most. `prop` = which thing to tap to read the creepy version.
// Scene-side effects live in scene.js (APPLY table) under the same id.
export const ANOMS = (g) => [
  { id: 'clock_back',   prop: 'clock',    lore: 'The clock is running backwards. Fast. Towards Friday. Towards every Friday.', reveal: 'The clock was running backwards.' },
  { id: 'clock_nine',   prop: 'clock',    lore: 'The clock says 9:00. Branch opening time. It is the middle of the night.', reveal: 'The clock showed 9 AM — opening time — at night.' },
  { id: 'token_goku',   prop: 'token',    lore: 'NOW SERVING: GOKU. The display has never shown a name. It does not have the characters for a name. It is showing a name.', reveal: 'The token display said NOW SERVING: GOKU.' },
  { id: 'cal_working',  prop: 'calendar', lore: 'The red circle is gone. In its place, in the Manager\'s handwriting: SUN — WORKING.', reveal: 'The calendar marked Sunday as a working day.' },
  { id: 'portrait_mgr', prop: 'portrait', lore: 'That is not the Chairman. That is the Manager. He is moving. His mouth is making the words "which weekend", over and over, with no sound.', reveal: 'The Chairman\'s portrait was the Manager, and it was talking.' },
  { id: 'notice_goku',  prop: 'notice',   lore: 'TARGET: GOKU. Before the muhurtha. Someone has pinned his wedding card underneath.', reveal: 'The noticeboard target was GOKU.' },
  { id: 'npa_goku',     prop: 'npa',      lore: 'The overdue list has three new entries. All of them are him.', reveal: 'The NPA board listed Goku — wedding, sleep, Sunday — as overdue.' },
  { id: 'cabin_eyes',   prop: 'cabin',    lore: 'The cabin door is open a hand\'s width. There is a face in the gap, at eye height, lit from below. It is very patient. It is very, very still.', reveal: 'The Manager\'s cabin door was ajar. He was in the gap, watching.' },
  { id: 'cabin_shoes',  prop: 'cabin',    lore: 'Seven pairs of shoes outside the Manager\'s cabin. Identical. Nobody is supposed to be inside.', reveal: 'Seven pairs of shoes outside an empty cabin.' },
  { id: 'bench_face',   prop: 'bench',    lore: 'The customers are standing behind the bench. All three. They have turned around. They are looking at Goku. They want one signature.', reveal: 'The customers had turned to face you.' },
  { id: 'bench_noface', prop: 'bench',    lore: 'The uncle at the bench has no face. Smooth, like a thumb. He is holding a file. He says "one signature, sir" without a mouth.', reveal: 'The customer at the bench had no face.' },
  { id: 'phone_glow',   prop: 'desk',     lore: 'The phone is switched off. It is also glowing red. 47 missed calls, all from Manager, all from the last four minutes.', reveal: 'The switched-off phone was glowing with 47 missed calls.' },
  { id: 'desk_thaali',  prop: 'desk',     lore: 'There is a thaali on his desk, under the lamp. It is not Sunday. It is not his to have yet. It is warm.', reveal: 'There was a thaali on the desk, two days early.' },
  { id: 'cooler_red',   prop: 'cooler',   lore: 'The cooler has been refilled. Not with water.', reveal: 'The water cooler was full of something red.' },
  { id: 'cooler_ghost1',prop: 'cooler',   lore: `${g[0]} is standing at the cooler, the way she stood at the mess counter in college. She says: "You said you wouldn't change." Her voice is a phone ringing.`, reveal: `${g[0]} was at the water cooler.`, ghost: 0 },
  { id: 'plant_grow',   prop: 'plant',    lore: 'The money plant has reached the ceiling. It is wrapped around the tube light. It has had a better year than Goku.', reveal: 'The money plant had grown into the ceiling.' },
  { id: 'vault_open',   prop: 'vault',    lore: 'The strong room is open. Both keys are in the lock. Goku\'s is one of them. Goku\'s key is in his pocket. He checks. It is in his pocket.', reveal: 'The strong room door was open.' },
  { id: 'vault_ghost2', prop: 'vault',    lore: `${g[1]} is outside the strong room with a coffee cup, still steaming. She made it at 4 PM, a year ago. She asks: "Are you coming at 4?" He took the call.`, reveal: `${g[1]} was waiting at the strong room.`, ghost: 1 },
  { id: 'counter_open', prop: 'counter',  lore: 'CASH 1 is open. The shutter is up, the counter light is on, and someone is sitting behind the glass at midnight, counting. Not money.', reveal: 'CASH 1 was open at midnight, with a teller still counting.' },
  { id: 'exit_entry',   prop: 'exit',     lore: 'The sign over the door says ENTRY. In red. The hall, it turns out, only goes one way.', reveal: 'The EXIT sign said ENTRY.' },
  { id: 'exit_dark',    prop: 'exit',     lore: 'The light behind the exit door is gone. No mantapa glow. No rain. Just glass, and whatever is on the other side of a door with no light.', reveal: 'The light behind the exit had gone out.' },
  { id: 'mantapa_ghost3',prop: 'exit',    lore: `Through the glass of the exit, in the warm light, ${g[2]} is standing in full bridal wear at 2 AM. She has been standing there since the engagement. She is very patient. That is the scary part.`, reveal: `${g[2]} was already at the mantapa, waiting. Too early. Far too patient.`, ghost: 2 },
  { id: 'atm_cards',    prop: 'atm',      lore: 'The ATM is dispensing wedding invitations. Hundreds. All with Sunday\'s date crossed out.', reveal: 'The ATM was dispensing wedding cards.' },
  { id: 'cctv_behind',  prop: 'cctv',     lore: 'CAM 2 shows the hall, live. It shows Goku from behind, looking at CAM 2. Something is standing behind him on the monitor. Don\'t turn around; just turn back.', reveal: 'The CCTV showed something behind you.' },
  { id: 'fan_fast',     prop: 'fan',      lore: 'The fan is at regulator 5. There is no 5. It is screaming. The papers on the noticeboard are perfectly still.', reveal: 'The fan was spinning far too fast.' },
];
