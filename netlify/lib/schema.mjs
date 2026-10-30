/* LHQ Hub records (Postgres). One row per real thing: a session, an SRA, a make-up, a payslip.
   Every table has:
     id   text   made by the app (so a phone can create a record offline and send it later)
     rev  bigint taken from one shared counter on every insert and update: "what changed since rev N" is how devices sync
     ver  int    goes up by one on every update: a save that started from an older ver is refused (no silent overwrite)
     del  bool   records are never removed, only marked deleted, so a device that missed the change can't bring them back
   Migrations run in order, once each, inside a transaction, under a lock (see db.mjs). Never edit a migration that has run:
   add a new one. */

const BASE = `
  id text PRIMARY KEY,
  rev bigint NOT NULL DEFAULT nextval('lhq_rev'),
  ver int NOT NULL DEFAULT 1,
  del boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()`;

export const TABLES = ["settings", "people", "setup_codes", "devices", "students", "guardians", "periods", "groups", "group_students", "slots",
  "sessions", "attendance", "makeups", "sras", "assessments", "marks", "requisitions", "events", "reports", "feedback",
  "pay_profiles", "pay_items", "payslips", "activity"];

const t = (name, cols) => `CREATE TABLE ${name} (${BASE},\n${cols});\nCREATE TRIGGER ${name}_touch BEFORE UPDATE ON ${name} FOR EACH ROW EXECUTE FUNCTION lhq_touch();`;

export const MIGRATIONS = [
  { id: 1, name: "shared records", sql: `
CREATE SEQUENCE lhq_rev;
CREATE FUNCTION lhq_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.rev := nextval('lhq_rev');
  NEW.ver := OLD.ver + 1;
  NEW.updated_at := now();
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END $$;

-- LHQ-wide settings: term dates, holidays, session lengths, time zone, pay rules (scope 'pay' is read only by the Director and pay admins)
${t("settings", `  key text NOT NULL UNIQUE,
  scope text NOT NULL DEFAULT 'all' CHECK (scope IN ('all','staff','pay')),
  value jsonb NOT NULL`)}

-- everyone who signs in. role decides which account opens. Password and PIN hashes never leave the server.
${t("people", `  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('director','admin','tutor','student','parent','bdo')),
  username text UNIQUE,
  email text,
  phone text,
  perms jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'setup' CHECK (status IN ('setup','pin','active','locked','off')),
  pw_salt text, pw_hash text,
  pin_salt text, pin_hash text,
  pv int NOT NULL DEFAULT 1,
  fails int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_seen timestamptz,
  also_tutor boolean NOT NULL DEFAULT false,
  prefs jsonb NOT NULL DEFAULT '{}'`)}
CREATE UNIQUE INDEX people_email ON people (lower(email)) WHERE email IS NOT NULL AND email <> '';

${t("setup_codes", `  person_id text NOT NULL REFERENCES people(id),
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  made_by text REFERENCES people(id)`)}

-- one row per signed-in device, so "Signed in on" can list and sign out each one
${t("devices", `  person_id text NOT NULL REFERENCES people(id),
  label text,
  keep boolean NOT NULL DEFAULT false,
  last_used timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz`)}

-- a student, whether or not they have their own sign-in yet. key = the normalised name the documents (quotes, invoices, cards) use
${t("students", `  person_id text UNIQUE REFERENCES people(id),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  level text, school text, exam text,
  info jsonb NOT NULL DEFAULT '{}'`)}

${t("guardians", `  parent_id text NOT NULL REFERENCES people(id),
  student_id text NOT NULL REFERENCES students(id),
  UNIQUE (parent_id, student_id)`)}

-- a tuition period (from an invoice): term, holiday or a programme. fee is money: hidden from tutors and students
${t("periods", `  student_id text NOT NULL REFERENCES students(id),
  kind text NOT NULL DEFAULT 'term' CHECK (kind IN ('term','holiday','programme')),
  programme text,
  starts date NOT NULL, ends date NOT NULL,
  fee numeric,
  invoice_id text, card_id text`)}

-- who is taught together: one student (one-to-one) or a class. Sessions, SRAs and assessments hang off a group.
${t("groups", `  tutor_id text REFERENCES people(id),
  kind text NOT NULL DEFAULT 'one' CHECK (kind IN ('one','class')),
  name text,
  subject text NOT NULL,
  mode text NOT NULL DEFAULT 'in person' CHECK (mode IN ('in person','online')),
  programme text,
  topics jsonb NOT NULL DEFAULT '[]'`)}

${t("group_students", `  group_id text NOT NULL REFERENCES groups(id),
  student_id text NOT NULL REFERENCES students(id),
  period_id text REFERENCES periods(id),
  target text,
  UNIQUE (group_id, student_id)`)}

-- the timetable: weekday 0 = Sunday. per = 2 for a double. A slot applies between from_date and to_date.
${t("slots", `  group_id text NOT NULL REFERENCES groups(id),
  weekday int NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  starts time NOT NULL, ends time NOT NULL,
  per int NOT NULL DEFAULT 1 CHECK (per IN (1,2)),
  from_date date NOT NULL, to_date date NOT NULL`)}

-- one taught (or missed) session. status: planned | done | missed (nobody came / tutor cancelled) | cancelled (LHQ)
${t("sessions", `  group_id text NOT NULL REFERENCES groups(id),
  day date NOT NULL,
  plan_start time NOT NULL, plan_end time NOT NULL,
  per int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','done','missed','cancelled')),
  reason text,
  actual_start time, actual_end time,
  topics jsonb NOT NULL DEFAULT '[]',
  finished jsonb NOT NULL DEFAULT '[]',
  note text,
  makeup_id text,
  logged_by text REFERENCES people(id),
  logged_at timestamptz`)}
CREATE UNIQUE INDEX sessions_slot ON sessions (group_id, day, plan_start) WHERE NOT del;

-- each student's part in a session. The tutor logs it; the student confirms it or says what was wrong.
-- confirm: pending -> confirmed | disputed -> (tutor) fixed | kept -> (Admin) settled
${t("attendance", `  session_id text NOT NULL REFERENCES sessions(id),
  student_id text NOT NULL REFERENCES students(id),
  present text NOT NULL DEFAULT 'present' CHECK (present IN ('present','late','absent')),
  confirm text NOT NULL DEFAULT 'pending' CHECK (confirm IN ('pending','confirmed','disputed','fixed','kept','settled')),
  dispute_note text, tutor_note text, settle_note text,
  settled_by text REFERENCES people(id),
  UNIQUE (session_id, student_id)`)}

-- a session owed to a student, and the session that makes it up. status: owed | booked (waiting for Admin) | confirmed | declined | done | waived
${t("makeups", `  student_id text NOT NULL REFERENCES students(id),
  group_id text NOT NULL REFERENCES groups(id),
  owed_session_id text REFERENCES sessions(id),
  per int NOT NULL DEFAULT 1,
  why text,
  status text NOT NULL DEFAULT 'owed' CHECK (status IN ('owed','booked','confirmed','declined','done','waived')),
  day date, starts time, ends time,
  booked_by text REFERENCES people(id),
  decided_by text REFERENCES people(id),
  decide_note text,
  made_up_session_id text REFERENCES sessions(id)`)}

-- spaced repetition: review 0 = learning day, then 1..5. status: due | given | in | marked | missed | moved
${t("sras", `  student_id text NOT NULL REFERENCES students(id),
  group_id text NOT NULL REFERENCES groups(id),
  topic text NOT NULL,
  review int NOT NULL CHECK (review BETWEEN 0 AND 5),
  due date NOT NULL,
  back date,
  status text NOT NULL DEFAULT 'due' CHECK (status IN ('due','given','in','marked','missed','moved')),
  score numeric, out_of numeric,
  self_marked boolean NOT NULL DEFAULT false,
  marked_by text REFERENCES people(id),
  UNIQUE (student_id, group_id, topic, review)`)}

${t("assessments", `  group_id text NOT NULL REFERENCES groups(id),
  day date NOT NULL,
  kind text NOT NULL,
  topics jsonb NOT NULL DEFAULT '[]',
  out_of numeric,
  set_by text REFERENCES people(id)`)}

${t("marks", `  assessment_id text NOT NULL REFERENCES assessments(id),
  student_id text NOT NULL REFERENCES students(id),
  score numeric,
  absent boolean NOT NULL DEFAULT false,
  UNIQUE (assessment_id, student_id)`)}

-- status: asked | approved | declined | bought
${t("requisitions", `  tutor_id text NOT NULL REFERENCES people(id),
  item text NOT NULL, qty text, needed_by date, why text,
  status text NOT NULL DEFAULT 'asked' CHECK (status IN ('asked','approved','declined','bought')),
  decided_by text REFERENCES people(id), decide_note text,
  cost numeric, bought_by text REFERENCES people(id)`)}

-- calendar entries that aren't sessions: a student's own (school test, trip), a tutor's for a student, or LHQ's for everyone
${t("events", `  owner_id text REFERENCES people(id),
  student_id text REFERENCES students(id),
  audience text NOT NULL DEFAULT 'me' CHECK (audience IN ('me','shared','lhq')),
  kind text NOT NULL,
  title text NOT NULL,
  day date NOT NULL, at time,
  info jsonb NOT NULL DEFAULT '{}'`)}

-- daily reports: a tutor's (kind 'tutor') or a student's (kind 'student'). body is the form.
${t("reports", `  author_id text NOT NULL REFERENCES people(id),
  student_id text REFERENCES students(id),
  kind text NOT NULL CHECK (kind IN ('tutor','student')),
  day date NOT NULL,
  body jsonb NOT NULL DEFAULT '{}',
  sent_at timestamptz,
  UNIQUE (author_id, kind, day)`)}

-- what a student thinks of a session. Only the student sees their own; LHQ sees averages, never single answers.
${t("feedback", `  student_id text NOT NULL REFERENCES students(id),
  session_id text REFERENCES sessions(id),
  tutor_id text REFERENCES people(id),
  rating int CHECK (rating BETWEEN 1 AND 5),
  prepared boolean, on_time boolean,
  note text`)}

-- how a tutor is paid, from a date. placement: full | part. rates and allowances are the Director's numbers (see calc.mjs)
${t("pay_profiles", `  tutor_id text NOT NULL REFERENCES people(id),
  placement text NOT NULL CHECK (placement IN ('full','part')),
  starts date NOT NULL,
  salary numeric,
  rates jsonb NOT NULL DEFAULT '{}',
  allowances jsonb NOT NULL DEFAULT '[]',
  UNIQUE (tutor_id, starts)`)}

-- one-off money for a month: allowance | bonus | deduction | advance (advances and deductions come off)
${t("pay_items", `  tutor_id text NOT NULL REFERENCES people(id),
  month text NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  kind text NOT NULL CHECK (kind IN ('allowance','bonus','deduction','advance')),
  label text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  added_by text REFERENCES people(id)`)}

-- a month's payslip: worked out by calc.mjs, confirmed by the Director (or a pay admin), signed by the tutor
${t("payslips", `  tutor_id text NOT NULL REFERENCES people(id),
  month text NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','signed')),
  lines jsonb NOT NULL DEFAULT '[]',
  gross numeric NOT NULL DEFAULT 0, off numeric NOT NULL DEFAULT 0, net numeric NOT NULL DEFAULT 0,
  confirmed_by text REFERENCES people(id), confirmed_at timestamptz,
  signed_at timestamptz,
  UNIQUE (tutor_id, month)`)}

-- who did what. area 'pay' entries are only for the Director and pay admins.
${t("activity", `  actor_id text REFERENCES people(id),
  action text NOT NULL,
  area text NOT NULL DEFAULT 'teaching',
  entity text, entity_id text,
  summary text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'`)}

-- a command sent twice (a phone retrying after losing signal) is done once: the first result is kept here
CREATE TABLE ops (op_id text PRIMARY KEY, person_id text, name text, result jsonb, at timestamptz NOT NULL DEFAULT now());

CREATE INDEX ON groups (tutor_id);
CREATE INDEX ON group_students (student_id);
CREATE INDEX ON sessions (group_id, day);
CREATE INDEX ON attendance (student_id);
CREATE INDEX ON sras (student_id, due);
CREATE INDEX ON sras (group_id, due);
CREATE INDEX ON makeups (student_id);
CREATE INDEX ON periods (student_id);
CREATE INDEX ON activity (actor_id);
CREATE INDEX ON guardians (student_id);
${TABLES.map(x => `CREATE INDEX ON ${x} (rev);`).join("\n")}
` }];
