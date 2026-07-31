import { toggleSupervisorAction } from "@/app/actions";
import { Flash } from "@/components/flash";
import { StaffAccountCreateDialog } from "@/components/staff-account-create-dialog";
import { SupervisorAccountManager } from "@/components/supervisor-account-manager";
import { getSupervisorAccounts } from "@/lib/cached-data";
import { formatDateTime } from "@/lib/dates";
import { requireManagement } from "@/lib/session";

export const metadata = { title: "Staff access" };
export default async function SupervisorsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const operator = await requireManagement(); const query = await searchParams; const users = await getSupervisorAccounts();
  return <div className="page">
    <div className="page-head">
      <div>
        <span className="eyebrow">Access control</span>
        <h1>Staff access</h1>
        <p>Managers run daily operations. Supervisors have focused POS access.</p>
      </div>
      <StaffAccountCreateDialog operatorRole={operator.role} />
    </div>
    <Flash success={query.success} error={query.error} />
    <div className="card">
        <div className="card-head">
          <h2>Manager and supervisor accounts</h2>
          <span className="badge">{users.length}</span>
        </div>
        <div className="table-wrap supervisor-table-wrap">
          <table className="supervisor-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Created</th>
                <th>Account status</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => <tr key={user.id}>
                <td data-label="Name">
                  <strong>{user.fullName}</strong>
                </td>
                <td data-label="Username">@{user.displayUsername || user.username}</td>
                <td data-label="Role"><span className={`badge ${user.role === "MANAGER" ? "warning" : ""}`}>{user.role}</span></td>
                <td data-label="Created">{formatDateTime(user.createdAt)}</td>
                <td data-label="Status">
                  <div className="actions supervisor-status">
                    <span className={`badge ${user.isActive ? "success" : "danger"}`}>
                      {user.isActive ? "Active" : "Disabled"}
                    </span>{(operator.role === "ADMIN" || user.role === "SUPERVISOR") && <form action={toggleSupervisorAction}>
                      <input type="hidden" name="id" value={user.id} />
                      <input type="hidden" name="isActive" value={String(!user.isActive)} />
                      <button className={`btn ${user.isActive ? "btn-danger" : "btn-soft"}`}>
                        {user.isActive ? "Disable" : "Enable"}</button>
                    </form>}
                  </div>
                </td>
                <td data-label="Manage">
                  {operator.role === "ADMIN" || user.role === "SUPERVISOR"
                    ? <SupervisorAccountManager user={user} canEditRole={operator.role === "ADMIN"} />
                    : <span className="muted">Admin only</span>}
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>
    </div>
  </div>;
}
