import { addDays } from '../../lib/date';
import type {
  Assignment,
  AssignmentStatus,
  Block,
  BlockItem,
  BlockSettings,
  Comment,
  Exercise,
  Invite,
  ISODate,
  ItemTarget,
  MeasuredAs,
  Package,
  Profile,
  Program,
  Workout,
  WorkoutLog,
} from '../../types';
import { parseVideoUrl, thumbnailFor, videoUrlFor } from '../videoLink';
import { STARTER_EXERCISES } from '../starterLibrary';

export interface MockDB {
  version: 2;
  profiles: Profile[];
  exercises: Exercise[];
  workouts: Workout[];
  programs: Program[];
  assignments: Assignment[];
  logs: WorkoutLog[];
  comments: Comment[];
  packages: Omit<Package, 'sessionsRemaining' | 'state'>[];
  /** Added after v1 shipped; older saved demo data has none. */
  invites?: Invite[];
  seq: number;
}

export const WORKSPACE_ID = 'ws_nasser';
export const COACH_ID = 'u_coach';
export const CLIENT_IDS = { sara: 'u_sara', karim: 'u_karim', mona: 'u_mona', youssef: 'u_youssef' } as const;

/** Titles the mock "oEmbed" returns for the library's demo links. */
export const VIDEO_TITLES: Record<string, string> = {};


// ---------- exercises ----------

type ExerciseSeed = [
  id: string,
  name: string,
  measuredAs: MeasuredAs,
  tags: string[],
  equipment: string[],
  video?: string,
  cues?: string,
];

const EXERCISES: ExerciseSeed[] = [
  ['back_squat', 'Back Squat', 'weight_reps', ['legs'], ['barbell'], 'https://www.youtube.com/watch?v=ultWZbUMPL8', 'Brace first, knees track over toes, drive through the whole foot.'],
  ['front_squat', 'Front Squat', 'weight_reps', ['legs', 'core'], ['barbell'], 'https://youtu.be/uYumuL_G_V0', 'Elbows high, chest tall.'],
  ['deadlift', 'Deadlift', 'weight_reps', ['pull', 'legs'], ['barbell'], 'https://www.youtube.com/watch?v=op9kVnSso6Q', 'Bar over mid-foot, lats on, push the floor away.'],
  ['rdl', 'Romanian Deadlift', 'weight_reps', ['pull', 'legs'], ['barbell', 'dumbbell'], 'https://www.youtube.com/watch?v=JCXUYuzwNrM', 'Soft knees, hips back, bar close to the legs.'],
  ['bench_press', 'Bench Press', 'weight_reps', ['push'], ['barbell'], 'https://www.youtube.com/watch?v=rT7DgCr-3pg', 'Shoulder blades pinned, touch low chest.'],
  ['overhead_press', 'Overhead Press', 'weight_reps', ['push'], ['barbell'], 'https://www.youtube.com/watch?v=_RlRDWO2jfg', 'Squeeze glutes, head through at the top.'],
  ['pull_up', 'Pull-up', 'reps', ['pull'], ['bodyweight'], 'https://www.youtube.com/watch?v=eGo4IYlbE5g', 'Start from a dead hang, chin over the bar.'],
  ['push_up', 'Push-up', 'reps', ['push'], ['bodyweight'], 'https://www.youtube.com/shorts/IODxDxX7oi4', 'Body in one line, elbows about 45 degrees.'],
  ['db_row', 'Dumbbell Row', 'weight_reps', ['pull'], ['dumbbell'], 'https://www.youtube.com/watch?v=pYcpY20QaE8'],
  ['goblet_squat', 'Goblet Squat', 'weight_reps', ['legs'], ['kettlebell', 'dumbbell'], 'https://vimeo.com/76979871', 'Hold the weight at the chest, sit between the heels.'],
  ['kb_swing', 'Kettlebell Swing', 'reps', ['full body'], ['kettlebell'], 'https://www.youtube.com/watch?v=YSxHifyI6s8', 'Hinge, do not squat. Snap the hips.'],
  ['walking_lunge', 'Walking Lunge', 'weight_reps', ['legs'], ['dumbbell'], 'https://www.youtube.com/watch?v=L8fvypPrzzs'],
  ['plank', 'Plank', 'time', ['core'], ['bodyweight'], 'https://www.youtube.com/watch?v=ASdvN_XEl_c', 'Ribs down, squeeze the glutes.'],
  ['hollow_hold', 'Hollow Hold', 'time', ['core'], ['bodyweight'], 'https://www.youtube.com/watch?v=LlDNef_Ztsc'],
  ['burpee', 'Burpee', 'reps', ['full body'], ['bodyweight'], 'https://www.youtube.com/watch?v=dZgVxmf6jkA'],
  ['box_jump', 'Box Jump', 'reps', ['legs'], ['other'], 'https://www.youtube.com/watch?v=NBY9-kTuHEk', 'Land softly, stand tall on top.'],
  ['wall_ball', 'Wall Ball', 'reps', ['full body'], ['other'], 'https://www.youtube.com/watch?v=EqF8k7GkKPg'],
  ['row_erg', 'Rowing Machine', 'distance', ['full body'], ['machine'], 'https://vimeo.com/230213521', 'Legs, body, arms. Reverse on the way back.'],
  ['assault_bike', 'Assault Bike', 'distance', ['full body'], ['machine'], 'https://www.youtube.com/watch?v=mo4WqRqjl0c'],
  ['thruster', 'Thruster', 'weight_reps', ['full body', 'legs', 'push'], ['barbell'], 'https://www.youtube.com/watch?v=L219ltL15zk'],
  ['air_squat', 'Air Squat', 'reps', ['legs'], ['bodyweight'], 'https://www.youtube.com/watch?v=C_VtOYc6j5c'],
  ['sit_up', 'Sit-up', 'reps', ['core'], ['bodyweight']],
  ['mountain_climber', 'Mountain Climber', 'reps', ['core', 'full body'], ['bodyweight'], 'https://www.youtube.com/watch?v=nmwgirgXLYM'],
  ['band_pull_apart', 'Band Pull-Apart', 'reps', ['pull'], ['bands'], 'https://www.youtube.com/watch?v=JObYuYBe5AQ', 'Keep the ribs down, finish with arms wide.'],
  ['farmer_carry', 'Farmer Carry', 'distance', ['full body', 'core'], ['kettlebell', 'dumbbell'], 'https://www.youtube.com/watch?v=UNAVAIL0001', 'Tall posture, short quick steps.'],
  ['handstand_hold', 'Handstand Hold', 'time', ['push', 'core'], ['bodyweight']],
];

const STARTER: ExerciseSeed[] = STARTER_EXERCISES.map(([key, name, measuredAs, tags, equipment, youtubeId, cue]) => [key, name, measuredAs, tags, equipment, `https://www.youtube.com/watch?v=${youtubeId}`, cue]);

function buildExercises(createdAt: string): Exercise[] {
  const taken = new Set(EXERCISES.map((e) => e[1].toLowerCase()));
  return [...EXERCISES, ...STARTER.filter((e) => !taken.has(e[1].toLowerCase()))].map(([id, name, measuredAs, tags, equipment, video, cues]) => {
    const parsed = video ? parseVideoUrl(video) : undefined;
    if (parsed) VIDEO_TITLES[parsed.videoId] = name;
    return {
      id: `ex_${id}`,
      workspaceId: WORKSPACE_ID,
      name,
      ...(parsed && {
        videoUrl: videoUrlFor(parsed),
        videoProvider: parsed.provider,
        videoId: parsed.videoId,
        thumbnailUrl: thumbnailFor(parsed),
      }),
      equipment,
      tags,
      measuredAs,
      ...(cues && { cues }),
      linkStatus: id === 'farmer_carry' ? 'unavailable' : parsed ? 'ok' : 'unchecked',
      createdAt,
    } satisfies Exercise;
  });
}

// ---------- workouts ----------

let seq = 0;
const nid = (prefix: string) => `${prefix}_${++seq}`;

const item = (exerciseKey: string, exercises: Exercise[], target: ItemTarget): BlockItem => {
  const ex = exercises.find((e) => e.id === `ex_${exerciseKey}`);
  if (!ex) throw new Error(`Unknown seed exercise ${exerciseKey}`);
  return { id: nid('it'), exerciseId: ex.id, exerciseName: ex.name, target };
};

const block = (title: string, settings: BlockSettings, items: BlockItem[]): Block => ({ id: nid('bl'), title, settings, items });

function buildTemplates(ex: Exercise[]): Workout[] {
  const tpl = (title: string, blocks: Block[]): Workout => ({ id: nid('wo'), workspaceId: WORKSPACE_ID, title, isTemplate: true, blocks });
  return [
    tpl('Strength A: Lower', [
      block('Warm-up', { type: 'standard' }, [
        item('goblet_squat', ex, { sets: 2, reps: 10, loadNote: 'Light', restSec: 30 }),
        item('band_pull_apart', ex, { sets: 2, reps: 15, restSec: 30 }),
        item('plank', ex, { sets: 2, durationSec: 30, restSec: 30 }),
      ]),
      block('Main lift', { type: 'standard' }, [
        item('back_squat', ex, { sets: 5, reps: 5, loadNote: '80% of 1RM', restSec: 120, notes: 'Pause one second at the bottom of the last rep.' }),
        item('rdl', ex, { sets: 3, reps: 8, loadNote: 'Moderate', restSec: 90 }),
      ]),
      block('Finisher', { type: 'standard' }, [item('hollow_hold', ex, { sets: 3, durationSec: 30, restSec: 45 })]),
    ]),
    tpl('Metcon: AMRAP 12', [
      block('Warm-up', { type: 'standard' }, [
        item('air_squat', ex, { sets: 2, reps: 15, restSec: 20 }),
        item('push_up', ex, { sets: 2, reps: 8, restSec: 20 }),
      ]),
      block('AMRAP 12 min', { type: 'amrap', capSec: 720 }, [
        item('wall_ball', ex, { reps: 10 }),
        item('kb_swing', ex, { reps: 15 }),
        item('burpee', ex, { reps: 5 }),
      ]),
    ]),
    tpl('Engine: EMOM 10', [
      block('EMOM 10 min', { type: 'emom', totalMin: 10, intervalSec: 60 }, [
        item('kb_swing', ex, { reps: 12 }),
        item('push_up', ex, { reps: 10 }),
      ]),
    ]),
    tpl('For Time: Thruster and Pull-up', [
      block('For time', { type: 'for_time', rounds: 3, capSec: 600 }, [
        item('thruster', ex, { reps: 15, loadNote: '40 kg' }),
        item('pull_up', ex, { reps: 12 }),
      ]),
    ]),
    tpl('Core Finisher: Tabata', [
      block('Tabata', { type: 'tabata', workSec: 20, restSec: 10, rounds: 8 }, [
        item('mountain_climber', ex, {}),
        item('sit_up', ex, {}),
      ]),
    ]),
    tpl('Custom Intervals', [
      block('Conditioning', {
        type: 'custom',
        steps: [
          { label: 'Row', kind: 'work', durationSec: 90 },
          { label: 'Rest', kind: 'rest', durationSec: 30 },
          { label: 'Burpees', kind: 'work', durationSec: 60 },
          { label: 'Rest', kind: 'rest', durationSec: 30 },
          { label: 'Bike', kind: 'work', durationSec: 90 },
          { label: 'Rest', kind: 'rest', durationSec: 30 },
        ],
      }, []),
    ]),
    tpl('Full Body Day', [
      block('Warm-up', { type: 'standard' }, [item('band_pull_apart', ex, { sets: 2, reps: 15, restSec: 30 })]),
      block('Strength', { type: 'standard' }, [
        item('bench_press', ex, { sets: 4, reps: 6, loadNote: 'Heavy but clean', restSec: 120 }),
        item('db_row', ex, { sets: 4, reps: 8, restSec: 90 }),
        item('overhead_press', ex, { sets: 3, reps: 8, restSec: 90 }),
      ]),
      block('Metcon', { type: 'amrap', capSec: 480 }, [item('push_up', ex, { reps: 10 }), item('air_squat', ex, { reps: 15 })]),
      block('Cool-down', { type: 'standard' }, [item('plank', ex, { sets: 2, durationSec: 45, restSec: 30 })]),
    ]),
  ];
}

export function cloneWorkout(w: Workout, nextId: (prefix: string) => string): Workout {
  return {
    ...structuredClone(w),
    id: nextId('wo'),
    isTemplate: false,
    blocks: w.blocks.map((b) => ({
      ...structuredClone(b),
      id: nextId('bl'),
      items: b.items.map((i) => ({ ...structuredClone(i), id: nextId('it') })),
    })),
  };
}

// ---------- logs ----------

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function buildLog(a: Assignment, dayIndex: number, exercises: Exercise[]): WorkoutLog {
  const itemResults: WorkoutLog['itemResults'] = [];
  const timerResults: WorkoutLog['timerResults'] = [];
  for (const b of a.workout.blocks) {
    if (b.settings.type === 'standard') {
      for (const it of b.items) {
        const measured = exercises.find((e) => e.id === it.exerciseId)?.measuredAs ?? 'reps';
        const sets = Array.from({ length: it.target.sets ?? 3 }, () => {
          if (measured === 'weight_reps') {
            const load = 30 + (hash(it.exerciseId) % 40) + dayIndex * 2.5;
            return { reps: it.target.reps ?? 8, load: `${load} kg` };
          }
          if (measured === 'time') return { durationSec: (it.target.durationSec ?? 30) + dayIndex * 2 };
          return { reps: (it.target.reps ?? 10) + (dayIndex % 3) };
        });
        itemResults.push({ itemId: it.id, sets });
      }
    } else {
      const s = b.settings;
      timerResults.push({
        blockId: b.id,
        result:
          s.type === 'amrap'
            ? { kind: 'amrap', rounds: 5 + (dayIndex % 3), extraReps: 3 + dayIndex }
            : s.type === 'for_time'
              ? { kind: 'for_time', finishSec: 487 + dayIndex * 7, capped: false }
              : { kind: s.type, completed: true },
      });
    }
  }
  return {
    id: nid('lg'),
    assignmentId: a.id,
    startedAt: `${a.date}T07:30:00.000Z`,
    completedAt: `${a.date}T08:25:00.000Z`,
    itemResults,
    timerResults,
    ...(dayIndex % 2 === 0 && { clientNote: 'Felt strong today. Last set was tough.' }),
  };
}

// ---------- the seed ----------

export function createSeed(today: ISODate): MockDB {
  seq = 0;
  const created = `${addDays(today, -60)}T09:00:00.000Z`;
  const exercises = buildExercises(created);
  const templates = buildTemplates(exercises);
  const T = (n: number) => templates[n] as Workout;

  const profiles: Profile[] = [
    { id: COACH_ID, workspaceId: WORKSPACE_ID, role: 'coach', name: 'Omar Nasser', email: 'omar@nasserstrength.example' },
    { id: CLIENT_IDS.sara, workspaceId: WORKSPACE_ID, role: 'client', name: 'Sara Khaled', email: 'sara@example.com' },
    { id: CLIENT_IDS.karim, workspaceId: WORKSPACE_ID, role: 'client', name: 'Karim Adel', email: 'karim@example.com' },
    { id: CLIENT_IDS.mona, workspaceId: WORKSPACE_ID, role: 'client', name: 'Mona Fathy', email: 'mona@example.com' },
    { id: CLIENT_IDS.youssef, workspaceId: WORKSPACE_ID, role: 'client', name: 'Youssef Tarek', email: 'youssef@example.com' },
  ];

  const programs: Program[] = [
    {
      id: nid('pr'),
      workspaceId: WORKSPACE_ID,
      title: '4-Week Foundation',
      days: [
        [0, 0], [2, 6], [4, 1], [7, 0], [9, 6], [11, 2], [14, 0], [16, 6], [18, 3], [21, 0], [23, 6], [25, 4],
      ].map(([dayOffset, t]) => ({ dayOffset: dayOffset as number, workoutId: T(t as number).id })),
    },
  ];

  const assignments: Assignment[] = [];
  const logs: WorkoutLog[] = [];
  const comments: Comment[] = [];

  const assign = (clientId: string, offset: number, t: number, status: AssignmentStatus, dayIndex = 0) => {
    const a: Assignment = {
      id: nid('as'),
      workspaceId: WORKSPACE_ID,
      clientId,
      date: addDays(today, offset),
      workout: cloneWorkout(T(t), nid),
      status,
    };
    assignments.push(a);
    if (status === 'completed') logs.push(buildLog(a, dayIndex, exercises));
    if (status === 'in_progress') {
      logs.push({ id: nid('lg'), assignmentId: a.id, startedAt: `${a.date}T17:05:00.000Z`, itemResults: [], timerResults: [] });
    }
    return a;
  };

  // Sara: steady history, one skip, today's workout waiting.
  assign(CLIENT_IDS.sara, -20, 0, 'completed', 0);
  assign(CLIENT_IDS.sara, -17, 6, 'completed', 0);
  assign(CLIENT_IDS.sara, -13, 0, 'completed', 1);
  assign(CLIENT_IDS.sara, -10, 6, 'completed', 1);
  const saraSquat = assign(CLIENT_IDS.sara, -6, 0, 'completed', 2);
  assign(CLIENT_IDS.sara, -4, 1, 'completed', 3);
  assign(CLIENT_IDS.sara, -2, 4, 'skipped');
  assign(CLIENT_IDS.sara, 0, 6, 'not_started');
  assign(CLIENT_IDS.sara, 2, 2, 'not_started');
  assign(CLIENT_IDS.sara, 4, 0, 'not_started');

  // Karim: a workout in progress.
  assign(CLIENT_IDS.karim, -12, 0, 'completed', 0);
  assign(CLIENT_IDS.karim, -5, 0, 'completed', 2);
  assign(CLIENT_IDS.karim, -3, 3, 'completed', 1);
  assign(CLIENT_IDS.karim, -1, 4, 'in_progress');
  assign(CLIENT_IDS.karim, 0, 1, 'not_started');
  assign(CLIENT_IDS.karim, 1, 6, 'not_started');

  // Mona: a completed workout with a coach comment.
  assign(CLIENT_IDS.mona, -7, 6, 'completed', 0);
  const monaDone = assign(CLIENT_IDS.mona, -3, 5, 'completed', 1);
  assign(CLIENT_IDS.mona, 0, 5, 'not_started');
  assign(CLIENT_IDS.mona, 2, 1, 'not_started');

  // Youssef: nothing today.
  assign(CLIENT_IDS.youssef, -4, 6, 'completed', 0);
  assign(CLIENT_IDS.youssef, -2, 2, 'completed', 1);
  assign(CLIENT_IDS.youssef, 1, 0, 'not_started');

  // Sara and Karim follow the foundation program; Mona and Youssef have single workouts.
  const foundation = programs[0]?.id;
  for (const a of assignments) if (a.clientId === CLIENT_IDS.sara || a.clientId === CLIENT_IDS.karim) a.programId = foundation;

  const stamp = (a: Assignment, hh: string) => `${a.date}T${hh}:00.000Z`;
  comments.push(
    { id: nid('cm'), assignmentId: saraSquat.id, authorId: COACH_ID, authorName: 'Omar Nasser', authorRole: 'coach', body: 'Great depth on the last set. Add 2.5 kg next week.', createdAt: stamp(saraSquat, '12:10') },
    { id: nid('cm'), assignmentId: saraSquat.id, authorId: CLIENT_IDS.sara, authorName: 'Sara Khaled', authorRole: 'client', body: 'Will do. The fourth set felt heavy.', createdAt: stamp(saraSquat, '13:02') },
    { id: nid('cm'), assignmentId: monaDone.id, authorId: COACH_ID, authorName: 'Omar Nasser', authorRole: 'coach', body: 'Good intensity for a heavy day. Rest well tonight.', createdAt: stamp(monaDone, '10:45') },
  );

  const packages: MockDB['packages'] = [
    { id: nid('pk'), workspaceId: WORKSPACE_ID, clientId: CLIENT_IDS.sara, name: '10 Session Pack', sessionsIncluded: 10, sessionsUsed: 8, expiresOn: addDays(today, 9), paymentReceived: true },
    { id: nid('pk'), workspaceId: WORKSPACE_ID, clientId: CLIENT_IDS.karim, name: '12 Session Pack', sessionsIncluded: 12, sessionsUsed: 3, expiresOn: addDays(today, 70), paymentReceived: true },
    { id: nid('pk'), workspaceId: WORKSPACE_ID, clientId: CLIENT_IDS.mona, name: '8 Session Pack', sessionsIncluded: 8, sessionsUsed: 5, expiresOn: addDays(today, 40), paymentReceived: false },
  ];

  return { version: 2, profiles, exercises, workouts: templates, programs, assignments, logs, comments, packages, seq };
}
