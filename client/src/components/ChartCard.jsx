import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { number } from "../utils/format";
import { EmptyState } from "./UI";
export default function ChartCard({
  title,
  subtitle,
  data = [],
  type = "area",
  unit = "L",
}) {
  const colors = ["#12988c", "#eab14d", "#ed7b6d"];
  const common = (
    <>
      <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e7edf0" />
      <XAxis
        dataKey="name"
        tick={{ fontSize: 11, fill: "#627487" }}
        tickFormatter={(value) =>
          /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? `${value.slice(8, 10)}/${value.slice(5, 7)}`
            : value.length > 13
              ? `${value.slice(0, 12)}…`
              : value
        }
        axisLine={false}
        tickLine={false}
        tickMargin={12}
      />
      <YAxis
        tick={{ fontSize: 11, fill: "#627487" }}
        axisLine={false}
        tickLine={false}
        tickFormatter={(n) => (n >= 1000 ? `${n / 1000}k` : n)}
      />
      <Tooltip
        formatter={(v) => [`${number(v)} ${unit}`, "Consumption"]}
        contentStyle={{ borderRadius: 12, border: "1px solid #e4ebed" }}
      />
    </>
  );
  return (
    <section className="panel chart-card">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span className="chart-unit">{unit === "L" ? "LITRES" : "AREAS"}</span>
      </div>
      {!data.length || !data.some((d) => d.amount) ? (
        <EmptyState message="No data to chart yet." />
      ) : (
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            {type === "pie" ? (
              <PieChart>
                <Pie
                  data={data}
                  dataKey="amount"
                  nameKey="name"
                  innerRadius={65}
                  outerRadius={90}
                  paddingAngle={5}
                >
                  {data.map((d, i) => (
                    <Cell key={d.name} fill={colors[i]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            ) : type === "bar" ? (
              <BarChart
                data={data}
                margin={{ top: 10, right: 12, left: -10, bottom: 12 }}
              >
                {common}
                <Bar
                  dataKey="amount"
                  fill="#4288b4"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            ) : (
              <AreaChart
                data={data}
                margin={{ top: 10, right: 12, left: -10, bottom: 12 }}
              >
                {common}
                <defs>
                  <linearGradient id="waterFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#39aea6" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#39aea6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  dataKey="amount"
                  stroke="#159f99"
                  strokeWidth={2.5}
                  fill="url(#waterFill)"
                  type="monotone"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      {type === "pie" && (
        <div className="legend">
          {data.map((d, i) => (
            <span key={d.name}>
              <i style={{ background: colors[i] }} />
              {d.name.toLowerCase()} <b>{d.amount}</b>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
