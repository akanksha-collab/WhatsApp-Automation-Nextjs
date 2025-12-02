// Dashboard (Home) page

export default function Dashboard() {
  return (
    <div className="space-y-8">
      {/* Page title */}
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-whatsapp-dark-teal">Dashboard</h1>
        <p className="text-sm text-gray-600">
          Overview of cases and scheduled posts
        </p>
      </header>

      {/* Top stats cards */}
      <section className="grid gap-6 md:grid-cols-3">
        <StatCard label="Urgent" value="3" subtitle="cases" tone="red" />
        <StatCard label="Today" value="12" subtitle="posts" tone="whatsapp" />
        <StatCard label="Sent" value="156" subtitle="this week" tone="teal" />
      </section>

      {/* Bottom sections: Deadlines & Next posts */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming deadlines */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold tracking-wide text-whatsapp-dark-teal mb-4">
            UPCOMING DEADLINES
          </h2>
          <div className="space-y-3">
            <DeadlineItem
              color="red"
              company="Acme Corp"
              code="ACME"
              daysLeft={5}
            />
            <DeadlineItem
              color="amber"
              company="Tech Inc"
              code="TECH"
              daysLeft={12}
            />
            <DeadlineItem
              color="whatsapp"
              company="Bank Co"
              code="BANK"
              daysLeft={45}
            />
          </div>
        </div>

        {/* Next posts today */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold tracking-wide text-whatsapp-dark-teal mb-4">
            NEXT POSTS TODAY
          </h2>
          <div className="space-y-3">
            <PostRow time="9:00 AM" company="Acme Corp" type="Image" />
            <PostRow time="11:00 AM" company="Acme Corp" type="Video" />
            <PostRow time="2:00 PM" company="Tech Inc" type="Article" />
          </div>
        </div>
      </section>
    </div>
  );
}

// Small reusable components:

function StatCard({ label, value, subtitle, tone = "whatsapp" }: {
  label: string;
  value: string;
  subtitle: string;
  tone?: "red" | "amber" | "whatsapp" | "teal";
}) {
  const toneMap = {
    red: "bg-red-100 text-red-600",
    amber: "bg-amber-100 text-amber-600",
    whatsapp: "bg-whatsapp-light-green text-whatsapp-dark-teal",
    teal: "bg-whatsapp-teal/10 text-whatsapp-teal",
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <span className="text-xs font-semibold tracking-wide text-gray-600 uppercase">
        {label}
      </span>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-whatsapp-dark-teal">{value}</span>
        <span className="text-sm text-gray-600">{subtitle}</span>
      </div>
      <div className={`inline-flex w-fit px-3 py-1 rounded-full text-xs font-medium ${toneMap[tone]}`}>
        {label} summary
      </div>
    </div>
  );
}

function DeadlineItem({ color = "red", company, code, daysLeft }: {
  color?: "red" | "amber" | "whatsapp";
  company: string;
  code: string;
  daysLeft: number;
}) {
  const dotColor =
    color === "red"
      ? "bg-red-500"
      : color === "amber"
      ? "bg-amber-500"
      : "bg-whatsapp-green";

  return (
    <div className="flex items-center justify-between text-sm hover:bg-whatsapp-beige/50 p-2 rounded-lg transition-colors">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
        <div>
          <div className="font-medium text-gray-900">
            {company} <span className="text-gray-500">({code})</span>
          </div>
        </div>
      </div>
      <div className="text-gray-600 font-medium">{daysLeft} days left</div>
    </div>
  );
}

function PostRow({ time, company, type }: {
  time: string;
  company: string;
  type: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm hover:bg-whatsapp-beige/50 p-2 rounded-lg transition-colors">
      <div className="text-whatsapp-dark-teal font-semibold">{time}</div>
      <div className="flex items-center gap-2 text-gray-700">
        <span>{company}</span>
        <span className="text-xs px-3 py-1 rounded-full bg-whatsapp-light-green text-whatsapp-dark-teal font-medium">
          {type}
        </span>
      </div>
    </div>
  );
}
