/* LHQ Hub: built-in lists, company details and message wording, used until someone changes them in Settings.
   Shared by the Hub pages and the document page. */
const DEFAULT_SUBJECTS = ['Mathematics','Additional Mathematics','Physics','Chemistry','Biology','Combined Science',
  'English Language','English Literature','Economics','Business Studies','Accounting','Computer Science','ICT',
  'Geography','History','French','Global Perspectives'];

/* Business › Spending: the categories, in the order they are offered. Renovations and Purchases are one-off costs. */
const DEFAULT_SPEND_CATS = ['Salaries','Rentals','Utilities','Communication','Stationery','Transportation','Marketing','Maintenance','Trainings','Renovations','Purchases'];

const DEFAULT_SETTINGS = {
  email:'learnhqes@gmail.com', phone:'265 992 525 250',
  bank:'National Bank of Malawi', accname:'LearnHQ Tutoring and Training',
  branch:'Gateway', accno:'1007401201',
  popphone:'0992 525 250', mobile:'0992 520 520', rate:'15000', validDays:'30', dueDays:'0', graceDays:'3',
  subjects: DEFAULT_SUBJECTS.join('\n'),
  levels: ['Year 1','Year 2','Year 3','Year 4','Year 5','Year 6 · Primary Checkpoint','Year 7','Year 8','Year 9 · Checkpoint',
    'Year 10 · IGCSE','Year 11 · IGCSE','Year 12 · AS Level','Year 13 · A Level','IB','IELTS','SAT','College'].join('\n'),
  spendCats: DEFAULT_SPEND_CATS.join('\n'),
  methods: ['Bank transfer','Airtel Money','TNM Mpamba','Cash','Cheque'].join('\n'),
  includes: ['Success Planner','Success Coaching','Progress Reports','Study Guides','Daily Assesments','Online Resource Hub'].join('\n'),
  tutors: ['Catherine Mkwinda','Emmanuel Mkwamba','Ungweru Kaonga','Mayamiko Goliati','Maureen Story','Wanangwa Msutu'].join('\n'),
  grades: ['A*','A','B','C','D','E','F','G','U'].join('\n'),
  gradeBasis: ['End of term results','Mid-term results','Mock exam','Class test','School report','Checkpoint results','LHQ assessment','Parent or student estimate'].join('\n'),
  sessionLengths: ['30 minutes','45 minutes','1 hour','1.5 hours','2 hours'].join('\n')
};

const DEFAULT_TEMPLATES = {
  emailSubject: 'LHQ Learning Solutions – Tutoring {Type} {number}',
  emailBody:
`Dear {name},

Thank you for choosing LHQ Learning Solutions. Please find attached your tutoring {type} ({number}) for {for}, covering {period}.

{subjects}

{summary}

Payment details
Bank: {bank}
Account name: {accname}
Branch: {branch}
Account number: {accno}
Mobile banking: {mobile} (please include the withdrawal fee)

Kindly send your proof of payment to {popphone} or {email}. A receipt will be issued once the payment has been confirmed.

{includesline}

Warm regards,
LHQ Learning Solutions
+{phone} · {email}`,
  waBody:
`Hello {name},

Thank you for choosing LHQ Learning Solutions. Here is your tutoring {type} ({number}) for {for}, {period}.

{summary}

Bank: {bank}, {accname}, {branch} branch, Acc. {accno}
Mobile banking: {mobile} (include the withdrawal fee)

Please send proof of payment to {popphone}. A receipt will follow once payment is confirmed.

LHQ Learning Solutions`,
  receiptEmailBody:
`Dear {name},

Thank you for your payment of MKW {received} for {for}. Please find attached your receipt ({number}){refline}.

Invoice total: MKW {total}
Paid before this: MKW {prevpaid}
This payment: MKW {received}
Balance remaining: MKW {balance}

Please keep this receipt for your records. For any questions, call {popphone} or email {email}.

Warm regards,
LHQ Learning Solutions
+{phone} · {email}`,
  receiptWaBody:
`Hello {name},

Thank you for your payment of *MKW {received}* for {for}. Here is your receipt ({number}).

Balance remaining: *MKW {balance}*

Please keep this receipt for your records.
LHQ Learning Solutions`
};
