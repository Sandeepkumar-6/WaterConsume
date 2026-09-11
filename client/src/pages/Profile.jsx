import { useApi } from "../hooks/useApi";
import {
  PageHeading,
  Loading,
  ErrorState,
  StatusBadge,
} from "../components/UI";
import { number } from "../utils/format";
export default function Profile() {
  const { data, loading, error, reload } = useApi("/auth/me");
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} retry={reload} />;
  return (
    <>
      <PageHeading
        title="My profile"
        description="Your portal account and assigned workspace."
      />
      <section className="panel profile">
        <span className="avatar large">{data.name[0]}</span>
        <h2>{data.name}</h2>
        <p>{data.email}</p>
        <StatusBadge status={data.role} />
        <StatusBadge status={data.status} />
        <dl>
          <dt>Member since</dt>
          <dd>
            {new Date(data.createdAt).toLocaleDateString("en-IN", {
              timeZone: "Asia/Kolkata",
            })}
          </dd>
          <dt>Assigned area</dt>
          <dd>
            {data.role === "ADMIN"
              ? "All campus areas"
              : data.assignedArea?.name ||
                "No area assigned — contact your administrator"}
          </dd>
          {data.assignedArea && (
            <>
              <dt>Area status</dt>
              <dd>
                <StatusBadge status={data.assignedArea.status} />
              </dd>
              <dt>Daily limit</dt>
              <dd>{number(data.assignedArea.dailyLimit)} Litres</dd>
              <dt>Monthly limit</dt>
              <dd>{number(data.assignedArea.monthlyLimit)} Litres</dd>
              <dt>Location</dt>
              <dd>{data.assignedArea.location}</dd>
            </>
          )}
        </dl>
        <p className="muted">
          Contact an administrator to update your account or area assignment.
        </p>
      </section>
    </>
  );
}
