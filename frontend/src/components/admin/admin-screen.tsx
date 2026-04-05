"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, type OutletRecord, type Permission, type Role, type UserRecord } from "@/lib/api";

type UserForm = {
  fullName: string;
  email: string;
  password: string;
  roleId: string;
};

type RoleForm = {
  name: string;
  description: string;
  permissionIds: string[];
};

type OutletForm = {
  name: string;
  address: string;
  phone: string;
};

const userStatusStyles: Record<"ACTIVE" | "INACTIVE", string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  INACTIVE: "bg-rose-100 text-rose-700",
};

export function AdminScreen() {
  const session = api.getSession();
  const sessionKey = session?.accessToken ?? "";
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [outlets, setOutlets] = useState<OutletRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<UserForm>({
    fullName: "",
    email: "",
    password: "",
    roleId: "",
  });
  const [roleForm, setRoleForm] = useState<RoleForm>({
    name: "",
    description: "",
    permissionIds: [],
  });
  const [outletForm, setOutletForm] = useState<OutletForm>({
    name: "",
    address: "",
    phone: "",
  });
  const [activeTab, setActiveTab] = useState<"users" | "outlets">("users");

  const loadAdminData = async () => {
    const [usersResponse, rolesResponse, permissionsResponse, outletsResponse] = await Promise.all([
      api.listUsers({ page: 1, limit: 100 }),
      api.listRoles(),
      api.listPermissions(),
      api.listOutlets(),
    ]);

    setUsers(usersResponse.data);
    setRoles(rolesResponse);
    setPermissions(permissionsResponse);
    setOutlets(outletsResponse);
    setUserForm((current) => ({
      ...current,
      roleId: current.roleId || rolesResponse[0]?.id || "",
    }));
  };

  useEffect(() => {
    const bootstrap = async () => {
      if (!sessionKey) {
        setLoading(false);
        return;
      }

      try {
        setError(null);
        await loadAdminData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load admin data");
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, [sessionKey]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => {
      const roleName = user.role?.name ?? "";
      return (
        user.fullName.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        roleName.toLowerCase().includes(term)
      );
    });
  }, [search, users]);

  const createUser = async () => {
    if (!userForm.fullName || !userForm.email || !userForm.password || !userForm.roleId) return;

    try {
      setError(null);
      setMessage(null);
      await api.createUser(userForm);
      await loadAdminData();
      setUserForm({ fullName: "", email: "", password: "", roleId: roles[0]?.id ?? "" });
      setMessage("User created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    }
  };

  const createRole = async () => {
    if (!roleForm.name || !roleForm.description) return;

    try {
      setError(null);
      setMessage(null);
      await api.createRole(roleForm);
      await loadAdminData();
      setRoleForm({ name: "", description: "", permissionIds: [] });
      setMessage("Role created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create role");
    }
  };

  const createOutlet = async () => {
    if (!outletForm.name) return;

    try {
      setError(null);
      setMessage(null);
      await api.createOutlet({
        name: outletForm.name,
        address: outletForm.address || undefined,
        phone: outletForm.phone || undefined,
      });
      await loadAdminData();
      setOutletForm({ name: "", address: "", phone: "" });
      setMessage("Outlet created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create outlet");
    }
  };

  const toggleUserStatus = async (user: UserRecord) => {
    try {
      setError(null);
      setMessage(null);
      await api.updateUser(user.id, { isActive: !user.isActive });
      await loadAdminData();
      setMessage("User status updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  const togglePermission = (permissionId: string) => {
    setRoleForm((current) => ({
      ...current,
      permissionIds: current.permissionIds.includes(permissionId)
        ? current.permissionIds.filter((id) => id !== permissionId)
        : [...current.permissionIds, permissionId],
    }));
  };

  if (!session) {
    return (
      <div className="rounded-[28px] border border-line bg-white p-8">
        <h2 className="text-2xl font-bold">Administration</h2>
        <p className="mt-3 text-sm text-muted">Sign in first to manage users, roles, and outlets.</p>
        <Link href="/login" className="btn-primary mt-5 inline-flex">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 xl:h-[calc(100vh-12rem)] xl:flex xl:flex-col">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between xl:shrink-0">
        <div className="flex gap-4">
          <div className="rounded-[24px] border border-line bg-white px-5 py-4">
            <p className="text-xs text-muted">Users</p>
            <p className="mt-1 text-2xl font-bold">{users.length}</p>
          </div>
          <div className="rounded-[24px] border border-line bg-white px-5 py-4">
            <p className="text-xs text-muted">Outlets</p>
            <p className="mt-1 text-2xl font-bold">{outlets.length}</p>
          </div>
        </div>
        <div className="flex rounded-2xl border border-line bg-surface p-1 gap-1 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === "users" ? "bg-white shadow-sm text-ink" : "text-muted hover:text-ink"
            }`}
          >
            User Management
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("outlets")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === "outlets" ? "bg-white shadow-sm text-ink" : "text-muted hover:text-ink"
            }`}
          >
            Outlet Management
          </button>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted">Loading administration workspace...</p> : null}
      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
      {message ? <p className="text-sm font-medium text-emerald-700">{message}</p> : null}

      {activeTab === "users" && (
        <div className="space-y-5 xl:flex-1 xl:overflow-y-auto">
          <div className="rounded-[28px] border border-line bg-white p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Manage users</p>
                <h3 className="mt-1 text-xl font-bold">Team members</h3>
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, role"
                className="w-full rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm outline-none ring-brand/30 transition focus:ring lg:w-80"
              />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[24px] border border-line bg-surface p-4">
                <h4 className="font-semibold">Add user</h4>
                <div className="mt-4 space-y-3">
                  <input
                    value={userForm.fullName}
                    onChange={(event) => setUserForm((current) => ({ ...current, fullName: event.target.value }))}
                    placeholder="Full name"
                    className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none"
                  />
                  <input
                    value={userForm.email}
                    onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="Email address"
                    className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none"
                  />
                  <input
                    value={userForm.password}
                    onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder="Temporary password"
                    type="password"
                    className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none"
                  />
                  <select
                    value={userForm.roleId}
                    onChange={(event) => setUserForm((current) => ({ ...current, roleId: event.target.value }))}
                    className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none"
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={createUser} className="btn-primary w-full">
                    Create user
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-[24px] border border-line">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-line text-sm">
                    <thead className="bg-surface text-left text-muted">
                      <tr>
                        <th className="px-4 py-3 font-medium">User</th>
                        <th className="px-4 py-3 font-medium">Role</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line bg-white">
                      {filteredUsers.map((user) => {
                        const status = user.isActive === false ? "INACTIVE" : "ACTIVE";
                        return (
                          <tr key={user.id}>
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-semibold text-ink">{user.fullName}</p>
                                <p className="mt-1 text-xs text-muted">{user.email}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted">{user.role?.name ?? "Unassigned"}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${userStatusStyles[status]}`}>
                                {status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => toggleUserStatus(user)}
                                className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand"
                              >
                                Toggle status
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-line bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Manage roles</p>
                <h3 className="mt-1 text-xl font-bold">Role templates</h3>
              </div>
              <span className="rounded-full bg-brand/10 px-3 py-1 text-sm font-semibold text-brand">
                {roles.length} roles
              </span>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[24px] border border-line bg-surface p-4">
                <h4 className="font-semibold">Create role</h4>
                <div className="mt-4 space-y-3">
                  <input
                    value={roleForm.name}
                    onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Role name"
                    className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none"
                  />
                  <textarea
                    value={roleForm.description}
                    onChange={(event) => setRoleForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Role description"
                    className="min-h-28 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none"
                  />
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-line bg-white p-3">
                    {permissions.map((permission) => (
                      <label key={permission.id} className="flex items-start gap-3 text-sm text-ink">
                        <input
                          type="checkbox"
                          checked={roleForm.permissionIds.includes(permission.id)}
                          onChange={() => togglePermission(permission.id)}
                          className="mt-1"
                        />
                        <span>
                          {permission.name}
                          <span className="block text-xs text-muted">{permission.module} / {permission.action}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <button type="button" onClick={createRole} className="btn-primary w-full">
                    Save role
                  </button>
                </div>
              </div>

              <div className="grid gap-3">
                {roles.map((role) => {
                  const memberCount = users.filter((user) => user.role?.id === role.id).length;
                  return (
                    <article key={role.id} className="rounded-[24px] border border-line bg-surface p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-lg font-semibold">{role.name}</h4>
                          <p className="mt-1 text-sm text-muted">{role.description ?? "No description"}</p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand">
                          {memberCount} members
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(role.permissions ?? []).map((permission) => (
                          <span
                            key={permission.permission.id}
                            className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-muted"
                          >
                            {permission.permission.name}
                          </span>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "outlets" && (
        <div className="rounded-[28px] border border-line bg-white p-5 xl:flex-1 xl:overflow-y-auto">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Manage outlets</p>
              <h3 className="mt-1 text-xl font-bold">Outlet directory</h3>
            </div>
            <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
              {outlets.length} records
            </span>
          </div>

          <div className="mt-5 rounded-[24px] border border-line bg-surface p-4">
            <h4 className="font-semibold">Add outlet</h4>
            <div className="mt-4 grid gap-3">
              <input
                value={outletForm.name}
                onChange={(event) => setOutletForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Outlet name"
                className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none"
              />
              <input
                value={outletForm.address}
                onChange={(event) => setOutletForm((current) => ({ ...current, address: event.target.value }))}
                placeholder="Address"
                className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none"
              />
              <input
                value={outletForm.phone}
                onChange={(event) => setOutletForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="Phone"
                className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none"
              />
              <button type="button" onClick={createOutlet} className="btn-primary w-full">
                Save outlet
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {outlets.map((outlet) => (
              <article key={outlet.id} className="rounded-[24px] border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-semibold">{outlet.name}</h4>
                    <p className="mt-1 text-sm text-muted">{outlet.address ?? "No address"}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${outlet.isActive === false ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {outlet.isActive === false ? "INACTIVE" : "ACTIVE"}
                  </span>
                </div>
                <div className="mt-4 text-sm text-muted">Phone: {outlet.phone ?? "Not set"}</div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
