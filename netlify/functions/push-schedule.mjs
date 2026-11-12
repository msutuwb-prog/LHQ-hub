/* LHQ Hub › timed phone notifications, every 5 minutes (study-block reminders and snoozes); the rest on the hour: the 07:00 morning summary and SRAs for the day, tutors' daily
   report at 16:00, and a student's report the hour after their last session. Does nothing without the two push keys. */
import { pushTick } from "./hub.mjs";
export default async (req, context) => {
  try{ const r = await pushTick(context); return new Response(JSON.stringify(r), { headers: { "content-type": "application/json" } }); }
  catch(e){ console.error(e); return new Response("error", { status: 500 }); }
};
export const config = { schedule: "*/5 * * * *" };
