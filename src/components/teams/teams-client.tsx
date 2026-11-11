"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserPlus, Users, X, Trash2 } from "lucide-react";
import { ActionButton, BrutalCard, EmptyState, MonoLabel } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type { Department, Profile, ProjectTeam } from "@/types/database";

export function TeamsClient({
  profile,
  initialTeams,
  departments,
}: {
  profile: Profile;
  initialTeams: ProjectTeam[];
  departments: Department[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [teams, setTeams] = useState<ProjectTeam[]>(initialTeams);
  const [showCreate, setShowCreate] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [memberInput, setMemberInput] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: "",
    project_title: "",
    course_code: "",
    faculty_mentor: "",
    department_id: departments[0]?.id || "",
    description: "",
    allow_member_requests: true,
  });

  async function refresh() {
    const res = await fetch("/api/teams");
    if (res.ok) {
      const d = await res.json();
      setTeams(d.teams ?? []);
    }
    router.refresh();
  }

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || "Failed to create team", "error");
      return;
    }
    toast(`Team created! Invite code: ${data.team?.code}`, "success");
    setShowCreate(false);
    setForm({
      name: "",
      project_title: "",
      course_code: "",
      faculty_mentor: "",
      department_id: departments[0]?.id || "",
      description: "",
      allow_member_requests: true,
    });
    await refresh();
  }

  async function handleJoinTeam(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", code: joinCode }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || "Could not join team", "error");
      return;
    }
    toast(`Joined team ${data.teamName}`, "success");
    setJoinCode("");
    await refresh();
  }

  async function handleAddMember(teamId: string) {
    const academicId = memberInput[teamId]?.trim();
    if (!academicId) return;
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ academic_id: academicId, can_borrow: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || "Could not add member", "error");
      return;
    }
    toast(`Added ${data.member?.full_name} to team`, "success");
    setMemberInput((prev) => ({ ...prev, [teamId]: "" }));
    await refresh();
  }

  async function handleRemoveMember(teamId: string, userId: string) {
    const res = await fetch(`/api/teams/${teamId}/members?userId=${userId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const d = await res.json();
      toast(d.error || "Failed to remove member", "error");
      return;
    }
    toast("Member removed", "success");
    await refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b-2 border-slate-900 pb-4 sm:flex-row sm:items-end">
        <div>
          <MonoLabel>COLLABORATIVE HARDWARE WORKSPACES</MonoLabel>
          <h1 className="font-display mt-1 text-2xl font-black tracking-tight uppercase sm:text-3xl">
            Student Project Teams
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleJoinTeam} className="flex items-center gap-1.5">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter Team Code (TM-...)"
              className="border-2 border-slate-900 bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase"
            />
            <ActionButton type="submit" variant="secondary" size="sm">
              Join Team
            </ActionButton>
          </form>
          <ActionButton variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5" />
            New Team
          </ActionButton>
        </div>
      </div>

      {teams.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No project teams yet"
          description="Create a project team or join an existing one with a team invite code to share component borrowing and track shared hardware."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {teams.map((team) => {
            const isLeader = team.leader_id === profile.id || profile.role === "admin";
            return (
              <BrutalCard key={team.id} className="p-5">
                <div className="flex items-start justify-between gap-3 border-b-2 border-slate-900 pb-3">
                  <div>
                    <MonoLabel>INVITE CODE: {team.code}</MonoLabel>
                    <h2 className="mt-1 text-lg font-black text-slate-950">{team.name}</h2>
                    <p className="text-xs font-bold text-slate-600">
                      Project: {team.projects?.title ?? "Hardware Build"}{" "}
                      {team.projects?.course_code ? `(${team.projects.course_code})` : ""}
                    </p>
                  </div>
                  <span className="border-2 border-slate-900 bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-black text-white uppercase">
                    {(team.team_members ?? []).length} MEMBERS
                  </span>
                </div>

                {team.description && (
                  <p className="mt-3 text-xs text-slate-600">{team.description}</p>
                )}

                <div className="mt-4 space-y-2">
                  <span className="block font-mono text-[10px] font-black text-slate-500 uppercase">
                    Team Roster
                  </span>
                  {(team.team_members ?? []).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between border border-slate-300 bg-slate-50 px-3 py-2 text-xs"
                    >
                      <div>
                        <span className="font-bold">{m.profiles?.full_name}</span>
                        <span className="ml-2 font-mono text-[10px] text-slate-500">
                          {m.profiles?.academic_id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="border border-slate-900 bg-white px-1.5 py-0.5 font-mono text-[9px] font-black uppercase">
                          {m.role}
                        </span>
                        {isLeader && m.role !== "leader" && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(team.id, m.user_id)}
                            className="cursor-pointer text-rose-600 hover:text-rose-800"
                            title="Remove member"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {isLeader && (
                  <div className="mt-4 flex items-center gap-2 border-t-2 border-slate-200 pt-3">
                    <input
                      value={memberInput[team.id] || ""}
                      onChange={(e) =>
                        setMemberInput((prev) => ({
                          ...prev,
                          [team.id]: e.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="Add Student ID (e.g. ECE23014)"
                      className="flex-1 border-2 border-slate-900 px-3 py-1.5 font-mono text-xs font-bold uppercase"
                    />
                    <ActionButton
                      size="sm"
                      variant="secondary"
                      onClick={() => handleAddMember(team.id)}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Add
                    </ActionButton>
                  </div>
                )}
              </BrutalCard>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <BrutalCard className="shadow-brutal-10 w-full max-w-lg p-6">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
              <div>
                <MonoLabel>TEAM FORMATION</MonoLabel>
                <h3 className="text-base font-black uppercase">Create Project Team</h3>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} className="cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Team Name *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Team Pulse Robotics"
                  className="w-full border-2 border-slate-900 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Project Title *
                </label>
                <input
                  required
                  value={form.project_title}
                  onChange={(e) => setForm((f) => ({ ...f, project_title: e.target.value }))}
                  placeholder="e.g. Autonomous Line-Following Delivery Bot"
                  className="w-full border-2 border-slate-900 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Course Code
                  </label>
                  <input
                    value={form.course_code}
                    onChange={(e) => setForm((f) => ({ ...f, course_code: e.target.value }))}
                    placeholder="ECE-499"
                    className="w-full border-2 border-slate-900 px-3 py-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                    Faculty Mentor
                  </label>
                  <input
                    value={form.faculty_mentor}
                    onChange={(e) => setForm((f) => ({ ...f, faculty_mentor: e.target.value }))}
                    placeholder="Dr. S. Krishnan"
                    className="w-full border-2 border-slate-900 px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] font-black uppercase">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border-2 border-slate-900 p-2.5 text-xs"
                />
              </div>
              <label className="flex items-center gap-2 font-mono text-xs font-bold">
                <input
                  type="checkbox"
                  checked={form.allow_member_requests}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, allow_member_requests: e.target.checked }))
                  }
                />
                Allow all team members to submit borrow requests on behalf of the team
              </label>

              <div className="flex justify-end gap-2 border-t-2 border-slate-200 pt-3">
                <ActionButton
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </ActionButton>
                <ActionButton type="submit" variant="primary">
                  Create Team
                </ActionButton>
              </div>
            </form>
          </BrutalCard>
        </div>
      )}
    </div>
  );
}
