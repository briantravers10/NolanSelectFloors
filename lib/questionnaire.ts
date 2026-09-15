// Full text of the Company Setup discovery questionnaire.
export interface QuestionnaireSection {
  key: string;
  title: string;
  questions: { key: string; text: string }[];
}

export const QUESTIONNAIRE: QuestionnaireSection[] = [
  {
    key: "BUSINESS",
    title: "Business",
    questions: [
      { key: "employees", text: "How many employees?" },
      { key: "mgmt_companies", text: "How many management companies?" },
      { key: "buildings", text: "Approximately how many buildings?" },
      { key: "jobs_per_week", text: "How many jobs per week?" },
      { key: "office_manager", text: "Who manages the office?" },
      { key: "schedule_creator", text: "Who creates the schedule?" },
      { key: "material_orderer", text: "Who orders materials?" },
    ],
  },
  {
    key: "CLIENTS",
    title: "Clients",
    questions: [
      { key: "which_mgmt_companies", text: "Which management companies do you work for?" },
      { key: "managers_at_each", text: "Who are the managers at each company?" },
      { key: "buildings_per_manager", text: "Which buildings does each manager control?" },
      { key: "job_request_channel", text: "How are job requests normally received (phone/email/text)?" },
      { key: "recurring_frequency", text: "How frequently do recurring clients send work?" },
      { key: "repeated_lookups", text: "What client information do you repeatedly have to look up?" },
    ],
  },
  {
    key: "JOB_REQUESTS",
    title: "Job Requests",
    questions: [
      { key: "what_happens", text: "What happens when a manager sends you a job?" },
      { key: "who_records", text: "Who records it?" },
      { key: "where_recorded", text: "Where is it currently recorded?" },
      { key: "info_needed", text: "What information do you need?" },
      { key: "before_scheduling", text: "What happens before you can schedule it?" },
    ],
  },
  {
    key: "ESTIMATING",
    title: "Estimating",
    questions: [
      { key: "when_site_visit", text: "When is a site visit required?" },
      { key: "who_performs_visit", text: "Who performs it?" },
      { key: "how_estimates_created", text: "How are estimates created?" },
      { key: "how_sent", text: "How are they sent?" },
      { key: "how_approval_arrives", text: "How does approval arrive?" },
    ],
  },
  {
    key: "SCHEDULING",
    title: "Scheduling",
    questions: [
      { key: "who_builds_schedule", text: "Who builds the schedule?" },
      { key: "how_far_ahead", text: "How far ahead?" },
      { key: "how_often_changes", text: "How often does it change?" },
      { key: "how_workers_receive", text: "How do workers receive schedules?" },
      { key: "scheduling_problems", text: "What causes scheduling problems?" },
      { key: "crew_size", text: "How do you determine crew size?" },
      { key: "who_goes_where", text: "How do you decide which workers go to which project?" },
      { key: "capabilities_importance", text: "How important are worker capabilities?" },
      { key: "driver_importance", text: "How important is having a driver on each crew?" },
    ],
  },
  {
    key: "STAFF",
    title: "Staff",
    questions: [
      { key: "how_many_workers", text: "How many workers?" },
      { key: "job_titles", text: "What are their job titles?" },
      { key: "day_rates", text: "What are their Day Rates?" },
      { key: "who_can_what", text: "Which workers can install/sand/finish/drive/supervise?" },
      { key: "multi_role", text: "Who can perform multiple roles?" },
      { key: "time_and_half_frequency", text: "How often is time-and-a-half paid?" },
      { key: "labor_calc_today", text: "How is labor currently calculated?" },
      { key: "man_count_calc_today", text: "How is weekly man count currently calculated?" },
      { key: "labor_cost_per_project_today", text: "How do you calculate labor cost per project?" },
    ],
  },
  {
    key: "MATERIALS",
    title: "Materials",
    questions: [
      { key: "who_orders", text: "Who orders materials?" },
      { key: "where_ordered", text: "Where?" },
      { key: "orders_tracked", text: "How are orders tracked?" },
      { key: "deliveries_tracked", text: "How are deliveries tracked?" },
      { key: "delay_causes", text: "What causes delays?" },
    ],
  },
  {
    key: "FINANCIAL",
    title: "Financial",
    questions: [
      { key: "know_job_cost", text: "How do you currently know what a job costs?" },
      { key: "labor_cost_tracked", text: "How is labor cost tracked?" },
      { key: "material_cost_tracked", text: "How are material costs tracked?" },
      { key: "see_profitability", text: "Can you easily see project profitability?" },
      { key: "accounting_software", text: "What accounting software is used?" },
    ],
  },
  {
    key: "PAIN_POINTS",
    title: "Pain Points",
    questions: [
      { key: "most_time", text: "What takes up most of your time?" },
      { key: "workers_call_about", text: "What do workers constantly call you about?" },
      { key: "managers_call_about", text: "What do managers constantly call you about?" },
      { key: "repeated_entry", text: "What information gets entered repeatedly?" },
      { key: "forgotten", text: "What gets forgotten?" },
      { key: "delays", text: "What causes delays?" },
      { key: "mistakes", text: "What causes mistakes?" },
      { key: "depends_on_you", text: "What depends entirely on you?" },
      { key: "week_off", text: "What would stop working if you took a week off?" },
      { key: "automate_five", text: "If you could automate five things tomorrow, what would they be?" },
    ],
  },
];
